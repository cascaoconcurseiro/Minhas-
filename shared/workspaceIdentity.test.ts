import assert from 'node:assert/strict';
import test from 'node:test';
import { getLegacyVaultIdForEmail, getVaultIdForUid } from './workspaceIdentity';

test('workspace identity stays stable across email changes for the same Firebase UID', () => {
  const firebaseUid = 'firebase-user-12345678901234567890';
  const firstEmail = 'person@example.com';
  const changedEmail = 'new-address@example.net';

  assert.equal(getVaultIdForUid(firebaseUid), getVaultIdForUid(firebaseUid));
  assert.notEqual(
    getLegacyVaultIdForEmail(firstEmail),
    getLegacyVaultIdForEmail(changedEmail)
  );
  assert.equal(getVaultIdForUid(firebaseUid), `vault_uid_${firebaseUid}`);
});

test('different Firebase UIDs remain isolated even when legacy email IDs collide', () => {
  assert.equal(
    getLegacyVaultIdForEmail('a.b@example.com'),
    getLegacyVaultIdForEmail('a_b@example.com')
  );
  assert.notEqual(getVaultIdForUid('firebase-uid-one'), getVaultIdForUid('firebase-uid-two'));
});

test('Firebase UID identity supports the documented maximum UID length', () => {
  const vaultId = getVaultIdForUid('u'.repeat(128));
  assert.equal(vaultId.length, 138);
});

test('empty Firebase UID cannot produce an authenticated workspace identity', () => {
  assert.throws(() => getVaultIdForUid('  '), /UID Firebase obrigatório/);
});
