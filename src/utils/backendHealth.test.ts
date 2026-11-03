import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBackendHealth } from './backendHealth';

describe('backend health summary', () => {
  it('reports ready only when HTTP and Neon are both healthy', () => {
    assert.deepEqual(
      summarizeBackendHealth(true, {
        status: 'ok',
        geminiConfigured: true,
        services: { neon: 'ok' },
      }),
      { status: 'ok', neonStatus: 'ok', geminiConfigured: true }
    );
  });

  it('reports a failed Neon connection even if an older API says status ok', () => {
    assert.deepEqual(
      summarizeBackendHealth(true, {
        status: 'ok',
        services: { neon: 'error' },
      }),
      { status: 'error', neonStatus: 'error', geminiConfigured: false }
    );
  });

  it('does not treat a missing Neon check as success', () => {
    assert.deepEqual(
      summarizeBackendHealth(true, { status: 'ok', services: {} }),
      { status: 'error', neonStatus: 'error', geminiConfigured: false }
    );
  });

  it('reports an unavailable API even if its payload claims Neon is healthy', () => {
    assert.deepEqual(
      summarizeBackendHealth(false, {
        status: 'ok',
        services: { neon: 'ok' },
      }),
      { status: 'error', neonStatus: 'ok', geminiConfigured: false }
    );
  });
});
