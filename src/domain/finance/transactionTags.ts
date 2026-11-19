import type {
  Transaction,
} from '../../types/finance';
import {
  normalizeSearchText,
} from './transactionSearch.ts';

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
