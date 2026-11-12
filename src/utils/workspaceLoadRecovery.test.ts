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

test('the local copy is read-only until Neon loads: it is shown instantly but never written or saved before the cloud snapshot', () => {
  const saveEffectStart = appSource.indexOf('// Guarda a última versão neste aparelho');
  const saveEffectEnd = appSource.indexOf('const handleForceCloudSync', saveEffectStart);
  assert.notEqual(saveEffectStart, -1, 'expected the cache and Neon save effect');
  assert.notEqual(saveEffectEnd, -1, 'expected the end of the save effect');

  const saveEffect = appSource.slice(saveEffectStart, saveEffectEnd);
  assert.match(
    saveEffect,
    /if \(hasLoadedRemoteOnceRef\.current\)\s*\{[\s\S]*?localStorage\.setItem\(/,
    'the local copy is only written after the cloud snapshot has loaded'
  );
  assert.match(
    saveEffect,
    /isAuthReady &&\s*hasLoadedRemoteOnceRef\.current &&\s*!isApplyingRemoteSnapshotRef\.current/,
    'saving to Neon only starts after the cloud snapshot has loaded'
  );
  assert.match(appSource, /parseCachedWorkspace\(localStorage\.getItem\(scopedStorageKey\)\)/, 'the saved copy opens the app instantly');
  assert.doesNotMatch(appSource, /Conectando ao Neon/, 'no technical loading message is shown');
});
