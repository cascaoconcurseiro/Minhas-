import assert from 'node:assert/strict';
import test from 'node:test';
import { getVaultIdForUid } from './workspaceIdentity';

test('workspace identity depends on stable Firebase UID, not mutable email', () => {
  const firebaseUid = 'firebase-user-12345678901234567890';
  assert.equal(getVaultIdForUid(firebaseUid), getVaultIdForUid(firebaseUid));
  assert.equal(getVaultIdForUid(firebaseUid), `vault_uid_${firebaseUid}`);
});

test('different Firebase UIDs remain isolated in Neon', () => {
  assert.notEqual(getVaultIdForUid('firebase-uid-one'), getVaultIdForUid('firebase-uid-two'));
});

test('Firebase UID identity supports the documented maximum UID length', () => {
  const vaultId = getVaultIdForUid('u'.repeat(128));
  assert.equal(vaultId.length, 138);
});

test('empty Firebase UID cannot produce an authenticated workspace identity', () => {
  assert.throws(() => getVaultIdForUid('  '), /UID Firebase obrigatório/);
});
