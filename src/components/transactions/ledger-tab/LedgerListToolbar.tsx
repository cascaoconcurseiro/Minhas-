/** Ordenação, conciliação e ações em lote da lista. Parte de TransactionsTab (ver TransactionsTab.tsx). */
import { Check } from 'lucide-react';
import { formatBRL } from '../../../domain/finance/financeRules';
import type { TransactionsTabContext } from './transactionsTabContext';

export function LedgerListToolbar({ form }: { form: TransactionsTabContext }) {
  const {
    handleConfirmBatchSettle,
    handleSelectPendingInFilter,
    isReconcileMode,
    monthTransactions,
    selectedSummary,
    selectedTxIds,
    setIsReconcileMode,
    setSelectedTxIds,
    totals,
  } = form;
  return (
    <>
<div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-4 sm:px-6 py-3.5 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="font-medium text-slate-600">
              Exibindo{' '}
              <span className="font-bold font-mono tabular-nums text-slate-900">
                {monthTransactions.length}
              </span>{' '}
              lançamento(s)
            </div>

            <button
              type="button"
              data-testid="toggle-reconcile-mode"
              onClick={() => {
                const next = !isReconcileMode;
                setIsReconcileMode(next);
                if (!next) setSelectedTxIds([]);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                isReconcileMode
                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isReconcileMode ? 'Sair do Modo Conferência' : 'Modo Conferência em Lote'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums">
            <span className="text-emerald-700">
              Entradas: <strong>{formatBRL(totals.income)}</strong>
            </span>
            <span className="text-slate-300" aria-hidden="true">|</span>
            <span className="text-rose-700">
              Saídas: <strong>{formatBRL(totals.expense)}</strong>
            </span>
            <span className="text-slate-300" aria-hidden="true">|</span>
            <span className={totals.net >= 0 ? 'text-slate-900' : 'text-rose-700'}>
              Saldo Filtro: <strong>{formatBRL(totals.net)}</strong>
            </span>
          </div>
        </div>

        {/* Batch Reconciliation Action Bar (Modo Conferência) */}
        {isReconcileMode && (
          <div
            data-testid="batch-reconcile-bar"
            className="border-b border-emerald-200 bg-emerald-50/80 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 animate-expand-in"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-emerald-950">
                Conferência de Extrato:
              </span>
              <button
                type="button"
                onClick={handleSelectPendingInFilter}
                className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
              >
                Selecionar Pendentes
              </button>
              <button
                type="button"
                onClick={() => setSelectedTxIds(monthTransactions.map((t) => t.id))}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Todos ({monthTransactions.length})
              </button>
              {selectedTxIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTxIds([])}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 ml-auto">
              <div className="text-xs font-mono tabular-nums text-emerald-950">
                Selecionados: <strong>{selectedSummary.count}</strong> · Soma:{' '}
                <strong className="font-bold">{formatBRL(selectedSummary.sum)}</strong>
              </div>
              <button
                type="button"
                data-testid="batch-settle-btn"
                disabled={selectedSummary.count === 0}
                onClick={handleConfirmBatchSettle}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-2xs"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Efetivar Selecionados ({selectedSummary.count})</span>
              </button>
            </div>
          </div>
        )}
    </>
  );
}
