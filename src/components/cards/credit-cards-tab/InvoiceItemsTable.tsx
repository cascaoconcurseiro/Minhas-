/** Lista de compras da fatura do mês. Parte de CreditCardsTab (ver CreditCardsTab.tsx). */
import { getFutureUnpaidInstallments } from '../../../domain/budgets/uxEnhancementRules';
import { formatBRL, formatShortDateBR } from '../../../domain/finance/financeRules';
import { FastForward, RotateCcw, Trash2 } from 'lucide-react';
import { confirmTransactionDeletion } from '../../../domain/finance/transactionDeletion';
import type { CardPageContext } from './creditCardsTabContext';

export function InvoiceItemsTable({ form }: { form: CardPageContext }) {
  const {
    activeSummary,
    catMap,
    onAnticipateInstallments,
    onDeleteTransaction,
    onReverseAnticipation,
    selectedMonth,
    setAnticipatingGroupId,
    setAnticipationCountToAdvance,
    setAnticipationDiscountStr,
    transactions,
  } = form;
  return (
    <>
{activeSummary.transactions.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-semibold text-slate-900">
                  Nenhuma compra registrada para esta fatura.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Registre compras à vista ou parceladas para acompanhar o limite real do cartão.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Card List (< sm) */}
                <div className="block sm:hidden divide-y divide-slate-100">
                  {activeSummary.transactions.map((tx) => {
                    const futureRemaining = getFutureUnpaidInstallments(
                      transactions,
                      tx.installmentGroupId,
                      selectedMonth
                    );
                    const wasAnticipated =
                      tx.isAnticipated || tx.description.includes('(Antecipada)');
                    return (
                      <div key={tx.id} className="p-3.5 space-y-2 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 break-words sm:truncate">
                              {tx.description}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5 break-words sm:truncate">
                              {formatShortDateBR(tx.date)} · {catMap.get(tx.categoryId) || 'Geral'} ·{' '}
                              {tx.installmentTotal && tx.installmentTotal > 1
                                ? `${tx.installmentNumber}/${tx.installmentTotal}`
                                : tx.recurrence === 'fixed'
                                ? 'Assinatura'
                                : 'À vista'}
                            </p>
                          </div>
                          <div className="text-right shrink-0 font-mono tabular-nums">
                            <p className="text-sm font-bold text-slate-900">
                              {formatBRL(tx.amount)}
                            </p>
                            <span
                              className={`text-[10px] font-semibold ${
                                tx.status === 'paid' ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {tx.status === 'paid' ? 'Quitado' : 'Em Aberto'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-1.5">
                            {futureRemaining.length > 0 && onAnticipateInstallments && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAnticipatingGroupId(tx.installmentGroupId || null);
                                  setAnticipationCountToAdvance(0);
                                  setAnticipationDiscountStr('15,00');
                                }}
                                className="inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-800"
                              >
                                <FastForward className="h-3 w-3" />
                                <span>Adiantar ({futureRemaining.length})</span>
                              </button>
                            )}
                            {wasAnticipated && onReverseAnticipation && (
                              <button
                                type="button"
                                onClick={() => onReverseAnticipation(tx.id)}
                                className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-900"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Reverter Antecipação</span>
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const deleteGroup = Boolean(tx.installmentGroupId);
                              if (confirmTransactionDeletion(tx, deleteGroup)) onDeleteTransaction(tx.id, deleteGroup);
                            }}
                            aria-label={`Excluir compra ${tx.description}`}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table (>= sm) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/40 text-xs font-semibold text-slate-500">
                        <th className="py-3 pl-6 pr-3">Compra</th>
                        <th className="py-3 px-3">Descrição & Categoria</th>
                        <th className="py-3 px-3">Parcela</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Valor na Fatura</th>
                        <th className="py-3 pl-3 pr-6 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {activeSummary.transactions.map((tx) => {
                        const futureRemaining = getFutureUnpaidInstallments(
                          transactions,
                          tx.installmentGroupId,
                          selectedMonth
                        );
                        const wasAnticipated =
                          tx.isAnticipated || tx.description.includes('(Antecipada)');
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/80">
                            <td className="py-3 pl-6 pr-3 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                              {formatShortDateBR(tx.date)}
                            </td>
                            <td className="py-3 px-3">
                              <p className="font-semibold text-slate-900">{tx.description}</p>
                              <p className="text-xs text-slate-500">
                                {catMap.get(tx.categoryId) || 'Geral'}
                              </p>
                            </td>
                            <td className="py-3 px-3 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span>
                                  {tx.installmentTotal && tx.installmentTotal > 1
                                    ? `${tx.installmentNumber}/${tx.installmentTotal}`
                                    : tx.recurrence === 'fixed'
                                    ? 'Assinatura'
                                    : 'À vista'}
                                </span>
                                {futureRemaining.length > 0 && onAnticipateInstallments && (
                                  <button
                                    type="button"
                                    data-testid={`anticipate-btn-${tx.id}`}
                                    onClick={() => {
                                      setAnticipatingGroupId(tx.installmentGroupId || null);
                                      setAnticipationCountToAdvance(0);
                                      setAnticipationDiscountStr('15,00');
                                    }}
                                    title={`Adiantar ${futureRemaining.length} parcela(s) futura(s) com desconto`}
                                    className="inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-sans font-semibold text-violet-800 hover:bg-violet-100 transition-colors"
                                  >
                                    <FastForward className="h-3 w-3" />
                                    <span>Adiantar ({futureRemaining.length})</span>
                                  </button>
                                )}
                                {wasAnticipated && onReverseAnticipation && (
                                  <button
                                    type="button"
                                    data-testid={`reverse-anticipate-btn-${tx.id}`}
                                    onClick={() => onReverseAnticipation(tx.id)}
                                    title="Devolver parcela antecipada para o mês futuro original"
                                    className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-sans font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    <span>Desfazer Antecipação</span>
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-xs whitespace-nowrap">
                              <span
                                className={
                                  tx.status === 'paid'
                                    ? 'font-semibold text-emerald-700'
                                    : 'font-medium text-amber-700'
                                }
                              >
                                {tx.status === 'paid' ? 'Fatura Paga' : 'Em Aberto'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                              {formatBRL(tx.amount)}
                            </td>
                            <td className="py-3 pl-3 pr-6 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  const deleteGroup = Boolean(tx.installmentGroupId);
                                  if (confirmTransactionDeletion(tx, deleteGroup)) onDeleteTransaction(tx.id, deleteGroup);
                                }}
                                aria-label={`Excluir compra ${tx.description}`}
                                className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
    </>
  );
}
