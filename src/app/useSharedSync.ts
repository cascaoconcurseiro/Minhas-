/** Envio dos lançamentos compartilhados para a outra conta vinculada. Parte do App (ver src/App.tsx). */
import { useEffect, useRef } from 'react';
import { FamilyMember, Transaction } from '../types/finance';
import { findUnsentSharedTransactions, getSharedSyncId, withSharedDueDates } from '../domain/family/sharedFinanceRules';
import { syncNeonSharedTransactions } from '../lib/neonWorkspace';
import type { AppStateApi } from './useAppState';
import type { WorkspaceSyncApi } from './useWorkspaceSync';

export function useSharedSync(app: AppStateApi & WorkspaceSyncApi) {
  const {
    cards,
    currentUser,
    effectiveUserEmail,
    familyMembers,
    hasLoadedRemoteOnceRef,
    neonWorkspaceRevisionRef,
    serverSentSharedIds,
    serverStaleSharedIds,
    sharedPendingHideRef,
    sharedWorkspaceProjectionRef,
    syncSavedFamilyWorkspace,
    transactions,
  } = app;
  const sharedSyncVersionRef = useRef<Record<string, number>>({});
  const triggerCrossAccountSharedTxSync = (
    nextTransactions: Transaction[],
    nextMembers: FamilyMember[] = familyMembers,
    deletedSharedSyncIds?: string[],
    /** Quando informado, os ids apagados valem só para esta pessoa (ex.: o lançamento mudou de parceiro). */
    deletedOnlyForMemberId?: string
  ) => {
    if (!effectiveUserEmail) return;
    if (sharedWorkspaceProjectionRef.current) {
      // Outgoing writes and settlement state come from the revision actually saved in PostgreSQL.
      // Only explicitly hiding a received mirror needs an extra instruction.
      if (!currentUser || !deletedSharedSyncIds?.length) return;
      const revision = neonWorkspaceRevisionRef.current;
      const deleting = new Set(deletedSharedSyncIds.map((id) => id.replace(/^tx-mirror-/, '')));
      const partners: string[] = [];
      for (const member of nextMembers) {
        const partnerEmail = (member.email || member.invitedByEmail || '').trim().toLowerCase();
        if (!partnerEmail || member.inviteStatus !== 'accepted' ||
            (deletedOnlyForMemberId && member.id !== deletedOnlyForMemberId)) continue;
        const hides = transactions.filter((tx) =>
          tx.id.startsWith('tx-mirror-') && tx.sharedMemberId === member.id && deleting.has(getSharedSyncId(tx)));
        if (hides.length === 0) continue;
        const key = `${currentUser.uid}|${partnerEmail}`;
        const pending = sharedPendingHideRef.current.get(key) ?? new Set<string>();
        hides.forEach((tx) => pending.add(getSharedSyncId(tx)));
        sharedPendingHideRef.current.set(key, pending);
        partners.push(partnerEmail);
      }
      if (revision !== null) syncSavedFamilyWorkspace(revision, partners);
      return;
    }
    const sharedList = nextTransactions.filter((t) => t.isShared && !t.tripId);
    if (
      sharedList.length === 0 &&
      (!deletedSharedSyncIds || deletedSharedSyncIds.length === 0)
    ) {
      return;
    }
    for (const member of nextMembers) {
      const partnerEmail = String(member.email || member.invitedByEmail || '')
        .trim()
        .toLowerCase();
      if (
        !partnerEmail ||
        partnerEmail === effectiveUserEmail ||
        member.inviteStatus !== 'accepted'
      ) {
        continue;
      }
      const memberTransactions = sharedList.filter(
        (tx) => String(tx.sharedMemberId || '') === member.id
      );
      const deletedForThisMember =
        deletedOnlyForMemberId && deletedOnlyForMemberId !== member.id ? undefined : deletedSharedSyncIds;
      if (memberTransactions.length === 0 && !deletedForThisMember?.length) continue;
      const syncVersion = (sharedSyncVersionRef.current[partnerEmail] ?? 0) + 1;
      sharedSyncVersionRef.current[partnerEmail] = syncVersion;
      const sendToPartner = (attempt: number) => {
        void syncNeonSharedTransactions({
          partnerEmail,
          transactions: withSharedDueDates(memberTransactions, cards) as unknown as Array<Record<string, unknown>>,
          deletedSharedIds: deletedForThisMember,
        }).catch((error) => {
          console.error(
            `Falha ao sincronizar despesas compartilhadas com ${partnerEmail}.`,
            error instanceof Error ? error.message : String(error)
          );
          // Tenta de novo (até 6 vezes) enquanto não houver uma sincronização mais nova para a mesma pessoa.
          if (attempt >= 6) return;
          window.setTimeout(() => {
            if (sharedSyncVersionRef.current[partnerEmail] === syncVersion) sendToPartner(attempt + 1);
          }, Math.min(2_000 * 2 ** attempt, 60_000));
        });
      };
      sendToPartner(0);
    }
  };

  // Envia à pessoa vinculada os compartilhados que ainda não estão no servidor (ex.: lançados antes de ela
  // aceitar o convite; o envio normal só acontece ao salvar). Silencioso, só depois de ler o Neon, em lotes,
  // e cada lançamento é tentado uma vez por sessão (falha de rede libera nova tentativa na próxima leitura).
  const sharedResendAttemptedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (sharedWorkspaceProjectionRef.current) return;
    if (!serverSentSharedIds || !hasLoadedRemoteOnceRef.current || !effectiveUserEmail) return;
    const attempted = sharedResendAttemptedRef.current;
    for (const pending of findUnsentSharedTransactions(transactions, familyMembers, serverSentSharedIds, effectiveUserEmail, serverStaleSharedIds, cards)) {
      const keyOf = (tx: Transaction) => `${effectiveUserEmail}|${pending.partnerEmail}|${getSharedSyncId(tx)}`;
      const fresh = pending.transactions.filter((tx) => !attempted.has(keyOf(tx)));
      if (fresh.length === 0) continue;
      fresh.forEach((tx) => attempted.add(keyOf(tx)));
      void (async () => {
        for (let start = 0; start < fresh.length; start += 40) {
          const chunk = fresh.slice(start, start + 40);
          try {
            await syncNeonSharedTransactions({
              partnerEmail: pending.partnerEmail,
              transactions: withSharedDueDates(chunk, cards) as unknown as Array<Record<string, unknown>>,
            });
          } catch (error) {
            fresh.slice(start).forEach((tx) => attempted.delete(keyOf(tx)));
            console.error(
              `Falha ao enviar compartilhados pendentes para ${pending.partnerEmail}.`,
              error instanceof Error ? error.message : String(error)
            );
            return;
          }
        }
      })();
    }
    // Só reage a uma nova leitura do servidor ou a mudança de vínculo; edições já sincronizam ao salvar.
  }, [serverSentSharedIds, serverStaleSharedIds, familyMembers]);

  return {
    triggerCrossAccountSharedTxSync,
  };
}

export type SharedSyncApi = ReturnType<typeof useSharedSync>;
