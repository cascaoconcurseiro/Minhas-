/** Alertas de orçamento e previsão de caixa. Parte de OverviewTab (ver OverviewTab.tsx). */
import { AlertTriangle, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { CategoryIconBadge } from '../../ui/CategoryIconBadge';
import { formatBRL } from '../../../domain/finance/financeRules';
import { calculateMonthBurnRateMarker } from '../../../domain/budgets/uxEnhancementRules';
import type { OverviewTabContext } from './overviewTabContext';

export function OverviewBudgetAlerts({ form }: { form: OverviewTabContext }) {
  const {
    budgetAlerts,
    isAlertsExpanded,
    onNavigateTab,
    overBudgetItems,
    selectedMonth,
    setIsAlertsExpanded,
    showOverviewAlerts,
    warningBudgetItems,
  } = form;
  return (
    <>
{/* Structured Budget Alerts Center (Individual Scannable Cards) */}
      {showOverviewAlerts && budgetAlerts.length > 0 && (
        <section
          aria-label="Alertas de orçamento do mês"
          data-testid="overview-budget-alerts"
          className="min-w-0 max-w-full rounded-xl border border-slate-200 bg-white overflow-hidden"
        >
          {/* Alert Header Bar: Desktop Layout */}
          <div className="hidden sm:flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  overBudgetItems.length > 0
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">
                    Acompanhamento de Limites do Orçamento
                  </h2>
                  <span className="text-xs text-slate-500">
                    {overBudgetItems.length > 0 && (
                      <strong className="text-rose-700 font-semibold">
                        {overBudgetItems.length} acima do teto
                      </strong>
                    )}
                    {overBudgetItems.length > 0 && warningBudgetItems.length > 0 && (
                      <span aria-hidden="true"> · </span>
                    )}
                    {warningBudgetItems.length > 0 && (
                      <strong className="text-amber-700 font-semibold">
                        {warningBudgetItems.length} próxima(s) do limite
                      </strong>
                    )}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visualização detalhada por categoria para controle rápido do seu teto mensal
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsAlertsExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                <span>
                  {isAlertsExpanded
                    ? 'Recolher cartões'
                    : `Ver ${budgetAlerts.length} alertas`}
                </span>
                {isAlertsExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('budgets')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-600" />
                Revisar Orçamentos & Categorias
              </button>
            </div>
          </div>

          {/* Alert Header Bar: Mobile Streamlined Layout (No bulky fixed buttons) */}
          <div className="flex sm:hidden items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  overBudgetItems.length > 0
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-slate-900 break-words sm:truncate">Limites do Orçamento</h2>
                <p className="text-[11px] text-slate-500 break-words sm:truncate">
                  {overBudgetItems.length > 0 ? (
                    <span className="text-rose-700 font-semibold">{overBudgetItems.length} acima do teto</span>
                  ) : (
                    <span className="text-amber-700 font-semibold">{warningBudgetItems.length} em alerta</span>
                  )}
                  <span> · {budgetAlerts.length} metas</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('budgets')}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 transition-colors shrink-0"
            >
              <span>Ajustar</span>
              <SlidersHorizontal className="h-3 w-3 text-emerald-600" />
            </button>
          </div>

          {/* Mobile Lateral Swipe Hint Bar */}
          <div className="flex sm:hidden items-center justify-between px-4 py-1.5 bg-slate-100/70 text-[10px] text-slate-500 font-medium border-b border-slate-100">
            <span className="flex items-center gap-1 break-words sm:truncate">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              ← Deslize lateralmente para ver todas →
            </span>
            <span className="font-mono tabular-nums shrink-0">{budgetAlerts.length} alertas</span>
          </div>

          {/* Lateral Swipeable Strip on Mobile / Clean Grid on Desktop */}
          {isAlertsExpanded && (
            <div className="swipe-x w-full p-3.5 sm:p-5 flex sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 snap-x snap-mandatory no-scrollbar animate-expand-in">
              {budgetAlerts.map((alert) => {
                const isOver = alert.status === 'over';
                const diffAmount = Math.abs(alert.budget - alert.spent);
                return (
                  <div
                    key={alert.categoryId}
                    onClick={() => onNavigateTab('budgets')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigateTab('budgets');
                      }
                    }}
                    className={`group cursor-pointer rounded-xl border p-3.5 transition-all hover:shadow-xs flex flex-col justify-between gap-2.5 w-[76vw] max-w-[280px] sm:w-auto shrink-0 snap-start ${
                      isOver
                        ? 'border-rose-200 bg-rose-50/60 hover:border-rose-300'
                        : 'border-amber-200 bg-amber-50/60 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CategoryIconBadge
                          icon={alert.categoryIcon}
                          color={alert.categoryColor}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 break-words sm:truncate">
                            {alert.categoryName}
                          </p>
                          <p
                            className={`text-[11px] font-semibold ${
                              isOver ? 'text-rose-700' : 'text-amber-800'
                            }`}
                          >
                            {isOver
                              ? `Excedido +${formatBRL(diffAmount)}`
                              : `Restam ${formatBRL(diffAmount)}`}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-bold font-mono tabular-nums shrink-0 ${
                          isOver ? 'text-rose-700' : 'text-amber-800'
                        }`}
                      >
                        {alert.percentOfBudget}%
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {(() => {
                        const burnRate = calculateMonthBurnRateMarker(
                          selectedMonth,
                          alert.percentOfBudget
                        );
                        return (
                          <>
                            <div className="relative h-1.5 w-full rounded-full bg-slate-200/80">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isOver ? 'bg-rose-600' : 'bg-amber-500'
                                }`}
                                style={{
                                  width: `${Math.min(100, alert.percentOfBudget)}%`,
                                }}
                              />
                              <div
                                data-testid="overview-burn-rate-marker"
                                title={`Ritmo do mês (${burnRate.monthProgressPercent}% decorrido)`}
                                className="pointer-events-none absolute -top-0.5 -bottom-0.5 w-0.5 bg-slate-900/75 rounded-full"
                                style={{ left: `${burnRate.monthProgressPercent}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600">
                              <span>
                                Gasto: <strong className="text-slate-900">{formatBRL(alert.spent)}</strong>
                              </span>
                              <span>Meta: {formatBRL(alert.budget)}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </>
  );
}
