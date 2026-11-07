import { createInternalNeonAuth } from '@neon/auth';
import { BetterAuthReactAdapter } from '@neon/auth/react/adapters';
import {
  forceNeonAuthSessionFetchOptions,
  getVerifiedSessionCredentials,
} from '../utils/authSessionVerification';
import { getVerifiedAuthUser } from '../utils/verifiedAuthUser';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;

if (!authUrl) {
  throw new Error('VITE_NEON_AUTH_URL não está configurada.');
}

const neonAuth = createInternalNeonAuth(authUrl, {
  adapter: BetterAuthReactAdapter(),
});
export const authClient = neonAuth.adapter;
let pendingVerifiedEmailUserId: string | null = null;

async function neonAuthPost<T>(path: string, body: Record<string, string>): Promise<T> {
  const baseUrl = authUrl.endsWith('/') ? authUrl : `${authUrl}/`;
  const response = await fetch(new URL(path, baseUrl), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as { message?: string; error?: string } | null;
  if (!response.ok) throw new Error(payload?.message || payload?.error || 'Falha na verificação de e-mail.');
  return payload as T;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  isAnonymous: false;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

export async function getNeonAuthToken(): Promise<string> {
  if (pendingVerifiedEmailUserId) {
    const expectedUserId = pendingVerifiedEmailUserId;
    const freshSession = await authClient.getSession(
      forceNeonAuthSessionFetchOptions()
    );
    if (freshSession.error) {
      throw new Error('Não foi possível atualizar a sessão após confirmar o e-mail.');
    }
    const credentials = getVerifiedSessionCredentials(freshSession, expectedUserId);
    pendingVerifiedEmailUserId = null;
    return credentials.token;
  }

  const token = await neonAuth.getJWTToken();
  if (!token) throw new Error('Sessão Neon Auth inválida. Entre novamente.');
  return token;
}

export function toAppUser(user: {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}): AppUser {
  return {
    uid: user.id,
    email: user.email,
    displayName: user.name,
    emailVerified: user.emailVerified,
    isAnonymous: false,
    getIdToken: getNeonAuthToken,
  };
}

export async function signInWithEmail(email: string, password: string): Promise<AppUser> {
  const result = await authClient.signIn.email({ email: email.trim(), password });
  if (result.error || !result.data?.user) {
    if (result.error) throw result.error;
    throw new Error('Não foi possível entrar. Verifique e-mail e senha.');
  }
  pendingVerifiedEmailUserId = null;
  return toAppUser(result.data.user);
}

export async function registerWithEmail(
  displayName: string,
  email: string,
  password: string
): Promise<AppUser> {
  const result = await authClient.signUp.email({
    name: displayName.trim(),
    email: email.trim(),
    password,
  });
  if (result.error || !result.data?.user) {
    if (result.error) throw result.error;
    throw new Error('Não foi possível criar sua conta.');
  }
  pendingVerifiedEmailUserId = null;
  return toAppUser(result.data.user);
}

export async function resendEmailVerification(user: AppUser): Promise<void> {
  await neonAuthPost('email-otp/send-verification-otp', {
    email: user.email,
    type: 'email-verification',
  });
}

export async function verifyEmailOtp(email: string, otp: string): Promise<AppUser> {
  const response = await neonAuthPost<unknown>('email-otp/verify-email', {
    email: email.trim(),
    otp: otp.trim(),
  });
  const verifiedAuthUser = getVerifiedAuthUser(response);
  if (verifiedAuthUser.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    throw new Error('O código foi confirmado para uma identidade diferente.');
  }

  pendingVerifiedEmailUserId = verifiedAuthUser.id;
  try {
    const freshSession = await authClient.getSession(
      forceNeonAuthSessionFetchOptions()
    );
    if (freshSession.error) {
      throw new Error('Não foi possível atualizar a sessão após confirmar o e-mail.');
    }
    const credentials = getVerifiedSessionCredentials(
      freshSession,
      verifiedAuthUser.id
    );
    pendingVerifiedEmailUserId = null;
    return toAppUser(credentials.user);
  } catch {
    // OTP response is authoritative for UI state. Keep the marker so that the
    // next protected API request force-refreshes and never sends a cached JWT.
    return toAppUser(verifiedAuthUser);
  }
}

export async function refreshNeonAuthUser(user: AppUser): Promise<AppUser> {
  const result = await authClient.getSession(forceNeonAuthSessionFetchOptions());
  if (result.error || !result.data?.user || result.data.user.id !== user.uid) {
    throw new Error('Não foi possível atualizar a sessão Neon Auth.');
  }
  if (pendingVerifiedEmailUserId === user.uid && result.data.user.emailVerified) {
    pendingVerifiedEmailUserId = null;
  }
  return toAppUser(result.data.user);
}

export async function signOutNeonAuth(): Promise<void> {
  const result = await authClient.signOut();
  if (result.error) throw new Error(result.error.message || 'Não foi possível encerrar a sessão.');
  pendingVerifiedEmailUserId = null;
}

export function getOrCreateAutoCloudVaultId(): string {
  try {
    const existing = localStorage.getItem('minhas_economias_cloud_vault_id_v2');
    if (existing && existing.length >= 16) return existing;
    const generated = `vault_${crypto.randomUUID().replace(/-/g, '').slice(0, 28)}`;
    localStorage.setItem('minhas_economias_cloud_vault_id_v2', generated);
    return generated;
  } catch {
    return 'vault_default_session_br_01';
  }
}

export function getVaultIdForUid(uid: string | null | undefined): string {
  if (!uid?.trim()) return getOrCreateAutoCloudVaultId();
  return `vault_uid_${uid.trim()}`;
}
