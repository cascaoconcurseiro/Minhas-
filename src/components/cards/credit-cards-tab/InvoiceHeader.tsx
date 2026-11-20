/** Cabeçalho da fatura: mês, situação, pagar e pagar parcial. Parte de CreditCardsTab (ver CreditCardsTab.tsx). */
import { formatBRL, formatMonthYearPT } from '../../../domain/finance/financeRules';
import { MissingSetupNotice } from '../../layout/MissingSetupNotice';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import type { CardPageContext } from './creditCardsTabContext';

export function InvoiceHeader({ form }: { form: CardPageContext }) {
  const {
    activeCard,
    activeSummary,
    brlAccounts,
    cardInvoicePaymentsInMonth,
    onDeleteTransaction,
    onPayInvoice,
    onRequestCreateAccount,
    paymentAccountDetails,
    paymentAccountId,
    selectedMonth,
    setPartialPayAmountStr,
    setPartialPayError,
    setPaymentAccountId,
    setShowPartialPayPanel,
    showPartialPayPanel,
  } = form;
  return (
    <>
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 px-4 sm:px-6 py-4">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Itens da Fatura — {activeCard.name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Competência {formatMonthYearPT(selectedMonth)}
                </p>
              </div>

              {activeSummary.invoicePendingAmount > 0 && brlAccounts.length === 0 ? (
                <MissingSetupNotice
                  testId="missing-brl-account-for-invoice"
                  message="Não há conta em reais cadastrada para pagar esta fatura (a fatura é em reais). Cadastre uma conta."
                  onAction={onRequestCreateAccount}
                />
              ) : activeSummary.invoicePendingAmount > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Conta para debitar pagamento da fatura"
                    value={paymentAccountId}
                    onChange={(e) => setPaymentAccountId(e.target.value)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800"
                  >
                    {brlAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        Debitar: {acc.name}
                      </option>
                    ))}
                  </select>
                {paymentAccountDetails && (
                  <InstitutionMark institution={paymentAccountDetails.institution} accountName={paymentAccountDetails.name} color={paymentAccountDetails.color} size="xs" />
                )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowPartialPayPanel((prev) => !prev);
                      setPartialPayError('');
                      setPartialPayAmountStr(
                        (Math.round((activeSummary.invoicePendingAmount / 2) * 100) / 100)
                          .toFixed(2)
                          .replace('.', ',')
                      );
                    }}
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    {showPartialPayPanel ? 'Cancelar Parcial' : 'Pagar Parcial'}
                  </button>
                  <button
                    type="button"
                    data-testid="pay-full-invoice-btn"
                    onClick={() => onPayInvoice(activeCard.id, paymentAccountId)}
                    className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    Quitar Total ({formatBRL(activeSummary.invoicePendingAmount)})
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{activeSummary.invoicePendingAmount < 0 ? 'Fatura com crédito (nada a pagar)' : 'Fatura Quitada'}</span>
                  </div>
                  {cardInvoicePaymentsInMonth.length > 0 && (
                    <button
                      type="button"
                      data-testid="reverse-invoice-payment-btn"
                      onClick={() =>
                        onDeleteTransaction(cardInvoicePaymentsInMonth[0].id, false)
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Estornar Pagamento (Refazer Cascata)</span>
                    </button>
                  )}
                </div>
              )}
            </div>
    </>
  );
}
