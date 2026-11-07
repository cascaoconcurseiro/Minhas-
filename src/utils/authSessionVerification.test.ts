import assert from 'node:assert/strict';
import test from 'node:test';
import {
  forceNeonAuthSessionFetchOptions,
  getVerifiedSessionCredentials,
  preserveConfirmedEmailVerification,
} from './authSessionVerification';

const freshSession = {
  data: {
    session: { token: 'fresh-jwt' },
    user: {
      id: 'user-123',
      email: 'person@example.com',
      name: 'Person',
      emailVerified: true,
    },
  },
  error: null,
};

test('returns a JWT only from a fresh session for the verified user', () => {
  assert.deepEqual(getVerifiedSessionCredentials(freshSession, 'user-123'), {
    user: freshSession.data.user,
    token: 'fresh-jwt',
  });
});

test('rejects a cached unverified session instead of returning its stale JWT', () => {
  assert.throws(
    () => getVerifiedSessionCredentials({
      data: {
        session: { token: 'stale-unverified-jwt' },
        user: { ...freshSession.data.user, emailVerified: false },
      },
    }, 'user-123'),
    /ainda não refletiu a confirmação/
  );
});

test('rejects a refreshed session belonging to a different identity', () => {
  assert.throws(
    () => getVerifiedSessionCredentials({
      data: {
        ...freshSession.data,
        user: { ...freshSession.data.user, id: 'other-user' },
      },
    }, 'user-123'),
    /ainda não refletiu a confirmação/
  );
});

test('force-refresh fetch options bypass the Neon Auth session cache', () => {
  assert.deepEqual(forceNeonAuthSessionFetchOptions(), {
    fetchOptions: { headers: { 'X-Force-Fetch': 'true' } },
  });
});

test('a stale React session cannot downgrade an OTP-confirmed email for the same UID', () => {
  assert.deepEqual(
    preserveConfirmedEmailVerification(
      { uid: 'user-123', emailVerified: false },
      'user-123'
    ),
    { uid: 'user-123', emailVerified: true }
  );
  assert.deepEqual(
    preserveConfirmedEmailVerification(
      { uid: 'other-user', emailVerified: false },
      'user-123'
    ),
    { uid: 'other-user', emailVerified: false }
  );
});
