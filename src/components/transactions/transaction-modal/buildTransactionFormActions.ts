/** Ações com o formulário aberto: categoria, etiquetas, participantes e salvar (handleSubmit). Função comum, sem hooks: roda depois do retorno antecipado. Parte de TransactionModal (ver TransactionModal.tsx). */
import { SmartCategorySuggestion } from '../../../domain/budgets/uxEnhancementRules';
import { CreateTransactionBatchInput, calculateSharedAmount, normalizeSearchText, normalizeTransactionTags, parseBRLInput, resolveCreditCardInvoiceMonth } from '../../../domain/finance/financeRules';
import React from 'react';
import { isCurrencyInputValid, isExchangeRateInputValid } from '../../../utils/currencyInput';
import { CURRENCY_CATALOG } from '../../../domain/trips/travelRules';
import { getAccountCurrency, resolveBankTransfer } from '../../../domain/finance/transferRules';
import { RecurrenceType } from '../../../types/finance';
import { getAccountLabel } from '../../../domain/finance/accountLabels';
import type { TransactionModalPropsApi } from './transactionModalConfig';
import type { TransactionFormStateApi } from './useTransactionFormState';
import type { TransactionFormEffectsApi } from './useTransactionFormEffects';
import type { TransactionFormInsightsApi } from './useTransactionFormInsights';

