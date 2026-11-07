import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBackendHealth } from './backendHealth';

describe('backend health summary', () => {
  it('reports API and required service configuration without claiming a live database check', () => {
    assert.deepEqual(
      summarizeBackendHealth(true, {
        status: 'ok',
        geminiConfigured: true,
        services: { neon: 'not_checked', neonConfigured: true, firebaseAuthConfigured: true },
      }),
      { status: 'ok', neonStatus: 'configured', firebaseAuthConfigured: true, geminiConfigured: true }
    );
  });

  it('does not infer live Neon availability from public configuration status', () => {
    assert.deepEqual(
      summarizeBackendHealth(true, {
        status: 'ok',
        services: { neon: 'error', neonConfigured: true, firebaseAuthConfigured: true },
      }),
      { status: 'ok', neonStatus: 'configured', firebaseAuthConfigured: true, geminiConfigured: false }
    );
  });

  it('does not treat a missing Neon configuration as success', () => {
    assert.deepEqual(
      summarizeBackendHealth(true, { status: 'ok', services: {} }),
      { status: 'error', neonStatus: 'error', firebaseAuthConfigured: false, geminiConfigured: false }
    );
  });

  it('reports an unavailable API even if its payload claims Neon is healthy', () => {
    assert.deepEqual(
      summarizeBackendHealth(false, {
        status: 'ok',
        services: { neon: 'not_checked', neonConfigured: true, firebaseAuthConfigured: true },
      }),
      { status: 'error', neonStatus: 'configured', firebaseAuthConfigured: true, geminiConfigured: false }
    );
  });

  it('reports an unavailable Firebase Auth configuration as unhealthy', () => {
    assert.deepEqual(
      summarizeBackendHealth(true, {
        status: 'degraded',
        services: { neon: 'not_checked', neonConfigured: true, firebaseAuthConfigured: false },
      }),
      { status: 'error', neonStatus: 'configured', firebaseAuthConfigured: false, geminiConfigured: false }
    );
  });
});
