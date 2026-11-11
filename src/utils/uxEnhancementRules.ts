import {
  Category,
  CategoryIconName,
  PaymentMethod,
  Transaction,
} from '../types/finance';
import { getEffectiveExpenseAmountForUser } from './financeRules';
import { matchCategoryByDescription } from './ofxParser';

export interface BudgetImpactPreview {
  hasBudget: boolean;
  categoryName: string;
  budgetLimit: number;
  spentBefore: number;
  addedInMonth: number;
  projectedSpent: number;
  remainingAfter: number;
  percentBefore: number;
  percentAfter: number;
  statusAfter: 'ok' | 'warning' | 'over';
}

export interface DailyTransactionGroup {
  date: string;
  dayHeaderLabel: string;
  weekdayLabel: string;
  dayIncome: number;
  dayExpense: number;
  dayNet: number;
  transactions: Transaction[];
}

export interface SmartTransactionSuggestion {
  cleanDescription: string;
  categoryId: string;
  subcategoryId?: string;
  accountId?: string;
  creditCardId?: string;
  paymentMethod: PaymentMethod;
  lastAmount: number;
  occurrences: number;
}

export interface MonthBurnRateMetrics {
  referenceDay: number;
  daysInMonth: number;
  monthProgressPercent: number;
  spentPercent: number;
  paceDelta: number;
  paceStatus: 'under_pace' | 'on_pace' | 'over_pace';
  paceLabel: string;
}

export interface WeeklyCashPulseBucket {
  weekIndex: number;
  label: string;
  rangeLabel: string;
  firstDate: string;
  startDay: number;
  endDay: number;
  income: number;
  expense: number;
  net: number;
  pendingCount: number;
  txCount: number;
  isPeakExpenseWeek: boolean;
}

