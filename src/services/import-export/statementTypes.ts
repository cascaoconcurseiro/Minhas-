/** Tipos do extrato importado e dos candidatos de conciliação. */
import {
  type LearnedSharing,
} from '../../domain/budgets/learningRules';

export interface ParsedBankStatementItem {
  fitid?: string;
  date: string; // YYYY-MM-DD
  amount: number; // positive for income, negative for expense
  description: string;
  memo?: string;
  trntype?: string;
  rawType: 'income' | 'expense';
}

export interface BankStatementMetadata {
  bankId?: string;
  accountId?: string;
  currency?: string;
  statementStart?: string;
  statementEnd?: string;
}

export interface ReconciliationCandidate {
  id: string;
  fitid?: string;
  date: string;
  amount: number;
  sourceAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;
  type: 'income' | 'expense';
  description: string;
  memo?: string;
  suggestedCategoryId: string;
  isPotentialInvoicePayment?: boolean;
  isInvoicePayment?: boolean;
  settledCardId?: string;
  settledInvoiceMonth?: string;
  isDuplicate: boolean;
  duplicateReason?: string;
  selected: boolean;
  /** De onde veio a categoria sugerida: do histórico da pessoa ou de uma regra de estabelecimento. */
  suggestedCategorySource?: 'history' | 'rule';
  /** Conta pendente que esta linha do extrato quita (em vez de criar um lançamento novo). */
  matchedPendingId?: string;
  matchedPendingDescription?: string;
  /** Divisão com familiar aprendida com o histórico para este estabelecimento. */
  learnedSharing?: LearnedSharing;
}

export interface ParseStatementResult {
  metadata: BankStatementMetadata;
  items: ParsedBankStatementItem[];
  fileFormat: 'ofx' | 'csv' | 'unknown';
  totalCredits: number;
  totalDebits: number;
  netFlow: number;
  skippedInvalidCount: number;
}

/**
 * Normalizes an OFX date string into standard YYYY-MM-DD.
 * Formats encountered:
 * - 20261021120000[-3:BRT]
 * - 20261021
 * - 2026-10-21
 */
