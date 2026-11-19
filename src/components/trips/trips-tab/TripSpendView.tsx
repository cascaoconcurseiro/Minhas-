/** Subtela Gastos: ritmo diário, categorias e lista de despesas. Parte de TripsTab (ver TripsTab.tsx). */
import { CURRENCY_REGIME_DEFAULTS, formatExchangeRateBR, formatForeignCurrency } from '../../../domain/trips/travelRules';
import { formatBRL, formatShortDateBR } from '../../../domain/finance/financeRules';
import { TripSavingsChart } from '../TripSavingsChart';
import { Plus, Trash2 } from 'lucide-react';
import type { TripPageContext } from './tripsTabContext';

export function TripSpendView({ form }: { form: TripPageContext }) {
  const {
    activeSubView,
    activeTrip,
    chartMode,
    chartPeriodMode,
    currencyMeta,
    handleExportPdfReport,
    isChartLoading,
    maskValue,
    onDeleteTransaction,
    onEditTransaction,
    onOpenNewTripExpense,
    privacyMode,
    setChartMode,
    setChartPeriodMode,
    summary,
    tripTransactions,
  } = form;
  return (
    <>
{/* SUB-VIEW 1: TRAVELSPEND DAILY PACE, CATEGORIES & EXPENSE LIST */}
      {activeSubView === 'overview_spend' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Daily Spend Bar Chart */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                    Gastos Dia a Dia na Viagem ({activeTrip.currency})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Acompanhe picos diários em moeda estrangeira e equivalência em Reais
                  </p>
                </div>
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 self-start">
                  <button
                    type="button"
                    onClick={() => setChartMode('my_share')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      chartMode === 'my_share'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    Minha Parte
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode('group_total')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      chartMode === 'group_total'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    Total do Grupo
                  </button>
                </div>
              </div>

              <div className="flex items-end gap-2 h-44 pt-6 pb-2 overflow-x-auto custom-scrollbar">
                {summary.dailySeries.map((pt) => {
                  const valForeign =
                    chartMode === 'my_share'
                      ? pt.mySpendForeign
                      : pt.groupSpendForeign;
                  const valBrl =
                    chartMode === 'my_share' ? pt.mySpendBrl : pt.groupSpendBrl;
                  const maxVal = Math.max(
                    1,
                    ...summary.dailySeries.map((d) =>
                      chartMode === 'my_share'
                        ? d.mySpendForeign
                        : d.groupSpendForeign
                    )
                  );
                  const heightPct =
                    valForeign > 0
                      ? Math.max(12, Math.round((valForeign / maxVal) * 100))
                      : 4;

                  return (
                    <div
                      key={pt.date}
                      className="flex flex-col items-center justify-end h-full min-w-[46px] flex-1 group"
                    >
                      <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {valForeign > 0
                          ? `${currencyMeta.symbol}${Math.round(valForeign)}`
                          : '—'}
                      </span>
                      <div className="w-full max-w-[34px] bg-slate-100 dark:bg-slate-800 rounded-t-lg h-28 flex items-end overflow-hidden">
                        <div
                          className={`w-full rounded-t-lg transition-all ${
                            valForeign > 0
                              ? chartMode === 'my_share'
                                ? 'bg-emerald-500 group-hover:bg-emerald-600'
                                : 'bg-sky-500 group-hover:bg-sky-600'
                              : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                          style={{ height: `${heightPct}%` }}
                          title={`${pt.dayLabel}: ${formatForeignCurrency(
                            valForeign,
                            activeTrip.currency
                          )} (${formatBRL(valBrl)})`}
                        />
                      </div>
                      <span className="mt-1.5 text-[10px] font-semibold text-slate-500">
                        {pt.dayLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category Breakdown in Trip */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                Gastos por Categoria
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Sua parte acumulada por tipo de despesa
              </p>

              {summary.categoryBreakdown.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">
                  Nenhuma despesa registrada nesta viagem ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {summary.categoryBreakdown.map((cat) => (
                    <div key={cat.categoryId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 break-words sm:truncate">
                          {cat.categoryName}
                        </span>
                        <div className="text-right font-mono tabular-nums">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formatForeignCurrency(
                              cat.mySpendForeign,
                              activeTrip.currency
                            )}
                          </span>
                          <span className="text-[11px] text-slate-400 ml-1.5">
                            ({formatBRL(cat.mySpendBrl)})
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(6, cat.percentOfMySpend))}%`,
                            backgroundColor: cat.categoryColor,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Exchange Savings Bar Chart with Zoom, Period Selector and Tooltips */}
          <TripSavingsChart
            exchangeLots={activeTrip.exchangeLots}
            currency={activeTrip.currency}
            fallbackBenchmarkRate={activeTrip.defaultExchangeRate}
            privacyMode={privacyMode}
            isLoading={isChartLoading}
            periodMode={chartPeriodMode}
            onPeriodModeChange={setChartPeriodMode}
            onExportPdfReport={handleExportPdfReport}
          />

          {/* Multi-Currency Trip Expenses Feed */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                  Extrato Multi-Moeda da Viagem ({tripTransactions.length} lançamentos)
                </h3>
                <p className="text-xs text-slate-500">
                  Mostra o valor em moeda estrangeira e a conversão efetiva em Reais (BRL), regime cambial e a sua parte real
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenNewTripExpense(activeTrip.id)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors self-start"
              >
                <Plus className="h-3.5 w-3.5" />
                Nova Despesa na Viagem
              </button>
            </div>

            {tripTransactions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center">
                <p className="text-xs text-slate-500">
                  Nenhum gasto vinculado a esta viagem. Clique em &ldquo;Nova Despesa na Viagem&rdquo; para lançar em {activeTrip.currency} ou R$.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {tripTransactions.map((tx) => {
                  const payer =
                    activeTrip.participants.find(
                      (p) => p.id === (tx.paidByParticipantId || 'me')
                    ) || activeTrip.participants[0];
                  const txCurr = tx.originalCurrency || activeTrip.currency;
                  const txForeign = tx.originalAmount || tx.amount;
                  const myShareForeign =
                    tx.myPersonalShareForeign ??
                    tx.tripShares?.find((s) => s.participantId === 'me')
                      ?.foreignShare ??
                    txForeign;
                  const myShareBrl =
                    tx.myPersonalShareBrl ??
                    tx.tripShares?.find((s) => s.participantId === 'me')
                      ?.brlShare ??
                    tx.amount;
                  const regimeInfo = tx.currencyRegime
                    ? CURRENCY_REGIME_DEFAULTS[tx.currencyRegime]
                    : null;

                  return (
                    <div
                      key={tx.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 hover:border-slate-300 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-white break-words sm:truncate">
                            {tx.description}
                          </span>
                          <span className="rounded-md bg-slate-200/80 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                            {formatShortDateBR(tx.date)}
                          </span>
                          {regimeInfo && (
                            <span className="rounded-md bg-sky-50 dark:bg-sky-950/60 border border-sky-200/60 dark:border-sky-800 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                              {regimeInfo.shortLabel}
                            </span>
                          )}
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              payer?.isMe
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            Pago por: {payer?.name || 'Você'}
                          </span>
                        </div>

                        {/* Dual-Currency Explicit Display Badges */}
                        <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 font-mono font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] text-slate-500 font-sans font-semibold">Valor Original:</span>
                            {formatForeignCurrency(txForeign, txCurr)}
                          </span>
                          <span className="text-slate-400 font-bold">⇄</span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 font-mono font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-semibold">Convertido em R$:</span>
                            {formatBRL(tx.amount)}
                          </span>
                          {tx.effectiveExchangeRate && txCurr !== 'BRL' && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                              VET: {formatExchangeRateBR(tx.effectiveExchangeRate)}
                            </span>
                          )}
                          {tx.tripShares && tx.tripShares.length > 1 && (
                            <span className="text-[11px] text-slate-500">
                              • Dividido entre {tx.tripShares.length} pessoas
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/60 dark:border-slate-800 shrink-0">
                        <div className="text-left sm:text-right">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            Sua Parte Real
                          </span>
                          <div className="font-mono">
                            <span className="block text-sm font-extrabold text-slate-900 dark:text-white">
                              {maskValue(formatForeignCurrency(myShareForeign, txCurr))}
                            </span>
                            <span className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                              ≈ {maskValue(formatBRL(myShareBrl))}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditTransaction(tx)}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTransaction(tx.id)}
                            aria-label="Excluir despesa de viagem"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