const MONTHS_SHORT_PT = [
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

const WEEKDAYS_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

/**
 * Calculates real-time budget impact when filling out a new or edited expense in TransactionModal.
 */
export function calculateBudgetImpactPreview(
  category: Category | undefined,
  currentCategorySpent: number,
  rawDraftAmount: number,
  recurrence: 'single' | 'installment' | 'fixed' = 'single',
  amountMode: 'total_divided' | 'per_installment' = 'total_divided',
  installmentTotal = 1,
  editingPreviousAmountInMonth = 0
): BudgetImpactPreview {
  if (!category || category.type !== 'expense' || category.monthlyBudget <= 0) {
    return {
      hasBudget: false,
      categoryName: category?.name || '',
      budgetLimit: 0,
      spentBefore: 0,
      addedInMonth: 0,
      projectedSpent: 0,
      remainingAfter: 0,
      percentBefore: 0,
      percentAfter: 0,
      statusAfter: 'ok',
    };
  }

  const budgetLimit = category.monthlyBudget;
  const spentBefore = Math.max(
    0,
    Math.round((currentCategorySpent - editingPreviousAmountInMonth) * 100) / 100
  );

  const safeDraft = Math.max(0, rawDraftAmount);
  const safeInstallments = Math.max(1, installmentTotal);
  const addedInMonth =
    recurrence === 'installment' && amountMode === 'total_divided' && safeInstallments > 1
      ? Math.round((safeDraft / safeInstallments) * 100) / 100
      : Math.round(safeDraft * 100) / 100;

  const projectedSpent = Math.round((spentBefore + addedInMonth) * 100) / 100;
  const remainingAfter = Math.round((budgetLimit - projectedSpent) * 100) / 100;

  const percentBefore = Math.round((spentBefore / budgetLimit) * 1000) / 10;
  const percentAfter = Math.round((projectedSpent / budgetLimit) * 1000) / 10;

  const statusAfter: 'ok' | 'warning' | 'over' =
    projectedSpent > budgetLimit
      ? 'over'
      : percentAfter >= 80
      ? 'warning'
      : 'ok';

  return {
    hasBudget: true,
    categoryName: category.name,
    budgetLimit,
    spentBefore,
    addedInMonth,
    projectedSpent,
    remainingAfter,
    percentBefore,
    percentAfter,
    statusAfter,
  };
}

/**
 * Formats a YYYY-MM-DD date string into a friendly Brazilian daily group header.
 */
export function formatDailyGroupHeaderPT(
  dateStr: string,
  referenceDateStr = new Date().toISOString().slice(0, 10)
): { dayHeaderLabel: string; weekdayLabel: string } {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return { dayHeaderLabel: dateStr, weekdayLabel: '' };
  }
  const [y, m, d] = parts;
  const dateObj = new Date(y, m - 1, d);
  const monthName = MONTHS_SHORT_PT[m - 1] || '';
  const weekday = WEEKDAYS_PT[dateObj.getDay()] || '';

  if (dateStr === referenceDateStr) {
    return {
      dayHeaderLabel: `Hoje · ${String(d).padStart(2, '0')} de ${monthName}`,
      weekdayLabel: weekday,
    };
  }

  // Check yesterday relative to referenceDateStr
  const refParts = referenceDateStr.split('-').map(Number);
  if (refParts.length === 3 && !refParts.some(isNaN)) {
    const refDate = new Date(refParts[0], refParts[1] - 1, refParts[2]);
    const yesterday = new Date(refDate);
    yesterday.setDate(refDate.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    if (dateStr === yStr) {
      return {
        dayHeaderLabel: `Ontem · ${String(d).padStart(2, '0')} de ${monthName}`,
        weekdayLabel: weekday,
      };
    }
  }

  return {
    dayHeaderLabel: `${String(d).padStart(2, '0')} de ${monthName}`,
    weekdayLabel: weekday,
  };
}

/**
 * Groups a list of transactions by date (descending) with daily income/expense/net subtotals.
 */
export function groupTransactionsByDate(
  transactions: Transaction[],
  referenceDateStr = new Date().toISOString().slice(0, 10)
): DailyTransactionGroup[] {
  const map = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    const key = tx.date;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(tx);
  }

  const sortedDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

  return sortedDates.map((dateStr) => {
    const dayTxs = map.get(dateStr) || [];
    let dayIncome = 0;
    let dayExpense = 0;

    for (const tx of dayTxs) {
      if (tx.isInvoicePayment || tx.type === 'transfer') continue;
      if (tx.isCompanionOnlyExpense) continue;
      if (tx.type === 'income') {
        if (tx.sharedPaidBy === 'member') continue;
        dayIncome = Math.round((dayIncome + tx.amount) * 100) / 100;
      } else if (tx.type === 'expense') {
        const eff = getEffectiveExpenseAmountForUser(tx);
        if (eff) {
          dayExpense = Math.round((dayExpense + eff.amount) * 100) / 100;
        }
      }
    }

    const { dayHeaderLabel, weekdayLabel } = formatDailyGroupHeaderPT(
      dateStr,
      referenceDateStr
    );

    return {
      date: dateStr,
      dayHeaderLabel,
      weekdayLabel,
      dayIncome,
      dayExpense,
      dayNet: Math.round((dayIncome - dayExpense) * 100) / 100,
      transactions: dayTxs,
    };
  });
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function stripInstallmentSuffix(desc: string): string {
  return desc
    .replace(/\s*\(\d+\/\d+\)\s*$/g, '')
    .replace(/\s*\(Cópia\)\s*$/gi, '')
    .replace(/\s*\(Antecipada\)\s*$/gi, '')
    .trim();
}

/**
 * Suggestion #1: Smart Autocomplete by Transaction History
 * Extracts deduplicated transaction templates matching the user's entryMode and query.
 */
export function getSmartTransactionSuggestions(
  query: string,
  transactions: Transaction[],
  entryMode: 'expense' | 'income' | 'credit_card' | 'transfer',
  limit = 4
): SmartTransactionSuggestion[] {
  if (entryMode === 'transfer') return [];

  const filtered = transactions.filter((tx) => {
    if (tx.isInvoicePayment || tx.type === 'transfer') return false;
    if (entryMode === 'income') return tx.type === 'income';
    if (entryMode === 'credit_card') return Boolean(tx.creditCardId);
    return tx.type === 'expense' && !tx.creditCardId;
  });

  // Sort most recent first
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  const templateMap = new Map<string, SmartTransactionSuggestion>();
  for (const tx of sorted) {
    const cleanDesc = stripInstallmentSuffix(tx.description);
    if (!cleanDesc) continue;
    const key = normalizeText(cleanDesc);
    const existing = templateMap.get(key);
    if (existing) {
      existing.occurrences += 1;
    } else {
      templateMap.set(key, {
        cleanDescription: cleanDesc,
        categoryId: tx.categoryId,
        subcategoryId: tx.subcategoryId,
        accountId: tx.accountId,
        creditCardId: tx.creditCardId,
        paymentMethod: tx.paymentMethod,
        lastAmount: tx.amount,
        occurrences: 1,
      });
    }
  }

  const allSuggestions = Array.from(templateMap.values());
  const normQuery = normalizeText(query);

  if (!normQuery) {
    return allSuggestions
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit);
  }

  return allSuggestions
    .filter((item) => normalizeText(item.cleanDescription).includes(normQuery))
    .slice(0, limit);
}

