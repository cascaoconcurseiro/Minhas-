/** Login, leitura e gravação do workspace no Neon (revisão, fila, conflito, tempo real, convites) e saída da conta. Parte do App (ver src/App.tsx). */
import type { AppStateApi } from './useAppState';
import { useSessionHelpers } from './workspace-sync/useSessionHelpers';
import { useAuthListener } from './workspace-sync/useAuthListener';
import { useWorkspaceSaving } from './workspace-sync/useWorkspaceSaving';
import { useWorkspaceConflict } from './workspace-sync/useWorkspaceConflict';
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
  const sync4 = { ...sync3, ...useWorkspaceConflict(sync3) };
  const sync5 = { ...sync4, ...useWorkspaceLoad(sync4) };
  const sync6 = { ...sync5, ...useWorkspaceEffects(sync5) };
  const sync7 = { ...sync6, ...useWorkspaceRealtime(sync6) };
  const sync8 = { ...sync7, ...useFamilyPolling(sync7) };
  const sync9 = { ...sync8, ...useWorkspaceCache(sync8) };
  const sync10 = { ...sync9, ...useAuthActions(sync9) };
  const {
    handleForceCloudSync,
    handleKeepLocalWorkspaceVersion,
    handleRegisterEmail,
    handleSignInEmail,
    handleSignInPasskey,
    handleSignOut,
    handleUpdateSettings,
    handleUseCloudWorkspaceVersion,
    syncSavedFamilyWorkspace,
  } = sync10;

  return {
    handleForceCloudSync,
    handleKeepLocalWorkspaceVersion,
    handleRegisterEmail,
    handleSignInEmail,
    handleSignInPasskey,
    handleSignOut,
    handleUpdateSettings,
    handleUseCloudWorkspaceVersion,
    syncSavedFamilyWorkspace,
  };
}

export type WorkspaceSyncApi = ReturnType<typeof useWorkspaceSync>;
