import assert from 'node:assert/strict';
import test from 'node:test';
import { getVerifiedAuthUser } from './verifiedAuthUser';

test('uses the verified user returned by the OTP confirmation', () => {
  assert.deepEqual(
    getVerifiedAuthUser({
      status: true,
      token: 'token-is-not-used-as-user-data',
      user: {
        id: 'user-123',
        email: 'person@example.com',
        name: 'Person',
        emailVerified: true,
      },
    }),
    {
      id: 'user-123',
      email: 'person@example.com',
      name: 'Person',
      emailVerified: true,
    }
  );
});

test('rejects an OTP result that does not include a verified user', () => {
  assert.throws(
    () => getVerifiedAuthUser({ status: true, user: { emailVerified: false } }),
    /dados de usuário inválidos/
  );
});
