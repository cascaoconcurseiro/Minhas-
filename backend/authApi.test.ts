import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Pool } from 'pg';
import { createAttemptLimiter, signSessionToken, verifySessionToken } from './authSession.ts';

const originalQuery = Pool.prototype.query;
const oldEnv = {
  VERCEL: process.env.VERCEL,
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
};

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  email_verified: boolean;
  token_version: number;
}

const users = new Map<string, UserRow>();
let baseUrl = '';
let closeServer: () => Promise<void> = async () => undefined;

async function post(path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

before(async () => {
  process.env.VERCEL = '1';
  process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
  process.env.AUTH_SESSION_SECRET = 'test-session-secret-with-more-than-32-chars';
  Pool.prototype.query = (async function (sql: string, params: unknown[] = []) {
    if (/INSERT INTO public\.app_users/.test(sql)) {
      const [id, email, password_hash, display_name] = params as string[];
      if (users.has(email)) return { rows: [], rowCount: 0 };
      const row = { id, email, password_hash, display_name, email_verified: false, token_version: 0 };
      users.set(email, row);
      return { rows: [row], rowCount: 1 };
    }
    if (/UPDATE public\.app_users SET token_version/.test(sql)) {
      const row = [...users.values()].find((u) => u.id === params[0]);
      if (row) row.token_version += 1;
      return { rows: [], rowCount: row ? 1 : 0 };
    }
    if (/FROM public\.app_users WHERE email/.test(sql)) {
      const row = users.get(params[0] as string);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (/FROM public\.app_users WHERE id/.test(sql)) {
      const row = [...users.values()].find((u) => u.id === params[0]);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    throw new Error(`consulta inesperada no teste: ${sql}`);
  }) as unknown as typeof Pool.prototype.query;

  const { default: app } = await import('./app.ts');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
  closeServer = () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

after(async () => {
  Pool.prototype.query = originalQuery;
  await closeServer();
  for (const [name, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test('cadastro cria conta, devolve sessão válida e nunca guarda a senha em texto', async () => {
  const created = await post('/api/auth/register', {
    name: 'Ana Teste',
    email: 'Ana@Example.com ',
    password: 'senha-forte-123',
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.user.email, 'ana@example.com');
  assert.equal(created.body.user.emailVerified, false);
  const identity = verifySessionToken(created.body.token);
  assert.equal(identity.email, 'ana@example.com');
  const stored = users.get('ana@example.com');
  assert.ok(stored);
  assert.ok(stored.password_hash.startsWith('scrypt$'));
  assert.ok(!stored.password_hash.includes('senha-forte-123'));
});

test('cadastro rejeita e-mail repetido, e-mail inválido e senha curta', async () => {
  const duplicate = await post('/api/auth/register', { email: 'ana@example.com', password: 'outra-senha-123' });
  assert.equal(duplicate.status, 409);
  assert.equal((await post('/api/auth/register', { email: 'sem-arroba', password: 'senha-forte-123' })).status, 400);
  assert.equal((await post('/api/auth/register', { email: 'b@example.com', password: '1234567' })).status, 400);
});

test('login aceita a senha certa e recusa senha errada e e-mail desconhecido com a mesma mensagem', async () => {
  const ok = await post('/api/auth/login', { email: 'ANA@example.com', password: 'senha-forte-123' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);

  const wrong = await post('/api/auth/login', { email: 'ana@example.com', password: 'senha-errada-123' });
  const unknown = await post('/api/auth/login', { email: 'ninguem@example.com', password: 'senha-forte-123' });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrong.body.error, unknown.body.error);
});

test('rotas protegidas aceitam a sessão emitida e recusam token adulterado ou expirado', async () => {
  const login = await post('/api/auth/login', { email: 'ana@example.com', password: 'senha-forte-123' });
  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${login.body.token}` } });
  assert.equal(me.status, 200);

  const tampered = `${login.body.token.slice(0, -2)}xx`;
  const bad = await fetch(`${baseUrl}/api/workspace`, { headers: { Authorization: `Bearer ${tampered}` } });
  assert.equal(bad.status, 401);

  const expired = signSessionToken(
    { uid: 'x', email: 'x@example.com', email_verified: true, name: 'x' },
    Math.floor(Date.now() / 1000) - 40 * 24 * 3600
  );
  const old = await fetch(`${baseUrl}/api/workspace`, { headers: { Authorization: `Bearer ${expired}` } });
  assert.equal(old.status, 401);
});

test('logout invalida o token em todos os lugares, sem afetar outros usuários', async () => {
  const bob = await post('/api/auth/register', { name: 'Bob', email: 'bob@example.com', password: 'senha-do-bob-123' });
  const carol = await post('/api/auth/register', { name: 'Carol', email: 'carol@example.com', password: 'senha-da-carol-123' });
  assert.equal(bob.status, 201);
  assert.equal(carol.status, 201);
  assert.notEqual(bob.body.user.uid, carol.body.user.uid);

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  assert.equal((await fetch(`${baseUrl}/api/auth/me`, { headers: auth(bob.body.token) })).status, 200);

  const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: auth(bob.body.token) });
  assert.equal(logout.status, 204);

  // Token antigo do Bob morre; novo login funciona; Carol segue logada.
  assert.equal((await fetch(`${baseUrl}/api/auth/me`, { headers: auth(bob.body.token) })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/workspace`, { headers: auth(bob.body.token) })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/auth/me`, { headers: auth(carol.body.token) })).status, 200);
  const again = await post('/api/auth/login', { email: 'bob@example.com', password: 'senha-do-bob-123' });
  assert.equal((await fetch(`${baseUrl}/api/auth/me`, { headers: auth(again.body.token) })).status, 200);
});

test('muitas senhas erradas bloqueiam novas tentativas por um tempo', async () => {
  let last = 0;
  for (let i = 0; i < 9; i += 1) {
    last = (await post('/api/auth/login', { email: 'ana@example.com', password: `errada-${i}-xxxx` })).status;
  }
  assert.equal(last, 429);
});

test('limitador libera depois da janela de tempo', () => {
  const limiter = createAttemptLimiter(2, 1000);
  limiter.recordFailure('k', 0);
  limiter.recordFailure('k', 10);
  assert.equal(limiter.isBlocked('k', 20), true);
  assert.equal(limiter.isBlocked('k', 1500), false);
});
