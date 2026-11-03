import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('blocks workspace use and offers a retry until Neon has loaded successfully', () => {
  assert.match(appSource, /workspaceLoadState !== 'ready'/);
  assert.match(appSource, /role="alertdialog"[\s\S]*aria-modal="true"/);
  assert.match(appSource, /isAuthReady && isUserAuthenticated && effectiveUserEmail && workspaceLoadState !== 'ready'/);
  assert.match(appSource, /className="contents"[\s\S]*?inert=\{Boolean\(/);
  assert.match(appSource, /setWorkspaceLoadState\('error'\)/);
  assert.match(appSource, /Tentar novamente/);
  assert.match(appSource, /window\.addEventListener\('online', retryWhenOnline\)/);
});

test('does not overwrite the local cache before a Neon workspace is loaded', () => {
  const cacheEffectStart = appSource.indexOf('// Save a local cache and persist the authenticated workspace in Neon.');
  const cacheEffectEnd = appSource.indexOf('const handleForceCloudSync', cacheEffectStart);
  assert.notEqual(cacheEffectStart, -1, 'expected the workspace cache effect');
  assert.notEqual(cacheEffectEnd, -1, 'expected the end of the workspace cache effect');

  const cacheEffect = appSource.slice(cacheEffectStart, cacheEffectEnd);
  assert.match(
    cacheEffect,
    /if \(hasLoadedRemoteOnceRef\.current\)\s*\{[\s\S]*?localStorage\.setItem\(/,
    'the existing local copy must remain untouched until the cloud snapshot loads'
  );
});
