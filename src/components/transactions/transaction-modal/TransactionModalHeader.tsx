/** Cabeçalho da janela, título e abas Despesa/Receita/Movimentações. Parte de TransactionModal (ver TransactionModal.tsx). */
import { CheckCircle2, Plane, Repeat, Users, Wallet, X } from 'lucide-react';
import type { TransactionFormContext } from './transactionFormContext';

export function TransactionModalHeader({ form }: { form: TransactionFormContext }) {
  const {
    editingTransaction,
    entryMode,
    handleModeSwitch,
    isShared,
    onClose,
    selectedTrip,
    tripId,
  } = form;
  return (
    <>
{/* Zone 1: Fixed Institutional Header + Smart 4-Mode Selector */}
        <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 px-5 sm:px-6 pt-3.5 pb-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="modal-transaction-title"
                  className="text-base font-bold text-slate-900 dark:text-white font-display tracking-tight"
                >
                  {editingTransaction
                    ? 'Editar Lançamento Financeiro'
                    : 'Central de Lançamento Unificado'}
                </h2>
                {tripId && selectedTrip && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 dark:bg-sky-950/70 border border-sky-300 dark:border-sky-800 px-2 py-0.5 text-[11px] font-bold text-sky-900 dark:text-sky-300">
                    <Plane className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                    {selectedTrip.name} ({selectedTrip.currency})
                  </span>
                )}
                {isShared && entryMode !== 'income' && entryMode !== 'transfer' && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-800 px-2 py-0.5 text-[11px] font-bold text-indigo-900 dark:text-indigo-300">
                    <Users className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                    Rateio Familiar
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-words sm:truncate">
                {entryMode === 'credit_card'
                  ? 'Compra no Cartão de Crédito — À Vista (1x), Assinatura Fixa ou Parcelado (2x a 24x)'
                  : entryMode === 'income'
                  ? 'Receita em Conta — Salário, PIX recebido, Dividendos ou Reembolso'
                  : entryMode === 'transfer'
                  ? 'Movimentação Patrimonial — Transferência entre Contas, Aporte ou Quitação de Fatura'
                  : 'Despesa de Conta — PIX, Débito, Boleto Bancário ou Gasto Internacional'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar janela"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Expense, income and movement tabs; card is a payment method within expenses. */}
          {!editingTransaction && (
            <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-200/70 dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700/80">
              <button
                type="button"
                data-testid="mode-expense-btn"
                onClick={() => handleModeSwitch('expense')}
                className={`py-2 px-1.5 min-[400px]:px-2.5 text-[11px] min-[400px]:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  entryMode === 'expense' || entryMode === 'credit_card'
                    ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 shadow-xs border border-rose-200/80 dark:border-rose-900/60'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Wallet className="hidden min-[400px]:block h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Despesa</span>
              </button>
              <button
                type="button"
                data-testid="mode-income-btn"
                onClick={() => handleModeSwitch('income')}
                className={`py-2 px-1.5 min-[400px]:px-2.5 text-[11px] min-[400px]:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  entryMode === 'income'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs border border-emerald-200/80 dark:border-emerald-900/60'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CheckCircle2 className="hidden min-[400px]:block h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Receita</span>
              </button>
              <button
                type="button"
                data-testid="mode-transfer-btn"
                onClick={() => handleModeSwitch('transfer')}
                className={`py-2 px-1.5 min-[400px]:px-2.5 text-[11px] min-[400px]:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  entryMode === 'transfer'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-300 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Repeat className="hidden min-[400px]:block h-3.5 w-3.5 shrink-0" />
                <span className="truncate" aria-label="Movimentações"><span className="min-[480px]:hidden" aria-hidden="true">Transf.</span><span className="hidden min-[480px]:inline">Movimentações</span></span>
              </button>
            </div>
          )}
        </div>
    </>
  );
}
