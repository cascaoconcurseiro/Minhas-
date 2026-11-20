/** Central de antecipação de parcelas com desconto. Parte de CreditCardsTab (ver CreditCardsTab.tsx). */
import { getFutureUnpaidInstallments } from '../../../domain/budgets/uxEnhancementRules';
import { formatBRL, formatMonthYearPT, parseBRLInput } from '../../../domain/finance/financeRules';
import { FastForward, RotateCcw } from 'lucide-react';
import { CurrencyInput } from '../../ui/CurrencyInput';
import type { CardPageContext } from './creditCardsTabContext';

export function InstallmentAnticipationPanel({ form }: { form: CardPageContext }) {
  const {
    activeCard,
    activeInstallmentGroups,
    anticipatingGroupId,
    anticipationCountToAdvance,
    anticipationDiscountStr,
    groupsWithFutureParcels,
    onAnticipateInstallments,
    onReverseAnticipation,
    selectedMonth,
    setAnticipatingGroupId,
    setAnticipationCountToAdvance,
    setAnticipationDiscountStr,
    transactions,
  } = form;
  return (
    <>
{/* Central de Antecipação de Parcelas com Desconto */}
            {anticipatingGroupId && (() => {
              const effectiveGroupId =
                anticipatingGroupId === '__empty__'
                  ? groupsWithFutureParcels[0]?.installmentGroupId || ''
                  : anticipatingGroupId;

              const futureInstallments = getFutureUnpaidInstallments(
                transactions,
                effectiveGroupId,
                selectedMonth
              );
              const selectedSlice =
                anticipationCountToAdvance > 0
                  ? futureInstallments.slice(0, anticipationCountToAdvance)
                  : futureInstallments;

              const futureSum =
                Math.round(
                  selectedSlice.reduce((acc, t) => acc + t.amount, 0) * 100
                ) / 100;
              const discountNum = Math.max(0, parseBRLInput(anticipationDiscountStr));
              const finalProjected = Math.max(0, futureSum - discountNum);
              const activeGroupMeta = activeInstallmentGroups.find(
                (g) => g.installmentGroupId === effectiveGroupId
              );
              const sampleTitle =
                activeGroupMeta?.title ||
                futureInstallments[0]?.description.replace(/\s*\(\d+\/\d+\)\s*$/, '') ||
                'Compra Parcelada';

              return (
                <div
                  data-testid="anticipate-installments-panel"
                  className="border-b border-violet-200 bg-violet-50/90 px-4 sm:px-6 py-4 space-y-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-violet-950 flex items-center gap-1.5">
                        <FastForward className="h-4 w-4 text-violet-700" />
                        Central de Antecipação de Parcelas — {activeCard.name}
                      </h3>
                      <p className="text-[11px] text-violet-800 mt-0.5">
                        Traga parcelas de meses futuros para a fatura atual ({formatMonthYearPT(selectedMonth)}) com ou sem desconto bancário e libere limite após quitar.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAnticipatingGroupId(null)}
                      className="text-xs font-semibold text-violet-700 hover:underline"
                    >
                      Fechar Painel
                    </button>
                  </div>

                  {groupsWithFutureParcels.length === 0 ? (
                    <div className="rounded-lg border border-violet-200 bg-white p-3.5 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Todas as compras parceladas deste cartão já estão no mês atual ou não possuem parcelas futuras pendentes.
                      </span>
                      {activeInstallmentGroups.some((g) => g.anticipatedCountInMonth > 0) &&
                        onReverseAnticipation && (
                          <button
                            type="button"
                            onClick={() => {
                              const g = activeInstallmentGroups.find(
                                (item) => item.anticipatedCountInMonth > 0
                              );
                              if (g) onReverseAnticipation(g.installmentGroupId);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Desfazer Antecipação Realizada</span>
                          </button>
                        )}
                    </div>
                  ) : (
                    <>
                      {/* 1. Select Which Installment Purchase to Advance */}
                      {groupsWithFutureParcels.length > 1 && (
                        <div>
                          <label className="block text-[11px] font-bold text-violet-950 mb-1.5">
                            1. Escolha a compra parcelada que deseja adiantar:
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {groupsWithFutureParcels.map((grp) => {
                              const isSelected = grp.installmentGroupId === effectiveGroupId;
                              return (
                                <button
                                  key={grp.installmentGroupId}
                                  type="button"
                                  aria-pressed={isSelected}
                                  data-selection-control="true"
                                  onClick={() => {
                                    setAnticipatingGroupId(grp.installmentGroupId);
                                    setAnticipationCountToAdvance(0);
                                  }}
                                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    isSelected
                                      ? 'border-blue-600 bg-blue-600 text-white'
                                      : 'border-slate-200 bg-white text-slate-700 hover:bg-blue-50'
                                  }`}
                                >
                                  {grp.title} ({grp.futureInstallmentsCount}x futuras ·{' '}
                                  {formatBRL(grp.futureTotalAmount)})
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 2. Choose How Many Future Installments to Advance */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-white rounded-xl border border-violet-200 p-3.5">
                        <div className="sm:col-span-5">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                            Quantas parcelas futuras de &ldquo;{sampleTitle}&rdquo; adiantar?
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => setAnticipationCountToAdvance(0)}
                              className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                                anticipationCountToAdvance === 0
                                  ? 'border-violet-700 bg-violet-700 text-white'
                                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              Todas ({futureInstallments.length}x)
                            </button>
                            {futureInstallments.map((inst, idx) => {
                              const countVal = idx + 1;
                              if (countVal === futureInstallments.length) return null;
                              return (
                                <button
                                  key={inst.id}
                                  type="button"
                                  onClick={() => setAnticipationCountToAdvance(countVal)}
                                  className={`rounded-md border px-2.5 py-1 text-xs font-mono font-semibold ${
                                    anticipationCountToAdvance === countVal
                                      ? 'border-violet-700 bg-violet-700 text-white'
                                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  +{countVal}x
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="sm:col-span-4">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-bold text-slate-700">
                              Desconto do banco (R$):
                            </label>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setAnticipationDiscountStr('0,00')}
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-200"
                              >
                                R$ 0
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setAnticipationDiscountStr(
                                    (Math.round(futureSum * 2) / 100)
                                      .toFixed(2)
                                      .replace('.', ',')
                                  )
                                }
                                className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 hover:bg-violet-200"
                              >
                                2%
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setAnticipationDiscountStr(
                                    (Math.round(futureSum * 5) / 100)
                                      .toFixed(2)
                                      .replace('.', ',')
                                  )
                                }
                                className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 hover:bg-violet-200"
                              >
                                5%
                              </button>
                            </div>
                          </div>
                          <CurrencyInput
                            value={anticipationDiscountStr}
                            currency="BRL"
                            onValueChange={setAnticipationDiscountStr}
                            placeholder="0,00"
                            className="w-full rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 focus:border-violet-600 focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-3 flex flex-col justify-end">
                          <div className="text-[11px] font-mono tabular-nums text-slate-600 mb-1.5">
                            De {formatBRL(futureSum)} por{' '}
                            <strong className="font-bold text-emerald-700">
                              {formatBRL(finalProjected)}
                            </strong>
                          </div>
                          <button
                            type="button"
                            data-testid="confirm-anticipate-btn"
                            onClick={() => {
                              onAnticipateInstallments?.(
                                effectiveGroupId,
                                discountNum,
                                anticipationCountToAdvance > 0
                                  ? anticipationCountToAdvance
                                  : undefined
                              );
                              setAnticipatingGroupId(null);
                            }}
                            className="w-full rounded-lg bg-violet-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-violet-800 transition-colors"
                          >
                            Adiantar {selectedSlice.length}x Agora
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
    </>
  );
}
