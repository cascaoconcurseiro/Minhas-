import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('App auth-to-Neon orchestration and load retry run in an isolated Bun process', () => {
  const harnessPath = fileURLToPath(new URL('./test-utils/appOrchestrationHarness.tsx', import.meta.url));
  const result = spawnSync(process.execPath, ['run', harnessPath], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8',
    timeout: 15_000,
  });

  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join('\n') || 'isolated App harness failed'
  );
  assert.match(result.stdout, /2 pass/);
});
