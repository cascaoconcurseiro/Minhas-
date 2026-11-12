import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('blocks workspace use and offers a retry until Neon has loaded successfully', () => {
  assert.match(appSource, /!isWorkspaceReadyForCurrentUser/);
  assert.match(appSource, /role="alertdialog"[\s\S]*aria-modal="true"/);
  assert.match(appSource, /isAuthReady && isUserAuthenticated && effectiveUserEmail && !isWorkspaceReadyForCurrentUser/);
  assert.match(appSource, /inert=\{Boolean\([\s\S]*?!isWorkspaceReadyForCurrentUser/);
  assert.match(appSource, /setWorkspaceLoadState\('error'\)/);
  assert.match(appSource, /Tentar novamente/);
  assert.match(appSource, /window\.addEventListener\('online', retryWhenOnline\)/);
});

test('Neon is the only data source: no local financial copy is written and old copies are purged', () => {
  const saveEffectStart = appSource.indexOf('// Persiste o workspace autenticado no Neon');
  const saveEffectEnd = appSource.indexOf('const handleForceCloudSync', saveEffectStart);
  assert.notEqual(saveEffectStart, -1, 'expected the Neon save effect');
  assert.notEqual(saveEffectEnd, -1, 'expected the end of the Neon save effect');

  const saveEffect = appSource.slice(saveEffectStart, saveEffectEnd);
  assert.doesNotMatch(saveEffect, /localStorage\.setItem\(/, 'no financial copy is stored in the browser');
  assert.match(
    saveEffect,
    /isAuthReady &&\s*hasLoadedRemoteOnceRef\.current &&\s*!isApplyingRemoteSnapshotRef\.current/,
    'saving to Neon only starts after the cloud snapshot has loaded'
  );
  assert.match(appSource, /for \(const key of cacheKeys\) localStorage\.removeItem\(key\)/, 'old local copies are removed');
});
