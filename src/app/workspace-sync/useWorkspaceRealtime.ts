/** Tempo real: confere a revisão a cada poucos segundos e atualiza em silêncio. Parte de useWorkspaceSync (ver useWorkspaceSync.ts). */
import { useEffect, useRef } from 'react';
import { NeonWorkspaceError, loadNeonWorkspaceRevision } from '../../lib/neonWorkspace';
import type { AppStateApi } from '../useAppState';
import type { SessionHelpersApi } from './useSessionHelpers';
import type { WorkspaceSavingApi } from './useWorkspaceSaving';

export function useWorkspaceRealtime(ctx: AppStateApi & SessionHelpersApi & WorkspaceSavingApi) {
  const {
    authenticatedUidRef,
    cloudSyncStatus,
    expireSessionRef,
    hasLoadedRemoteOnceRef,
    isAuthReady,
    isUserAuthenticated,
    latestNeonPayloadRef,
    neonSaveQueueRef,
    neonWorkspaceRevisionRef,
    persistNeonWorkspacePayload,
    requestSilentWorkspaceRefresh,
    saveRetryPendingRef,
  } = ctx;
  // Tempo real: a cada poucos segundos (e ao voltar ao app) confere a revisão no Neon e, se outro aparelho
  // gravou, recarrega os dados no lugar, sem recarregar a página. Também reenvia o que ficou sem salvar.
  const cloudSyncStatusRef = useRef(cloudSyncStatus);
  cloudSyncStatusRef.current = cloudSyncStatus;
  useEffect(() => {
    if (!isAuthReady || !isUserAuthenticated) return;
    let checking = false;
    const check = async () => {
      if (document.hidden || checking || !navigator.onLine || !hasLoadedRemoteOnceRef.current) return;
      checking = true;
      const uid = authenticatedUidRef.current;
      try {
        if (cloudSyncStatusRef.current === 'error' && latestNeonPayloadRef.current) {
          void persistNeonWorkspacePayload(latestNeonPayloadRef.current);
          return;
        }
        if (cloudSyncStatusRef.current !== 'synced') return;
        await neonSaveQueueRef.current;
        if (cloudSyncStatusRef.current !== 'synced' || saveRetryPendingRef.current) return;
        const remoteRevision = await loadNeonWorkspaceRevision();
        if (authenticatedUidRef.current !== uid) return;
        const known = neonWorkspaceRevisionRef.current;
        if (remoteRevision === null || known === null || remoteRevision <= known) return;
        if (cloudSyncStatusRef.current !== 'synced' || saveRetryPendingRef.current) return;
        requestSilentWorkspaceRefresh();
      } catch (error) {
        // Sessão recusada: volta ao login; sem rede ou erro passageiro: tenta de novo no próximo ciclo.
        if (error instanceof NeonWorkspaceError && error.status === 401) void expireSessionRef.current();
      } finally {
        checking = false;
      }
    };
    const onVisible = () => void check();
    // Com o app parado (sem toque há mais de 1 min) consulta menos vezes: poupa o servidor e a bateria
    let lastActivityAt = Date.now();
    let idleTicks = 0;
    const markActivity = () => { lastActivityAt = Date.now(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach((name) => document.addEventListener(name, markActivity, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const poll = window.setInterval(() => {
      if (Date.now() - lastActivityAt > 60_000) {
        idleTicks += 1;
        if (idleTicks % 5 !== 0) return;
      } else {
        idleTicks = 0;
      }
      void check();
    }, 4_000);
    return () => {
      ['pointerdown', 'keydown', 'touchstart'].forEach((name) => document.removeEventListener(name, markActivity, true));
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [isAuthReady, isUserAuthenticated]);

  return {

  };
}

export type WorkspaceRealtimeApi = ReturnType<typeof useWorkspaceRealtime>;
