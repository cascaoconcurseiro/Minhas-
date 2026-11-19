/** Avisos abaixo da barra: desfazer, permissão de notificação e resultados da busca. Parte da tela do App (ver src/App.tsx). */
import { Bell, CheckCircle2, RotateCcw } from 'lucide-react';
import { DEFAULT_REMINDER_SETTINGS } from '../domain/reminders/reminderRules';
import { Suspense } from 'react';
import { GlobalSearchPanel } from './lazyScreens';
import type { AppContext } from './appContext';

export function AppBanners({ app }: { app: AppContext }) {
  const {
    accounts,
    browserPermissionState,
    cards,
    categories,
    familyMembers,
    globalSearchQuery,
    handleActivateOsNotificationsFromInit,
    handleDismissNotificationInitPrompt,
    handleEditTransaction,
    handleJumpToTransactionInLedger,
    handleToggleTransactionStatus,
    handleUndoLastTransactionChange,
    handleUpdateSettings,
    isMobileSearchOpen,
    selectedMonth,
    setGlobalSearchQuery,
    setToastMessage,
    settings,
    showNotificationInitPrompt,
    toastMessage,
    transactions,
    undoStack,
  } = app;
  return (
    <>
{/* Feedback Banner with 1-Click Undo ("↩ Desfazer Agora") */}
        {toastMessage && (
          <div className="mx-auto max-w-7xl w-full px-3.5 sm:px-6 pt-3 sm:pt-4 animate-expand-in">
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900 shadow-xs"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                {toastMessage}
              </span>
              <div className="flex items-center gap-2 ml-auto">
                {undoStack.length > 0 && (
                  <button
                    type="button"
                    data-testid="toast-undo-btn"
                    onClick={handleUndoLastTransactionChange}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-800 transition-colors shadow-2xs"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Desfazer Agora
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setToastMessage(null);
                  }}
                  className="text-emerald-700 hover:underline ml-2"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Startup OS Notification Permission Initialization Strip */}
        {browserPermissionState === 'default' &&
          showNotificationInitPrompt &&
          (settings.reminders?.enabled ?? true) && (
            <div
              data-testid="os-notification-init-banner"
              className="mx-auto max-w-7xl w-full px-3.5 sm:px-6 pt-3 animate-expand-in"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-2xs">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Alertas Financeiros no Sistema Operacional
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Receba avisos automáticos às{' '}
                      <span className="font-mono font-bold tabular-nums text-slate-800 dark:text-slate-200">
                        {settings.reminders?.preferredTime || '09:00'}
                      </span>{' '}
                      sobre faturas de cartão, boletos vencendo hoje e reembolsos pendentes.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <select
                    aria-label="Horário do alerta diário"
                    data-testid="os-notification-init-time-select"
                    value={settings.reminders?.preferredTime || '09:00'}
                    onChange={(e) =>
                      handleUpdateSettings({
                        reminders: {
                          ...(settings.reminders || DEFAULT_REMINDER_SETTINGS),
                          preferredTime: e.target.value,
                        },
                      })
                    }
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-200 focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="08:00">08:00</option>
                    <option value="09:00">09:00</option>
                    <option value="12:00">12:00</option>
                    <option value="18:00">18:00</option>
                    <option value="20:00">20:00</option>
                  </select>

                  <button
                    type="button"
                    data-testid="os-notification-init-activate-btn"
                    onClick={handleActivateOsNotificationsFromInit}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-2xs whitespace-nowrap"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    Ativar Alertas no Sistema
                  </button>

                  <button
                    type="button"
                    data-testid="os-notification-init-dismiss-btn"
                    onClick={handleDismissNotificationInitPrompt}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    Agora não
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Global Search Instant Results Panel */}
        {(isMobileSearchOpen || globalSearchQuery.trim().length > 0) && (
          <Suspense fallback={null}>
            <GlobalSearchPanel
              query={globalSearchQuery}
              onChangeQuery={setGlobalSearchQuery}
              onClearSearch={() => setGlobalSearchQuery('')}
              selectedMonth={selectedMonth}
              transactions={transactions}
              categories={categories}
              accounts={accounts}
              cards={cards}
              familyMembers={familyMembers}
              onToggleStatus={(id) => handleToggleTransactionStatus(id, 'single')}
              onEditTransaction={handleEditTransaction}
              onJumpToTransactionInLedger={handleJumpToTransactionInLedger}
            />
          </Suspense>
        )}

        {/* Main Content Container */}
    </>
  );
}
