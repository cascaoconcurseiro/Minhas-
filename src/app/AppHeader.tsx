/** Barra superior: título, mês, busca, sino, tema e conta. Parte da tela do App (ver src/App.tsx). */
import { Bell, ChevronLeft, ChevronRight, Eye, EyeOff, Menu, Plus, Search, Settings, X } from 'lucide-react';
import { MOBILE_TAB_TITLES } from './appConfig';
import { addMonthsToYearMonth, formatMonthYearPT } from '../domain/finance/financeRules';
import type { AppContext } from './appContext';

export function AppHeader({ app }: { app: AppContext }) {
  const {
    activeTab,
    activeTabMeta,
    currentMonth,
    globalSearchInputRef,
    globalSearchQuery,
    handleOpenNewTransaction,
    handleSelectMonth,
    handleUpdateSettings,
    isMobileSearchOpen,
    mobileSearchInputRef,
    noticeCount,
    selectedMonth,
    setGlobalSearchQuery,
    setIsMobileDrawerOpen,
    setIsMobileSearchOpen,
    setIsReminderModalOpen,
    setIsSettingsOpen,
    setSettingsInitialTab,
    settings,
  } = app;
  return (
    <>
{/* Single Unified, Clean Top Header Bar */}
        <header className="sticky top-0 z-30 w-full max-w-full bg-[color:var(--app-canvas)]/90 dark:bg-slate-950/90 backdrop-blur-md px-3.5 sm:px-6 py-2.5 pt-[max(env(safe-area-inset-top),0.625rem)]">
          <div className="mx-auto w-full max-w-7xl flex items-center justify-between gap-2 sm:gap-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-3 sm:px-4 py-2 shadow-sm">
            {/* Zone 1 (Left): Mobile Menu Trigger + Active Page Title */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1 md:flex-none md:shrink-0">
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(true)}
                aria-label="Abrir menu lateral"
                title="Abrir menu de navegação"
                className="lg:hidden inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors shrink-0"
              >
                <Menu className="h-4 w-4" />
              </button>

              <h1
                title={activeTabMeta.title}
                className="min-w-0 text-sm sm:text-base font-bold leading-tight tracking-tight text-slate-900 dark:text-white font-display truncate"
              >
                <span className="sm:hidden">{MOBILE_TAB_TITLES[activeTab] ?? activeTabMeta.title}</span>
                <span className="hidden sm:inline">{activeTabMeta.title}</span>
              </h1>
            </div>

            {/* Zone 2 (Center): Integrated Month Navigator (shown on competence-based tabs) */}
            {['overview', 'transactions', 'accounts', 'cards', 'budgets', 'shared', 'reports'].includes(
              activeTab
            ) && (
              <div className="hidden md:flex items-center justify-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    handleSelectMonth(addMonthsToYearMonth(selectedMonth, -1))
                  }
                  aria-label="Mês anterior"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="min-w-[150px] text-center px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-display tracking-tight">
                    {formatMonthYearPT(selectedMonth)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleSelectMonth(addMonthsToYearMonth(selectedMonth, 1))
                  }
                  aria-label="Próximo mês"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                {selectedMonth !== currentMonth && (
                  <button
                    type="button"
                    onClick={() => handleSelectMonth(currentMonth)}
                    title={`Voltar para o mês atual (${formatMonthYearPT(currentMonth)})`}
                    className="ml-1 inline-flex items-center rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 text-[11px] font-semibold text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors shrink-0"
                  >
                    Mês atual
                  </button>
                )}
              </div>
            )}

            {/* Zone 3 (Right): Compact Search + Essential Utilities + Primary CTA */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
              {/* Compact Expandable Search on Desktop */}
              <div
                data-testid="centered-global-search"
                className="hidden xl:block relative w-44 xl:w-56 focus-within:w-64 transition-all duration-200"
              >
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  ref={globalSearchInputRef}
                  type="text"
                  role="searchbox"
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  aria-label="Busca global por descrição, categoria ou nota"
                  placeholder="Buscar... (/)"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/80 pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-colors"
                />
                {globalSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setGlobalSearchQuery('')}
                    aria-label="Limpar busca global"
                    className="absolute right-2 top-1.5 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Mobile/Tablet Search Trigger */}
              <button
                type="button"
                data-testid="mobile-search-toggle-btn"
                onClick={() => {
                  setIsMobileSearchOpen((prev) => {
                    const next = !prev;
                    if (next) {
                      window.setTimeout(() => mobileSearchInputRef.current?.focus(), 60);
                    }
                    return next;
                  });
                }}
                aria-label="Buscar lançamentos"
                title="Buscar lançamentos"
                className={`xl:hidden rounded-lg border p-1.5 transition-colors ${
                  isMobileSearchOpen || globalSearchQuery
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Search className="h-4 w-4" />
              </button>

              {/* Essential Utilities Only (Privacy, Reminders, Settings, Logout) */}
              <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateSettings({ privacyMode: !settings.privacyMode })
                  }
                  aria-label={
                    settings.privacyMode
                      ? 'Mostrar saldos e valores monetários'
                      : 'Ocultar saldos e valores monetários (Modo Discreto)'
                  }
                  title={
                    settings.privacyMode
                      ? 'Mostrar valores (Modo Discreto ativo)'
                      : 'Ocultar valores R$ (Modo Discreto)'
                  }
                  className={`rounded-md p-1.5 transition-colors ${
                    settings.privacyMode
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {settings.privacyMode ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>

                <button
                  type="button"
                  data-testid="header-reminders-btn"
                  onClick={() => setIsReminderModalOpen(true)}
                  aria-label="Abrir notificações"
                  title={`Notificações: ${noticeCount} ${noticeCount === 1 ? 'aviso' : 'avisos'}`}
                  className={`relative rounded-md p-1.5 transition-colors ${
                    noticeCount > 0
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Bell className="h-4 w-4" />
                  {noticeCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-extrabold text-white shadow-2xs">
                      {noticeCount}
                    </span>
                  )}
                </button>



                <button
                  type="button"
                  onClick={() => {
                    setSettingsInitialTab('appearance');
                    setIsSettingsOpen(true);
                  }}
                  aria-label="Abrir configurações do aplicativo"
                  title="Configurações & Preferências"
                  className="rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>

              {/* Primary Action CTA */}
              <button
                type="button"
                data-testid="new-transaction-btn"
                onClick={() => handleOpenNewTransaction('expense')}
                aria-label="Novo lançamento"
                title="Criar novo lançamento"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 shadow-2xs"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden xl:inline">Novo Lançamento</span>
              </button>
            </div>
          </div>

          {/* Mobile Month Selector Strip (Only visible on small screens < md for competence tabs) */}
          {['overview', 'transactions', 'accounts', 'cards', 'budgets', 'shared', 'reports'].includes(
            activeTab
          ) && (
            <div className="flex md:hidden items-center justify-between gap-2 pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() =>
                  handleSelectMonth(addMonthsToYearMonth(selectedMonth, -1))
                }
                aria-label="Mês anterior"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1.5 text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white font-display">
                  {formatMonthYearPT(selectedMonth)}
                </span>
                {selectedMonth !== currentMonth && (
                  <button
                    type="button"
                    onClick={() => handleSelectMonth(currentMonth)}
                    className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                  >
                    Hoje
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  handleSelectMonth(addMonthsToYearMonth(selectedMonth, 1))
                }
                aria-label="Próximo mês"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1.5 text-slate-600 dark:text-slate-300"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Expandable Mobile/Tablet Search Input */}
          {(isMobileSearchOpen || globalSearchQuery.trim().length > 0) && (
            <div className="lg:hidden pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  ref={mobileSearchInputRef}
                  type="text"
                  role="searchbox"
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  aria-label="Busca global no celular"
                  placeholder="Buscar por descrição, categoria ou valor..."
                  className="w-full rounded-lg border border-emerald-500 bg-slate-50 pl-9 pr-8 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setGlobalSearchQuery('');
                    setIsMobileSearchOpen(false);
                  }}
                  aria-label="Fechar busca"
                  className="absolute right-2.5 top-2 rounded p-0.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </header>
    </>
  );
}
