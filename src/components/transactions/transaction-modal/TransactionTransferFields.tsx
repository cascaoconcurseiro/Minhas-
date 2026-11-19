/** Transferência: investimento, pagamento de fatura e câmbio entre contas. Parte de TransactionCoreFields (ver TransactionCoreFields.tsx). */
import { AccountSelectShell } from './transactionModalConfig';
import { getAccountLabel } from '../../../domain/finance/accountLabels';
import { addMonthsToYearMonth, calculateCreditCardSummary, formatBRL, formatMonthYearPT } from '../../../domain/finance/financeRules';
import { CreditCardFace } from '../../cards/CreditCardFace';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import { getAccountCurrency } from '../../../domain/finance/transferRules';
import { CURRENCY_CATALOG, formatExchangeRateBR } from '../../../domain/trips/travelRules';
import { CurrencyInput } from '../../ui/CurrencyInput';
import type { TransactionFormContext } from './transactionFormContext';

export function TransactionTransferFields({ form }: { form: TransactionFormContext }) {
  const {
    accountId,
    accounts,
    billPaymentCardId,
    billPaymentInvoiceMonth,
    billPaymentInvoiceSummary,
    cards,
    description,
    destinationAccountId,
    destinationAccountOptions,
    editingTransaction,
    handleTransferSubModeChange,
    investments,
    isInvestmentTransfer,
    numericPreview,
    selectedBillPaymentCard,
    selectedDestinationAccount,
    selectedMonth,
    selectedPaymentAccount,
    setAccountId,
    setAmountStr,
    setBillPaymentCardId,
    setBillPaymentInvoiceMonth,
    setDescription,
    setDestinationAccountId,
    setTransferForeignAmountStr,
    setTransferSubMode,
    transactions,
    transferForeignAmount,
    transferForeignAmountStr,
    transferForeignCurrency,
    transferPlan,
    transferSubMode,
  } = form;
  return (
    <>
{/* Smart Sub-Selector for Transfers, Investments & Credit Card Bill Payment */}
                {!editingTransaction && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Finalidade da Movimentação
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleTransferSubModeChange('bank_to_bank')
                        }
                        className={`rounded-xl border px-3 py-2 text-left text-xs ${
                          transferSubMode === 'bank_to_bank'
                            ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-2xs'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 font-semibold'
                        }`}
                      >
                        <div>Entre Contas Bancárias</div>
                        <div
                          className={`text-[10px] ${
                            transferSubMode === 'bank_to_bank'
                              ? 'text-slate-300 dark:text-slate-600'
                              : 'text-slate-400'
                          }`}
                        >
                          Conta corrente ⇄ Reserva
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleTransferSubModeChange('card_bill_payment')
                        }
                        className={`rounded-xl border px-3 py-2 text-left text-xs ${
                          transferSubMode === 'card_bill_payment'
                            ? 'border-violet-600 bg-violet-600 text-white font-bold shadow-2xs'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 font-semibold'
                        }`}
                      >
                        <div>Pagamento de Fatura</div>
                        <div
                          className={`text-[10px] ${
                            transferSubMode === 'card_bill_payment'
                              ? 'text-violet-100'
                              : 'text-slate-400'
                          }`}
                        >
                          Quitar cartão pelo banco
                        </div>
                      </button>

                      {investments.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            handleTransferSubModeChange(
                              'investment_contribution'
                            )
                          }
                          className={`rounded-xl border px-3 py-2 text-left text-xs ${
                            transferSubMode === 'investment_contribution'
                              ? 'border-emerald-600 bg-emerald-600 text-white font-bold shadow-2xs'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 font-semibold'
                          }`}
                        >
                          <div>Aporte em Investimento</div>
                          <div
                            className={`text-[10px] ${
                              transferSubMode === 'investment_contribution'
                                ? 'text-emerald-100'
                                : 'text-slate-400'
                            }`}
                          >
                            Direto na carteira de ativos
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="tx-transfer-origin-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Sai da Conta Bancária (Origem)
                    </label>
                    <AccountSelectShell account={selectedPaymentAccount}>
<select
                      id="tx-transfer-origin-select"
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3 py-2 text-sm text-slate-900 dark:text-white"
                    >
                      {!accountId && <option value="">Escolha a conta de origem…</option>}
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {getAccountLabel(acc, accounts)}
                        </option>
                      ))}
                    </select>
