import type { PaymentMethod, Transaction } from '../types/finance';
import { formatBRL } from './financeRules';
import { normalizeDescription, sameEstablishment } from './learningRules';

/**
 * Camada de decisão do sistema (local, sem enviar dados para fora).
 * Toda decisão devolve valor + confiança + motivo, e o sistema só aplica sozinho quando a confiança
 * é alta; abaixo disso, no máximo sugere. Decisões são tipadas, para o código usá-las sem interpretar texto.
 */
export interface Decision<T> {
  value: T;
  /** 0 a 1. */
  confidence: number;
  /** Quantas observações apontam para o valor escolhido. */
  support: number;
  /** Quantas observações foram consideradas. */
  total: number;
  reason: string;
}

export interface ChoiceOptions {
  minSupport?: number;
  minConfidence?: number;
}

const DEFAULT_MIN_SUPPORT = 2;
const DEFAULT_MIN_CONFIDENCE = 0.7;

/**
 * "Choice": escolhe a alternativa dominante entre observações do passado (mais recentes primeiro).
 * Observações recentes pesam mais; poucas observações reduzem a confiança.
 */
export function decideChoice<T extends string>(
  observations: Array<T | undefined | null | ''>,
  options: ChoiceOptions = {}
): Decision<T> | null {
  const minSupport = options.minSupport ?? DEFAULT_MIN_SUPPORT;
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const valid = observations.filter((value): value is T => Boolean(value));
  if (valid.length < minSupport) return null;

  const weights = new Map<T, { weight: number; count: number }>();
  let totalWeight = 0;
  valid.forEach((value, index) => {
    const weight = 1 / (1 + 0.25 * index);
    totalWeight += weight;
    const current = weights.get(value) ?? { weight: 0, count: 0 };
    weights.set(value, { weight: current.weight + weight, count: current.count + 1 });
  });

  let best: T | null = null;
  let bestEntry = { weight: 0, count: 0 };
  for (const [value, entry] of weights) {
    if (entry.weight > bestEntry.weight) {
      best = value;
      bestEntry = entry;
    }
  }
  if (best === null || bestEntry.count < minSupport) return null;

  const share = bestEntry.weight / totalWeight;
  const evidenceFactor = Math.min(1, 0.5 + 0.1 * valid.length);
  const confidence = Math.round(share * evidenceFactor * 100) / 100;
  if (confidence < minConfidence) return null;
  return {
    value: best,
    confidence,
    support: bestEntry.count,
    total: valid.length,
    reason: `${bestEntry.count} de ${valid.length} lançamentos parecidos`,
  };
}

