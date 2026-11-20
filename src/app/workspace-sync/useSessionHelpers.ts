/** Sessão expirada (volta ao login) e lembrança de quem já tem conta. Parte de useWorkspaceSync (ver useWorkspaceSync.ts). */
import { useRef } from 'react';
import { signOutUser } from '../../lib/authClient';
import { DEFAULT_SETTINGS } from '../appConfig';
import type { AppStateApi } from '../useAppState';

export function useSessionHelpers(ctx: AppStateApi) {
  const {
    acceptedSharedPartnersRef,
    effectiveUserEmail,
    hasLoadedRemoteOnceRef,
    loadedWorkspaceUidRef,
    resetFinancialStateToCleanZero,
    setAuthSession,
    setInviteCodes,
    setInviteeHasAccount,
    setSettings,
    showNotice,
  } = ctx;
  // Sessão expirada e lembrança de quem já tem conta: ficam no começo porque várias partes abaixo as usam.
  const sessionExpiredRef = useRef(false);
  const expireSession = async () => {
    if (sessionExpiredRef.current) return;
    sessionExpiredRef.current = true;
    try {
      await signOutUser();
    } catch {
      // Ignore
    }
    hasLoadedRemoteOnceRef.current = false;
    loadedWorkspaceUidRef.current = null;
    resetFinancialStateToCleanZero();
    setSettings(DEFAULT_SETTINGS);
    setAuthSession({ isLoggedIn: false, email: '', displayName: '' });
    showNotice('Sua sessão expirou. Entre novamente para continuar.', undefined, true);
    window.setTimeout(() => { sessionExpiredRef.current = false; }, 5000);
  };
  const expireSessionRef = useRef(expireSession);
  expireSessionRef.current = expireSession;
  const rememberInviteeAccounts = (invitations: Array<{ owner_email: string; invited_email: string; status: string; invited_has_account?: boolean; invite_code?: string }>) => {
    const accounts: Record<string, boolean> = {};
    const codes: Record<string, string> = {};
    const acceptedPartners: string[] = [];
    for (const invitation of invitations) {
      const owner = invitation.owner_email.trim().toLowerCase();
      const email = invitation.invited_email.trim().toLowerCase();
      if (invitation.status === 'accepted') {
        acceptedPartners.push(owner === effectiveUserEmail ? email : owner);
      }
      if (invitation.status !== 'invited') continue;
      if (typeof invitation.invited_has_account === 'boolean') accounts[email] = invitation.invited_has_account;
      if (typeof invitation.invite_code === 'string') codes[email] = invitation.invite_code;
    }
    if (effectiveUserEmail) acceptedSharedPartnersRef.current.set(effectiveUserEmail, acceptedPartners);
    setInviteeHasAccount((previous) => JSON.stringify(previous) === JSON.stringify(accounts) ? previous : accounts);
    setInviteCodes((previous) => JSON.stringify(previous) === JSON.stringify(codes) ? previous : codes);
  };

  return {
    expireSessionRef,
    rememberInviteeAccounts,
  };
}

export type SessionHelpersApi = ReturnType<typeof useSessionHelpers>;
