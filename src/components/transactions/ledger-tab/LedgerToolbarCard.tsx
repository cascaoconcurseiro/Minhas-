/** Barra de modos de visão e indicadores do mês. Parte de TransactionsTab (ver TransactionsTab.tsx). */
import { Calendar as CalendarIcon, FileCheck2, List, Plus } from 'lucide-react';
import type { TransactionsTabContext } from './transactionsTabContext';

export function LedgerToolbarCard({ form }: { form: TransactionsTabContext }) {
  const {
    monthTransactions,
    onOpenNewTransaction,
    onOpenReconciliation,
    setViewMode,
    totals,
    viewMode,
  } = form;
  return (
    <>
{/* Top View Mode Switcher: Extrato em Lista vs. Calendário Mensal */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-4">
          <div className="w-full sm:w-auto grid grid-cols-2 sm:flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="h-4 w-4 text-emerald-600" />
              <span>Calendário</span>
              {totals.pendingCount > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  {totals.pendingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <List className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span>Extrato ({monthTransactions.length})</span>
            </button>
          </div>

          <div className="hidden sm:grid w-full min-w-0 grid-cols-2 2xl:flex 2xl:w-auto 2xl:flex-wrap items-center gap-2">
            {onOpenReconciliation && (
              <button
                type="button"
                onClick={onOpenReconciliation}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
              >
                <FileCheck2 className="h-3.5 w-3.5 text-emerald-700" />
                <span>Importar Extrato OFX</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenNewTransaction('expense')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Lançar Despesa
            </button>
            <button
              type="button"
              onClick={() => onOpenNewTransaction('credit_card')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              + Compra Parcelada
            </button>
            <button
              type="button"
              onClick={() => onOpenNewTransaction('income')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
            >
              + Receita
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
