/** Galeria de cartões e cadastro de novo cartão. Parte de CreditCardsTab (ver CreditCardsTab.tsx). */
import { ChevronRight, CreditCard as CreditCardIcon, Plus } from 'lucide-react';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { DayOfMonthSelect } from '../DayOfMonthSelect';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import { CardNetworkMark } from '../CardNetworkMark';
import { CreditCardFace } from '../CreditCardFace';
import { formatBRL, formatMonthYearPT } from '../../../domain/finance/financeRules';
import type { CardPageContext } from './creditCardsTabContext';

export function CardsGallery({ form }: { form: CardPageContext }) {
  const {
    brlAccounts,
    cardSummaries,
    cards,
    formError,
    handleCreateCard,
    newCardAccount,
    newCardAccountDetails,
    newCardBrand,
    newCardClosing,
    newCardDue,
    newCardLimit,
    newCardName,
    newClosingNext,
    onOpenNewCardExpense,
    selectedMonth,
    setActiveViewCardId,
    setAnticipatingGroupId,
    setNewCardAccount,
    setNewCardBrand,
    setNewCardClosing,
    setNewCardDue,
    setNewCardLimit,
    setNewCardName,
    setNewClosingNext,
    setPaymentAccountId,
    setSelectedCardId,
    setShowNewCardForm,
    setShowPartialPayPanel,
    showNewCardForm,
  } = form;
  return (
    <>
{/* Interactive Credit Card Gallery Section */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Seus Cartões de Crédito
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clique em qualquer cartão abaixo para entrar na página exclusiva do cartão, pagar a fatura ou ver todos os lançamentos
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewCardForm((prev) => !prev)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {showNewCardForm ? 'Fechar Cadastro' : '+ Novo Cartão'}
                </button>
                <button
                  type="button"
                  onClick={onOpenNewCardExpense}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Compra no Cartão</span>
                </button>
              </div>
            </div>

            {/* Inline New Card Form */}
            {showNewCardForm && (
              <form
                onSubmit={handleCreateCard}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-6 space-y-4 animate-expand-in"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">Cadastrar Novo Cartão de Crédito</h3>
                  <span className="text-xs text-slate-500 hidden sm:inline">Controle manual de faturas e parcelamentos</span>
                </div>

                {formError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-2">
                    <label htmlFor="card-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome do Cartão
                    </label>
                    <input
                      id="card-name-input"
                      type="text"
                      value={newCardName}
                      onChange={(e) => setNewCardName(e.target.value)}
                      placeholder="Ex: Banco Inter Black, C6 Carbon, Ourocard"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label htmlFor="card-brand-select" className="block text-xs font-semibold text-slate-700 mb-1">
                      Bandeira
                    </label>
                    <select
                      id="card-brand-select"
                      value={newCardBrand}
                      onChange={(e) => setNewCardBrand(e.target.value as 'Mastercard' | 'Visa' | 'Elo')}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                    >
                      <option value="Mastercard">Mastercard</option>
                      <option value="Visa">Visa</option>
                      <option value="Elo">Elo</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="card-limit-input" className="block text-xs font-semibold text-slate-700 mb-1">
                      Limite Total (R$)
                    </label>
                    <CurrencyInput
                      id="card-limit-input"
                      value={newCardLimit}
                      currency="BRL"
                      onValueChange={setNewCardLimit}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="card-closing-input" className="block text-xs font-semibold text-slate-700 mb-1">
                        Dia Fecha
                      </label>
                      <DayOfMonthSelect
                        id="card-closing-input"
                        value={newCardClosing}
                        onChange={setNewCardClosing}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs tabular-nums text-slate-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="card-due-input" className="block text-xs font-semibold text-slate-700 mb-1">
                        Dia Vence
                      </label>
                      <DayOfMonthSelect
                        id="card-due-input"
                        value={newCardDue}
                        onChange={setNewCardDue}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs tabular-nums text-slate-900"
                      />
                    </div>
                  </div>

              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input type="checkbox" id="card-new-closing-next-2" checked={newClosingNext} onChange={(e) => setNewClosingNext(e.target.checked)} className="mt-0.5 h-4 w-4" />
                <span>Compra no próprio dia do fechamento vai para a <strong>próxima</strong> fatura</span>
              </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <label htmlFor="card-default-acc">Conta padrão:</label>
                    <select
                      id="card-default-acc"
                      value={newCardAccount}
                      onChange={(e) => setNewCardAccount(e.target.value)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                    >
                      {brlAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    {newCardAccountDetails && (
                      <InstitutionMark institution={newCardAccountDetails.institution} accountName={newCardAccountDetails.name} color={newCardAccountDetails.color} size="xs" />
                    )}
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Salvar Cartão
                  </button>
                </div>
              </form>
            )}

            {/* Grid of Credit Cards — Click any card to enter its dedicated page */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((card) => {
                const sum = cardSummaries.find((s) => s.cardId === card.id);
                const invoiceTotal = sum?.invoiceTotal ?? 0;
                const usedLimit = sum?.usedLimit ?? 0;
                const availableLimit = sum?.availableLimit ?? card.limit;
                const usagePercent = sum?.usagePercent ?? 0;
                const isPaid = sum?.isInvoicePaid ?? false;

                return (
                  <div
                    key={card.id}
                    data-testid={`credit-card-item-${card.id}`}
                    onClick={() => {
                      setSelectedCardId(card.id);
                      setActiveViewCardId(card.id);
                      setPaymentAccountId(card.defaultAccountId || brlAccounts[0]?.id || '');
                      setShowPartialPayPanel(false);
                      setAnticipatingGroupId(null);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedCardId(card.id);
                        setActiveViewCardId(card.id);
                      }
                    }}
                    className="group rounded-2xl border border-slate-200 bg-white hover:border-blue-500 hover:shadow-md p-5 text-left transition-all cursor-pointer flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-2xs">
                          <CreditCardIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-bold text-slate-900 block break-words sm:truncate group-hover:text-blue-700 transition-colors">
                            {card.name}
                          </span>
                          <div className="mt-0.5 flex items-center gap-2 min-w-0">
                            <CardNetworkMark brand={card.brand} />
                            <span className="text-[11px] text-slate-500 break-words sm:truncate">
                              Fecha dia {card.closingDay} · Vence dia {card.dueDay}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : invoiceTotal === 0
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {isPaid ? 'Quitada' : invoiceTotal === 0 ? 'Sem fatura no mês' : 'Aberta'}
                      </span>
                    </div>

                    <CreditCardFace card={card} />

                    <div className="space-y-3">
                      <div>
                        <p className="text-[11px] font-medium text-slate-500">
                          Fatura de {formatMonthYearPT(selectedMonth)}
                        </p>
                        <p className="text-xl font-extrabold font-mono tabular-nums text-slate-900">
                          {formatBRL(invoiceTotal)}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 mb-1">
                          <span>Tomado: {formatBRL(usedLimit)}</span>
                          <span>Livre: {formatBRL(availableLimit)}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all ${
                              usagePercent > 80 ? 'bg-rose-600' : 'bg-slate-900'
                            }`}
                            style={{ width: `${Math.min(100, usagePercent)}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-700 group-hover:text-blue-800">
                        <span>Abrir página e fatura do cartão</span>
                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
    </>
  );
}
