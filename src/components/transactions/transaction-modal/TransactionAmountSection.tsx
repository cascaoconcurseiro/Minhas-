/** Valor, calculadora rápida, descrição com sugestões e aviso de cadastro faltando. Parte de TransactionModal (ver TransactionModal.tsx). */
import { CURRENCY_CATALOG } from '../../../domain/trips/travelRules';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { Calendar, CheckCircle2, Sparkles } from 'lucide-react';
import { CategoryIconBadge } from '../../ui/CategoryIconBadge';
import { formatBRL } from '../../../domain/finance/financeRules';
import { describeLearnedSharing } from '../../../domain/budgets/learningRules';
import type { TransactionFormContext } from './transactionFormContext';

export function TransactionAmountSection({ form }: { form: TransactionFormContext }) {
  const {
    amountMode,
    amountStr,
    amountWarning,
    autoHabitNotice,
    autoSharingApplied,
    categoryId,
    date,
    dateWarning,
    description,
    duplicateWarning,
    editingTransaction,
    entryMode,
    handleApplySmartCategory,
    handleApplySmartSuggestion,
    handleQuickAddAmount,
    handleUndoAutoSharing,
    isMultiCurrencyOpen,
    isShared,
    isTripLinked,
    legacyInstallmentTotalUnknown,
    missingSetup,
    numericPreview,
    onRequestCreate,
    originalAmountStr,
    originalCurrency,
    parsedForeignAmount,
    recurrence,
    selectedTrip,
    setAmountStr,
    setDate,
    setDescription,
    setOriginalAmountStr,
    setStatus,
    sharedMemberId,
    sharedPaidBy,
    sharedSplitMode,
    smartCategorySuggestion,
    smartSuggestions,
    spendingWarning,
    status,
  } = form;
  return (
    <>
{/* Unified Hero Strip: Amount + Quick Calculator + Description + Smart Autocomplete */}
            <div
              data-testid="hero-calculator-value-box"
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 sm:p-4 space-y-3"
            >
              {legacyInstallmentTotalUnknown && (
                <p
                  data-testid="legacy-installment-total-warning"
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  O total original não está salvo e a série está incompleta. Este campo mostra apenas esta parcela; para evitar alterar pagamentos ou outras parcelas com um total estimado, a edição está limitada a este mês. Revise o histórico antes de ajustar o total da compra.
                </p>
              )}
              {isMultiCurrencyOpen && originalCurrency !== 'BRL' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-4">
                      <label
                        htmlFor="tx-foreign-amount"
                        className="block text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300 mb-1"
                      >
                        1. Valor na Moeda {isTripLinked ? 'da Viagem' : 'da Conta'} ({originalCurrency})
                      </label>
                      <div className="relative flex items-stretch">
                        <span className="inline-flex items-center justify-center rounded-l-xl border border-r-0 border-sky-400 dark:border-sky-700 bg-sky-100 dark:bg-sky-950 px-2.5 py-2 text-sm font-extrabold font-mono text-sky-900 dark:text-sky-200 select-none">
                          {CURRENCY_CATALOG[originalCurrency]?.flag}{' '}
                          {CURRENCY_CATALOG[originalCurrency]?.symbol}
                        </span>
                        <CurrencyInput
                          id="tx-foreign-amount"
                          data-testid="tx-foreign-amount-input"
                          currency={originalCurrency}
                          onValueChange={setOriginalAmountStr}
                          value={originalAmountStr}
                          placeholder="0,00"
                          className="w-full rounded-r-xl border border-sky-400 dark:border-sky-700 bg-white dark:bg-slate-900 px-3 py-2 text-lg sm:text-xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white focus:border-sky-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-4">
                      <label
                        htmlFor="tx-amount"
                        className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                      >
                        2. Equivalente R$ (Câmbio Médio)
                      </label>
                      <div className="relative flex items-stretch">
                        <span className="inline-flex items-center justify-center rounded-l-xl border border-r-0 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-2 text-sm font-extrabold font-mono text-slate-700 dark:text-slate-200 select-none">
                          🇧🇷 R$
                        </span>
                        <CurrencyInput
                          id="tx-amount"
                          data-testid="tx-amount-input"
                          currency="BRL"
                          onValueChange={setAmountStr}
                          readOnly={Boolean(isTripLinked && selectedTrip)}
                          value={amountStr}
                          placeholder="0,00"
                          className="w-full rounded-r-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-lg sm:text-xl font-extrabold font-mono tabular-nums text-slate-700 dark:text-slate-200 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-4">
                      <label
                        htmlFor="tx-date-input"
                        className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                      >
                        Data do Gasto
                      </label>
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-500 dark:text-sky-400" />
                        <input
                          id="tx-date-input"
                          data-testid="tx-date-input"
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-2.5 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:border-sky-600 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="tx-description"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                    >
                      Descrição do Gasto Internacional
                    </label>
                    <input
                      id="tx-description"
                      data-testid="tx-description-input"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={
                        selectedTrip
                          ? `Ex: Jantar em ${selectedTrip.destination.split(',')[0]}, Trem, Hotel, Museu...`
                          : 'Ex: Compra Amazon US, Hotel Booking, Software Internacional'
                      }
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
                    />

                    {/* Intelligent Category Suggestion Card in Multi-Currency */}
                    {!editingTransaction && entryMode !== 'transfer' && smartCategorySuggestion && (
                      <div
                        data-testid="smart-category-suggestion-card"
                        className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/90 dark:bg-emerald-950/40 p-2.5 sm:px-3 text-xs transition-all shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/80 p-1.5 text-emerald-700 dark:text-emerald-300 shrink-0">
                            <Sparkles className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-bold text-emerald-950 dark:text-emerald-100">
                                Sugestão Inteligente:
                              </span>
                              <span className="inline-flex items-center gap-1 font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 shrink-0">
                                <CategoryIconBadge
                                  icon={smartCategorySuggestion.categoryIcon}
                                  color={smartCategorySuggestion.categoryColor}
                                  size="sm"
                                />
                                {smartCategorySuggestion.categoryName}
                              </span>
                              <span className="rounded-full bg-emerald-200/80 dark:bg-emerald-800/60 px-2 py-0.5 text-[10px] font-extrabold text-emerald-900 dark:text-emerald-200">
                                {Math.round(smartCategorySuggestion.confidence * 100)}% provável
                              </span>
                            </div>
                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300/90 mt-0.5 truncate">
                              {smartCategorySuggestion.reason}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          {categoryId === smartCategorySuggestion.categoryId ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-white/90 dark:bg-slate-900/90 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-700 shadow-2xs">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              Categoria Selecionada
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApplySmartCategory(smartCategorySuggestion)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-2.5 py-1 shadow-2xs transition-colors"
                            >
                              <Sparkles className="h-3 w-3" />
                              Aplicar Categoria
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Row 1: Columns for related quantitative & temporal fields (Valor, Data, Situação) */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    {/* Column 1: Valor */}
                    <div
                      className={
                        entryMode === 'credit_card'
                          ? 'sm:col-span-7'
                          : 'sm:col-span-5'
                      }
                    >
                      <label
                        htmlFor="tx-amount"
                        className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                      >
                        {entryMode === 'credit_card' &&
                        recurrence === 'installment' &&
                        amountMode === 'total_divided'
                          ? 'Valor Total da Compra (R$)'
                          : entryMode === 'credit_card' &&
                            recurrence === 'installment'
                          ? 'Valor de Cada Parcela (R$)'
                          : recurrence === 'fixed'
                          ? entryMode === 'income'
                            ? 'Receita Fixa Mensal (R$)'
                            : entryMode === 'credit_card'
                            ? 'Assinatura / Valor Fixo (R$)'
                            : 'Despesa Fixa Mensal (R$)'
                          : entryMode === 'income'
                          ? 'Valor da Receita (R$)'
                          : entryMode === 'transfer'
                          ? 'Valor da Transferência (R$)'
                          : 'Valor do Lançamento (R$)'}
                      </label>
                      <div className="relative flex items-stretch">
                        <span
                          className={`inline-flex items-center justify-center rounded-l-xl border border-r-0 border-slate-300 dark:border-slate-700 px-3 py-2 text-base sm:text-lg font-extrabold font-mono select-none ${
                            entryMode === 'income'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : entryMode === 'credit_card'
                              ? 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300'
                              : entryMode === 'transfer'
                              ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          R$
                        </span>
                        <CurrencyInput
                          id="tx-amount"
                          data-testid="tx-amount-input"
                          currency="BRL"
                          onValueChange={setAmountStr}
                          value={amountStr}
                          placeholder="0,00"
                          className="w-full rounded-r-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xl sm:text-2xl font-extrabold font-mono tabular-nums tracking-tight text-slate-900 dark:text-white placeholder:text-slate-300 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Column 2: Data */}
                    <div
                      className={
                        entryMode === 'credit_card'
                          ? 'sm:col-span-5'
                          : 'sm:col-span-4'
                      }
                    >
                      <label
                        htmlFor="tx-date-input"
                        className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                      >
                        {entryMode === 'credit_card'
                          ? 'Data da Compra'
                          : entryMode === 'transfer'
                          ? 'Data da Movimentação'
                          : 'Data do Lançamento'}
                      </label>
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          id="tx-date-input"
                          data-testid="tx-date-input"
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-2.5 py-2 text-sm sm:text-base font-mono font-bold text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    {/* Column 3: Situação no Caixa (para despesa, receita e transferência) */}
                    {entryMode !== 'credit_card' && (
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                          Situação no Caixa
                        </label>
                        <div className="grid grid-cols-2 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 p-1 border border-slate-300/60 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => setStatus('paid')}
                            className={`rounded-lg py-1.5 px-1.5 text-xs font-bold transition-all ${
                              status === 'paid'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {entryMode === 'income'
                              ? 'Recebido'
                              : entryMode === 'transfer'
                              ? 'Efetivado'
                              : 'Pago'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus('pending')}
                            className={`rounded-lg py-1.5 px-1.5 text-xs font-bold transition-all ${
                              status === 'pending'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {entryMode === 'income'
                              ? 'A Receber'
                              : entryMode === 'transfer'
                              ? 'Agendado'
                              : 'Pendente'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Full-width Descrição / Identificação */}
                  <div>
                    <label
                      htmlFor="tx-description"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                    >
                      Descrição / Identificação
                    </label>
                    <input
                      id="tx-description"
                      data-testid="tx-description-input"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={
                        isMultiCurrencyOpen && selectedTrip
                          ? `Ex: Jantar em ${selectedTrip.destination.split(',')[0]}, Trem, Hotel...`
                          : entryMode === 'income'
                          ? 'Ex: Salário CLT, Aluguel Recebido, Dividendos'
                          : entryMode === 'credit_card'
                          ? 'Ex: Supermercado, Passagem Aérea, Assinatura'
                          : entryMode === 'transfer'
                          ? 'Ex: Transferência Reserva, Aporte FIIs, Pagamento Fatura'
                          : 'Ex: Condomínio, Conta de Luz, Internet Fibra'
                      }
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
                    />

                    {/* Intelligent Category Suggestion Card */}
                    {!editingTransaction && entryMode !== 'transfer' && smartCategorySuggestion && (
                      <div
                        data-testid="smart-category-suggestion-card"
                        className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/90 dark:bg-emerald-950/40 p-2.5 sm:px-3 text-xs transition-all shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/80 p-1.5 text-emerald-700 dark:text-emerald-300 shrink-0">
                            <Sparkles className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-bold text-emerald-950 dark:text-emerald-100">
                                Sugestão Inteligente:
                              </span>
                              <span className="inline-flex items-center gap-1 font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 shrink-0">
                                <CategoryIconBadge
                                  icon={smartCategorySuggestion.categoryIcon}
                                  color={smartCategorySuggestion.categoryColor}
                                  size="sm"
                                />
                                {smartCategorySuggestion.categoryName}
                              </span>
                              <span className="rounded-full bg-emerald-200/80 dark:bg-emerald-800/60 px-2 py-0.5 text-[10px] font-extrabold text-emerald-900 dark:text-emerald-200">
                                {Math.round(smartCategorySuggestion.confidence * 100)}% provável
                              </span>
                            </div>
                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300/90 mt-0.5 truncate">
                              {smartCategorySuggestion.reason}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          {categoryId === smartCategorySuggestion.categoryId ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-white/90 dark:bg-slate-900/90 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-700 shadow-2xs">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              Categoria Selecionada
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApplySmartCategory(smartCategorySuggestion)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-2.5 py-1 shadow-2xs transition-colors"
                            >
                              <Sparkles className="h-3 w-3" />
                              Aplicar Categoria
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Increment Calculator + Smart Autocomplete Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] font-semibold text-slate-400 mr-1">
                    Valor rápido:
                  </span>
                  {[10, 50, 100, 500].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuickAddAmount(val)}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:border-emerald-300 hover:text-emerald-800 transition-colors"
                    >
                      +{val}
                    </button>
                  ))}
                  {(numericPreview > 0 || parsedForeignAmount > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setAmountStr('');
                        setOriginalAmountStr('');
                      }}
                      className="rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {!editingTransaction && smartSuggestions.length > 0 && (
                  <div
                    data-testid="smart-autocomplete-bar"
                    className="flex flex-wrap items-center gap-1"
                  >
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 mr-0.5">
                      <Sparkles className="h-3 w-3 text-emerald-600 shrink-0" />
                      Recentes:
                    </span>
                    {smartSuggestions.slice(0, 3).map((sug) => (
                      <button
                        key={sug.cleanDescription}
                        type="button"
                        onClick={() => handleApplySmartSuggestion(sug)}
                        title={`Auto-preencher categoria, conta e último valor (${formatBRL(
                          sug.lastAmount
                        )})`}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-emerald-300 hover:bg-emerald-50/70 transition-colors"
                      >
                        <span className="truncate max-w-[115px] font-semibold">
                          {sug.cleanDescription}
                        </span>
                        <span className="font-mono tabular-nums text-[10px] text-slate-400">
                          {formatBRL(sug.lastAmount)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {!editingTransaction &&
                  autoSharingApplied &&
                  isShared &&
                  sharedMemberId === autoSharingApplied.memberId &&
                  sharedPaidBy === autoSharingApplied.paidBy &&
                  sharedSplitMode === autoSharingApplied.splitMode && (
                    <div
                      role="status"
                      data-testid="auto-sharing-notice"
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30 px-2.5 py-1.5 text-[11px] text-indigo-900 dark:text-indigo-200"
                    >
                      <span className="inline-flex items-start gap-1.5 min-w-0">
                        <Sparkles className="h-3 w-3 mt-0.5 text-indigo-600 shrink-0" />
                        <span>{describeLearnedSharing(autoSharingApplied)}</span>
                      </span>
                      <button
                        type="button"
                        data-testid="auto-sharing-undo"
                        onClick={handleUndoAutoSharing}
                        className="shrink-0 font-bold underline underline-offset-2 hover:text-indigo-700"
                      >
                        Desfazer
                      </button>
                    </div>
                  )}

                {!editingTransaction && autoHabitNotice && (
                  <p
                    role="status"
                    data-testid="auto-habit-notice"
                    className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
                  >
                    <Sparkles className="h-3 w-3 text-emerald-600 shrink-0" />
                    {autoHabitNotice}
                  </p>
                )}

                {duplicateWarning && (
                  <p
                    role="alert"
                    data-testid="duplicate-warning"
                    className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200"
                  >
                    {duplicateWarning.message}
                  </p>
                )}

                {dateWarning && (
                  <p
                    role="status"
                    data-testid="date-warning"
                    className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200"
                  >
                    {dateWarning}
                  </p>
                )}

                {spendingWarning && (
                  <p
                    role="alert"
                    data-testid="spending-warning"
                    className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200"
                  >
                    {spendingWarning.message} Você ainda pode salvar.
                  </p>
                )}

                {amountWarning && (
                  <p
                    role="status"
                    data-testid="amount-warning"
                    className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200"
                  >
                    {amountWarning.message}
                  </p>
                )}
              </div>
            </div>

            {missingSetup && (
              <div
                role="alert"
                data-testid={missingSetup.testId}
                className="flex flex-col gap-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">{missingSetup.message}</p>
                {onRequestCreate && (
                  <button
                    type="button"
                    data-testid="missing-setup-action"
                    onClick={() => onRequestCreate(missingSetup.kind)}
                    className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    {missingSetup.action}
                  </button>
                )}
              </div>
            )}
    </>
  );
}
