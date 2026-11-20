/** Login, leitura e gravação do workspace no Neon (revisão, fila, tempo real, convites) e saída da conta. Parte do App (ver src/App.tsx). */
import type { AppStateApi } from './useAppState';
import { useSessionHelpers } from './workspace-sync/useSessionHelpers';
import { useAuthListener } from './workspace-sync/useAuthListener';
import { useWorkspaceSaving } from './workspace-sync/useWorkspaceSaving';
import { useWorkspaceLoad } from './workspace-sync/useWorkspaceLoad';
import { useWorkspaceEffects } from './workspace-sync/useWorkspaceEffects';
import { useWorkspaceRealtime } from './workspace-sync/useWorkspaceRealtime';
import { useFamilyPolling } from './workspace-sync/useFamilyPolling';
import { useWorkspaceCache } from './workspace-sync/useWorkspaceCache';
import { useAuthActions } from './workspace-sync/useAuthActions';

export function useWorkspaceSync(app: AppStateApi) {
  const sync1 = { ...app, ...useSessionHelpers(app) };
  const sync2 = { ...sync1, ...useAuthListener(sync1) };
  const sync3 = { ...sync2, ...useWorkspaceSaving(sync2) };
  const sync4 = { ...sync3, ...useWorkspaceLoad(sync3) };
  const sync5 = { ...sync4, ...useWorkspaceEffects(sync4) };
  const sync6 = { ...sync5, ...useWorkspaceRealtime(sync5) };
  const sync7 = { ...sync6, ...useFamilyPolling(sync6) };
  const sync8 = { ...sync7, ...useWorkspaceCache(sync7) };
  const sync9 = { ...sync8, ...useAuthActions(sync8) };
  const {
    handleForceCloudSync,
    handleRegisterEmail,
    handleSignInEmail,
    handleSignInPasskey,
    handleSignOut,
    handleUpdateSettings,
    syncSavedFamilyWorkspace,
  } = sync9;

  return {
    handleForceCloudSync,
    handleRegisterEmail,
    handleSignInEmail,
    handleSignInPasskey,
    handleSignOut,
    handleUpdateSettings,
    syncSavedFamilyWorkspace,
  };
}

export type WorkspaceSyncApi = ReturnType<typeof useWorkspaceSync>;