export interface SmartCategorySuggestion {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: CategoryIconName;
  subcategoryId?: string;
  subcategoryName?: string;
  confidence: number; // 0.0 to 1.0 (e.g. 0.95 = 95%)
  frequency: number; // occurrences in history
  totalMatches: number;
  matchType: 'exact' | 'prefix' | 'word' | 'token';
  matchedKeywords: string[];
  sampleDescription: string;
  reason: string;
}

const PORTUGUESE_STOP_WORDS = new Set([
  'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas',
  'para', 'pra', 'pro', 'pros', 'pras',
  'por', 'com', 'sem', 'sob', 'sobre',
  'e', 'ou', 'um', 'uma', 'uns', 'umas',
  'o', 'a', 'os', 'as', 'ao', 'aos', 'aquelas', 'aqueles', 'aquele', 'aquela'
]);

/**
 * Intelligent Category Prediction:
 * Analyzes transaction description against past user transactions to suggest
 * the most probable category (and subcategory) weighted by similarity, recency, and frequency.
 */
export function getCategorySuggestionsForDescription(
  description: string,
  transactions: Transaction[],
  categories: Category[],
  entryMode: 'expense' | 'income' | 'credit_card' | 'transfer' = 'expense',
  limit = 3
): SmartCategorySuggestion[] {
  if (!description || description.trim().length < 2 || entryMode === 'transfer') {
    return [];
  }

  const targetType = entryMode === 'income' ? 'income' : 'expense';
  const validCategories = categories.filter((c) => c.type === targetType);
  if (validCategories.length === 0) return [];

  const catMap = new Map(validCategories.map((c) => [c.id, c]));
  const normQuery = normalizeText(description);
  const queryTokens = normQuery
    .split(/[\s,./\-_+]+/)
    .filter((t) => t.length >= 2 && !PORTUGUESE_STOP_WORDS.has(t));

  interface CandidateAccumulator {
    category: Category;
    score: number;
    frequency: number;
    bestMatchType: 'exact' | 'prefix' | 'word' | 'token';
    bestMatchScore: number;
    sampleDescription: string;
    subcategoryIdCount: Map<string, number>;
    mostRecentDate: string;
  }

  const candidateMap = new Map<string, CandidateAccumulator>();

  for (const tx of transactions) {
    if (tx.isInvoicePayment || tx.type === 'transfer' || tx.isCompanionOnlyExpense) {
      continue;
    }
    if (targetType === 'income' && tx.type !== 'income') continue;
    if (targetType === 'expense' && tx.type !== 'expense') continue;

    const cat = catMap.get(tx.categoryId);
    if (!cat) continue;

    const cleanDesc = stripInstallmentSuffix(tx.description);
    if (!cleanDesc) continue;
    const normDesc = normalizeText(cleanDesc);

    let matchScore = 0;
    let matchType: 'exact' | 'prefix' | 'word' | 'token' = 'token';

    if (normQuery === normDesc) {
      matchScore = 100;
      matchType = 'exact';
    } else if (normDesc.startsWith(normQuery) || normQuery.startsWith(normDesc)) {
      matchScore = 75;
      matchType = 'prefix';
    } else if (normDesc.includes(normQuery) || normQuery.includes(normDesc)) {
      matchScore = 55;
      matchType = 'word';
    } else if (queryTokens.length > 0) {
      const descTokens = normDesc
        .split(/[\s,./\-_+]+/)
        .filter((t) => t.length >= 2 && !PORTUGUESE_STOP_WORDS.has(t));

      const matchedTokens = queryTokens.filter((qt) =>
        descTokens.some((dt) => dt === qt || dt.includes(qt) || qt.includes(dt))
      );

      if (matchedTokens.length > 0) {
        const matchRatio = matchedTokens.length / queryTokens.length;
        matchScore = Math.round(matchRatio * 45);
        matchType = 'token';
      }
    }

    if (matchScore > 0) {
      let cand = candidateMap.get(cat.id);
      if (!cand) {
        cand = {
          category: cat,
          score: 0,
          frequency: 0,
          bestMatchType: matchType,
          bestMatchScore: matchScore,
          sampleDescription: cleanDesc,
          subcategoryIdCount: new Map<string, number>(),
          mostRecentDate: tx.date || '',
        };
        candidateMap.set(cat.id, cand);
      }

      cand.score += matchScore;
      cand.frequency += 1;
      if (matchScore > cand.bestMatchScore) {
        cand.bestMatchScore = matchScore;
        cand.bestMatchType = matchType;
        cand.sampleDescription = cleanDesc;
      }
      if (tx.subcategoryId) {
        const cur = cand.subcategoryIdCount.get(tx.subcategoryId) || 0;
        cand.subcategoryIdCount.set(tx.subcategoryId, cur + 1);
      }
      if (tx.date && tx.date > cand.mostRecentDate) {
        cand.mostRecentDate = tx.date;
      }
    }
  }

  if (candidateMap.size === 0) return [];

  const totalAllMatches = Array.from(candidateMap.values()).reduce(
    (sum, c) => sum + c.frequency,
    0
  );

  const candidates = Array.from(candidateMap.values()).sort((a, b) => {
    if (b.bestMatchScore !== a.bestMatchScore) {
      return b.bestMatchScore - a.bestMatchScore;
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.frequency - a.frequency;
  });

  return candidates.slice(0, limit).map((cand) => {
    let dominantSubcategoryId: string | undefined;
    let maxSubCount = 0;
    for (const [subId, count] of cand.subcategoryIdCount.entries()) {
      if (count > maxSubCount) {
        maxSubCount = count;
        dominantSubcategoryId = subId;
      }
    }

    const subObj = dominantSubcategoryId
      ? cand.category.subcategories.find((s) => s.id === dominantSubcategoryId)
      : undefined;

    let baseConfidence = 0.6;
    if (cand.bestMatchType === 'exact') baseConfidence = 0.92;
    else if (cand.bestMatchType === 'prefix') baseConfidence = 0.82;
    else if (cand.bestMatchType === 'word') baseConfidence = 0.72;
    else baseConfidence = 0.58;

    const categoryShare = totalAllMatches > 0 ? cand.frequency / totalAllMatches : 1;
    const frequencyBonus = Math.min(0.06, (cand.frequency - 1) * 0.02);
    const confidence = Math.min(
      0.99,
      Math.round((baseConfidence * 0.85 + categoryShare * 0.15 + frequencyBonus) * 100) / 100
    );

    const reason =
      cand.bestMatchType === 'exact'
        ? `Correspondência exata com "${cand.sampleDescription}" (${cand.frequency}x no histórico)`
        : `Baseado em ${cand.frequency} lançamento(s) de "${cand.sampleDescription}"`;

    return {
      categoryId: cand.category.id,
      categoryName: cand.category.name,
      categoryColor: cand.category.color,
      categoryIcon: cand.category.icon,
      subcategoryId: dominantSubcategoryId,
      subcategoryName: subObj?.name,
      confidence,
      frequency: cand.frequency,
      totalMatches: totalAllMatches,
      matchType: cand.bestMatchType,
      matchedKeywords: queryTokens,
      sampleDescription: cand.sampleDescription,
      reason,
    };
  });
}

/**
 * Convenience helper returning the single highest probability category prediction,
 * or null if no strong match found in past transactions.
 */
export function predictCategoryFromDescription(
  description: string,
  transactions: Transaction[],
  categories: Category[],
  entryMode: 'expense' | 'income' | 'credit_card' | 'transfer' = 'expense'
): SmartCategorySuggestion | null {
  if (entryMode === 'transfer') return null;

  const suggestions = getCategorySuggestionsForDescription(
    description,
    transactions,
    categories,
    entryMode,
    1
  );
  const historicalSuggestion = suggestions[0];
  if (historicalSuggestion && historicalSuggestion.confidence >= 0.65) {
    return historicalSuggestion;
  }

  const targetType = entryMode === 'income' ? 'income' : 'expense';
  const merchantMatch = matchCategoryByDescription(description, categories, targetType);
  const merchantCategory = merchantMatch
    ? categories.find((category) => category.id === merchantMatch.categoryId)
    : undefined;
  if (merchantMatch && merchantCategory) {
    const normalizedSubcategoryName = normalizeText(merchantMatch.subcategoryName || '');
    const matchedSubcategory = (merchantCategory.subcategories || []).find(
      (subcategory) => normalizeText(subcategory.name) === normalizedSubcategoryName
    );
    return {
      categoryId: merchantCategory.id,
      categoryName: merchantCategory.name,
      categoryColor: merchantCategory.color,
      categoryIcon: merchantCategory.icon,
      subcategoryId: matchedSubcategory?.id,
      subcategoryName: matchedSubcategory?.name || merchantMatch.subcategoryName,
      confidence: 0.9,
      frequency: 0,
      totalMatches: 1,
      matchType: 'token',
      matchedKeywords: [description.trim()],
      sampleDescription: description.trim(),
      reason: 'Categoria automática pela descrição do estabelecimento',
    };
  }

  return historicalSuggestion || null;
}

/**
 * Suggestion #3: Monthly Burn Rate Marker (Ritmo do Mês)
 * Compares category budget consumption (%) against elapsed days of the month (%).
 */
export function calculateMonthBurnRateMarker(
  selectedMonth: string,
  spentPercent: number,
  referenceDay?: number
): MonthBurnRateMetrics {
  const parts = selectedMonth.split('-').map(Number);
  const now = new Date();
  const year = parts[0] || now.getFullYear();
  const month = parts[1] || now.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate() || 30;

  let effectiveDay = referenceDay;
  if (effectiveDay === undefined) {
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (selectedMonth === currentYM) {
      effectiveDay = now.getDate();
    } else if (selectedMonth < currentYM) {
      effectiveDay = daysInMonth;
    } else {
      effectiveDay = 1;
    }
  }

  const clampedDay = Math.min(daysInMonth, Math.max(1, effectiveDay));

  const monthProgressPercent =
    Math.round((clampedDay / daysInMonth) * 1000) / 10;
  const paceDelta = Math.round((spentPercent - monthProgressPercent) * 10) / 10;

  let paceStatus: 'under_pace' | 'on_pace' | 'over_pace' = 'on_pace';
  let paceLabel = 'No ritmo do mês';

  if (spentPercent > 100 || paceDelta > 12) {
    paceStatus = 'over_pace';
    paceLabel = 'Acima do ritmo';
  } else if (paceDelta < -10) {
    paceStatus = 'under_pace';
    paceLabel = 'Abaixo do ritmo';
  }

  return {
    referenceDay: clampedDay,
    daysInMonth,
    monthProgressPercent,
    spentPercent,
    paceDelta,
    paceStatus,
    paceLabel,
  };
}

/**
 * Suggestion #4: Credit Card Installment Anticipation with Optional Discount & Reversal
 */
export interface ActiveInstallmentGroupSummary {
  installmentGroupId: string;
  title: string;
  creditCardId?: string;
  categoryId: string;
  installmentTotal: number;
  currentInstallmentNumber: number;
  futureInstallmentsCount: number;
  futureTotalAmount: number;
  singleInstallmentAmount: number;
  futureTransactions: Transaction[];
  anticipatedCountInMonth: number;
}

export function getFutureUnpaidInstallments(
  transactions: Transaction[],
  installmentGroupId: string | undefined,
  currentCompetenceMonth: string
): Transaction[] {
  if (!installmentGroupId) return [];
  return transactions
    .filter(
      (tx) =>
        tx.installmentGroupId === installmentGroupId &&
        tx.competenceMonth > currentCompetenceMonth &&
        tx.status === 'pending'
    )
    .sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
}

export function getActiveInstallmentGroupsForCard(
  transactions: Transaction[],
  cardId: string | 'all',
  currentCompetenceMonth: string
): ActiveInstallmentGroupSummary[] {
  const groupMap = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if (!tx.installmentGroupId) continue;
    if (cardId !== 'all' && tx.creditCardId !== cardId) continue;
    const list = groupMap.get(tx.installmentGroupId) || [];
    list.push(tx);
    groupMap.set(tx.installmentGroupId, list);
  }

  const summaries: ActiveInstallmentGroupSummary[] = [];

  for (const [groupId, groupTxs] of groupMap.entries()) {
    const sorted = [...groupTxs].sort(
      (a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0)
    );
    const futureTxs = sorted.filter(
      (tx) => tx.competenceMonth > currentCompetenceMonth && tx.status === 'pending'
    );
    const anticipatedInMonth = sorted.filter(
      (tx) =>
        tx.competenceMonth === currentCompetenceMonth &&
        (tx.isAnticipated || tx.description.includes('(Antecipada)'))
    );

    if (futureTxs.length === 0 && anticipatedInMonth.length === 0) continue;

    const currentMonthTx =
      sorted.find(
        (tx) =>
          tx.competenceMonth === currentCompetenceMonth &&
          !tx.isAnticipated &&
          !tx.description.includes('(Antecipada)')
      ) || sorted[0];

    const rawTitle = stripInstallmentSuffix(currentMonthTx.description);
    const futureSum =
      Math.round(futureTxs.reduce((acc, t) => acc + t.amount, 0) * 100) / 100;

    summaries.push({
      installmentGroupId: groupId,
      title: rawTitle || currentMonthTx.description,
      creditCardId: currentMonthTx.creditCardId,
      categoryId: currentMonthTx.categoryId,
      installmentTotal:
        currentMonthTx.installmentTotal || sorted.length || futureTxs.length + 1,
      currentInstallmentNumber: currentMonthTx.installmentNumber || 1,
      futureInstallmentsCount: futureTxs.length,
      futureTotalAmount: futureSum,
      singleInstallmentAmount: futureTxs[0]?.amount || currentMonthTx.amount,
      futureTransactions: futureTxs,
      anticipatedCountInMonth: anticipatedInMonth.length,
    });
  }

  return summaries.sort(
    (a, b) => b.futureTotalAmount - a.futureTotalAmount
  );
}

