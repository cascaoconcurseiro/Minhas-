/** Cartão em destaque e formulário de edição. Parte de CreditCardsTab (ver CreditCardsTab.tsx). */
import { CreditCardFace } from '../CreditCardFace';
import { parseBRLInput } from '../../../domain/finance/financeRules';
import { CreditCard } from '../../../types/finance';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { DayOfMonthSelect } from '../DayOfMonthSelect';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import type { CardPageContext } from './creditCardsTabContext';

export function CardFaceAndEditForm({ form }: { form: CardPageContext }) {
  const {
    activeCard,
    brlAccounts,
    editCardAccount,
    editCardAccountDetails,
    editCardBrand,
    editCardClosing,
    editCardColor,
    editCardDue,
    editCardLimit,
    editCardName,
    editClosingNext,
    isEditingActiveCard,
    onUpdateCard,
    setEditCardAccount,
    setEditCardBrand,
    setEditCardClosing,
    setEditCardColor,
    setEditCardDue,
    setEditCardLimit,
    setEditCardName,
    setEditClosingNext,
    setIsEditingActiveCard,
  } = form;
  return (
    <>
<div className="mx-auto w-full max-w-80">
            <CreditCardFace card={activeCard} />
          </div>

          {isEditingActiveCard && onUpdateCard && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const limitVal = parseBRLInput(editCardLimit);
                if (!editCardName.trim() || limitVal <= 0) return;
                const nextCard: CreditCard = {
                  ...activeCard,
                  name: editCardName.trim(),
                  brand: editCardBrand,
                  color: editCardColor,
                  limit: limitVal,
                  closingDay: Math.max(1, Math.min(31, editCardClosing || 20)),
                  dueDay: Math.max(1, Math.min(31, editCardDue || 28)),
                  defaultAccountId: editCardAccount || activeCard.defaultAccountId,
                };
                if (editClosingNext) nextCard.closingDayStartsNextInvoice = true;
                else delete nextCard.closingDayStartsNextInvoice;
                onUpdateCard(nextCard);
                setIsEditingActiveCard(false);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <h3 className="text-xs font-bold text-slate-900">
                  Editar Configurações do Cartão — {activeCard.name}
                </h3>
                <span className="text-[11px] text-slate-500">
                  Ajuste limite, dia de fechamento, vencimento ou conta de débito padrão
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                <div className="lg:col-span-2">
                  <label htmlFor="card-edit-name-input" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Nome do Cartão
                  </label>
                  <input
                    type="text"
                    id="card-edit-name-input"
                    value={editCardName}
                    onChange={(e) => setEditCardName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="card-edit-brand-select" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Bandeira
                  </label>
                  <select
                    id="card-edit-brand-select"
                    value={editCardBrand}
                    onChange={(e) =>
                      setEditCardBrand(e.target.value as 'Mastercard' | 'Visa' | 'Elo')
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                  >
                    <option value="Mastercard">Mastercard</option>
                    <option value="Visa">Visa</option>
                    <option value="Elo">Elo</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="card-edit-limit-input" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Limite Total (R$)
                  </label>
                  <CurrencyInput
                    id="card-edit-limit-input"
                    value={editCardLimit}
                    currency="BRL"
                    onValueChange={setEditCardLimit}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="card-edit-closing-input" className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Dia Fecha
                    </label>
                    <DayOfMonthSelect
                      id="card-edit-closing-input"
                      value={editCardClosing}
                      onChange={setEditCardClosing}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs tabular-nums text-slate-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="card-edit-due-input" className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Dia Vence
                    </label>
                    <DayOfMonthSelect
                      id="card-edit-due-input"
                      value={editCardDue}
                      onChange={setEditCardDue}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs tabular-nums text-slate-900"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2 text-xs text-slate-700 ">
                  <input type="checkbox" id="card-edit-closing-next" checked={editClosingNext} onChange={(e) => setEditClosingNext(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  <span>Compra no próprio dia do fechamento vai para a <strong>próxima</strong> fatura</span>
                </label>
                <div>
                  <label htmlFor="card-edit-default-account-select" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Conta Padrão
                  </label>
                  <select
                    id="card-edit-default-account-select"
                    value={editCardAccount}
                    onChange={(e) => setEditCardAccount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
                  >
                    {brlAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                {editCardAccountDetails && (
                  <InstitutionMark institution={editCardAccountDetails.institution} accountName={editCardAccountDetails.name} color={editCardAccountDetails.color} size="xs" />
                )}
                </div>
                <div>
                  <label htmlFor="card-edit-color-input" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Cor do Cartão
                  </label>
                  <div className="flex h-8 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2">
                    <input
                      id="card-edit-color-input"
                      type="color"
                      value={editCardColor}
                      onChange={(e) => setEditCardColor(e.target.value)}
                      className="h-5 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                      aria-label="Escolher cor do cartão"
                    />
                    <span className="font-mono text-[10px] uppercase text-slate-600">{editCardColor}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingActiveCard(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          )}
    </>
  );
}
