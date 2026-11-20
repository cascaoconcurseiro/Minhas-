import { Suspense } from 'react';
import { SidebarNav } from './components/layout/SidebarNav';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { LoginPage } from './app/lazyScreens';
import { useAppState } from './app/useAppState';
import { useWorkspaceSync } from './app/useWorkspaceSync';
import { useReceivables } from './app/useReceivables';
import { useFinancialSnapshot } from './app/useFinancialSnapshot';
import { useSharedSync } from './app/useSharedSync';
import { useTransactionActions } from './app/useTransactionActions';
import { useCardActions } from './app/useCardActions';
import { useTripActions } from './app/useTripActions';
import { useCategoryAndGoalActions } from './app/useCategoryAndGoalActions';
import { useFamilyActions } from './app/useFamilyActions';
import { useAccountAndInvestmentActions } from './app/useAccountAndInvestmentActions';
import { useImportAndBackupActions } from './app/useImportAndBackupActions';
import { useNoticesAndInsights } from './app/useNoticesAndInsights';
import { useOsNotifications } from './app/useOsNotifications';

import type { AppContext } from './app/appContext';
import { AppBanners } from './app/AppBanners';
import { AppHeader } from './app/AppHeader';
import { AppModals } from './app/AppModals';
import { AppTabContent } from './app/AppTabContent';

export type { ActiveTab } from './app/appConfig';

/**
 * Raiz do aplicativo. O estado e as ações ficam em hooks por área (pasta src/app/), chamados sempre na
 * mesma ordem; cada hook recebe tudo o que os anteriores devolveram.
 */
