/** Categoria, conta ou cartão, data e impacto no orçamento. Parte de TransactionCoreFields (ver TransactionCoreFields.tsx). */
import { AlertTriangle, Sparkles } from 'lucide-react';
import { CategoryIconBadge } from '../../ui/CategoryIconBadge';
import { addMonthsToYearMonth, formatBRL, formatMonthYearPT, resolveCreditCardInvoiceMonth } from '../../../domain/finance/financeRules';
import { AccountSelectShell } from './transactionModalConfig';
import { CURRENCY_CATALOG } from '../../../domain/trips/travelRules';
import { getAccountLabel } from '../../../domain/finance/accountLabels';
import type { TransactionFormContext } from './transactionFormContext';

export function TransactionCategoryAccountFields({ form }: { form: TransactionFormContext }) {
  const {
    accountId,
    accounts,
    cards,
    categoryId,
    creditCardId,
    currencyRegime,
    date,
    entryMode,
    groupedCategoryOptions,
    handleApplySmartCategory,
    handleCategoryChange,
    invoiceCompetenceMonth,
    isInvoiceMonthOverrideOpen,
    isTripLinked,
    liveBudgetImpact,
    paymentChosen,
    selectedCategoryObj,
    selectedMonth,
    selectedPaymentAccount,
    selectedTrip,
    setAccountId,
    setCreditCardId,
    setCurrencyRegime,
    setExchangeRateStr,
    setInvoiceCompetenceMonth,
    setIofPercentStr,
    setIsInvoiceMonthOverrideOpen,
    setIsMultiCurrencyOpen,
    setOriginalCurrency,
    smartCategorySuggestion,
    smartCategoryTarget,
  } = form;
  return (
    <>
{/* Row 1: Category + Account/Card */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <label htmlFor="tx-category-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Categoria
                      </label>
                      {smartCategorySuggestion && categoryId === smartCategorySuggestion.categoryId && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          <Sparkles className="h-2.5 w-2.5" />
                          Sugerida pelo histórico
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedCategoryObj && (
                        <CategoryIconBadge
                          icon={selectedCategoryObj.icon}
                          color={selectedCategoryObj.color}
                          size="sm"
                        />
                      )}
                      <select
                        id="tx-category-select"
                        value={categoryId}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="w-full min-w-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                      >
                        {!categoryId && <option value="">Escolha a categoria…</option>}
                        {groupedCategoryOptions.map((group) =>
                          group.label ? (
                            <optgroup key={group.key} label={group.label}>
                              {group.items.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </optgroup>
                          ) : (
                            group.items.map((cat) => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))
                          )
                        )}
                      </select>
                    </div>
                    {smartCategorySuggestion && smartCategoryTarget &&
                      categoryId !== smartCategoryTarget.categoryId && (
                      <button
                        type="button"
                        onClick={() => handleApplySmartCategory(smartCategorySuggestion)}
                        className="mt-1 text-left inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
                      >
                        <Sparkles className="h-3 w-3 shrink-0" />
                        <span>Sugerir: {smartCategorySuggestion.categoryName} ({Math.round(smartCategorySuggestion.confidence * 100)}%)</span>
                      </button>
                    )}
                  </div>

                  <div className={entryMode === 'expense' && !paymentChosen ? 'hidden' : undefined}>
                    <label htmlFor="tx-payment-source-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {entryMode === 'credit_card'
                        ? 'Cartão Utilizado'
                        : isTripLinked && selectedTrip
                        ? `Conta Internacional (${selectedTrip.currency})`
                        : entryMode === 'income'
                        ? 'Cai em qual Conta?'
                        : 'Sai de qual Conta?'}
                    </label>
                    {entryMode === 'credit_card' ? (
                      <div className="space-y-1.5">
                        <select
                          id="tx-payment-source-select"
                          value={creditCardId}
                          onChange={(e) => setCreditCardId(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                        >
                          {!creditCardId && <option value="">Escolha o cartão…</option>}
                          {cards.map((card) => (
                            <option key={card.id} value={card.id}>
                              {card.name} (Fecha dia {card.closingDay} · Vence dia {card.dueDay})
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const chosenCard =
                            cards.find((c) => c.id === creditCardId) || cards[0];
                          const purchaseMonth = date.slice(0, 7) || selectedMonth;
                          const nextMonth = addMonthsToYearMonth(purchaseMonth, 1);
                          const prevMonth = addMonthsToYearMonth(purchaseMonth, -1);
                          const autoInvoiceMonth = resolveCreditCardInvoiceMonth(
                            date,
                            chosenCard
                          );
                          const hasManualInvoiceMonth =
                            invoiceCompetenceMonth !== autoInvoiceMonth;
                          const monthOptions = Array.from(
                            new Set([
                              prevMonth,
                              purchaseMonth,
                              nextMonth,
                              addMonthsToYearMonth(purchaseMonth, 2),
                              invoiceCompetenceMonth,
                            ])
                          )
                            .filter(Boolean)
                            .sort();

                          return (
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                              <button
                                type="button"
                                data-testid="toggle-invoice-month-override"
                                aria-expanded={isInvoiceMonthOverrideOpen}
                                onClick={() => {
                                  if (hasManualInvoiceMonth) {
                                    setInvoiceCompetenceMonth(autoInvoiceMonth);
                                    setIsInvoiceMonthOverrideOpen(false);
                                  } else {
                                    setIsInvoiceMonthOverrideOpen((open) => !open);
                                  }
                                }}
                                className="rounded px-1.5 py-0.5 font-semibold text-violet-700 underline decoration-violet-300 underline-offset-2 hover:text-violet-900 dark:text-violet-300 dark:hover:text-white"
                              >
                                {hasManualInvoiceMonth
                                  ? 'Usar estimativa'
                                  : isInvoiceMonthOverrideOpen
                                  ? 'Ocultar ajuste'
                                  : 'Ajustar fatura'}
                              </button>
                              {isInvoiceMonthOverrideOpen && (
                                <select
                                  aria-label="Ajuste manual da fatura"
                                  data-testid="invoice-month-override"
                                  value={invoiceCompetenceMonth}
                                  onChange={(e) => setInvoiceCompetenceMonth(e.target.value)}
                                  className="rounded border border-violet-300 dark:border-violet-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-[11px] font-bold text-violet-900 dark:text-violet-200"
                                >
                                  {monthOptions.map((m) => (
                                    <option key={m} value={m}>
                                      {formatMonthYearPT(m)}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : isTripLinked && selectedTrip ? (
                      (() => {
                        const matchingIntl = accounts.filter(
                          (a) =>
                            a.type === 'international' &&
                            a.currency === selectedTrip.currency
                        );
                        if (currencyRegime === 'cash_fx') {
                          return (
                            <div className="w-full rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/40 px-2.5 py-2 text-xs font-bold text-sky-900 dark:text-sky-200 truncate">
                              💵 Espécie da Viagem ({selectedTrip.currency})
                            </div>
                          );
                        }
                        return (
                          <div className="space-y-2">
                            <AccountSelectShell account={selectedPaymentAccount}>
<select
                              id="tx-payment-source-select"
                              value={accountId}
                              onChange={(e) => setAccountId(e.target.value)}
                              className="w-full rounded-lg border border-sky-300 dark:border-sky-700 bg-sky-50/60 dark:bg-slate-900 pl-10 pr-2.5 py-2 text-xs font-bold text-sky-950 dark:text-white"
                            >
                              <option value="">
                                {matchingIntl.length > 0
                                  ? `— Selecionar conta em ${selectedTrip.currency} —`
                                  : `Bolso Câmbio da Viagem (${selectedTrip.currency})`}
                              </option>
                              {matchingIntl.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {CURRENCY_CATALOG[selectedTrip.currency]?.flag} {acc.name} ({selectedTrip.currency})
                                </option>
                              ))}
                            </select>
</AccountSelectShell>
                          </div>
                        );
                      })()
                    ) : (
                      <>
                        <AccountSelectShell account={selectedPaymentAccount}>
<select
                          id="tx-payment-source-select"
                          value={accountId}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            setAccountId(nextId);
                            const chosen = accounts.find((a) => a.id === nextId);
                            if (
                              chosen &&
                              chosen.type === 'international' &&
                              chosen.currency &&
                              chosen.currency !== 'BRL'
                            ) {
                              setIsMultiCurrencyOpen(true);
                              setOriginalCurrency(chosen.currency);
                              setCurrencyRegime('global_account');
                              const defRate =
                                CURRENCY_CATALOG[chosen.currency]
                                  ?.defaultCommercialRateBrl || 5.8;
                              setExchangeRateStr(
                                defRate.toFixed(4).replace('.', ',')
                              );
                              setIofPercentStr('1,10');
                            } else if (!isTripLinked) {
                              setIsMultiCurrencyOpen(false);
                              setOriginalCurrency('BRL');
                            }
                          }}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                        >
                          {!accountId && <option value="">Escolha a conta…</option>}
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.type === 'international' && acc.currency
                                ? `${CURRENCY_CATALOG[acc.currency]?.flag || '🌎'} ${acc.name} (${acc.currency})`
                                : getAccountLabel(acc, accounts)}
                            </option>
                          ))}
                        </select>
</AccountSelectShell>
                      </>
                    )}
                  </div>
                </div>

                {/* Live Category Budget Micro-Bar */}
                {liveBudgetImpact && liveBudgetImpact.hasBudget && (
                  <div
                    data-testid="live-category-budget-bar"
                    className={`rounded-xl border px-3.5 py-2 text-xs ${
                      liveBudgetImpact.statusAfter === 'over'
                        ? 'border-rose-200 dark:border-rose-800 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                        : liveBudgetImpact.statusAfter === 'warning'
                        ? 'border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="font-semibold flex items-center gap-1.5">
                        {liveBudgetImpact.statusAfter !== 'ok' && (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                        )}
                        Teto de {liveBudgetImpact.categoryName} ({formatMonthYearPT(liveBudgetImpact.month)}):
                      </span>
                      <span className="font-mono font-bold tabular-nums">
                        {formatBRL(liveBudgetImpact.projectedSpent)} /{' '}
                        {formatBRL(liveBudgetImpact.budgetLimit)} (
                        {liveBudgetImpact.percentAfter.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/80 dark:bg-slate-900 overflow-hidden border border-slate-200/60 dark:border-slate-700">
                      <div
                        className={`h-full ${
                          liveBudgetImpact.statusAfter === 'over'
                            ? 'bg-rose-600'
                            : liveBudgetImpact.statusAfter === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            liveBudgetImpact.percentAfter
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
    </>
  );
}
