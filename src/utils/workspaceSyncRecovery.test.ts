import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkspaceConflictState } from '../components/WorkspaceConflictModal';
import {
  isRetryableWorkspaceSaveError,
  updateWorkspaceConflictLocalPayload,
} from './workspaceSyncRecovery';

test('retries network failures and transient HTTP responses', () => {
  assert.equal(isRetryableWorkspaceSaveError(new TypeError('fetch failed')), true);
  for (const status of [408, 429, 500, 503]) {
    assert.equal(isRetryableWorkspaceSaveError({ status }), true);
  }
});

test('updates the preserved local version when edits continue during a conflict', () => {
  const initial = {
    localPayload: { transactionsJson: '[{"id":"old"}]' },
    remoteSnapshot: {
      revision: 4,
      payload: { transactionsJson: '[{"id":"remote"}]' },
    },
  } as unknown as WorkspaceConflictState;
  const nextPayload = { transactionsJson: '[{"id":"old"},{"id":"new"}]' };

  const updated = updateWorkspaceConflictLocalPayload(initial, nextPayload);

  assert.equal(updated.localPayload, nextPayload);
  assert.equal(updated.remoteSnapshot, initial.remoteSnapshot);
  assert.equal(initial.localPayload.transactionsJson, '[{"id":"old"}]');
});

test('does not retry authentication, validation, revision conflicts, or invalid statuses', () => {
  for (const status of [400, 401, 403, 404, 409, 422, 600]) {
    assert.equal(isRetryableWorkspaceSaveError({ status }), false);
  }
  assert.equal(isRetryableWorkspaceSaveError(new Error('unknown failure')), false);
});

test('assinatura do conteúdo ignora datas e muda com os dados', async () => {
  const { workspaceContentSignature } = await import('./workspaceSyncRecovery');
  const a = { tripsJson: '[]', updatedAt: '2026-11-13T10:00:00Z' };
  const b = { tripsJson: '[]', updatedAt: '2026-11-13T11:00:00Z' };
  const c = { tripsJson: '[{"id":"t"}]', updatedAt: '2026-11-13T10:00:00Z' };
  assert.equal(workspaceContentSignature(a), workspaceContentSignature(b));
  assert.notEqual(workspaceContentSignature(a), workspaceContentSignature(c));
});
