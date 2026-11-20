/** Raio-X de saúde financeira e patrimônio. Parte de OverviewTab (ver OverviewTab.tsx). */
import { ChevronDown, ChevronUp, ShieldCheck, TrendingUp } from 'lucide-react';
import { formatBRL } from '../../../domain/finance/financeRules';
import type { OverviewTabContext } from './overviewTabContext';

export function OverviewHealthPanel({ form }: { form: OverviewTabContext }) {
  const {
    health360,
    isHealthDetailsOpen,
    monthlySummary,
    overBudgetItems,
    setIsHealthDetailsOpen,
  } = form;
  return (
    <>
{/* Row 1.5: Raio-X 360º — Score de Saúde Financeira, Patrimônio Consolidado & Livre p/ Gastar Hoje */}
      <section
        aria-label="Raio-X de Saúde Financeira e Patrimônio 360"
        data-testid="overview-financial-health-360"
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs"
      >
        <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Score Badge + Status */}
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div
              className={`flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 flex-col items-center justify-center rounded-xl border font-mono font-extrabold tabular-nums ${
                health360.grade === 'excellent'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : health360.grade === 'good' || health360.grade === 'onboarding'
                  ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                  : health360.grade === 'attention'
                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              }`}
            >
              <span className="text-sm sm:text-base leading-none">{health360.score}</span>
              <span className="text-[9px] font-semibold opacity-75 mt-0.5">/1000</span>
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Índice de Saúde Financeira 360º
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    health360.grade === 'excellent'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : health360.grade === 'good' || health360.grade === 'onboarding'
                      ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                      : health360.grade === 'attention'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  <ShieldCheck className="h-3 w-3" />
                  {health360.gradeLabel}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                {health360.recommendations[0]}
              </p>
            </div>
          </div>

          {/* Center/Right: 3 Executive Wealth & Safe-to-Spend Metrics + Expand Button */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 lg:shrink-0 items-center">
            <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 break-words sm:truncate">
                Patrimônio Líquido
              </p>
              <p
                className={`mt-0.5 text-xs sm:text-sm font-bold font-mono tabular-nums break-words sm:truncate ${
                  health360.netWorth >= 0
                    ? 'text-slate-900 dark:text-white'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {formatBRL(health360.netWorth)}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 break-words sm:truncate">
                Ativos: {formatBRL(health360.investmentsTotal)}
              </p>
            </div>

            <div className="rounded-lg border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 break-words sm:truncate">
                Livre p/ Gastar Hoje
              </p>
              <p className="mt-0.5 text-xs sm:text-sm font-bold font-mono tabular-nums text-emerald-800 dark:text-emerald-300 break-words sm:truncate">
                {formatBRL(health360.safeToSpendPerDay)}
                <span className="text-[10px] font-normal">/dia</span>
              </p>
              <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 break-words sm:truncate">
                Próx. {health360.daysRemainingInMonth} dia(s) do mês
              </p>
            </div>

            <div className="col-span-2 sm:col-span-1 flex items-center justify-between sm:block rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 px-3 py-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 break-words sm:truncate">
                  Autonomia (Reserva)
                </p>
                <p className="mt-0.5 text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white break-words sm:truncate">
                  {health360.runwayMonths} {health360.runwayMonths === 1 ? 'mês' : 'meses'}
                </p>
              </div>
              <button
                type="button"
                data-testid="toggle-health-360-details-btn"
                onClick={() => setIsHealthDetailsOpen((prev) => !prev)}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline max-sm:min-h-10"
              >
                <span>{isHealthDetailsOpen ? 'Ocultar pilares' : 'Ver 4 pilares'}</span>
                {isHealthDetailsOpen ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Expandable 4 Pillars & Actionable Coaching Details */}
        {isHealthDetailsOpen && (
          <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/80 p-4 sm:p-5 space-y-4 animate-expand-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>1. Taxa de Poupança</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    {health360.pillars.savingsScore} / 250
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Poupança projetada: <strong>{monthlySummary.savingsRateProjected}%</strong> da renda (meta ideal: ≥20%).
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>2. Reserva de Liquidez</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    {health360.pillars.liquidityScore} / 250
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Cobertura atual: <strong>{health360.runwayMonths} meses</strong> de despesas (meta ideal: 6 meses).
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>3. Uso do Limite (Cartões)</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    {health360.pillars.creditScore} / 250
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Limite tomado: <strong>{health360.creditUsagePercent}%</strong> ({formatBRL(health360.creditCardDebt)}).
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>4. Disciplina de Metas</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    {health360.pillars.budgetDisciplineScore} / 250
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {overBudgetItems.length === 0
                    ? '100% das categorias dentro do teto mensal.'
                    : `${overBudgetItems.length} categoria(s) acima do teto neste mês.`}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-xs">
              <div className="space-y-1 text-slate-600 dark:text-slate-300">
                {health360.recommendations.length > 1 ? (
                  health360.recommendations.slice(1).map((rec, idx) => (
                    <p key={idx} className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>{rec}</span>
                    </p>
                  ))
                ) : (
                  <p className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Metodologia 360º: Combina Poupança (250), Liquidez D+0 (250), Uso de Crédito ≤30% (250) e Orçamento 50/30/20 (250).
                    </span>
                  </p>
                )}
              </div>

            </div>
          </div>
        )}
      </section>
    </>
  );
}
