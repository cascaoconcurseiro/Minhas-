/** Ações de viagem, moeda, compartilhamento, familiar e troca de modo. Parte de TransactionModal (ver TransactionModal.tsx). */
import { CURRENCY_CATALOG, CURRENCY_REGIME_DEFAULTS, calculateTripWeightedAverageRate } from '../../../domain/trips/travelRules';
import { CurrencyCode, CurrencyPaymentRegime } from '../../../types/finance';
import React from 'react';
import { calculateCreditCardSummary } from '../../../domain/finance/financeRules';
import { pickDefaultTransferDestination } from '../../../domain/finance/transferRules';
import type { TransactionModalPropsApi } from './transactionModalConfig';
import type { TransactionFormStateApi } from './useTransactionFormState';
import type { TransactionFormEffectsApi } from './useTransactionFormEffects';

export function useTransactionFormHandlers(ctx: TransactionModalPropsApi & TransactionFormStateApi & TransactionFormEffectsApi) {
  const {
    accountId,
    accounts,
    billPaymentCardId,
    cards,
    categories,
    categoryId,
    creditCardId,
    currencyRegime,
    description,
    editingTransaction,
    entryMode,
    familyMembers,
    investments,
    isShared,
    isTripLinked,
    newMemberEmail,
    newMemberName,
    newMemberRelationship,
    onAddFamilyMember,
    originalCurrency,
    parsedExchangeRate,
    recurrence,
    selectedMonth,
    selectedTrip,
    setAccountId,
    setActiveWorkspaceTab,
    setAmountStr,
    setAutoSharingApplied,
    setBillPaymentCardId,
    setBillPaymentInvoiceMonth,
    setCategoryId,
    setCreditCardId,
    setCurrencyRegime,
    setDescription,
    setDestinationAccountId,
    setEntryMode,
    setError,
    setExchangeRateStr,
    setInlineFamilyMemberError,
    setIofPercentStr,
    setIsAddingFamilyMember,
    setIsMultiCurrencyOpen,
    setIsShared,
    setIsTripLinked,
    setNewMemberEmail,
    setNewMemberName,
    setOriginalAmountStr,
    setOriginalCurrency,
    setPaymentChosen,
    setPaymentMethod,
    setRecurrence,
    setSelectedTripParticipantIds,
    setSharedMemberId,
    setStatus,
    setTransferSubMode,
    setTripId,
    setTripPayerParticipantId,
    sharedMemberId,
    sharingTouchedRef,
    transactions,
    tripId,
    trips,
  } = ctx;
  const handleTripSelect = (nextTripId: string) => {
    setTripId(nextTripId);
    if (!nextTripId) {
      setSelectedTripParticipantIds([]);
      return;
    }
    const found = trips.find((t) => t.id === nextTripId);
    if (!found) return;
    setIsTripLinked(true);
    setIsMultiCurrencyOpen(true);
    setIsShared(false);
    setActiveWorkspaceTab('travel_fx');
    setOriginalCurrency(found.currency);
    const weightedInfo = calculateTripWeightedAverageRate(
      found.exchangeLots,
      found.defaultExchangeRate
    );
    setExchangeRateStr(
      weightedInfo.weightedAverageRate.toFixed(4).replace('.', ',')
    );
    setIofPercentStr('0,00');
    const mePart = found.participants.find((p) => p.isMe || p.id === 'me');
    setTripPayerParticipantId(
      mePart?.id || found.participants[0]?.id || 'me'
    );
    setSelectedTripParticipantIds(found.participants.map((p) => p.id));
    const matchingIntl = accounts.filter(
      (a) => a.type === 'international' && a.currency === found.currency
    );
    const preferredAccId =
      found.linkedAccountId &&
      matchingIntl.some((a) => a.id === found.linkedAccountId)
        ? found.linkedAccountId
        : matchingIntl[0]?.id || '';
    if (currencyRegime === 'global_account') {
      setAccountId(preferredAccId);
      setPaymentMethod('debit_card');
    } else if (currencyRegime === 'cash_fx') {
      setAccountId('');
      setPaymentMethod('cash');
    }
  };

  const handleCurrencyChange = (nextCurr: CurrencyCode) => {
    // When linked to a trip, only the trip's official currency is allowed
    if (selectedTrip) {
      setOriginalCurrency(selectedTrip.currency);
      const weightedInfo = calculateTripWeightedAverageRate(
        selectedTrip.exchangeLots,
        selectedTrip.defaultExchangeRate
      );
      setExchangeRateStr(
        weightedInfo.weightedAverageRate.toFixed(4).replace('.', ',')
      );
      setIofPercentStr('0,00');
      return;
    }
    setOriginalCurrency(nextCurr);
    if (nextCurr === 'BRL') {
      setExchangeRateStr('1,0000');
      setIofPercentStr('0,00');
      return;
    }
    const defRate =
      CURRENCY_CATALOG[nextCurr]?.defaultCommercialRateBrl || 5.5;
    setExchangeRateStr(defRate.toFixed(4).replace('.', ','));
    const regimeDef = CURRENCY_REGIME_DEFAULTS[currencyRegime];
    setIofPercentStr(
      (regimeDef?.defaultIofPercent ?? 1.1).toFixed(2).replace('.', ',')
    );
  };

  const handleRegimeChange = (nextRegime: CurrencyPaymentRegime) => {
    setCurrencyRegime(nextRegime);
    if (selectedTrip) {
      // Always keep the trip's official currency and weighted average rate (VET médio)
      setOriginalCurrency(selectedTrip.currency);
      const weightedInfo = calculateTripWeightedAverageRate(
        selectedTrip.exchangeLots,
        selectedTrip.defaultExchangeRate
      );
      setExchangeRateStr(
        weightedInfo.weightedAverageRate.toFixed(4).replace('.', ',')
      );
      setIofPercentStr('0,00');
    } else if (originalCurrency === 'BRL') {
      setIofPercentStr('0,00');
    } else {
      const defRate =
        CURRENCY_CATALOG[originalCurrency]?.defaultCommercialRateBrl ||
        parsedExchangeRate ||
        5.8;
      setExchangeRateStr(defRate.toFixed(4).replace('.', ','));
      const defIof = CURRENCY_REGIME_DEFAULTS[nextRegime]?.defaultIofPercent ?? 1.1;
      setIofPercentStr(defIof.toFixed(2).replace('.', ','));
    }

    if (nextRegime === 'credit_card_intl') {
      setEntryMode('credit_card');
      setPaymentMethod('credit_card');
      setStatus('pending');
      if (!creditCardId && cards.length === 1) {
        setCreditCardId(cards[0].id);
      }
    } else if (nextRegime === 'global_account' || nextRegime === 'cash_fx') {
      if (entryMode === 'credit_card') {
        setEntryMode('expense');
      }
      setPaymentMethod(nextRegime === 'cash_fx' ? 'cash' : 'debit_card');
      setStatus('paid');
      if (selectedTrip) {
        if (nextRegime === 'cash_fx') {
          setAccountId('');
        } else {
          const matchingIntl = accounts.filter(
            (a) => a.type === 'international' && a.currency === selectedTrip.currency
          );
          const preferredAccId =
            selectedTrip.linkedAccountId &&
            matchingIntl.some((a) => a.id === selectedTrip.linkedAccountId)
              ? selectedTrip.linkedAccountId
              : matchingIntl[0]?.id || '';
          setAccountId(preferredAccId);
        }
      }
    }
  };

  const handleToggleTrip = () => {
    if (isTripLinked) {
      setIsTripLinked(false);
      setIsMultiCurrencyOpen(false);
      setTripId('');
      setOriginalCurrency('BRL');
      setOriginalAmountStr('');
      setIofPercentStr('0,00');
      setSelectedTripParticipantIds([]);
    } else {
      setIsTripLinked(true);
      setIsShared(false);
      if (trips.length > 0) {
        setIsMultiCurrencyOpen(true);
        handleTripSelect(tripId || trips[0].id);
      } else {
        setIsMultiCurrencyOpen(false);
        setTripId('');
        setOriginalCurrency('BRL');
        setIofPercentStr('0,00');
      }
    }
  };

  const handleToggleShared = () => {
    sharingTouchedRef.current = true;
    setAutoSharingApplied(null);
    if (isShared) {
      setIsShared(false);
    } else {
      setIsShared(true);
      if (isTripLinked) {
        setIsTripLinked(false);
        setIsMultiCurrencyOpen(false);
        setTripId('');
        setOriginalCurrency('BRL');
      }
      if (!sharedMemberId && familyMembers.length > 0) {
        setSharedMemberId(familyMembers[0].id);
      }
    }
  };

  const handleInlineAddFamilyMember = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (newMemberEmail.trim()) {
      setInlineFamilyMemberError('Para vincular ou convidar por e-mail, use a aba Compartilhado. Nenhuma pessoa foi adicionada.');
      return;
    }
    if (!newMemberName.trim()) return;
    if (onAddFamilyMember) {
      const colors = [
        '#6366f1',
        '#ec4899',
        '#10b981',
        '#f59e0b',
        '#06b6d4',
        '#8b5cf6',
      ];
      const color = colors[familyMembers.length % colors.length];
      setInlineFamilyMemberError(null);
      const created = onAddFamilyMember({
        name: newMemberName.trim(),
        relationship: newMemberRelationship,
        color,
        inviteStatus: 'none',
      });
      if (created) {
        setSharedMemberId(created.id);
      }
      setIsShared(true);
      setNewMemberName('');
      setNewMemberEmail('');
      setIsAddingFamilyMember(false);
    }
  };

  // CRITICAL BUSINESS RULE: Installment (2x-24x) ONLY allowed on Credit Card!
  const handleModeSwitch = (
    mode: 'expense' | 'income' | 'credit_card' | 'transfer',
    fromPaymentToggle = false
  ) => {
    setEntryMode(mode);
    if (!editingTransaction) {
      // Despesa nova volta a exigir a escolha da forma de pagamento; trocar pelo seletor conta/cartão já é a escolha
      setPaymentChosen(fromPaymentToggle || mode === 'credit_card' || mode === 'income' || mode === 'transfer');
    }
    setError('');
    if (mode === 'income') {
      if (!editingTransaction && categories.find((c) => c.id === categoryId)?.type !== 'income') {
        setCategoryId('');
      }
      setPaymentMethod('pix');
      setStatus('paid');
      if (recurrence === 'installment') {
        setRecurrence('single');
      }
      setIsShared(false);
    } else if (mode === 'credit_card') {
      if (!tripId && !editingTransaction && categories.find((c) => c.id === categoryId)?.type !== 'expense') {
        setCategoryId('');
      }
      setPaymentMethod('credit_card');
      setStatus('pending');
      if (!creditCardId && cards.length === 1) {
        setCreditCardId(cards[0].id);
      }
    } else if (mode === 'transfer') {
      setPaymentMethod('transfer');
      setStatus('paid');
      setRecurrence('single');
      setIsMultiCurrencyOpen(false);
      setIsTripLinked(false);
      setIsShared(false);
    } else {
      if (!tripId && !editingTransaction && categories.find((c) => c.id === categoryId)?.type !== 'expense') {
        setCategoryId('');
      }
      const originalBankMethod =
        editingTransaction && editingTransaction.paymentMethod && editingTransaction.paymentMethod !== 'credit_card'
          ? editingTransaction.paymentMethod
          : 'pix';
      setPaymentMethod(originalBankMethod);
      if (!accountId && accounts.length === 1) setAccountId(accounts[0].id);
      setStatus('paid');
      if (recurrence === 'installment') {
        setRecurrence('single');
      }
    }
  };

  const handleTransferSubModeChange = (
    sub: 'bank_to_bank' | 'investment_contribution' | 'card_bill_payment'
  ) => {
    setTransferSubMode(sub);
    setError('');
    if (sub === 'investment_contribution' && investments.length > 0) {
      const firstAsset = investments[0];
      setDestinationAccountId(`inv:${firstAsset.id}`);
      if (!description.trim() || description.startsWith('Pagamento Fatura')) {
        setDescription(`Aporte em ${firstAsset.ticker}`);
      }
    } else if (sub === 'card_bill_payment') {
      const targetCard =
        cards.find((c) => c.id === billPaymentCardId) || cards[0];
      setBillPaymentInvoiceMonth(selectedMonth);
      if (targetCard) {
        setBillPaymentCardId(targetCard.id);
        setDescription(`Pagamento Fatura ${targetCard.name}`);
        const pending = calculateCreditCardSummary(targetCard, transactions, selectedMonth).invoicePendingAmount;
        setAmountStr(pending > 0 ? pending.toFixed(2).replace('.', ',') : '');
      }
      setDestinationAccountId(pickDefaultTransferDestination(accounts, accountId));
    } else {
      setDestinationAccountId(pickDefaultTransferDestination(accounts, accountId));
      if (
        description.startsWith('Aporte em ') ||
        description.startsWith('Pagamento Fatura ')
      ) {
        setDescription('');
      }
    }
  };

  return {
    handleInlineAddFamilyMember,
    handleModeSwitch,
    handleRegimeChange,
    handleToggleShared,
    handleToggleTrip,
    handleTransferSubModeChange,
    handleTripSelect,
  };
}

export type TransactionFormHandlersApi = ReturnType<typeof useTransactionFormHandlers>;
