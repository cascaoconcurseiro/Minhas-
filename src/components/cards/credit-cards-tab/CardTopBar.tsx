/** Barra do cartão aberto: voltar, troca rápida de cartão e ações. Parte de CreditCardsTab (ver CreditCardsTab.tsx). */
import { ArrowLeft, Edit3, FastForward, Plus, Trash2 } from 'lucide-react';
import { CardNetworkMark } from '../CardNetworkMark';
import type { CardPageContext } from './creditCardsTabContext';

export function CardTopBar({ form }: { form: CardPageContext }) {
  const {
    activeCard,
    activeInstallmentGroups,
    anticipatingGroupId,
    brlAccounts,
    cards,
    confirmDeleteCardId,
    groupsWithFutureParcels,
    isEditingActiveCard,
    onDeleteCard,
    onOpenNewCardExpense,
    onUpdateCard,
    setActiveViewCardId,
    setAnticipatingGroupId,
    setAnticipationCountToAdvance,
    setAnticipationDiscountStr,
    setConfirmDeleteCardId,
    setEditCardAccount,
    setEditCardBrand,
    setEditCardClosing,
    setEditCardColor,
    setEditCardDue,
    setEditCardLimit,
    setEditCardName,
    setEditClosingNext,
    setIsEditingActiveCard,
    setPaymentAccountId,
    setSelectedCardId,
    setShowPartialPayPanel,
  } = form;
  return (
    <>
{/* Top Navigation Bar: Back to All Cards + Quick Switcher + Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="back-to-cards-list-btn"
                onClick={() => setActiveViewCardId(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar para Todos os Cartões ({cards.length})</span>
              </button>

              {cards.length > 1 && (
                <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
                  {cards.map((card) => {
                    const isSelected = card.id === activeCard.id;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        aria-pressed={isSelected}
                        data-selection-control="true"
                        onClick={() => {
                          setSelectedCardId(card.id);
                          setActiveViewCardId(card.id);
                          setPaymentAccountId(card.defaultAccountId || brlAccounts[0]?.id || '');
                          setShowPartialPayPanel(false);
                          setAnticipatingGroupId(null);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                          isSelected
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <CardNetworkMark brand={card.brand} />
                        <span>{card.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="open-anticipate-center-btn"
                onClick={() => {
                  if (anticipatingGroupId) {
                    setAnticipatingGroupId(null);
                  } else {
                    const firstGroup =
                      groupsWithFutureParcels[0]?.installmentGroupId ||
                      activeInstallmentGroups[0]?.installmentGroupId ||
                      '__empty__';
                    setAnticipatingGroupId(firstGroup);
                    setAnticipationCountToAdvance(0);
                    setAnticipationDiscountStr('15,00');
                  }
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  anticipatingGroupId
                    ? 'border-violet-600 bg-violet-600 text-white'
                    : 'border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100'
                }`}
              >
                <FastForward className="h-3.5 w-3.5" />
                <span>
                  Adiantar Parcelas
                  {groupsWithFutureParcels.length > 0
                    ? ` (${groupsWithFutureParcels.length})`
                    : ''}
                </span>
              </button>

              {onUpdateCard && (
                <button
                  type="button"
                  onClick={() => {
                    if (isEditingActiveCard) {
                      setIsEditingActiveCard(false);
                    } else {
                      setEditCardName(activeCard.name);
                      setEditCardBrand(activeCard.brand);
                      setEditCardColor(activeCard.color || '#0f172a');
                      setEditCardLimit(activeCard.limit.toFixed(2).replace('.', ','));
                      setEditCardClosing(activeCard.closingDay);
                      setEditClosingNext(Boolean(activeCard.closingDayStartsNextInvoice));
                      setEditCardDue(activeCard.dueDay);
                      setEditCardAccount(
                        activeCard.defaultAccountId || brlAccounts[0]?.id || ''
                      );
                      setIsEditingActiveCard(true);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>{isEditingActiveCard ? 'Cancelar Edição' : 'Editar Cartão'}</span>
                </button>
              )}

              {onDeleteCard && (
                confirmDeleteCardId === activeCard.id ? (
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs">
                    <span className="font-bold text-rose-900">Excluir cartão?</span>
                    <button
                      type="button"
                      onClick={() => {
                        const deleted = onDeleteCard(activeCard.id);
                        if (deleted !== false) {
                          setConfirmDeleteCardId(null);
                          setActiveViewCardId(null);
                        }
                      }}
                      className="rounded bg-rose-600 px-2 py-0.5 font-bold text-white hover:bg-rose-700"
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteCardId(null)}
                      className="rounded bg-white px-2 py-0.5 font-semibold text-slate-700 border border-slate-300"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCardId(activeCard.id)}
                    aria-label={`Excluir cartão ${activeCard.name}`}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )
              )}

              <button
                type="button"
                onClick={onOpenNewCardExpense}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Compra Cartão</span>
              </button>
            </div>
          </div>
    </>
  );
}
