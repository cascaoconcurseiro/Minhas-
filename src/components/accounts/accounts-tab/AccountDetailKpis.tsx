/** Indicadores da conta aberta. Parte de AccountsTab (ver AccountsTab.tsx). */
import { ArrowDownRight, ArrowUpRight, Clock, Wallet } from 'lucide-react';
import { formatForeignCurrency } from '../../../domain/trips/travelRules';
import { formatBRL } from '../../../domain/finance/financeRules';
import type { AccountDetailContext } from './accountsTabContext';

export function AccountDetailKpis({ form }: { form: AccountDetailContext }) {
  const {
    activeAccount,
    getInternationalAccountForeignMetrics,
    selectedMonth,
    statementSummary,
  } = form;
  return (
    <>
<section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
                <span className="break-words sm:truncate">Saldo Atual ({activeAccount.name})</span>
                <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 break-words sm:truncate">
                {activeAccount.type === 'international'
                  ? formatForeignCurrency(
                      getInternationalAccountForeignMetrics(activeAccount).currentForeignBalance,
                      getInternationalAccountForeignMetrics(activeAccount).currency
                    )
                  : formatBRL(statementSummary.closingRealizedBalance)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums break-words sm:truncate">
                {activeAccount.type === 'international'
                  ? `Equiv. R$: ${formatBRL(
                      getInternationalAccountForeignMetrics(activeAccount).estimatedBrlValue
                    )}`
                  : `Abertura 01/${selectedMonth.slice(5, 7)}: ${formatBRL(
                      statementSummary.openingBalance
                    )}`}
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
                <span className="break-words sm:truncate">Previsto Fim do Mês</span>
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 break-words sm:truncate">
                {formatBRL(statementSummary.closingProjectedBalance)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 break-words sm:truncate">
                {activeAccount.includeInTotal ? 'Incluída no giro mensal' : 'Conta Reserva'}
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
                <span className="break-words sm:truncate">Entradas no Mês</span>
                <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 break-words sm:truncate">
                +{formatBRL(statementSummary.monthCreditsRealized)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 break-words sm:truncate">
                Créditos efetivados na conta
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
                <span className="break-words sm:truncate">Saídas no Mês</span>
                <ArrowDownRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-600 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-rose-700 break-words sm:truncate">
                -{formatBRL(statementSummary.monthDebitsRealized)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums break-words sm:truncate">
                Pend. na conta: {formatBRL(statementSummary.monthPendingNet)}
              </p>
            </div>
          </section>
    </>
  );
}
