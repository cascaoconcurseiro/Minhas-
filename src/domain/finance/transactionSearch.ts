import type {
  Category,
  Transaction,
} from '../../types/finance';
import {
  getEffectiveExpenseAmountForUser,
} from './monthlyReports.ts';
import {
  isSharedOnlyExpense,
} from './transactionClassification.ts';

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
    if (isSharedOnlyExpense(tx)) continue;
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

    const normDesc = normalizeSearchText(tx.description);
    const normCat = normalizeSearchText(categoryName);
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
      });
    }
  }

  return [...matches].sort((a, b) => a.transaction.date.localeCompare(b.transaction.date));
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
