/** Pagamentos registrados, pagamento parcial e levar o restante para a próxima fatura. Parte de CreditCardsTab (ver CreditCardsTab.tsx). */
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { formatBRL, formatMonthYearPT, formatShortDateBR, parseBRLInput } from '../../../domain/finance/financeRules';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { InvoiceCarryOverPanel } from '../InvoiceCarryOverPanel';
import { getInvoiceCarryOverState } from '../../../domain/finance/invoiceCarryOver.ts';
import type { CardPageContext } from './creditCardsTabContext';

export function InvoicePaymentPanels({ form }: { form: CardPageContext }) {
  const {
    accMap,
    activeCard,
    activeSummary,
    cardInvoicePaymentsInMonth,
    onCarryOverInvoice,
    onDeleteTransaction,
    onPayInvoice,
    onUndoInvoiceCarryOver,
    partialPayAmountStr,
    partialPayError,
    paymentAccountId,
    selectedMonth,
    setPartialPayAmountStr,
    setPartialPayError,
    setShowPartialPayPanel,
    showPartialPayPanel,
    transactions,
  } = form;
  return (
    <>
{/* Recorded Invoice Payments Banner (Cascade Reversal Control) */}
            {cardInvoicePaymentsInMonth.length > 0 && (
              <div
                data-testid="invoice-payment-cascade-banner"
                className="border-b border-emerald-200 bg-emerald-50/70 px-4 sm:px-6 py-3 space-y-2"
              >
                {cardInvoicePaymentsInMonth.map((payTx) => (
                  <div
                    key={payTx.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 text-emerald-950">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>{payTx.description}</strong> — Pago em{' '}
                        <span className="font-mono tabular-nums">
                          {formatShortDateBR(payTx.date)}
                        </span>{' '}
                        via{' '}
                        <strong>
                          {accMap.get(payTx.accountId || '') || 'Conta Bancária'}
                        </strong>{' '}
                        (
                        <strong className="font-mono tabular-nums">
                          {formatBRL(payTx.amount)}
                        </strong>
                        )
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteTransaction(payTx.id, false)}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 transition-colors"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Apagar Pagamento e Reabrir Fatura (Cascata)</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Inline Partial Invoice Payment Panel (#4) */}
            {showPartialPayPanel && activeSummary.invoicePendingAmount > 0 && (
              <div
                data-testid="partial-invoice-payment-panel"
                className="border-b border-emerald-200 bg-emerald-50/70 px-4 sm:px-6 py-3.5 flex flex-wrap items-end justify-between gap-3"
              >
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-emerald-950">
                    Pagamento Parcial / Abatimento de Fatura — {activeCard.name}
                  </h3>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Informe o valor que deseja abater agora. O saldo restante continuará em aberto na fatura de {formatMonthYearPT(selectedMonth)}.
                  </p>
                  {partialPayError && (
                    <p role="alert" className="text-[11px] font-semibold text-rose-700 mt-1">
                      {partialPayError}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs font-mono font-bold text-emerald-900">R$</span>
                  <CurrencyInput
                    value={partialPayAmountStr}
                    currency="BRL"
                    onValueChange={(value) => {
                      setPartialPayAmountStr(value);
                      setPartialPayError('');
                    }}
                    placeholder="Ex: 500,00"
                    className="w-28 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const customAmt = parseBRLInput(partialPayAmountStr);
                      if (customAmt <= 0) {
                        setPartialPayError('Informe um valor maior que zero.');
                        return;
                      }
                      if (customAmt > activeSummary.invoicePendingAmount) {
                        setPartialPayError('O valor não pode ultrapassar o saldo pendente da fatura.');
                        return;
                      }
                      onPayInvoice(activeCard.id, paymentAccountId, customAmt);
                      setShowPartialPayPanel(false);
                    }}
                    className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Confirmar Abatimento
                  </button>
                </div>
              </div>
            )}

            {/* Pagamento parcial feito: levar o restante para a próxima fatura (com encargos) */}
            {onCarryOverInvoice && onUndoInvoiceCarryOver && (
              <InvoiceCarryOverPanel
                card={activeCard}
                invoiceMonth={selectedMonth}
                state={getInvoiceCarryOverState(activeCard, transactions, selectedMonth)}
                onCarryOver={(fee) => onCarryOverInvoice(activeCard.id, fee)}
                onUndo={() => onUndoInvoiceCarryOver(activeCard.id)}
              />
            )}
    </>
  );
}
