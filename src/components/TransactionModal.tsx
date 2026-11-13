import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CreditCard as CreditCardIcon,
  FileText,
  Globe,
  Layers,
  Plane,
  Plus,
  Repeat,
  RotateCcw,
  Sparkles,
  Tag,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  BankAccount,
  Category,
  CreditCard,
  CurrencyCode,
  CurrencyPaymentRegime,
  FamilyMember,
  InvestmentAsset,
  PaymentMethod,
  RecurrenceType,
  Transaction,
  TransactionStatus,
  Trip,
  TripExpenseShare,
  TripSplitMethod,
} from '../types/finance';
import {
  addMonthsToYearMonth,
  calculateCreditCardSummary,
  CascadeScope,
  CreateTransactionBatchInput,
  extractAvailableTransactionTags,
  formatBRL,
  getLocalDateISO,
  formatMonthYearPT,
  normalizeSearchText,
  normalizeTransactionTags,
  parseBRLInput,
  previewCategoryBudget,
  calculateSharedAmount,
  resolveCreditCardInvoiceMonth,
} from '../utils/financeRules';
import {
  calculateConvertedBrlAmount,
  calculateTripExpenseSplit,
  calculateTripWeightedAverageRate,
  CURRENCY_CATALOG,
  CURRENCY_REGIME_DEFAULTS,
  CustomParticipantSplitInput,
  formatExchangeRateBR,
  formatForeignCurrency,
  validateTripExpenseSplitInputs,
} from '../utils/travelRules';
import { computeModalScrollState } from '../utils/modalScrollRules';
import { assessAmount, findProbableDuplicate, learnPaymentHabit } from '../utils/decisionEngine';
import {
  getAccountCurrency,
  getTransferDestinationAccounts,
  pickDefaultTransferDestination,
  planTransferCurrency,
  resolveBankTransfer,
} from '../utils/transferRules';
import { assessAccountBalanceImpact, assessCardLimitImpact, assessDateSanity } from '../utils/spendingGuards';
import {
  describeLearnedSharing,
  getDescriptionLearningKey,
  learnSharingFromHistory,
  type LearnedSharing,
} from '../utils/learningRules';
import {
  getSmartTransactionSuggestions,
  predictCategoryFromDescription,
  SmartCategorySuggestion,
  SmartTransactionSuggestion,
} from '../utils/uxEnhancementRules';
import { CategoryIconBadge } from './CategoryIconBadge';
import { CurrencyInput } from './CurrencyInput';
import { CreditCardFace } from './CreditCardFace';
import { InstitutionMark } from './InstitutionMark';
import {
  isCurrencyInputValid,
  isExchangeRateInputValid,
  parseCurrencyInput,
  parseExchangeRateInput,
} from '../utils/currencyInput';

type DomesticSharedSplitMode = 'half' | 'percentage' | 'custom';

import { getAccountLabel } from '../utils/accountLabels';

function AccountSelectShell({ account, children }: { account: BankAccount | null; children: React.ReactNode }) {
  return (
    <div className="relative">
      {account && (
        <span className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2" aria-hidden="true">
          <InstitutionMark institution={account.institution} accountName={account.name} color={account.color} size="xs" />
        </span>
      )}
      {children}
    </div>
  );
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveBatch: (
    input: CreateTransactionBatchInput,
    editingId?: string,
    cascadeScope?: CascadeScope
  ) => void;
  accounts: BankAccount[];
  cards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  familyMembers: FamilyMember[];
  onAddFamilyMember?: (newMember: Omit<FamilyMember, 'id'>) => FamilyMember | void;
  investments?: InvestmentAsset[];
  trips?: Trip[];
  selectedMonth: string;
  editingTransaction: Transaction | null;
  defaultMode?: 'expense' | 'income' | 'credit_card' | 'transfer';
  initialDate?: string;
  initialTripId?: string;
  /** Leva a pessoa a cadastrar o que falta (conta ou cartão); o App fecha este formulário e abre o cadastro. */
  onRequestCreate?: (kind: 'account' | 'card' | 'international_account') => void;
}

