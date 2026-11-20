/** Rodapé com o resumo e o botão de importar. Parte de BankReconciliationModal (ver BankReconciliationModal.tsx). */
import { FileCheck2, Info } from 'lucide-react';
import type { BankReconciliationModalContext } from './bankReconciliationContext';

export function ReconciliationFooter({ form }: { form: BankReconciliationModalContext }) {
  const {
    candidates,
    handleCommit,
    onClose,
    statementCurrencyError,
    summary,
  } = form;
  return (
    <>
<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Info className="h-4 w-4 shrink-0 text-slate-400" />
            <span>
              Ao confirmar, os lançamentos entram como conciliação bancária realizada (`reconciled: true`).
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Fechar
            </button>
            {candidates.length > 0 && (
              <button
                type="button"
                onClick={handleCommit}
                disabled={summary.selectedCount === 0 || summary.invalidInvoicePayments > 0 || Boolean(statementCurrencyError)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <FileCheck2 className="h-4 w-4" />
                Confirmar e Importar {summary.selectedCount} Lançamento(s)
              </button>
            )}
          </div>
        </div>
    </>
  );
}