export function anticipateCardInstallments(
  transactions: Transaction[],
  installmentGroupId: string,
  targetCompetenceMonth: string,
  discountAmount = 0,
  maxCountToAdvance?: number
): {
  updatedTransactions: Transaction[];
  anticipatedCount: number;
  originalSum: number;
  finalSum: number;
} {
  const allFutureTargets = getFutureUnpaidInstallments(
    transactions,
    installmentGroupId,
    targetCompetenceMonth
  );

  const futureTargets =
    typeof maxCountToAdvance === 'number' && maxCountToAdvance > 0
      ? allFutureTargets.slice(0, maxCountToAdvance)
      : allFutureTargets;

  if (futureTargets.length === 0) {
    return {
      updatedTransactions: transactions,
      anticipatedCount: 0,
      originalSum: 0,
      finalSum: 0,
    };
  }

  const targetIds = new Set(futureTargets.map((t) => t.id));
  const originalSum =
    Math.round(futureTargets.reduce((acc, t) => acc + t.amount, 0) * 100) / 100;
  const safeDiscount = Math.max(
    0,
    Math.min(originalSum - 0.01 * futureTargets.length, discountAmount)
  );
  const discountPerInstallment =
    futureTargets.length > 0
      ? Math.round((safeDiscount / futureTargets.length) * 100) / 100
      : 0;

  let finalSum = 0;

  const updatedTransactions = transactions.map((tx) => {
    if (!targetIds.has(tx.id)) return tx;

    const discountedAmount = Math.max(
      0.01,
      Math.round((tx.amount - discountPerInstallment) * 100) / 100
    );
    finalSum = Math.round((finalSum + discountedAmount) * 100) / 100;

    const daySuffix = tx.date.slice(8, 10) || '15';
    const nextDesc = tx.description.includes('(Antecipada)')
      ? tx.description
      : `${tx.description} (Antecipada)`;

    return {
      ...tx,
      isAnticipated: true,
      originalCompetenceMonth: tx.originalCompetenceMonth || tx.competenceMonth,
      originalDateBeforeAnticipation: tx.originalDateBeforeAnticipation || tx.date,
      originalAmountBeforeDiscount: tx.originalAmountBeforeDiscount || tx.amount,
      amount: discountedAmount,
      competenceMonth: targetCompetenceMonth,
      date: `${targetCompetenceMonth}-${daySuffix}`,
      description: nextDesc,
      notes:
        safeDiscount > 0
          ? `Parcela antecipada para ${targetCompetenceMonth} com desconto`
          : `Parcela antecipada para ${targetCompetenceMonth}`,
    };
  });

  return {
    updatedTransactions,
    anticipatedCount: futureTargets.length,
    originalSum,
    finalSum,
  };
}

