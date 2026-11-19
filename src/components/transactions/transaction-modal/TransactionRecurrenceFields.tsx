/** Frequência: à vista, fixo ou parcelado. Parte de TransactionCoreFields (ver TransactionCoreFields.tsx). */
import { Repeat } from 'lucide-react';
import type { TransactionFormContext } from './transactionFormContext';

export function TransactionRecurrenceFields({ form }: { form: TransactionFormContext }) {
  const {
    amountMode,
    editingTransaction,
    entryMode,
    fixedMonthsCount,
    installmentTotal,
    isCardRefund,
    recurrence,
    setAmountMode,
    setFixedMonthsCount,
    setInstallmentTotal,
    setIsCardRefund,
    setIsShared,
    setIsTripLinked,
    setRecurrence,
    status,
  } = form;
  return (
    <>
{entryMode === 'credit_card' && !editingTransaction && (
                  <label
                    data-testid="card-refund-toggle"
                    className="flex items-start gap-2.5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/30 p-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isCardRefund}
                      onChange={(event) => {
                        setIsCardRefund(event.target.checked);
                        if (event.target.checked) {
                          // Estorno é à vista, sem divisão e fora de viagem.
                          setRecurrence('single');
                          setIsShared(false);
                          setIsTripLinked(false);
                        }
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-sky-900 dark:text-sky-200">Estorno / devolução de compra</span>
                      <span className="block text-[11px] text-sky-800 dark:text-sky-300">
                        Reduz a fatura, libera o limite e diminui o gasto da categoria. Informe o valor devolvido (sempre positivo).
                      </span>
                    </span>
                  </label>
                )}
{/* Frequency / Recurrence Selector
                    CRITICAL RULE: "Parcelado (2x a 48x)" ONLY appears when entryMode === 'credit_card'! */}
                {!isCardRefund && (
                  <div
                    data-testid="main-recurrence-selector"
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Repeat className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        {entryMode === 'credit_card'
                          ? 'Modalidade na Fatura (À Vista, Assinatura Fixa ou Parcelado)'
                          : 'Frequência no Fluxo (Único ou Recorrente Mensal)'}
                      </span>
                    </div>

                    <div
                      className={`grid grid-cols-1 gap-1.5 ${
                        entryMode === 'credit_card'
                          ? 'sm:grid-cols-3'
                          : 'sm:grid-cols-2'
                      }`}
                    >
                      <button
                        type="button"
                        data-testid="recurrence-single-btn"
                        onClick={() => setRecurrence('single')}
                        className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                          recurrence === 'single'
                            ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-bold">
                          {entryMode === 'credit_card'
                            ? 'À Vista (1x na Fatura)'
                            : 'Único / Neste Mês'}
                        </div>
                        <div
                          className={`text-[10px] ${
                            recurrence === 'single'
                              ? 'text-slate-300 dark:text-slate-600'
                              : 'text-slate-400'
                          }`}
                        >
                          Lançamento pontual sem repetição
                        </div>
                      </button>

                      <button
                        type="button"
                        data-testid="recurrence-fixed-btn"
                        onClick={() => setRecurrence('fixed')}
                        className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                          recurrence === 'fixed'
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-bold">Fixo / Recorrente Mensal</div>
                        <div
                          className={`text-[10px] ${
                            recurrence === 'fixed'
                              ? 'text-emerald-100'
                              : 'text-slate-400'
                          }`}
                        >
                          {entryMode === 'income'
                            ? 'Salário, Aluguel, Proventos'
                            : entryMode === 'credit_card'
                            ? 'Assinatura Streaming, Academia'
                            : 'Condomínio, Luz, Internet, Aluguel'}
                        </div>
                      </button>

                      {/* ONLY SHOW INSTALLMENTS WHEN ENTRY MODE IS CREDIT CARD */}
                      {entryMode === 'credit_card' && (
                        <button
                          type="button"
                          data-testid="recurrence-installment-btn"
                          onClick={() => setRecurrence('installment')}
                          className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                            recurrence === 'installment'
                              ? 'border-violet-600 bg-violet-600 text-white shadow-2xs'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <div className="font-bold">Parcelado (2x a 24x)</div>
                          <div
                            className={`text-[10px] ${
                              recurrence === 'installment'
                                ? 'text-violet-100'
                                : 'text-slate-400'
                            }`}
                          >
                            Divide nas próximas faturas do cartão
                          </div>
                        </button>
                      )}
                    </div>

                    {recurrence === 'fixed' && (
                      <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          <strong>Projeção Automática:</strong> O mês atual entra como{' '}
                          <strong>
                            {entryMode === 'credit_card'
                              ? 'Na Fatura'
                              : status === 'paid'
                              ? 'Efetivado'
                              : 'Pendente'}
                          </strong>{' '}
                          e os meses seguintes como <strong>Previsto</strong>.
                        </div>
                        <div className="shrink-0">
                          <select
                            value={fixedMonthsCount}
                            onChange={(e) =>
                              setFixedMonthsCount(Number(e.target.value))
                            }
                            className="w-full sm:w-auto rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white"
                          >
                            {![3, 6, 12, 24].includes(fixedMonthsCount) && (
                              <option value={fixedMonthsCount}>Repetir por {fixedMonthsCount} meses (atual)</option>
                            )}
                            <option value={3}>Repetir por 3 meses</option>
                            <option value={6}>Repetir por 6 meses (Semestre)</option>
                            <option value={12}>Repetir por 12 meses (1 Ano)</option>
                            <option value={24}>Repetir por 24 meses (2 Anos)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {entryMode === 'credit_card' &&
                      recurrence === 'installment' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-700">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Número de Parcelas no Cartão
                            </label>
                            <select
                              value={installmentTotal}
                              onChange={(e) =>
                                setInstallmentTotal(Number(e.target.value))
                              }
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-bold tabular-nums text-slate-900 dark:text-white"
                            >
                              {Array.from({ length: 47 }, (_, index) => index + 2).map(
                                (n) => (
                                  <option key={n} value={n}>
                                    {n}x no cartão
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Cálculo de cada parcela
                            </label>
                            <select
                              value={amountMode}
                              onChange={(e) =>
                                setAmountMode(
                                  e.target.value as
                                    | 'total_divided'
                                    | 'per_installment'
                                )
                              }
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                            >
                              <option value="total_divided">
                                Dividir valor total pelas {installmentTotal} parcelas
                              </option>
                              <option value="per_installment">
                                Valor digitado já é o de cada parcela
                              </option>
                            </select>
                          </div>
                        </div>
                      )}
                  </div>
                )}
    </>
  );
}
