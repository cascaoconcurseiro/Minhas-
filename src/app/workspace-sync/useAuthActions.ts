/** Entrar, criar conta, Face ID, sair e preferências. Parte de useWorkspaceSync (ver useWorkspaceSync.ts). */
import { registerWithEmail, signInWithEmail, signInWithPasskey, signOutUser } from '../../lib/authClient';
import { DEFAULT_SETTINGS, settingsUserNameFallback } from '../appConfig';
import { AppSettings } from '../../types/finance';
import type { AppStateApi } from '../useAppState';
import type { WorkspaceSavingApi } from './useWorkspaceSaving';

export function useAuthActions(ctx: AppStateApi & WorkspaceSavingApi) {
  const {
    autoVaultId,
    buildCloudPayload,
    effectiveUserEmail,
    hasLoadedRemoteOnceRef,
    loadedWorkspaceUidRef,
    persistNeonWorkspacePayload,
    requireWorkspaceWrite,
    resetFinancialStateToCleanZero,
    setAuthSession,
    setSettings,
    showNotice,
  } = ctx;
  const handleForceCloudSync = async () => {
    const docId = autoVaultId;
    await persistNeonWorkspacePayload(buildCloudPayload(docId), true);
  };

  const completeSignIn = (user: Awaited<ReturnType<typeof signInWithEmail>>, cleanEmail: string) => {
    if (cleanEmail !== effectiveUserEmail) {
      resetFinancialStateToCleanZero();
      hasLoadedRemoteOnceRef.current = false;
    }
    const displayName = user.displayName || settingsUserNameFallback(cleanEmail) || cleanEmail.split('@')[0];
    setSettings((prev) => ({ ...prev, userName: displayName }));
    setAuthSession({
      isLoggedIn: true,
      email: cleanEmail,
      displayName,
    });
    showNotice(
      `Bem-vindo de volta, ${displayName}!`,
      undefined,
      true
    );
  };

  const handleSignInEmail = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const user = await signInWithEmail(cleanEmail, pass);
    completeSignIn(user, cleanEmail);
  };

  const handleSignInPasskey = async () => {
    const user = await signInWithPasskey();
    completeSignIn(user, user.email.trim().toLowerCase());
  };

  const handleRegisterEmail = async (name: string, email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || settingsUserNameFallback(cleanEmail) || cleanEmail.split('@')[0];
    await registerWithEmail(cleanName, cleanEmail, pass);
    resetFinancialStateToCleanZero();
    hasLoadedRemoteOnceRef.current = false;
    setSettings((prev) => ({ ...prev, userName: cleanName }));
    setAuthSession({
      isLoggedIn: true,
      email: cleanEmail,
      displayName: cleanName,
    });
    showNotice(`Conta criada para ${cleanEmail}.`, undefined, true);
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch {
      // Ignore
    }
    hasLoadedRemoteOnceRef.current = false;
    loadedWorkspaceUidRef.current = null;
    resetFinancialStateToCleanZero();
    setSettings(DEFAULT_SETTINGS);
    setAuthSession({
      isLoggedIn: false,
      email: '',
      displayName: '',
    });
    showNotice(
      'Você saiu da sua conta. Faça login novamente quando desejar.',
      undefined,
      true
    );
  };

  // O servidor recusou a sessão (expirou ou foi encerrada em outro aparelho): volta ao login em vez de ficar
  // trabalhando sem conseguir salvar.

  const handleUpdateSettings = (partial: Partial<AppSettings>) => {
    if (!requireWorkspaceWrite()) return;
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  return {
    handleForceCloudSync,
    handleRegisterEmail,
    handleSignInEmail,
    handleSignInPasskey,
    handleSignOut,
    handleUpdateSettings,
  };
}

export type AuthActionsApi = ReturnType<typeof useAuthActions>;