export function reverseInstallmentAnticipation(
  transactions: Transaction[],
  targetIdOrGroupId: string
): {
  updatedTransactions: Transaction[];
  restoredCount: number;
} {
  let restoredCount = 0;

  const updatedTransactions = transactions.map((tx) => {
    const isMatch =
      tx.id === targetIdOrGroupId || tx.installmentGroupId === targetIdOrGroupId;
    const wasAnticipated =
      tx.isAnticipated || tx.description.includes('(Antecipada)');

    if (!isMatch || !wasAnticipated) return tx;

    restoredCount += 1;
    const restoredMonth = tx.originalCompetenceMonth || tx.competenceMonth;
    const restoredDate =
      tx.originalDateBeforeAnticipation ||
      `${restoredMonth}-${tx.date.slice(8, 10) || '15'}`;
    const restoredAmount = tx.originalAmountBeforeDiscount ?? tx.amount;

    return {
      ...tx,
      isAnticipated: false,
      competenceMonth: restoredMonth,
      date: restoredDate,
      amount: restoredAmount,
      description: tx.description.replace(/\s*\(Antecipada\)/gi, '').trim(),
      originalCompetenceMonth: undefined,
      originalDateBeforeAnticipation: undefined,
      originalAmountBeforeDiscount: undefined,
      notes: undefined,
    };
  });

  return {
    updatedTransactions,
    restoredCount,
  };
}

