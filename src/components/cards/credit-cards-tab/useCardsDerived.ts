/** Cartão ativo, fatura do mês, parcelas, projeções, totais e criação de cartão. Parte de CreditCardsTab (ver CreditCardsTab.tsx). */
import React, { useEffect, useMemo } from 'react';
import { getAccountCurrency } from '../../../domain/finance/transferRules';
import { getActiveInstallmentGroupsForCard } from '../../../domain/budgets/uxEnhancementRules';
import { addMonthsToYearMonth, calculateCreditCardSummary, formatMonthYearPT, parseBRLInput } from '../../../domain/finance/financeRules';
import type { CreditCardsTabPropsApi } from './creditCardsTabConfig';
import type { CardsStateApi } from './useCardsState';

export function useCardsDerived(ctx: CreditCardsTabPropsApi & CardsStateApi) {
  const {
    accounts,
    brlAccounts,
    cardSummaries,
    cards,
    categories,
    editCardAccount,
    newCardAccount,
    newCardBrand,
    newCardClosing,
    newCardColor,
    newCardDue,
    newCardLimit,
    newCardName,
    newClosingNext,
    onAddCard,
    paymentAccountId,
    selectedCardId,
    selectedMonth,
    setFormError,
    setNewCardAccount,
    setNewCardColor,
    setNewCardName,
    setPaymentAccountId,
    setShowNewCardForm,
    transactions,
  } = ctx;
  const activeCard = cards.find((c) => c.id === selectedCardId) || cards[0];
  const newCardAccountDetails = accounts.find((account) => account.id === newCardAccount) ?? null;
  const editCardAccountDetails = accounts.find((account) => account.id === editCardAccount) ?? null;
  const paymentAccountDetails = accounts.find((account) => account.id === paymentAccountId) ?? null;
  const activeSummary = cardSummaries.find((s) => s.cardId === activeCard?.id);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  useEffect(() => {
    setPaymentAccountId((currentAccountId) => {
      const brl = accounts.filter((a) => getAccountCurrency(a) === 'BRL');
      if (
        activeCard?.defaultAccountId &&
        brl.some((a) => a.id === activeCard.defaultAccountId)
      ) {
        return activeCard.defaultAccountId;
      }
      return brl.some((a) => a.id === currentAccountId)
        ? currentAccountId
        : brl[0]?.id || '';
    });
  }, [activeCard?.id, activeCard?.defaultAccountId, accounts]);

  useEffect(() => {
    const brl = accounts.filter((a) => getAccountCurrency(a) === 'BRL');
    if ((!newCardAccount || !brl.some((a) => a.id === newCardAccount)) && brl.length > 0) {
      setNewCardAccount(brl[0].id);
    }
  }, [accounts, newCardAccount]);

  // Active installment groups with future unpaid parcels on this card
  const activeInstallmentGroups = useMemo(() => {
    if (!activeCard) return [];
    return getActiveInstallmentGroupsForCard(
      transactions,
      activeCard.id,
      selectedMonth
    );
  }, [activeCard, transactions, selectedMonth]);

  const groupsWithFutureParcels = useMemo(
    () => activeInstallmentGroups.filter((g) => g.futureInstallmentsCount > 0),
    [activeInstallmentGroups]
  );

  // Invoice payment transactions recorded for this card in selectedMonth
  const cardInvoicePaymentsInMonth = useMemo(() => {
    if (!activeCard) return [];
    return transactions.filter(
      (tx) =>
        tx.isInvoicePayment &&
        (tx.settledInvoiceMonth || tx.competenceMonth) === selectedMonth &&
        (tx.settledCardId === activeCard.id ||
          tx.description.toLowerCase().includes(activeCard.name.toLowerCase()) ||
          tx.id.includes(activeCard.id))
    );
  }, [activeCard, transactions, selectedMonth]);

  // 6-Month Future Invoice Projection for the active card
  const futureProjections = useMemo(() => {
    if (!activeCard) return [];
    return [0, 1, 2, 3, 4, 5].map((offset) => {
      const m = addMonthsToYearMonth(selectedMonth, offset);
      const sum = calculateCreditCardSummary(activeCard, transactions, m);
      return {
        month: m,
        label: formatMonthYearPT(m),
        total: sum.invoiceTotal,
        count: sum.transactions.length,
        isPaid: sum.isInvoicePaid,
      };
    });
  }, [activeCard, transactions, selectedMonth]);

  const globalCardsTotals = useMemo(() => {
    let totalInvoicesMonth = 0;
    let totalLimit = 0;
    let totalUsed = 0;
    let totalAvailable = 0;
    for (const c of cards) {
      const sum = cardSummaries.find((s) => s.cardId === c.id);
      totalLimit += c.limit;
      totalInvoicesMonth += sum?.invoiceTotal ?? 0;
      totalUsed += sum?.usedLimit ?? 0;
      totalAvailable += sum?.availableLimit ?? c.limit;
    }
    return { totalInvoicesMonth, totalLimit, totalUsed, totalAvailable };
  }, [cards, cardSummaries]);

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    const limitVal = parseBRLInput(newCardLimit);
    if (!newCardName.trim()) {
      setFormError('Informe o nome do cartão (ex: Inter Black, Santander SX).');
      return;
    }
    if (limitVal <= 0) {
      setFormError('Informe um limite total válido.');
      return;
    }
    const normalizedCardName = newCardName.trim().toLocaleLowerCase('pt-BR');
    if (cards.some((other) => other.name.trim().toLocaleLowerCase('pt-BR') === normalizedCardName)) {
      setFormError('Já existe um cartão com esse nome. Use um nome diferente para não confundir as faturas.');
      return;
    }
    if (brlAccounts.length === 0) {
      setFormError('Cadastre uma conta em reais antes do cartão: é por ela que a fatura será paga.');
      return;
    }
    onAddCard({
      name: newCardName.trim(),
      brand: newCardBrand,
      limit: limitVal,
      closingDay: newCardClosing,
      ...(newClosingNext ? { closingDayStartsNextInvoice: true } : {}),
      dueDay: newCardDue,
      defaultAccountId: newCardAccount || brlAccounts[0]?.id || '',
      color: newCardColor,
    });
    setNewCardName('');
    setNewCardColor('#0f172a');
    setFormError('');
    setShowNewCardForm(false);
  };

  return {
    accMap,
    activeCard,
    activeInstallmentGroups,
    activeSummary,
    cardInvoicePaymentsInMonth,
    catMap,
    editCardAccountDetails,
    futureProjections,
    globalCardsTotals,
    groupsWithFutureParcels,
    handleCreateCard,
    newCardAccountDetails,
    paymentAccountDetails,
  };
}

export type CardsDerivedApi = ReturnType<typeof useCardsDerived>;
