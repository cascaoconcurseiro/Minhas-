/** Gravação no Neon: montar o pacote, fila de gravação, nova tentativa e projeção familiar. Parte de useWorkspaceSync (ver useWorkspaceSync.ts). */
import { compactTransactionListForStorage } from '../../services/import-export/ofxParser';
import { collectSharedSettlementReceipts } from '../../domain/family/sharedFinanceRules';
import { serializeSettingsWithoutSmtpSecrets } from '../../utils/secureSettings';
import { NeonWorkspaceError, createNeonWorkspace, loadNeonWorkspace, saveNeonWorkspace, syncNeonSharedTransactions } from '../../lib/neonWorkspace';
import { isRetryableWorkspaceSaveError, updateWorkspaceConflictLocalPayload, workspaceContentSignature } from '../../services/workspace/workspaceSyncRecovery';
import type { AppStateApi } from '../useAppState';
import type { SessionHelpersApi } from './useSessionHelpers';

export function useWorkspaceSaving(ctx: AppStateApi & SessionHelpersApi) {
  const {
    acceptedSharedPartnersRef,
    accounts,
    authenticatedUidRef,
    cards,
    categories,
    currentUser,
    effectiveUserDisplayName,
    effectiveUserEmail,
    expireSessionRef,
    familyMembers,
    goals,
    hasLoadedRemoteOnceRef,
    investmentTargets,
    investments,
    knownRemoteSignaturesRef,
    lastConfirmedSignatureRef,
    latestNeonPayloadRef,
    neonSaveQueueRef,
    neonWorkspaceRevisionRef,
    receivables,
    rememberRemoteSignature,
    requestSilentWorkspaceRefresh,
    saveRetryCountRef,
    saveRetryPendingRef,
    saveRetryTimerRef,
    saveRetryUidRef,
    scheduleSaveRetryRef,
    scopedStorageKey,
    setCloudSyncStatus,
    setLastSyncedAt,
    setWorkspaceConflict,
    setWorkspaceConflictError,
    settings,
    sharedPendingHideRef,
    sharedProjectedRevisionsRef,
    sharedWorkspaceProjectionRef,
    showNotice,
    transactions,
    trips,
    workspaceConflictRef,
  } = ctx;
  // Build the authenticated workspace payload persisted by the Neon API.
  const buildCloudPayload = (targetId: string) => ({
    uid: targetId,
    ...(effectiveUserEmail ? { email: effectiveUserEmail } : {}),
    ...(effectiveUserDisplayName ? { displayName: effectiveUserDisplayName } : {}),
    updatedAt: new Date().toISOString(),
    ...(sharedWorkspaceProjectionRef.current ? { sharedWorkspaceProjection: true } : {}),
    accountsJson: JSON.stringify(accounts),
    cardsJson: JSON.stringify(cards),
    categoriesJson: JSON.stringify(categories),
    transactionsJson: JSON.stringify(
      compactTransactionListForStorage(
        transactions.filter((transaction) => !transaction.id.startsWith('tx-mirror-'))
      )
    ),
    sharedSettlementReceiptsJson: JSON.stringify(collectSharedSettlementReceipts(transactions)),
    goalsJson: JSON.stringify(goals),
    receivablesJson: JSON.stringify(receivables),
    familyMembersJson: JSON.stringify(familyMembers),
    investmentsJson: JSON.stringify(investments),
    investmentTargetsJson: JSON.stringify(investmentTargets),
    tripsJson: JSON.stringify(trips),
    settingsJson: serializeSettingsWithoutSmtpSecrets(settings),
  });

  const syncSavedFamilyWorkspace = (revision: number, partnerEmails: Iterable<string>) => {
    if (!sharedWorkspaceProjectionRef.current || !currentUser || !navigator.onLine) return;
    const uid = currentUser.uid;
    for (const partnerEmail of new Set(partnerEmails)) {
      const key = `${uid}|${partnerEmail}`;
      const revisions = sharedProjectedRevisionsRef.current;
      const pendingHides = sharedPendingHideRef.current.get(key);
      const previous = revisions.get(key);
      const attemptedAt = Date.now();
      if (previous && previous.revision > revision) continue;
      if (previous && previous.revision >= revision && attemptedAt - previous.attemptedAt < 60_000 && !pendingHides?.size) continue;
      const attempt = { revision, attemptedAt };
      revisions.set(key, attempt);
      const deletedSharedIds = pendingHides ? [...pendingHides] : [];
      void syncNeonSharedTransactions({ partnerEmail, workspaceRevision: revision, deletedSharedIds })
        .then(() => {
          if (pendingHides) for (const id of deletedSharedIds) pendingHides.delete(id);
        })
        .catch((error) => {
          if (revisions.get(key) === attempt) revisions.delete(key);
          if (authenticatedUidRef.current === uid && !(error instanceof NeonWorkspaceError && [403, 409].includes(error.status))) {
            console.warn('Não foi possível sincronizar os compartilhados.', error);
          }
        });
    }
  };

  const syncSavedFamilyMembers = (revision: number) => {
    if (!effectiveUserEmail) return;
    const partners = familyMembers
      .filter((member) => member.inviteStatus === 'accepted')
      .map((member) => (member.email || member.invitedByEmail || '').trim().toLowerCase())
      .filter((email) => email && email !== effectiveUserEmail);
    syncSavedFamilyWorkspace(revision, [...partners, ...(acceptedSharedPartnersRef.current.get(effectiveUserEmail) ?? [])]);
  };

  const queueNeonWorkspaceSave = (payload: Record<string, unknown>) => {
    const authenticatedUser = currentUser;
    if (!authenticatedUser?.email) {
      return Promise.reject(new Error('Entre na sua conta para sincronizar com o Neon.'));
    }

    const queuedSave = neonSaveQueueRef.current.then(async () => {
      if (currentUser?.uid !== authenticatedUser.uid) {
        throw new Error('A conta ativa mudou antes de salvar o workspace.');
      }
      if (workspaceConflictRef.current) {
        throw new NeonWorkspaceError(
          'Resolva o conflito entre esta aba e o Neon antes de sincronizar novamente.',
          409
        );
      }

      let revision = neonWorkspaceRevisionRef.current;
      if (revision === null) {
        try {
          const existing = await loadNeonWorkspace();
          if (authenticatedUidRef.current !== authenticatedUser.uid) {
            throw new Error('A conta ativa mudou durante a leitura do workspace.');
          }
          revision = existing.revision;
          neonWorkspaceRevisionRef.current = revision;
        } catch (error) {
          if (!(error instanceof NeonWorkspaceError) || error.status !== 404) {
            throw error;
          }
          try {
            const created = await createNeonWorkspace(payload);
            if (authenticatedUidRef.current !== authenticatedUser.uid) {
              throw new Error('A conta ativa mudou durante a criação do workspace.');
            }
            neonWorkspaceRevisionRef.current = created.revision;
            lastConfirmedSignatureRef.current = workspaceContentSignature(payload);
            return;
          } catch (importError) {
            if (
              !(importError instanceof NeonWorkspaceError) ||
              importError.status !== 409
            ) {
              throw importError;
            }
            const existing = await loadNeonWorkspace();
            if (authenticatedUidRef.current !== authenticatedUser.uid) {
              throw new Error('A conta ativa mudou durante a leitura do workspace.');
            }
            // O que chegou primeiro ao Neon prevalece: adota a versão da nuvem sem perguntar.
            neonWorkspaceRevisionRef.current = existing.revision;
            requestSilentWorkspaceRefresh();
            throw new NeonWorkspaceError(
              'O workspace Neon foi criado em outra aba durante a inicialização.',
              409
            );
          }
        }
      }

      try {
        rememberRemoteSignature(payload);
        const saved = await saveNeonWorkspace(payload, revision);
        if (authenticatedUidRef.current !== authenticatedUser.uid) {
          throw new Error('A conta ativa mudou durante a gravação do workspace.');
        }
        neonWorkspaceRevisionRef.current = saved.revision;
        lastConfirmedSignatureRef.current = workspaceContentSignature(payload);
      } catch (error) {
        if (error instanceof NeonWorkspaceError && error.status === 409) {
          try {
            const remoteSnapshot = await loadNeonWorkspace();
            if (authenticatedUidRef.current !== authenticatedUser.uid) throw error;
            if (knownRemoteSignaturesRef.current.includes(workspaceContentSignature(remoteSnapshot.payload))) {
              // O Neon tem um conteúdo que esta aba já conhecia (ex.: resposta de um salvamento anterior se perdeu).
              const resaved = await saveNeonWorkspace(payload, remoteSnapshot.revision);
              if (authenticatedUidRef.current !== authenticatedUser.uid) throw error;
              neonWorkspaceRevisionRef.current = resaved.revision;
              lastConfirmedSignatureRef.current = workspaceContentSignature(payload);
              return;
            }
            // Como em um app em tempo real: o que chegou primeiro ao Neon prevalece. Esta aba adota a versão
            // da nuvem; a cópia descartada fica guardada neste aparelho para recuperação.
            try {
              localStorage.setItem(
                `minhas-economias:descartado:${authenticatedUser.uid}`,
                JSON.stringify({ at: new Date().toISOString(), payload })
              );
              localStorage.removeItem(scopedStorageKey);
            } catch {
              // Sem armazenamento local: segue só com a versão da nuvem.
            }
            neonWorkspaceRevisionRef.current = remoteSnapshot.revision;
            requestSilentWorkspaceRefresh();
            return;
          } catch (refreshError) {
            if (authenticatedUidRef.current !== authenticatedUser.uid) throw error;
            console.error(
              'Não foi possível carregar a versão atual do Neon para resolver o conflito.',
              refreshError instanceof Error ? refreshError.message : String(refreshError)
            );
            setWorkspaceConflictError(
              'O Neon recusou a revisão, mas não foi possível carregar a versão mais recente. Suas alterações locais foram mantidas; tente sincronizar novamente quando a conexão voltar.'
            );

          }
          if (authenticatedUidRef.current !== authenticatedUser.uid) throw error;
          setCloudSyncStatus('error');
        }
        throw error;
      }
    });

    neonSaveQueueRef.current = queuedSave.then(
      () => undefined,
      () => undefined
    );
    return queuedSave;
  };

  const cancelSaveRetry = (resetAttempts = false) => {
    if (saveRetryTimerRef.current !== null) {
      window.clearTimeout(saveRetryTimerRef.current);
      saveRetryTimerRef.current = null;
    }
    saveRetryPendingRef.current = false;
    saveRetryUidRef.current = null;
    if (resetAttempts) saveRetryCountRef.current = 0;
  };

  const persistNeonWorkspacePayload = async (
    payload: Record<string, unknown>,
    showResultNotice = false
  ) => {
    latestNeonPayloadRef.current = payload;
    // Nada mudou desde a última versão confirmada no Neon (ex.: acabou de carregar a versão de outro aparelho):
    // não grava de novo, senão dois aparelhos ficariam trocando revisões sem fim.
    if (
      !showResultNotice &&
      lastConfirmedSignatureRef.current !== null &&
      neonWorkspaceRevisionRef.current !== null &&
      lastConfirmedSignatureRef.current === workspaceContentSignature(payload)
    ) {
      setCloudSyncStatus('synced');
      return;
    }
    const activeConflict = workspaceConflictRef.current;
    if (activeConflict) {
      const updatedConflict = updateWorkspaceConflictLocalPayload(activeConflict, payload);
      workspaceConflictRef.current = updatedConflict;
      setWorkspaceConflict(updatedConflict);
    }
    const authenticatedUid = currentUser?.uid;
    setCloudSyncStatus('syncing');
    try {
      await queueNeonWorkspaceSave(payload);
      if (authenticatedUidRef.current !== authenticatedUid) return;
      cancelSaveRetry(true);
      setCloudSyncStatus('synced');
      setLastSyncedAt(
        typeof payload.updatedAt === 'string' ? payload.updatedAt : new Date().toISOString()
      );
      if (showResultNotice) {
        showNotice('Sincronização em nuvem concluída agora!', undefined, true);
      }
    } catch (error) {
      if (authenticatedUidRef.current !== authenticatedUid) return;
      setCloudSyncStatus('error');
      if (error instanceof NeonWorkspaceError && error.status === 401) {
        void expireSessionRef.current();
        return;
      }
      console.error(
        'Falha ao salvar workspace no Neon; alterações locais foram mantidas.',
        error instanceof Error ? error.message : String(error)
      );

      const canRetry =
        isRetryableWorkspaceSaveError(error) &&
        authenticatedUid &&
        !workspaceConflictRef.current;
      if (canRetry) {
        saveRetryPendingRef.current = true;
        saveRetryUidRef.current = authenticatedUid;
        if (saveRetryCountRef.current < 8) {
          const attempt = saveRetryCountRef.current++;
          const delayMs = Math.min(1000 * 2 ** attempt, 30_000);
          scheduleSaveRetryRef.current(delayMs);
        }
      } else {
        cancelSaveRetry();
      }

      if (showResultNotice) {
        showNotice(
          'Não foi possível concluir a sincronização. Seus dados locais foram preservados; tente novamente.',
          undefined,
          true
        );
      }
    }
  };

  scheduleSaveRetryRef.current = (delayMs = 0) => {
    if (saveRetryTimerRef.current !== null) {
      window.clearTimeout(saveRetryTimerRef.current);
    }
    saveRetryTimerRef.current = window.setTimeout(() => {
      saveRetryTimerRef.current = null;
      const latestPayload = latestNeonPayloadRef.current;
      const currentUid = currentUser?.uid;
      if (
        !saveRetryPendingRef.current ||
        !navigator.onLine ||
        !latestPayload ||
        !hasLoadedRemoteOnceRef.current ||
        workspaceConflictRef.current ||
        !currentUid ||
        currentUid !== saveRetryUidRef.current
      ) {
        return;
      }
      saveRetryPendingRef.current = false;
      void persistNeonWorkspacePayload(latestPayload);
    }, delayMs);
  };

  return {
    buildCloudPayload,
    cancelSaveRetry,
    persistNeonWorkspacePayload,
    syncSavedFamilyMembers,
    syncSavedFamilyWorkspace,
  };
}

export type WorkspaceSavingApi = ReturnType<typeof useWorkspaceSaving>;
