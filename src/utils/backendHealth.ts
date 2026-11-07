export interface BackendHealthSummary {
  status: 'ok' | 'error';
  neonStatus: 'ok' | 'error';
  firebaseAuthConfigured: boolean;
  geminiConfigured: boolean;
}

export function summarizeBackendHealth(
  httpOk: boolean,
  value: unknown
): BackendHealthSummary {
  const body = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  const services = body.services && typeof body.services === 'object'
    ? body.services as Record<string, unknown>
    : {};
  const neonStatus = services.neon === 'ok' ? 'ok' : 'error';
  const firebaseAuthConfigured = services.firebaseAuthConfigured === true;

  return {
    status: httpOk && body.status === 'ok' && neonStatus === 'ok' && firebaseAuthConfigured
      ? 'ok'
      : 'error',
    neonStatus,
    firebaseAuthConfigured,
    geminiConfigured: Boolean(body.geminiConfigured),
  };
}
