import assert from 'node:assert/strict';
import test from 'node:test';
import { getVaultIdForUid } from './workspaceIdentity';

test('workspace identity depends on stable User UID, not mutable email', () => {
  const userId = 'firebase-user-12345678901234567890';
  assert.equal(getVaultIdForUid(userId), getVaultIdForUid(userId));
  assert.equal(getVaultIdForUid(userId), `vault_uid_${userId}`);
});

test('different User UIDs remain isolated in Neon', () => {
  assert.notEqual(getVaultIdForUid('neon-auth-id-one'), getVaultIdForUid('neon-auth-id-two'));
});

test('User UID identity supports the documented maximum UID length', () => {
  const vaultId = getVaultIdForUid('u'.repeat(128));
  assert.equal(vaultId.length, 138);
});

test('empty User UID cannot produce an authenticated workspace identity', () => {
  assert.throws(() => getVaultIdForUid('  '), /UID do usuário obrigatório/);
});
