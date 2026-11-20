/** Sugestão de categoria a partir da descrição. */
import type {
  Category,
  CategoryIconName,
  Transaction,
} from '../../types/finance';
import {
  isOutsidePersonalResult,
} from '../finance/financeRules';
import {
  matchCategoryByDescription,
} from '../finance/categoryMatching';
import {
  normalizeText,
  stripInstallmentSuffix,
} from './transactionSuggestions.ts';

export interface SmartCategorySuggestion {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: CategoryIconName;
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
 * the most probable category weighted by similarity, recency, and frequency.
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
    mostRecentDate: string;
  }

  const candidateMap = new Map<string, CandidateAccumulator>();

  for (const tx of transactions) {
    if (tx.isInvoicePayment || tx.type === 'transfer' || isOutsidePersonalResult(tx)) {
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
    return {
      categoryId: merchantCategory.id,
      categoryName: merchantCategory.name,
      categoryColor: merchantCategory.color,
      categoryIcon: merchantCategory.icon,
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
