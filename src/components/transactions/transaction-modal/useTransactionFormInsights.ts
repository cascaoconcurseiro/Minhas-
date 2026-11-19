/** Categorias, sugestões, avisos (saldo, duplicado, data), impacto no orçamento e etiquetas. Parte de TransactionModal (ver TransactionModal.tsx). */
import { useDeferredValue, useEffect, useMemo } from 'react';
import { Category, TripExpenseShare } from '../../../types/finance';
import { calculateSharedAmount, extractAvailableTransactionTags, getLocalDateISO, normalizeSearchText, parseBRLInput, previewCategoryBudget } from '../../../domain/finance/financeRules';
import { isCurrencyInputValid, parseCurrencyInput } from '../../../utils/currencyInput';
import { CURRENCY_CATALOG, CustomParticipantSplitInput, calculateTripExpenseSplit, validateTripExpenseSplitInputs } from '../../../domain/trips/travelRules';
import { SmartTransactionSuggestion, getSmartTransactionSuggestions, predictCategoryFromDescription } from '../../../domain/budgets/uxEnhancementRules';
import { getDescriptionLearningKey, learnSharingFromHistory, sharingFromCategoryRule } from '../../../domain/budgets/learningRules';
import { assessAmount, findProbableDuplicate, learnPaymentHabit } from '../../../domain/budgets/decisionEngine';
import { assessAccountBalanceImpact, assessCardLimitImpact, assessDateSanity } from '../../../domain/finance/spendingGuards';
import { getAccountCurrency } from '../../../domain/finance/transferRules';
import { PAYMENT_METHOD_LABELS } from './transactionModalConfig';
import type { TransactionModalPropsApi } from './transactionModalConfig';
import type { TransactionFormStateApi } from './useTransactionFormState';
import type { TransactionFormEffectsApi } from './useTransactionFormEffects';

