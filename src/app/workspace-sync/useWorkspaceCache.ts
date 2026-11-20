/** Cópia local somente leitura e gravação do workspace quando o estado muda. Parte de useWorkspaceSync (ver useWorkspaceSync.ts). */
import { useEffect } from 'react';
import { removeSmtpPasswordsFromSettings } from '../../utils/secureSettings';
import type { AppStateApi } from '../useAppState';
import type { WorkspaceSavingApi } from './useWorkspaceSaving';

export function useWorkspaceCache(ctx: AppStateApi & WorkspaceSavingApi) {
  const {
    accounts,
    autoVaultId,
    buildCloudPayload,
    cancelSaveRetry,
    cards,
    categories,
    effectiveUserEmail,
    familyMembers,
    goals,
    hasLoadedRemoteOnceRef,
    investmentTargets,
    investments,
    isApplyingRemoteSnapshotRef,
    isAuthReady,
    persistNeonWorkspacePayload,
    receivables,
    scopedStorageKey,
    settings,
    transactions,
    trips,
  } = ctx;
  // Guarda a última versão neste aparelho (só depois de ler o Neon) e persiste o workspace no Neon.
  useEffect(() => {
    if (!effectiveUserEmail) return;
    if (hasLoadedRemoteOnceRef.current) {
      try {
        localStorage.setItem(
          scopedStorageKey,
          JSON.stringify({
            accounts,
            cards,
            categories,
            transactions,
            goals,
            receivables,
            familyMembers,
            investments,
            investmentTargets,
            trips,
            settings: removeSmtpPasswordsFromSettings(settings),
          })
        );
      } catch {
        // Sem espaço ou sem armazenamento local: o Neon continua sendo a fonte.
      }
    }

    if (
      isAuthReady &&
      hasLoadedRemoteOnceRef.current &&
      !isApplyingRemoteSnapshotRef.current
    ) {
      const docId = autoVaultId;
      cancelSaveRetry(true);
      const timer = setTimeout(() => {
        const payload = buildCloudPayload(docId);
        void persistNeonWorkspacePayload(payload);
      }, 420);
      return () => clearTimeout(timer);
    }
  }, [
    isAuthReady,
    effectiveUserEmail,
    autoVaultId,
    scopedStorageKey,
    accounts,
    cards,
    categories,
    transactions,
    goals,
    receivables,
    familyMembers,
    investments,
    investmentTargets,
    trips,
    settings,
  ]);

  return {

  };
}

export type WorkspaceCacheApi = ReturnType<typeof useWorkspaceCache>;
