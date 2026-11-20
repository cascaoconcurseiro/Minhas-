/** Rodapé do extrato. Parte de AccountsTab (ver AccountsTab.tsx). */
import { formatBRL, formatMonthYearPT } from '../../../domain/finance/financeRules';
import type { AccountDetailContext } from './accountsTabContext';

export function AccountStatementFooter({ form }: { form: AccountDetailContext }) {
  const {
    activeAccount,
    selectedMonth,
    statementSummary,
  } = form;
  return (
    <>
{/* Closing Balance Footer Row */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-600 font-mono tabular-nums">
            Saldo Realizado Atual ({activeAccount.name}):{' '}
            <strong
              className={
                statementSummary.closingRealizedBalance >= 0
                  ? 'text-emerald-700 font-bold'
                  : 'text-rose-700 font-bold'
              }
            >
              {formatBRL(statementSummary.closingRealizedBalance)}
            </strong>
          </div>
          <div className="text-slate-700 font-mono tabular-nums">
            Saldo Projetado Fim de {formatMonthYearPT(selectedMonth)}:{' '}
            <strong
              className={
                statementSummary.closingProjectedBalance >= 0
                  ? 'text-slate-900 font-bold'
                  : 'text-rose-700 font-bold'
              }
            >
              {formatBRL(statementSummary.closingProjectedBalance)}
            </strong>
          </div>
        </div>
    </>
  );
}
