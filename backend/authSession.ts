import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_TOKEN_LENGTH = 4096;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_COST = 16384;
const MIN_SECRET_LENGTH = 32;
const MIN_DERIVED_SOURCE_LENGTH = 40;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

export class SessionTokenError extends Error {
  constructor(message: string, readonly status: 401 | 503) {
    super(message);
  }
}

export interface SessionIdentity {
  uid: string;
  email: string;
  email_verified: boolean;
  name: string;
  /** Server-side session generation; bumping it in app_users revokes every issued token. */
  token_version?: number;
}

/**
 * Session signing key. Prefer a dedicated AUTH_SESSION_SECRET; otherwise derive a
 * domain-separated key from the server-only DATABASE_URL so production works
 * without extra configuration. Neither value ever reaches the browser.
 */
function resolveSecret(): string | null {
  const dedicated = process.env.AUTH_SESSION_SECRET ?? '';
  if (dedicated.length >= MIN_SECRET_LENGTH) return dedicated;
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (databaseUrl.length >= MIN_DERIVED_SOURCE_LENGTH) {
    return createHmac('sha256', databaseUrl).update('minhas-economias:auth-session:v1').digest('hex');
  }
  return null;
}

export function isAuthConfigured(): boolean {
  return resolveSecret() !== null;
}

function getSecret(): string {
  const secret = resolveSecret();
  if (!secret) throw new SessionTokenError('Autenticação não está configurada no servidor.', 503);
  return secret;
}

function sign(content: string, secret: string): string {
  return createHmac('sha256', secret).update(content).digest('base64url');
}

export function signSessionToken(identity: SessionIdentity, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(
    JSON.stringify({
      sub: identity.uid,
      email: identity.email,
      email_verified: identity.email_verified,
      name: identity.name,
      tv: identity.token_version ?? 0,
      aud: 'session',
      iat: nowSeconds,
      exp: nowSeconds + SESSION_TTL_SECONDS,
    })
  ).toString('base64url');
  const content = `${header}.${claims}`;
  return `${content}.${sign(content, getSecret())}`;
}

export function verifySessionToken(token: string, nowSeconds = Math.floor(Date.now() / 1000)): SessionIdentity {
  if (!token || token.length > MAX_TOKEN_LENGTH) throw new SessionTokenError('Sessão inválida.', 401);
  const secret = getSecret();
  const parts = token.split('.');
  if (parts.length !== 3) throw new SessionTokenError('Sessão inválida.', 401);
  const [header, claims, signature] = parts;
  const expected = Buffer.from(sign(`${header}.${claims}`, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new SessionTokenError('Sessão inválida.', 401);
  }
  let parsedHeader: { alg?: unknown };
  let parsed: Record<string, unknown>;
  try {
    parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    parsed = JSON.parse(Buffer.from(claims, 'base64url').toString('utf8'));
  } catch {
    throw new SessionTokenError('Sessão inválida.', 401);
  }
  if (parsedHeader.alg !== 'HS256') throw new SessionTokenError('Sessão inválida.', 401);
  if (typeof parsed.exp !== 'number' || parsed.exp <= nowSeconds) {
    throw new SessionTokenError('Sessão expirada.', 401);
  }
  if (typeof parsed.sub !== 'string' || !parsed.sub || typeof parsed.email !== 'string' || !parsed.email) {
    throw new SessionTokenError('Sessão inválida.', 401);
  }
  if (parsed.aud !== undefined && parsed.aud !== 'session') {
    throw new SessionTokenError('Sessão inválida.', 401);
  }
  return {
    token_version: typeof parsed.tv === 'number' ? parsed.tv : 0,
    uid: parsed.sub,
    email: parsed.email,
    email_verified: parsed.email_verified === true,
    name: typeof parsed.name === 'string' ? parsed.name : '',
  };
}

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, SCRYPT_KEY_LENGTH, { N: SCRYPT_COST }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${SCRYPT_COST}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

// Hash of a random password, used so unknown e-mails cost the same time as wrong passwords.
const DUMMY_HASH_PROMISE = hashPassword(randomBytes(12).toString('hex'));

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const parts = (stored ?? (await DUMMY_HASH_PROMISE)).split('$');
  const usable = Boolean(stored) && parts.length === 4 && parts[0] === 'scrypt';
  const [, , saltText, keyText] = usable ? parts : (await DUMMY_HASH_PROMISE).split('$');
  const salt = Buffer.from(saltText, 'base64url');
  const expected = Buffer.from(keyText, 'base64url');
  const actual = await scrypt(password, salt);
  const matches = actual.length === expected.length && timingSafeEqual(actual, expected);
  return usable && matches;
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

interface Attempt {
  count: number;
  resetAt: number;
}

/** Best-effort throttle (per server instance) against password guessing. */
export function createAttemptLimiter(maxAttempts: number, windowMs: number) {
  const attempts = new Map<string, Attempt>();
  return {
    isBlocked(key: string, now = Date.now()): boolean {
      const entry = attempts.get(key);
      if (!entry) return false;
      if (entry.resetAt <= now) {
        attempts.delete(key);
        return false;
      }
      return entry.count >= maxAttempts;
    },
    recordFailure(key: string, now = Date.now()): void {
      const entry = attempts.get(key);
      if (!entry || entry.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + windowMs });
      else entry.count += 1;
      if (attempts.size > 5000) {
        for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
      }
    },
    reset(key: string): void {
      attempts.delete(key);
    },
  };
}
