/** Efeitos auxiliares: pré-carregamento de telas e atualizações em segundo plano. Parte de useWorkspaceSync (ver useWorkspaceSync.ts). */
import { useEffect } from 'react';
import type { AppStateApi } from '../useAppState';
import type { WorkspaceSavingApi } from './useWorkspaceSaving';

export function useWorkspaceEffects(ctx: AppStateApi & WorkspaceSavingApi) {
  const {
    cancelSaveRetry,
    currentUser,
    isAuthReady,
    isUserAuthenticated,
    latestNeonPayloadRef,
    saveRetryPendingRef,
    scheduleSaveRetryRef,
    setWorkspaceLoadAttempt,
    workspaceLoadState,
  } = ctx;
  useEffect(() => {
    if (workspaceLoadState !== 'error') return;
    const retryWhenOnline = () => setWorkspaceLoadAttempt((attempt) => attempt + 1);
    window.addEventListener('online', retryWhenOnline);
    return () => window.removeEventListener('online', retryWhenOnline);
  }, [workspaceLoadState]);

  useEffect(() => {
    cancelSaveRetry(true);
    latestNeonPayloadRef.current = null;
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!isAuthReady || !isUserAuthenticated) return;
    const retryAfterReconnect = () => {
      if (saveRetryPendingRef.current) {
        scheduleSaveRetryRef.current(0);
      }
    };
    window.addEventListener('online', retryAfterReconnect);
    return () => window.removeEventListener('online', retryAfterReconnect);
  }, [isAuthReady, isUserAuthenticated]);

  // Depois que o app abriu, baixa em segundo plano as telas e janelas mais usadas (uma por vez, quando o
  // navegador está ocioso), para que o primeiro clique não espere o download nem trave a tela.
  useEffect(() => {
    if (workspaceLoadState !== 'ready') return;
    const loaders: Array<() => Promise<unknown>> = [
      () => import('../../components/transactions/TransactionModal'),
      () => import('../../components/layout/GlobalSearchPanel'),
      () => import('../../components/transactions/TransactionsTab'),
      () => import('../../components/overview/ReminderCenterModal'),
      () => import('../../components/settings/SettingsModal'),
      () => import('../../components/cards/CreditCardsTab'),
      () => import('../../components/accounts/AccountsTab'),
      () => import('../../components/budgets/BudgetsTab'),
      () => import('../../components/family/SharedExpensesTab'),
      () => import('../../components/trips/TripsTab'),
      () => import('../../components/budgets/GoalsAndSimulatorTab'),
      () => import('../../components/investments/InvestmentsTab'),
    ];
    let cancelled = false;
    let index = 0;
    const idle = (callback: () => void) => {
      const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
      if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(callback, { timeout: 4000 });
      else window.setTimeout(callback, 800);
    };
    const next = () => {
      if (cancelled || index >= loaders.length) return;
      const load = loaders[index++];
      void load().catch(() => undefined).finally(() => idle(next));
    };
    // O formulário de lançamento é o mais usado: começa a baixar já; o resto espera o navegador ficar ocioso
    const start = window.setTimeout(() => next(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
    };
  }, [workspaceLoadState]);

  // Ao encostar/tocar no botão de novo lançamento, garante o formulário já carregado antes do clique terminar
  useEffect(() => {
    const preload = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest?.('[data-testid="new-transaction-btn"], [aria-label="Novo lançamento"]')) {
        void import('../../components/transactions/TransactionModal').catch(() => undefined);
      }
    };
    document.addEventListener('pointerover', preload, true);
    document.addEventListener('touchstart', preload, { capture: true, passive: true });
    document.addEventListener('pointerdown', preload, true);
    return () => {
      document.removeEventListener('pointerover', preload, true);
      document.removeEventListener('touchstart', preload, true);
      document.removeEventListener('pointerdown', preload, true);
    };
  }, []);

  return {

  };
}

export type WorkspaceEffectsApi = ReturnType<typeof useWorkspaceEffects>;