</AccountSelectShell>
                  </div>

                  {transferSubMode === 'card_bill_payment' ? (
                    <div>
                      <label htmlFor="tx-bill-card-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Cartão de Crédito (Fatura a Quitar)
                      </label>
                      <select
                        id="tx-bill-card-select"
                        value={billPaymentCardId}
                        onChange={(e) => {
                          const cid = e.target.value;
                          setBillPaymentCardId(cid);
                          const cObj = cards.find((c) => c.id === cid);
                          if (cObj) {
                            setDescription(`Pagamento Fatura ${cObj.name}`);
                            const pending = calculateCreditCardSummary(
                              cObj,
                              transactions,
                              billPaymentInvoiceMonth
                            ).invoicePendingAmount;
                            setAmountStr(pending > 0 ? pending.toFixed(2).replace('.', ',') : '');
                          }
                        }}
                        className="w-full rounded-lg border border-violet-300 dark:border-violet-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white"
                      >
                        {cards.map((card) => (
                          <option key={card.id} value={card.id}>
                            💳 {card.name} (Venc. dia {card.dueDay})
                          </option>
                        ))}
                      </select>
                      {selectedBillPaymentCard && (
                        <div className="mt-2 flex items-center gap-3">
                          <CreditCardFace card={selectedBillPaymentCard} size="compact" />
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Cartão selecionado para quitar a fatura
                          </span>
                        </div>
                      )}
                      <div className="mt-3">
                        <label htmlFor="tx-bill-invoice-month" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Fatura que será quitada
                        </label>
                        <select
                          id="tx-bill-invoice-month"
                          data-testid="bill-invoice-month-select"
                          value={billPaymentInvoiceMonth}
                          onChange={(e) => {
                            const month = e.target.value;
                            setBillPaymentInvoiceMonth(month);
                            if (selectedBillPaymentCard) {
                              const pending = calculateCreditCardSummary(
                                selectedBillPaymentCard,
                                transactions,
                                month
                              ).invoicePendingAmount;
                              setAmountStr(pending > 0 ? pending.toFixed(2).replace('.', ',') : '');
                            }
                          }}
                          className="w-full rounded-lg border border-violet-300 dark:border-violet-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white"
                        >
                          {Array.from({ length: 7 }, (_, index) =>
                            addMonthsToYearMonth(selectedMonth, index - 3)
                          ).map((month) => (
                            <option key={month} value={month}>{formatMonthYearPT(month)}</option>
                          ))}
                        </select>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          Em aberto nesta fatura: <strong>{formatBRL(billPaymentInvoiceSummary?.invoicePendingAmount || 0)}</strong>. O valor é preenchido automaticamente; você pode informar um pagamento parcial.
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          O pagamento debita a conta selecionada e quita o cartão. As compras já contam como despesas por categoria, então esta liquidação não duplica os gastos.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="tx-transfer-destination-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Destino (Conta ou Aporte em Ativo)
                      </label>
                      <select
                        id="tx-transfer-destination-select"
                        value={destinationAccountId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDestinationAccountId(val);
                          if (val.startsWith('inv:')) {
                            setTransferSubMode('investment_contribution');
                            const assetId = val.slice(4);
                            const asset = investments.find(
                              (a) => a.id === assetId
                            );
                            if (
                              asset &&
                              (!description.trim() ||
                                description.startsWith('Aporte em '))
                            ) {
                              setDescription(`Aporte em ${asset.ticker}`);
                            }
                          } else {
                            setTransferSubMode('bank_to_bank');
                          }
                        }}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                      >
                        {!destinationAccountId && <option value="">Escolha a conta de destino…</option>}
                        <optgroup label="Contas Bancárias & Carteiras">
                          {destinationAccountOptions.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {getAccountLabel(acc, accounts)}
                            </option>
                          ))}
                        </optgroup>
                        {investments.length > 0 && (
                          <optgroup label="Aporte Direto na Carteira de Investimentos">
                            {investments.map((asset) => (
                              <option key={asset.id} value={`inv:${asset.id}`}>
                                Aporte: {asset.ticker} ({asset.name})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {selectedDestinationAccount && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <InstitutionMark
                            institution={selectedDestinationAccount.institution}
                            accountName={selectedDestinationAccount.name}
                            color={selectedDestinationAccount.color}
                            size="xs"
                          />
                          <span>Destino: {selectedDestinationAccount.name}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {transferPlan?.kind === 'unsupported' && (
                  <p role="alert" data-testid="transfer-unsupported-currency" className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-800 dark:text-rose-200">
                    {transferPlan.message}
                  </p>
                )}

                {transferSubMode === 'card_bill_payment' && getAccountCurrency(selectedPaymentAccount) !== 'BRL' && (
                  <p role="alert" data-testid="bill-foreign-account-warning" className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-800 dark:text-rose-200">
                    A fatura do cartão é em reais. Pague a fatura por uma conta em reais; para usar dinheiro de uma conta em {getAccountCurrency(selectedPaymentAccount)}, primeiro transfira para uma conta em reais informando o câmbio.
                  </p>
                )}

                {transferForeignCurrency && (
                  <div data-testid="transfer-fx-block" className="rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/30 p-3 space-y-2">
                    <p className="text-xs font-semibold text-sky-900 dark:text-sky-200">
                      {isInvestmentTransfer
                        ? `Aporte saindo de conta em ${transferForeignCurrency}: informe quanto saiu em ${transferForeignCurrency}. O valor em R$ acima é o equivalente em reais.`
                        : transferPlan?.sourceIsForeign && transferPlan.destinationIsForeign
                        ? `As duas contas são em ${transferForeignCurrency}: informe o valor em ${transferForeignCurrency}. O valor em R$ acima é só o equivalente em reais do dia.`
                        : transferPlan?.sourceIsForeign
                        ? `O dinheiro sai em ${transferForeignCurrency} e entra em reais: informe quanto saiu em ${transferForeignCurrency}. O valor em R$ acima é o que entrou na conta de destino.`
                        : `O dinheiro sai em reais e entra em ${transferForeignCurrency}: informe quanto entrou em ${transferForeignCurrency}. O valor em R$ acima é o que saiu da conta de origem.`}
                    </p>
                    <div>
                      <label htmlFor="tx-transfer-foreign-amount" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Valor em {transferForeignCurrency}
                      </label>
                      <div className="relative flex items-stretch">
                        <span className="inline-flex items-center justify-center rounded-l-xl border border-r-0 border-sky-400 dark:border-sky-700 bg-sky-100 dark:bg-sky-950 px-2.5 py-2 text-sm font-extrabold font-mono text-sky-900 dark:text-sky-200 select-none">
                          {CURRENCY_CATALOG[transferForeignCurrency]?.flag} {CURRENCY_CATALOG[transferForeignCurrency]?.symbol}
                        </span>
                        <CurrencyInput
                          id="tx-transfer-foreign-amount"
                          data-testid="tx-transfer-foreign-amount-input"
                          currency={transferForeignCurrency}
                          value={transferForeignAmountStr}
                          onValueChange={setTransferForeignAmountStr}
                          placeholder="0,00"
                          className="w-full rounded-r-xl border border-sky-400 dark:border-sky-700 bg-white dark:bg-slate-900 px-3 py-2 text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white focus:border-sky-600 focus:outline-none"
                        />
                      </div>
                    </div>
                    {transferForeignAmount > 0 && numericPreview > 0 && (
                      <p data-testid="transfer-fx-rate" className="text-[11px] text-slate-600 dark:text-slate-300">
                        Cotação efetiva: <strong>{formatExchangeRateBR(numericPreview / transferForeignAmount)}</strong> por {transferForeignCurrency} (já com taxas e IOF, se houver).
                      </p>
                    )}
                  </div>
                )}
    </>
  );
}
