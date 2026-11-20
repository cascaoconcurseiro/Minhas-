/** Cabeçalho da janela de importação. Parte de BankReconciliationModal (ver BankReconciliationModal.tsx). */
import { FileCheck2, X } from 'lucide-react';
import type { BankReconciliationModalContext } from './bankReconciliationContext';

export function ReconciliationHeader({ form }: { form: BankReconciliationModalContext }) {
  const {
    onClose,
  } = form;
  return (
    <>
<div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="reconciliation-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                Conciliação Bancária & Importação Inteligente (OFX / CSV)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detecção automática de duplicidades, classificação preditiva por IA e conciliação atômica
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
    </>
  );
}
