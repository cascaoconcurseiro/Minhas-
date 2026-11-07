import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBackendHealth } from './backendHealth';

describe('backend health summary', () => {
  it('reports ready only when HTTP and Neon are both healthy', () => {
    assert.deepEqual(
      summarizeBackendHealth(true, {
        status: 'ok',
        geminiConfigured: true,
        services: { neon: 'ok', firebaseAuthConfigured: true },
      }),
      { status: 'ok', neonStatus: 'ok', firebaseAuthConfigured: true, geminiConfigured: true }
    );
  });

  it('reports a failed Neon connection even if an older API says status ok', () => {
    assert.deepEqual(
      summarizeBackendHealth(true, {
        status: 'ok',
        services: { neon: 'error', firebaseAuthConfigured: true },
      }),
      { status: 'error', neonStatus: 'error', firebaseAuthConfigured: true, geminiConfigured: false }
    );
  });

  it('does not treat a missing Neon check as success', () => {
    assert.deepEqual(
      summarizeBackendHealth(true, { status: 'ok', services: {} }),
      { status: 'error', neonStatus: 'error', firebaseAuthConfigured: false, geminiConfigured: false }
    );
  });

  it('reports an unavailable API even if its payload claims Neon is healthy', () => {
    assert.deepEqual(
      summarizeBackendHealth(false, {
        status: 'ok',
        services: { neon: 'ok', firebaseAuthConfigured: true },
      }),
      { status: 'error', neonStatus: 'ok', firebaseAuthConfigured: true, geminiConfigured: false }
    );
  });

  it('reports an unavailable Firebase Auth configuration as unhealthy', () => {
    assert.deepEqual(
      summarizeBackendHealth(true, {
        status: 'degraded',
        services: { neon: 'ok', firebaseAuthConfigured: false },
      }),
      { status: 'error', neonStatus: 'ok', firebaseAuthConfigured: false, geminiConfigured: false }
    );
  });
});
