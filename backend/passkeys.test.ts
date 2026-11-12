import assert from 'node:assert/strict';
import { createHash, createPrivateKey, generateKeyPairSync, randomBytes, sign as cryptoSign } from 'node:crypto';
import { after, before, test } from 'node:test';
import { Pool } from 'pg';
import { resolveRelyingParty } from './passkeys.ts';

const originalQuery = Pool.prototype.query;
const oldEnv = {
  VERCEL: process.env.VERCEL,
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
};

const HOST = 'app.minhas.test';
const ORIGIN = `https://${HOST}`;

interface UserRow {
  id: string; email: string; password_hash: string; display_name: string; email_verified: boolean; token_version: number;
}
interface PasskeyRow {
  id: string; user_id: string; public_key: string; counter: number; transports: string[]; rp_id: string;
  device_label: string; created_at: Date; last_used_at: Date | null;
}

const users = new Map<string, UserRow>();
const passkeys = new Map<string, PasskeyRow>();
let baseUrl = '';
let closeServer: () => Promise<void> = async () => undefined;

// ---- CBOR mínimo (o suficiente para uma atestação "none") ----
function head(major: number, n: number): Buffer {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 256) return Buffer.from([(major << 5) | 24, n]);
  return Buffer.from([(major << 5) | 25, n >> 8, n & 0xff]);
}
function cbor(value: unknown): Buffer {
  if (typeof value === 'number') return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (typeof value === 'string') { const b = Buffer.from(value); return Buffer.concat([head(3, b.length), b]); }
  if (Buffer.isBuffer(value)) return Buffer.concat([head(2, value.length), value]);
  if (value instanceof Map) {
    const parts: Buffer[] = [head(5, value.size)];
    for (const [k, v] of value) parts.push(cbor(k), cbor(v));
    return Buffer.concat(parts);
  }
  throw new Error('tipo CBOR não suportado no teste');
}

const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest();
const b64u = (data: Buffer) => data.toString('base64url');

/** Faz o papel do Face ID: guarda uma chave privada e assina o que o servidor pede. */
function createAuthenticator() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
  const credentialId = randomBytes(32);
  const cose = cbor(new Map<number, unknown>([
    [1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')],
  ]));
  const counterBytes = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
  return {
    credentialId: b64u(credentialId),
    register(options: { challenge: string }, origin = ORIGIN, rpID = HOST) {
      const clientData = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge: options.challenge, origin, crossOrigin: false }));
      const credLen = Buffer.alloc(2); credLen.writeUInt16BE(credentialId.length);
      const authData = Buffer.concat([sha256(rpID), Buffer.from([0x45]), counterBytes(0), Buffer.alloc(16), credLen, credentialId, cose]);
      const attestationObject = cbor(new Map<string, unknown>([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]));
      return {
        id: b64u(credentialId), rawId: b64u(credentialId), type: 'public-key', clientExtensionResults: {},
        authenticatorAttachment: 'platform',
        response: { clientDataJSON: b64u(clientData), attestationObject: b64u(attestationObject), transports: ['internal'] },
      };
    },
    assert(options: { challenge: string }, userId: string, origin = ORIGIN, rpID = HOST, counter = 0) {
      const clientData = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: options.challenge, origin, crossOrigin: false }));
      const authData = Buffer.concat([sha256(rpID), Buffer.from([0x05]), counterBytes(counter)]);
      const signature = cryptoSign('sha256', Buffer.concat([authData, sha256(clientData)]), createPrivateKey(privateKey.export({ format: 'pem', type: 'pkcs8' })));
      return {
        id: b64u(credentialId), rawId: b64u(credentialId), type: 'public-key', clientExtensionResults: {},
        authenticatorAttachment: 'platform',
        response: {
          authenticatorData: b64u(authData), clientDataJSON: b64u(clientData), signature: b64u(signature),
          userHandle: b64u(Buffer.from(userId)),
        },
      };
    },
  };
}

