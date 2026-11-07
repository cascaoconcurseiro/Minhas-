import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import {
  createFirebaseIdTokenVerifier,
  FirebaseTokenVerificationError,
} from './firebaseToken.ts';

const projectId = 'firebase-test-project';
const nowMs = Date.parse('2026-11-07T14:00:00.000Z');
const nowSeconds = Math.floor(nowMs / 1000);
const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKey = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function tokenWith(claimOverrides: Record<string, unknown> = {}, options: {
  kid?: string;
  alg?: string;
  privateKey?: typeof keyPair.privateKey;
} = {}) {
  const header = encode({ alg: options.alg ?? 'RS256', kid: options.kid ?? 'test-key', typ: 'JWT' });
  const claims = encode({
    aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`,
    sub: 'uid-123',
    user_id: 'uid-123',
    email: 'owner@example.com',
    email_verified: true,
    iat: nowSeconds - 60,
    exp: nowSeconds + 3600,
    auth_time: nowSeconds - 120,
    ...claimOverrides,
  });
  const signedContent = `${header}.${claims}`;
  const signature = sign('RSA-SHA256', Buffer.from(signedContent), options.privateKey ?? keyPair.privateKey);
  return `${signedContent}.${signature.toString('base64url')}`;
}

function certificateResponse(keys: Record<string, string> = { 'test-key': publicKey }, maxAge = 300) {
  return new Response(JSON.stringify(keys), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${maxAge}` },
  });
}

function isAuthError(error: unknown, status: 401 | 503) {
  return error instanceof FirebaseTokenVerificationError && error.status === status;
}

