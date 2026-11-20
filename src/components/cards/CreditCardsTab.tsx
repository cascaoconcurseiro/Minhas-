import React from 'react';
import { formatBRL } from '../../domain/finance/financeRules';
import { CreditCard as CreditCardIcon, Plus } from 'lucide-react';
import { CurrencyInput } from '../ui/CurrencyInput';
import { DayOfMonthSelect } from './DayOfMonthSelect';
import { InstitutionMark } from '../accounts/InstitutionMark';
import { MissingSetupNotice } from '../layout/MissingSetupNotice';
import { resolveCreditCardsTabProps } from './credit-cards-tab/creditCardsTabConfig';
import type { CreditCardsTabProps } from './credit-cards-tab/creditCardsTabConfig';
import { useCardsState } from './credit-cards-tab/useCardsState';
import { useCardsDerived } from './credit-cards-tab/useCardsDerived';
import type { CardPageContext } from './credit-cards-tab/creditCardsTabContext';

import { CardFaceAndEditForm } from './credit-cards-tab/CardFaceAndEditForm';
import { CardKpiStrip } from './credit-cards-tab/CardKpiStrip';
import { CardTopBar } from './credit-cards-tab/CardTopBar';
import { CardsGallery } from './credit-cards-tab/CardsGallery';
import { CardsListKpis } from './credit-cards-tab/CardsListKpis';
import { InstallmentAnticipationPanel } from './credit-cards-tab/InstallmentAnticipationPanel';
import { InstallmentProjectionSection } from './credit-cards-tab/InstallmentProjectionSection';
import { InvoiceHeader } from './credit-cards-tab/InvoiceHeader';
import { InvoiceItemsTable } from './credit-cards-tab/InvoiceItemsTable';
import { InvoicePaymentPanels } from './credit-cards-tab/InvoicePaymentPanels';

export type { CreditCardsTabProps };

/**
 * Aba Cartões de Crédito: lista dos cartões e página de cada cartão (fatura, pagamento, antecipação e projeção).
 * A lógica fica em credit-cards-tab/ (hooks chamados sempre na mesma ordem; cada um recebe o que os anteriores devolveram).
 */
export const CreditCardsTab: React.FC<CreditCardsTabProps> = (props) => {
  const ctx0 = resolveCreditCardsTabProps(props);
  const ctx1 = { ...ctx0, ...useCardsState(ctx0) };
  const ctx2 = { ...ctx1, ...useCardsDerived(ctx1) };
  const { activeCard, activeSummary, activeViewCardId, brlAccounts, cards, formError, handleCreateCard, newCardAccount, newCardAccountDetails, newCardBrand, newCardClosing, newCardColor, newCardDue, newCardLimit, newCardName, newClosingNext, onRequestCreateAccount, setNewCardAccount, setNewCardBrand, setNewCardClosing, setNewCardColor, setNewCardDue, setNewCardLimit, setNewCardName, setNewClosingNext, setShowNewCardForm, showNewCardForm } = ctx2;
  if (!activeCard || !activeSummary) {
    return (
      <div className="module-page space-y-6 min-w-0 max-w-full">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <CreditCardIcon className="mx-auto h-10 w-10 text-emerald-600 mb-3" />
          <h2 className="text-lg font-bold text-slate-900 font-display">
            Nenhum cartão de crédito cadastrado
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Cadastre seus cartões para acompanhar faturas mensais, parcelamentos, limites disponíveis e antecipação de parcelas.
          </p>
          <button
            type="button"
            onClick={() => setShowNewCardForm((prev) => !prev)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{showNewCardForm ? 'Fechar Cadastro' : 'Cadastrar Primeiro Cartão'}</span>
          </button>
        </div>

        {showNewCardForm && (
          <form
            onSubmit={handleCreateCard}
            className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
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
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs tabular-nums text-slate-900"
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
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs tabular-nums text-slate-900"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input type="checkbox" id="card-new-closing-next-1" checked={newClosingNext} onChange={(e) => setNewClosingNext(e.target.checked)} className="mt-0.5 h-4 w-4" />
                <span>Compra no próprio dia do fechamento vai para a <strong>próxima</strong> fatura</span>
              </label>

              <div>
                <label htmlFor="card-color-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Cor do Cartão
                </label>
                <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2">
                  <input
                    id="card-color-input"
                    type="color"
                    value={newCardColor}
                    onChange={(e) => setNewCardColor(e.target.value)}
                    className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                    aria-label="Escolher cor do cartão"
                  />
                  <span className="font-mono text-[11px] uppercase text-slate-600">{newCardColor}</span>
                </div>
              </div>
            </div>

            {brlAccounts.length === 0 && (
              <MissingSetupNotice
                testId="missing-brl-account-for-card"
                message="Para cadastrar um cartão é preciso ter uma conta em reais (o cartão é pago por ela). Cadastre a conta primeiro."
                onAction={onRequestCreateAccount}
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <label htmlFor="card-default-acc">Conta padrão:</label>
                <select
                  id="card-default-acc"
                  value={newCardAccount}
                  onChange={(e) => setNewCardAccount(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-900"
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
      </div>
    );
  }

  const isCardDetailOpen = Boolean(
    activeViewCardId && cards.some((c) => c.id === activeViewCardId)
  );
  const form: CardPageContext = { ...ctx2, activeCard, activeSummary, isCardDetailOpen };
  const {

  } = form;
  return (
    <div className="module-page space-y-6 min-w-0 max-w-full" data-testid="cards-tab-view">
      {/* VIEW 1: CREDIT CARDS OVERVIEW LIST (Shown when no specific card page is opened) */}
      {!isCardDetailOpen && (
        <>
          <CardsListKpis form={form} />

          <CardsGallery form={form} />
        </>
      )}

      {/* VIEW 2: DEDICATED CREDIT CARD PAGE WITH INVOICE & PROJECTIONS */}
      {isCardDetailOpen && (
        <div className="space-y-6 animate-expand-in" data-testid="card-dedicated-page">
          <CardTopBar form={form} />

          <CardFaceAndEditForm form={form} />

          <CardKpiStrip form={form} />

      {/* Pay Invoice Bar + 6-Month Commitment */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Invoice Items Table */}
        <section className="lg:col-span-8 rounded-xl border border-slate-200 bg-white flex flex-col justify-between overflow-hidden">
          <div>
            <InvoiceHeader form={form} />

            <InvoicePaymentPanels form={form} />

            <InstallmentAnticipationPanel form={form} />

            <InvoiceItemsTable form={form} />
          </div>

          <div className="border-t border-slate-200 px-4 sm:px-6 py-3.5 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>Ao pagar a fatura, o valor é debitado da conta escolhida automaticamente.</span>
            <span className="font-mono tabular-nums font-bold text-slate-900">
              Total Fatura: {formatBRL(activeSummary.invoiceTotal)}
            </span>
          </div>
        </section>

        <InstallmentProjectionSection form={form} />
      </div>
      </div>
      )}
    </div>
  );
};
