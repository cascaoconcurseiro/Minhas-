/** Estado dos campos do formulário e valores derivados simples. Parte de TransactionModal (ver TransactionModal.tsx). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CascadeScope, calculateCreditCardSummary, getLocalDateISO } from '../../../domain/finance/financeRules';
import { CurrencyCode, CurrencyPaymentRegime, FamilyMember, PaymentMethod, RecurrenceType, TransactionStatus, TripSplitMethod } from '../../../types/finance';
import { getAccountCurrency, getTransferDestinationAccounts, planTransferCurrency } from '../../../domain/finance/transferRules';
import { parseCurrencyInput } from '../../../utils/currencyInput';
import { type LearnedSharing } from '../../../domain/budgets/learningRules';
import { computeModalScrollState } from '../../../utils/modalScrollRules';
import { DomesticSharedSplitMode } from './transactionModalConfig';
import type { TransactionModalPropsApi } from './transactionModalConfig';

export function useTransactionFormState(ctx: TransactionModalPropsApi) {
  const {
    accounts,
    cards,
    editingTransaction,
    selectedMonth,
    transactions,
    trips,
  } = ctx;
  const [entryMode, setEntryMode] = useState<
    'expense' | 'income' | 'credit_card' | 'transfer'
  >('expense');
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [amountMode, setAmountMode] = useState<
    'total_divided' | 'per_installment'
  >('total_divided');
  const [legacyInstallmentTotalUnknown, setLegacyInstallmentTotalUnknown] =
    useState(false);
  const [date, setDate] = useState(getLocalDateISO());
  const [status, setStatus] = useState<TransactionStatus>('paid');
  const [categoryId, setCategoryId] = useState('');
  // Forma de pagamento (conta/débito ou cartão) escolhida de propósito: em lançamento novo começa sem escolha
  const [paymentChosen, setPaymentChosen] = useState(true);
  const [accountId, setAccountId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [creditCardId, setCreditCardId] = useState('');
  const [invoiceCompetenceMonth, setInvoiceCompetenceMonth] =
    useState<string>(selectedMonth);
  const [isInvoiceMonthOverrideOpen, setIsInvoiceMonthOverrideOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('single');
  const [installmentTotal, setInstallmentTotal] = useState<number>(2);
  const [fixedMonthsCount, setFixedMonthsCount] = useState<number>(12);
  const [cascadeScope, setCascadeScope] =
    useState<CascadeScope>('this_and_future');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState('');

  // Progressive disclosure toggle switch states (Liga/Desliga)
  const [isTripLinked, setIsTripLinked] = useState<boolean>(false);
  const [isShared, setIsShared] = useState<boolean>(false);
  // Estorno/devolução no cartão (reduz a fatura). Só em lançamento novo de cartão, à vista.
  const [isCardRefund, setIsCardRefund] = useState<boolean>(false);
  const [sharedMemberId, setSharedMemberId] = useState<string>('');
  const [sharedPaidBy, setSharedPaidBy] = useState<'me' | 'member'>('me');
  const [sharedSplitMode, setSharedSplitMode] =
    useState<DomesticSharedSplitMode>('half');
  const [sharedCustomPercentStr, setSharedCustomPercentStr] =
    useState<string>('50');
  const [sharedCustomAmountStr, setSharedCustomAmountStr] =
    useState<string>('');

  // Inline quick family member creation
  const [isAddingFamilyMember, setIsAddingFamilyMember] = useState<boolean>(false);
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberEmail, setNewMemberEmail] = useState<string>('');
  const [inlineFamilyMemberError, setInlineFamilyMemberError] = useState<string | null>(null);
  const [newMemberRelationship, setNewMemberRelationship] =
    useState<FamilyMember['relationship']>('cônjuge');

  // Multi-Currency & TravelSpend states
  const [isMultiCurrencyOpen, setIsMultiCurrencyOpen] =
    useState<boolean>(false);
  const [tripId, setTripId] = useState<string>('');
  const [originalCurrency, setOriginalCurrency] = useState<CurrencyCode>('BRL');
  const [originalAmountStr, setOriginalAmountStr] = useState<string>('');
  const [currencyRegime, setCurrencyRegime] =
    useState<CurrencyPaymentRegime>('global_account');
  const [exchangeRateStr, setExchangeRateStr] = useState<string>('1,0000');
  const [iofPercentStr, setIofPercentStr] = useState<string>('0,00');
  const [tripPayerParticipantId, setTripPayerParticipantId] =
    useState<string>('me');
  const [tripSplitMethod, setTripSplitMethod] =
    useState<TripSplitMethod>('equal');
  const [selectedTripParticipantIds, setSelectedTripParticipantIds] = useState<
    string[]
  >([]);
  const [tripCustomInputs, setTripCustomInputs] = useState<
    Record<string, string>
  >({});

  // Progressive disclosure & Internal Workspace Tabs
  const [isNotesOpen, setIsNotesOpen] = useState<boolean>(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<
    'essential' | 'travel_fx' | 'family_split' | 'notes'
  >('essential');
  const [transferSubMode, setTransferSubMode] = useState<
    'bank_to_bank' | 'investment_contribution' | 'card_bill_payment'
  >('bank_to_bank');
  const [transferForeignAmountStr, setTransferForeignAmountStr] = useState<string>('');
  const [billPaymentCardId, setBillPaymentCardId] = useState<string>('');
  const [billPaymentInvoiceMonth, setBillPaymentInvoiceMonth] = useState(selectedMonth);
  const selectedCreditCard = cards.find((card) => card.id === creditCardId) ?? cards[0] ?? null;
  const selectedBillPaymentCard = cards.find((card) => card.id === billPaymentCardId) ?? cards[0] ?? null;
  const billPaymentInvoiceSummary = selectedBillPaymentCard
    ? calculateCreditCardSummary(selectedBillPaymentCard, transactions, billPaymentInvoiceMonth)
    : null;
  const canSwitchPaymentMethod = Boolean(
    !editingTransaction ||
      (editingTransaction.type === 'expense' &&
        !editingTransaction.isInvoicePayment &&
        !editingTransaction.invoicePaymentId &&
        !editingTransaction.tripId)
  );
  const selectedPaymentAccount = accounts.find((account) => account.id === accountId) ?? null;
  const selectedDestinationAccount = accounts.find((account) => account.id === destinationAccountId) ?? null;
  const destinationAccountOptions = getTransferDestinationAccounts(accounts, accountId);
  const isInvestmentDestination = destinationAccountId.startsWith('inv:');
  const isBankTransfer = entryMode === 'transfer' && transferSubMode === 'bank_to_bank' && !isInvestmentDestination;
  const isInvestmentTransfer = entryMode === 'transfer' && isInvestmentDestination;
  const transferPlan = isBankTransfer
    ? planTransferCurrency(selectedPaymentAccount, selectedDestinationAccount)
    : isInvestmentTransfer
    ? planTransferCurrency(selectedPaymentAccount, null)
    : null;
  // Moeda estrangeira da transferência: da conta internacional envolvida (origem, destino ou aporte a partir dela).
  const transferForeignCurrency =
    transferPlan && transferPlan.kind !== 'brl' && transferPlan.kind !== 'unsupported'
      ? (transferPlan.foreignCurrency ?? getAccountCurrency(selectedPaymentAccount))
      : null;
  const transferForeignAmount = transferForeignCurrency
    ? parseCurrencyInput(transferForeignAmountStr, transferForeignCurrency)
    : 0;
  // Não existe transferir de uma conta para ela mesma: se origem e destino coincidirem, troca o destino.
  useEffect(() => {
    if (entryMode !== 'transfer' || transferSubMode !== 'bank_to_bank') return;
    if (destinationAccountId.startsWith('inv:')) return;
    // Destino igual à origem não existe: limpa e a pessoa escolhe (nada é escolhido por ela)
    if (accountId && destinationAccountId === accountId) {
      setDestinationAccountId('');
    }
  }, [entryMode, transferSubMode, accountId, destinationAccountId, accounts]);

  // Intelligent Category Suggestion based on historical transactions
  const [userManuallySelectedCategory, setUserManuallySelectedCategory] = useState(false);
  const [autoAppliedCategoryNotice, setAutoAppliedCategoryNotice] = useState<string | null>(null);
  // Divisão aprendida com o histórico (ex.: sempre dividir o mercado com a mesma pessoa).
  const [autoSharingApplied, setAutoSharingApplied] = useState<LearnedSharing | null>(null);
  const autoSharingKeyRef = useRef<string | null>(null);
  // Conta, cartão e forma de pagamento aprendidos com o histórico (aplicados uma vez por estabelecimento).
  const [autoHabitNotice, setAutoHabitNotice] = useState<string | null>(null);
  const autoHabitKeyRef = useRef<string | null>(null);
  const sharingTouchedRef = useRef<boolean>(false);

  // Independent scroll container ref
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState(() =>
    computeModalScrollState(0, 500, 500)
  );

  const updateScrollMetrics = useCallback(() => {
    const el = scrollBodyRef.current;
    if (!el) return;
    setScrollState(
      computeModalScrollState(el.scrollTop, el.clientHeight, el.scrollHeight)
    );
  }, []);

  const selectedTrip = useMemo(
    () => trips.find((t) => t.id === tripId) || null,
    [trips, tripId]
  );

  const isPaidByCompanion = useMemo(() => {
    if (!selectedTrip || !tripPayerParticipantId) return false;
    const payer = selectedTrip.participants.find(
      (p) => p.id === tripPayerParticipantId
    );
    return Boolean(payer && !payer.isMe && payer.id !== 'me');
  }, [selectedTrip, tripPayerParticipantId]);

  const prevIsOpenRef = useRef(false);
  const prevEditingIdRef = useRef<string | undefined>(undefined);

  return {
    accountId,
    activeWorkspaceTab,
    amountMode,
    amountStr,
    autoHabitKeyRef,
    autoHabitNotice,
    autoSharingApplied,
    autoSharingKeyRef,
    billPaymentCardId,
    billPaymentInvoiceMonth,
    billPaymentInvoiceSummary,
    canSwitchPaymentMethod,
    cascadeScope,
    categoryId,
    creditCardId,
    currencyRegime,
    date,
    description,
    destinationAccountId,
    destinationAccountOptions,
    entryMode,
    error,
    exchangeRateStr,
    fixedMonthsCount,
    inlineFamilyMemberError,
    installmentTotal,
    invoiceCompetenceMonth,
    iofPercentStr,
    isAddingFamilyMember,
    isInvestmentTransfer,
    isInvoiceMonthOverrideOpen,
    isMultiCurrencyOpen,
    isNotesOpen,
    isPaidByCompanion,
    isCardRefund,
    isShared,
    isTripLinked,
    legacyInstallmentTotalUnknown,
    newMemberEmail,
    newMemberName,
    newMemberRelationship,
    notes,
    originalAmountStr,
    originalCurrency,
    paymentChosen,
    paymentMethod,
    prevEditingIdRef,
    prevIsOpenRef,
    recurrence,
    scrollBodyRef,
    scrollState,
    selectedBillPaymentCard,
    selectedCreditCard,
    selectedDestinationAccount,
    selectedPaymentAccount,
    selectedTrip,
    selectedTripParticipantIds,
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
    setInlineFamilyMemberError,
    setInstallmentTotal,
    setInvoiceCompetenceMonth,
    setIofPercentStr,
    setIsAddingFamilyMember,
    setIsInvoiceMonthOverrideOpen,
    setIsMultiCurrencyOpen,
    setIsNotesOpen,
    setIsCardRefund,
    setIsShared,
    setIsTripLinked,
    setLegacyInstallmentTotalUnknown,
    setNewMemberEmail,
    setNewMemberName,
    setNewMemberRelationship,
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
    sharedCustomAmountStr,
    sharedCustomPercentStr,
    sharedMemberId,
    sharedPaidBy,
    sharedSplitMode,
    sharingTouchedRef,
    status,
    tagInput,
    tags,
    transferForeignAmount,
    transferForeignAmountStr,
    transferForeignCurrency,
    transferPlan,
    transferSubMode,
    tripCustomInputs,
    tripId,
    tripPayerParticipantId,
    tripSplitMethod,
    updateScrollMetrics,
    userManuallySelectedCategory,
  };
}

export type TransactionFormStateApi = ReturnType<typeof useTransactionFormState>;
