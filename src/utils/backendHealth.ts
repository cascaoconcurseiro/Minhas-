export interface BackendHealthSummary {
  status: 'ok' | 'error';
  neonStatus: 'configured' | 'error';
  authConfigured: boolean;
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
  const neonStatus = services.neonConfigured === true ? 'configured' : 'error';
  const authConfigured = services.authConfigured === true;

  return {
    status: httpOk && body.status === 'ok' && neonStatus === 'configured' && authConfigured
      ? 'ok'
      : 'error',
    neonStatus,
    authConfigured,
    geminiConfigured: Boolean(body.geminiConfigured),
  };
}