/**
 * Suggestion #5: Weekly Cash Pulse (Pulso Semanal do Mês) for MonthlyCalendarView
 */
export function calculateWeeklyCashPulse(
  transactions: Transaction[],
  selectedMonth: string
): WeeklyCashPulseBucket[] {
  const parts = selectedMonth.split('-').map(Number);
  const year = parts[0] || 2026;
  const month = parts[1] || 10;
  const daysInMonth = new Date(year, month, 0).getDate() || 30;

  const ranges: Array<{ weekIndex: number; startDay: number; endDay: number }> = [
    { weekIndex: 1, startDay: 1, endDay: 7 },
    { weekIndex: 2, startDay: 8, endDay: 14 },
    { weekIndex: 3, startDay: 15, endDay: 21 },
    { weekIndex: 4, startDay: 22, endDay: 28 },
    { weekIndex: 5, startDay: 29, endDay: daysInMonth },
  ];

  const monthTxs = transactions.filter(
    (tx) =>
      tx.competenceMonth === selectedMonth &&
      !tx.isInvoicePayment &&
      tx.type !== 'transfer'
  );

  const buckets: WeeklyCashPulseBucket[] = ranges.map((r) => {
    const startStr = String(r.startDay).padStart(2, '0');
    const endStr = String(r.endDay).padStart(2, '0');
    let income = 0;
    let expense = 0;
    let pendingCount = 0;
    let txCount = 0;

    for (const tx of monthTxs) {
      if (tx.isCompanionOnlyExpense) continue;
      const dayNum = Number(tx.date.slice(8, 10));
      if (dayNum >= r.startDay && dayNum <= r.endDay) {
        if (tx.type === 'income') {
          if (tx.sharedPaidBy === 'member') continue;
          txCount += 1;
          income = Math.round((income + tx.amount) * 100) / 100;
        } else if (tx.type === 'expense') {
          const eff = getEffectiveExpenseAmountForUser(tx);
          if (!eff) continue;
          txCount += 1;
          expense = Math.round((expense + eff.amount) * 100) / 100;
          if (eff.status === 'pending') {
            pendingCount += 1;
          }
        }
      }
    }

    return {
      weekIndex: r.weekIndex,
      label: `Semana ${r.weekIndex}`,
      rangeLabel: `Dias ${startStr} a ${endStr}`,
      firstDate: `${selectedMonth}-${startStr}`,
      startDay: r.startDay,
      endDay: r.endDay,
      income,
      expense,
      net: Math.round((income - expense) * 100) / 100,
      pendingCount,
      txCount,
      isPeakExpenseWeek: false,
    };
  });

  let maxExpense = 0;
  let peakIndex = -1;
  buckets.forEach((b, idx) => {
    if (b.expense > maxExpense) {
      maxExpense = b.expense;
      peakIndex = idx;
    }
  });

  if (peakIndex >= 0 && maxExpense > 0) {
    buckets[peakIndex].isPeakExpenseWeek = true;
  }

  return buckets;
}