const CURRENCY_OPTIONS: CurrencyCode[] = [
  'BRL',
  'EUR',
  'USD',
  'GBP',
  'CAD',
  'CHF',
  'ARS',
  'CLP',
  'JPY',
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'Pix',
  credit_card: 'Cartão de crédito',
  debit_card: 'Débito',
  boleto: 'Boleto',
  cash: 'Dinheiro',
  transfer: 'Transferência',
};

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSaveBatch,
  accounts,
  cards,
  categories,
  transactions,
  familyMembers,
  onAddFamilyMember,
  investments = [],
  trips = [],
  selectedMonth,
  editingTransaction,
  defaultMode = 'expense',
  initialDate,
  initialTripId,
  onRequestCreate,
}) => {
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
        (editingTransaction.recurrence ?? 'single') === 'single' &&
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
    if (accountId && (!destinationAccountId || destinationAccountId === accountId)) {
      setDestinationAccountId(pickDefaultTransferDestination(accounts, accountId));
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
      setFixedMonthsCount(editingTransaction.installmentTotal || 12);
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
      const firstCard = cards[0];
      setCreditCardId(firstCard?.id || '');
      const initialPurchaseDate = initialDate || getLocalDateISO();
      setInvoiceCompetenceMonth(
        resolveCreditCardInvoiceMonth(initialPurchaseDate, firstCard)
      );
      const firstExp = categories.find((c) => c.type === 'expense');
      if (!initialTripId) {
        setCategoryId(firstExp?.id || '');
      }
    } else if (defaultMode === 'income') {
      setStatus('paid');
      setPaymentMethod('pix');
      setAccountId(accounts[0]?.id || '');
      const firstInc = categories.find((c) => c.type === 'income');
      setCategoryId(firstInc?.id || '');
    } else if (defaultMode === 'transfer') {
      setStatus('paid');
      setPaymentMethod('transfer');
      setAccountId(accounts[0]?.id || '');
      setDestinationAccountId(pickDefaultTransferDestination(accounts, accounts[0]?.id || ''));
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
        setAccountId(domesticAcc?.id || '');
      }
      const firstExp = categories.find((c) => c.type === 'expense');
      if (!initialTripId) {
        setCategoryId(firstExp?.id || '');
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

  // Automatically recalculate the invoice due month when the purchase date or card changes.
  useEffect(() => {
    if (!isOpen || entryMode !== 'credit_card') return;
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
      if (!creditCardId && cards[0]?.id) {
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
    mode: 'expense' | 'income' | 'credit_card' | 'transfer'
  ) => {
    setEntryMode(mode);
    setError('');
    if (mode === 'income') {
      const incCat = categories.find((c) => c.type === 'income');
      if (incCat) {
        setCategoryId(incCat.id);
      }
      setPaymentMethod('pix');
      setStatus('paid');
      if (recurrence === 'installment') {
        setRecurrence('single');
      }
      setIsShared(false);
    } else if (mode === 'credit_card') {
      const expCat = categories.find((c) => c.type === 'expense');
      if (expCat && !tripId && !editingTransaction) {
        setCategoryId(expCat.id);
      }
      setPaymentMethod('credit_card');
      setStatus('pending');
      if (!creditCardId && cards[0]?.id) {
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
      const expCat = categories.find((c) => c.type === 'expense');
      if (expCat && !tripId && !editingTransaction) {
        setCategoryId(expCat.id);
      }
      const originalBankMethod =
        editingTransaction && editingTransaction.paymentMethod && editingTransaction.paymentMethod !== 'credit_card'
          ? editingTransaction.paymentMethod
          : 'pix';
      setPaymentMethod(originalBankMethod);
      if (!accountId && accounts[0]?.id) setAccountId(accounts[0].id);
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

  const filteredCategories = useMemo(
    () =>
      categories.filter((c) =>
        entryMode === 'income' ? c.type === 'income' : c.type === 'expense'
      ),
    [categories, entryMode]
  );

  const selectedCategoryObj =
    filteredCategories.find((c) => c.id === categoryId) || filteredCategories[0];

  const numericPreview = parseBRLInput(amountStr);

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
      customList
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
      description,
      transactions,
      entryMode,
      5
    );
  }, [description, transactions, entryMode, editingTransaction]);

  // Intelligent Category Suggestion based on Description and Past User Transactions
  const smartCategorySuggestion = useMemo(() => {
    if (editingTransaction || entryMode === 'transfer' || !description.trim()) {
      return null;
    }
    return predictCategoryFromDescription(
      description,
      transactions,
      categories,
      entryMode
    );
  }, [description, transactions, categories, entryMode, editingTransaction]);

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
    if (editingTransaction || entryMode === 'transfer' || entryMode === 'income' || !description.trim()) {
      return null;
    }
    return learnSharingFromHistory(description, transactions, familyMembers);
  }, [description, transactions, familyMembers, entryMode, editingTransaction]);

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
    const key = getDescriptionLearningKey(description);
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
    isShared,
    isTripLinked,
    isMultiCurrencyOpen,
  ]);

  // Hábito de pagamento: mesma conta/cartão/forma de pagamento das últimas vezes neste lugar.
  const paymentHabit = useMemo(() => {
    if (
      editingTransaction ||
      !description.trim() ||
      (entryMode !== 'expense' && entryMode !== 'credit_card')
    ) {
      return null;
    }
    return learnPaymentHabit(description, transactions, entryMode);
  }, [description, transactions, entryMode, editingTransaction]);

  useEffect(() => {
    if (!isOpen || editingTransaction || !paymentHabit || isTripLinked || isMultiCurrencyOpen) return;
    const key = `${entryMode}:${getDescriptionLearningKey(description)}`;
    if (autoHabitKeyRef.current === key) return;

    const applied: string[] = [];
    // Só troca o que ainda está no padrão do formulário; escolha feita pela pessoa nunca é sobrescrita.
    if (entryMode === 'credit_card') {
      const card = paymentHabit.creditCardId?.value;
      if (card && card !== creditCardId && cards.some((item) => item.id === card) && creditCardId === (cards[0]?.id ?? '')) {
        setCreditCardId(card);
        applied.push(cards.find((item) => item.id === card)?.name ?? 'cartão');
      }
    } else {
      const account = paymentHabit.accountId?.value;
      if (account && account !== accountId && accounts.some((item) => item.id === account) && accountId === (accounts[0]?.id ?? '')) {
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
    if (editingTransaction || entryMode === 'income' || entryMode === 'transfer') return null;
    return assessAmount(description, numericPreview, transactions);
  }, [description, numericPreview, transactions, entryMode, editingTransaction]);

  const duplicateWarning = useMemo(() => {
    if (transferSubMode === 'card_bill_payment' && entryMode === 'transfer') return null;
    return findProbableDuplicate(
      {
        description,
        amount: numericPreview,
        date,
        type: entryMode === 'income' ? 'income' : entryMode === 'transfer' ? 'transfer' : 'expense',
        accountId: entryMode === 'transfer' ? accountId : undefined,
        destinationKey: entryMode === 'transfer' ? destinationAccountId : undefined,
      },
      transactions,
      editingTransaction?.id
    );
  }, [description, numericPreview, date, transactions, entryMode, transferSubMode, accountId, destinationAccountId, editingTransaction]);

  // Avisos (não bloqueiam): saldo da conta que ficaria negativo e compra acima do limite do cartão.
  const spendingWarning = useMemo(() => {
    if (!(numericPreview > 0) || (selectedTrip && isPaidByCompanion)) return null;
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
  ]);

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
    if (entryMode === 'income' || entryMode === 'transfer' || !categoryId || numericPreview <= 0 || (selectedTrip && isPaidByCompanion)) {
      return null;
    }
    const domesticSharing = isShared && !((isTripLinked || isMultiCurrencyOpen) && (originalCurrency !== 'BRL' || Boolean(tripId)));
    return previewCategoryBudget(categories, transactions, {
      description, amount: numericPreview, date,
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
    }, editingTransaction?.id, cascadeScope);
  }, [
    entryMode,
    categoryId,
    categories,
    transactions, date, invoiceCompetenceMonth, creditCardId, status, paymentMethod,
    description, cascadeScope, legacyInstallmentTotalUnknown, selectedTrip, isPaidByCompanion,
    isShared, sharedMemberId, sharedPaidBy, sharedSplitMode, sharedCustomPercentStr, sharedCustomAmountStr,
    isTripLinked, isMultiCurrencyOpen, originalCurrency, tripId,
    numericPreview,
    recurrence,
    amountMode,
    installmentTotal,
    editingTransaction,
    selectedMonth,
  ]);

  const availableTagSuggestions = useMemo(() => {
    const allSuggested = extractAvailableTransactionTags(transactions, true);
    const activeKeys = new Set(tags.map((t) => normalizeSearchText(t)));
    return allSuggested
      .filter((t) => !activeKeys.has(normalizeSearchText(t)))
      .slice(0, 8);
  }, [transactions, tags]);

  if (!isOpen) return null;

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
        !activeMultiCurrency && entryMode !== 'income' && entryMode !== 'transfer'
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 p-0 sm:p-4 overflow-hidden modal-shell"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-transaction-title"
    >
      <div
        data-testid="transaction-modal-shell"
        data-action-always-reachable="true"
        className="w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-sheet-up sm:animate-modal-in modal-shell"
      >
        {/* Mobile Bottom-Sheet Pull Indicator */}
        <div className="mx-auto mt-2 -mb-1 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />

        {/* Zone 1: Fixed Institutional Header + Smart 4-Mode Selector */}
        <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 px-5 sm:px-6 pt-3.5 pb-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="modal-transaction-title"
                  className="text-base font-bold text-slate-900 dark:text-white font-display tracking-tight"
                >
                  {editingTransaction
                    ? 'Editar Lançamento Financeiro'
                    : 'Central de Lançamento Unificado'}
                </h2>
                {tripId && selectedTrip && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 dark:bg-sky-950/70 border border-sky-300 dark:border-sky-800 px-2 py-0.5 text-[11px] font-bold text-sky-900 dark:text-sky-300">
                    <Plane className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                    {selectedTrip.name} ({selectedTrip.currency})
                  </span>
                )}
                {isShared && entryMode !== 'income' && entryMode !== 'transfer' && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-800 px-2 py-0.5 text-[11px] font-bold text-indigo-900 dark:text-indigo-300">
                    <Users className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                    Rateio Familiar
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-words sm:truncate">
                {entryMode === 'credit_card'
                  ? 'Compra no Cartão de Crédito — À Vista (1x), Assinatura Fixa ou Parcelado (2x a 24x)'
                  : entryMode === 'income'
                  ? 'Receita em Conta — Salário, PIX recebido, Dividendos ou Reembolso'
                  : entryMode === 'transfer'
                  ? 'Movimentação Patrimonial — Transferência entre Contas, Aporte ou Quitação de Fatura'
                  : 'Despesa de Conta — PIX, Débito, Boleto Bancário ou Gasto Internacional'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar janela"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Expense, income and movement tabs; card is a payment method within expenses. */}
          {!editingTransaction && (
            <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-200/70 dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700/80">
              <button
                type="button"
                data-testid="mode-expense-btn"
                onClick={() => handleModeSwitch('expense')}
                className={`py-2 px-1.5 min-[400px]:px-2.5 text-[11px] min-[400px]:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  entryMode === 'expense' || entryMode === 'credit_card'
                    ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 shadow-xs border border-rose-200/80 dark:border-rose-900/60'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Wallet className="hidden min-[400px]:block h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Despesa</span>
              </button>
              <button
                type="button"
                data-testid="mode-income-btn"
                onClick={() => handleModeSwitch('income')}
                className={`py-2 px-1.5 min-[400px]:px-2.5 text-[11px] min-[400px]:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  entryMode === 'income'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs border border-emerald-200/80 dark:border-emerald-900/60'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CheckCircle2 className="hidden min-[400px]:block h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Receita</span>
              </button>
              <button
                type="button"
                data-testid="mode-transfer-btn"
                onClick={() => handleModeSwitch('transfer')}
                className={`py-2 px-1.5 min-[400px]:px-2.5 text-[11px] min-[400px]:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  entryMode === 'transfer'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-300 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Repeat className="hidden min-[400px]:block h-3.5 w-3.5 shrink-0" />
                <span className="truncate" aria-label="Movimentações"><span className="min-[400px]:hidden" aria-hidden="true">Transf.</span><span className="hidden min-[400px]:inline">Movimentações</span></span>
              </button>
            </div>
          )}
        </div>

        {/* Form Wrapper */}
        <form
          id="transaction-modal-form"
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white dark:bg-slate-900"
        >
          {/* Zone 2: Independent Scrollable Form Body */}
          <div
            ref={scrollBodyRef}
            onScroll={updateScrollMetrics}
            data-testid="transaction-modal-scroll-body"
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar native-scroll modal-form-scroll bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
          >
            {(entryMode === 'expense' || entryMode === 'credit_card') && canSwitchPaymentMethod && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3">
                <span className="mr-1 text-xs font-bold text-slate-700 dark:text-slate-300">Forma de pagamento</span>
                <button
                  type="button"
                  data-testid="payment-method-account"
                  aria-pressed={entryMode === 'expense'}
                  onClick={() => handleModeSwitch('expense')}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${entryMode === 'expense' ? 'border-rose-300 bg-white text-rose-700 shadow-xs' : 'border-slate-300 bg-white/60 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}
                >
                  Conta / débito
                </button>
                <button
                  type="button"
                  data-testid="payment-method-card"
                  aria-pressed={entryMode === 'credit_card'}
                  onClick={() => handleModeSwitch('credit_card')}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${entryMode === 'credit_card' ? 'border-violet-300 bg-white text-violet-700 shadow-xs' : 'border-slate-300 bg-white/60 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}
                >
                  <CreditCardIcon className="h-3.5 w-3.5" />
                  Cartão de crédito
                </button>
              </div>
            )}

            {/* Editing Mode Banner: Quick 1-Click Status Revert + Cascade Scope */}
            {editingTransaction && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/50 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                      Situação no Caixa (Reversão Rápida)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Alterne entre Efetivado e Pendente com 1 clique:
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStatus('paid')}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold border transition-all ${
                        status === 'paid'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {entryMode === 'income'
                        ? 'Recebido (Efetivado)'
                        : 'Pago (Efetivado)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('pending')}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold border transition-all ${
                        status === 'pending'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {entryMode === 'income'
                        ? 'Voltar p/ A Receber'
                        : 'Voltar p/ Pendente'}
                    </button>
                  </div>
                </div>

                {editingTransaction.installmentGroupId && (
                  <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-700 space-y-2">
                    <label className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      Escopo da Alteração na Série ({editingTransaction.installmentNumber}/
                      {editingTransaction.installmentTotal} meses):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCascadeScope('single')}
                        className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold transition-all ${
                          cascadeScope === 'single'
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 font-bold'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Apenas este mês ({editingTransaction.competenceMonth})
                      </button>
                      <button
                        type="button"
                        disabled={legacyInstallmentTotalUnknown}
                        onClick={() => setCascadeScope('this_and_future')}
                        className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                          cascadeScope === 'this_and_future'
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 font-bold'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Cascata: Este + próximos meses
                      </button>
                      <button
                        type="button"
                        disabled={legacyInstallmentTotalUnknown}
                        onClick={() => setCascadeScope('all_series')}
                        className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                          cascadeScope === 'all_series'
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 font-bold'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Toda a série (passados e futuros)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-2.5 text-xs font-medium text-rose-800 dark:text-rose-200 animate-expand-in"
              >
                {error}
              </div>
            )}

            {/* Unified Hero Strip: Amount + Quick Calculator + Description + Smart Autocomplete */}
            <div
              data-testid="hero-calculator-value-box"
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 sm:p-4 space-y-3"
            >
              {legacyInstallmentTotalUnknown && (
                <p
                  data-testid="legacy-installment-total-warning"
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  O total original não está salvo e a série está incompleta. Este campo mostra apenas esta parcela; para evitar alterar pagamentos ou outras parcelas com um total estimado, a edição está limitada a este mês. Revise o histórico antes de ajustar o total da compra.
                </p>
              )}
              {isMultiCurrencyOpen && originalCurrency !== 'BRL' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-4">
                      <label
                        htmlFor="tx-foreign-amount"
                        className="block text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300 mb-1"
                      >
                        1. Valor na Moeda {isTripLinked ? 'da Viagem' : 'da Conta'} ({originalCurrency})
                      </label>
                      <div className="relative flex items-stretch">
                        <span className="inline-flex items-center justify-center rounded-l-xl border border-r-0 border-sky-400 dark:border-sky-700 bg-sky-100 dark:bg-sky-950 px-2.5 py-2 text-sm font-extrabold font-mono text-sky-900 dark:text-sky-200 select-none">
                          {CURRENCY_CATALOG[originalCurrency]?.flag}{' '}
                          {CURRENCY_CATALOG[originalCurrency]?.symbol}
                        </span>
                        <CurrencyInput
                          id="tx-foreign-amount"
                          data-testid="tx-foreign-amount-input"
                          currency={originalCurrency}
                          onValueChange={setOriginalAmountStr}
                          value={originalAmountStr}
                          placeholder="0,00"
                          className="w-full rounded-r-xl border border-sky-400 dark:border-sky-700 bg-white dark:bg-slate-900 px-3 py-2 text-lg sm:text-xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white focus:border-sky-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-4">
                      <label
                        htmlFor="tx-amount"
                        className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                      >
                        2. Equivalente R$ (Câmbio Médio)
                      </label>
                      <div className="relative flex items-stretch">
                        <span className="inline-flex items-center justify-center rounded-l-xl border border-r-0 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-2 text-sm font-extrabold font-mono text-slate-700 dark:text-slate-200 select-none">
                          🇧🇷 R$
                        </span>
                        <CurrencyInput
                          id="tx-amount"
                          data-testid="tx-amount-input"
                          currency="BRL"
                          onValueChange={setAmountStr}
                          readOnly={Boolean(isTripLinked && selectedTrip)}
                          value={amountStr}
                          placeholder="0,00"
                          className="w-full rounded-r-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-lg sm:text-xl font-extrabold font-mono tabular-nums text-slate-700 dark:text-slate-200 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-4">
                      <label
                        htmlFor="tx-date-input"
                        className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                      >
                        Data do Gasto
                      </label>
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-500 dark:text-sky-400" />
                        <input
                          id="tx-date-input"
                          data-testid="tx-date-input"
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-2.5 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:border-sky-600 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="tx-description"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                    >
                      Descrição do Gasto Internacional
                    </label>
                    <input
                      id="tx-description"
                      data-testid="tx-description-input"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={
                        selectedTrip
                          ? `Ex: Jantar em ${selectedTrip.destination.split(',')[0]}, Trem, Hotel, Museu...`
                          : 'Ex: Compra Amazon US, Hotel Booking, Software Internacional'
                      }
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
                    />

                    {/* Intelligent Category Suggestion Card in Multi-Currency */}
                    {!editingTransaction && entryMode !== 'transfer' && smartCategorySuggestion && (
                      <div
                        data-testid="smart-category-suggestion-card"
                        className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/90 dark:bg-emerald-950/40 p-2.5 sm:px-3 text-xs transition-all shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/80 p-1.5 text-emerald-700 dark:text-emerald-300 shrink-0">
                            <Sparkles className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-bold text-emerald-950 dark:text-emerald-100">
                                Sugestão Inteligente:
                              </span>
                              <span className="inline-flex items-center gap-1 font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 shrink-0">
                                <CategoryIconBadge
                                  icon={smartCategorySuggestion.categoryIcon}
                                  color={smartCategorySuggestion.categoryColor}
                                  size="sm"
                                />
                                {smartCategorySuggestion.categoryName}
                              </span>
                              <span className="rounded-full bg-emerald-200/80 dark:bg-emerald-800/60 px-2 py-0.5 text-[10px] font-extrabold text-emerald-900 dark:text-emerald-200">
                                {Math.round(smartCategorySuggestion.confidence * 100)}% provável
                              </span>
                            </div>
                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300/90 mt-0.5 truncate">
                              {smartCategorySuggestion.reason}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          {categoryId === smartCategorySuggestion.categoryId ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-white/90 dark:bg-slate-900/90 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-700 shadow-2xs">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              Categoria Selecionada
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApplySmartCategory(smartCategorySuggestion)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-2.5 py-1 shadow-2xs transition-colors"
                            >
                              <Sparkles className="h-3 w-3" />
                              Aplicar Categoria
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Row 1: Columns for related quantitative & temporal fields (Valor, Data, Situação) */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    {/* Column 1: Valor */}
                    <div
                      className={
                        entryMode === 'credit_card'
                          ? 'sm:col-span-7'
                          : 'sm:col-span-5'
                      }
                    >
                      <label
                        htmlFor="tx-amount"
                        className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                      >
                        {entryMode === 'credit_card' &&
                        recurrence === 'installment' &&
                        amountMode === 'total_divided'
                          ? 'Valor Total da Compra (R$)'
                          : entryMode === 'credit_card' &&
                            recurrence === 'installment'
                          ? 'Valor de Cada Parcela (R$)'
                          : recurrence === 'fixed'
                          ? entryMode === 'income'
                            ? 'Receita Fixa Mensal (R$)'
                            : entryMode === 'credit_card'
                            ? 'Assinatura / Valor Fixo (R$)'
                            : 'Despesa Fixa Mensal (R$)'
                          : entryMode === 'income'
                          ? 'Valor da Receita (R$)'
                          : entryMode === 'transfer'
                          ? 'Valor da Transferência (R$)'
                          : 'Valor do Lançamento (R$)'}
                      </label>
                      <div className="relative flex items-stretch">
                        <span
                          className={`inline-flex items-center justify-center rounded-l-xl border border-r-0 border-slate-300 dark:border-slate-700 px-3 py-2 text-base sm:text-lg font-extrabold font-mono select-none ${
                            entryMode === 'income'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : entryMode === 'credit_card'
                              ? 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300'
                              : entryMode === 'transfer'
                              ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          R$
                        </span>
                        <CurrencyInput
                          id="tx-amount"
                          data-testid="tx-amount-input"
                          currency="BRL"
                          onValueChange={setAmountStr}
                          value={amountStr}
                          placeholder="0,00"
                          className="w-full rounded-r-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xl sm:text-2xl font-extrabold font-mono tabular-nums tracking-tight text-slate-900 dark:text-white placeholder:text-slate-300 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Column 2: Data */}
                    <div
                      className={
                        entryMode === 'credit_card'
                          ? 'sm:col-span-5'
                          : 'sm:col-span-4'
                      }
                    >
                      <label
                        htmlFor="tx-date-input"
                        className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                      >
                        {entryMode === 'credit_card'
                          ? 'Data da Compra'
                          : entryMode === 'transfer'
                          ? 'Data da Movimentação'
                          : 'Data do Lançamento'}
                      </label>
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          id="tx-date-input"
                          data-testid="tx-date-input"
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-2.5 py-2 text-sm sm:text-base font-mono font-bold text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    {/* Column 3: Situação no Caixa (para despesa, receita e transferência) */}
                    {entryMode !== 'credit_card' && (
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                          Situação no Caixa
                        </label>
                        <div className="grid grid-cols-2 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 p-1 border border-slate-300/60 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => setStatus('paid')}
                            className={`rounded-lg py-1.5 px-1.5 text-xs font-bold transition-all ${
                              status === 'paid'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {entryMode === 'income'
                              ? 'Recebido'
                              : entryMode === 'transfer'
                              ? 'Efetivado'
                              : 'Pago'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus('pending')}
                            className={`rounded-lg py-1.5 px-1.5 text-xs font-bold transition-all ${
                              status === 'pending'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {entryMode === 'income'
                              ? 'A Receber'
                              : entryMode === 'transfer'
                              ? 'Agendado'
                              : 'Pendente'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Full-width Descrição / Identificação */}
                  <div>
                    <label
                      htmlFor="tx-description"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                    >
                      Descrição / Identificação
                    </label>
                    <input
                      id="tx-description"
                      data-testid="tx-description-input"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={
                        isMultiCurrencyOpen && selectedTrip
                          ? `Ex: Jantar em ${selectedTrip.destination.split(',')[0]}, Trem, Hotel...`
                          : entryMode === 'income'
                          ? 'Ex: Salário CLT, Aluguel Recebido, Dividendos'
                          : entryMode === 'credit_card'
                          ? 'Ex: Supermercado, Passagem Aérea, Assinatura'
                          : entryMode === 'transfer'
                          ? 'Ex: Transferência Reserva, Aporte FIIs, Pagamento Fatura'
                          : 'Ex: Condomínio, Conta de Luz, Internet Fibra'
                      }
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
                    />

                    {/* Intelligent Category Suggestion Card */}
                    {!editingTransaction && entryMode !== 'transfer' && smartCategorySuggestion && (
                      <div
                        data-testid="smart-category-suggestion-card"
                        className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/90 dark:bg-emerald-950/40 p-2.5 sm:px-3 text-xs transition-all shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/80 p-1.5 text-emerald-700 dark:text-emerald-300 shrink-0">
                            <Sparkles className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-bold text-emerald-950 dark:text-emerald-100">
                                Sugestão Inteligente:
                              </span>
                              <span className="inline-flex items-center gap-1 font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 shrink-0">
                                <CategoryIconBadge
                                  icon={smartCategorySuggestion.categoryIcon}
                                  color={smartCategorySuggestion.categoryColor}
                                  size="sm"
                                />
                                {smartCategorySuggestion.categoryName}
                              </span>
                              <span className="rounded-full bg-emerald-200/80 dark:bg-emerald-800/60 px-2 py-0.5 text-[10px] font-extrabold text-emerald-900 dark:text-emerald-200">
                                {Math.round(smartCategorySuggestion.confidence * 100)}% provável
                              </span>
                            </div>
                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300/90 mt-0.5 truncate">
                              {smartCategorySuggestion.reason}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          {categoryId === smartCategorySuggestion.categoryId ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-white/90 dark:bg-slate-900/90 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-700 shadow-2xs">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              Categoria Selecionada
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApplySmartCategory(smartCategorySuggestion)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-2.5 py-1 shadow-2xs transition-colors"
                            >
                              <Sparkles className="h-3 w-3" />
                              Aplicar Categoria
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Increment Calculator + Smart Autocomplete Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] font-semibold text-slate-400 mr-1">
                    Valor rápido:
                  </span>
                  {[10, 50, 100, 500].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuickAddAmount(val)}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:border-emerald-300 hover:text-emerald-800 transition-colors"
                    >
                      +{val}
                    </button>
                  ))}
                  {(numericPreview > 0 || parsedForeignAmount > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setAmountStr('');
                        setOriginalAmountStr('');
                      }}
                      className="rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {!editingTransaction && smartSuggestions.length > 0 && (
                  <div
                    data-testid="smart-autocomplete-bar"
                    className="flex flex-wrap items-center gap-1"
                  >
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 mr-0.5">
                      <Sparkles className="h-3 w-3 text-emerald-600 shrink-0" />
                      Recentes:
                    </span>
                    {smartSuggestions.slice(0, 3).map((sug) => (
                      <button
                        key={sug.cleanDescription}
                        type="button"
                        onClick={() => handleApplySmartSuggestion(sug)}
                        title={`Auto-preencher categoria, conta e último valor (${formatBRL(
                          sug.lastAmount
                        )})`}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-emerald-300 hover:bg-emerald-50/70 transition-colors"
                      >
                        <span className="truncate max-w-[115px] font-semibold">
                          {sug.cleanDescription}
                        </span>
                        <span className="font-mono tabular-nums text-[10px] text-slate-400">
                          {formatBRL(sug.lastAmount)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {!editingTransaction &&
                  autoSharingApplied &&
                  isShared &&
                  sharedMemberId === autoSharingApplied.memberId &&
                  sharedPaidBy === autoSharingApplied.paidBy &&
                  sharedSplitMode === autoSharingApplied.splitMode && (
                    <div
                      role="status"
                      data-testid="auto-sharing-notice"
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30 px-2.5 py-1.5 text-[11px] text-indigo-900 dark:text-indigo-200"
                    >
                      <span className="inline-flex items-start gap-1.5 min-w-0">
                        <Sparkles className="h-3 w-3 mt-0.5 text-indigo-600 shrink-0" />
                        <span>{describeLearnedSharing(autoSharingApplied)}</span>
                      </span>
                      <button
                        type="button"
                        data-testid="auto-sharing-undo"
                        onClick={handleUndoAutoSharing}
                        className="shrink-0 font-bold underline underline-offset-2 hover:text-indigo-700"
                      >
                        Desfazer
                      </button>
                    </div>
                  )}

                {!editingTransaction && autoHabitNotice && (
                  <p
                    role="status"
                    data-testid="auto-habit-notice"
                    className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
                  >
                    <Sparkles className="h-3 w-3 text-emerald-600 shrink-0" />
                    {autoHabitNotice}
                  </p>
                )}

                {duplicateWarning && (
                  <p
                    role="alert"
                    data-testid="duplicate-warning"
                    className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200"
                  >
                    {duplicateWarning.message}
                  </p>
                )}

                {dateWarning && (
                  <p
                    role="status"
                    data-testid="date-warning"
                    className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200"
                  >
                    {dateWarning}
                  </p>
                )}

                {spendingWarning && (
                  <p
                    role="alert"
                    data-testid="spending-warning"
                    className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200"
                  >
                    {spendingWarning.message} Você ainda pode salvar.
                  </p>
                )}

                {amountWarning && (
                  <p
                    role="status"
                    data-testid="amount-warning"
                    className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200"
                  >
                    {amountWarning.message}
                  </p>
                )}
              </div>
            </div>

            {missingSetup && (
              <div
                role="alert"
                data-testid={missingSetup.testId}
                className="flex flex-col gap-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">{missingSetup.message}</p>
                {onRequestCreate && (
                  <button
                    type="button"
                    data-testid="missing-setup-action"
                    onClick={() => onRequestCreate(missingSetup.kind)}
                    className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    {missingSetup.action}
                  </button>
                )}
              </div>
            )}

            {/* Core Unified Configuration Grid: Category, Account/Card, Transfer/Invoice Sub-Selector, Date & Recurrence */}
            {entryMode === 'transfer' ? (
              <div className="space-y-4">
                {/* Smart Sub-Selector for Transfers, Investments & Credit Card Bill Payment */}
                {!editingTransaction && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Finalidade da Movimentação
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleTransferSubModeChange('bank_to_bank')
                        }
                        className={`rounded-xl border px-3 py-2 text-left text-xs ${
                          transferSubMode === 'bank_to_bank'
                            ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-2xs'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 font-semibold'
                        }`}
                      >
                        <div>Entre Contas Bancárias</div>
                        <div
                          className={`text-[10px] ${
                            transferSubMode === 'bank_to_bank'
                              ? 'text-slate-300 dark:text-slate-600'
                              : 'text-slate-400'
                          }`}
                        >
                          Conta corrente ⇄ Reserva
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleTransferSubModeChange('card_bill_payment')
                        }
                        className={`rounded-xl border px-3 py-2 text-left text-xs ${
                          transferSubMode === 'card_bill_payment'
                            ? 'border-violet-600 bg-violet-600 text-white font-bold shadow-2xs'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 font-semibold'
                        }`}
                      >
                        <div>Pagamento de Fatura</div>
                        <div
                          className={`text-[10px] ${
                            transferSubMode === 'card_bill_payment'
                              ? 'text-violet-100'
                              : 'text-slate-400'
                          }`}
                        >
                          Quitar cartão pelo banco
                        </div>
                      </button>

                      {investments.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            handleTransferSubModeChange(
                              'investment_contribution'
                            )
                          }
                          className={`rounded-xl border px-3 py-2 text-left text-xs ${
                            transferSubMode === 'investment_contribution'
                              ? 'border-emerald-600 bg-emerald-600 text-white font-bold shadow-2xs'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 font-semibold'
                          }`}
                        >
                          <div>Aporte em Investimento</div>
                          <div
                            className={`text-[10px] ${
                              transferSubMode === 'investment_contribution'
                                ? 'text-emerald-100'
                                : 'text-slate-400'
                            }`}
                          >
                            Direto na carteira de ativos
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="tx-transfer-origin-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Sai da Conta Bancária (Origem)
                    </label>
                    <AccountSelectShell account={selectedPaymentAccount}>
<select
                      id="tx-transfer-origin-select"
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3 py-2 text-sm text-slate-900 dark:text-white"
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
</AccountSelectShell>
                  </div>

                  {transferSubMode === 'card_bill_payment' ? (
                    <div>
                      <label htmlFor="tx-bill-card-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Cartão de Crédito (Fatura a Quitar)
                      </label>
                      <select
                        id="tx-bill-card-select"
                        value={billPaymentCardId}
                        onChange={(e) => {
                          const cid = e.target.value;
                          setBillPaymentCardId(cid);
                          const cObj = cards.find((c) => c.id === cid);
                          if (cObj) {
                            setDescription(`Pagamento Fatura ${cObj.name}`);
                            const pending = calculateCreditCardSummary(
                              cObj,
                              transactions,
                              billPaymentInvoiceMonth
                            ).invoicePendingAmount;
                            setAmountStr(pending > 0 ? pending.toFixed(2).replace('.', ',') : '');
                          }
                        }}
                        className="w-full rounded-lg border border-violet-300 dark:border-violet-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white"
                      >
                        {cards.map((card) => (
                          <option key={card.id} value={card.id}>
                            💳 {card.name} (Venc. dia {card.dueDay})
                          </option>
                        ))}
                      </select>
                      {selectedBillPaymentCard && (
                        <div className="mt-2 flex items-center gap-3">
                          <CreditCardFace card={selectedBillPaymentCard} size="compact" />
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Cartão selecionado para quitar a fatura
                          </span>
                        </div>
                      )}
                      <div className="mt-3">
                        <label htmlFor="tx-bill-invoice-month" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Fatura que será quitada
                        </label>
                        <select
                          id="tx-bill-invoice-month"
                          data-testid="bill-invoice-month-select"
                          value={billPaymentInvoiceMonth}
                          onChange={(e) => {
                            const month = e.target.value;
                            setBillPaymentInvoiceMonth(month);
                            if (selectedBillPaymentCard) {
                              const pending = calculateCreditCardSummary(
                                selectedBillPaymentCard,
                                transactions,
                                month
                              ).invoicePendingAmount;
                              setAmountStr(pending > 0 ? pending.toFixed(2).replace('.', ',') : '');
                            }
                          }}
                          className="w-full rounded-lg border border-violet-300 dark:border-violet-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white"
                        >
                          {Array.from({ length: 7 }, (_, index) =>
                            addMonthsToYearMonth(selectedMonth, index - 3)
                          ).map((month) => (
                            <option key={month} value={month}>{formatMonthYearPT(month)}</option>
                          ))}
                        </select>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          Em aberto nesta fatura: <strong>{formatBRL(billPaymentInvoiceSummary?.invoicePendingAmount || 0)}</strong>. O valor é preenchido automaticamente; você pode informar um pagamento parcial.
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          O pagamento debita a conta selecionada e quita o cartão. As compras já contam como despesas por categoria, então esta liquidação não duplica os gastos.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="tx-transfer-destination-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Destino (Conta ou Aporte em Ativo)
                      </label>
                      <select
                        id="tx-transfer-destination-select"
                        value={destinationAccountId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDestinationAccountId(val);
                          if (val.startsWith('inv:')) {
                            setTransferSubMode('investment_contribution');
                            const assetId = val.slice(4);
                            const asset = investments.find(
                              (a) => a.id === assetId
                            );
                            if (
                              asset &&
                              (!description.trim() ||
                                description.startsWith('Aporte em '))
                            ) {
                              setDescription(`Aporte em ${asset.ticker}`);
                            }
                          } else {
                            setTransferSubMode('bank_to_bank');
                          }
                        }}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                      >
                        <optgroup label="Contas Bancárias & Carteiras">
                          {destinationAccountOptions.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {getAccountLabel(acc, accounts)}
                            </option>
                          ))}
                        </optgroup>
                        {investments.length > 0 && (
                          <optgroup label="Aporte Direto na Carteira de Investimentos">
                            {investments.map((asset) => (
                              <option key={asset.id} value={`inv:${asset.id}`}>
                                Aporte: {asset.ticker} ({asset.name})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {selectedDestinationAccount && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <InstitutionMark
                            institution={selectedDestinationAccount.institution}
                            accountName={selectedDestinationAccount.name}
                            color={selectedDestinationAccount.color}
                            size="xs"
                          />
                          <span>Destino: {selectedDestinationAccount.name}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {transferPlan?.kind === 'unsupported' && (
                  <p role="alert" data-testid="transfer-unsupported-currency" className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-800 dark:text-rose-200">
                    {transferPlan.message}
                  </p>
                )}

                {transferSubMode === 'card_bill_payment' && getAccountCurrency(selectedPaymentAccount) !== 'BRL' && (
                  <p role="alert" data-testid="bill-foreign-account-warning" className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-800 dark:text-rose-200">
                    A fatura do cartão é em reais. Pague a fatura por uma conta em reais; para usar dinheiro de uma conta em {getAccountCurrency(selectedPaymentAccount)}, primeiro transfira para uma conta em reais informando o câmbio.
                  </p>
                )}

                {transferForeignCurrency && (
                  <div data-testid="transfer-fx-block" className="rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/30 p-3 space-y-2">
                    <p className="text-xs font-semibold text-sky-900 dark:text-sky-200">
                      {isInvestmentTransfer
                        ? `Aporte saindo de conta em ${transferForeignCurrency}: informe quanto saiu em ${transferForeignCurrency}. O valor em R$ acima é o equivalente em reais.`
                        : transferPlan?.sourceIsForeign && transferPlan.destinationIsForeign
                        ? `As duas contas são em ${transferForeignCurrency}: informe o valor em ${transferForeignCurrency}. O valor em R$ acima é só o equivalente em reais do dia.`
                        : transferPlan?.sourceIsForeign
                        ? `O dinheiro sai em ${transferForeignCurrency} e entra em reais: informe quanto saiu em ${transferForeignCurrency}. O valor em R$ acima é o que entrou na conta de destino.`
                        : `O dinheiro sai em reais e entra em ${transferForeignCurrency}: informe quanto entrou em ${transferForeignCurrency}. O valor em R$ acima é o que saiu da conta de origem.`}
                    </p>
                    <div>
                      <label htmlFor="tx-transfer-foreign-amount" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Valor em {transferForeignCurrency}
                      </label>
                      <div className="relative flex items-stretch">
                        <span className="inline-flex items-center justify-center rounded-l-xl border border-r-0 border-sky-400 dark:border-sky-700 bg-sky-100 dark:bg-sky-950 px-2.5 py-2 text-sm font-extrabold font-mono text-sky-900 dark:text-sky-200 select-none">
                          {CURRENCY_CATALOG[transferForeignCurrency]?.flag} {CURRENCY_CATALOG[transferForeignCurrency]?.symbol}
                        </span>
                        <CurrencyInput
                          id="tx-transfer-foreign-amount"
                          data-testid="tx-transfer-foreign-amount-input"
                          currency={transferForeignCurrency}
                          value={transferForeignAmountStr}
                          onValueChange={setTransferForeignAmountStr}
                          placeholder="0,00"
                          className="w-full rounded-r-xl border border-sky-400 dark:border-sky-700 bg-white dark:bg-slate-900 px-3 py-2 text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white focus:border-sky-600 focus:outline-none"
                        />
                      </div>
                    </div>
                    {transferForeignAmount > 0 && numericPreview > 0 && (
                      <p data-testid="transfer-fx-rate" className="text-[11px] text-slate-600 dark:text-slate-300">
                        Cotação efetiva: <strong>{formatExchangeRateBR(numericPreview / transferForeignAmount)}</strong> por {transferForeignCurrency} (já com taxas e IOF, se houver).
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Row 1: Category + Account/Card */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <label htmlFor="tx-category-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Categoria
                      </label>
                      {smartCategorySuggestion && categoryId === smartCategorySuggestion.categoryId && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          <Sparkles className="h-2.5 w-2.5" />
                          Sugerida pelo histórico
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedCategoryObj && (
                        <CategoryIconBadge
                          icon={selectedCategoryObj.icon}
                          color={selectedCategoryObj.color}
                          size="sm"
                        />
                      )}
                      <select
                        id="tx-category-select"
                        value={categoryId}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="w-full min-w-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                      >
                        {filteredCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {smartCategorySuggestion && smartCategoryTarget &&
                      categoryId !== smartCategoryTarget.categoryId && (
                      <button
                        type="button"
                        onClick={() => handleApplySmartCategory(smartCategorySuggestion)}
                        className="mt-1 text-left inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
                      >
                        <Sparkles className="h-3 w-3 shrink-0" />
                        <span>Sugerir: {smartCategorySuggestion.categoryName} ({Math.round(smartCategorySuggestion.confidence * 100)}%)</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <label htmlFor="tx-payment-source-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {entryMode === 'credit_card'
                        ? 'Cartão Utilizado'
                        : isTripLinked && selectedTrip
                        ? `Conta Internacional (${selectedTrip.currency})`
                        : entryMode === 'income'
                        ? 'Cai em qual Conta?'
                        : 'Sai de qual Conta?'}
                    </label>
                    {entryMode === 'credit_card' ? (
                      <div className="space-y-1.5">
                        <select
                          id="tx-payment-source-select"
                          value={creditCardId}
                          onChange={(e) => setCreditCardId(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                        >
                          {cards.map((card) => (
                            <option key={card.id} value={card.id}>
                              {card.name} (Fecha dia {card.closingDay} · Vence dia {card.dueDay})
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const chosenCard =
                            cards.find((c) => c.id === creditCardId) || cards[0];
                          const purchaseMonth = date.slice(0, 7) || selectedMonth;
                          const nextMonth = addMonthsToYearMonth(purchaseMonth, 1);
                          const prevMonth = addMonthsToYearMonth(purchaseMonth, -1);
                          const autoInvoiceMonth = resolveCreditCardInvoiceMonth(
                            date,
                            chosenCard
                          );
                          const hasManualInvoiceMonth =
                            invoiceCompetenceMonth !== autoInvoiceMonth;
                          const monthOptions = Array.from(
                            new Set([
                              prevMonth,
                              purchaseMonth,
                              nextMonth,
                              addMonthsToYearMonth(purchaseMonth, 2),
                              invoiceCompetenceMonth,
                            ])
                          )
                            .filter(Boolean)
                            .sort();

                          return (
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                              <button
                                type="button"
                                data-testid="toggle-invoice-month-override"
                                aria-expanded={isInvoiceMonthOverrideOpen}
                                onClick={() => {
                                  if (hasManualInvoiceMonth) {
                                    setInvoiceCompetenceMonth(autoInvoiceMonth);
                                    setIsInvoiceMonthOverrideOpen(false);
                                  } else {
                                    setIsInvoiceMonthOverrideOpen((open) => !open);
                                  }
                                }}
                                className="rounded px-1.5 py-0.5 font-semibold text-violet-700 underline decoration-violet-300 underline-offset-2 hover:text-violet-900 dark:text-violet-300 dark:hover:text-white"
                              >
                                {hasManualInvoiceMonth
                                  ? 'Usar estimativa'
                                  : isInvoiceMonthOverrideOpen
                                  ? 'Ocultar ajuste'
                                  : 'Ajustar fatura'}
                              </button>
                              {isInvoiceMonthOverrideOpen && (
                                <select
                                  aria-label="Ajuste manual da fatura"
                                  data-testid="invoice-month-override"
                                  value={invoiceCompetenceMonth}
                                  onChange={(e) => setInvoiceCompetenceMonth(e.target.value)}
                                  className="rounded border border-violet-300 dark:border-violet-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-[11px] font-bold text-violet-900 dark:text-violet-200"
                                >
                                  {monthOptions.map((m) => (
                                    <option key={m} value={m}>
                                      {formatMonthYearPT(m)}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : isTripLinked && selectedTrip ? (
                      (() => {
                        const matchingIntl = accounts.filter(
                          (a) =>
                            a.type === 'international' &&
                            a.currency === selectedTrip.currency
                        );
                        if (currencyRegime === 'cash_fx') {
                          return (
                            <div className="w-full rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/40 px-2.5 py-2 text-xs font-bold text-sky-900 dark:text-sky-200 truncate">
                              💵 Espécie da Viagem ({selectedTrip.currency})
                            </div>
                          );
                        }
                        return (
                          <div className="space-y-2">
                            <AccountSelectShell account={selectedPaymentAccount}>
<select
                              id="tx-payment-source-select"
                              value={accountId}
                              onChange={(e) => setAccountId(e.target.value)}
                              className="w-full rounded-lg border border-sky-300 dark:border-sky-700 bg-sky-50/60 dark:bg-slate-900 pl-10 pr-2.5 py-2 text-xs font-bold text-sky-950 dark:text-white"
                            >
                              <option value="">
                                {matchingIntl.length > 0
                                  ? `— Selecionar conta em ${selectedTrip.currency} —`
                                  : `Bolso Câmbio da Viagem (${selectedTrip.currency})`}
                              </option>
                              {matchingIntl.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {CURRENCY_CATALOG[selectedTrip.currency]?.flag} {acc.name} ({selectedTrip.currency})
                                </option>
                              ))}
                            </select>
</AccountSelectShell>
                          </div>
                        );
                      })()
                    ) : (
                      <>
                        <AccountSelectShell account={selectedPaymentAccount}>
<select
                          id="tx-payment-source-select"
                          value={accountId}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            setAccountId(nextId);
                            const chosen = accounts.find((a) => a.id === nextId);
                            if (
                              chosen &&
                              chosen.type === 'international' &&
                              chosen.currency &&
                              chosen.currency !== 'BRL'
                            ) {
                              setIsMultiCurrencyOpen(true);
                              setOriginalCurrency(chosen.currency);
                              setCurrencyRegime('global_account');
                              const defRate =
                                CURRENCY_CATALOG[chosen.currency]
                                  ?.defaultCommercialRateBrl || 5.8;
                              setExchangeRateStr(
                                defRate.toFixed(4).replace('.', ',')
                              );
                              setIofPercentStr('1,10');
                            } else if (!isTripLinked) {
                              setIsMultiCurrencyOpen(false);
                              setOriginalCurrency('BRL');
                            }
                          }}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                        >
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.type === 'international' && acc.currency
                                ? `${CURRENCY_CATALOG[acc.currency]?.flag || '🌎'} ${acc.name} (${acc.currency})`
                                : getAccountLabel(acc, accounts)}
                            </option>
                          ))}
                        </select>
</AccountSelectShell>
                      </>
                    )}
                  </div>
                </div>

                {/* Live Category Budget Micro-Bar */}
                {liveBudgetImpact && liveBudgetImpact.hasBudget && (
                  <div
                    data-testid="live-category-budget-bar"
                    className={`rounded-xl border px-3.5 py-2 text-xs ${
                      liveBudgetImpact.statusAfter === 'over'
                        ? 'border-rose-200 dark:border-rose-800 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                        : liveBudgetImpact.statusAfter === 'warning'
                        ? 'border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="font-semibold flex items-center gap-1.5">
                        {liveBudgetImpact.statusAfter !== 'ok' && (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                        )}
                        Teto de {liveBudgetImpact.categoryName} ({formatMonthYearPT(liveBudgetImpact.month)}):
                      </span>
                      <span className="font-mono font-bold tabular-nums">
                        {formatBRL(liveBudgetImpact.projectedSpent)} /{' '}
                        {formatBRL(liveBudgetImpact.budgetLimit)} (
                        {liveBudgetImpact.percentAfter.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/80 dark:bg-slate-900 overflow-hidden border border-slate-200/60 dark:border-slate-700">
                      <div
                        className={`h-full ${
                          liveBudgetImpact.statusAfter === 'over'
                            ? 'bg-rose-600'
                            : liveBudgetImpact.statusAfter === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            liveBudgetImpact.percentAfter
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Frequency / Recurrence Selector
                    CRITICAL RULE: "Parcelado (2x a 24x)" ONLY appears when entryMode === 'credit_card'! */}
                {!editingTransaction && (
                  <div
                    data-testid="main-recurrence-selector"
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Repeat className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        {entryMode === 'credit_card'
                          ? 'Modalidade na Fatura (À Vista, Assinatura Fixa ou Parcelado)'
                          : 'Frequência no Fluxo (Único ou Recorrente Mensal)'}
                      </span>
                    </div>

                    <div
                      className={`grid grid-cols-1 gap-1.5 ${
                        entryMode === 'credit_card'
                          ? 'sm:grid-cols-3'
                          : 'sm:grid-cols-2'
                      }`}
                    >
                      <button
                        type="button"
                        data-testid="recurrence-single-btn"
                        onClick={() => setRecurrence('single')}
                        className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                          recurrence === 'single'
                            ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-bold">
                          {entryMode === 'credit_card'
                            ? 'À Vista (1x na Fatura)'
                            : 'Único / Neste Mês'}
                        </div>
                        <div
                          className={`text-[10px] ${
                            recurrence === 'single'
                              ? 'text-slate-300 dark:text-slate-600'
                              : 'text-slate-400'
                          }`}
                        >
                          Lançamento pontual sem repetição
                        </div>
                      </button>

                      <button
                        type="button"
                        data-testid="recurrence-fixed-btn"
                        onClick={() => setRecurrence('fixed')}
                        className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                          recurrence === 'fixed'
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-bold">Fixo / Recorrente Mensal</div>
                        <div
                          className={`text-[10px] ${
                            recurrence === 'fixed'
                              ? 'text-emerald-100'
                              : 'text-slate-400'
                          }`}
                        >
                          {entryMode === 'income'
                            ? 'Salário, Aluguel, Proventos'
                            : entryMode === 'credit_card'
                            ? 'Assinatura Streaming, Academia'
                            : 'Condomínio, Luz, Internet, Aluguel'}
                        </div>
                      </button>

                      {/* ONLY SHOW INSTALLMENTS WHEN ENTRY MODE IS CREDIT CARD */}
                      {entryMode === 'credit_card' && (
                        <button
                          type="button"
                          data-testid="recurrence-installment-btn"
                          onClick={() => setRecurrence('installment')}
                          className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                            recurrence === 'installment'
                              ? 'border-violet-600 bg-violet-600 text-white shadow-2xs'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <div className="font-bold">Parcelado (2x a 24x)</div>
                          <div
                            className={`text-[10px] ${
                              recurrence === 'installment'
                                ? 'text-violet-100'
                                : 'text-slate-400'
                            }`}
                          >
                            Divide nas próximas faturas do cartão
                          </div>
                        </button>
                      )}
                    </div>

                    {recurrence === 'fixed' && (
                      <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          <strong>Projeção Automática:</strong> O mês atual entra como{' '}
                          <strong>
                            {entryMode === 'credit_card'
                              ? 'Na Fatura'
                              : status === 'paid'
                              ? 'Efetivado'
                              : 'Pendente'}
                          </strong>{' '}
                          e os meses seguintes como <strong>Previsto</strong>.
                        </div>
                        <div className="shrink-0">
                          <select
                            value={fixedMonthsCount}
                            onChange={(e) =>
                              setFixedMonthsCount(Number(e.target.value))
                            }
                            className="w-full sm:w-auto rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white"
                          >
                            <option value={3}>Repetir por 3 meses</option>
                            <option value={6}>Repetir por 6 meses (Semestre)</option>
                            <option value={12}>Repetir por 12 meses (1 Ano)</option>
                            <option value={24}>Repetir por 24 meses (2 Anos)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {entryMode === 'credit_card' &&
                      recurrence === 'installment' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-700">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Número de Parcelas no Cartão
                            </label>
                            <select
                              value={installmentTotal}
                              onChange={(e) =>
                                setInstallmentTotal(Number(e.target.value))
                              }
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-bold tabular-nums text-slate-900 dark:text-white"
                            >
                              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 24].map(
                                (n) => (
                                  <option key={n} value={n}>
                                    {n}x sem juros no cartão
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Cálculo de cada parcela
                            </label>
                            <select
                              value={amountMode}
                              onChange={(e) =>
                                setAmountMode(
                                  e.target.value as
                                    | 'total_divided'
                                    | 'per_installment'
                                )
                              }
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                            >
                              <option value="total_divided">
                                Dividir valor total pelas {installmentTotal} parcelas
                              </option>
                              <option value="per_installment">
                                Valor digitado já é o de cada parcela
                              </option>
                            </select>
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}

            {/* Custom Tags Section: Granular Categorization beyond Standard Categories */}
            <div
              data-testid="custom-tags-section"
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 sm:p-3.5 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="tx-tag-input"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
                >
                  <Tag className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Tags Personalizadas (#tags)</span>
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Categorize além das categorias padrão ({tags.length}/12)
                </span>
              </div>

              {/* Active Tags Chips */}
              {tags.length > 0 && (
                <div
                  data-testid="tx-active-tags-list"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      data-testid="tx-active-tag-chip"
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-100/90 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 text-xs font-bold text-emerald-900 dark:text-emerald-200 shadow-2xs"
                    >
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">#</span>
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`Remover tag ${tag}`}
                        className="ml-0.5 rounded-full p-0.5 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Tag Input + Add Button */}
              <div className="flex items-stretch gap-2">
                <div className="relative flex-1 min-w-0">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                    #
                  </span>
                  <input
                    id="tx-tag-input"
                    data-testid="tx-tag-input"
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    placeholder="Ex: reembolsavel, imposto-renda, projeto-casa (Enter ou vírgula)"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-7 pr-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  data-testid="tx-add-tag-btn"
                  onClick={() => handleAddTag()}
                  disabled={!tagInput.trim()}
                  className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-40 transition-colors shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Adicionar Tag</span>
                </button>
              </div>

              {/* Quick Suggestion Tag Pills */}
              {availableTagSuggestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[10px] font-semibold text-slate-400 mr-1">
                    Sugestões rápidas:
                  </span>
                  {availableTagSuggestions.map((sugTag) => (
                    <button
                      key={sugTag}
                      type="button"
                      data-testid="tx-suggested-tag-pill"
                      onClick={() => handleAddTag(sugTag)}
                      className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-emerald-300 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
                    >
                      <span className="text-slate-400 font-mono">+#</span>
                      <span>{sugTag}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Zone 2.2: Advanced Progressive Disclosure Cards (Viagem, Familiar & Notas via Botões Liga/Desliga) */}
            {entryMode !== 'transfer' && (
              <div
                data-testid="advanced-options-container"
                className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800"
              >
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Vínculos & Rateios Opcionais
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Ative abaixo apenas se desejar vincular a um roteiro ou dividir despesas
                  </p>
                </div>

                {/* Switch Card 1: Vincular a uma Viagem */}
                <div
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isTripLinked
                      ? 'border-sky-300 dark:border-sky-700 bg-sky-50/60 dark:bg-sky-950/30 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between p-3 sm:p-3.5 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          isTripLinked
                            ? 'bg-sky-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Plane className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            Vincular a uma Viagem
                          </span>
                          {isTripLinked && (
                            <span className="inline-flex items-center rounded-full bg-sky-100 dark:bg-sky-900/80 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:text-sky-200">
                              {tripId && selectedTrip
                                ? selectedTrip.name.split('—')[0].trim()
                                : originalCurrency !== 'BRL'
                                ? originalCurrency
                                : 'Ativo'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Organizar no roteiro, moedas internacionais (USD/EUR) e rateio
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isTripLinked}
                      data-testid="toggle-trip-switch"
                      onClick={handleToggleTrip}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                        isTripLinked
                          ? 'bg-sky-600'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      <span className="sr-only">Vincular a uma Viagem</span>
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isTripLinked ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Expanded Travel Panel */}
                  {isTripLinked && (
                    <div
                      data-testid="multicurrency-travel-panel"
                      className="border-t border-sky-200/80 dark:border-sky-800/60 p-3.5 sm:p-4 pt-3.5 space-y-3.5 animate-expand-in bg-white/40 dark:bg-slate-900/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-sky-950 dark:text-sky-200 flex items-center gap-1.5">
                          <Globe className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                          Roteiro & Câmbio Médio da Viagem
                        </span>
                        {selectedTrip && (
                          <span className="rounded-md bg-sky-100 dark:bg-sky-900/60 border border-sky-300 dark:border-sky-700 px-2.5 py-0.5 font-mono text-[11px] font-bold text-sky-900 dark:text-sky-200">
                            Média: 1 {selectedTrip.currency} ={' '}
                            {formatExchangeRateBR(parsedExchangeRate)}
                          </span>
                        )}
                      </div>

                      {trips.length === 0 ? (
                        <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/80 dark:bg-sky-950/60 p-3.5 text-xs text-sky-900 dark:text-sky-200 space-y-1">
                          <p className="font-bold">
                            Nenhuma viagem cadastrada no momento
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                            Cadastre sua viagem e suas compras de moeda na aba <strong>Viagens & Câmbio</strong>. Ao vincular um gasto aqui, o sistema utiliza automaticamente a moeda e a média ponderada do câmbio comprado na viagem (sem necessidade de informar cotação ou IOF manualmente).
                          </p>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Viagem Vinculada (Moeda Exclusiva da Viagem)
                            </label>
                            <select
                              data-testid="tx-trip-select"
                              value={selectedTrip?.id || tripId}
                              onChange={(e) => handleTripSelect(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:border-sky-600 focus:outline-none"
                            >
                              {trips.map((t) => (
                                <option key={t.id} value={t.id}>
                                  ✈️ {t.name} — Somente {t.currency} ({CURRENCY_CATALOG[t.currency]?.symbol})
                                </option>
                              ))}
                            </select>
                          </div>

                          {selectedTrip && (
                            <div className="space-y-2.5">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                  Meio de Pagamento Internacional ({selectedTrip.currency})
                                </label>
                                <div
                                  data-testid="trip-intl-payment-regime-selector"
                                  className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                                >
                                  <button
                                    type="button"
                                    data-testid="regime-global-account-btn"
                                    onClick={() => handleRegimeChange('global_account')}
                                    className={`rounded-xl border p-2.5 text-left transition-all ${
                                      currencyRegime === 'global_account'
                                        ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/70 text-sky-950 dark:text-sky-100 ring-1 ring-sky-600'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="text-xs font-bold flex items-center justify-between">
                                      <span>Cartão Global (Wise / Nomad)</span>
                                      {currencyRegime === 'global_account' && (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                      Wise, Nomad, Avenue, C6 Global em {selectedTrip.currency}
                                    </p>
                                  </button>

                                  <button
                                    type="button"
                                    data-testid="regime-credit-card-intl-btn"
                                    onClick={() => handleRegimeChange('credit_card_intl')}
                                    className={`rounded-xl border p-2.5 text-left transition-all ${
                                      currencyRegime === 'credit_card_intl'
                                        ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/70 text-sky-950 dark:text-sky-100 ring-1 ring-sky-600'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="text-xs font-bold flex items-center justify-between">
                                      <span>Cartão Internacional</span>
                                      {currencyRegime === 'credit_card_intl' && (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                      Compra no crédito internacional em {selectedTrip.currency}
                                    </p>
                                  </button>

                                  <button
                                    type="button"
                                    data-testid="regime-cash-fx-btn"
                                    onClick={() => handleRegimeChange('cash_fx')}
                                    className={`rounded-xl border p-2.5 text-left transition-all ${
                                      currencyRegime === 'cash_fx'
                                        ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/70 text-sky-950 dark:text-sky-100 ring-1 ring-sky-600'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="text-xs font-bold flex items-center justify-between">
                                      <span>Espécie ({selectedTrip.currency})</span>
                                      {currencyRegime === 'cash_fx' && (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                      Papel-moeda vivo comprado para a viagem
                                    </p>
                                  </button>
                                </div>
                              </div>

                              {currencyRegime === 'global_account' && (
                                <div
                                  data-testid="trip-linked-intl-account-selector"
                                  className="rounded-xl border border-sky-200 dark:border-sky-800/80 bg-sky-50/70 dark:bg-sky-950/40 p-3 space-y-1.5"
                                >
                                  <label className="block text-[11px] font-bold text-sky-950 dark:text-sky-200">
                                    🌎 Debitar de qual Conta Internacional ({selectedTrip.currency} — Wise, Nomad, Avenue, C6 Global)?
                                  </label>
                                  {(() => {
                                    const matchingIntl = accounts.filter(
                                      (a) =>
                                        a.type === 'international' &&
                                        a.currency === selectedTrip.currency
                                    );
                                    return matchingIntl.length > 0 ? (
                                      <>
                                        <select
                                          data-testid="tx-trip-intl-account-select"
                                          value={accountId}
                                          onChange={(e) => setAccountId(e.target.value)}
                                          className="w-full rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-sky-950 dark:text-white"
                                        >
                                          <option value="">
                                            — Abater apenas da carteira de câmbio da viagem —
                                          </option>
                                          {matchingIntl.map((acc) => (
                                            <option key={acc.id} value={acc.id}>
                                              {CURRENCY_CATALOG[selectedTrip.currency]?.flag}{' '}
                                              {acc.name} ({acc.institution} · {selectedTrip.currency})
                                            </option>
                                          ))}
                                        </select>
                                        {selectedPaymentAccount?.type === 'international' && (
                                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                            <InstitutionMark
                                              institution={selectedPaymentAccount.institution}
                                              accountName={selectedPaymentAccount.name}
                                              color={selectedPaymentAccount.color}
                                              size="xs"
                                            />
                                            <span>Conta selecionada: {getAccountLabel(selectedPaymentAccount, accounts)}</span>
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <p className="text-[11px] text-sky-800 dark:text-sky-300">
                                        Debitando do saldo de câmbio da viagem em{' '}
                                        <strong>{selectedTrip.currency}</strong>. Suas contas internacionais (Wise, Nomad, etc.) e cartões são independentes e podem ser cadastrados na aba Contas & Cartões.
                                      </p>
                                    );
                                  })()}
                                </div>
                              )}

                              {currencyRegime === 'credit_card_intl' && cards.length > 0 && (
                                <div className="rounded-xl border border-sky-200 dark:border-sky-800/80 bg-sky-50/70 dark:bg-sky-950/40 p-3 space-y-1.5">
                                  <label className="block text-[11px] font-bold text-sky-950 dark:text-sky-200">
                                    💳 Qual Cartão de Crédito foi utilizado nesta compra internacional?
                                  </label>
                                  <select
                                    data-testid="tx-trip-intl-card-select"
                                    value={creditCardId}
                                    onChange={(e) => setCreditCardId(e.target.value)}
                                    className="w-full rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-sky-950 dark:text-white"
                                  >
                                    <option value="">— Registrar apenas no roteiro da viagem —</option>
                                    {cards.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        💳 {c.name} ({c.brand})
                                      </option>
                                    ))}
                                  </select>
                                  {selectedCreditCard && (
                                    <div className="flex items-center gap-3">
                                      <CreditCardFace card={selectedCreditCard} size="compact" />
                                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Bandeira {selectedCreditCard.brand}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div
                                data-testid="trip-auto-weighted-rate-summary"
                                className="rounded-xl border border-sky-200 dark:border-sky-800/80 bg-white dark:bg-slate-900 p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                              >
                                <div className="space-y-0.5">
                                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                    Moeda Oficial da Viagem ({selectedTrip.currency}) • Câmbio Médio Automático
                                  </span>
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                                    {selectedTrip.exchangeLots.length > 0
                                      ? `Média ponderada de ${selectedTrip.exchangeLots.length} compra(s) de câmbio na viagem (sem misturar com R$)`
                                      : 'Cotação média de referência configurada na viagem'}
                                  </span>
                                </div>
                                <div className="text-right font-mono">
                                  <span className="text-xs font-extrabold text-sky-800 dark:text-sky-300 block">
                                    1 {selectedTrip.currency} = {formatExchangeRateBR(parsedExchangeRate)}
                                  </span>
                                  {fxConversionPreview && parsedForeignAmount > 0 && (
                                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">
                                      Equivalente: {formatBRL(fxConversionPreview.totalBrl)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Trip Group Splitting */}
                      {selectedTrip && selectedTrip.participants.length > 1 && (
                        <div className="pt-3 border-t border-sky-200/80 dark:border-sky-800/60 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Quem pagou esta despesa na viagem?
                              </label>
                              <select
                                value={tripPayerParticipantId}
                                onChange={(e) =>
                                  setTripPayerParticipantId(e.target.value)
                                }
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                              >
                                {selectedTrip.participants.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.isMe || p.id === 'me'
                                      ? `👤 ${p.name} (Sai da minha conta/cartão)`
                                      : `🤝 ${p.name} pagou (Apenas rateio na viagem)`}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Regra de Divisão entre Viajantes
                              </label>
                              <select
                                value={tripSplitMethod}
                                onChange={(e) =>
                                  setTripSplitMethod(
                                    e.target.value as TripSplitMethod
                                  )
                                }
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                              >
                                <option value="equal">
                                  Divisão Igualitária (Partes Iguais)
                                </option>
                                <option value="exact">
                                  Valor Exato por Pessoa
                                </option>
                                <option value="percentage">
                                  Porcentagem (%)
                                </option>
                                <option value="shares">
                                  Por Cotas / Pesos (ex: 2x, 1x)
                                </option>
                                <option value="individual">
                                  100% Individual (Apenas quem consumiu)
                                </option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                              Participantes deste gasto:
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {selectedTrip.participants.map((p) => {
                                const isChecked =
                                  selectedTripParticipantIds.length === 0 ||
                                  selectedTripParticipantIds.includes(p.id);
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => toggleTripParticipant(p.id)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${
                                      isChecked
                                        ? 'border-sky-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                                        : 'border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{ backgroundColor: p.color }}
                                    />
                                    <span>{p.name}</span>
                                    {isChecked && (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-sky-600" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {isPaidByCompanion && (
                            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200">
                              <strong>Regra Contábil:</strong> Como quem pagou foi{' '}
                              <strong>
                                {
                                  selectedTrip.participants.find(
                                    (p) => p.id === tripPayerParticipantId
                                  )?.name
                                }
                              </strong>
                              , este gasto não descontará do seu saldo bancário agora — apenas registrará a sua parte no acerto da viagem.
                            </div>
                          )}

                          {(tripSplitMethod === 'exact' ||
                            tripSplitMethod === 'percentage' ||
                            tripSplitMethod === 'shares') && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                              {selectedTrip.participants
                                .filter(
                                  (p) =>
                                    selectedTripParticipantIds.length === 0 ||
                                    selectedTripParticipantIds.includes(p.id)
                                )
                                .map((p) => (
                                  <div
                                    key={p.id}
                                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2"
                                  >
                                    <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate mb-1">
                                      {p.name}{' '}
                                      {tripSplitMethod === 'percentage'
                                        ? '(%)'
                                        : tripSplitMethod === 'shares'
                                        ? '(Cotas)'
                                        : `(${originalCurrency})`}
                                    </label>
                                    {tripSplitMethod === 'exact' ? <CurrencyInput
                                      currency={originalCurrency}
                                      value={tripCustomInputs[p.id] || ''}
                                      onValueChange={(value) =>
                                        setTripCustomInputs((prev) => ({ ...prev, [p.id]: value }))
                                      }
                                      placeholder="0,00"
                                      className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono text-slate-900 dark:text-white"
                                    /> : <input
                                      type="text"
                                      inputMode="decimal"
                                      value={tripCustomInputs[p.id] || ''}
                                      onChange={(e) =>
                                        setTripCustomInputs((prev) => ({
                                          ...prev,
                                          [p.id]: e.target.value,
                                        }))
                                      }
                                      placeholder={
                                        tripSplitMethod === 'percentage'
                                          ? '50'
                                          : tripSplitMethod === 'shares'
                                          ? '1'
                                          : '0,00'
                                      }
                                      className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono text-slate-900 dark:text-white"
                                    />}
                                  </div>
                                ))}
                            </div>
                          )}

                          {tripSharesPreview.length > 0 && (
                            <div className="rounded-lg bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 p-2.5 space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                Resumo do Rateio por Viajante
                              </span>
                              <div className="flex flex-wrap items-center gap-2">
                                {tripSharesPreview.map((s) => {
                                  const part = selectedTrip.participants.find(
                                    (p) => p.id === s.participantId
                                  );
                                  return (
                                    <span
                                      key={s.participantId}
                                      className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-800 dark:text-slate-200"
                                    >
                                      <strong>{part?.name}:</strong>{' '}
                                      <span className="font-mono font-bold">
                                        {originalCurrency !== 'BRL'
                                          ? `${formatForeignCurrency(
                                              s.foreignShare,
                                              originalCurrency
                                            )} (${formatBRL(s.brlShare)})`
                                          : formatBRL(s.brlShare)}
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {tripSplitValidationError && (
                            <p role="alert" className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                              {tripSplitValidationError}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Switch Card 2: Dividir com Familiar (Rateio Doméstico em R$ - Oculto quando for Viagem Internacional) */}
                {entryMode !== 'income' && !isTripLinked && (
                  <div
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isShared
                        ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/60 dark:bg-indigo-950/30 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between p-3 sm:p-3.5 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                            isShared
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <Users className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                              Dividir com Familiar (Compensação em R$)
                            </span>
                            {isShared && numericPreview > 0 && (
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  sharedPaidBy === 'member'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200'
                                    : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/80 dark:text-indigo-200'
                                }`}
                              >
                                {sharedPaidBy === 'member' ? 'Eu devo: ' : 'Me deve: '}
                                {formatBRL(calculatedSharedPreview())}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            Rachar despesa nacional e abater automaticamente no encontro de contas
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={isShared}
                        data-testid="toggle-shared-switch"
                        onClick={handleToggleShared}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                          isShared
                            ? 'bg-indigo-600'
                            : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      >
                        <span className="sr-only">Dividir com Familiar</span>
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isShared ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Expanded Family Split Panel */}
                    {isShared && (
                      <div
                        data-testid="family-split-panel"
                        className="border-t border-indigo-200/80 dark:border-indigo-800/60 p-3.5 sm:p-4 pt-3.5 space-y-3.5 animate-expand-in bg-white/40 dark:bg-slate-900/40"
                      >
                        {familyMembers.length === 0 ? (
                          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 p-3.5 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                              <UserPlus className="h-4 w-4 text-indigo-600 shrink-0" />
                              <span>Adicionar familiar à lista</span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Adicione um familiar sem e-mail. Para vincular uma conta por e-mail, use a aba Compartilhado.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                              <input
                                type="text"
                                data-testid="inline-family-member-name"
                                placeholder="Nome (ex: Mariana)"
                                value={newMemberName}
                                onChange={(e) =>
                                  setNewMemberName(e.target.value)
                                }
                                className="sm:col-span-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                              />
                              <input
                                type="email"
                                data-testid="inline-family-member-email"
                                placeholder="E-mail (use a aba Compartilhado)"
                                value={newMemberEmail}
                                onChange={(e) =>
                                  setNewMemberEmail(e.target.value)
                                }
                                className="sm:col-span-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                              />
                              {inlineFamilyMemberError && (
                                <p role="alert" data-testid="inline-family-member-error" className="sm:col-span-12 text-xs text-rose-700">
                                  {inlineFamilyMemberError}
                                </p>
                              )}
                              <select
                                value={newMemberRelationship}
                                onChange={(e) =>
                                  setNewMemberRelationship(
                                    e.target
                                      .value as FamilyMember['relationship']
                                  )
                                }
                                className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white"
                              >
                                <option value="cônjuge">Cônjuge</option>
                                <option value="filho(a)">Filho(a)</option>
                                <option value="pai/mãe">Pai/Mãe</option>
                                <option value="irmão/irmã">Irmão/Irmã</option>
                                <option value="amigo(a)">Amigo(a)</option>
                                <option value="outro">Outro</option>
                              </select>
                              <button
                                type="button"
                                data-testid="inline-family-member-submit"
                                onClick={handleInlineAddFamilyMember}
                                className="sm:col-span-2 rounded-lg bg-indigo-600 text-white text-xs font-bold py-1.5 px-3 hover:bg-indigo-700 transition-colors"
                              >
                                Adicionar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Bilateral Payer Selector: Who paid this bill? */}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Quem pagou esta despesa? (Compensação Automática)
                              </label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  data-testid="shared-paid-by-me-btn"
                                  onClick={() => setSharedPaidBy('me')}
                                  className={`rounded-xl border px-3 py-2 text-left text-xs transition-all ${
                                    sharedPaidBy === 'me'
                                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-100 font-bold ring-1 ring-indigo-600'
                                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  <span className="block font-bold">
                                    👤 Eu paguei a conta
                                  </span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                    O familiar me deve a parte dele(a)
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  data-testid="shared-paid-by-member-btn"
                                  onClick={() => setSharedPaidBy('member')}
                                  className={`rounded-xl border px-3 py-2 text-left text-xs transition-all ${
                                    sharedPaidBy === 'member'
                                      ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/70 text-amber-950 dark:text-amber-100 font-bold ring-1 ring-amber-600'
                                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  <span className="block font-bold">
                                    🤝 Familiar pagou a conta
                                  </span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                    Eu devo minha parte a ele(a) (abate do saldo)
                                  </span>
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                    Dividir com qual familiar?
                                  </label>
                                  {onAddFamilyMember && (
                                    <button
                                      type="button"
                                      data-testid="toggle-inline-family-member-form"
                                      onClick={() =>
                                        setIsAddingFamilyMember(
                                          !isAddingFamilyMember
                                        )
                                      }
                                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-0.5"
                                    >
                                      <Plus className="h-3 w-3" />
                                      {isAddingFamilyMember
                                        ? 'Fechar cadastro'
                                        : '+ Convidar familiar'}
                                    </button>
                                  )}
                                </div>
                                <select
                                  value={sharedMemberId}
                                  onChange={(e) =>
                                    setSharedMemberId(e.target.value)
                                  }
                                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:border-indigo-600 focus:outline-none"
                                >
                                  {familyMembers.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} ({m.relationship}){m.email ? ` • ${m.email}` : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                  Regra de Divisão
                                </label>
                                <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-200/70 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700">
                                  <button
                                    type="button"
                                    onClick={() => setSharedSplitMode('half')}
                                    className={`rounded-lg py-1.5 text-[11px] font-bold transition-all text-center ${
                                      sharedSplitMode === 'half'
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                                    }`}
                                  >
                                    ½ 50%
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSharedSplitMode('percentage')
                                    }
                                    className={`rounded-lg py-1.5 text-[11px] font-bold transition-all text-center ${
                                      sharedSplitMode === 'percentage'
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                                    }`}
                                  >
                                    % Porcento
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSharedSplitMode('custom')}
                                    className={`rounded-lg py-1.5 text-[11px] font-bold transition-all text-center ${
                                      sharedSplitMode === 'custom'
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                                    }`}
                                  >
                                    R$ Fixo
                                  </button>
                                </div>
                              </div>
                            </div>

                            {isAddingFamilyMember && (
                              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 p-3 space-y-2 animate-expand-in">
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                                  Adicionar familiar sem e-mail:
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                  <input
                                    type="text"
                                    data-testid="inline-family-member-name"
                                    placeholder="Nome (ex: Juliana)"
                                    value={newMemberName}
                                    onChange={(e) =>
                                      setNewMemberName(e.target.value)
                                    }
                                    className="sm:col-span-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                                  />
                                  <input
                                    type="email"
                                    data-testid="inline-family-member-email"
                                    placeholder="E-mail (use a aba Compartilhado)"
                                    value={newMemberEmail}
                                    onChange={(e) =>
                                      setNewMemberEmail(e.target.value)
                                    }
                                    className="sm:col-span-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                                  />
                                  {inlineFamilyMemberError && (
                                    <p role="alert" data-testid="inline-family-member-error" className="sm:col-span-12 text-xs text-rose-700">
                                      {inlineFamilyMemberError}
                                    </p>
                                  )}
                                  <select
                                    value={newMemberRelationship}
                                    onChange={(e) =>
                                      setNewMemberRelationship(
                                        e.target
                                          .value as FamilyMember['relationship']
                                      )
                                    }
                                    className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white"
                                  >
                                    <option value="cônjuge">Cônjuge</option>
                                    <option value="filho(a)">Filho(a)</option>
                                    <option value="pai/mãe">Pai/Mãe</option>
                                    <option value="irmão/irmã">
                                      Irmão/Irmã
                                    </option>
                                    <option value="amigo(a)">Amigo(a)</option>
                                    <option value="outro">Outro</option>
                                  </select>
                                  <button
                                    type="button"
                                    data-testid="inline-family-member-submit"
                                    onClick={handleInlineAddFamilyMember}
                                    className="sm:col-span-2 rounded-lg bg-indigo-600 text-white text-xs font-bold py-1.5 px-3 hover:bg-indigo-700 transition-colors"
                                  >
                                    Adicionar
                                  </button>
                                </div>
                              </div>
                            )}

                            {sharedSplitMode === 'percentage' && (
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                  Porcentagem da divisão (%)
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={sharedCustomPercentStr}
                                    onChange={(e) =>
                                      setSharedCustomPercentStr(e.target.value)
                                    }
                                    className="w-28 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white"
                                  />
                                  <span className="text-xs text-slate-500 font-bold">
                                    %
                                  </span>
                                </div>
                              </div>
                            )}

                            {sharedSplitMode === 'custom' && (
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                  {recurrence === 'installment' && amountMode === 'total_divided' ? 'Cota total na compra (R$)' : 'Valor exato da parte dividida (R$)'}
                                </label>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-slate-500">
                                    R$
                                  </span>
                                  <CurrencyInput
                                    value={sharedCustomAmountStr}
                                    data-testid="shared-total-amount-input"
                                    currency="BRL"
                                    onValueChange={setSharedCustomAmountStr}
                                    className="w-36 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white"
                                  />
                                </div>
                              </div>
                            )}

                            {numericPreview > 0 && (
                              <div className="rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/80 p-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                                <div className="text-xs">
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Valor total da nota:{' '}
                                  </span>
                                  <strong className="font-mono text-slate-900 dark:text-white">
                                    {formatBRL(numericPreview)}
                                  </strong>
                                </div>
                                <div className="text-xs">
                                  <span
                                    className={`font-semibold ${
                                      sharedPaidBy === 'member'
                                        ? 'text-amber-700 dark:text-amber-400'
                                        : 'text-indigo-600 dark:text-indigo-400'
                                    }`}
                                  >
                                    {sharedPaidBy === 'member'
                                      ? `Você deve para ${
                                          familyMembers.find(
                                            (m) => m.id === sharedMemberId
                                          )?.name || 'familiar'
                                        }: `
                                      : `${
                                          familyMembers.find(
                                            (m) => m.id === sharedMemberId
                                          )?.name || 'Familiar'
                                        } te deve: `}
                                  </span>
                                  <strong className="font-mono text-indigo-700 dark:text-indigo-300 text-sm">
                                    {formatBRL(calculatedSharedPreview())}
                                  </strong>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Switch Card 3: Observações & Anotações */}
                <div
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isNotesOpen || Boolean(notes)
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between p-3 sm:p-3.5 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          isNotesOpen || Boolean(notes)
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <FileText className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          Observações & Comprovante
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Anotações livres, código de rastreio ou detalhes adicionais
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isNotesOpen || Boolean(notes)}
                      data-testid="toggle-notes-switch"
                      onClick={() => setIsNotesOpen(!isNotesOpen)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                        isNotesOpen || Boolean(notes)
                          ? 'bg-emerald-600'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      <span className="sr-only">Observações</span>
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isNotesOpen || Boolean(notes)
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {(isNotesOpen || Boolean(notes)) && (
                    <div className="border-t border-emerald-200/80 dark:border-emerald-800/60 p-3.5 sm:p-4 pt-3.5 animate-expand-in">
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ex: Pago via Wise cartão final 4321, nota fiscal anexa, código PIX..."
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Zone 3: Sticky Bottom Action Bar with Real-Time Accounting Summary */}
          <div
            data-testid="transaction-modal-sticky-footer"
            className={`shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-5 sm:px-6 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] transition-shadow ${
              scrollState.showBottomShadow
                ? 'shadow-[0_-4px_12px_rgba(15,23,42,0.06)]'
                : ''
            }`}
          >
            <div className="text-xs text-slate-600 dark:text-slate-300 min-w-0">
              {numericPreview > 0 ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>
                    Impacto mensal:{' '}
                    <strong className="font-mono tabular-nums text-slate-900 dark:text-white">
                      {formatBRL(liveBudgetImpact?.draftMonthlyAmount ?? (selectedTrip && isPaidByCompanion ? 0 : numericPreview))}
                    </strong>
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                    {entryMode === 'credit_card'
                      ? selectedCardName
                      : selectedAccountName}
                  </span>
                  {selectedTrip && myTripShareObj && (
                    <span className="text-sky-700 dark:text-sky-400 font-semibold font-mono text-[11px]">
                      (Sua parte: {formatBRL(myTripShareObj.brlShare)})
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-slate-400 dark:text-slate-500">
                  Informe o valor e a descrição para confirmar o lançamento
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="tx-submit-btn"
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-xs whitespace-nowrap"
              >
                {editingTransaction
                  ? 'Salvar Alterações'
                  : entryMode === 'credit_card' && recurrence === 'installment'
                  ? `Lançar ${installmentTotal}x no Cartão`
                  : recurrence === 'fixed'
                  ? `Gerar Série (${fixedMonthsCount}m)`
                  : entryMode === 'transfer' &&
                    transferSubMode === 'card_bill_payment'
                  ? 'Confirmar Pagamento Fatura'
                  : tripId
                  ? 'Salvar Gasto na Viagem'
                  : 'Confirmar Lançamento'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

