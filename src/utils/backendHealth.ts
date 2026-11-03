export interface BackendHealthSummary {
  status: 'ok' | 'error';
  neonStatus: 'ok' | 'error';
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

  return {
    status: httpOk && body.status === 'ok' && neonStatus === 'ok' ? 'ok' : 'error',
    neonStatus,
    geminiConfigured: Boolean(body.geminiConfigured),
  };
}
