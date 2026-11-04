const LEGACY_VERIFYING_SSL_MODES = new Set(['prefer', 'require', 'verify-ca']);

/**
 * pg-connection-string currently treats these modes as verify-full and warns
 * that its next major version will adopt weaker libpq semantics for them.
 * Spell out today's certificate and hostname verification to preserve it.
 */
export function normalizeDatabaseConnectionString(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return connectionString;
  if (url.searchParams.get('uselibpqcompat')?.toLowerCase() === 'true') return connectionString;

  const sslMode = url.searchParams.get('sslmode')?.toLowerCase();
  if (!sslMode || !LEGACY_VERIFYING_SSL_MODES.has(sslMode)) return connectionString;

  url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}
