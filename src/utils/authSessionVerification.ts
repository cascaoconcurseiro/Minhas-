export interface AuthSessionUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export interface VerifiedSessionCredentials {
  user: AuthSessionUser & { emailVerified: true };
  token: string;
}

export function getVerifiedSessionCredentials(
  response: unknown,
  expectedUserId: string
): VerifiedSessionCredentials {
  if (!response || typeof response !== 'object' || !('data' in response)) {
    throw new Error('Não foi possível atualizar a sessão Neon Auth.');
  }

  const data = (response as { data?: unknown }).data;
  if (!data || typeof data !== 'object' || !('session' in data) || !('user' in data)) {
    throw new Error('Não foi possível atualizar a sessão Neon Auth.');
  }

  const session = (data as { session?: unknown }).session;
  const user = (data as { user?: unknown }).user;
  if (
    !session || typeof session !== 'object' || !('token' in session) ||
    !user || typeof user !== 'object' ||
    !('id' in user) || !('email' in user) || !('name' in user) || !('emailVerified' in user)
  ) {
    throw new Error('Não foi possível atualizar a sessão Neon Auth.');
  }

  const authUser = user as Record<string, unknown>;
  const token = (session as { token?: unknown }).token;
  if (
    authUser.id !== expectedUserId ||
    typeof authUser.email !== 'string' ||
    typeof authUser.name !== 'string' ||
    authUser.emailVerified !== true ||
    typeof token !== 'string' ||
    !token
  ) {
    throw new Error('A sessão Neon Auth ainda não refletiu a confirmação do e-mail.');
  }

  return {
    user: {
      id: authUser.id,
      email: authUser.email,
      name: authUser.name,
      emailVerified: true,
    },
    token,
  };
}

export function forceNeonAuthSessionFetchOptions() {
  return { fetchOptions: { headers: { 'X-Force-Fetch': 'true' } } };
}

export function preserveConfirmedEmailVerification<
  T extends { uid: string; emailVerified: boolean }
>(user: T | null, confirmedUserId: string | null): T | null {
  if (!user || user.uid !== confirmedUserId || user.emailVerified) return user;
  return { ...user, emailVerified: true };
}
