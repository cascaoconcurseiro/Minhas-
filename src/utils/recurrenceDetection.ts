import type { PaymentMethod, Transaction } from '../types/finance';
import { addMonthsToYearMonth, getClampedMonthDate } from './financeRules';
import { normalizeDescription } from './learningRules';

/**
 * Detecta gastos que se repetem todo mês (assinaturas, mensalidades, contas) a partir do histórico,
 * para sugerir "prever os próximos meses". Só olha o que ainda não está agendado como fixo.
 */
export interface RecurringCandidate {
  /** Nome normalizado do estabelecimento; identifica a sugestão (e o "ignorar"). */
  key: string;
  description: string;
  categoryId: string;
  accountId?: string;
  creditCardId?: string;
  paymentMethod: PaymentMethod;
  /** Valor do último lançamento (o preço atual). */
  lastAmount: number;
  /** Mediana dos valores recentes. */
  typicalAmount: number;
  /** O valor mudou pouco entre os meses (assinatura) ou varia (conta de consumo). */
  amountPattern: 'stable' | 'variable';
  dayOfMonth: number;
  /** Quantos meses seguidos foram encontrados. */
  monthsInARow: number;
  lastDate: string;
  nextExpectedDate: string;
  /** Ainda não apareceu neste mês e já passou do dia esperado. */
  missingThisMonth: boolean;
  /** Variação do último valor contra o anterior, quando relevante (ex.: aumento de assinatura). */
  priceChange?: { from: number; to: number; percent: number };
  confidence: number;
  transactionIds: string[];
}

const MIN_MONTHS_IN_A_ROW = 3;
const MAX_LOOKBACK_MONTHS = 6;
const STABLE_TOLERANCE = 0.1;
const VARIABLE_TOLERANCE = 0.4;
const DAY_TOLERANCE = 4;
const PRICE_CHANGE_MIN_PERCENT = 5;
const MISSING_GRACE_DAYS = 3;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isEligible(tx: Transaction): boolean {
  return (
    tx.type === 'expense' &&
    !tx.isInvoicePayment &&
    !tx.isCompanionOnlyExpense &&
    !tx.tripId &&
    !tx.id.startsWith('tx-mirror-') &&
    tx.recurrence === 'single' &&
    tx.amount > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(tx.date)
  );
}

export function detectRecurringExpenses(
  transactions: Transaction[],
  referenceDate: string,
  dismissedKeys: string[] = []
): RecurringCandidate[] {
  const currentMonth = referenceDate.slice(0, 7);
  const today = Number(referenceDate.slice(8, 10));
  const dismissed = new Set(dismissedKeys);

  // O que já está agendado (fixo ou parcelado) não precisa ser sugerido de novo.
  const scheduledKeys = new Set(
    transactions
      .filter((tx) => tx.type === 'expense' && tx.recurrence !== 'single')
      .map((tx) => normalizeDescription(tx.description))
  );

  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (!isEligible(tx)) continue;
    const key = normalizeDescription(tx.description);
    if (key.length < 2 || dismissed.has(key) || scheduledKeys.has(key)) continue;
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  const candidates: RecurringCandidate[] = [];
  for (const [key, txs] of groups) {
    // Um lançamento por mês (o mais recente do mês)
    const byMonth = new Map<string, Transaction>();
    for (const tx of [...txs].sort((a, b) => a.date.localeCompare(b.date))) {
      byMonth.set(tx.date.slice(0, 7), tx);
    }
    const months = [...byMonth.keys()].sort();
    const lastMonth = months[months.length - 1];

    // A sequência precisa estar viva: o último mês é o atual ou o anterior.
    if (lastMonth !== currentMonth && lastMonth !== addMonthsToYearMonth(currentMonth, -1)) continue;

    // Meses seguidos, contando de trás para frente
    const chain: string[] = [lastMonth];
    for (let i = months.length - 2; i >= 0 && chain.length < MAX_LOOKBACK_MONTHS; i--) {
      if (months[i] !== addMonthsToYearMonth(chain[0], -1)) break;
      chain.unshift(months[i]);
    }
    if (chain.length < MIN_MONTHS_IN_A_ROW) continue;

    const chainTxs = chain.map((month) => byMonth.get(month) as Transaction);
    const amounts = chainTxs.map((tx) => tx.amount);
    const typicalAmount = median(amounts);
    const maxDeviation = Math.max(...amounts.map((amount) => Math.abs(amount - typicalAmount) / typicalAmount));
    if (maxDeviation > VARIABLE_TOLERANCE) continue;

    const days = chainTxs.map((tx) => Number(tx.date.slice(8, 10)));
    const dayOfMonth = Math.round(median(days));
    if (days.some((day) => Math.abs(day - dayOfMonth) > DAY_TOLERANCE)) continue;

    const last = chainTxs[chainTxs.length - 1];
    const amountPattern: 'stable' | 'variable' = maxDeviation <= STABLE_TOLERANCE ? 'stable' : 'variable';

    const nextMonth = lastMonth === currentMonth ? addMonthsToYearMonth(currentMonth, 1) : currentMonth;
    const nextExpectedDate = getClampedMonthDate(nextMonth, dayOfMonth);
    const missingThisMonth =
      lastMonth !== currentMonth && today >= Math.min(28, dayOfMonth) + MISSING_GRACE_DAYS;

    let priceChange: RecurringCandidate['priceChange'];
    if (amountPattern === 'variable' || chainTxs.length >= 3) {
      const previous = amounts.slice(0, -1);
      const previousMedian = median(previous);
      const previousStable = previous.every((amount) => Math.abs(amount - previousMedian) / previousMedian <= 0.03);
      const percent = ((last.amount - previousMedian) / previousMedian) * 100;
      if (previousStable && Math.abs(percent) >= PRICE_CHANGE_MIN_PERCENT) {
        priceChange = { from: round2(previousMedian), to: round2(last.amount), percent: Math.round(percent * 10) / 10 };
      }
    }

    const confidence = Math.min(
      0.98,
      (amountPattern === 'stable' ? 0.82 : 0.66) + Math.min(0.12, (chain.length - MIN_MONTHS_IN_A_ROW) * 0.04)
    );

    candidates.push({
      key,
      description: last.description.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim(),
      categoryId: last.categoryId,
      accountId: last.accountId,
      creditCardId: last.creditCardId,
      paymentMethod: last.paymentMethod,
      lastAmount: round2(last.amount),
      typicalAmount: round2(typicalAmount),
      amountPattern,
      dayOfMonth,
      monthsInARow: chain.length,
      lastDate: last.date,
      nextExpectedDate,
      missingThisMonth,
      priceChange,
      confidence: Math.round(confidence * 100) / 100,
      transactionIds: chainTxs.map((tx) => tx.id),
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence || b.lastAmount - a.lastAmount);
}