test('verifies Firebase ID token signature and caches Google public certificates', async () => {
  let fetches = 0;
  const verify = createFirebaseIdTokenVerifier({
    now: () => nowMs,
    apiKey: null,
    fetchImpl: async (input) => {
      assert.equal(String(input), 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
      fetches += 1;
      return certificateResponse();
    },
  });

  const identity = await verify(tokenWith(), projectId);
  assert.deepEqual(identity, { uid: 'uid-123', email: 'owner@example.com', email_verified: true });
  await verify(tokenWith({ email: 'other@example.com' }), projectId);
  assert.equal(fetches, 1, 'a fresh certificate set should be reused');
});

test('rejects bad signatures locally without contacting Identity Toolkit', async () => {
  let certificateCalls = 0;
  const verify = createFirebaseIdTokenVerifier({
    now: () => nowMs,
    apiKey: null,
    fetchImpl: async (input) => {
      assert.equal(String(input), 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
      certificateCalls += 1;
      return certificateResponse();
    },
  });
  const forged = tokenWith({}, { privateKey: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey });
  await assert.rejects(verify(forged, projectId), (error) => isAuthError(error, 401));
  assert.equal(certificateCalls, 1, 'only public certificate metadata may be fetched for an invalid signature');
});

test('rejects wrong algorithm, malformed segments, unknown keys, and invalid claims', async () => {
  let fetches = 0;
  const verify = createFirebaseIdTokenVerifier({
    now: () => nowMs,
    apiKey: null,
    fetchImpl: async () => {
      fetches += 1;
      return certificateResponse();
    },
  });
  await assert.rejects(verify(tokenWith({}, { alg: 'none' }), projectId), (error) => isAuthError(error, 401));
  await assert.rejects(verify('not-a-jwt', projectId), (error) => isAuthError(error, 401));
  await assert.rejects(verify('x'.repeat(16_385), projectId), (error) => isAuthError(error, 401));
  await assert.rejects(verify(tokenWith({}, { kid: 'missing-key' }), projectId), (error) => isAuthError(error, 401));

  const invalidClaims = [
    { exp: nowSeconds - 1 },
    { aud: 'other-project' },
    { iss: 'https://securetoken.google.com/other-project' },
    { iat: nowSeconds + 600 },
    { iat: nowSeconds - 59.5 },
    { exp: nowSeconds - 30 },
    { auth_time: nowSeconds + 600 },
    { auth_time: nowSeconds },
    { user_id: 'different-uid' },
    { sub: '' },
    { sub: 'x'.repeat(129) },
    { email: '' },
    { email: `${'a'.repeat(321)}@example.com` },
    { email_verified: 'true' },
  ];
  for (const claims of invalidClaims) {
    await assert.rejects(verify(tokenWith(claims), projectId), (error) => isAuthError(error, 401), JSON.stringify(claims));
  }
  assert.equal(fetches, 1, 'the unknown kid should cause only one cached certificate fetch');
});

test('limits early refreshes for unknown kids and coalesces concurrent rotation checks', async () => {
  let fetches = 0;
  const verify = createFirebaseIdTokenVerifier({
    now: () => nowMs,
    apiKey: null,
    fetchImpl: async () => {
      fetches += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return certificateResponse();
    },
  });
  await verify(tokenWith(), projectId);
  await Promise.allSettled(Array.from({ length: 8 }, () => verify(tokenWith({}, { kid: 'attacker-kid' }), projectId)));
  await assert.rejects(verify(tokenWith({}, { kid: 'attacker-kid' }), projectId), (error) => isAuthError(error, 401));
  assert.equal(fetches, 2, 'concurrent unknown kids must share one early refresh, then be rejected without another fetch');
});

test('refreshes Google certificates early and accepts a token signed by the newly rotated key', async () => {
  const rotatedPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rotatedPublicKey = rotatedPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  let fetches = 0;
  const verify = createFirebaseIdTokenVerifier({
    now: () => nowMs,
    apiKey: null,
    fetchImpl: async () => {
      fetches += 1;
      return fetches === 1
        ? certificateResponse({ 'test-key': publicKey })
        : certificateResponse({ 'test-key': publicKey, 'rotated-key': rotatedPublicKey });
    },
  });

  await verify(tokenWith(), projectId);
  const identity = await verify(
    tokenWith({}, { kid: 'rotated-key', privateKey: rotatedPair.privateKey }),
    projectId
  );

  assert.deepEqual(identity, { uid: 'uid-123', email: 'owner@example.com', email_verified: true });
  assert.equal(fetches, 2, 'an unknown key id should trigger one successful early refresh');
});

test('fails closed with 503 when Google certificates cannot be fetched or validated', async () => {
  const unavailable = createFirebaseIdTokenVerifier({
    now: () => nowMs,
    apiKey: null,
    fetchImpl: async () => { throw new Error('network offline'); },
  });
  await assert.rejects(unavailable(tokenWith(), projectId), (error) => isAuthError(error, 503));

  const malformedKeys = createFirebaseIdTokenVerifier({
    now: () => nowMs,
    apiKey: null,
    fetchImpl: async () => certificateResponse({ 'bad-key': 'not a PEM public key' }),
  });
  await assert.rejects(malformedKeys(tokenWith(), projectId), (error) => isAuthError(error, 503));
});

test('refreshes an expired key cache and does not accept stale keys when refresh fails', async () => {
  let clock = nowMs;
  let fetches = 0;
  const verify = createFirebaseIdTokenVerifier({
    now: () => clock,
    apiKey: null,
    fetchImpl: async () => {
      fetches += 1;
      if (fetches > 1) throw new Error('offline after cache expiry');
      return certificateResponse({ 'test-key': publicKey }, 1);
    },
  });
  await verify(tokenWith(), projectId);
  clock += 2000;
  await assert.rejects(verify(tokenWith(), projectId), (error) => isAuthError(error, 503));
  assert.equal(fetches, 2);
});

test('fails closed with 503 when Firebase is configured but FIREBASE_API_KEY is missing', async () => {
  const previousApiKey = process.env.FIREBASE_API_KEY;
  delete process.env.FIREBASE_API_KEY;
  try {
    let certificateFetches = 0;
    const verify = createFirebaseIdTokenVerifier({
      now: () => nowMs,
      fetchImpl: async (input) => {
        assert.equal(String(input), 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
        certificateFetches += 1;
        return certificateResponse();
      },
    });

    await assert.rejects(verify(tokenWith(), projectId), (error) => isAuthError(error, 503));
    assert.equal(certificateFetches, 1, 'the token signature is verified before failing the missing state-check configuration');
  } finally {
    if (previousApiKey === undefined) delete process.env.FIREBASE_API_KEY;
    else process.env.FIREBASE_API_KEY = previousApiKey;
  }
});

test('rejects disabled or revoked accounts through Identity Toolkit without Admin credentials', async () => {
  let account: { localId: string; validSince: string; disabled: boolean } = {
    localId: 'uid-123',
    validSince: String(nowSeconds - 300),
    disabled: false,
  };
  const calls: string[] = [];
  const verify = createFirebaseIdTokenVerifier({
    now: () => nowMs,
    apiKey: 'test-web-api-key',
    fetchImpl: async (input, init) => {
      const url = String(input);
      calls.push(url);
      if (url === 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com') {
        return certificateResponse();
      }
      assert.equal(url, 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=test-web-api-key');
      assert.equal(init?.method, 'POST');
      assert.equal(init?.headers && (init.headers as Record<string, string>)['Content-Type'], 'application/json');
      assert.deepEqual(JSON.parse(String(init?.body)), { idToken: tokenWith() });
      return new Response(JSON.stringify({ users: [account] }), { status: 200 });
    },
  });

  await verify(tokenWith(), projectId);
  account = { ...account, disabled: true };
  await assert.rejects(verify(tokenWith(), projectId), (error) => isAuthError(error, 401));
  account = { ...account, disabled: false, validSince: String(nowSeconds - 60) };
  await assert.rejects(verify(tokenWith(), projectId), (error) => isAuthError(error, 401));
  account = { ...account, validSince: String(nowSeconds - 300), localId: 'different-uid' };
  await assert.rejects(verify(tokenWith(), projectId), (error) => isAuthError(error, 401));
  assert.equal(calls.filter((url) => url.startsWith('https://identitytoolkit.googleapis.com/')).length, 4);
});

test('fails closed when the account-state endpoint is unavailable or malformed', async () => {
  const unavailable = createFirebaseIdTokenVerifier({
    now: () => nowMs,
    apiKey: 'test-web-api-key',
    fetchImpl: async (input) => String(input).startsWith('https://identitytoolkit.googleapis.com/')
      ? new Response('{}', { status: 503 })
      : certificateResponse(),
  });
  await assert.rejects(unavailable(tokenWith(), projectId), (error) => isAuthError(error, 503));

  const malformed = createFirebaseIdTokenVerifier({
    now: () => nowMs,
    apiKey: 'test-web-api-key',
    fetchImpl: async (input) => String(input).startsWith('https://identitytoolkit.googleapis.com/')
      ? new Response(JSON.stringify({ users: [{ localId: 'uid-123', disabled: false }] }), { status: 200 })
      : certificateResponse(),
  });
  await assert.rejects(malformed(tokenWith(), projectId), (error) => isAuthError(error, 503));
});

test('maps only known account credential errors to 401 and treats API configuration errors as 503', async () => {
  for (const fixture of [
    { httpStatus: 400, message: 'INVALID_ID_TOKEN', expected: 401 },
    { httpStatus: 400, message: 'USER_DISABLED', expected: 401 },
    { httpStatus: 400, message: 'USER_NOT_FOUND', expected: 401 },
    { httpStatus: 400, message: 'API key not valid. Please pass a valid API key.', expected: 503 },
    { httpStatus: 403, message: 'PROJECT_NUMBER_MISMATCH', expected: 503 },
    { httpStatus: 401, message: 'UNKNOWN_UPSTREAM_ERROR', expected: 503 },
  ] as const) {
    const verify = createFirebaseIdTokenVerifier({
      now: () => nowMs,
      apiKey: 'test-web-api-key',
      fetchImpl: async (input) => String(input).startsWith('https://identitytoolkit.googleapis.com/')
        ? new Response(JSON.stringify({ error: { message: fixture.message } }), { status: fixture.httpStatus })
        : certificateResponse(),
    });
    await assert.rejects(verify(tokenWith(), projectId), (error) => isAuthError(error, fixture.expected), fixture.message);
  }
});
