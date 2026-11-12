import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const makeToken = () =>
  `${b64({ alg: 'HS256' })}.${b64({ sub: 'u1', email: 'a@b.com', name: 'A', email_verified: true, exp: Math.floor(Date.now() / 1000) + 3600 })}.x`;

const originalFetch = globalThis.fetch;
const KEY = 'minhas_economias_auth_token_v1';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ token: makeToken(), user: { uid: 'u1', email: 'a@b.com', displayName: 'A', emailVerified: true } }), { status: 200 })) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  localStorage.clear();
  sessionStorage.clear();
});

test('manter conectado (padrão) guarda o login no aparelho', async () => {
  const client = await import('./authClient');
  assert.equal(client.getKeepSignedIn(), true);
  await client.signInWithEmail('a@b.com', 'senha-forte-123');
  assert.ok(localStorage.getItem(KEY), 'token no armazenamento permanente');
  assert.equal(sessionStorage.getItem(KEY), null);
});

test('sem manter conectado o login fica só nesta sessão', async () => {
  const client = await import('./authClient');
  client.setKeepSignedIn(false);
  assert.equal(client.getKeepSignedIn(), false);
  await client.signInWithEmail('a@b.com', 'senha-forte-123');
  assert.equal(localStorage.getItem(KEY), null);
  assert.ok(sessionStorage.getItem(KEY), 'token só na sessão');
  client.setKeepSignedIn(true);
});

test('sair apaga o login dos dois lugares e lembra o e-mail', async () => {
  const client = await import('./authClient');
  client.setKeepSignedIn(true);
  await client.signInWithEmail('a@b.com', 'senha-forte-123');
  client.rememberEmail('  A@B.com ');
  await client.signOutUser();
  assert.equal(localStorage.getItem(KEY), null);
  assert.equal(sessionStorage.getItem(KEY), null);
  assert.equal(client.getRememberedEmail(), 'a@b.com');
  client.forgetRememberedEmail();
  assert.equal(client.getRememberedEmail(), '');
});
