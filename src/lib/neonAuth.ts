import { createInternalNeonAuth } from '@neon/auth';
import { BetterAuthReactAdapter } from '@neon/auth/react/adapters';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;

if (!authUrl) {
  throw new Error('VITE_NEON_AUTH_URL não está configurada.');
}

const neonAuth = createInternalNeonAuth(authUrl, {
  adapter: BetterAuthReactAdapter(),
});
export const authClient = neonAuth.adapter;

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  isAnonymous: false;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

export async function getNeonAuthToken(): Promise<string> {
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
  return toAppUser(result.data.user);
}

export async function resendEmailVerification(user: AppUser): Promise<void> {
  const result = await authClient.sendVerificationEmail({
    email: user.email,
    callbackURL: window.location.origin,
  });
  if (result.error) throw result.error;
}

export async function refreshNeonAuthUser(user: AppUser): Promise<AppUser> {
  const result = await authClient.getSession();
  if (result.error || !result.data?.user) {
    throw new Error('Não foi possível atualizar a sessão Neon Auth.');
  }
  return toAppUser(result.data.user);
}

export async function signOutNeonAuth(): Promise<void> {
  const result = await authClient.signOut();
  if (result.error) throw new Error(result.error.message || 'Não foi possível encerrar a sessão.');
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