function recentSimilar(
  description: string,
  transactions: Transaction[],
  predicate: (tx: Transaction) => boolean,
  limit = 6
): Transaction[] {
  const key = normalizeDescription(description);
  if (key.length < 2) return [];
  return transactions
    .filter(
      (tx) =>
        !tx.isInvoicePayment &&
        !tx.isCompanionOnlyExpense &&
        !tx.tripId &&
        !tx.id.startsWith('tx-mirror-') &&
        predicate(tx) &&
        sameEstablishment(key, normalizeDescription(tx.description))
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

/** Aprende a categoria usual de um estabelecimento (usada também na importação de extrato). */
export function learnCategoryHabit(
  description: string,
  transactions: Transaction[],
  type: 'income' | 'expense'
): Decision<string> | null {
  const history = recentSimilar(description, transactions, (tx) => tx.type === type);
  return decideChoice(history.map((tx) => tx.categoryId));
}

export interface PaymentHabit {
  accountId?: Decision<string>;
  creditCardId?: Decision<string>;
  paymentMethod?: Decision<PaymentMethod>;
}

/** Aprende de onde costuma sair o dinheiro (conta, cartão e forma de pagamento) para um estabelecimento. */
export function learnPaymentHabit(
  description: string,
  transactions: Transaction[],
  entryMode: 'expense' | 'credit_card'
): PaymentHabit {
  const history = recentSimilar(
    description,
    transactions,
    (tx) =>
      tx.type === 'expense' && (entryMode === 'credit_card' ? Boolean(tx.creditCardId) : !tx.creditCardId)
  );
  const habit: PaymentHabit = {};
  if (entryMode === 'credit_card') {
    const card = decideChoice(history.map((tx) => tx.creditCardId));
    if (card) habit.creditCardId = card;
  } else {
    const account = decideChoice(history.map((tx) => tx.accountId));
    if (account) habit.accountId = account;
    const method = decideChoice<PaymentMethod>(history.map((tx) => tx.paymentMethod));
    if (method) habit.paymentMethod = method;
  }
  return habit;
}

export interface AmountAssessment {
  level: 'high';
  /** Valor típico (mediana) deste estabelecimento. */
  typical: number;
  /** Quantas vezes o valor digitado é maior que o típico. */
  ratio: number;
  observations: number;
  message: string;
}

const MIN_OBSERVATIONS_FOR_AMOUNT = 3;
const HIGH_AMOUNT_RATIO = 2;
const MIN_ABSOLUTE_DIFFERENCE = 20;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** "Score": avisa quando o valor digitado foge muito do que a pessoa costuma gastar ali. */
export function assessAmount(
  description: string,
  amount: number,
  transactions: Transaction[]
): AmountAssessment | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const history = recentSimilar(description, transactions, (tx) => tx.type === 'expense' && tx.amount > 0, 8);
  // Parcelas da mesma compra não são "gastos repetidos".
  const distinct = history.filter((tx) => tx.recurrence !== 'installment');
  if (distinct.length < MIN_OBSERVATIONS_FOR_AMOUNT) return null;

  const typical = median(distinct.map((tx) => tx.amount));
  if (typical <= 0) return null;
  const ratio = amount / typical;
  if (ratio < HIGH_AMOUNT_RATIO || amount - typical < MIN_ABSOLUTE_DIFFERENCE) return null;
  return {
    level: 'high',
    typical,
    ratio: Math.round(ratio * 10) / 10,
    observations: distinct.length,
    message: `Valor ${String(Math.round(ratio * 10) / 10).replace('.', ',')}x maior que o usual neste lugar (costuma ser ${formatBRL(typical)}).`,
  };
}

export interface DuplicateSuspicion {
  transactionId: string;
  date: string;
  message: string;
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000));
}

/**
 * Este lançamento provavelmente já foi registrado? Vale para despesa, receita e transferência.
 * Mesma descrição, mesmo valor e até 2 dias de diferença. Transferência também exige a mesma
 * origem e o mesmo destino (duas transferências de mesmo valor entre contas diferentes são normais).
 */
export function findProbableDuplicate(
  input: {
    description: string;
    amount: number;
    date: string;
    type?: 'expense' | 'income' | 'transfer';
    accountId?: string;
    /** Conta de destino ou `inv:<id>` quando o destino é um ativo de investimento. */
    destinationKey?: string;
  },
  transactions: Transaction[],
  ignoreTransactionId?: string
): DuplicateSuspicion | null {
  const key = normalizeDescription(input.description);
  if (key.length < 2 || !Number.isFinite(input.amount) || input.amount <= 0) return null;
  const type = input.type ?? 'expense';
  const match = transactions.find((tx) => {
    if (
      tx.id === ignoreTransactionId ||
      tx.type !== type ||
      tx.isInvoicePayment ||
      tx.id.startsWith('tx-mirror-') ||
      tx.id.startsWith('tx-reimb-') ||
      // Parcelas e lançamentos fixos se repetem por natureza
      tx.recurrence === 'installment' ||
      tx.recurrence === 'fixed' ||
      Math.abs(tx.amount - input.amount) >= 0.01 ||
      normalizeDescription(tx.description) !== key ||
      daysBetween(tx.date, input.date) > 2
    ) {
      return false;
    }
    if (type === 'transfer') {
      const txDestination =
        tx.destinationAccountId || (tx.targetInvestmentAssetId ? `inv:${tx.targetInvestmentAssetId}` : '');
      if ((tx.accountId || '') !== (input.accountId || '') || txDestination !== (input.destinationKey || '')) {
        return false;
      }
    }
    return true;
  });
  if (!match) return null;
  const [year, month, day] = match.date.split('-');
  const label = type === 'income' ? 'uma receita igual' : type === 'transfer' ? 'uma transferência igual' : 'um lançamento igual';
  return {
    transactionId: match.id,
    date: match.date,
    message: `Já existe ${label} em ${day}/${month}/${year} (${formatBRL(match.amount)}). Confira para não duplicar.`,
  };
}