export interface AccountStatementEntry {
  transaction: Transaction;
  direction: 'credit' | 'debit';
  signedAmount: number;
  runningBalanceAfter: number;
  runningRealizedAfter: number;
  isTransferIncoming: boolean;
  isTransferOutgoing: boolean;
}

export interface AccountStatementSummary {
  accountId: string;
  openingBalance: number;
  closingRealizedBalance: number;
  closingProjectedBalance: number;
  monthCreditsRealized: number;
  monthDebitsRealized: number;
  monthPendingNet: number;
  entriesChronological: AccountStatementEntry[];
  entriesNewestFirst: AccountStatementEntry[];
}

/**
 * Computes a complete real bank statement for a specific BankAccount in selectedMonth,
 * including opening balance, signed credit/debit direction, and progressive running balance after each row.
 */
export function calculateAccountStatementWithRunningBalance(
  accountId: string,
  initialBalance: number,
  transactions: Transaction[],
  selectedMonth: string
): AccountStatementSummary {
  let openingBalance = Math.round(initialBalance * 100) / 100;

  // 1. Accumulate all paid transactions prior to selectedMonth
  for (const tx of transactions) {
    if (tx.creditCardId) continue;
    if (tx.isCompanionOnlyExpense || tx.sharedPaidBy === 'member') continue;
    if (tx.competenceMonth >= selectedMonth) continue;
    if (tx.status !== 'paid') continue;

    if (tx.type === 'income' && tx.accountId === accountId) {
      openingBalance = Math.round((openingBalance + tx.amount) * 100) / 100;
    } else if (tx.type === 'expense' && tx.accountId === accountId) {
      openingBalance = Math.round((openingBalance - tx.amount) * 100) / 100;
    } else if (tx.type === 'transfer') {
      if (tx.accountId === accountId) {
        openingBalance = Math.round((openingBalance - tx.amount) * 100) / 100;
      } else if (tx.destinationAccountId === accountId) {
        openingBalance = Math.round((openingBalance + tx.amount) * 100) / 100;
      }
    }
  }

  // 2. Collect all transactions in selectedMonth touching this account
  const monthTxs = transactions
    .filter((tx) => {
      if (tx.creditCardId) return false;
      if (tx.isCompanionOnlyExpense || tx.sharedPaidBy === 'member') return false;
      if (tx.competenceMonth !== selectedMonth) return false;
      return tx.accountId === accountId || tx.destinationAccountId === accountId;
    })
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.id.localeCompare(b.id);
    });

  let runningProjected = openingBalance;
  let runningRealized = openingBalance;
  let monthCreditsRealized = 0;
  let monthDebitsRealized = 0;
  let monthPendingNet = 0;

  const entriesChronological: AccountStatementEntry[] = monthTxs.map((tx) => {
    const isTransferIncoming =
      tx.type === 'transfer' && tx.destinationAccountId === accountId;
    const isTransferOutgoing =
      tx.type === 'transfer' && tx.accountId === accountId;

    const direction: 'credit' | 'debit' =
      tx.type === 'income' || isTransferIncoming ? 'credit' : 'debit';
    const signedAmount = direction === 'credit' ? tx.amount : -tx.amount;

    runningProjected = Math.round((runningProjected + signedAmount) * 100) / 100;

    if (tx.status === 'paid') {
      runningRealized = Math.round((runningRealized + signedAmount) * 100) / 100;
      if (direction === 'credit') {
        monthCreditsRealized =
          Math.round((monthCreditsRealized + tx.amount) * 100) / 100;
      } else {
        monthDebitsRealized =
          Math.round((monthDebitsRealized + tx.amount) * 100) / 100;
      }
    } else {
      monthPendingNet = Math.round((monthPendingNet + signedAmount) * 100) / 100;
    }

    return {
      transaction: tx,
      direction,
      signedAmount,
      runningBalanceAfter: runningProjected,
      runningRealizedAfter: runningRealized,
      isTransferIncoming,
      isTransferOutgoing,
    };
  });

  return {
    accountId,
    openingBalance,
    closingRealizedBalance: runningRealized,
    closingProjectedBalance: runningProjected,
    monthCreditsRealized,
    monthDebitsRealized,
    monthPendingNet,
    entriesChronological,
    entriesNewestFirst: [...entriesChronological].reverse(),
  };
}

