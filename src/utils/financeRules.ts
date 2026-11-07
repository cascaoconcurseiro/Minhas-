import {
  AccountBalanceSummary,
  BankAccount,
  Category,
  CategorySpendItem,
  CreditCard,
  CreditCardSummary,
  CurrencyCode,
  CurrencyPaymentRegime,
  DailyCashFlowPoint,
  InvestmentAsset,
  MonthlyComparisonRow,
  MonthlyFinancialSummary,
  PaymentMethod,
  PeriodReportSummary,
  RecurrenceType,
  ReportDistributionSlice,
  SubcategorySpendItem,
  Transaction,
  TransactionStatus,
  TransactionType,
  TripExpenseShare,
  TripSplitMethod,
} from '../types/finance';

export function formatBRL(value: number): string {
  const normalized = Object.is(value, -0) ? 0 : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalized);
}

export function parseBRLInput(raw: string): number {
  if (!raw || typeof raw !== 'string') return 0;
  const cleaned = raw.trim().replace(/[R$\s]/g, '');
  if (!cleaned) return 0;
  const match = cleaned.match(/^([+-]?)([\d.,]+)$/);
  if (!match) return 0;

  const sign = match[1] === '-' ? -1n : 1n;
  const value = match[2];
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  const hasComma = lastComma !== -1;
  const hasDot = lastDot !== -1;

  let integerPart = value;
  let fractionPart = '';

  if (hasComma && hasDot) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const groupingSeparator = decimalSeparator === ',' ? '.' : ',';
    const decimalIndex = Math.max(lastComma, lastDot);
    integerPart = value.slice(0, decimalIndex);
    fractionPart = value.slice(decimalIndex + 1);
    if (
      integerPart.includes(groupingSeparator) &&
      !new RegExp(`^\\d{1,3}(?:\\${groupingSeparator}\\d{3})+$`).test(integerPart)
    ) {
      return 0;
    }
    integerPart = integerPart.replaceAll(groupingSeparator, '');
  } else if (hasComma || hasDot) {
    const separator = hasComma ? ',' : '.';
    const parts = value.split(separator);
    if (parts.length > 2) {
      if (!/^\d{1,3}(?:[.,]\d{3})+$/.test(value)) return 0;
      integerPart = parts.join('');
    } else {
      [integerPart, fractionPart] = parts;
    }
  }

  if (!/^\d*$/.test(integerPart) || !/^\d*$/.test(fractionPart)) return 0;
  if (!integerPart && !fractionPart) return 0;

  try {
    const wholeCents = BigInt(integerPart || '0') * 100n;
    const fractionCents = BigInt((fractionPart + '00').slice(0, 2) || '0');
    let cents = wholeCents + fractionCents;
    if ((fractionPart[2] || '0') >= '5') cents += 1n;
    cents *= sign;
    const safeCents = Number(cents);
    return Number.isSafeInteger(safeCents) ? safeCents / 100 : 0;
  } catch {
    return 0;
  }
}

function isCreditCardInvoicePurchase(tx: Transaction): boolean {
  return !tx.isInvoicePayment && !tx.isCompanionOnlyExpense && tx.sharedPaidBy !== 'member';
}

