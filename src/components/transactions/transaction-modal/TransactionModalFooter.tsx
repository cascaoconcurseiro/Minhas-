/** Barra inferior fixa com o resumo contábil e os botões Cancelar/Confirmar. Parte de TransactionModal (ver TransactionModal.tsx). */
import { formatBRL } from '../../../domain/finance/financeRules';
import type { TransactionFormContext } from './transactionFormContext';

export function TransactionModalFooter({ form }: { form: TransactionFormContext }) {
  const {
    editingTransaction,
    entryMode,
    fixedMonthsCount,
    installmentTotal,
    isPaidByCompanion,
    liveBudgetImpact,
    myTripShareObj,
    numericPreview,
    onClose,
    recurrence,
    scrollState,
    selectedAccountName,
    selectedCardName,
    selectedTrip,
    transferSubMode,
    tripId,
    workspaceReady,
  } = form;
  return (
    <>
{/* Zone 3: Sticky Bottom Action Bar with Real-Time Accounting Summary */}
          <div
            data-testid="transaction-modal-sticky-footer"
            className={`shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-5 sm:px-6 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] transition-shadow ${
              scrollState.showBottomShadow
                ? 'shadow-[0_-4px_12px_rgba(15,23,42,0.06)]'
                : ''
            }`}
          >
            <div className="text-xs text-slate-600 dark:text-slate-300 min-w-0">
              {numericPreview > 0 ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>
                    Impacto mensal:{' '}
                    <strong className="font-mono tabular-nums text-slate-900 dark:text-white">
                      {formatBRL(liveBudgetImpact?.draftMonthlyAmount ?? (selectedTrip && isPaidByCompanion ? 0 : numericPreview))}
                    </strong>
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                    {entryMode === 'credit_card'
                      ? selectedCardName
                      : selectedAccountName}
                  </span>
                  {selectedTrip && myTripShareObj && (
                    <span className="text-sky-700 dark:text-sky-400 font-semibold font-mono text-[11px]">
                      (Sua parte: {formatBRL(myTripShareObj.brlShare)})
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-slate-400 dark:text-slate-500">
                  Informe o valor e a descrição para confirmar o lançamento
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="tx-submit-btn"
                disabled={!workspaceReady}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-xs whitespace-nowrap disabled:opacity-60 disabled:cursor-wait"
              >
                {!workspaceReady
                  ? 'Sincronizando…'
                  : editingTransaction
                  ? 'Salvar Alterações'
                  : entryMode === 'credit_card' && recurrence === 'installment'
                  ? `Lançar ${installmentTotal}x no Cartão`
                  : recurrence === 'fixed'
                  ? `Gerar Série (${fixedMonthsCount}m)`
                  : entryMode === 'transfer' &&
                    transferSubMode === 'card_bill_payment'
                  ? 'Confirmar Pagamento Fatura'
                  : tripId
                  ? 'Salvar Gasto na Viagem'
                  : 'Confirmar Lançamento'}
              </button>
            </div>
          </div>
    </>
  );
}
