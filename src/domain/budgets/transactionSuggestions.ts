/** Sugestões de lançamento a partir do histórico (descrição parecida). */
import type {
  PaymentMethod,
  Transaction,
} from '../../types/finance';

export interface SmartTransactionSuggestion {
  cleanDescription: string;
  categoryId: string;
  accountId?: string;
  creditCardId?: string;
  paymentMethod: PaymentMethod;
  lastAmount: number;
  occurrences: number;
}


export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function stripInstallmentSuffix(desc: string): string {
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
