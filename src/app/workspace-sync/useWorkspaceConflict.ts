/** Conflito de versões: manter esta aba ou carregar a do Neon. Parte de useWorkspaceSync (ver useWorkspaceSync.ts). */
import { NeonWorkspaceError, loadNeonWorkspace, saveNeonWorkspace } from '../../lib/neonWorkspace';
import type { AppStateApi } from '../useAppState';

export function useWorkspaceConflict(ctx: AppStateApi) {
  const {
    authenticatedUidRef,
    isResolvingWorkspaceConflict,
    neonSaveQueueRef,
    neonWorkspaceRevisionRef,
    setCloudSyncStatus,
    setIsResolvingWorkspaceConflict,
    setIsWorkspaceConflictOpen,
    setLastSyncedAt,
    setWorkspaceConflict,
    setWorkspaceConflictError,
    workspaceConflictRef,
  } = ctx;
  const handleKeepLocalWorkspaceVersion = async () => {
    const conflict = workspaceConflictRef.current;
    const ownerUid = authenticatedUidRef.current;
    if (!conflict || !ownerUid || isResolvingWorkspaceConflict) return;

    setIsResolvingWorkspaceConflict(true);
    setWorkspaceConflictError(null);
    setCloudSyncStatus('syncing');
    const save = neonSaveQueueRef.current.then(async () => {
      if (authenticatedUidRef.current !== ownerUid) {
        throw new Error('A conta ativa mudou durante a resolução do conflito.');
      }
      const latestConflict = workspaceConflictRef.current;
      if (!latestConflict) return null;
      const saved = await saveNeonWorkspace(
        latestConflict.localPayload,
        latestConflict.remoteSnapshot.revision
      );
      if (authenticatedUidRef.current !== ownerUid) {
        throw new Error('A conta ativa mudou durante a gravação do conflito.');
      }
      neonWorkspaceRevisionRef.current = saved.revision;
      return latestConflict;
    });
    neonSaveQueueRef.current = save.then(
      () => undefined,
      () => undefined
    );

    try {
      const resolvedConflict = await save;
      if (authenticatedUidRef.current !== ownerUid) return;
      if (!resolvedConflict) return;

      setCloudSyncStatus('synced');
      setLastSyncedAt(
        typeof resolvedConflict.localPayload.updatedAt === 'string'
          ? resolvedConflict.localPayload.updatedAt
          : new Date().toISOString()
      );
      workspaceConflictRef.current = null;
      setWorkspaceConflict(null);
      setIsWorkspaceConflictOpen(false);
    } catch (error) {
      if (authenticatedUidRef.current !== ownerUid) return;
      if (error instanceof NeonWorkspaceError && error.status === 409) {
        try {
          const latest = await loadNeonWorkspace();
          if (authenticatedUidRef.current !== ownerUid) return;
          const updatedConflict = {
            ...conflict,
            remoteSnapshot: latest,
          };
          workspaceConflictRef.current = updatedConflict;
          setWorkspaceConflict(updatedConflict);
          setWorkspaceConflictError(
            'O Neon mudou novamente antes de salvar. Baixe uma nova cópia das duas versões e escolha novamente.'
          );
        } catch {
          if (authenticatedUidRef.current !== ownerUid) return;
          setWorkspaceConflictError(
            'O Neon mudou novamente e a versão mais recente não pôde ser carregada. Suas duas versões continuam preservadas; verifique a conexão e tente outra vez.'
          );
        }
      } else {
        setWorkspaceConflictError(
          error instanceof Error
            ? error.message
            : 'Não foi possível salvar sua versão. As alterações locais foram mantidas.'
        );
      }
      setCloudSyncStatus('error');
    } finally {
      if (authenticatedUidRef.current === ownerUid) setIsResolvingWorkspaceConflict(false);
    }
  };

  const handleUseCloudWorkspaceVersion = () => {
    if (!workspaceConflictRef.current || isResolvingWorkspaceConflict) return;
    workspaceConflictRef.current = null;
    setWorkspaceConflict(null);
    setIsWorkspaceConflictOpen(false);
    setCloudSyncStatus('syncing');
    window.location.reload();
  };

  return {
    handleKeepLocalWorkspaceVersion,
    handleUseCloudWorkspaceVersion,
  };
}

export type WorkspaceConflictApi = ReturnType<typeof useWorkspaceConflict>;
