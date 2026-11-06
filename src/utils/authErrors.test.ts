import assert from 'node:assert/strict';
import test from 'node:test';
import { getAuthErrorMessage } from './authErrors';

test('explains when email/password authentication is disabled', () => {
  assert.match(getAuthErrorMessage({ code: 'EMAIL_PASSWORD_DISABLED' }), /desativado no Neon Auth/);
});

test('explains an unauthorized application domain', () => {
  assert.match(getAuthErrorMessage({ code: 'ORIGIN_NOT_ALLOWED' }), /Neon Auth/);
});

test('keeps account-existence and invalid-credential errors indistinguishable', () => {
  const alreadyInUse = getAuthErrorMessage({ code: 'USER_ALREADY_EXISTS' });
  const invalidCredential = getAuthErrorMessage({ code: 'INVALID_CREDENTIALS' });
  assert.equal(alreadyInUse, invalidCredential);
});

test('returns a safe fallback for unknown values', () => {
  assert.equal(
    getAuthErrorMessage(new Error('private detail')),
    'Não foi possível autenticar. Verifique suas credenciais ou tente novamente.'
  );
  assert.match(getAuthErrorMessage(null), /Não foi possível autenticar/);
});