export function addMonthsToYearMonth(yearMonth: string, offset: number): string {
  const [yStr, mStr] = yearMonth.split('-');
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  const d = new Date(Date.UTC(year, monthIndex + offset, 1));
  const newYear = d.getUTCFullYear();
  const newMonth = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${newYear}-${newMonth}`;
}

export function addMonthsToDateString(dateStr: string, offset: number): string {
  const [yStr, mStr, dStr] = dateStr.split('-');
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  const day = Number(dStr);

  const targetFirst = new Date(Date.UTC(year, monthIndex + offset, 1));
  const targetYear = targetFirst.getUTCFullYear();
  const targetMonthIndex = targetFirst.getUTCMonth();
  const maxDaysInTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, maxDaysInTargetMonth);

  return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function formatMonthYearPT(yearMonth: string): string {
  const [yStr, mStr] = yearMonth.split('-');
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  const mIndex = Math.max(0, Math.min(11, Number(mStr) - 1));
  return `${months[mIndex]} de ${yStr}`;
}

export function formatShortMonthPT(yearMonth: string): string {
  const [yStr, mStr] = yearMonth.split('-');
  const shortMonths = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  const mIndex = Math.max(0, Math.min(11, Number(mStr) - 1));
  return `${shortMonths[mIndex]}/${yStr.slice(2)}`;
}

export function formatShortDateBR(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function getMonthRange(startMonth: string, endMonth: string): string[] {
  const [startStr, finishStr] =
    startMonth <= endMonth ? [startMonth, endMonth] : [endMonth, startMonth];
  const result: string[] = [];
  let current = startStr;
  let guard = 0;
  while (current <= finishStr && guard < 36) {
    result.push(current);
    current = addMonthsToYearMonth(current, 1);
    guard++;
  }
  return result;
}

export interface CreateTransactionBatchInput {
  description: string;
  amount: number;
  amountMode?: 'per_installment' | 'total_divided';
  date: string; // YYYY-MM-DD
  competenceMonth?: string; // YYYY-MM
  type: TransactionType;
  status: TransactionStatus;
  categoryId: string;
  subcategoryId?: string;
  accountId?: string;
  destinationAccountId?: string;
  creditCardId?: string;
  paymentMethod: PaymentMethod;
  recurrence: RecurrenceType;
  installmentTotal?: number;
  fixedMonthsCount?: number;
  notes?: string;
  tags?: string[];
  isShared?: boolean;
  sharedMemberId?: string;
  sharedAmount?: number;
  sharedPaidBy?: 'me' | 'member';
  sharedSplitMode?: 'full' | 'half' | 'custom';
  sharedStatus?: 'pending' | 'received';
  targetInvestmentAssetId?: string;
  isInvoicePayment?: boolean;
  settledCardId?: string;
  // Travel & Multi-Currency fields
  tripId?: string;
  originalCurrency?: CurrencyCode;
  originalAmount?: number;
  exchangeRate?: number;
  iofPercent?: number;
  effectiveExchangeRate?: number;
  currencyRegime?: CurrencyPaymentRegime;
  paidByParticipantId?: string;
  tripSplitMethod?: TripSplitMethod;
  tripShares?: TripExpenseShare[];
  myPersonalShareBrl?: number;
  myPersonalShareForeign?: number;
  isCompanionOnlyExpense?: boolean;
}

export const DEFAULT_POPULAR_TRANSACTION_TAGS: string[] = [
  'reembolsavel',
  'imposto-renda',
  'trabalho',
  'viagem',
  'emergencia',
  'presente',
  'assinatura',
  'familia',
];

/**
 * Normalizes a single custom transaction tag:
 * - Strips leading '#' symbols and surrounding whitespace
 * - Replaces internal whitespace sequences with a hyphen '-'
 * - Preserves letters (including Portuguese diacritics), digits, hyphens, and underscores
 * - Enforces a maximum of 30 characters
 */
export function normalizeTransactionTag(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const cleaned = raw
    .trim()
    .replace(/^#+/, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  return cleaned;
}

/**
 * Normalizes and deduplicates an array of custom tags (or a comma-separated string),
 * preserving original casing of the first occurrence while deduplicating case-insensitively.
 * Bounded to at most 12 tags per transaction.
 */
export function normalizeTransactionTags(
  rawTags?: string[] | string | null
): string[] {
  if (!rawTags) return [];
  const rawList = Array.isArray(rawTags)
    ? rawTags.flatMap((item) =>
        typeof item === 'string' ? item.split(',') : []
      )
    : typeof rawTags === 'string'
    ? rawTags.split(',')
    : [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of rawList) {
    const tag = normalizeTransactionTag(item);
    if (!tag) continue;
    const key = normalizeSearchText(tag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= 12) break;
  }

  return result;
}

/**
 * Extracts all unique custom tags used across transactions (sorted by usage frequency descending),
 * merged with curated Brazilian personal finance tag suggestions.
 */
export function extractAvailableTransactionTags(
  transactions: Transaction[],
  includeDefaults = true
): string[] {
  const counts = new Map<string, { display: string; count: number }>();

  for (const tx of transactions) {
    if (!tx.tags || !Array.isArray(tx.tags)) continue;
    for (const raw of tx.tags) {
      const normalized = normalizeTransactionTag(raw);
      if (!normalized) continue;
      const key = normalizeSearchText(normalized);
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { display: normalized, count: 1 });
      }
    }
  }

  const sortedUserTags = Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display))
    .map((entry) => entry.display);

  if (!includeDefaults) {
    return sortedUserTags;
  }

  return normalizeTransactionTags([
    ...sortedUserTags,
    ...DEFAULT_POPULAR_TRANSACTION_TAGS,
  ]);
}

export function createTransactionBatch(
  input: CreateTransactionBatchInput,
  idPrefix = 'tx'
): Transaction[] {
  const baseMonth = input.competenceMonth || input.date.slice(0, 7);
  const groupId = `${idPrefix}-grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const normalizedTags = normalizeTransactionTags(input.tags);
  const cleanTags = normalizedTags.length > 0 ? normalizedTags : undefined;

  const tripExtras = {
    tripId: input.tripId,
    originalCurrency: input.originalCurrency,
    originalAmount: input.originalAmount,
    exchangeRate: input.exchangeRate,
    iofPercent: input.iofPercent,
    effectiveExchangeRate: input.effectiveExchangeRate,
    currencyRegime: input.currencyRegime,
    paidByParticipantId: input.paidByParticipantId,
    tripSplitMethod: input.tripSplitMethod,
    tripShares: input.tripShares,
    myPersonalShareBrl: input.myPersonalShareBrl,
    myPersonalShareForeign: input.myPersonalShareForeign,
    isCompanionOnlyExpense: input.isCompanionOnlyExpense,
  };

  if (input.recurrence === 'installment' && (input.installmentTotal || 1) > 1) {
    const totalCount = Math.max(2, Math.min(48, Math.floor(input.installmentTotal || 2)));
    const mode = input.amountMode || 'total_divided';
    const basePart =
      mode === 'total_divided'
        ? Math.floor((input.amount / totalCount) * 100) / 100
        : Math.round(input.amount * 100) / 100;
    const remainderCents =
      mode === 'total_divided'
        ? Math.round((input.amount - basePart * totalCount) * 100) / 100
        : 0;

    const totalShared = input.sharedAmount || 0;
    const baseSharedPart =
      mode === 'total_divided'
        ? Math.floor((totalShared / totalCount) * 100) / 100
        : Math.round(totalShared * 100) / 100;
    const remainderSharedCents =
      mode === 'total_divided'
        ? Math.round((totalShared - baseSharedPart * totalCount) * 100) / 100
        : 0;

    const results: Transaction[] = [];
    for (let i = 0; i < totalCount; i++) {
      const instNumber = i + 1;
      const instAmount =
        i === 0 ? Math.round((basePart + remainderCents) * 100) / 100 : basePart;
      const instSharedAmount =
        i === 0
          ? Math.round((baseSharedPart + remainderSharedCents) * 100) / 100
          : baseSharedPart;
      const instDate = addMonthsToDateString(input.date, i);
      const instMonth = addMonthsToYearMonth(baseMonth, i);
      const instStatus: TransactionStatus = i === 0 ? input.status : 'pending';

      results.push({
        id: `${idPrefix}-${Date.now()}-${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
        description: input.description.trim(),
        amount: instAmount,
        date: instDate,
        competenceMonth: instMonth,
        type: input.type,
        status: instStatus,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        accountId: input.accountId,
        destinationAccountId: input.destinationAccountId,
        creditCardId: input.creditCardId,
        paymentMethod: input.paymentMethod,
        recurrence: 'installment',
        installmentGroupId: groupId,
        installmentNumber: instNumber,
        installmentTotal: totalCount,
        notes: input.notes,
        tags: cleanTags,
        isShared: input.isShared,
        sharedMemberId: input.sharedMemberId,
        sharedAmount: input.isShared ? instSharedAmount : undefined,
        sharedPaidBy: input.isShared ? input.sharedPaidBy || 'me' : undefined,
        sharedSplitMode: input.sharedSplitMode,
        sharedStatus: input.isShared ? 'pending' : undefined,
        targetInvestmentAssetId: input.targetInvestmentAssetId,
        ...tripExtras,
      });
    }
    return results;
  }

  if (input.recurrence === 'fixed') {
    const monthsToGenerate = Math.max(1, Math.min(36, input.fixedMonthsCount || 12));
    const results: Transaction[] = [];
    for (let i = 0; i < monthsToGenerate; i++) {
      const instDate = addMonthsToDateString(input.date, i);
      const instMonth = addMonthsToYearMonth(baseMonth, i);
      const instStatus: TransactionStatus = i === 0 ? input.status : 'pending';
      results.push({
        id: `${idPrefix}-${Date.now()}-fix-${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
        description: input.description.trim(),
        amount: Math.round(input.amount * 100) / 100,
        date: instDate,
        competenceMonth: instMonth,
        type: input.type,
        status: instStatus,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        accountId: input.accountId,
        destinationAccountId: input.destinationAccountId,
        creditCardId: input.creditCardId,
        paymentMethod: input.paymentMethod,
        recurrence: 'fixed',
        installmentGroupId: groupId,
        notes: input.notes,
        tags: cleanTags,
        isShared: input.isShared,
        sharedMemberId: input.sharedMemberId,
        sharedAmount: input.isShared ? input.sharedAmount : undefined,
        sharedPaidBy: input.isShared ? input.sharedPaidBy || 'me' : undefined,
        sharedSplitMode: input.sharedSplitMode,
        sharedStatus: input.isShared ? 'pending' : undefined,
        targetInvestmentAssetId: input.targetInvestmentAssetId,
        ...tripExtras,
      });
    }
    return results;
  }

  return [
    {
      id: `${idPrefix}-${Date.now()}-1-${Math.random().toString(36).slice(2, 6)}`,
      description: input.description.trim(),
      amount: Math.round(input.amount * 100) / 100,
      date: input.date,
      competenceMonth: baseMonth,
      type: input.type,
      status: input.status,
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId,
      accountId: input.accountId,
      destinationAccountId: input.destinationAccountId,
      creditCardId: input.creditCardId,
      paymentMethod: input.paymentMethod,
      recurrence: 'single',
      notes: input.notes,
      tags: cleanTags,
      isShared: input.isShared,
      sharedMemberId: input.sharedMemberId,
      sharedAmount: input.isShared ? input.sharedAmount : undefined,
      sharedPaidBy: input.isShared ? input.sharedPaidBy || 'me' : undefined,
      sharedSplitMode: input.sharedSplitMode,
      sharedStatus: input.isShared ? input.sharedStatus || 'pending' : undefined,
      targetInvestmentAssetId: input.targetInvestmentAssetId,
      isInvoicePayment: input.isInvoicePayment,
      settledCardId: input.settledCardId,
      ...tripExtras,
    },
  ];
}

export function calculateAccountBalances(
  accounts: BankAccount[],
  transactions: Transaction[],
  selectedMonth: string
): AccountBalanceSummary[] {
  return accounts.map((acc) => {
    let currentBalance = acc.initialBalance;
    let projectedBalance = acc.initialBalance;
    let monthIncome = 0;
    let monthExpense = 0;

    for (const tx of transactions) {
      if (tx.isCompanionOnlyExpense || tx.sharedPaidBy === 'member') {
        continue;
      }

      if (tx.creditCardId && !tx.isInvoicePayment) {
        continue;
      }

      if (tx.competenceMonth > selectedMonth) {
        continue;
      }

      const isSelectedMonth = tx.competenceMonth === selectedMonth;

      if (tx.type === 'income' && tx.accountId === acc.id) {
        if (tx.status === 'paid') {
          currentBalance += tx.amount;
          projectedBalance += tx.amount;
        } else if (isSelectedMonth) {
          projectedBalance += tx.amount;
        }
        if (isSelectedMonth) {
          monthIncome += tx.amount;
        }
      } else if (tx.type === 'expense' && tx.accountId === acc.id) {
        if (tx.status === 'paid') {
          currentBalance -= tx.amount;
          projectedBalance -= tx.amount;
        } else if (isSelectedMonth) {
          projectedBalance -= tx.amount;
        }
        if (isSelectedMonth) {
          monthExpense += tx.amount;
        }
      } else if (tx.type === 'transfer') {
        if (tx.accountId === acc.id) {
          if (tx.status === 'paid') {
            currentBalance -= tx.amount;
            projectedBalance -= tx.amount;
          } else if (isSelectedMonth) {
            projectedBalance -= tx.amount;
          }
        }
        if (tx.destinationAccountId === acc.id) {
          if (tx.status === 'paid') {
            currentBalance += tx.amount;
            projectedBalance += tx.amount;
          } else if (isSelectedMonth) {
            projectedBalance += tx.amount;
          }
        }
      }
    }

    return {
      accountId: acc.id,
      currentBalance: Math.round(currentBalance * 100) / 100,
      projectedBalance: Math.round(projectedBalance * 100) / 100,
      monthIncome: Math.round(monthIncome * 100) / 100,
      monthExpense: Math.round(monthExpense * 100) / 100,
    };
  });
}

export function calculateCreditCardSummary(
  card: CreditCard | undefined | null,
  transactions: Transaction[],
  selectedMonth: string
): CreditCardSummary {
  if (!card) {
    return {
      cardId: '',
      invoiceMonth: selectedMonth,
      invoiceTotal: 0,
      invoicePaidAmount: 0,
      invoicePendingAmount: 0,
      isInvoicePaid: false,
      usedLimit: 0,
      availableLimit: 0,
      usagePercent: 0,
      transactions: [],
    };
  }

  const cardAllTx = transactions.filter(
    (tx) =>
      tx.creditCardId === card.id &&
      isCreditCardInvoicePurchase(tx)
  );
  const monthTx = cardAllTx
    .filter((tx) => tx.competenceMonth === selectedMonth)
    .sort((a, b) => b.date.localeCompare(a.date));

  let invoiceTotal = 0;
  let invoicePaidAmount = 0;
  let invoicePendingAmount = 0;

  for (const tx of monthTx) {
    invoiceTotal += tx.amount;
    if (tx.status === 'paid') {
      invoicePaidAmount += tx.amount;
    } else {
      invoicePendingAmount += tx.amount;
    }
  }

  const usedLimit = cardAllTx
    .filter((tx) => tx.status === 'pending')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const availableLimit = Math.max(0, card.limit - usedLimit);
  const usagePercent =
    card.limit > 0 ? Math.min(100, Math.round((usedLimit / card.limit) * 1000) / 10) : 0;

  return {
    cardId: card.id,
    invoiceMonth: selectedMonth,
    invoiceTotal: Math.round(invoiceTotal * 100) / 100,
    invoicePaidAmount: Math.round(invoicePaidAmount * 100) / 100,
    invoicePendingAmount: Math.round(invoicePendingAmount * 100) / 100,
    isInvoicePaid: monthTx.length > 0 && invoicePendingAmount === 0,
    usedLimit: Math.round(usedLimit * 100) / 100,
    availableLimit: Math.round(availableLimit * 100) / 100,
    usagePercent,
    transactions: monthTx,
  };
}

export function payCreditCardInvoice(
  card: CreditCard,
  transactions: Transaction[],
  invoiceMonth: string,
  paymentAccountId: string,
  paymentDate: string,
  customPaymentAmount?: number
): Transaction[] {
  const pendingInMonth = transactions.filter(
    (tx) =>
      tx.creditCardId === card.id &&
      tx.competenceMonth === invoiceMonth &&
      tx.status === 'pending' &&
      isCreditCardInvoicePurchase(tx)
  );

  const totalPending = Math.round(
    pendingInMonth.reduce((sum, tx) => sum + tx.amount, 0) * 100
  ) / 100;

  if (totalPending <= 0) {
    return transactions;
  }

  if (
    customPaymentAmount !== undefined &&
    (!Number.isFinite(customPaymentAmount) ||
      customPaymentAmount <= 0 ||
      customPaymentAmount > totalPending + 0.009)
  ) {
    return transactions;
  }

  const isPartial =
    typeof customPaymentAmount === 'number' &&
    customPaymentAmount > 0 &&
    customPaymentAmount < totalPending - 0.009;

  const targetPayAmount = isPartial
    ? Math.round(customPaymentAmount * 100) / 100
    : totalPending;

  let remainingToSettle = targetPayAmount;
  const updatedTransactions: Transaction[] = [];

  for (const tx of transactions) {
    if (
      tx.creditCardId === card.id &&
      tx.competenceMonth === invoiceMonth &&
      tx.status === 'pending' &&
      isCreditCardInvoicePurchase(tx)
    ) {
      if (!isPartial) {
        updatedTransactions.push({ ...tx, status: 'paid' as TransactionStatus });
      } else if (remainingToSettle <= 0.001) {
        updatedTransactions.push(tx);
      } else if (tx.amount <= remainingToSettle + 0.001) {
        remainingToSettle = Math.round((remainingToSettle - tx.amount) * 100) / 100;
        updatedTransactions.push({ ...tx, status: 'paid' as TransactionStatus });
      } else {
        const paidPart = Math.round(remainingToSettle * 100) / 100;
        const unpaidRemainder = Math.round((tx.amount - paidPart) * 100) / 100;
        const sharedPaidPart =
          tx.sharedAmount === undefined
            ? undefined
            : Math.round((tx.sharedAmount * (paidPart / tx.amount)) * 100) / 100;
        const sharedUnpaidRemainder =
          tx.sharedAmount === undefined
            ? undefined
            : Math.round((tx.sharedAmount - (sharedPaidPart || 0)) * 100) / 100;
        remainingToSettle = 0;
        updatedTransactions.push({
          ...tx,
          id: `${tx.id}-paid-${Date.now()}`,
          description: `${tx.description} (Abatimento Parcial)`,
          amount: paidPart,
          sharedAmount: sharedPaidPart,
          status: 'paid' as TransactionStatus,
          partialSplitOriginalId: tx.id,
        });
        updatedTransactions.push({
          ...tx,
          amount: unpaidRemainder,
          sharedAmount: sharedUnpaidRemainder,
          status: 'pending' as TransactionStatus,
        });
      }
    } else {
      updatedTransactions.push(tx);
    }
  }

  const invoicePaymentTx: Transaction = {
    id: `tx-inv-${card.id}-${invoiceMonth}-${Date.now()}`,
    description: isPartial
      ? `Pagamento Parcial Fatura ${card.name} (${invoiceMonth})`
      : `Pagamento Fatura ${card.name} (${invoiceMonth})`,
    amount: targetPayAmount,
    date: paymentDate,
    competenceMonth: invoiceMonth,
    type: 'expense',
    status: 'paid',
    categoryId: 'cat-fatura',
    accountId: paymentAccountId,
    paymentMethod: 'boleto',
    recurrence: 'single',
    isInvoicePayment: true,
    settledCardId: card.id,
    notes: isPartial
      ? `Abatimento parcial de fatura (${formatBRL(targetPayAmount)} de ${formatBRL(totalPending)})`
      : 'Baixa integral automática de fatura de cartão de crédito',
  };

  return [invoicePaymentTx, ...updatedTransactions];
}

/**
 * Determina automaticamente o mês de competência da fatura do cartão de crédito (`YYYY-MM`)
 * com base na data da compra e no Dia de Fechamento (`closingDay` / "Melhor Dia de Compra"):
 * - Compras realizadas até o dia de fechamento (`day <= closingDay`) entram na fatura do próprio mês.
 * - Compras realizadas após o fechamento (`day > closingDay`) entram automaticamente na fatura do mês seguinte.
 */
export function resolveCreditCardInvoiceMonth(
  purchaseDate: string,
  card?: Pick<CreditCard, 'closingDay'> | null
): string {
  const yearMonth =
    purchaseDate && /^\d{4}-\d{2}/.test(purchaseDate)
      ? purchaseDate.slice(0, 7)
      : new Date().toISOString().slice(0, 7);
  if (!card || !card.closingDay) {
    return yearMonth;
  }
  const dayPart = Number(purchaseDate.slice(8, 10));
  if (Number.isFinite(dayPart) && dayPart > card.closingDay) {
    return addMonthsToYearMonth(yearMonth, 1);
  }
  return yearMonth;
}

/**
 * Calcula o impacto efetivo de uma despesa para o usuário logado:
 * - Ignora pagamentos de fatura (`isInvoicePayment`), transferências (`transfer`) e gastos exclusivos de acompanhantes de viagem (`isCompanionOnlyExpense`).
 * - Para despesas compartilhadas pagas pelo familiar (`sharedPaidBy === 'member'`):
 *   - Enquanto não quitadas (`sharedStatus !== 'received'`), considera APENAS a cota devida pelo usuário (`sharedAmount`) como despesa Pendente (`pending`), nunca o valor integral da nota paga pelo familiar.
 *   - Após quitadas (`sharedStatus === 'received'`), retorna `null` porque o lançamento bancário real de reembolso/acerto (`tx-reimb-`) já consta como despesa Efetivada (`paid`) no extrato, evitando bitributação/duplicidade.
 */
export function getEffectiveExpenseAmountForUser(
  tx: Transaction
): { amount: number; status: TransactionStatus } | null {
  if (
    tx.type !== 'expense' ||
    tx.isInvoicePayment ||
    tx.isCompanionOnlyExpense
  ) {
    return null;
  }

  if (tx.sharedPaidBy === 'member') {
    if (tx.sharedStatus === 'received') {
      return null;
    }
    const myShare = Math.round((tx.sharedAmount || 0) * 100) / 100;
    if (myShare <= 0) {
      return null;
    }
    return {
      amount: myShare,
      status: 'pending',
    };
  }

  return {
    amount: tx.amount,
    status: tx.status,
  };
}

export function calculateMonthlySummary(
  accounts: BankAccount[],
  cards: CreditCard[],
  transactions: Transaction[],
  selectedMonth: string
): MonthlyFinancialSummary {
  const accountBalances = calculateAccountBalances(accounts, transactions, selectedMonth);
  const includedIds = new Set(accounts.filter((a) => a.includeInTotal).map((a) => a.id));

  let totalCurrentBalance = 0;
  let totalProjectedBalance = 0;
  for (const ab of accountBalances) {
    if (includedIds.has(ab.accountId)) {
      totalCurrentBalance += ab.currentBalance;
      totalProjectedBalance += ab.projectedBalance;
    }
  }

  const monthTxs = transactions.filter((tx) => tx.competenceMonth === selectedMonth);

  let incomeRealized = 0;
  let incomePending = 0;
  let expenseRealized = 0;
  let expensePending = 0;
  let creditCardMonthTotal = 0;
  let unsettledMemberSharedThisMonth = 0;

  for (const tx of monthTxs) {
    if (tx.type === 'transfer' || tx.isInvoicePayment || tx.isCompanionOnlyExpense) {
      continue;
    }

    if (tx.type === 'income') {
      if (tx.sharedPaidBy === 'member') continue;
      if (tx.status === 'paid') {
        incomeRealized += tx.amount;
      } else {
        incomePending += tx.amount;
      }
    } else if (tx.type === 'expense') {
      const effectiveExp = getEffectiveExpenseAmountForUser(tx);
      if (!effectiveExp) continue;

      if (tx.creditCardId && tx.sharedPaidBy !== 'member') {
        creditCardMonthTotal += effectiveExp.amount;
      }
      if (tx.sharedPaidBy === 'member') {
        unsettledMemberSharedThisMonth += effectiveExp.amount;
      }
      if (effectiveExp.status === 'paid') {
        expenseRealized += effectiveExp.amount;
      } else {
        expensePending += effectiveExp.amount;
      }
    }
  }

  const unpaidCardInvoicesThisMonth = cards.reduce((acc, card) => {
    const summary = calculateCreditCardSummary(card, transactions, selectedMonth);
    return acc + summary.invoicePendingAmount;
  }, 0);

  totalProjectedBalance -= unpaidCardInvoicesThisMonth + unsettledMemberSharedThisMonth;

  const incomeTotal = Math.round((incomeRealized + incomePending) * 100) / 100;
  const expenseTotal = Math.round((expenseRealized + expensePending) * 100) / 100;
  const netResultProjected = Math.round((incomeTotal - expenseTotal) * 100) / 100;
  const netResultRealized = Math.round((incomeRealized - expenseRealized) * 100) / 100;
  const savingsRateProjected =
    incomeTotal > 0 ? Math.round(((incomeTotal - expenseTotal) / incomeTotal) * 1000) / 10 : 0;

  return {
    month: selectedMonth,
    totalCurrentBalance: Math.round(totalCurrentBalance * 100) / 100,
    totalProjectedBalance: Math.round(totalProjectedBalance * 100) / 100,
    incomeRealized: Math.round(incomeRealized * 100) / 100,
    incomePending: Math.round(incomePending * 100) / 100,
    incomeTotal,
    expenseRealized: Math.round(expenseRealized * 100) / 100,
    expensePending: Math.round(expensePending * 100) / 100,
    expenseTotal,
    creditCardMonthTotal: Math.round(creditCardMonthTotal * 100) / 100,
    netResultProjected,
    netResultRealized,
    savingsRateProjected,
  };
}

export function calculateCategoryBreakdown(
  categories: Category[],
  transactions: Transaction[],
  selectedMonth: string,
  warningThresholdPercent = 80
): CategorySpendItem[] {
  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const monthExpenses: Array<{
    tx: Transaction;
    effectiveAmount: number;
    effectiveStatus: TransactionStatus;
  }> = [];

  for (const tx of transactions) {
    if (tx.competenceMonth !== selectedMonth) continue;
    const eff = getEffectiveExpenseAmountForUser(tx);
    if (!eff) continue;
    monthExpenses.push({
      tx,
      effectiveAmount: eff.amount,
      effectiveStatus: eff.status,
    });
  }

  const totalMonthExpense = monthExpenses.reduce(
    (sum, item) => sum + item.effectiveAmount,
    0
  );
  const thresholdRatio = Math.max(50, Math.min(99, warningThresholdPercent)) / 100;

  return expenseCategories
    .map((cat) => {
      const catItems = monthExpenses.filter((item) => item.tx.categoryId === cat.id);
      const realizedSpent = catItems
        .filter((item) => item.effectiveStatus === 'paid')
        .reduce((sum, item) => sum + item.effectiveAmount, 0);
      const pendingSpent = catItems
        .filter((item) => item.effectiveStatus === 'pending')
        .reduce((sum, item) => sum + item.effectiveAmount, 0);
      const spent = Math.round((realizedSpent + pendingSpent) * 100) / 100;
      const percentOfBudget =
        cat.monthlyBudget > 0 ? Math.round((spent / cat.monthlyBudget) * 1000) / 10 : 0;
      const percentOfTotalExpense =
        totalMonthExpense > 0 ? Math.round((spent / totalMonthExpense) * 1000) / 10 : 0;

      let status: 'ok' | 'warning' | 'over' = 'ok';
      if (cat.monthlyBudget > 0) {
        if (spent > cat.monthlyBudget) status = 'over';
        else if (spent >= cat.monthlyBudget * thresholdRatio) status = 'warning';
      }

      const subMap = new Map<string, number>();
      for (const item of catItems) {
        const subId = item.tx.subcategoryId || 'unassigned';
        subMap.set(subId, (subMap.get(subId) || 0) + item.effectiveAmount);
      }

      const subcategoryBreakdown: SubcategorySpendItem[] = [];
      for (const sub of cat.subcategories || []) {
        const subSpent = Math.round((subMap.get(sub.id) || 0) * 100) / 100;
        if (subSpent > 0) {
          subcategoryBreakdown.push({
            subcategoryId: sub.id,
            subcategoryName: sub.name,
            spent: subSpent,
            percentOfCategory: spent > 0 ? Math.round((subSpent / spent) * 1000) / 10 : 0,
          });
        }
      }
      const unassignedSpent = Math.round((subMap.get('unassigned') || 0) * 100) / 100;
      if (unassignedSpent > 0 && (cat.subcategories?.length || 0) > 0) {
        subcategoryBreakdown.push({
          subcategoryId: 'unassigned',
          subcategoryName: 'Geral / Sem Subcategoria',
          spent: unassignedSpent,
          percentOfCategory: spent > 0 ? Math.round((unassignedSpent / spent) * 1000) / 10 : 0,
        });
      }

      subcategoryBreakdown.sort((a, b) => b.spent - a.spent);

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryColor: cat.color || '#1e293b',
        categoryIcon: cat.icon || 'tag',
        bucket: cat.bucket,
        spent,
        realizedSpent: Math.round(realizedSpent * 100) / 100,
        pendingSpent: Math.round(pendingSpent * 100) / 100,
        budget: cat.monthlyBudget,
        percentOfBudget,
        percentOfTotalExpense,
        status,
        subcategoryBreakdown,
      };
    })
    .sort((a, b) => b.spent - a.spent);
}