export function useTransactionFormInsights(ctx: TransactionModalPropsApi & TransactionFormStateApi & TransactionFormEffectsApi) {
  const {
    accountId,
    accounts,
    amountMode,
    amountStr,
    autoHabitKeyRef,
    autoSharingApplied,
    autoSharingKeyRef,
    budgetWarningPercent,
    cards,
    cascadeScope,
    categories,
    categoryId,
    categorySharingRules,
    creditCardId,
    currencyRegime,
    date,
    description,
    destinationAccountId,
    editingTransaction,
    entryMode,
    familyMembers,
    installmentTotal,
    investments,
    invoiceCompetenceMonth,
    isMultiCurrencyOpen,
    isOpen,
    isPaidByCompanion,
    isCardRefund,
    isShared,
    isTripLinked,
    legacyInstallmentTotalUnknown,
    originalCurrency,
    parsedForeignAmount,
    paymentMethod,
    recurrence,
    selectedMonth,
    selectedPaymentAccount,
    selectedTrip,
    selectedTripParticipantIds,
    setAccountId,
    setAmountStr,
    setAutoAppliedCategoryNotice,
    setAutoHabitNotice,
    setAutoSharingApplied,
    setCategoryId,
    setCreditCardId,
    setDescription,
    setIsShared,
    setOriginalAmountStr,
    setPaymentMethod,
    setSharedCustomPercentStr,
    setSharedMemberId,
    setSharedPaidBy,
    setSharedSplitMode,
    setUserManuallySelectedCategory,
    sharedCustomAmountStr,
    sharedCustomPercentStr,
    sharedMemberId,
    sharedPaidBy,
    sharedSplitMode,
    sharingTouchedRef,
    status,
    tags,
    transactions,
    transferSubMode,
    tripCustomInputs,
    tripId,
    tripSplitMethod,
    userManuallySelectedCategory,
  } = ctx;
  const filteredCategories = useMemo(
    () =>
      categories.filter((c) =>
        entryMode === 'income' ? c.type === 'income' : c.type === 'expense'
      ),
    [categories, entryMode]
  );

  // Categorias de despesa agrupadas por tipo (Essenciais, Estilo de vida, Objetivos), em ordem alfabética dentro
  // de cada grupo; as de receita ficam numa lista só, também em ordem alfabética.
  const groupedCategoryOptions = useMemo(() => {
    const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, 'pt-BR');
    if (entryMode === 'income') {
      return [{ key: 'income', label: '', items: [...filteredCategories].sort(byName) }];
    }
    const groups: Array<{ key: string; label: string; bucket: Category['bucket'] }> = [
      { key: 'essential', label: 'Essenciais', bucket: 'essential' },
      { key: 'lifestyle', label: 'Estilo de vida e lazer', bucket: 'lifestyle' },
      { key: 'financial', label: 'Objetivos e poupança', bucket: 'financial' },
    ];
    return groups
      .map((group) => ({
        key: group.key,
        label: group.label,
        items: filteredCategories.filter((cat) => cat.bucket === group.bucket).sort(byName),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredCategories, entryMode]);

  const selectedCategoryObj =
    filteredCategories.find((c) => c.id === categoryId);

  const numericPreview = parseBRLInput(amountStr);
  // Digitar não espera as buscas pesadas no histórico: elas acompanham logo depois, sem travar a tecla
  const deferredDescription = useDeferredValue(description);
  const deferredNumericPreview = useDeferredValue(numericPreview);

  const tripSplitValidationError = useMemo(() => {
    if (!selectedTrip || selectedTrip.participants.length <= 1) return null;
    if (tripSplitMethod === 'exact' && originalCurrency !== 'BRL') {
      const hasInvalidPrecision = selectedTrip.participants.some((participant) => {
        if (!selectedTripParticipantIds.includes(participant.id)) return false;
        const rawValue = tripCustomInputs[participant.id] || '';
        return rawValue.trim() !== '' && !isCurrencyInputValid(rawValue, originalCurrency);
      });
      if (hasInvalidPrecision) {
        return `Informe os valores individuais com até ${CURRENCY_CATALOG[originalCurrency].decimals} casa(s) decimal(is).`;
      }
    }
    const totalForeign =
      originalCurrency !== 'BRL' && parsedForeignAmount > 0
        ? parsedForeignAmount
        : numericPreview;
    const activeIds =
      selectedTripParticipantIds.length > 0
        ? selectedTripParticipantIds
        : selectedTrip.participants.map((participant) => participant.id);
    const customInputs = selectedTrip.participants.map((participant) => {
      const value = tripSplitMethod === 'exact'
        ? parseCurrencyInput(tripCustomInputs[participant.id] || '', originalCurrency)
        : parseBRLInput(tripCustomInputs[participant.id] || '');
      return {
        participantId: participant.id,
        exactForeign: tripSplitMethod === 'exact' ? value : undefined,
        percentage: tripSplitMethod === 'percentage' ? value : undefined,
      };
    });
    return validateTripExpenseSplitInputs(
      totalForeign,
      selectedTrip.participants,
      activeIds,
      tripSplitMethod,
      customInputs
    );
  }, [
    selectedTrip,
    originalCurrency,
    parsedForeignAmount,
    numericPreview,
    selectedTripParticipantIds,
    tripSplitMethod,
    tripCustomInputs,
  ]);

  // Compute live Trip Shares when a trip is selected
  const tripSharesPreview = useMemo((): TripExpenseShare[] => {
    if (!selectedTrip || selectedTrip.participants.length === 0) return [];
    const totalForeign =
      originalCurrency !== 'BRL' && parsedForeignAmount > 0
        ? parsedForeignAmount
        : numericPreview;
    const totalBrl = numericPreview;
    if (totalBrl <= 0) return [];
    if (tripSplitValidationError) return [];

    const activeIds =
      selectedTripParticipantIds.length > 0
        ? selectedTripParticipantIds
        : selectedTrip.participants.map((p) => p.id);

    const customList: CustomParticipantSplitInput[] =
      selectedTrip.participants.map((p) => {
        const val = tripSplitMethod === 'exact'
          ? parseCurrencyInput(tripCustomInputs[p.id] || '', originalCurrency)
          : parseBRLInput(tripCustomInputs[p.id] || '');
        return {
          participantId: p.id,
          exactForeign: tripSplitMethod === 'exact' ? val : undefined,
          percentage: tripSplitMethod === 'percentage' ? val : undefined,
          sharesWeight:
            tripSplitMethod === 'shares' ? (val > 0 ? val : 1) : undefined,
        };
      });

    return calculateTripExpenseSplit(
      totalForeign,
      totalBrl,
      selectedTrip.participants,
      activeIds,
      tripSplitMethod,
      customList,
      originalCurrency
    );
  }, [
    selectedTrip,
    originalCurrency,
    parsedForeignAmount,
    numericPreview,
    selectedTripParticipantIds,
    tripSplitMethod,
    tripCustomInputs,
    tripSplitValidationError,
  ]);

  const myTripShareObj = useMemo(() => {
    if (!selectedTrip || tripSharesPreview.length === 0) return null;
    const mePart = selectedTrip.participants.find(
      (p) => p.isMe || p.id === 'me'
    );
    const myId = mePart?.id || 'me';
    return tripSharesPreview.find((s) => s.participantId === myId) || null;
  }, [selectedTrip, tripSharesPreview]);

  const smartSuggestions = useMemo(() => {
    if (editingTransaction || entryMode === 'transfer') return [];
    return getSmartTransactionSuggestions(
      deferredDescription,
      transactions,
      entryMode,
      5
    );
  }, [deferredDescription, transactions, entryMode, editingTransaction]);

  // Intelligent Category Suggestion based on Description and Past User Transactions
  const smartCategorySuggestion = useMemo(() => {
    if (editingTransaction || entryMode === 'transfer' || !deferredDescription.trim()) {
      return null;
    }
    return predictCategoryFromDescription(
      deferredDescription,
      transactions,
      categories,
      entryMode
    );
  }, [deferredDescription, transactions, categories, entryMode, editingTransaction]);

  const smartCategoryTarget = useMemo(() => {
    if (!smartCategorySuggestion) return null;
    const suggestedCategory = categories.find(
      (category) => category.id === smartCategorySuggestion.categoryId
    );
    if (!suggestedCategory) return null;
    return { categoryId: suggestedCategory.id };
  }, [smartCategorySuggestion, categories]);

  // Auto-apply category suggestion when confidence is high and user hasn't manually overridden
  useEffect(() => {
    if (
      !isOpen ||
      editingTransaction ||
      entryMode === 'transfer' ||
      userManuallySelectedCategory ||
      !smartCategorySuggestion ||
      !smartCategoryTarget ||
      smartCategorySuggestion.confidence < 0.65
    ) {
      return;
    }

    if (categoryId !== smartCategoryTarget.categoryId) {
      setCategoryId(smartCategoryTarget.categoryId);
      setAutoAppliedCategoryNotice(
        `Categoria "${smartCategorySuggestion.categoryName}" sugerida automaticamente`
      );
    }
  }, [
    isOpen,
    editingTransaction,
    entryMode,
    userManuallySelectedCategory,
    smartCategorySuggestion,
    smartCategoryTarget,
    categoryId,
    categories,
  ]);

  const learnedSharing = useMemo(() => {
    if (editingTransaction || entryMode === 'transfer' || entryMode === 'income') {
      return null;
    }
    // A regra de Configurações para a categoria vale antes do histórico
    const fromRule = categoryId
      ? sharingFromCategoryRule(
          categorySharingRules?.[categoryId],
          categories.find((item) => item.id === categoryId)?.name ?? 'escolhida',
          familyMembers
        )
      : null;
    if (fromRule) return fromRule;
    if (!deferredDescription.trim()) return null;
    return learnSharingFromHistory(deferredDescription, transactions, familyMembers);
  }, [deferredDescription, transactions, familyMembers, entryMode, editingTransaction, categoryId, categories, categorySharingRules]);

  // Aplica sozinho a divisão que a pessoa sempre usa para este gasto e só avisa (com "Desfazer").
  useEffect(() => {
    if (!isOpen || editingTransaction) return;
    if (!learnedSharing) {
      // O estabelecimento deixou de ser o que gerou a divisão automática: volta ao normal.
      if (autoSharingApplied && !sharingTouchedRef.current) {
        setIsShared(false);
        setAutoSharingApplied(null);
        autoSharingKeyRef.current = null;
      }
      return;
    }
    const key = learnedSharing.fromCategoryRule ? `categoria:${categoryId}` : getDescriptionLearningKey(description);
    if (
      autoSharingKeyRef.current === key ||
      sharingTouchedRef.current ||
      isShared ||
      isTripLinked ||
      isMultiCurrencyOpen
    ) {
      return;
    }
    autoSharingKeyRef.current = key;
    setIsShared(true);
    setSharedMemberId(learnedSharing.memberId);
    setSharedPaidBy(learnedSharing.paidBy);
    setSharedSplitMode(learnedSharing.splitMode);
    if (learnedSharing.splitMode === 'percentage') {
      setSharedCustomPercentStr(String(learnedSharing.percentage));
    }
    setAutoSharingApplied(learnedSharing);
  }, [
    isOpen,
    editingTransaction,
    learnedSharing,
    autoSharingApplied,
    description,
    categoryId,
    isShared,
    isTripLinked,
    isMultiCurrencyOpen,
  ]);

  // Hábito de pagamento: mesma conta/cartão/forma de pagamento das últimas vezes neste lugar.
  const paymentHabit = useMemo(() => {
    if (
      editingTransaction ||
      !deferredDescription.trim() ||
      (entryMode !== 'expense' && entryMode !== 'credit_card')
    ) {
      return null;
    }
    return learnPaymentHabit(deferredDescription, transactions, entryMode);
  }, [deferredDescription, transactions, entryMode, editingTransaction]);

  useEffect(() => {
    if (!isOpen || editingTransaction || !paymentHabit || isTripLinked || isMultiCurrencyOpen) return;
    const key = `${entryMode}:${getDescriptionLearningKey(description)}`;
    if (autoHabitKeyRef.current === key) return;

    const applied: string[] = [];
    // Só preenche o que a pessoa ainda não escolheu; escolha feita por ela nunca é sobrescrita.
    if (entryMode === 'credit_card') {
      const card = paymentHabit.creditCardId?.value;
      if (card && card !== creditCardId && cards.some((item) => item.id === card) && creditCardId === '') {
        setCreditCardId(card);
        applied.push(cards.find((item) => item.id === card)?.name ?? 'cartão');
      }
    } else {
      const account = paymentHabit.accountId?.value;
      if (account && account !== accountId && accounts.some((item) => item.id === account) && accountId === '') {
        setAccountId(account);
        applied.push(accounts.find((item) => item.id === account)?.name ?? 'conta');
      }
      const method = paymentHabit.paymentMethod?.value;
      if (method && method !== paymentMethod && paymentMethod === 'pix') {
        setPaymentMethod(method);
        applied.push(PAYMENT_METHOD_LABELS[method] ?? method);
      }
    }
    if (applied.length > 0) {
      autoHabitKeyRef.current = key;
      setAutoHabitNotice(`Usei ${applied.join(' e ')} como nas últimas vezes neste lugar.`);
    }
  }, [
    isOpen,
    editingTransaction,
    paymentHabit,
    isTripLinked,
    isMultiCurrencyOpen,
    entryMode,
    description,
    creditCardId,
    accountId,
    paymentMethod,
    cards,
    accounts,
  ]);

  const amountWarning = useMemo(() => {
    if (editingTransaction || entryMode === 'income' || entryMode === 'transfer' || isCardRefund) return null;
    return assessAmount(deferredDescription, deferredNumericPreview, transactions);
  }, [deferredDescription, deferredNumericPreview, transactions, entryMode, editingTransaction, isCardRefund]);

  const duplicateWarning = useMemo(() => {
    if (isCardRefund) return null;
    if (transferSubMode === 'card_bill_payment' && entryMode === 'transfer') return null;
    return findProbableDuplicate(
      {
        description: deferredDescription,
        amount: deferredNumericPreview,
        date,
        type: entryMode === 'income' ? 'income' : entryMode === 'transfer' ? 'transfer' : 'expense',
        accountId: entryMode === 'transfer' ? accountId : undefined,
        destinationKey: entryMode === 'transfer' ? destinationAccountId : undefined,
      },
      transactions,
      editingTransaction?.id
    );
  }, [deferredDescription, deferredNumericPreview, date, transactions, entryMode, transferSubMode, accountId, destinationAccountId, editingTransaction, isCardRefund]);

  // Avisos (não bloqueiam): saldo da conta que ficaria negativo e compra acima do limite do cartão.
  const spendingWarning = useMemo(() => {
    if (!(numericPreview > 0) || isCardRefund || (selectedTrip && isPaidByCompanion)) return null;
    if (isShared && sharedPaidBy === 'member' && entryMode !== 'transfer') return null;
    if (entryMode === 'credit_card') {
      const card = cards.find((c) => c.id === creditCardId);
      const purchaseTotal =
        recurrence === 'installment' && installmentTotal > 1 && amountMode === 'per_installment'
          ? numericPreview * installmentTotal
          : numericPreview;
      return assessCardLimitImpact({
        card,
        transactions,
        purchaseTotal,
        date,
        ignoreGroupId: editingTransaction?.installmentGroupId,
        ignoreTransactionId: editingTransaction?.id,
      });
    }
    const spendsFromAccount =
      entryMode === 'expense' || entryMode === 'transfer';
    if (!spendsFromAccount) return null;
    return assessAccountBalanceImpact({
      account: selectedPaymentAccount,
      accounts,
      transactions,
      amount: numericPreview,
      date,
      status,
      ignoreTransactionId: editingTransaction?.id,
    });
  }, [
    numericPreview, entryMode, cards, creditCardId, recurrence, installmentTotal, amountMode,
    transactions, date, editingTransaction, selectedTrip, isPaidByCompanion, selectedPaymentAccount,
    accounts, status, isShared, sharedPaidBy,
  , isCardRefund]);

  const dateWarning = useMemo(
    () =>
      assessDateSanity({
        date,
        status: entryMode === 'credit_card' ? 'pending' : status,
        today: getLocalDateISO(),
      }),
    [date, status, entryMode]
  );

  // O que falta cadastrar para este lançamento fazer sentido (conta, segunda conta ou cartão).
  const missingSetup = useMemo((): { kind: 'account' | 'card' | 'international_account'; testId: string; message: string; action: string } | null => {
    // Viagem em espécie, cartão no exterior, gasto de acompanhante e gasto pago por familiar não usam conta bancária.
    const tripWithoutBank = Boolean(isTripLinked && selectedTrip && (currencyRegime === 'cash_fx' || currencyRegime === 'credit_card_intl'));
    const noBankNeeded = tripWithoutBank || Boolean(selectedTrip && isPaidByCompanion) || (isShared && sharedPaidBy === 'member' && entryMode !== 'transfer');
    if (entryMode === 'expense' && isTripLinked && selectedTrip && currencyRegime === 'global_account' && !(selectedTrip.isArchived) &&
      !accounts.some((account) => account.type === 'international' && account.currency === selectedTrip.currency)) {
      return { kind: 'international_account', testId: 'missing-international-account', message: `Esta viagem é em ${selectedTrip.currency} e não há conta internacional em ${selectedTrip.currency} cadastrada. Cadastre a conta global (Wise, Nomad...) ou escolha outra forma de pagamento.`, action: 'Cadastrar conta internacional' };
    }
    if (entryMode === 'credit_card') {
      return cards.length === 0
        ? { kind: 'card', testId: 'missing-card', message: 'Você ainda não tem cartão de crédito cadastrado. Cadastre o cartão para lançar esta compra na fatura certa.', action: 'Cadastrar cartão' }
        : null;
    }
    if (entryMode === 'transfer') {
      if (transferSubMode === 'card_bill_payment') {
        if (cards.length === 0) {
          return { kind: 'card', testId: 'missing-card', message: 'Não há cartão cadastrado para pagar a fatura. Cadastre o cartão primeiro.', action: 'Cadastrar cartão' };
        }
        if (!accounts.some((account) => getAccountCurrency(account) === 'BRL')) {
          return { kind: 'account', testId: 'missing-account', message: 'A fatura é em reais e não há conta em reais cadastrada para pagá-la. Cadastre uma conta.', action: 'Cadastrar conta' };
        }
        return null;
      }
      if (accounts.length === 0) {
        return { kind: 'account', testId: 'missing-account', message: 'Você ainda não tem conta cadastrada. Cadastre as contas de origem e de destino da transferência.', action: 'Cadastrar conta' };
      }
      if (transferSubMode === 'bank_to_bank' && accounts.length === 1 && investments.length === 0) {
        return { kind: 'account', testId: 'transfer-needs-second-account', message: 'Para transferir entre contas é preciso ter outra conta cadastrada: não existe transferir de uma conta para ela mesma. Cadastre a conta de destino.', action: 'Cadastrar outra conta' };
      }
      return null;
    }
    if (accounts.length === 0 && !noBankNeeded) {
      return { kind: 'account', testId: 'missing-account', message: `Você ainda não tem conta cadastrada. Cadastre a conta ${entryMode === 'income' ? 'onde a receita cai' : 'de onde a despesa sai'} para o saldo ficar certo.`, action: 'Cadastrar conta' };
    }
    return null;
  }, [entryMode, transferSubMode, accounts, cards, investments, selectedTrip, isTripLinked, currencyRegime, isPaidByCompanion, isShared, sharedPaidBy]);

  const handleUndoAutoSharing = () => {
    sharingTouchedRef.current = true;
    setIsShared(false);
    setAutoSharingApplied(null);
  };

  const handleApplySmartSuggestion = (sug: SmartTransactionSuggestion) => {
    setDescription(sug.cleanDescription);
    if (!amountStr || parseBRLInput(amountStr) === 0) {
      setAmountStr(sug.lastAmount.toFixed(2).replace('.', ','));
    }
    setCategoryId(sug.categoryId);
    setPaymentMethod(sug.paymentMethod);
    if (sug.creditCardId && entryMode === 'credit_card') {
      setCreditCardId(sug.creditCardId);
    } else if (sug.accountId && entryMode !== 'credit_card') {
      setAccountId(sug.accountId);
    }
    setUserManuallySelectedCategory(false);
    setAutoAppliedCategoryNotice(null);
  };

  const handleQuickAddAmount = (increment: number) => {
    if (isMultiCurrencyOpen && originalCurrency !== 'BRL') {
      const next = Math.max(0, parsedForeignAmount + increment);
      setOriginalAmountStr(next.toFixed(2).replace('.', ','));
    } else {
      const next = Math.max(0, numericPreview + increment);
      setAmountStr(next.toFixed(2).replace('.', ','));
    }
  };

  const liveBudgetImpact = useMemo(() => {
    if (entryMode === 'income' || entryMode === 'transfer' || isCardRefund || !categoryId || numericPreview <= 0 || (selectedTrip && isPaidByCompanion)) {
      return null;
    }
    const domesticSharing = isShared && !((isTripLinked || isMultiCurrencyOpen) && (originalCurrency !== 'BRL' || Boolean(tripId)));
    return previewCategoryBudget(categories, transactions, {
      description: deferredDescription, amount: deferredNumericPreview, date,
      competenceMonth: entryMode === 'credit_card' ? invoiceCompetenceMonth : date.slice(0, 7),
      categoryId, type: 'expense', status,
      creditCardId: entryMode === 'credit_card' ? creditCardId : undefined,
      paymentMethod: entryMode === 'credit_card' ? 'credit_card' : paymentMethod,
      recurrence: entryMode !== 'credit_card' && recurrence === 'installment' ? 'single' : recurrence,
      amountMode, installmentTotal,
      isShared: domesticSharing, sharedMemberId: domesticSharing ? sharedMemberId : undefined,
      sharedPaidBy: domesticSharing ? sharedPaidBy : undefined, sharedStatus: 'pending',
      sharedSplitMode: sharedSplitMode === 'half' ? 'half' : 'custom',
      sharedAmount: domesticSharing ? calculateSharedAmount(numericPreview, sharedSplitMode, parseBRLInput(sharedCustomPercentStr), parseBRLInput(sharedCustomAmountStr)) : undefined,
      installmentPurchaseTotal: recurrence === 'installment' && !legacyInstallmentTotalUnknown
        ? Math.round((amountMode === 'total_divided' ? numericPreview : numericPreview * installmentTotal) * 100) / 100
        : undefined,
    }, editingTransaction?.id, cascadeScope, budgetWarningPercent);
  }, [
    entryMode,
    categoryId,
    categories,
    transactions, date, invoiceCompetenceMonth, creditCardId, status, paymentMethod,
    deferredDescription, deferredNumericPreview, cascadeScope, legacyInstallmentTotalUnknown, selectedTrip, isPaidByCompanion,
    isShared, sharedMemberId, sharedPaidBy, sharedSplitMode, sharedCustomPercentStr, sharedCustomAmountStr,
    isTripLinked, isMultiCurrencyOpen, originalCurrency, tripId,
    numericPreview,
    recurrence,
    amountMode,
    installmentTotal,
    editingTransaction,
    selectedMonth,
    budgetWarningPercent,
  , isCardRefund]);

  const availableTagSuggestions = useMemo(() => {
    const allSuggested = extractAvailableTransactionTags(transactions, true);
    const activeKeys = new Set(tags.map((t) => normalizeSearchText(t)));
    return allSuggested
      .filter((t) => !activeKeys.has(normalizeSearchText(t)))
      .slice(0, 8);
  }, [transactions, tags]);

  return {
    amountWarning,
    availableTagSuggestions,
    dateWarning,
    duplicateWarning,
    groupedCategoryOptions,
    handleApplySmartSuggestion,
    handleQuickAddAmount,
    handleUndoAutoSharing,
    liveBudgetImpact,
    missingSetup,
    myTripShareObj,
    numericPreview,
    selectedCategoryObj,
    smartCategorySuggestion,
    smartCategoryTarget,
    smartSuggestions,
    spendingWarning,
    tripSharesPreview,
    tripSplitValidationError,
  };
}

export type TransactionFormInsightsApi = ReturnType<typeof useTransactionFormInsights>;
