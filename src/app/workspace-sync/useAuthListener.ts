/** Escuta o login: troca de conta limpa o estado e carrega o workspace. Parte de useWorkspaceSync (ver useWorkspaceSync.ts). */
import { useEffect } from 'react';
import { auth, getVaultIdForUid, onAuthStateChanged } from '../../lib/authClient';
import { clearWorkspaceCacheForVault, shouldResetWorkspaceForAuthChange } from '../../services/workspace/workspaceSession';
import { DEFAULT_SETTINGS, STORAGE_KEY, settingsUserNameFallback } from '../appConfig';
import type { AppStateApi } from '../useAppState';

export function useAuthListener(ctx: AppStateApi) {
  const {
    authenticatedUidRef,
    hasLoadedRemoteOnceRef,
    loadedWorkspaceUidRef,
    neonWorkspaceRevisionRef,
    resetFinancialStateToCleanZero,
    setAuthSession,
    setCloudSyncStatus,
    setCurrentUser,
    setIsAuthReady,
    setIsShowingCachedWorkspace,
    setSettings,
    setWorkspaceLoadState,
  } = ctx;
  // Auth session listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const previousUid = authenticatedUidRef.current;
      const nextUid = user && !user.isAnonymous && user.email ? user.uid : null;
      if (shouldResetWorkspaceForAuthChange(previousUid, nextUid)) {
        if (previousUid) {
          clearWorkspaceCacheForVault(localStorage, STORAGE_KEY, getVaultIdForUid(previousUid));
          try {
            // Cópia descartada por conflito e avisos dispensados também saem do aparelho ao encerrar a sessão
            localStorage.removeItem(`minhas-economias:descartado:${previousUid}`);
            localStorage.removeItem('minhas-economias:dismissed-notices');
          } catch { /* sem armazenamento local */ }
        }
        resetFinancialStateToCleanZero();
        setSettings(DEFAULT_SETTINGS);
        hasLoadedRemoteOnceRef.current = false;
        loadedWorkspaceUidRef.current = null;
        setWorkspaceLoadState(nextUid ? 'loading' : 'error');
        setIsShowingCachedWorkspace(false);
        setCloudSyncStatus(nextUid ? 'syncing' : 'local');
      }
      authenticatedUidRef.current = nextUid;
      setCurrentUser(user);
      setIsAuthReady(true);
      neonWorkspaceRevisionRef.current = null;
      hasLoadedRemoteOnceRef.current = false;
      setAuthSession(
        user && !user.isAnonymous && user.email
          ? {
              isLoggedIn: true,
              email: user.email.trim().toLowerCase(),
              displayName: user.displayName || settingsUserNameFallback(user.email) || user.email,
            }
          : { isLoggedIn: false, email: '', displayName: '' }
      );
    });
    return () => unsubscribe();
  }, []);

  return {

  };
}

export type AuthListenerApi = ReturnType<typeof useAuthListener>;
