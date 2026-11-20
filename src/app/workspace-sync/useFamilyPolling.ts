/** Convites e compartilhados recebidos, lidos enquanto o app está aberto. Parte de useWorkspaceSync (ver useWorkspaceSync.ts). */
import { useEffect } from 'react';
import { loadNeonFamilyInvitations, loadNeonSharedSnapshot } from '../../lib/neonWorkspace';
import { FamilyMember, Transaction } from '../../types/finance';
import { applyRemoteSettlementReports, replaceIncomingSharedTransactions } from '../../domain/family/sharedFinanceRules';
import type { AppStateApi } from '../useAppState';
import type { SessionHelpersApi } from './useSessionHelpers';
import type { WorkspaceSavingApi } from './useWorkspaceSaving';

export function useFamilyPolling(ctx: AppStateApi & SessionHelpersApi & WorkspaceSavingApi) {
  const {
    acceptedSharedPartnersRef,
    effectiveUserEmail,
    hasLoadedRemoteOnceRef,
    isAuthReady,
    isUserAuthenticated,
    neonWorkspaceRevisionRef,
    rememberInviteeAccounts,
    setFamilyMembers,
    setServerSentSharedIds,
    setServerStaleSharedIds,
    setTransactions,
    sharedWorkspaceProjectionRef,
    syncSavedFamilyWorkspace,
  } = ctx;
  // Poll Neon for family invitations and incoming shared expenses while the app is open.
  useEffect(() => {
    if (!isAuthReady || !isUserAuthenticated || !effectiveUserEmail) return;
    let active = true;
    const refreshFamilyData = async () => {
      if (!hasLoadedRemoteOnceRef.current || !navigator.onLine) return;
      try {
        const [invitations, sharedSnapshot] = await Promise.all([
          loadNeonFamilyInvitations(),
          loadNeonSharedSnapshot(),
        ]);
        if (!active) return;
        sharedWorkspaceProjectionRef.current = sharedSnapshot.workspaceProjectionSupported === true;
        rememberInviteeAccounts(invitations);
        const revision = neonWorkspaceRevisionRef.current;
        if (revision !== null) syncSavedFamilyWorkspace(revision, acceptedSharedPartnersRef.current.get(effectiveUserEmail) ?? []);
        setFamilyMembers((previous) => {
          const next = [...previous];
          for (const invitation of invitations) {
            const ownerEmail = invitation.owner_email.trim().toLowerCase();
            const invitedEmail = invitation.invited_email.trim().toLowerCase();
            const incoming = invitedEmail === effectiveUserEmail;
            const memberId = incoming
              ? `fam-inv-${ownerEmail.replace(/[^a-z0-9]/g, '_')}`
              : invitation.owner_member_id;
            const declined = invitation.status === 'declined' || invitation.status === 'revoked';
            const index = next.findIndex((member) =>
              incoming
                ? member.direction === 'incoming' &&
                  (member.id === memberId || member.email?.trim().toLowerCase() === ownerEmail)
                : member.direction !== 'incoming' &&
                  (member.id === memberId || member.email?.trim().toLowerCase() === invitedEmail)
            );
            if (declined) {
              if (incoming && index >= 0) next.splice(index, 1);
              else if (index >= 0) next[index] = { ...next[index], inviteStatus: 'none' };
              continue;
            }
            const member: FamilyMember = incoming
              ? {
                  id: memberId,
                  name: invitation.owner_name || ownerEmail.split('@')[0],
                  relationship: (invitation.relationship as FamilyMember['relationship']) || 'outro',
                  color: invitation.color || '#6366f1',
                  email: ownerEmail,
                  inviteStatus: invitation.status === 'accepted' ? 'accepted' : 'invited',
                  invitedByEmail: ownerEmail,
                  invitedByName: invitation.owner_name,
                  direction: 'incoming',
                  pixKey: invitation.owner_pix_key || undefined,
                  invitationId: invitation.invitation_id,
                }
              : {
                  id: memberId,
                  name: invitation.invited_email.split('@')[0],
                  relationship: (invitation.relationship as FamilyMember['relationship']) || 'outro',
                  color: invitation.color || '#6366f1',
                  email: invitedEmail,
                  inviteStatus: invitation.status === 'accepted' ? 'accepted' : 'invited',
                  direction: 'outgoing',
                  invitationId: invitation.invitation_id,
                };
            if (index >= 0) {
              next[index] = { ...next[index], ...member, name: next[index].name || member.name };
            } else {
              next.push(member);
            }
          }
          return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
        });
        setTransactions((previous) => {
          const next = replaceIncomingSharedTransactions(applyRemoteSettlementReports(previous, sharedSnapshot.outgoingSettlements), sharedSnapshot.transactions as unknown as Transaction[]);
          return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
        });
        const staleIds = sharedSnapshot.outgoingSharedStaleIds ?? [];
        setServerStaleSharedIds((previous) =>
          previous.size === staleIds.length && staleIds.every((id) => previous.has(id)) ? previous : new Set(staleIds));
        const sentIds = sharedSnapshot.outgoingSharedIds;
        if (sentIds) {
          setServerSentSharedIds((previous) =>
            previous && previous.size === sentIds.length && sentIds.every((id) => previous.has(id))
              ? previous
              : new Set(sentIds));
        }
      } catch (error) {
        if (active) {
          console.warn(
            'A atualização periódica dos dados familiares falhou.',
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    };
    const timer = window.setInterval(() => void refreshFamilyData(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isAuthReady, isUserAuthenticated, effectiveUserEmail]);

  return {

  };
}

export type FamilyPollingApi = ReturnType<typeof useFamilyPolling>;
