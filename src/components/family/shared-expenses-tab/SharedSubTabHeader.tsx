/** Escolha entre pessoas, despesas e acertos. Parte de SharedExpensesTab (ver SharedExpensesTab.tsx). */
import { CreditCard, Users } from 'lucide-react';
import type { SharedExpensesTabContext } from './sharedExpensesTabContext';

export function SharedSubTabHeader({ form }: { form: SharedExpensesTabContext }) {
  const {
    activeSubTab,
    copyFeedback,
    familyMembers,
    setActiveSubTab,
  } = form;
  return (
    <>
{/* Module Navigation: Encontro de Contas vs. Gerenciar Pessoas & Convites */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="grid grid-cols-2 sm:flex items-stretch sm:items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('invoices')}
            className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-center leading-tight rounded-md transition-colors sm:whitespace-nowrap ${
              activeSubTab === 'invoices'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            } max-sm:min-h-10`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            Encontro de Contas & Compensação ({familyMembers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('members')}
            className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-center leading-tight rounded-md transition-colors sm:whitespace-nowrap ${
              activeSubTab === 'members'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            } max-sm:min-h-10`}
          >
            <Users className="h-3.5 w-3.5" />
            Pessoas & Convites por E-mail
          </button>
        </div>

        {copyFeedback && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 animate-fade-in">
            {copyFeedback}
          </div>
        )}
      </div>
    </>
  );
}
