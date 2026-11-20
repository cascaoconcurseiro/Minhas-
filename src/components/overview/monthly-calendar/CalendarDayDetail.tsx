/** Detalhe do dia selecionado: lançamentos e faturas. Parte de MonthlyCalendarView (ver MonthlyCalendarView.tsx). */
import { formatBRL } from '../../../domain/finance/financeRules';
import { Check, CheckCircle2, Clock, CreditCard as CreditCardIcon, Edit3, Repeat, Trash2, Users } from 'lucide-react';
import { CardNetworkMark } from '../../cards/CardNetworkMark';
import { CategoryIconBadge } from '../../ui/CategoryIconBadge';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import type { MonthlyCalendarContext } from './monthlyCalendarContext';

export function CalendarDayDetail({ form }: { form: MonthlyCalendarContext }) {
  const {
    accMap,
    accounts,
    cardMap,
    cards,
    catMap,
    onDeleteTransaction,
    onEditTransaction,
    onOpenNewTransaction,
    onToggleStatus,
    selectedDate,
    selectedDateInvoices,
    selectedDateTxs,
    selectedDayFullLabel,
    selectedDayTotals,
  } = form;
  return (
    <>
{/* Selected Day Inspector Panel */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
              <h3 className="text-base font-bold text-slate-900 font-display">
                Detalhamento do Dia: {selectedDayFullLabel}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualize vencimentos, faturas, efetive baixas ou edite lançamentos previstos para esta data
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenNewTransaction('expense', selectedDate)}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
            >
              + Despesa neste Dia
            </button>
            <button
              type="button"
              onClick={() => onOpenNewTransaction('income', selectedDate)}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
            >
              + Receita
            </button>
          </div>
        </div>

        {/* Selected Day Summary Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 rounded-lg p-3">
          <div>
            <span className="text-[11px] font-semibold text-slate-500">
              A Pagar / Pendente
            </span>
            <div className="text-sm font-bold tabular-nums text-amber-700">
              {formatBRL(selectedDayTotals.pendingExpense)}
            </div>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500">
              Pago / Efetivado
            </span>
            <div className="text-sm font-bold tabular-nums text-slate-700">
              {formatBRL(selectedDayTotals.paidExpense)}
            </div>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500">
              Receitas do Dia
            </span>
            <div className="text-sm font-bold tabular-nums text-emerald-700">
              +{formatBRL(selectedDayTotals.income)}
            </div>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500">
              Saldo Previsto do Dia
            </span>
            <div
              className={`text-sm font-bold tabular-nums ${
                selectedDayTotals.dayBalance >= 0
                  ? 'text-emerald-700'
                  : 'text-rose-700'
              }`}
            >
              {selectedDayTotals.dayBalance >= 0 ? '+' : ''}
              {formatBRL(selectedDayTotals.dayBalance)}
            </div>
          </div>
        </div>

        {/* Credit Card Invoices Due on this Day */}
        {selectedDateInvoices.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCardIcon className="h-3.5 w-3.5 text-violet-600" />
              Vencimento de Fatura de Cartão de Crédito
            </h4>
            <p className="text-[11px] text-slate-500">
              A fatura fica separada das compras lançadas; o pagamento aparece na data em que saiu da conta.
            </p>
            <div className="space-y-2">
              {selectedDateInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className={`rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    inv.isPaid
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-violet-200 bg-violet-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700">
                      <CardNetworkMark brand={inv.cardBrand} compact />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 font-display">
                          Fatura {inv.cardName}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          ({inv.cardBrand} · Fecha dia {inv.closingDay} · Vence dia {inv.dueDate.slice(-2)}{Number(inv.dueDate.slice(-2)) !== inv.dueDay ? ` (padrão ${inv.dueDay})` : ''})
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        {inv.isPaid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Fatura paga e liquidada da conta
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-violet-800 font-semibold">
                            <Clock className="h-3.5 w-3.5" />
                            Fatura aguardando pagamento
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-base font-bold tabular-nums text-slate-900 font-display">
                        {formatBRL(inv.amount)}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Total da Fatura
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transactions list on this Day */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            Lançamentos e Vencimentos Agendados ({selectedDateTxs.length})
          </h4>

          {selectedDateTxs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              Nenhum lançamento agendado para o dia {selectedDate}.
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => onOpenNewTransaction('expense', selectedDate)}
                  className="text-emerald-700 font-semibold hover:underline"
                >
                  Clique aqui para agendar uma conta ou receita neste dia.
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white overflow-hidden">
              {selectedDateTxs.map((tx) => {
                const cat = catMap.get(tx.categoryId);
                const isExpense = tx.type === 'expense';
                const isIncome = tx.type === 'income';
                const isPending = tx.status === 'pending';

                return (
                  <div
                    key={tx.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <CategoryIconBadge
                        icon={cat?.icon}
                        color={cat?.color}
                        size="md"
                      />

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {tx.description}
                          </span>

                          {/* Recurrence Badge */}
                          {tx.recurrence === 'installment' && tx.installmentNumber && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 border border-violet-200">
                              <Repeat className="h-2.5 w-2.5" />
                              Parcela {tx.installmentNumber}/{tx.installmentTotal}
                            </span>
                          )}
                          {tx.installmentPurchaseTotal !== undefined && (
                            <span className="text-xs font-medium text-violet-700">
                              Compra total {formatBRL(tx.installmentPurchaseTotal)}
                            </span>
                          )}

                          {tx.recurrence === 'fixed' && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                              <Repeat className="h-2.5 w-2.5" />
                              Despesa Fixa
                            </span>
                          )}

                          {tx.isShared && tx.sharedAmount && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200">
                              <Users className="h-2.5 w-2.5" />
                              Compartilhado ({tx.sharedPaidBy === 'member' ? 'Eu devo' : 'A receber'} {formatBRL(tx.sharedAmount)})
                            </span>
                          )}

                          {/* Status Badge */}
                          {isPending ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                              <Clock className="h-2.5 w-2.5" />
                              Pendente / A Vencer
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                              <Check className="h-2.5 w-2.5" />
                              Efetivado / Pago
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>
                            {cat?.name || 'Sem categoria'}
                          </span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1.5">
                            {tx.creditCardId ? (
                              <CardNetworkMark brand={cards.find((card) => card.id === tx.creditCardId)?.brand || 'Visa'} compact />
                            ) : tx.accountId ? (
                              <InstitutionMark
                                institution={accounts.find((account) => account.id === tx.accountId)?.institution}
                                accountName={accMap.get(tx.accountId)}
                                color={accounts.find((account) => account.id === tx.accountId)?.color}
                                size="xs"
                              />
                            ) : null}
                            <span>
                              {tx.creditCardId
                                ? `Cartão ${cardMap.get(tx.creditCardId)}`
                                : tx.accountId
                                ? accMap.get(tx.accountId)
                                : 'Caixa Geral'}
                            </span>
                          </span>
                          {tx.notes && (
                            <>
                              <span>•</span>
                              <span className="italic">{tx.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="text-right">
                        <div
                          className={`text-base font-bold tabular-nums font-display ${
                            isIncome
                              ? 'text-emerald-700'
                              : isPending
                              ? 'text-amber-900'
                              : 'text-slate-900'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {formatBRL(tx.installmentPurchaseTotal ?? tx.amount)}
                        </div>
                        {tx.installmentPurchaseTotal !== undefined && (
                          <div className="text-xs font-medium text-slate-600">
                            Em {tx.installmentTotal}x · parcela {tx.installmentNumber}/{tx.installmentTotal}: {formatBRL(tx.amount)}
                          </div>
                        )}
                        <span className="text-[11px] text-slate-400 capitalize">
                          {tx.paymentMethod === 'pix'
                            ? 'PIX'
                            : tx.paymentMethod === 'boleto'
                            ? 'Boleto'
                            : tx.paymentMethod === 'credit_card'
                            ? 'Cartão'
                            : tx.paymentMethod}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onToggleStatus(tx.id)}
                          title={
                            isPending
                              ? 'Efetivar / Marcar como Pago'
                              : 'Reabrir / Marcar como Pendente'
                          }
                          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                            isPending
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {isPending ? 'Efetivar' : 'Pago'}
                        </button>

                        <button
                          type="button"
                          onClick={() => onEditTransaction(tx)}
                          aria-label={`Editar ${tx.description}`}
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteTransaction(tx.id)}
                          aria-label={`Excluir ${tx.description}`}
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
