import assert from 'node:assert/strict';
import test from 'node:test';
import { getFirebaseAuthErrorMessage } from './firebaseAuthErrors';

test('explains when email/password authentication is disabled', () => {
  assert.match(
    getFirebaseAuthErrorMessage({ code: 'auth/operation-not-allowed' }),
    /Habilite E-mail\/senha/
  );
});

test('explains an unauthorized application domain', () => {
  assert.match(
    getFirebaseAuthErrorMessage({ code: 'auth/unauthorized-domain' }),
    /não está autorizado/
  );
});

test('keeps account-existence and invalid-credential errors indistinguishable', () => {
  const alreadyInUse = getFirebaseAuthErrorMessage({ code: 'auth/email-already-in-use' });
  const invalidCredential = getFirebaseAuthErrorMessage({ code: 'auth/invalid-credential' });
  assert.equal(alreadyInUse, invalidCredential);
  assert.doesNotMatch(alreadyInUse, /já existe/i);
});

test('returns a safe fallback for unknown values', () => {
  assert.equal(
    getFirebaseAuthErrorMessage(new Error('private detail')),
    'Não foi possível autenticar. Verifique suas credenciais ou tente novamente.'
  );
  assert.match(getFirebaseAuthErrorMessage(null), /Não foi possível autenticar/);
});
