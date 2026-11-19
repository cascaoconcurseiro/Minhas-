/** Identidade do usuário autenticado e leitura do token de sessão. */
import { verifySessionToken } from './authSession.ts';

export interface AuthUserIdentity {
  uid: string;
  email: string;
  email_verified?: boolean;
  token_version?: number;
}

export function verifyAuthToken(token: string): AuthUserIdentity {
  const identity = verifySessionToken(token);
  return {
    uid: identity.uid,
    email: identity.email,
    email_verified: identity.email_verified,
    token_version: identity.token_version ?? 0,
  };
}
