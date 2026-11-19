/** Preenchimento ao abrir/editar e conversão de moeda. Parte de TransactionModal (ver TransactionModal.tsx). */
import { useEffect, useMemo } from 'react';
import { pickDefaultTransferDestination } from '../../../domain/finance/transferRules';
import { getLocalDateISO, normalizeTransactionTags, parseBRLInput, resolveCreditCardInvoiceMonth } from '../../../domain/finance/financeRules';
import { CURRENCY_CATALOG, calculateConvertedBrlAmount, calculateTripWeightedAverageRate } from '../../../domain/trips/travelRules';
import { parseCurrencyInput, parseExchangeRateInput } from '../../../utils/currencyInput';
import type { TransactionModalPropsApi } from './transactionModalConfig';
import type { TransactionFormStateApi } from './useTransactionFormState';

export function useTransactionFormEffects(ctx: TransactionModalPropsApi & TransactionFormStateApi) {
  const {
    accounts,
    activeWorkspaceTab,
    autoHabitKeyRef,
    autoSharingKeyRef,
    cards,
    categories,
    creditCardId,
    date,
    defaultMode,
    editingTransaction,
    entryMode,
    exchangeRateStr,
    familyMembers,
    initialDate,
    initialTripId,
    iofPercentStr,
    isMultiCurrencyOpen,
    isNotesOpen,
    isOpen,
    isShared,
    onClose,
    originalAmountStr,
    originalCurrency,
    prevEditingIdRef,
    prevIsOpenRef,
    recurrence,
    selectedMonth,
    setAccountId,
    setActiveWorkspaceTab,
    setAmountMode,
    setAmountStr,
    setAutoAppliedCategoryNotice,
    setAutoHabitNotice,
    setAutoSharingApplied,
    setBillPaymentCardId,
    setBillPaymentInvoiceMonth,
    setCascadeScope,
    setCategoryId,
    setCreditCardId,
    setCurrencyRegime,
    setDate,
    setDescription,
    setDestinationAccountId,
    setEntryMode,
    setError,
    setExchangeRateStr,
    setFixedMonthsCount,
    setInstallmentTotal,
    setInvoiceCompetenceMonth,
    setIofPercentStr,
    setIsInvoiceMonthOverrideOpen,
    setIsMultiCurrencyOpen,
    setIsNotesOpen,
    setIsCardRefund,
    setIsShared,
    setIsTripLinked,
    setLegacyInstallmentTotalUnknown,
    setNotes,
    setOriginalAmountStr,
    setOriginalCurrency,
    setPaymentChosen,
    setPaymentMethod,
    setRecurrence,
    setSelectedTripParticipantIds,
    setSharedCustomAmountStr,
    setSharedCustomPercentStr,
    setSharedMemberId,
    setSharedPaidBy,
    setSharedSplitMode,
    setStatus,
    setTagInput,
    setTags,
    setTransferForeignAmountStr,
    setTransferSubMode,
    setTripCustomInputs,
    setTripId,
    setTripPayerParticipantId,
    setTripSplitMethod,
    setUserManuallySelectedCategory,
    sharingTouchedRef,
    transactions,
    transferSubMode,
    trips,
    updateScrollMetrics,
  } = ctx;
  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      prevEditingIdRef.current = undefined;
      return;
    }
    const justOpened = !prevIsOpenRef.current;
    const editingTargetChanged =
      prevEditingIdRef.current !== editingTransaction?.id;
    if (!justOpened && !editingTargetChanged) {
      return;
    }
    prevIsOpenRef.current = true;
    prevEditingIdRef.current = editingTransaction?.id;
    setError('');
    setIsInvoiceMonthOverrideOpen(false);

    if (editingTransaction) {
      if (editingTransaction.type === 'transfer') {
        setEntryMode('transfer');
      } else if (editingTransaction.creditCardId) {
        setEntryMode('credit_card');
      } else if (editingTransaction.type === 'income') {
        setEntryMode('income');
      } else {
        setEntryMode('expense');
      }

      setDescription(editingTransaction.description);
      const isInstallmentPurchase =
        editingTransaction.recurrence === 'installment' &&
        Boolean(editingTransaction.installmentGroupId);
      const existingInstallments = isInstallmentPurchase
        ? transactions.filter((tx) => tx.installmentGroupId === editingTransaction.installmentGroupId)
        : [];
      const expectedInstallments = editingTransaction.installmentTotal || 0;
      const installmentNumbers = new Set(
        existingInstallments
          .map((tx) => tx.installmentNumber)
          .filter((value): value is number => Number.isInteger(value) && value! > 0)
      );
      const hasCompleteInstallmentSeries =
        expectedInstallments > 0 &&
        Array.from({ length: expectedInstallments }, (_, index) => index + 1)
          .every((number) => installmentNumbers.has(number));
      const inferredInstallmentTotal = hasCompleteInstallmentSeries
        ? Math.round(existingInstallments.reduce((sum, tx) => sum + tx.amount, 0) * 100) / 100
        : undefined;
      const savedInstallmentTotal = editingTransaction.installmentPurchaseTotal;
      const hasReliableInstallmentTotal =
        isInstallmentPurchase &&
        (Number.isFinite(savedInstallmentTotal) || inferredInstallmentTotal !== undefined);
      const installmentPurchaseTotal = isInstallmentPurchase
        ? (Number.isFinite(savedInstallmentTotal)
            ? savedInstallmentTotal!
            : inferredInstallmentTotal)
        : editingTransaction.amount;
      setLegacyInstallmentTotalUnknown(isInstallmentPurchase && !hasReliableInstallmentTotal);
      setAmountStr(
        (installmentPurchaseTotal ?? editingTransaction.amount).toFixed(2).replace('.', ',')
      );
      setAmountMode(hasReliableInstallmentTotal ? 'total_divided' : 'per_installment');
      setDate(editingTransaction.date);
      setStatus(editingTransaction.status);
      setCategoryId(editingTransaction.categoryId);
      setAccountId(editingTransaction.accountId || accounts[0]?.id || '');
      if (editingTransaction.targetInvestmentAssetId) {
        setTransferSubMode('investment_contribution');
        setDestinationAccountId(
          `inv:${editingTransaction.targetInvestmentAssetId}`
        );
      } else {
        setTransferSubMode('bank_to_bank');
        setDestinationAccountId(
          editingTransaction.destinationAccountId ||
            pickDefaultTransferDestination(accounts, editingTransaction.accountId || '')
        );
      }
      const savedForeignLeg =
        editingTransaction.transferFromAmount || editingTransaction.transferToAmount || 0;
      setTransferForeignAmountStr(
        savedForeignLeg > 0 ? savedForeignLeg.toFixed(2).replace('.', ',') : ''
      );
      setCreditCardId(editingTransaction.creditCardId || cards[0]?.id || '');
      setInvoiceCompetenceMonth(
        editingTransaction.competenceMonth ||
          editingTransaction.date.slice(0, 7) ||
          selectedMonth
      );
      setBillPaymentCardId(cards[0]?.id || '');
      setPaymentMethod(editingTransaction.paymentMethod);
      setRecurrence(editingTransaction.recurrence);
      setInstallmentTotal(editingTransaction.installmentTotal || 2);
      setFixedMonthsCount(
        editingTransaction.recurrence === 'fixed' && editingTransaction.installmentGroupId
          ? transactions.filter((tx) => tx.installmentGroupId === editingTransaction.installmentGroupId).length || 12
          : editingTransaction.installmentTotal || 12
      );
      setCascadeScope(
        isInstallmentPurchase && !hasReliableInstallmentTotal
          ? 'single'
          : 'this_and_future'
      );
      setNotes(editingTransaction.notes || '');
      setTags(normalizeTransactionTags(editingTransaction.tags));
      setTagInput('');
      setIsNotesOpen(Boolean(editingTransaction.notes));

      setIsShared(Boolean(editingTransaction.isShared && !editingTransaction.tripId));
      setIsCardRefund(false);
      setSharedMemberId(
        editingTransaction.sharedMemberId || familyMembers[0]?.id || ''
      );
      setSharedPaidBy(editingTransaction.sharedPaidBy || 'me');
      setSharedSplitMode(
        editingTransaction.sharedSplitMode === 'custom' ? 'custom' : 'half'
      );
      if (
        editingTransaction.isShared &&
        editingTransaction.sharedAmount &&
        editingTransaction.amount > 0
      ) {
        const pct = Math.round(
          (editingTransaction.sharedAmount / editingTransaction.amount) * 100
        );
        setSharedCustomPercentStr(String(pct));
        setSharedCustomAmountStr(
          (hasReliableInstallmentTotal && inferredInstallmentTotal !== undefined
            ? existingInstallments.reduce((sum, tx) => sum + Math.round((tx.sharedAmount || 0) * 100), 0) / 100
            : editingTransaction.sharedAmount).toFixed(2).replace('.', ',')
        );
      } else {
        setSharedCustomPercentStr('50');
        setSharedCustomAmountStr('');
      }

      // Multi-currency / Trip hydration
      const hasMulti =
        Boolean(editingTransaction.tripId) ||
        (editingTransaction.originalCurrency &&
          editingTransaction.originalCurrency !== 'BRL');
      setIsTripLinked(Boolean(hasMulti));
      setIsMultiCurrencyOpen(Boolean(hasMulti));
      if (hasMulti) {
        setActiveWorkspaceTab('travel_fx');
      } else if (editingTransaction.isShared) {
        setActiveWorkspaceTab('family_split');
      } else {
        setActiveWorkspaceTab('essential');
      }
      const editTripId = editingTransaction.tripId || '';
      setTripId(editTripId);
      const editTripObj = trips.find((t) => t.id === editTripId);
      setOriginalCurrency(
        editingTransaction.originalCurrency || editTripObj?.currency || 'BRL'
      );
      setOriginalAmountStr(
        editingTransaction.originalAmount
          ? editingTransaction.originalAmount.toFixed(2).replace('.', ',')
          : ''
      );
      setCurrencyRegime(editingTransaction.currencyRegime || 'global_account');
      setExchangeRateStr(
        editingTransaction.exchangeRate
          ? editingTransaction.exchangeRate.toFixed(4).replace('.', ',')
          : '1,0000'
      );
      setIofPercentStr(
        editingTransaction.iofPercent !== undefined
          ? editingTransaction.iofPercent.toFixed(2).replace('.', ',')
          : '0,00'
      );
      setTripPayerParticipantId(
        editingTransaction.paidByParticipantId || 'me'
      );
      setTripSplitMethod(editingTransaction.tripSplitMethod || 'equal');

      if (
        editingTransaction.tripShares &&
        editingTransaction.tripShares.length > 0
      ) {
        setSelectedTripParticipantIds(
          editingTransaction.tripShares.map((s) => s.participantId)
        );
        const mapInputs: Record<string, string> = {};
        for (const s of editingTransaction.tripShares) {
          mapInputs[s.participantId] = String(s.foreignShare ?? '').replace(
            '.',
            ','
          );
        }
        setTripCustomInputs(mapInputs);
      } else if (editTripObj) {
        setSelectedTripParticipantIds(
          editTripObj.participants.map((p) => p.id)
        );
        setTripCustomInputs({});
      } else {
        setSelectedTripParticipantIds([]);
        setTripCustomInputs({});
      }
      return;
    }

    // New transaction defaults
    setEntryMode(defaultMode);
    setDescription('');
    setUserManuallySelectedCategory(false);
    setAutoAppliedCategoryNotice(null);
    setAmountStr('');
    setAmountMode('total_divided');
    setLegacyInstallmentTotalUnknown(false);
    setDate(initialDate || getLocalDateISO());
    setIsInvoiceMonthOverrideOpen(false);
    setRecurrence('single');
    setInstallmentTotal(2);
    setFixedMonthsCount(12);
    setNotes('');
    setTags([]);
    setTagInput('');
    setIsNotesOpen(false);
    setIsShared(false);
    setIsCardRefund(false);
    setSharedMemberId(familyMembers[0]?.id || '');
    setSharedPaidBy('me');
    setSharedSplitMode('half');
    setSharedCustomPercentStr('50');
    setSharedCustomAmountStr('');
    setAutoSharingApplied(null);
    autoSharingKeyRef.current = null;
    sharingTouchedRef.current = false;
    setAutoHabitNotice(null);
    autoHabitKeyRef.current = null;
    setTransferSubMode('bank_to_bank');
    setTransferForeignAmountStr('');
    setBillPaymentCardId(cards[0]?.id || '');
    setBillPaymentInvoiceMonth(selectedMonth);

    const foundTrip = initialTripId ? trips.find((t) => t.id === initialTripId) : undefined;
    if (foundTrip) {
      setIsTripLinked(true);
      setIsMultiCurrencyOpen(true);
      setActiveWorkspaceTab('travel_fx');
      setTripId(foundTrip.id);
      const curr = foundTrip.currency || 'EUR';
      setOriginalCurrency(curr);
      setOriginalAmountStr('');
      setCurrencyRegime('global_account');

      const weightedInfo = foundTrip
        ? calculateTripWeightedAverageRate(
            foundTrip.exchangeLots,
            foundTrip.defaultExchangeRate
          )
        : null;
      const rateVal =
        weightedInfo?.weightedAverageRate ||
        CURRENCY_CATALOG[curr]?.defaultCommercialRateBrl ||
        6.0;

      setExchangeRateStr(rateVal.toFixed(4).replace('.', ','));
      setIofPercentStr('0,00'); // Weighted VET already includes IOF
      const mePart = foundTrip?.participants.find(
        (p) => p.isMe || p.id === 'me'
      );
      setTripPayerParticipantId(
        mePart?.id || foundTrip?.participants[0]?.id || 'me'
      );
      setTripSplitMethod('equal');
      setSelectedTripParticipantIds(
        foundTrip ? foundTrip.participants.map((p) => p.id) : ['me']
      );
      setTripCustomInputs({});

      if (foundTrip && initialDate === undefined) {
        setDate(foundTrip.startDate);
      }
      const travelCat = categories.find(
        (c) => c.id === 'cat-viagens' || c.id === 'cat-lazer' || c.type === 'expense'
      );
      if (travelCat) {
        setCategoryId(travelCat.id);
      }
    } else {
      setIsTripLinked(false);
      setIsMultiCurrencyOpen(false);
      setActiveWorkspaceTab('essential');
      setTripId('');
      setOriginalCurrency('BRL');
      setOriginalAmountStr('');
      setCurrencyRegime('global_account');
      setExchangeRateStr('1,0000');
      setIofPercentStr('0,00');
      setTripPayerParticipantId('me');
      setTripSplitMethod('equal');
      setSelectedTripParticipantIds([]);
      setTripCustomInputs({});
    }

    if (defaultMode === 'credit_card') {
      setStatus('pending');
      setPaymentMethod('credit_card');
      // Só escolhe sozinho se houver um único cartão; com vários, a pessoa precisa escolher
      const firstCard = cards[0];
      setCreditCardId(cards.length === 1 ? cards[0].id : '');
      const initialPurchaseDate = initialDate || getLocalDateISO();
      setInvoiceCompetenceMonth(
        resolveCreditCardInvoiceMonth(initialPurchaseDate, firstCard)
      );
      // Sem categoria até a pessoa escolher (ou o sistema sugerir pelo histórico): evita classificar errado por padrão
      if (!initialTripId) {
        setCategoryId('');
      }
    } else if (defaultMode === 'income') {
      setStatus('paid');
      setPaymentMethod('pix');
      setAccountId(accounts.length === 1 ? accounts[0].id : '');
      setCategoryId('');
    } else if (defaultMode === 'transfer') {
      setStatus('paid');
      setPaymentMethod('transfer');
      setAccountId(accounts.length === 1 ? accounts[0].id : '');
      setDestinationAccountId('');
    } else {
      setStatus('paid');
      setPaymentMethod(initialTripId ? 'debit_card' : 'pix');
      if (initialTripId) {
        const foundTrip = trips.find((t) => t.id === initialTripId);
        const curr = foundTrip?.currency || 'EUR';
        const matchingIntl = accounts.filter(
          (a) => a.type === 'international' && a.currency === curr
        );
        const preferredAccId =
          foundTrip?.linkedAccountId &&
          matchingIntl.some((a) => a.id === foundTrip.linkedAccountId)
            ? foundTrip.linkedAccountId
            : matchingIntl[0]?.id || '';
        setAccountId(preferredAccId);
      } else {
        const domesticAcc =
          accounts.find((a) => a.type !== 'international') || accounts[0];
        // Com mais de uma conta, a pessoa escolhe (para o lançamento não sair da conta errada)
        setAccountId(accounts.length === 1 ? domesticAcc?.id || '' : '');
      }
      if (!initialTripId) {
        setCategoryId('');
      }
    }
  }, [
    isOpen,
    editingTransaction,
    defaultMode,
    selectedMonth,
    accounts,
    cards,
    categories,
    familyMembers,
    transactions,
    initialDate,
    initialTripId,
    trips,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    setPaymentChosen(Boolean(editingTransaction) || defaultMode !== 'expense' || Boolean(initialTripId));
  }, [isOpen, editingTransaction, defaultMode, initialTripId]);

  // Automatically recalculate the invoice due month when the purchase date or card changes.
  useEffect(() => {
    if (!isOpen || entryMode !== 'credit_card') return;
    // Ao abrir uma compra de cartão já salva, mantém a fatura que ela tem (inclusive ajuste manual). Só recalcula
    // quando a data ou o cartão forem alterados, ou quando o mês salvo é o da própria compra (lançamento antigo,
    // que guardava o mês da compra no lugar do mês da fatura).
    if (
      editingTransaction &&
      editingTransaction.creditCardId &&
      date === editingTransaction.date &&
      creditCardId === editingTransaction.creditCardId &&
      editingTransaction.competenceMonth &&
      editingTransaction.competenceMonth !== editingTransaction.date.slice(0, 7)
    ) {
      return;
    }
    const chosenCard = cards.find((c) => c.id === creditCardId) || cards[0];
    setInvoiceCompetenceMonth(resolveCreditCardInvoiceMonth(date, chosenCard));
  }, [isOpen, editingTransaction, entryMode, date, creditCardId, cards]);

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(updateScrollMetrics, 50);
    return () => window.clearTimeout(t);
  }, [
    isOpen,
    entryMode,
    recurrence,
    isShared,
    isMultiCurrencyOpen,
    isNotesOpen,
    activeWorkspaceTab,
    transferSubMode,
    updateScrollMetrics,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Live Multi-Currency Conversion Effect
  const parsedForeignAmount = parseCurrencyInput(originalAmountStr, originalCurrency);
  const parsedExchangeRate = parseExchangeRateInput(exchangeRateStr);
  const parsedIofPercent = parseBRLInput(iofPercentStr);

  const fxConversionPreview = useMemo(() => {
    if (!isMultiCurrencyOpen || originalCurrency === 'BRL') {
      return null;
    }
    const baseRate =
      parsedExchangeRate > 0
        ? parsedExchangeRate
        : CURRENCY_CATALOG[originalCurrency]?.defaultCommercialRateBrl || 1;
    return calculateConvertedBrlAmount(
      parsedForeignAmount,
      baseRate,
      parsedIofPercent
    );
  }, [
    isMultiCurrencyOpen,
    originalCurrency,
    parsedForeignAmount,
    parsedExchangeRate,
    parsedIofPercent,
  ]);

  useEffect(() => {
    if (
      isMultiCurrencyOpen &&
      originalCurrency !== 'BRL' &&
      parsedForeignAmount > 0 &&
      fxConversionPreview
    ) {
      setAmountStr(
        fxConversionPreview.isValid
          ? fxConversionPreview.totalBrl.toFixed(2).replace('.', ',')
          : ''
      );
    }
  }, [
    isMultiCurrencyOpen,
    originalCurrency,
    parsedForeignAmount,
    fxConversionPreview,
  ]);

  return {
    fxConversionPreview,
    parsedExchangeRate,
    parsedForeignAmount,
    parsedIofPercent,
  };
}

export type TransactionFormEffectsApi = ReturnType<typeof useTransactionFormEffects>;