async function call(method: string, path: string, body?: unknown, token?: string, host = HOST) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-host': host,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as Record<string, any>) : {} };
}

before(async () => {
  process.env.VERCEL = '1';
  process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
  process.env.AUTH_SESSION_SECRET = 'test-session-secret-with-more-than-32-chars';
  Pool.prototype.query = (async function (sql: string, params: unknown[] = []) {
    if (/INSERT INTO public\.app_users/.test(sql)) {
      const [id, email, password_hash, display_name] = params as string[];
      const row = { id, email, password_hash, display_name, email_verified: false, token_version: 0 };
      users.set(email, row);
      return { rows: [row], rowCount: 1 };
    }
    if (/FROM public\.app_users WHERE id/.test(sql)) {
      const row = [...users.values()].find((u) => u.id === params[0]);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (/INSERT INTO public\.app_user_passkeys/.test(sql)) {
      const [id, user_id, public_key, counter, transports, rp_id, device_label] = params as any[];
      if (passkeys.has(id)) return { rows: [], rowCount: 0 };
      passkeys.set(id, { id, user_id, public_key, counter: Number(counter), transports, rp_id, device_label, created_at: new Date(), last_used_at: null });
      return { rows: [{ id }], rowCount: 1 };
    }
    if (/FROM public\.app_user_passkeys p\s+JOIN public\.app_users u/.test(sql)) {
      const p = passkeys.get(params[0] as string);
      const u = p && [...users.values()].find((x) => x.id === p.user_id);
      return { rows: p && u ? [{ ...p, uid: u.id, email: u.email, display_name: u.display_name, email_verified: u.email_verified, token_version: u.token_version }] : [], rowCount: p && u ? 1 : 0 };
    }
    if (/UPDATE public\.app_user_passkeys SET counter/.test(sql)) {
      const p = passkeys.get(params[0] as string);
      if (p) { p.counter = Number(params[1]); p.last_used_at = new Date(); }
      return { rows: [], rowCount: p ? 1 : 0 };
    }
    if (/DELETE FROM public\.app_user_passkeys/.test(sql)) {
      const p = passkeys.get(params[0] as string);
      if (p && p.user_id === params[1]) passkeys.delete(p.id);
      return { rows: [], rowCount: p ? 1 : 0 };
    }
    if (/FROM public\.app_user_passkeys WHERE user_id/.test(sql)) {
      const rows = [...passkeys.values()].filter((p) => p.user_id === params[0]);
      return { rows, rowCount: rows.length };
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
  for (const [key, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function createUserWithPasskey(email: string) {
  const reg = await call('POST', '/api/auth/register', { name: 'Teste', email, password: 'senha-forte-123' });
  assert.equal(reg.status, 201);
  const token = reg.body.token as string;
  const uid = reg.body.user.uid as string;
  const auth = createAuthenticator();
  const opts = await call('POST', '/api/auth/passkeys/register/options', {}, token);
  assert.equal(opts.status, 200);
  const done = await call('POST', '/api/auth/passkeys/register/verify', {
    response: auth.register(opts.body.options), challengeToken: opts.body.challengeToken, label: 'iPhone do teste',
  }, token);
  assert.equal(done.status, 201, JSON.stringify(done.body));
  return { token, uid, auth };
}

test('resolveRelyingParty usa o domínio do pedido e ignora hosts inválidos', () => {
  assert.deepEqual(resolveRelyingParty({ headers: { host: 'meu.app' } }), { rpID: 'meu.app', origin: 'https://meu.app' });
  assert.deepEqual(resolveRelyingParty({ headers: { 'x-forwarded-host': 'a.app, b.app', host: 'x' } }), { rpID: 'a.app', origin: 'https://a.app' });
  assert.deepEqual(resolveRelyingParty({ headers: { host: 'localhost:3000' } }), { rpID: 'localhost', origin: 'http://localhost:3000' });
  assert.equal(resolveRelyingParty({ headers: { host: 'evil host/../' } }), null);
  assert.equal(resolveRelyingParty({ headers: {} }), null);
});

test('cadastrar e entrar com Face ID devolve uma sessão válida da mesma conta', async () => {
  const { uid, auth } = await createUserWithPasskey('face@exemplo.com');
  const opts = await call('POST', '/api/auth/passkeys/login/options');
  assert.equal(opts.status, 200);
  const login = await call('POST', '/api/auth/passkeys/login/verify', {
    response: auth.assert(opts.body.options, uid), challengeToken: opts.body.challengeToken,
  });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.equal(login.body.user.uid, uid);
  const me = await call('GET', '/api/auth/me', undefined, login.body.token);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'face@exemplo.com');
});

test('cadastrar Face ID exige estar logado', async () => {
  const response = await call('POST', '/api/auth/passkeys/register/options', {});
  assert.equal(response.status, 401);
});

test('assinatura adulterada, desafio errado e desafio de outro site são recusados', async () => {
  const { uid, auth } = await createUserWithPasskey('seguro@exemplo.com');
  const opts = await call('POST', '/api/auth/passkeys/login/options');
  const good = auth.assert(opts.body.options, uid);

  const tampered = structuredClone(good);
  const sig = Buffer.from(tampered.response.signature, 'base64url');
  sig[sig.length - 1] ^= 0xff;
  tampered.response.signature = sig.toString('base64url');
  const bad = await call('POST', '/api/auth/passkeys/login/verify', { response: tampered, challengeToken: opts.body.challengeToken });
  assert.equal(bad.status, 401);

  const other = await call('POST', '/api/auth/passkeys/login/options');
  const wrongChallenge = await call('POST', '/api/auth/passkeys/login/verify', {
    response: good, challengeToken: other.body.challengeToken,
  });
  assert.equal(wrongChallenge.status, 401);

  const otherSite = await call('POST', '/api/auth/passkeys/login/verify', {
    response: good, challengeToken: opts.body.challengeToken,
  }, undefined, 'outro.site');
  assert.equal(otherSite.status, 401);

  const fakeToken = await call('POST', '/api/auth/passkeys/login/verify', { response: good, challengeToken: 'abc.def.ghi' });
  assert.equal(fakeToken.status, 401);
});

test('um token de sessão não vale como desafio e credencial desconhecida é recusada', async () => {
  const { token, uid } = await createUserWithPasskey('troca@exemplo.com');
  const opts = await call('POST', '/api/auth/passkeys/login/options');
  const stranger = createAuthenticator();
  const unknown = await call('POST', '/api/auth/passkeys/login/verify', {
    response: stranger.assert(opts.body.options, uid), challengeToken: opts.body.challengeToken,
  });
  assert.equal(unknown.status, 401);
  const withSession = await call('POST', '/api/auth/passkeys/login/verify', {
    response: stranger.assert(opts.body.options, uid), challengeToken: token,
  });
  assert.equal(withSession.status, 401);
});

test('listar e remover Face ID; depois de removido não entra mais', async () => {
  const { token, uid, auth } = await createUserWithPasskey('lista@exemplo.com');
  const list = await call('GET', '/api/auth/passkeys', undefined, token);
  assert.equal(list.status, 200);
  assert.equal(list.body.passkeys.length, 1);
  assert.equal(list.body.passkeys[0].label, 'iPhone do teste');
  assert.equal(list.body.passkeys[0].id, auth.credentialId);

  const removed = await call('DELETE', `/api/auth/passkeys/${auth.credentialId}`, undefined, token);
  assert.equal(removed.status, 204);
  const opts = await call('POST', '/api/auth/passkeys/login/options');
  const login = await call('POST', '/api/auth/passkeys/login/verify', {
    response: auth.assert(opts.body.options, uid), challengeToken: opts.body.challengeToken,
  });
  assert.equal(login.status, 401);
});