export function buildTransactionFormActions(ctx: TransactionModalPropsApi & TransactionFormStateApi & TransactionFormEffectsApi & TransactionFormInsightsApi) {
  const {
    accountId,
    accounts,
    amountMode,
    amountStr,
    billPaymentCardId,
    billPaymentInvoiceMonth,
    cards,
    cascadeScope,
    categories,
    categoryId,
    creditCardId,
    currencyRegime,
    date,
    description,
    destinationAccountId,
    editingTransaction,
    entryMode,
    exchangeRateStr,
    fixedMonthsCount,
    fxConversionPreview,
    installmentTotal,
    invoiceCompetenceMonth,
    iofPercentStr,
    isMultiCurrencyOpen,
    isPaidByCompanion,
    isCardRefund,
    isShared,
    isTripLinked,
    legacyInstallmentTotalUnknown,
    liveBudgetImpact,
    missingSetup,
    myTripShareObj,
    notes,
    onClose,
    onSaveBatch,
    originalAmountStr,
    originalCurrency,
    parsedExchangeRate,
    parsedForeignAmount,
    parsedIofPercent,
    paymentChosen,
    paymentMethod,
    recurrence,
    selectedDestinationAccount,
    selectedMonth,
    selectedPaymentAccount,
    selectedTrip,
    setAutoAppliedCategoryNotice,
    setCategoryId,
    setError,
    setSelectedTripParticipantIds,
    setTagInput,
    setTags,
    setUserManuallySelectedCategory,
    sharedCustomAmountStr,
    sharedCustomPercentStr,
    sharedMemberId,
    sharedPaidBy,
    sharedSplitMode,
    status,
    tagInput,
    tags,
    transferForeignAmount,
    transferForeignAmountStr,
    transferForeignCurrency,
    transferSubMode,
    tripId,
    tripPayerParticipantId,
    tripSharesPreview,
    tripSplitMethod,
    tripSplitValidationError,
  } = ctx;
  const calculatedSharedPreview = (): number => {
    return isShared ? liveBudgetImpact?.draftSharedAmount || 0 : 0;
  };

  const handleCategoryChange = (newCatId: string, isManual = true) => {
    setCategoryId(newCatId);
    if (isManual) {
      setUserManuallySelectedCategory(true);
      setAutoAppliedCategoryNotice(null);
    }
  };

  const handleApplySmartCategory = (sug: SmartCategorySuggestion) => {
    setCategoryId(sug.categoryId);
    setUserManuallySelectedCategory(false);
    setAutoAppliedCategoryNotice(
      `Categoria "${sug.categoryName}" aplicada com base no histórico!`
    );
  };

  const handleAddTag = (rawValue?: string) => {
    const targetRaw = rawValue !== undefined ? rawValue : tagInput;
    if (!targetRaw || !targetRaw.trim()) return;
    const nextTags = normalizeTransactionTags([...tags, targetRaw]);
    setTags(nextTags);
    if (rawValue === undefined) {
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const targetKey = normalizeSearchText(tagToRemove);
    setTags((prev) => prev.filter((t) => normalizeSearchText(t) !== targetKey));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (tagInput.trim()) {
        handleAddTag();
      }
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const toggleTripParticipant = (partId: string) => {
    setSelectedTripParticipantIds((prev) => {
      if (prev.includes(partId)) {
        if (prev.length <= 1) return prev; // keep at least 1
        return prev.filter((id) => id !== partId);
      }
      return [...prev, partId];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseBRLInput(amountStr);
    const activeMultiCurrency =
      (isTripLinked || isMultiCurrencyOpen) &&
      entryMode !== 'transfer' &&
      (originalCurrency !== 'BRL' || Boolean(tripId));

    if (!description.trim()) {
      setError(
        'Informe uma descrição para o lançamento (ex: Supermercado, Salário, Jantar em Roma).'
      );
      return;
    }
    if (missingSetup) {
      setError(missingSetup.message);
      return;
    }
    if (
      entryMode !== 'transfer' && entryMode !== 'credit_card' &&
      !activeMultiCurrency &&
      !(selectedTrip && isPaidByCompanion) &&
      !(isShared && sharedPaidBy === 'member') &&
      !accounts.some((account) => account.id === accountId)
    ) {
      setError('Escolha a conta do lançamento.');
      return;
    }
    if (entryMode === 'credit_card' && !cards.some((card) => card.id === creditCardId)) {
      setError('Escolha o cartão da compra.');
      return;
    }
    if (
      activeMultiCurrency &&
      originalCurrency !== 'BRL' &&
      (!isCurrencyInputValid(originalAmountStr, originalCurrency) || parsedForeignAmount <= 0)
    ) {
      setError(`Informe um valor válido em ${originalCurrency}, usando até ${CURRENCY_CATALOG[originalCurrency].decimals} casa(s) decimal(is).`);
      return;
    }
    if (activeMultiCurrency && originalCurrency !== 'BRL' && !isExchangeRateInputValid(exchangeRateStr)) {
      setError('Informe uma cotação válida maior que zero.');
      return;
    }
    if (
      activeMultiCurrency && originalCurrency !== 'BRL' &&
      (!isCurrencyInputValid(iofPercentStr, 'BRL') || parsedIofPercent < 0 || parsedIofPercent > 100)
    ) {
      setError('Informe um IOF válido entre 0% e 100%, com até duas casas decimais.');
      return;
    }
    if (
      activeMultiCurrency && originalCurrency !== 'BRL' && parsedForeignAmount > 0 &&
      (!fxConversionPreview || !fxConversionPreview.isValid)
    ) {
      setError('A conversão excede o limite de cálculo seguro. Reduza o valor ou a cotação.');
      return;
    }
    if (numericAmount <= 0) {
      setError('Informe um valor válido maior que zero.');
      return;
    }
    if ((entryMode === 'expense' || entryMode === 'credit_card') && !paymentChosen) {
      setError('Escolha a forma de pagamento: conta/débito ou cartão de crédito.');
      return;
    }
    if (entryMode !== 'transfer' && !categoryId) {
      setError('Escolha a categoria do lançamento. O sistema aprende e passa a sugerir sozinho nas próximas vezes.');
      return;
    }

    const isDirectInvestmentTransfer =
      entryMode === 'transfer' && destinationAccountId.startsWith('inv:');
    const extractedAssetId = isDirectInvestmentTransfer
      ? destinationAccountId.slice(4)
      : undefined;

    let transferLegs: { transferFromAmount?: number; transferToAmount?: number; transferExchangeRate?: number } = {};
    const isCardBillPayment = entryMode === 'transfer' && transferSubMode === 'card_bill_payment';
    if (isCardBillPayment && getAccountCurrency(selectedPaymentAccount) !== 'BRL') {
      setError('A fatura do cartão é em reais. Pague por uma conta em reais.');
      return;
    }
    if (entryMode === 'transfer' && !isCardBillPayment) {
      const resolved = resolveBankTransfer({
        source: selectedPaymentAccount,
        destination: isDirectInvestmentTransfer ? null : selectedDestinationAccount,
        destinationIsInvestment: isDirectInvestmentTransfer,
        amountBrl: numericAmount,
        foreignAmount: transferForeignAmount,
      });
      if ('error' in resolved && resolved.error) {
        setError(resolved.error);
        return;
      }
      if (
        transferForeignCurrency &&
        !isCurrencyInputValid(transferForeignAmountStr, transferForeignCurrency)
      ) {
        setError(`Informe o valor em ${transferForeignCurrency} usando até ${CURRENCY_CATALOG[transferForeignCurrency].decimals} casa(s) decimal(is).`);
        return;
      }
      if ('legs' in resolved) transferLegs = resolved.legs;
    }

    let finalSharedAmount: number | undefined = undefined;
    if (isShared && entryMode !== 'income' && entryMode !== 'transfer') {
      finalSharedAmount = calculateSharedAmount(numericAmount, sharedSplitMode, parseBRLInput(sharedCustomPercentStr), parseBRLInput(sharedCustomAmountStr));
    }

    if (activeMultiCurrency && tripId && tripSplitValidationError) {
      setError(tripSplitValidationError);
      return;
    }

    // Enforce business rule: installment ONLY when credit_card
    const safeRecurrence: RecurrenceType =
      entryMode !== 'credit_card' && recurrence === 'installment'
        ? 'single'
        : recurrence;

    const isCardBillSettlement =
      entryMode === 'transfer' && transferSubMode === 'card_bill_payment';

    const finalTags = normalizeTransactionTags(
      tagInput.trim() ? [...tags, tagInput] : tags
    );

    const batchInput: CreateTransactionBatchInput = {
      description: description.trim(),
      amount: numericAmount,
      amountMode:
        safeRecurrence === 'installment' ? amountMode : 'per_installment',
      installmentPurchaseTotal:
        safeRecurrence === 'installment' && !legacyInstallmentTotalUnknown
          ? Math.round(
              (amountMode === 'total_divided'
                ? numericAmount
                : numericAmount * installmentTotal) * 100
            ) / 100
          : undefined,
      date,
      competenceMonth:
        entryMode === 'credit_card'
          ? invoiceCompetenceMonth ||
            resolveCreditCardInvoiceMonth(
              date,
              cards.find((c) => c.id === creditCardId)
            )
          : isCardBillSettlement
          ? billPaymentInvoiceMonth
          : date.slice(0, 7) || selectedMonth,
      type:
        entryMode === 'transfer' && !isCardBillSettlement
          ? 'transfer'
          : entryMode === 'income'
          ? 'income'
          : 'expense',
      status: entryMode === 'credit_card' ? 'pending' : status,
      isCardRefund: entryMode === 'credit_card' && isCardRefund && !editingTransaction ? true : undefined,
      categoryId:
        entryMode === 'transfer'
          ? isCardBillSettlement
            ? 'cat-fatura'
            : isDirectInvestmentTransfer
            ? 'cat-aportes'
            : categories[0]?.id || 'cat-moradia'
          : categoryId,
      accountId: entryMode === 'credit_card' ? undefined : accountId,
      destinationAccountId:
        entryMode === 'transfer' &&
        !isDirectInvestmentTransfer &&
        !isCardBillSettlement
          ? destinationAccountId
          : undefined,
      targetInvestmentAssetId: extractedAssetId,
      transferFromAmount: transferLegs.transferFromAmount,
      transferToAmount: transferLegs.transferToAmount,
      transferExchangeRate: transferLegs.transferExchangeRate,
      isInvoicePayment: isCardBillSettlement ? true : undefined,
      settledCardId: isCardBillSettlement ? billPaymentCardId : undefined,
      creditCardId: entryMode === 'credit_card' ? creditCardId : undefined,
      paymentMethod:
        entryMode === 'credit_card'
          ? 'credit_card'
          : isCardBillSettlement
          ? 'boleto'
          : entryMode === 'transfer'
          ? 'transfer'
          : paymentMethod,
      recurrence: entryMode === 'transfer' ? 'single' : safeRecurrence,
      installmentTotal:
        safeRecurrence === 'installment' ? installmentTotal : undefined,
      fixedMonthsCount:
        safeRecurrence === 'fixed' ? fixedMonthsCount : undefined,
      notes: notes.trim() || undefined,
      tags: finalTags.length > 0 ? finalTags : undefined,
      isShared:
        !activeMultiCurrency && entryMode !== 'income' && entryMode !== 'transfer' && !isCardRefund
          ? isShared
          : false,
      sharedMemberId:
        !activeMultiCurrency &&
        isShared &&
        entryMode !== 'income' &&
        entryMode !== 'transfer'
          ? sharedMemberId
          : undefined,
      sharedAmount: !activeMultiCurrency ? finalSharedAmount : undefined,
      sharedPaidBy:
        !activeMultiCurrency &&
        isShared &&
        entryMode !== 'income' &&
        entryMode !== 'transfer'
          ? sharedPaidBy
          : undefined,
      sharedSplitMode:
        !activeMultiCurrency &&
        isShared &&
        entryMode !== 'income' &&
        entryMode !== 'transfer'
          ? sharedSplitMode === 'half'
            ? 'half'
            : 'custom'
          : undefined,
      sharedStatus: 'pending',

      // Multi-Currency & TravelSpend fields
      originalCurrency: activeMultiCurrency ? originalCurrency : undefined,
      originalAmount:
        activeMultiCurrency && originalCurrency !== 'BRL'
          ? parsedForeignAmount
          : activeMultiCurrency && tripId
          ? numericAmount
          : undefined,
      exchangeRate:
        activeMultiCurrency && originalCurrency !== 'BRL'
          ? parsedExchangeRate
          : undefined,
      effectiveExchangeRate:
        activeMultiCurrency &&
        originalCurrency !== 'BRL' &&
        fxConversionPreview
          ? fxConversionPreview.effectiveRate
          : undefined,
      iofPercent:
        activeMultiCurrency && originalCurrency !== 'BRL'
          ? parsedIofPercent
          : undefined,
      currencyRegime:
        activeMultiCurrency && originalCurrency !== 'BRL'
          ? currencyRegime
          : undefined,
      tripId: activeMultiCurrency && tripId ? tripId : undefined,
      paidByParticipantId:
        activeMultiCurrency && tripId ? tripPayerParticipantId : undefined,
      tripSplitMethod:
        activeMultiCurrency && tripId ? tripSplitMethod : undefined,
      tripShares:
        activeMultiCurrency && tripId && tripSharesPreview.length > 0
          ? tripSharesPreview
          : undefined,
      myPersonalShareBrl:
        activeMultiCurrency && tripId && myTripShareObj
          ? myTripShareObj.brlShare
          : undefined,
      myPersonalShareForeign:
        activeMultiCurrency && tripId && myTripShareObj
          ? myTripShareObj.foreignShare
          : undefined,
      isCompanionOnlyExpense:
        activeMultiCurrency && tripId ? isPaidByCompanion : undefined,
    };

    onSaveBatch(batchInput, editingTransaction?.id, cascadeScope);
    onClose();
  };

  const selectedAccountName =
    (() => {
      const acc = accounts.find((a) => a.id === accountId);
      return acc ? getAccountLabel(acc, accounts) : 'Conta Principal';
    })();
  const selectedCardName =
    cards.find((c) => c.id === creditCardId)?.name || 'Cartão de Crédito';

  return {
    calculatedSharedPreview,
    handleAddTag,
    handleApplySmartCategory,
    handleCategoryChange,
    handleRemoveTag,
    handleSubmit,
    handleTagInputKeyDown,
    selectedAccountName,
    selectedCardName,
    toggleTripParticipant,
  };
}

export type TransactionFormActionsApi = ReturnType<typeof buildTransactionFormActions>;
