/** Conversor de moeda e os 4 indicadores (orçamento, gasto, saldo, câmbio). Parte de TripsTab (ver TripsTab.tsx). */
import { SmartCurrencyConverterCard } from '../SmartCurrencyConverterCard';
import { Coins, TrendingUp, Users, Wallet } from 'lucide-react';
import { formatExchangeRateBR, formatForeignCurrency } from '../../../domain/trips/travelRules';
import { formatBRL } from '../../../domain/finance/financeRules';
import type { TripPageContext } from './tripsTabContext';

export function TripConverterAndKpis({ form }: { form: TripPageContext }) {
  const {
    activeTrip,
    getAuthToken,
    isConverterOpen,
    maskValue,
    onOpenNewTripExpense,
    onUpdateTrip,
    privacyMode,
    summary,
  } = form;
  return (
    <>
{/* Smart Currency Converter Inside the Trip (Trip Local Currency ⇄ BRL with Google Search Live Rate & Trip VET) */}
      {isConverterOpen && (
        <div className="animate-fade-in-up" data-testid="trip-inside-quick-converter">
          <SmartCurrencyConverterCard
            exchangeLots={activeTrip.exchangeLots}
            getAuthToken={getAuthToken}
            currency={activeTrip.currency}
            defaultExchangeRate={activeTrip.defaultExchangeRate}
            remainingForeignBalance={summary.remainingForeignWalletBalance}
            privacyMode={privacyMode}
            allowCurrencyChange={false}
            onUseConvertedValue={() => onOpenNewTripExpense(activeTrip.id)}
            onApplyLiveRateToTrip={(liveRate) =>
              onUpdateTrip({
                ...activeTrip,
                defaultExchangeRate: liveRate,
              })
            }
          />
        </div>
      )}

      {/* 4 KPI Cards (2x2 on Mobile, 4 Columns on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Minha Parte Pessoal */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 break-words sm:truncate">
              Minha Parte Real
            </span>
            <Wallet className="h-4 w-4 text-emerald-600 shrink-0" />
          </div>
          <p className="mt-1.5 text-base sm:text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums break-words sm:truncate">
            {maskValue(
              formatForeignCurrency(summary.myPersonalSpendForeign, activeTrip.currency)
            )}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            ≈ {maskValue(formatBRL(summary.myPersonalSpendBrl))}
          </p>
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mb-1">
              <span>Meta: {formatForeignCurrency(summary.budgetForeign, activeTrip.currency)}</span>
              <span>{summary.budgetUsedPercent}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  summary.budgetUsedPercent > 100
                    ? 'bg-rose-500'
                    : summary.budgetUsedPercent >= 80
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, summary.budgetUsedPercent)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Ritmo Diário TravelSpend */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 break-words sm:truncate">
              Ritmo Diário (Média)
            </span>
            <TrendingUp className="h-4 w-4 text-sky-600 shrink-0" />
          </div>
          <p className="mt-1.5 text-base sm:text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums break-words sm:truncate">
            {maskValue(
              `${formatForeignCurrency(summary.myDailyAverageForeign, activeTrip.currency)}/dia`
            )}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            ≈ {maskValue(`${formatBRL(summary.myDailyAverageBrl)}/dia`)}
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold leading-tight">
            Pode gastar{' '}
            <span className="font-bold font-mono">
              {formatForeignCurrency(
                summary.safeRemainingDailyForeign,
                activeTrip.currency
              )}
              /dia
            </span>{' '}
            dentro da meta
          </div>
        </div>

        {/* Card 3: Bolso de Câmbio & VET Médio */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 break-words sm:truncate">
              Saldo Wise / Espécie
            </span>
            <Coins className="h-4 w-4 text-amber-600 shrink-0" />
          </div>
          <p className="mt-1.5 text-base sm:text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums break-words sm:truncate">
            {maskValue(
              formatForeignCurrency(
                summary.remainingForeignWalletBalance,
                activeTrip.currency
              )
            )}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 break-words sm:truncate">
            Comprado: {formatForeignCurrency(summary.totalForeignPurchased, activeTrip.currency)}
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-semibold break-words sm:truncate">
            VET Médio:{' '}
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {formatExchangeRateBR(summary.weightedAverageRate)}
            </span>{' '}
            por 1 {activeTrip.currency}
          </div>
        </div>

        {/* Card 4: Acerto em Grupo (Splitwise) */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 break-words sm:truncate">
              Meu Saldo no Grupo
            </span>
            <Users className="h-4 w-4 text-violet-600 shrink-0" />
          </div>
          <p
            className={`mt-1.5 text-base sm:text-xl font-extrabold font-mono tabular-nums break-words sm:truncate ${
              summary.myNetSettlementForeign > 0.01
                ? 'text-emerald-600 dark:text-emerald-400'
                : summary.myNetSettlementForeign < -0.01
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {summary.myNetSettlementForeign > 0.01
              ? `+${maskValue(
                  formatForeignCurrency(
                    summary.myNetSettlementForeign,
                    activeTrip.currency
                  )
                )}`
              : summary.myNetSettlementForeign < -0.01
              ? maskValue(
                  formatForeignCurrency(
                    summary.myNetSettlementForeign,
                    activeTrip.currency
                  )
                )
              : 'Quitado (0,00)'}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {summary.myNetSettlementBrl > 0.01
              ? `A receber: ${maskValue(formatBRL(summary.myNetSettlementBrl))}`
              : summary.myNetSettlementBrl < -0.01
              ? `A pagar: ${maskValue(formatBRL(Math.abs(summary.myNetSettlementBrl)))}`
              : 'Sem pendências no grupo'}
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 break-words sm:truncate">
            Gasto Total Grupo:{' '}
            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
              {formatForeignCurrency(summary.groupTotalSpendForeign, activeTrip.currency)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
