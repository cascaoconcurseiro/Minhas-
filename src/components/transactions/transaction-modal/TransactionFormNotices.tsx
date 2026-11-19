/** Troca de forma de pagamento, aviso de edição (desfazer e alcance em série) e erros. Parte de TransactionModal (ver TransactionModal.tsx). */
import { CheckCircle2, CreditCard as CreditCardIcon, Layers, RotateCcw } from 'lucide-react';
import type { TransactionFormContext } from './transactionFormContext';

export function TransactionFormNotices({ form }: { form: TransactionFormContext }) {
  const {
    canSwitchPaymentMethod,
    cascadeScope,
    editingTransaction,
    entryMode,
    error,
    handleModeSwitch,
    legacyInstallmentTotalUnknown,
    paymentChosen,
    setCascadeScope,
    setStatus,
    status,
  } = form;
  return (
    <>
{(entryMode === 'expense' || entryMode === 'credit_card') && canSwitchPaymentMethod && (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3">
                <span className="col-span-2 sm:col-span-1 sm:mr-1 text-xs font-bold text-slate-700 dark:text-slate-300">Forma de pagamento</span>
                <button
                  type="button"
                  data-testid="payment-method-account"
                  aria-pressed={paymentChosen && entryMode === 'expense'}
                  onClick={() => handleModeSwitch('expense', true)}
                  className={`inline-flex w-full sm:w-auto items-center justify-center rounded-lg border px-3 py-2 sm:py-1.5 text-xs font-semibold ${paymentChosen && entryMode === 'expense' ? 'border-rose-300 bg-white text-rose-700 shadow-xs' : 'border-slate-300 bg-white/60 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}
                >
                  Conta / débito
                </button>
                <button
                  type="button"
                  data-testid="payment-method-card"
                  aria-pressed={entryMode === 'credit_card'}
                  onClick={() => handleModeSwitch('credit_card')}
                  className={`inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border px-3 py-2 sm:py-1.5 text-xs font-semibold ${entryMode === 'credit_card' ? 'border-violet-300 bg-white text-violet-700 shadow-xs' : 'border-slate-300 bg-white/60 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}
                >
                  <CreditCardIcon className="h-3.5 w-3.5" />
                  Cartão de crédito
                </button>
                {!paymentChosen && entryMode === 'expense' && (
                  <p data-testid="payment-method-required" className="col-span-2 sm:col-span-1 sm:basis-full text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    Escolha como foi pago: conta/débito ou cartão de crédito.
                  </p>
                )}
              </div>
            )}

            {/* Editing Mode Banner: Quick 1-Click Status Revert + Cascade Scope */}
            {editingTransaction && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/50 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                      Situação no Caixa (Reversão Rápida)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Alterne entre Efetivado e Pendente com 1 clique:
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStatus('paid')}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold border transition-all ${
                        status === 'paid'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {entryMode === 'income'
                        ? 'Recebido (Efetivado)'
                        : 'Pago (Efetivado)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('pending')}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold border transition-all ${
                        status === 'pending'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {entryMode === 'income'
                        ? 'Voltar p/ A Receber'
                        : 'Voltar p/ Pendente'}
                    </button>
                  </div>
                </div>

                {editingTransaction.installmentGroupId && (
                  <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-700 space-y-2">
                    <label className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      Escopo da Alteração na Série ({editingTransaction.installmentNumber}/
                      {editingTransaction.installmentTotal} meses):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCascadeScope('single')}
                        className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold transition-all ${
                          cascadeScope === 'single'
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 font-bold'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Apenas este mês ({editingTransaction.competenceMonth})
                      </button>
                      <button
                        type="button"
                        disabled={legacyInstallmentTotalUnknown}
                        onClick={() => setCascadeScope('this_and_future')}
                        className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                          cascadeScope === 'this_and_future'
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 font-bold'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Cascata: Este + próximos meses
                      </button>
                      <button
                        type="button"
                        disabled={legacyInstallmentTotalUnknown}
                        onClick={() => setCascadeScope('all_series')}
                        className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                          cascadeScope === 'all_series'
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 font-bold'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Toda a série (passados e futuros)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-2.5 text-xs font-medium text-rose-800 dark:text-rose-200 animate-expand-in"
              >
                {error}
              </div>
            )}
    </>
  );
}
