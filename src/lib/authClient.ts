import { getVaultIdForUid as getStableVaultIdForUid } from '../../shared/workspaceIdentity';

export const AUTH_TOKEN_STORAGE_KEY = 'minhas_economias_auth_token_v1';
export const AUTO_VAULT_STORAGE_KEY = 'minhas_economias_cloud_vault_id_v2';

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  isAnonymous: false;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

interface SessionResponse {
  token: string;
  user: { uid: string; email: string; displayName: string; emailVerified: boolean };
}

type Listener = (user: User | null) => void;

const listeners = new Set<Listener>();

function readStoredToken(): string {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    // Private mode / blocked storage: the session simply lasts until reload.
  }
}

function decodeClaims(token: string): { sub: string; email: string; name: string; email_verified: boolean; exp: number } | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
    const claims = JSON.parse(json) as Record<string, unknown>;
    if (typeof claims.sub !== 'string' || typeof claims.email !== 'string' || typeof claims.exp !== 'number') {
      return null;
    }
    return {
      sub: claims.sub,
      email: claims.email,
      name: typeof claims.name === 'string' ? claims.name : '',
      email_verified: claims.email_verified === true,
      exp: claims.exp,
    };
  } catch {
    return null;
  }
}

function buildUser(token: string): User | null {
  const claims = decodeClaims(token);
  if (!claims || claims.exp * 1000 <= Date.now()) return null;
  return {
    uid: claims.sub,
    email: claims.email,
    displayName: claims.name,
    emailVerified: claims.email_verified,
    isAnonymous: false,
    getIdToken: async () => readStoredToken() || token,
  };
}

export const auth: { currentUser: User | null } = {
  currentUser: buildUser(readStoredToken()),
};

function notify(): void {
  listeners.forEach((listener) => listener(auth.currentUser));
}

function applySession(token: string | null): User | null {
  writeStoredToken(token);
  auth.currentUser = token ? buildUser(token) : null;
  notify();
  return auth.currentUser;
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new AuthError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.', 0);
  }
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new AuthError(body.error || 'Não foi possível autenticar. Tente novamente.', response.status);
  }
  return body as T;
}

export function onAuthStateChanged(_auth: unknown, listener: Listener): () => void {
  listeners.add(listener);
  listener(auth.currentUser);
  // Re-validate a stored session in the background; only a definitive 401 ends it.
  const token = readStoredToken();
  if (token && auth.currentUser) {
    void requestJson<SessionResponse>('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((session) => {
        const previous = auth.currentUser;
        const next = applySessionSilently(session.token);
        if (previous && next && previous.emailVerified !== next.emailVerified) notify();
      })
      .catch((error) => {
        if (error instanceof AuthError && error.status === 401) applySession(null);
      });
  }
  return () => {
    listeners.delete(listener);
  };
}

function applySessionSilently(token: string): User | null {
  writeStoredToken(token);
  auth.currentUser = buildUser(token);
  return auth.currentUser;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const session = await requestJson<SessionResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const user = applySession(session.token);
  if (!user) throw new AuthError('Sessão recebida é inválida. Tente novamente.', 502);
  return user;
}

export async function registerWithEmail(displayName: string, email: string, password: string): Promise<User> {
  const session = await requestJson<SessionResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: displayName.trim(), email: email.trim(), password }),
  });
  const user = applySession(session.token);
  if (!user) throw new AuthError('Sessão recebida é inválida. Tente novamente.', 502);
  return user;
}

export async function refreshAuthUser(user: User): Promise<User> {
  const token = await user.getIdToken();
  const session = await requestJson<SessionResponse>('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return applySession(session.token) ?? user;
}

export async function signOutUser(): Promise<void> {
  const token = readStoredToken();
  // Always end the local session; the server call revokes the token everywhere.
  applySession(null);
  if (!token) return;
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // Offline: the local session is already gone.
  }
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthError) return error.message;
  return 'Não foi possível autenticar. Verifique seus dados e tente novamente.';
}

export function getOrCreateAutoCloudVaultId(): string {
  try {
    const existing = localStorage.getItem(AUTO_VAULT_STORAGE_KEY);
    if (existing && existing.length >= 16) {
      return existing;
    }
    const randomPart =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}${Math.random()
            .toString(36)
            .slice(2, 12)}`;
    const newVaultId = `vault_${randomPart.slice(0, 28)}`;
    localStorage.setItem(AUTO_VAULT_STORAGE_KEY, newVaultId);
    return newVaultId;
  } catch {
    return 'vault_default_session_br_01';
  }
}

export function getVaultIdForUid(uid: string | null | undefined): string {
  return uid?.trim() ? getStableVaultIdForUid(uid) : getOrCreateAutoCloudVaultId();
}
