import { createPublicKey, verify as verifySignature } from 'node:crypto';

const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const FIREBASE_ACCOUNT_LOOKUP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';
const MAX_CERT_CACHE_SECONDS = 6 * 60 * 60;
const CLOCK_SKEW_SECONDS = 5 * 60;
const MAX_UID_LENGTH = 128;
const UNKNOWN_KEY_REFRESH_COOLDOWN_MS = 30_000;
const FAILED_REFRESH_COOLDOWN_MS = 5_000;
const MAX_FIREBASE_ID_TOKEN_LENGTH = 16_384;

export class FirebaseTokenVerificationError extends Error {
  constructor(message: string, readonly status: 401 | 503) {
    super(message);
  }
}

export interface FirebaseIdTokenIdentity {
  uid: string;
  email: string;
  email_verified: boolean;
}

interface FirebaseJwtHeader {
  alg?: unknown;
  kid?: unknown;
  typ?: unknown;
}

interface FirebaseJwtClaims {
  aud?: unknown;
  iss?: unknown;
  sub?: unknown;
  user_id?: unknown;
  email?: unknown;
  email_verified?: unknown;
  iat?: unknown;
  exp?: unknown;
  auth_time?: unknown;
}

function decodeBase64UrlSegment(segment: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
    throw new FirebaseTokenVerificationError('Token Firebase inválido.', 401);
  }
  return Buffer.from(segment, 'base64url');
}

function readJsonSegment<T>(segment: string): T {
  try {
    return JSON.parse(decodeBase64UrlSegment(segment).toString('utf8')) as T;
  } catch (error) {
    if (error instanceof FirebaseTokenVerificationError) throw error;
    throw new FirebaseTokenVerificationError('Token Firebase inválido.', 401);
  }
}

function cacheTtlSeconds(cacheControl: string | null): number {
  const maxAge = cacheControl?.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1];
  if (!maxAge) return 5 * 60;
  return Math.max(1, Math.min(MAX_CERT_CACHE_SECONDS, Number(maxAge)));
}