export function getBudgetAlerts(items: CategorySpendItem[]): CategorySpendItem[] {
  return items
    .filter((i) => i.budget > 0 && (i.status === 'over' || i.status === 'warning'))
    .sort((a, b) => b.percentOfBudget - a.percentOfBudget);
}

export interface Rule503020Summary {
  incomeBase: number;
  essentialSpent: number;
  essentialPercent: number;
  essentialTarget: number;
  lifestyleSpent: number;
  lifestylePercent: number;
  lifestyleTarget: number;
  financialSavings: number;
  financialPercent: number;
  financialTarget: number;
}

export function calculate503020Rule(
  categories: Category[],
  transactions: Transaction[],
  selectedMonth: string
): Rule503020Summary {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const monthTxs = transactions.filter(
    (tx) =>
      tx.competenceMonth === selectedMonth &&
      !tx.isInvoicePayment &&
      !tx.isCompanionOnlyExpense
  );

  let incomeBase = 0;
  let essentialSpent = 0;
  let lifestyleSpent = 0;
  let financialExpense = 0;

  for (const tx of monthTxs) {
    if (tx.type === 'income') {
      if (tx.sharedPaidBy === 'member') continue;
      incomeBase += tx.amount;
    } else if (tx.type === 'expense') {
      const eff = getEffectiveExpenseAmountForUser(tx);
      if (!eff) continue;
      const cat = catMap.get(tx.categoryId);
      const bucket = cat?.bucket || 'essential';
      if (bucket === 'essential') essentialSpent += eff.amount;
      else if (bucket === 'lifestyle') lifestyleSpent += eff.amount;
      else financialExpense += eff.amount;
    }
  }

  const totalOut = essentialSpent + lifestyleSpent;
  const unallocatedSurplus = Math.max(0, incomeBase - totalOut - financialExpense);
  const financialSavings = Math.round((financialExpense + unallocatedSurplus) * 100) / 100;

  const safeIncome = incomeBase > 0 ? incomeBase : 1;

  return {
    incomeBase: Math.round(incomeBase * 100) / 100,
    essentialSpent: Math.round(essentialSpent * 100) / 100,
    essentialPercent:
      incomeBase > 0 ? Math.round((essentialSpent / safeIncome) * 1000) / 10 : 0,
    essentialTarget: Math.round(incomeBase * 0.5 * 100) / 100,
    lifestyleSpent: Math.round(lifestyleSpent * 100) / 100,
    lifestylePercent:
      incomeBase > 0 ? Math.round((lifestyleSpent / safeIncome) * 1000) / 10 : 0,
    lifestyleTarget: Math.round(incomeBase * 0.3 * 100) / 100,
    financialSavings,
    financialPercent:
      incomeBase > 0 ? Math.round((financialSavings / safeIncome) * 1000) / 10 : 0,
    financialTarget: Math.round(incomeBase * 0.2 * 100) / 100,
  };
}

