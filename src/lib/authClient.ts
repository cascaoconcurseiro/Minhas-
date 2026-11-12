import { getVaultIdForUid as getStableVaultIdForUid } from '../../shared/workspaceIdentity';
import { getLoadedPasskeyLibrary, loadPasskeyLibrary, loginPrepared } from './passkeyPrepare';

type PasskeyLibrary = typeof import('@simplewebauthn/browser');

export const AUTH_TOKEN_STORAGE_KEY = 'minhas_economias_auth_token_v1';
export const AUTO_VAULT_STORAGE_KEY = 'minhas_economias_cloud_vault_id_v2';

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail = ''
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

const KEEP_SIGNED_IN_KEY = 'minhas_economias_keep_signed_in_v1';
const REMEMBERED_EMAIL_KEY = 'minhas_economias_remembered_email_v1';

/** "Manter conectado": padrão ligado. Desligado, o login vale só até fechar o app. */
export function getKeepSignedIn(): boolean {
  try {
    return localStorage.getItem(KEEP_SIGNED_IN_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setKeepSignedIn(keep: boolean): void {
  try {
    if (keep) localStorage.removeItem(KEEP_SIGNED_IN_KEY);
    else localStorage.setItem(KEEP_SIGNED_IN_KEY, '0');
  } catch {
    // Armazenamento bloqueado: o login vale até recarregar.
  }
}

/** Último e-mail usado, para já vir preenchido na tela de entrada. */
export function getRememberedEmail(): string {
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function rememberEmail(email: string): void {
  try {
    const clean = email.trim().toLowerCase();
    if (clean) localStorage.setItem(REMEMBERED_EMAIL_KEY, clean);
  } catch {
    // Sem armazenamento: só não lembramos o e-mail.
  }
}

export function forgetRememberedEmail(): void {
  try {
    localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  } catch {
    // Sem armazenamento.
  }
}

function readStoredToken(): string {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (!token) {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      return;
    }
    if (getKeepSignedIn()) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    } else {
      // Sem "manter conectado": o login some quando o app for fechado.
      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
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
  const body = (await response.json().catch(() => ({}))) as { error?: string; detail?: string };
  if (!response.ok) {
    throw new AuthError(body.error || 'Não foi possível autenticar. Tente novamente.', response.status, body.detail ?? '');
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

export async function signInWithPasskey(): Promise<User> {
  // Sem nenhuma espera de rede antes do Face ID: o iPhone só abre o Face ID logo depois do toque.
  const ready = loginPrepared.takeReady();
  const library = getLoadedPasskeyLibrary();
  if (!ready || !library) {
    loginPrepared.prepare();
    void loadPasskeyLibrary();
    throw new AuthError('Preparando o Face ID. Toque de novo em instantes.', 0);
  }
  let response;
  try {
    response = await library.startAuthentication({
      optionsJSON: ready.options as Parameters<PasskeyLibrary['startAuthentication']>[0]['optionsJSON'],
    });
  } catch (error) {
    loginPrepared.prepare();
    throw error;
  }
  loginPrepared.prepare();
  const session = await requestJson<SessionResponse>('/api/auth/passkeys/login/verify', {
    method: 'POST',
    body: JSON.stringify({ response, challengeToken: ready.challengeToken }),
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
