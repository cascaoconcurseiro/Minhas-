/** Indicadores da carteira. Parte de InvestmentsTab (ver InvestmentsTab.tsx). */
import { Award, Coins, Landmark, TrendingUp } from 'lucide-react';
import { formatBRL } from '../../../domain/finance/financeRules';
import type { InvestmentsTabContext } from './investmentsTabContext';

export function InvestmentsKpis({ form }: { form: InvestmentsTabContext }) {
  const {
    summary,
  } = form;
  return (
    <>
<section
        aria-label="Indicadores da Carteira de Investimentos"
        className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4"
      >
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
            <span className="break-words sm:truncate">Patrimônio Investido</span>
            <Landmark className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
          </div>
          <p
            data-testid="portfolio-total-value"
            className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 break-words sm:truncate"
          >
            {formatBRL(summary.totalCurrentValue)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums break-words sm:truncate">
            Custo: {formatBRL(summary.totalInvestedCost)}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
            <span className="break-words sm:truncate">Ganho de Capital</span>
            <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 flex flex-wrap items-baseline gap-1.5">
            <p
              className={`text-base sm:text-2xl font-bold font-mono tabular-nums break-words sm:truncate ${
                summary.totalCapitalGain >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {summary.totalCapitalGain >= 0 ? '+' : ''}
              {formatBRL(summary.totalCapitalGain)}
            </p>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] sm:text-xs font-bold font-mono tabular-nums ${
                summary.totalProfitabilityPercent >= 0
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {summary.totalProfitabilityPercent >= 0 ? '+' : ''}
              {summary.totalProfitabilityPercent}%
            </span>
          </div>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums break-words sm:truncate">
            Liq. D+0/D+1: {summary.immediateLiquidityPercent}%
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
            <span className="break-words sm:truncate">Renda Passiva/Mês</span>
            <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 shrink-0" />
          </div>
          <p
            data-testid="portfolio-passive-income"
            className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 break-words sm:truncate"
          >
            +{formatBRL(summary.estimatedMonthlyPassiveIncome)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums break-words sm:truncate">
            FII/Ações: {formatBRL(summary.cashDividendsMonthly)}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
            <span className="break-words sm:truncate">Cobertura Custo</span>
            <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-600 shrink-0" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 break-words sm:truncate">
            {summary.livingCostCoveragePercent}%
            <span className="text-[10px] sm:text-xs font-normal text-slate-500"> do mês</span>
          </p>
          <div className="mt-1.5 sm:mt-2 h-1.5 sm:h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-300"
              style={{
                width: `${Math.min(100, summary.livingCostCoveragePercent)}%`,
              }}
            />
          </div>
        </div>
      </section>
    </>
  );
}
