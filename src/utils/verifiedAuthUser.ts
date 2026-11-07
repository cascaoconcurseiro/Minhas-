export interface VerifiedAuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: true;
}

export function getVerifiedAuthUser(response: unknown): VerifiedAuthUser {
  if (!response || typeof response !== 'object' || !('user' in response)) {
    throw new Error('A confirmação não retornou os dados do usuário.');
  }

  const user = (response as { user?: unknown }).user;
  if (
    !user ||
    typeof user !== 'object' ||
    !('id' in user) ||
    !('email' in user) ||
    !('name' in user) ||
    !('emailVerified' in user)
  ) {
    throw new Error('A confirmação retornou dados de usuário inválidos.');
  }

  const verifiedUser = user as Record<string, unknown>;
  if (
    typeof verifiedUser.id !== 'string' ||
    typeof verifiedUser.email !== 'string' ||
    typeof verifiedUser.name !== 'string' ||
    verifiedUser.emailVerified !== true
  ) {
    throw new Error('O código foi aceito, mas o endereço ainda não está confirmado.');
  }

  return {
    id: verifiedUser.id,
    email: verifiedUser.email,
    name: verifiedUser.name,
    emailVerified: true,
  };
}