export default function App() {
  const app1 = useAppState();
  const app2 = { ...app1, ...useWorkspaceSync(app1) };
  const app3 = { ...app2, ...useReceivables(app2) };
  const app4 = { ...app3, ...useFinancialSnapshot(app3) };
  const app5 = { ...app4, ...useSharedSync(app4) };
  const app6 = { ...app5, ...useTransactionActions(app5) };
  const app7 = { ...app6, ...useCardActions(app6) };
  const app8 = { ...app7, ...useTripActions(app7) };
  const app9 = { ...app8, ...useCategoryAndGoalActions(app8) };
  const app10 = { ...app9, ...useFamilyActions(app9) };
  const app11 = { ...app10, ...useAccountAndInvestmentActions(app10) };
  const app12 = { ...app11, ...useImportAndBackupActions(app11) };
  const app13 = { ...app12, ...useNoticesAndInsights(app12) };
  const app14 = { ...app13, ...useOsNotifications(app13) };
  const app: AppContext = app14;
  const {
    accountsTotalBalance,
    activeTab,
    activeTripsCount,
    budgetAlertsCount,
    cloudSyncStatus,
    effectiveUserEmail,
    financialIntegrity,
    handleOpenNewTransaction,
    handleRegisterEmail,
    handleSelectTab,
    handleSignInEmail,
    handleSignInPasskey,
    handleSignOut,
    investmentsTotalValue,
    isAuthReady,
    isMobileDrawerOpen,
    isShowingCachedWorkspace,
    isSidebarCollapsed,
    isUserAuthenticated,
    isWorkspaceReadyForCurrentUser,
    noticeCount,
    pendingSharedCount,
    pendingTransactionsCount,
    receivablesSummary,
    setIsMobileDrawerOpen,
    setIsReminderModalOpen,
    setIsSettingsOpen,
    setIsSidebarCollapsed,
    setSettingsInitialTab,
    setWorkspaceLoadAttempt,
    settings,
    workspaceLoadState,
  } = app14;

  if (!isAuthReady || !isUserAuthenticated) {
    return (
      <div
        className={`min-h-screen w-full max-w-full overflow-x-hidden flex flex-col bg-[var(--app-canvas)] text-slate-900 transition-colors duration-200 ${
          settings.theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : ''
        }`}
      >
        <Suspense fallback={<div role="status" className="grid min-h-screen place-items-center">Carregando acesso...</div>}>
          <LoginPage
            defaultEmail=""
            defaultName=""
            onSignInEmail={handleSignInEmail}
            onRegisterEmail={handleRegisterEmail}
            onSignInPasskey={handleSignInPasskey}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen w-full max-w-full overflow-x-clip flex bg-[var(--app-canvas)] text-slate-900 transition-colors duration-200 ${
        settings.theme === 'dark' ? 'dark' : ''
      } ${settings.privacyMode ? 'privacy-mode' : ''} ${
        settings.density === 'compact' ? 'density-compact' : ''
      }`}
    >
      {isAuthReady && isUserAuthenticated && effectiveUserEmail && !isWorkspaceReadyForCurrentUser &&
        workspaceLoadState === 'loading' && !isShowingCachedWorkspace && (
        // Primeira abertura neste aparelho: indicador discreto, sem mensagem técnica.
        <div
          role="status"
          aria-label="Abrindo"
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-50 dark:bg-slate-950"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-600 border-r-transparent" />
        </div>
      )}
      {isAuthReady && isUserAuthenticated && effectiveUserEmail && !isWorkspaceReadyForCurrentUser &&
        workspaceLoadState === 'error' && isShowingCachedWorkspace && (
        // Já há uma versão salva na tela: avisa sem bloquear, só porque não dá para gravar até o Neon voltar.
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-3 z-[100] w-[min(92vw,34rem)] -translate-x-1/2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 shadow-lg dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Sem conexão com a nuvem. A última versão salva está disponível para consulta.</span>
            <button
              type="button"
              onClick={() => setWorkspaceLoadAttempt((attempt) => attempt + 1)}
              className="min-h-10 rounded-lg bg-amber-800 px-3 py-1.5 font-semibold text-white hover:bg-amber-900"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}
      {isAuthReady && isUserAuthenticated && effectiveUserEmail && !isWorkspaceReadyForCurrentUser &&
        workspaceLoadState === 'error' && !isShowingCachedWorkspace && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="workspace-load-title"
          aria-describedby="workspace-load-description"
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-4"
        >
          <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div aria-hidden="true" className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full bg-rose-100 text-xl font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">!</div>
            <h1 id="workspace-load-title" className="text-lg font-bold text-slate-900 dark:text-white">
              Não foi possível carregar seus dados
            </h1>
            <p id="workspace-load-description" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Não vamos abrir um workspace vazio nem gravar dados antes de carregar o Neon. Verifique a conexão e tente novamente.
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => setWorkspaceLoadAttempt((attempt) => attempt + 1)}
              className="mt-5 min-h-11 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Tentar novamente
            </button>
          </section>
        </div>
      )}
      <div
        className="contents"
        // Com a cópia salva já na tela o app responde ao toque/clique na hora (antes ficava "congelado" até o Neon
        // responder); só trava quando não há nada para mostrar.
        inert={Boolean(
          isAuthReady && isUserAuthenticated && effectiveUserEmail && !isWorkspaceReadyForCurrentUser && !isShowingCachedWorkspace
        )}
      >
      {financialIntegrity && !financialIntegrity.isAllHealthy && (
        <div role="status" className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
          <span>Alguns lançamentos precisam de revisão. Confira os dados antes de continuar.</span>
          <button type="button" className="font-semibold underline" onClick={() => handleSelectTab('transactions')}>Conferir lançamentos</button>
        </div>
      )}

      {/* Collapsible Left Sidebar Navigation */}
      <SidebarNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileDrawerOpen={isMobileDrawerOpen}
        onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
        onOpenNewTransaction={handleOpenNewTransaction}
        onOpenSettings={() => {
          setSettingsInitialTab('appearance');
          setIsSettingsOpen(true);
        }}
        onOpenReminders={() => setIsReminderModalOpen(true)}
        urgentRemindersCount={noticeCount}
        pendingTransactionsCount={pendingTransactionsCount}
        budgetAlertsCount={budgetAlertsCount}
        pendingSharedCount={pendingSharedCount}
        receivablesOpenCount={receivablesSummary.openCount}
        activeTripsCount={activeTripsCount}
        accountsTotalBalance={accountsTotalBalance}
        investmentsTotalValue={investmentsTotalValue}
        cloudUserEmail={effectiveUserEmail}
        cloudSyncStatus={cloudSyncStatus}
        onSignOut={handleSignOut}
      />

      {/* Right Workspace Column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <AppHeader app={app} />

        <AppBanners app={app} />
        <AppTabContent app={app} />

        {/* Quiet Footer */}
        <footer className="hidden sm:block border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 mt-12">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Minhas Economias BR — Controle Financeiro Pessoal & Segurança na Nuvem
            </span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => handleSelectTab('reports')}
                className="hover:text-slate-900 dark:hover:text-white hover:underline transition-colors"
              >
                Backup & Exportação CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsInitialTab('profile');
                  setIsSettingsOpen(true);
                }}
                className="hover:text-slate-900 dark:hover:text-white hover:underline transition-colors"
              >
                Preferências & Perfil
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Native Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenNewTransaction={(mode) => handleOpenNewTransaction(mode)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        userEmail={effectiveUserEmail}
        onSignOut={handleSignOut}
      />

      <AppModals app={app} />
      </div>
    </div>
  );
}