export function calculatePeriodReport(
  accounts: BankAccount[],
  cards: CreditCard[],
  categories: Category[],
  transactions: Transaction[],
  startMonth: string,
  endMonth: string
): PeriodReportSummary {
  const months = getMonthRange(startMonth, endMonth);
  const monthSet = new Set(months);

  const periodTxs = transactions.filter(
    (tx) =>
      monthSet.has(tx.competenceMonth) &&
      !tx.isInvoicePayment &&
      tx.type !== 'transfer' &&
      !tx.isCompanionOnlyExpense
  );

  const expenseTxs: Transaction[] = [];
  for (const tx of periodTxs) {
    if (tx.type !== 'expense') continue;
    const eff = getEffectiveExpenseAmountForUser(tx);
    if (!eff) continue;
    expenseTxs.push(
      eff.amount === tx.amount ? tx : { ...tx, amount: eff.amount, status: eff.status }
    );
  }
  const incomeTxs = periodTxs.filter(
    (tx) => tx.type === 'income' && tx.sharedPaidBy !== 'member'
  );

  const totalExpense = Math.round(
    expenseTxs.reduce((sum, tx) => sum + tx.amount, 0) * 100
  ) / 100;
  const totalIncome = Math.round(
    incomeTxs.reduce((sum, tx) => sum + tx.amount, 0) * 100
  ) / 100;

  const catMap = new Map(categories.map((c) => [c.id, c]));

  // Group expenses by category
  const expByCatMap = new Map<string, Transaction[]>();
  for (const tx of expenseTxs) {
    const list = expByCatMap.get(tx.categoryId) || [];
    list.push(tx);
    expByCatMap.set(tx.categoryId, list);
  }

  const expensesByCategory: ReportDistributionSlice[] = Array.from(expByCatMap.entries())
    .map(([catId, txs]) => {
      const cat = catMap.get(catId);
      const amount = Math.round(txs.reduce((s, t) => s + t.amount, 0) * 100) / 100;
      const percent = totalExpense > 0 ? Math.round((amount / totalExpense) * 1000) / 10 : 0;

      const subTotals = new Map<string, number>();
      for (const t of txs) {
        const subId = t.subcategoryId || 'unassigned';
        subTotals.set(subId, (subTotals.get(subId) || 0) + t.amount);
      }

      const subNameMap = new Map(
        (cat?.subcategories || []).map((s) => [s.id, s.name])
      );

      const subcategories = Array.from(subTotals.entries())
        .map(([subId, subAmt]) => ({
          id: subId,
          name: subNameMap.get(subId) || 'Geral / Sem Subcategoria',
          amount: Math.round(subAmt * 100) / 100,
          percent: amount > 0 ? Math.round((subAmt / amount) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      return {
        id: catId,
        name: cat?.name || 'Outras Despesas',
        color: cat?.color || '#64748b',
        icon: cat?.icon || 'tag',
        amount,
        percent,
        count: txs.length,
        subcategories,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // Group incomes by category/source
  const incByCatMap = new Map<string, Transaction[]>();
  for (const tx of incomeTxs) {
    const list = incByCatMap.get(tx.categoryId) || [];
    list.push(tx);
    incByCatMap.set(tx.categoryId, list);
  }

  const incomesBySource: ReportDistributionSlice[] = Array.from(incByCatMap.entries())
    .map(([catId, txs]) => {
      const cat = catMap.get(catId);
      const amount = Math.round(txs.reduce((s, t) => s + t.amount, 0) * 100) / 100;
      const percent = totalIncome > 0 ? Math.round((amount / totalIncome) * 1000) / 10 : 0;

      const subTotals = new Map<string, number>();
      for (const t of txs) {
        const subId = t.subcategoryId || 'unassigned';
        subTotals.set(subId, (subTotals.get(subId) || 0) + t.amount);
      }
      const subNameMap = new Map(
        (cat?.subcategories || []).map((s) => [s.id, s.name])
      );
      const subcategories = Array.from(subTotals.entries())
        .map(([subId, subAmt]) => ({
          id: subId,
          name: subNameMap.get(subId) || 'Receita Direta',
          amount: Math.round(subAmt * 100) / 100,
          percent: amount > 0 ? Math.round((subAmt / amount) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      return {
        id: catId,
        name: cat?.name || 'Outras Receitas',
        color: cat?.color || '#059669',
        icon: cat?.icon || 'briefcase',
        amount,
        percent,
        count: txs.length,
        subcategories,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // Monthly Comparative Series
  const monthlySeries: MonthlyComparisonRow[] = [];
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const summary = calculateMonthlySummary(accounts, cards, transactions, m);
    const prev = i > 0 ? monthlySeries[i - 1] : null;

    const expenseDeltaPercent =
      prev && prev.expense > 0
        ? Math.round(((summary.expenseTotal - prev.expense) / prev.expense) * 1000) / 10
        : null;
    const incomeDeltaPercent =
      prev && prev.income > 0
        ? Math.round(((summary.incomeTotal - prev.income) / prev.income) * 1000) / 10
        : null;

    monthlySeries.push({
      month: m,
      label: formatMonthYearPT(m),
      shortLabel: formatShortMonthPT(m),
      income: summary.incomeTotal,
      expense: summary.expenseTotal,
      netSavings: summary.netResultProjected,
      savingsRate: summary.savingsRateProjected,
      cumulativeBalance: summary.totalProjectedBalance,
      expenseDeltaPercent,
      incomeDeltaPercent,
    });
  }

  const monthsCount = Math.max(1, months.length);
  const netSavings = Math.round((totalIncome - totalExpense) * 100) / 100;
  const savingsRate =
    totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 1000) / 10 : 0;
  const endingBalance =
    monthlySeries.length > 0
      ? monthlySeries[monthlySeries.length - 1].cumulativeBalance
      : 0;

  return {
    startMonth: months[0] || startMonth,
    endMonth: months[months.length - 1] || endMonth,
    monthsCount,
    totalIncome,
    totalExpense,
    netSavings,
    averageMonthlyIncome: Math.round((totalIncome / monthsCount) * 100) / 100,
    averageMonthlyExpense: Math.round((totalExpense / monthsCount) * 100) / 100,
    savingsRate,
    endingBalance,
    expensesByCategory,
    incomesBySource,
    monthlySeries,
  };
}

export function calculateDailyCashFlow(
  accounts: BankAccount[],
  transactions: Transaction[],
  selectedMonth: string
): DailyCashFlowPoint[] {
  const [yStr, mStr] = selectedMonth.split('-');
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  const prevMonth = addMonthsToYearMonth(selectedMonth, -1);
  const openingBalances = calculateAccountBalances(accounts, transactions, prevMonth);
  const includedIds = new Set(accounts.filter((a) => a.includeInTotal).map((a) => a.id));

  let runningRealized = openingBalances
    .filter((b) => includedIds.has(b.accountId))
    .reduce((sum, b) => sum + b.currentBalance, 0);
  let runningProjected = runningRealized;

  const monthBankTxs = transactions.filter(
    (tx) =>
      tx.competenceMonth === selectedMonth &&
      (!tx.creditCardId || tx.isInvoicePayment) &&
      !tx.isCompanionOnlyExpense &&
      tx.sharedPaidBy !== 'member'
  );

  const points: DailyCashFlowPoint[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
    const dayTxs = monthBankTxs.filter((tx) => tx.date === dayStr);

    let dayIncome = 0;
    let dayExpense = 0;

    for (const tx of dayTxs) {
      const isAccountIncluded = !tx.accountId || includedIds.has(tx.accountId);

      if (tx.type === 'income') {
        if (!isAccountIncluded) continue;
        dayIncome += tx.amount;
        runningProjected += tx.amount;
        if (tx.status === 'paid') runningRealized += tx.amount;
      } else if (tx.type === 'expense') {
        if (!isAccountIncluded) continue;
        dayExpense += tx.amount;
        runningProjected -= tx.amount;
        if (tx.status === 'paid') runningRealized -= tx.amount;
      } else if (tx.type === 'transfer') {
        const fromIncluded = Boolean(tx.accountId && includedIds.has(tx.accountId));
        const toIncluded = Boolean(
          tx.destinationAccountId && includedIds.has(tx.destinationAccountId)
        );
        // Transfer out of liquid included accounts (e.g., direct investment contribution or transfer to excluded account)
        if (fromIncluded && !toIncluded) {
          runningProjected -= tx.amount;
          if (tx.status === 'paid') runningRealized -= tx.amount;
        } else if (!fromIncluded && toIncluded) {
          runningProjected += tx.amount;
          if (tx.status === 'paid') runningRealized += tx.amount;
        }
      }
    }

    points.push({
      day: d,
      date: dayStr,
      income: Math.round(dayIncome * 100) / 100,
      expense: Math.round(dayExpense * 100) / 100,
      cumulativeBalance: Math.round(runningRealized * 100) / 100,
      projectedBalance: Math.round(runningProjected * 100) / 100,
    });
  }

  return points;
}

export interface FixedIncomeSimulationResult {
  months: number;
  totalInvested: number;
  grossBalanceCdi: number;
  irRatePercent: number;
  irTaxAmount: number;
  netBalanceCdi: number;
  netYieldCdi: number;
  poupancaBalance: number;
  advantageOverPoupanca: number;
}

export function getBrazilianIrRate(months: number): number {
  const approxDays = months * 30;
  if (approxDays <= 180) return 22.5;
  if (approxDays <= 360) return 20.0;
  if (approxDays <= 720) return 17.5;
  return 15.0;
}

export function simulateFixedIncomeBR(params: {
  initialAmount: number;
  monthlyContribution: number;
  months: number;
  cdiAnnualRatePercent: number;
  cdiMultiplierPercent: number;
  isTaxExempt?: boolean;
}): FixedIncomeSimulationResult {
  const {
    initialAmount,
    monthlyContribution,
    months,
    cdiAnnualRatePercent,
    cdiMultiplierPercent,
    isTaxExempt = false,
  } = params;

  const safeMonths = Math.max(1, Math.min(360, Math.floor(months)));
  const effectiveAnnualRate = (cdiAnnualRatePercent / 100) * (cdiMultiplierPercent / 100);
  const monthlyRateCdi = Math.pow(1 + effectiveAnnualRate, 1 / 12) - 1;
  const monthlyRatePoupanca = 0.0057;

  let grossCdi = initialAmount;
  let poupanca = initialAmount;

  for (let m = 0; m < safeMonths; m++) {
    grossCdi = grossCdi * (1 + monthlyRateCdi) + monthlyContribution;
    poupanca = poupanca * (1 + monthlyRatePoupanca) + monthlyContribution;
  }

  const totalInvested = Math.round((initialAmount + monthlyContribution * safeMonths) * 100) / 100;
  const grossYield = Math.max(0, grossCdi - totalInvested);
  const irRatePercent = isTaxExempt ? 0 : getBrazilianIrRate(safeMonths);
  const irTaxAmount = Math.round(grossYield * (irRatePercent / 100) * 100) / 100;
  const netBalanceCdi = Math.round((grossCdi - irTaxAmount) * 100) / 100;
  const netYieldCdi = Math.round((netBalanceCdi - totalInvested) * 100) / 100;
  const poupancaBalance = Math.round(poupanca * 100) / 100;

  return {
    months: safeMonths,
    totalInvested,
    grossBalanceCdi: Math.round(grossCdi * 100) / 100,
    irRatePercent,
    irTaxAmount,
    netBalanceCdi,
    netYieldCdi,
    poupancaBalance,
    advantageOverPoupanca: Math.round((netBalanceCdi - poupancaBalance) * 100) / 100,
  };
}

export function exportTransactionsToCSV(
  transactions: Transaction[],
  categories: Category[],
  accounts: BankAccount[],
  cards: CreditCard[]
): string {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const accMap = new Map(accounts.map((a) => [a.id, a.name]));
  const cardMap = new Map(cards.map((c) => [c.id, c.name]));

  const headers = [
    'Data',
    'Competencia',
    'Descricao',
    'Tipo',
    'Status',
    'Categoria',
    'Subcategoria',
    'Conta_ou_Cartao',
    'Parcela',
    'Valor_BRL',
  ];

  const rows = transactions.map((tx) => {
    const tipoLabel =
      tx.type === 'income' ? 'Receita' : tx.type === 'expense' ? 'Despesa' : 'Transferencia';
    const statusLabel = tx.status === 'paid' ? 'Efetivado' : 'Pendente';
    const cat = catMap.get(tx.categoryId);
    const catName = cat?.name || 'Outros';
    const subName =
      cat?.subcategories?.find((s) => s.id === tx.subcategoryId)?.name || 'Geral';
    const originName = tx.creditCardId
      ? `Cartao: ${cardMap.get(tx.creditCardId) || tx.creditCardId}`
      : accMap.get(tx.accountId || '') || 'Carteira';
    const parcela =
      tx.installmentTotal && tx.installmentTotal > 1
        ? `${tx.installmentNumber}/${tx.installmentTotal}`
        : 'Unico';
    const valorSigned = tx.type === 'expense' ? -tx.amount : tx.amount;

    return [
      tx.date,
      tx.competenceMonth,
      `"${tx.description.replace(/"/g, '""')}"`,
      tipoLabel,
      statusLabel,
      `"${catName}"`,
      `"${subName}"`,
      `"${originName}"`,
      parcela,
      valorSigned.toFixed(2).replace('.', ','),
    ].join(';');
  });

  return [headers.join(';'), ...rows].join('\n');
}

export function normalizeSearchText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export interface GlobalSearchMatchItem {
  transaction: Transaction;
  matchedByDescription: boolean;
  matchedByCategory: boolean;
  matchedByNote: boolean;
  matchedByTag?: boolean;
  categoryName: string;
  subcategoryName?: string;
}

export interface GlobalSearchFilterOptions {
  query: string;
  scope?: 'all_months' | 'selected_month';
  selectedMonth?: string;
  typeFilter?: 'all' | 'expense' | 'income' | 'credit_card' | 'shared';
  fieldFilter?: 'all' | 'description' | 'category' | 'notes';
}

export interface GlobalSearchSummary {
  totalCount: number;
  incomeTotal: number;
  expenseTotal: number;
  netTotal: number;
  pendingCount: number;
  matchedByDescriptionCount: number;
  matchedByCategoryCount: number;
  matchedByNoteCount: number;
}

export function searchTransactionsGlobal(
  transactions: Transaction[],
  categories: Category[],
  options: GlobalSearchFilterOptions
): GlobalSearchMatchItem[] {
  const normalizedQuery = normalizeSearchText(options.query).replace(/#/g, '');
  if (!normalizedQuery) return [];

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const scope = options.scope || 'all_months';
  const typeFilter = options.typeFilter || 'all';
  const fieldFilter = options.fieldFilter || 'all';

  const matches: GlobalSearchMatchItem[] = [];

  for (const tx of transactions) {
    if (scope === 'selected_month' && options.selectedMonth) {
      if (tx.competenceMonth !== options.selectedMonth) continue;
    }

    if (typeFilter === 'expense' && (tx.type !== 'expense' || Boolean(tx.creditCardId))) {
      continue;
    }
    if (typeFilter === 'income' && tx.type !== 'income') {
      continue;
    }
    if (typeFilter === 'credit_card' && !tx.creditCardId) {
      continue;
    }
    if (typeFilter === 'shared' && !tx.isShared) {
      continue;
    }

    const cat = catMap.get(tx.categoryId);
    const categoryName = cat?.name || 'Outros';
    const subcategoryName = cat?.subcategories?.find(
      (s) => s.id === tx.subcategoryId
    )?.name;

    const normDesc = normalizeSearchText(tx.description);
    const normCat = normalizeSearchText(
      subcategoryName ? `${categoryName} ${subcategoryName}` : categoryName
    );
    const normTags = normalizeSearchText((tx.tags || []).join(' '));
    const normNote = normalizeSearchText(
      [tx.notes || '', ...(tx.tags || [])].join(' ')
    );

    const matchedByDescription = tokens.every((tk) => normDesc.includes(tk));
    const matchedByCategory = tokens.every((tk) => normCat.includes(tk));
    const matchedByTag = Boolean(normTags) && tokens.every((tk) => normTags.includes(tk));
    const matchedByNote = tokens.every((tk) => normNote.includes(tk));

    // Also allow combined multi-token match across fields when fieldFilter is 'all'
    const combinedText = `${normDesc} ${normCat} ${normNote}`;
    const matchedCombined = tokens.every((tk) => combinedText.includes(tk));

    let isMatch = false;
    if (fieldFilter === 'description') {
      isMatch = matchedByDescription;
    } else if (fieldFilter === 'category') {
      isMatch = matchedByCategory;
    } else if (fieldFilter === 'notes') {
      isMatch = matchedByNote;
    } else {
      isMatch =
        matchedByDescription ||
        matchedByCategory ||
        matchedByNote ||
        matchedCombined;
    }

    if (isMatch) {
      matches.push({
        transaction: tx,
        matchedByDescription:
          matchedByDescription ||
          (!matchedByCategory && !matchedByNote && tokens.some((tk) => normDesc.includes(tk))),
        matchedByCategory:
          matchedByCategory ||
          (!matchedByDescription && !matchedByNote && tokens.some((tk) => normCat.includes(tk))),
        matchedByNote:
          matchedByNote ||
          (!matchedByDescription && !matchedByCategory && tokens.some((tk) => normNote.includes(tk))),
        matchedByTag:
          matchedByTag ||
          (Boolean(normTags) && tokens.some((tk) => normTags.includes(tk))),
        categoryName,
        subcategoryName,
      });
    }
  }

  return matches.sort((a, b) => b.transaction.date.localeCompare(a.transaction.date));
}

export function summarizeGlobalSearchResults(
  items: GlobalSearchMatchItem[]
): GlobalSearchSummary {
  let incomeTotal = 0;
  let expenseTotal = 0;
  let pendingCount = 0;
  let matchedByDescriptionCount = 0;
  let matchedByCategoryCount = 0;
  let matchedByNoteCount = 0;

  for (const item of items) {
    const tx = item.transaction;
    if (!tx.isInvoicePayment && tx.type !== 'transfer') {
      if (tx.type === 'income' && tx.sharedPaidBy !== 'member') {
        incomeTotal += tx.amount;
      } else if (tx.type === 'expense') {
        const eff = getEffectiveExpenseAmountForUser(tx);
        if (eff) {
          expenseTotal += eff.amount;
        }
      }
    }
    if (tx.status === 'pending' || (tx.sharedPaidBy === 'member' && tx.sharedStatus !== 'received')) {
      pendingCount += 1;
    }
    if (item.matchedByDescription) matchedByDescriptionCount += 1;
    if (item.matchedByCategory) matchedByCategoryCount += 1;
    if (item.matchedByNote) matchedByNoteCount += 1;
  }

  return {
    totalCount: items.length,
    incomeTotal: Math.round(incomeTotal * 100) / 100,
    expenseTotal: Math.round(expenseTotal * 100) / 100,
    netTotal: Math.round((incomeTotal - expenseTotal) * 100) / 100,
    pendingCount,
    matchedByDescriptionCount,
    matchedByCategoryCount,
    matchedByNoteCount,
  };
}

export type CascadeScope = 'single' | 'this_and_future' | 'all_series';

/**
 * Estorna um pagamento de fatura de cartão de crédito (`isInvoicePayment: true`) refazendo todo o Efeito Cascata:
 * 1. Remove o débito bancário do pagamento da fatura (devolvendo o saldo imediatamente à conta corrente).
 * 2. Recompõe eventuais parcelas divididas por pagamento parcial (`partialSplitOriginalId`).
 * 3. Reabre as compras do cartão naquela competência de volta para `pending`, recompondo o limite utilizado e a fatura em aberto.
 */
export function reverseCreditCardInvoicePayment(
  transactions: Transaction[],
  invoicePaymentTxId: string,
  cards: CreditCard[] = []
): {
  updatedTransactions: Transaction[];
  restoredCardCount: number;
  restoredCardName: string;
  actionDescription: string;
} {
  const target = transactions.find((t) => t.id === invoicePaymentTxId);
  if (!target || !target.isInvoicePayment) {
    return {
      updatedTransactions: transactions,
      restoredCardCount: 0,
      restoredCardName: '',
      actionDescription: '',
    };
  }

  const matchedCard =
    cards.find((c) => c.id === target.settledCardId) ||
    cards.find((c) => target.description.toLowerCase().includes(c.name.toLowerCase())) ||
    cards.find((c) => target.id.includes(c.id));

  const targetCardId = target.settledCardId || matchedCard?.id;
  const cardName = matchedCard?.name || 'Cartão de Crédito';

  // Detect any partial split rows in this competence month for this card
  const partialSplitSums = new Map<string, number>();
  const partialSplitSharedSums = new Map<string, number>();
  const partialSplitIdsToRemove = new Set<string>();

  for (const tx of transactions) {
    if (
      tx.competenceMonth === target.competenceMonth &&
      (!targetCardId || tx.creditCardId === targetCardId) &&
      (tx.partialSplitOriginalId || tx.id.includes('-paid-'))
    ) {
      const origId =
        tx.partialSplitOriginalId || tx.id.split('-paid-')[0];
      partialSplitSums.set(origId, (partialSplitSums.get(origId) || 0) + tx.amount);
      if (tx.sharedAmount !== undefined) {
        partialSplitSharedSums.set(
          origId,
          (partialSplitSharedSums.get(origId) || 0) + tx.sharedAmount
        );
      }
      partialSplitIdsToRemove.add(tx.id);
    }
  }

  let restoredCardCount = 0;

  const updatedTransactions = transactions
    .filter((t) => t.id !== target.id && !partialSplitIdsToRemove.has(t.id))
    .map((t) => {
      if (
        !t.isInvoicePayment &&
        t.competenceMonth === target.competenceMonth &&
        (targetCardId ? t.creditCardId === targetCardId : Boolean(t.creditCardId))
      ) {
        const extraFromPartial = partialSplitSums.get(t.id) || 0;
        const extraSharedFromPartial = partialSplitSharedSums.get(t.id);
        if (t.status === 'paid' || extraFromPartial > 0) {
          restoredCardCount += 1;
          return {
            ...t,
            amount: Math.round((t.amount + extraFromPartial) * 100) / 100,
            sharedAmount:
              t.sharedAmount === undefined && extraSharedFromPartial === undefined
                ? undefined
                : Math.round(((t.sharedAmount || 0) + (extraSharedFromPartial || 0)) * 100) / 100,
            status: 'pending' as TransactionStatus,
          };
        }
      }
      return t;
    });

  return {
    updatedTransactions,
    restoredCardCount,
    restoredCardName: cardName,
    actionDescription: `Efeito Cascata refeito: Pagamento de ${formatBRL(
      target.amount
    )} da fatura ${cardName} estornado! O saldo voltou para a conta e ${restoredCardCount} compra(s) do cartão reabriram como Pendentes.`,
  };
}

/**
 * Alterna o status (Pago <-> Pendente) de um lançamento ou série.
 * Se for um pagamento de fatura de cartão (`isInvoicePayment: true`), reverter faz o estorno em cascata:
 * remove o débito da conta bancária e reabre as compras do cartão naquele mês de volta para `pending`.
 */
export function toggleTransactionStatusWithCascade(
  transactions: Transaction[],
  targetId: string,
  cards: CreditCard[] = [],
  scope: CascadeScope = 'single'
): {
  updatedTransactions: Transaction[];
  actionDescription: string;
} {
  const target = transactions.find((t) => t.id === targetId);
  if (!target) {
    return { updatedTransactions: transactions, actionDescription: '' };
  }

  // Caso especial: Estorno em Cascata de Pagamento de Fatura de Cartão
  if (target.isInvoicePayment) {
    const rev = reverseCreditCardInvoicePayment(transactions, target.id, cards);
    return {
      updatedTransactions: rev.updatedTransactions,
      actionDescription: rev.actionDescription,
    };
  }

  const nextStatus: TransactionStatus =
    target.status === 'paid' ? 'pending' : 'paid';

  const groupId = target.installmentGroupId;
  const shouldCascade = scope !== 'single' && Boolean(groupId);

  let affectedCount = 0;
  const updatedTransactions = transactions.map((tx) => {
    if (tx.id === target.id) {
      affectedCount++;
      return { ...tx, status: nextStatus };
    }
    if (shouldCascade && groupId && tx.installmentGroupId === groupId) {
      if (
        scope === 'all_series' ||
        (scope === 'this_and_future' && tx.competenceMonth >= target.competenceMonth)
      ) {
        affectedCount++;
        return { ...tx, status: nextStatus };
      }
    }
    return tx;
  });

  const actionDescription =
    nextStatus === 'paid'
      ? affectedCount > 1
        ? `${affectedCount} lançamentos da série marcados como Efetivados (Pagos)!`
        : `"${target.description}" marcado como Efetivado (Pago)!`
      : affectedCount > 1
      ? `${affectedCount} lançamentos revertidos para Pendente (Previsto)!`
      : `"${target.description}" revertido para Pendente! O saldo da conta foi recalculado.`;

  return { updatedTransactions, actionDescription };
}

/**
 * Aplica a edição de um lançamento com suporte a Efeito Cascata:
 * - 'single': altera apenas o lançamento selecionado
 * - 'this_and_future': altera este e todos os meses seguintes da mesma série (parcelas ou fixos)
 * - 'all_series': altera todos os lançamentos da série (passados e futuros)
 */
export function applyCascadeTransactionEdit(
  transactions: Transaction[],
  editedTx: Transaction,
  scope: CascadeScope = 'single'
): {
  updatedTransactions: Transaction[];
  affectedCount: number;
} {
  const original = transactions.find((t) => t.id === editedTx.id);
  if (!original || scope === 'single' || !original.installmentGroupId) {
    return {
      updatedTransactions: transactions.map((t) =>
        t.id === editedTx.id ? editedTx : t
      ),
      affectedCount: 1,
    };
  }

  const groupId = original.installmentGroupId;
  let affectedCount = 0;

  const updatedTransactions = transactions.map((tx) => {
    if (tx.id === editedTx.id) {
      affectedCount++;
      return editedTx;
    }

    if (tx.installmentGroupId === groupId) {
      const inScope =
        scope === 'all_series' ||
        (scope === 'this_and_future' &&
          tx.competenceMonth >= original.competenceMonth);

      if (inScope) {
        affectedCount++;
        return {
          ...tx,
          description: editedTx.description,
          amount: editedTx.amount,
          categoryId: editedTx.categoryId,
          subcategoryId: editedTx.subcategoryId,
          accountId: editedTx.accountId,
          destinationAccountId: editedTx.destinationAccountId,
          creditCardId: editedTx.creditCardId,
          paymentMethod: editedTx.paymentMethod,
          notes: editedTx.notes,
          tags: editedTx.tags,
        };
      }
    }
    return tx;
  });

  return { updatedTransactions, affectedCount };
}

/**
 * Exclui um lançamento isoladamente ou em Efeito Cascata:
 * - Se for um pagamento de fatura (`isInvoicePayment: true`), refaz automaticamente o Efeito Cascata:
 *   devolve o saldo para a conta bancária e reabre todas as compras da fatura do cartão naquele mês como Pendentes.
 * - Se for um reembolso de despesa compartilhada (`tx-reimb-`), reabre as despesas compartilhadas vinculadas como Pendentes.
 * - Se for uma série parcelada/recorrente com escopo de série, remove os lançamentos vinculados.
 */
export function applyCascadeTransactionDelete(
  transactions: Transaction[],
  targetId: string,
  scope: CascadeScope = 'single',
  cards: CreditCard[] = []
): {
  updatedTransactions: Transaction[];
  deletedCount: number;
  cascadeReopenedCount?: number;
  actionDescription?: string;
} {
  const target = transactions.find((t) => t.id === targetId);
  if (!target) {
    return { updatedTransactions: transactions, deletedCount: 0 };
  }

  // 1. Efeito Cascata Automático ao apagar um Pagamento de Fatura de Cartão
  if (target.isInvoicePayment) {
    const rev = reverseCreditCardInvoicePayment(transactions, target.id, cards);
    return {
      updatedTransactions: rev.updatedTransactions,
      deletedCount: 1,
      cascadeReopenedCount: rev.restoredCardCount,
      actionDescription: rev.actionDescription,
    };
  }

  // 2. Efeito Cascata Automático ao apagar um Reembolso de Despesa Compartilhada
  if (target.id.startsWith('tx-reimb-')) {
    let reopenedShared = 0;
    const updatedTransactions = transactions
      .filter((t) => t.id !== target.id)
      .map((t) => {
        const isDirectRef = Boolean(target.notes && target.notes.includes(`[ref:${t.id}]`));
        if (
          t.isShared &&
          t.sharedStatus === 'received' &&
          (isDirectRef ||
            (t.competenceMonth === target.competenceMonth &&
              t.sharedSettledDate === target.date))
        ) {
          reopenedShared += 1;
          return {
            ...t,
            sharedStatus: 'pending' as const,
            sharedSettledDate: undefined,
            sharedSettledAccountId: undefined,
          };
        }
        return t;
      });

    return {
      updatedTransactions,
      deletedCount: 1,
      cascadeReopenedCount: reopenedShared,
      actionDescription:
        reopenedShared > 0
          ? `Reembolso excluído e efeito cascata refeito: ${reopenedShared} despesa(s) compartilhada(s) voltaram para Pendente!`
          : 'Lançamento de reembolso removido.',
    };
  }

  if (scope === 'single' || !target.installmentGroupId) {
    const siblingSharedIdsToReopen = new Set<string>();
    const filteredList = transactions.filter((t) => {
      if (t.id === targetId) return false;
      if (
        target.isShared &&
        t.id.startsWith('tx-reimb-') &&
        (t.notes?.includes(`[ref:${target.id}]`) ||
          (!t.id.startsWith('tx-reimb-all-') &&
            t.description.includes(`(${target.description})`) &&
            t.date === target.sharedSettledDate))
      ) {
        if (t.id.startsWith('tx-reimb-all-') && t.notes) {
          const matches = t.notes.matchAll(/\[ref:([^\]]+)\]/g);
          for (const m of matches) {
            if (m[1] && m[1] !== target.id) {
              siblingSharedIdsToReopen.add(m[1]);
            }
          }
        }
        return false;
      }
      return true;
    }).map((t) => {
      if (siblingSharedIdsToReopen.has(t.id) && t.isShared && t.sharedStatus === 'received') {
        return {
          ...t,
          sharedStatus: 'pending' as const,
          sharedSettledDate: undefined,
          sharedSettledAccountId: undefined,
        };
      }
      return t;
    });
    return {
      updatedTransactions: filteredList,
      deletedCount: transactions.length - filteredList.length,
      cascadeReopenedCount: siblingSharedIdsToReopen.size,
      actionDescription: `Lançamento "${target.description}" removido.`,
    };
  }

  const groupId = target.installmentGroupId;
  let deletedCount = 0;

  const updatedTransactions = transactions.filter((tx) => {
    if (tx.id === target.id) {
      deletedCount++;
      return false;
    }
    if (tx.installmentGroupId === groupId) {
      if (
        scope === 'all_series' ||
        (scope === 'this_and_future' && tx.competenceMonth >= target.competenceMonth)
      ) {
        deletedCount++;
        return false;
      }
    }
    return true;
  });

  return {
    updatedTransactions,
    deletedCount,
    actionDescription:
      deletedCount > 1
        ? `Efeito Cascata: ${deletedCount} lançamentos da série "${target.description}" removidos.`
        : `Lançamento "${target.description}" removido.`,
  };
}

export interface SixMonthComparativePoint extends MonthlyComparisonRow {
  isSurplus: boolean;
  healthStatus: 'surplus' | 'balanced' | 'deficit';
}

export interface SixMonthComparativeSummary {
  startMonth: string;
  endMonth: string;
  months: SixMonthComparativePoint[];
  totalIncome6m: number;
  totalExpense6m: number;
  netSavings6m: number;
  averageIncome6m: number;
  averageExpense6m: number;
  overallSavingsRate6m: number;
  surplusMonthsCount: number;
  deficitMonthsCount: number;
  financialHealthStatus: 'strong' | 'positive' | 'neutral' | 'deficit';
  financialHealthLabel: string;
}

/**
 * Calcula a evolução comparativa mensal de Receitas vs. Despesas nos últimos 6 meses
 * encerrados em `referenceMonth` (inclusive), fornecendo indicadores de saúde financeira.
 */
export function calculateSixMonthComparativeSeries(
  accounts: BankAccount[],
  cards: CreditCard[],
  transactions: Transaction[],
  referenceMonth: string
): SixMonthComparativeSummary {
  const startMonth = addMonthsToYearMonth(referenceMonth, -5);
  const endMonth = referenceMonth;
  const monthList = getMonthRange(startMonth, endMonth);

  const months: SixMonthComparativePoint[] = [];
  let totalIncome6m = 0;
  let totalExpense6m = 0;
  let surplusMonthsCount = 0;
  let deficitMonthsCount = 0;

  for (let i = 0; i < monthList.length; i++) {
    const m = monthList[i];
    const summary = calculateMonthlySummary(accounts, cards, transactions, m);
    const prev = i > 0 ? months[i - 1] : null;

    const income = Math.round(summary.incomeTotal * 100) / 100;
    const expense = Math.round(summary.expenseTotal * 100) / 100;
    const netSavings = Math.round((income - expense) * 100) / 100;

    totalIncome6m = Math.round((totalIncome6m + income) * 100) / 100;
    totalExpense6m = Math.round((totalExpense6m + expense) * 100) / 100;

    let healthStatus: 'surplus' | 'balanced' | 'deficit' = 'balanced';
    if (income > expense) {
      healthStatus = 'surplus';
      surplusMonthsCount += 1;
    } else if (expense > income) {
      healthStatus = 'deficit';
      deficitMonthsCount += 1;
    }

    const expenseDeltaPercent =
      prev && prev.expense > 0
        ? Math.round(((expense - prev.expense) / prev.expense) * 1000) / 10
        : null;
    const incomeDeltaPercent =
      prev && prev.income > 0
        ? Math.round(((income - prev.income) / prev.income) * 1000) / 10
        : null;

    months.push({
      month: m,
      label: formatMonthYearPT(m),
      shortLabel: formatShortMonthPT(m),
      income,
      expense,
      netSavings,
      savingsRate: summary.savingsRateProjected,
      cumulativeBalance: summary.totalProjectedBalance,
      expenseDeltaPercent,
      incomeDeltaPercent,
      isSurplus: netSavings >= 0,
      healthStatus,
    });
  }

  const count = Math.max(1, months.length);
  const netSavings6m = Math.round((totalIncome6m - totalExpense6m) * 100) / 100;
  const averageIncome6m = Math.round((totalIncome6m / count) * 100) / 100;
  const averageExpense6m = Math.round((totalExpense6m / count) * 100) / 100;
  const overallSavingsRate6m =
    totalIncome6m > 0
      ? Math.round(((totalIncome6m - totalExpense6m) / totalIncome6m) * 1000) / 10
      : 0;

  let financialHealthStatus: 'strong' | 'positive' | 'neutral' | 'deficit' = 'neutral';
  let financialHealthLabel = 'Sem Movimentação no Semestre';

  if (totalIncome6m === 0 && totalExpense6m === 0) {
    financialHealthStatus = 'neutral';
    financialHealthLabel = 'Sem Movimentação no Semestre';
  } else if (netSavings6m >= 0 && overallSavingsRate6m >= 20) {
    financialHealthStatus = 'strong';
    financialHealthLabel = 'Saúde Financeira Excelente';
  } else if (netSavings6m > 0) {
    financialHealthStatus = 'positive';
    financialHealthLabel = 'Superávit Positivo no Semestre';
  } else if (netSavings6m === 0) {
    financialHealthStatus = 'neutral';
    financialHealthLabel = 'Orçamento no Limite (Zero a Zero)';
  } else {
    financialHealthStatus = 'deficit';
    financialHealthLabel = 'Atenção: Despesas Acima das Receitas';
  }

  return {
    startMonth,
    endMonth,
    months,
    totalIncome6m,
    totalExpense6m,
    netSavings6m,
    averageIncome6m,
    averageExpense6m,
    overallSavingsRate6m,
    surplusMonthsCount,
    deficitMonthsCount,
    financialHealthStatus,
    financialHealthLabel,
  };
}

export interface FinancialHealthScore360 {
  score: number; // 0 to 1000 (FEBRABAN / Planejamento Pessoal index)
  grade: 'excellent' | 'good' | 'attention' | 'critical' | 'onboarding';
  gradeLabel: string;
  pillars: {
    savingsScore: number; // 0-250
    liquidityScore: number; // 0-250
    creditScore: number; // 0-250
    budgetDisciplineScore: number; // 0-250
  };
  netWorth: number; // Contas + Investimentos - Passivo de Cartões
  liquidBalance: number; // Saldo total em contas bancárias
  investmentsTotal: number; // Valor de mercado da carteira de ativos
  creditCardDebt: number; // Limite total tomado em cartões
  creditUsagePercent: number; // % de uso do limite total de cartões
  runwayMonths: number; // Meses de custo de vida cobertos pela reserva líquida
  safeToSpendPerDay: number; // Orçamento livre por dia até o fim do mês
  daysRemainingInMonth: number;
  isCleanStart: boolean;
  recommendations: string[];
}

/**
 * Calcula o Score de Saúde Financeira 360º (0 a 1000 pontos), Patrimônio Líquido Consolidado,
 * Autonomia de Reserva de Emergência (Runway em meses) e o indicador "Livre para Gastar por Dia"
 * (Safe-to-Spend).
 */
export function calculateFinancialHealthScore360(params: {
  selectedMonth: string;
  monthlySummary: MonthlyFinancialSummary;
  accounts: BankAccount[];
  accountBalances: AccountBalanceSummary[];
  cards: CreditCard[];
  cardSummaries: CreditCardSummary[];
  categoryBreakdown: CategorySpendItem[];
  investments?: InvestmentAsset[];
  referenceDateIso?: string;
}): FinancialHealthScore360 {
  const {
    selectedMonth,
    monthlySummary,
    accounts,
    accountBalances,
    cards,
    cardSummaries,
    categoryBreakdown,
    investments = [],
    referenceDateIso,
  } = params;

  const liquidBalance =
    Math.round(
      accountBalances.reduce((sum, b) => sum + b.currentBalance, 0) * 100
    ) / 100;

  const investmentsTotal =
    Math.round(
      investments.reduce(
        (sum, inv) => sum + Math.max(0, inv.quantity) * Math.max(0, inv.currentPrice),
        0
      ) * 100
    ) / 100;

  const liquidInvestmentsTotal =
    Math.round(
      investments
        .filter((inv) => inv.liquidity !== 'No Vencimento')
        .reduce(
          (sum, inv) => sum + Math.max(0, inv.quantity) * Math.max(0, inv.currentPrice),
          0
        ) * 100
    ) / 100;

  const creditCardDebt =
    Math.round(
      cardSummaries.reduce((sum, c) => sum + Math.max(0, c.usedLimit), 0) * 100
    ) / 100;

  const totalCreditLimit = cards.reduce((sum, c) => sum + Math.max(0, c.limit), 0);
  const creditUsagePercent =
    totalCreditLimit > 0
      ? Math.round((creditCardDebt / totalCreditLimit) * 1000) / 10
      : 0;

  const netWorth =
    Math.round((liquidBalance + investmentsTotal - creditCardDebt) * 100) / 100;

  // Days remaining in selectedMonth
  const [yStr, mStr] = selectedMonth.split('-');
  const year = Number(yStr) || 2026;
  const monthIdx = (Number(mStr) || 1) - 1;
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  const todayIso = referenceDateIso || new Date().toISOString().slice(0, 10);
  const currentYearMonth = todayIso.slice(0, 7);

  let daysRemainingInMonth = daysInMonth;
  if (selectedMonth === currentYearMonth) {
    const todayDay = Number(todayIso.slice(8, 10)) || 1;
    daysRemainingInMonth = Math.max(1, daysInMonth - todayDay + 1);
  } else if (selectedMonth < currentYearMonth) {
    daysRemainingInMonth = 1;
  }

  // Safe to spend per day based on projected monthly surplus or remaining budget
  const totalCategoryBudget = categoryBreakdown.reduce((s, c) => s + c.budget, 0);
  const totalCategorySpent = categoryBreakdown.reduce((s, c) => s + c.spent, 0);
  const remainingCategoryRoom =
    totalCategoryBudget > 0 ? Math.max(0, totalCategoryBudget - totalCategorySpent) : 0;

  const positiveSurplusRoom = Math.max(0, monthlySummary.netResultProjected);
  const effectiveDisposableRoom =
    monthlySummary.incomeTotal > 0
      ? positiveSurplusRoom
      : remainingCategoryRoom > 0
      ? remainingCategoryRoom
      : Math.max(0, monthlySummary.totalProjectedBalance);

  const safeToSpendPerDay =
    daysRemainingInMonth > 0
      ? Math.round((effectiveDisposableRoom / daysRemainingInMonth) * 100) / 100
      : 0;

  // Runway in months (Emergency reserve coverage)
  const monthlyBaselineExpense =
    monthlySummary.expenseTotal > 0
      ? monthlySummary.expenseTotal
      : totalCategoryBudget > 0
      ? totalCategoryBudget
      : 0;

  const totalEmergencyLiquidity = Math.max(0, liquidBalance + liquidInvestmentsTotal);
  const runwayMonths =
    monthlyBaselineExpense > 0
      ? Math.round((totalEmergencyLiquidity / monthlyBaselineExpense) * 10) / 10
      : totalEmergencyLiquidity > 0
      ? 12
      : 0;

  const isCleanStart =
    accounts.length === 0 &&
    investments.length === 0 &&
    monthlySummary.incomeTotal === 0 &&
    monthlySummary.expenseTotal === 0;

  if (isCleanStart) {
    return {
      score: 750,
      grade: 'onboarding',
      gradeLabel: 'Base Pronta p/ Ativação',
      pillars: {
        savingsScore: 200,
        liquidityScore: 180,
        creditScore: 250,
        budgetDisciplineScore: 120,
      },
      netWorth: 0,
      liquidBalance: 0,
      investmentsTotal: 0,
      creditCardDebt: 0,
      creditUsagePercent: 0,
      runwayMonths: 0,
      safeToSpendPerDay: 0,
      daysRemainingInMonth,
      isCleanStart: true,
      recommendations: [
        'Cadastre sua primeira conta bancária ou carteira digital para acompanhar seu saldo líquido.',
        'Registre suas receitas e despesas do mês para ativar o cálculo automático de Livre p/ Gastar Hoje.',
        'Defina metas de orçamento na Regra 50/30/20 para monitorar seu índice de saúde financeira.',
      ],
    };
  }

  // 1. Savings Score (0-250)
  let savingsScore = 0;
  if (monthlySummary.incomeTotal > 0) {
    if (monthlySummary.savingsRateProjected >= 20) {
      savingsScore = 250;
    } else if (monthlySummary.savingsRateProjected >= 0) {
      savingsScore = Math.round(125 + (monthlySummary.savingsRateProjected / 20) * 125);
    } else {
      const deficitRatio = Math.min(
        1,
        Math.abs(monthlySummary.netResultProjected) / monthlySummary.incomeTotal
      );
      savingsScore = Math.max(0, Math.round(100 * (1 - deficitRatio)));
    }
  } else if (monthlySummary.expenseTotal === 0) {
    savingsScore = 180;
  } else {
    savingsScore = 60;
  }

  // 2. Liquidity & Emergency Runway Score (0-250)
  let liquidityScore = 0;
  if (runwayMonths >= 6) {
    liquidityScore = 250;
  } else if (runwayMonths > 0) {
    liquidityScore = Math.round((runwayMonths / 6) * 250);
  } else if (liquidBalance > 0) {
    liquidityScore = 150;
  }

  // 3. Credit Card Limit Utilization Score (0-250)
  let creditScore = 250;
  if (cards.length > 0 && totalCreditLimit > 0) {
    if (creditUsagePercent <= 30) {
      creditScore = 250;
    } else if (creditUsagePercent <= 70) {
      creditScore = Math.round(250 - ((creditUsagePercent - 30) / 40) * 130);
    } else {
      creditScore = Math.max(
        0,
        Math.round(120 - ((Math.min(100, creditUsagePercent) - 70) / 30) * 120)
      );
    }
  }

  // 4. Budget Discipline Score (0-250)
  const overCount = categoryBreakdown.filter((c) => c.status === 'over').length;
  const warningCount = categoryBreakdown.filter((c) => c.status === 'warning').length;
  const budgetDisciplineScore = Math.max(
    0,
    250 - overCount * 55 - warningCount * 20
  );

  const score = Math.min(
    1000,
    Math.max(0, savingsScore + liquidityScore + creditScore + budgetDisciplineScore)
  );

  let grade: FinancialHealthScore360['grade'] = 'good';
  let gradeLabel = 'Saudável';
  if (score >= 800) {
    grade = 'excellent';
    gradeLabel = 'Excelente (Referência)';
  } else if (score >= 650) {
    grade = 'good';
    gradeLabel = 'Saudável';
  } else if (score >= 450) {
    grade = 'attention';
    gradeLabel = 'Atenção Moderada';
  } else {
    grade = 'critical';
    gradeLabel = 'Crítico · Requer Ajuste';
  }

  const recommendations: string[] = [];
  if (
    monthlySummary.incomeTotal === 0 &&
    monthlySummary.expenseTotal === 0 &&
    liquidBalance > 0
  ) {
    recommendations.push(
      `Ciclo de ${formatMonthYearPT(
        selectedMonth
      )} iniciado com saldo acumulado de ${formatBRL(
        liquidBalance
      )}. Registre as receitas e despesas previstas do mês para calibrar sua meta de poupança.`
    );
  } else if (monthlySummary.netResultProjected < 0) {
    recommendations.push(
      `Suas despesas superam as receitas em ${formatBRL(
        Math.abs(monthlySummary.netResultProjected)
      )} neste mês. Priorize renegociar ou adiar gastos variáveis.`
    );
  } else if (
    monthlySummary.incomeTotal > 0 &&
    monthlySummary.savingsRateProjected < 20
  ) {
    const missingTo20 = Math.max(
      0,
      monthlySummary.incomeTotal * 0.2 - monthlySummary.netResultProjected
    );
    recommendations.push(
      `Você está poupando ${monthlySummary.savingsRateProjected}% da renda. Economize mais ${formatBRL(
        missingTo20
      )} para atingir o padrão ouro de 20%.`
    );
  }

  if (overCount > 0) {
    recommendations.push(
      `${overCount} categoria(s) ultrapassaram o teto mensal. Revise os alertas de orçamento para reequilibrar o mês.`
    );
  }

  if (runwayMonths < 6 && monthlyBaselineExpense > 0) {
    recommendations.push(
      `Sua reserva de liquidez cobre ${runwayMonths} mês(es) do seu custo mensal (meta ideal: 6 meses em Tesouro Selic / CDB D+0).`
    );
  }

  if (creditUsagePercent > 50) {
    recommendations.push(
      `Você está utilizando ${creditUsagePercent}% do limite total dos cartões. Manter abaixo de 30% preserva sua saúde de crédito.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      'Parabéns! Seu fluxo de caixa, reserva de liquidez e limites de cartão estão no padrão máximo de excelência.'
    );
  }

  return {
    score,
    grade,
    gradeLabel,
    pillars: {
      savingsScore,
      liquidityScore,
      creditScore,
      budgetDisciplineScore,
    },
    netWorth,
    liquidBalance,
    investmentsTotal,
    creditCardDebt,
    creditUsagePercent,
    runwayMonths,
    safeToSpendPerDay,
    daysRemainingInMonth,
    isCleanStart: false,
    recommendations: recommendations.slice(0, 3),
  };
}

