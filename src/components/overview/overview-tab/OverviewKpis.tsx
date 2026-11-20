/** Indicadores do mês: saldo, previsto, receitas e despesas. Parte de OverviewTab (ver OverviewTab.tsx). */
import { ArrowDownRight, ArrowUpRight, Clock, Wallet } from 'lucide-react';
import { formatBRL } from '../../../domain/finance/financeRules';
import type { OverviewTabContext } from './overviewTabContext';

export function OverviewKpis({ form }: { form: OverviewTabContext }) {
  const {
    health360,
    monthlySummary,
    todayAccountBalance,
  } = form;
  return (
    <>
{/* Row 1: 4 Primary Cashflow KPI Metrics (2x2 on Mobile, 4 Columns on Desktop) */}
      <section aria-label="Indicadores financeiros do mês" className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 min-w-0">
        <div className="min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 transition-all hover:border-slate-300 dark:hover:border-slate-700 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 gap-1">
            <span className="break-words sm:truncate" title="Soma das contas marcadas como 'No giro mensal'">
              Saldo em Contas (Hoje)
            </span>
            <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white break-words sm:truncate">
            {formatBRL(todayAccountBalance)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 break-words sm:truncate">
            <span>Patrimônio contas: {formatBRL(health360.liquidBalance)}</span>
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 transition-all hover:border-slate-300 dark:hover:border-slate-700 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 gap-1">
            <span className="break-words sm:truncate" title="Saldo Hoje + Receitas Pendentes - Despesas Pendentes - Faturas Abertas">
              Previsto Fim do Mês
            </span>
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
          </div>
          <p
            className={`mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums break-words sm:truncate ${
              monthlySummary.totalProjectedBalance >= 0
                ? 'text-slate-900 dark:text-white'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {formatBRL(monthlySummary.totalProjectedBalance)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 break-words sm:truncate">
            <span>Após pendentes e faturas</span>
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 transition-all hover:border-slate-300 dark:hover:border-slate-700 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 gap-1">
            <span className="break-words sm:truncate">Receitas do Mês</span>
            <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 break-words sm:truncate">
            {formatBRL(monthlySummary.incomeTotal)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums break-words sm:truncate">
            <span>Rec: {formatBRL(monthlySummary.incomeRealized)}</span>
            <span aria-hidden="true" className="hidden sm:inline"> · </span>
            <span className="hidden sm:inline">Falta: {formatBRL(monthlySummary.incomePending)}</span>
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 transition-all hover:border-slate-300 dark:hover:border-slate-700 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 gap-1">
            <span className="break-words sm:truncate">Despesas Totais</span>
            <ArrowDownRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-600 shrink-0" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400 break-words sm:truncate">
            {formatBRL(monthlySummary.expenseTotal)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums break-words sm:truncate">
            <span>Pago: {formatBRL(monthlySummary.expenseRealized)}</span>
            <span aria-hidden="true" className="hidden sm:inline"> · </span>
            <span className="hidden sm:inline">Pend: {formatBRL(monthlySummary.expensePending)}</span>
          </p>
        </div>
      </section>
    </>
  );
}
