/** Saudação e resumo rápido do dia. Parte de OverviewTab (ver OverviewTab.tsx). */
import { formatMonthYearPT } from '../../../domain/finance/financeRules';
import type { OverviewTabContext } from './overviewTabContext';

export function OverviewGreeting({ form }: { form: OverviewTabContext }) {
  const {
    firstName,
    greetingPrefix,
    pendingBills,
    pendingCount,
    pendingInvoices,
    selectedMonth,
    todayMonth,
  } = form;
  return (
    <>
<header
        data-testid="user-welcome-greeting"
        className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pt-0.5"
      >
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight font-display">
          {greetingPrefix}{firstName ? `, ${firstName}` : ''}! 👋
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {pendingCount > 0
            ? `${pendingCount} lançamento(s) a pagar/receber em ${formatMonthYearPT(selectedMonth)}${selectedMonth === todayMonth && (pendingBills.some((tx) => tx.competenceMonth < selectedMonth) || pendingInvoices.some((inv) => inv.invoiceMonth < selectedMonth)) ? ', incluindo atrasados' : ''}`
            : `Sem pendências bancárias em ${formatMonthYearPT(selectedMonth)}`}
        </p>
      </header>
    </>
  );
}
