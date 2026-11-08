import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  clearWorkspaceCacheForVault,
  isWorkspaceLoadedForUser,
  shouldResetWorkspaceForAuthChange,
} from './workspaceSession';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('resets in-memory workspace at sign-out and when User changes account UID', () => {
  assert.equal(shouldResetWorkspaceForAuthChange('uid-a', null), true);
  assert.equal(shouldResetWorkspaceForAuthChange('uid-a', 'uid-b'), true);
  assert.equal(shouldResetWorkspaceForAuthChange(null, 'uid-a'), true);
  assert.equal(shouldResetWorkspaceForAuthChange('uid-a', 'uid-a'), false);

  assert.match(appSource, /if \(shouldResetWorkspaceForAuthChange\(previousUid, nextUid\)\)\s*\{[\s\S]*?resetFinancialStateToCleanZero\(\);[\s\S]*?setSettings\(DEFAULT_SETTINGS\)/);
});

test('a loaded workspace is not considered ready for another User UID', () => {
  assert.equal(isWorkspaceLoadedForUser('uid-a', 'uid-a'), true);
  assert.equal(isWorkspaceLoadedForUser('uid-a', 'uid-b'), false);
  assert.equal(isWorkspaceLoadedForUser('uid-a', null), false);

  assert.match(appSource, /isWorkspaceReadyForCurrentUser\s*=\s*workspaceLoadState === 'ready'[\s\S]*?isWorkspaceLoadedForUser\(loadedWorkspaceUidRef\.current, currentUser\?\.uid \?\? null\)/);
  assert.match(appSource, /isAuthReady && isUserAuthenticated && effectiveUserEmail && !isWorkspaceReadyForCurrentUser/);
  assert.match(appSource, /inert=\{Boolean\([\s\S]*?!isWorkspaceReadyForCurrentUser/);
});

test('daily reminder effects wait until the matching user workspace is hydrated', () => {
  assert.match(appSource, /const checkDailySchedule = \(\) => \{\s*if \(!isWorkspaceLoadedForUser\(loadedWorkspaceUidRef\.current, currentUser\?\.uid \?\? null\)\) return;/);
});

test('clears only the prior account local cache at an authentication boundary', () => {
  const values = new Map([
    ['finance_uid-a', 'private data A'],
    ['finance_uid-b', 'private data B'],
  ]);
  clearWorkspaceCacheForVault({removeItem: (key) => values.delete(key)}, 'finance', 'uid-a');
  assert.equal(values.has('finance_uid-a'), false);
  assert.equal(values.get('finance_uid-b'), 'private data B');
  assert.match(appSource, /if \(previousUid\)\s*\{\s*clearWorkspaceCacheForVault\(localStorage, STORAGE_KEY, getVaultIdForUid\(previousUid\)\)/);
});