export function createFirebaseIdTokenVerifier(options: {
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** `null` explicitly disables account-state lookups for isolated local tests; omitted reads FIREBASE_API_KEY. */
  apiKey?: string | null;
} = {}) {
  // Resolve the runtime fetch when a refresh is needed. Capturing the global
  // at module import makes integration tests (and runtime fetch wrappers)
  // depend on import order.
  const fetchImpl = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  const now = options.now ?? Date.now;
  const getApiKey = () => options.apiKey === null ? '' : options.apiKey ?? process.env.FIREBASE_API_KEY ?? '';
  let certs: Record<string, string> = {};
  let certsExpiresAt = 0;
  let refreshInFlight: Promise<void> | null = null;
  let lastUnknownKeyRefreshAt = Number.NEGATIVE_INFINITY;
  let lastFailedRefreshAt = Number.NEGATIVE_INFINITY;

  const refreshCerts = async () => {
    if (refreshInFlight) return refreshInFlight;
    if (now() - lastFailedRefreshAt < FAILED_REFRESH_COOLDOWN_MS) {
      throw new FirebaseTokenVerificationError('Chaves públicas do Firebase temporariamente indisponíveis.', 503);
    }
    refreshInFlight = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetchImpl(FIREBASE_CERTS_URL, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new FirebaseTokenVerificationError('Chaves públicas do Firebase indisponíveis.', 503);
        }
        const payload = await response.json() as unknown;
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new FirebaseTokenVerificationError('Resposta inválida das chaves públicas do Firebase.', 503);
        }
        const nextCerts = Object.fromEntries(
          Object.entries(payload).filter((entry): entry is [string, string] =>
            typeof entry[1] === 'string' && entry[1].length > 0
          )
        );
        if (Object.keys(nextCerts).length === 0) {
          throw new FirebaseTokenVerificationError('Resposta vazia das chaves públicas do Firebase.', 503);
        }
        // Validate each key before caching the document. A malformed key must
        // never replace a previously usable cache.
        for (const cert of Object.values(nextCerts)) createPublicKey(cert);
        certs = nextCerts;
        certsExpiresAt = now() + cacheTtlSeconds(response.headers.get('cache-control')) * 1000;
        lastFailedRefreshAt = Number.NEGATIVE_INFINITY;
      } catch (error) {
        lastFailedRefreshAt = now();
        if (error instanceof FirebaseTokenVerificationError) throw error;
        throw new FirebaseTokenVerificationError('Não foi possível obter as chaves públicas do Firebase.', 503);
      } finally {
        clearTimeout(timeout);
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  };

  const checkAccountState = async (idToken: string, uid: string, authTime: number) => {
    if (options.apiKey === null) return;
    const apiKey = getApiKey();
    // A configured Firebase project must not silently fall back to checking
    // only the JWT signature: that would keep revoked/disabled sessions valid
    // until exp. Only tests that explicitly pass apiKey:null bypass this call.
    if (!apiKey) {
      throw new FirebaseTokenVerificationError('A verificação de sessão Firebase não está configurada.', 503);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetchImpl(`${FIREBASE_ACCOUNT_LOOKUP_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        signal: controller.signal,
      });
      if (!response.ok) {
        let errorCode = '';
        try {
          const errorBody = await response.json() as unknown;
          const message = errorBody && typeof errorBody === 'object' && !Array.isArray(errorBody)
            ? (errorBody as { error?: { message?: unknown } }).error?.message
            : undefined;
          if (typeof message === 'string') errorCode = message.trim().split(/[\s:]/, 1)[0];
        } catch {
          // An unparseable upstream error is an availability/configuration
          // failure; never report it as proof that the user's token is revoked.
        }
        if (['INVALID_ID_TOKEN', 'USER_DISABLED', 'USER_NOT_FOUND'].includes(errorCode)) {
          throw new FirebaseTokenVerificationError('A sessão Firebase foi revogada ou não está mais ativa.', 401);
        }
        throw new FirebaseTokenVerificationError('Não foi possível confirmar o estado da conta Firebase.', 503);
      }
      const payload = await response.json() as unknown;
      const users = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as { users?: unknown }).users
        : undefined;
      if (!Array.isArray(users) || users.length !== 1 || !users[0] || typeof users[0] !== 'object') {
        throw new FirebaseTokenVerificationError('Resposta inválida do estado da conta Firebase.', 503);
      }
      const user = users[0] as { localId?: unknown; validSince?: unknown; disabled?: unknown };
      const validSince = typeof user.validSince === 'string' && /^\d+$/.test(user.validSince)
        ? Number(user.validSince)
        : NaN;
      if (typeof user.localId !== 'string' || typeof user.disabled !== 'boolean' || !Number.isSafeInteger(validSince)) {
        throw new FirebaseTokenVerificationError('Resposta inválida do estado da conta Firebase.', 503);
      }
      if (user.localId !== uid || user.disabled || authTime < validSince) {
        throw new FirebaseTokenVerificationError('A sessão Firebase foi revogada ou não está mais ativa.', 401);
      }
    } catch (error) {
      if (error instanceof FirebaseTokenVerificationError) throw error;
      throw new FirebaseTokenVerificationError('Não foi possível confirmar o estado da conta Firebase.', 503);
    } finally {
      clearTimeout(timeout);
    }
  };

  return async (idToken: string, projectId: string): Promise<FirebaseIdTokenIdentity> => {
    if (typeof idToken !== 'string' || idToken.length > MAX_FIREBASE_ID_TOKEN_LENGTH) {
      throw new FirebaseTokenVerificationError('Token Firebase inválido.', 401);
    }
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new FirebaseTokenVerificationError('Token Firebase inválido.', 401);
    const header = readJsonSegment<FirebaseJwtHeader>(parts[0]);
    const claims = readJsonSegment<FirebaseJwtClaims>(parts[1]);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
      throw new FirebaseTokenVerificationError('Token Firebase inválido.', 401);
    }

    const currentTime = now();
    if (currentTime >= certsExpiresAt) {
      await refreshCerts();
    } else if (!certs[header.kid]) {
      // A new legitimate key ID may indicate Google rotated certificates.
      // Permit at most one early refresh per cooldown window so arbitrary kid
      // values cannot turn this cache miss into an unbounded request fan-out.
      if (refreshInFlight) {
        await refreshInFlight;
      } else if (currentTime - lastUnknownKeyRefreshAt >= UNKNOWN_KEY_REFRESH_COOLDOWN_MS) {
        lastUnknownKeyRefreshAt = currentTime;
        await refreshCerts();
      }
    }
    const cert = certs[header.kid];
    if (!cert) throw new FirebaseTokenVerificationError('Token Firebase inválido.', 401);

    const signature = decodeBase64UrlSegment(parts[2]);
    let isSignatureValid = false;
    try {
      isSignatureValid = verifySignature(
        'RSA-SHA256',
        Buffer.from(`${parts[0]}.${parts[1]}`),
        createPublicKey(cert),
        signature
      );
    } catch {
      throw new FirebaseTokenVerificationError('Token Firebase inválido.', 401);
    }
    if (!isSignatureValid) throw new FirebaseTokenVerificationError('Token Firebase inválido.', 401);

    const nowSeconds = Math.floor(now() / 1000);
    if (
      claims.aud !== projectId ||
      claims.iss !== `https://securetoken.google.com/${projectId}` ||
      typeof claims.sub !== 'string' || claims.sub.length === 0 || claims.sub.length > MAX_UID_LENGTH ||
      (claims.user_id !== undefined && claims.user_id !== claims.sub) ||
      typeof claims.email !== 'string' || claims.email.length === 0 || claims.email.length > 320 ||
      typeof claims.email_verified !== 'boolean' ||
      typeof claims.iat !== 'number' || !Number.isInteger(claims.iat) || claims.iat > nowSeconds + CLOCK_SKEW_SECONDS ||
      claims.iat < 0 ||
      typeof claims.exp !== 'number' || !Number.isInteger(claims.exp) || claims.exp <= nowSeconds || claims.exp <= claims.iat ||
      typeof claims.auth_time !== 'number' || !Number.isInteger(claims.auth_time) || claims.auth_time < 0 ||
      claims.auth_time > nowSeconds + CLOCK_SKEW_SECONDS || claims.auth_time > claims.iat
    ) {
      throw new FirebaseTokenVerificationError('Token Firebase inválido ou expirado.', 401);
    }

    await checkAccountState(idToken, claims.sub, claims.auth_time);

    return {
      uid: claims.sub,
      email: claims.email,
      email_verified: claims.email_verified,
    };
  };
}

export const verifyFirebaseIdTokenLocally = createFirebaseIdTokenVerifier();
