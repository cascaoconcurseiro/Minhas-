import assert from 'node:assert/strict';
import test from 'node:test';
import { isRetryableWorkspaceSaveError } from './workspaceSyncRecovery';

test('retries network failures and transient HTTP responses', () => {
  assert.equal(isRetryableWorkspaceSaveError(new TypeError('fetch failed')), true);
  for (const status of [408, 429, 500, 503]) {
    assert.equal(isRetryableWorkspaceSaveError({ status }), true);
  }
});

test('does not retry authentication, validation, revision conflicts, or invalid statuses', () => {
  for (const status of [400, 401, 403, 404, 409, 422, 600]) {
    assert.equal(isRetryableWorkspaceSaveError({ status }), false);
  }
  assert.equal(isRetryableWorkspaceSaveError(new Error('unknown failure')), false);
});
