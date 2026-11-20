/** Estado da tela: cartão aberto, painéis de pagamento parcial e antecipação, campos de cadastro e edição. Parte de CreditCardsTab (ver CreditCardsTab.tsx). */
import { useEffect, useState } from 'react';
import { getAccountCurrency } from '../../../domain/finance/transferRules';
import type { CreditCardsTabPropsApi } from './creditCardsTabConfig';

export function useCardsState(ctx: CreditCardsTabPropsApi) {
  const {
    accounts,
    autoOpenCreate,
    cards,
    initialSelectedCardId,
    onAutoOpenHandled,
  } = ctx;
  const [selectedCardId, setSelectedCardId] = useState<string>(
    initialSelectedCardId || cards[0]?.id || ''
  );
  // Drill-down page state: null = Credit Cards Overview List, string = Dedicated Card Page
  const [activeViewCardId, setActiveViewCardId] = useState<string | null>(
    initialSelectedCardId || null
  );

  useEffect(() => {
    if (initialSelectedCardId) {
      setSelectedCardId(initialSelectedCardId);
      setActiveViewCardId(initialSelectedCardId);
    }
  }, [initialSelectedCardId]);

  // Fatura e cartão são em reais: só contas em reais podem pagar ou ser a conta padrão.
  const brlAccounts = accounts.filter((account) => getAccountCurrency(account) === 'BRL');
  const [paymentAccountId, setPaymentAccountId] = useState<string>(
    cards[0]?.defaultAccountId || brlAccounts[0]?.id || ''
  );
  const [showNewCardForm, setShowNewCardForm] = useState(Boolean(autoOpenCreate));
  useEffect(() => {
    if (!autoOpenCreate) return;
    setShowNewCardForm(true);
    onAutoOpenHandled?.();
  }, [autoOpenCreate, onAutoOpenHandled]);

  // Partial / Custom Invoice Payment State
  const [showPartialPayPanel, setShowPartialPayPanel] = useState(false);
  const [partialPayAmountStr, setPartialPayAmountStr] = useState('');
  const [partialPayError, setPartialPayError] = useState('');

  // Installment anticipation panel state
  const [anticipatingGroupId, setAnticipatingGroupId] = useState<string | null>(null);
  const [anticipationDiscountStr, setAnticipationDiscountStr] = useState('0,00');
  const [anticipationCountToAdvance, setAnticipationCountToAdvance] = useState<number>(0); // 0 = all

  // New card form state
  const [newCardName, setNewCardName] = useState('');
  const [newCardBrand, setNewCardBrand] = useState<'Mastercard' | 'Visa' | 'Elo'>('Mastercard');
  const [newCardLimit, setNewCardLimit] = useState('');
  const [newCardClosing, setNewCardClosing] = useState(20);
  const [newClosingNext, setNewClosingNext] = useState(false);
  const [newCardDue, setNewCardDue] = useState(28);
  const [newCardColor, setNewCardColor] = useState('#0f172a');
  const [newCardAccount, setNewCardAccount] = useState(brlAccounts[0]?.id || '');
  const [formError, setFormError] = useState('');

  // Edit active card state
  const [isEditingActiveCard, setIsEditingActiveCard] = useState(false);
  const [editCardName, setEditCardName] = useState('');
  const [editCardBrand, setEditCardBrand] = useState<'Mastercard' | 'Visa' | 'Elo'>('Mastercard');
  const [editCardLimit, setEditCardLimit] = useState('');
  const [editCardClosing, setEditCardClosing] = useState(20);
  const [editClosingNext, setEditClosingNext] = useState(false);
  const [editCardDue, setEditCardDue] = useState(28);
  const [editCardColor, setEditCardColor] = useState('#0f172a');
  const [editCardAccount, setEditCardAccount] = useState('');
  const [confirmDeleteCardId, setConfirmDeleteCardId] = useState<string | null>(null);

  return {
    activeViewCardId,
    anticipatingGroupId,
    anticipationCountToAdvance,
    anticipationDiscountStr,
    brlAccounts,
    confirmDeleteCardId,
    editCardAccount,
    editCardBrand,
    editCardClosing,
    editCardColor,
    editCardDue,
    editCardLimit,
    editCardName,
    editClosingNext,
    formError,
    isEditingActiveCard,
    newCardAccount,
    newCardBrand,
    newCardClosing,
    newCardColor,
    newCardDue,
    newCardLimit,
    newCardName,
    newClosingNext,
    partialPayAmountStr,
    partialPayError,
    paymentAccountId,
    selectedCardId,
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
    setFormError,
    setIsEditingActiveCard,
    setNewCardAccount,
    setNewCardBrand,
    setNewCardClosing,
    setNewCardColor,
    setNewCardDue,
    setNewCardLimit,
    setNewCardName,
    setNewClosingNext,
    setPartialPayAmountStr,
    setPartialPayError,
    setPaymentAccountId,
    setSelectedCardId,
    setShowNewCardForm,
    setShowPartialPayPanel,
    showNewCardForm,
    showPartialPayPanel,
  };
}

export type CardsStateApi = ReturnType<typeof useCardsState>;
