import assert from 'node:assert/strict';
import test from 'node:test';
import { getVaultIdForUid } from './workspaceIdentity';

test('workspace identity depends on stable Neon Auth user ID, not mutable email', () => {
  const firebaseUid = 'neon-auth-user-12345678901234567890';
  assert.equal(getVaultIdForUid(firebaseUid), getVaultIdForUid(firebaseUid));
  assert.equal(getVaultIdForUid(firebaseUid), `vault_uid_${firebaseUid}`);
});

test('different Neon Auth user IDs remain isolated in Neon', () => {
  assert.notEqual(getVaultIdForUid('neon-auth-id-one'), getVaultIdForUid('neon-auth-id-two'));
});

test('Neon Auth user ID identity supports the documented maximum UID length', () => {
  const vaultId = getVaultIdForUid('u'.repeat(128));
  assert.equal(vaultId.length, 138);
});

test('empty Neon Auth user ID cannot produce an authenticated workspace identity', () => {
  assert.throws(() => getVaultIdForUid('  '), /ID Neon Auth obrigatório/);
});
