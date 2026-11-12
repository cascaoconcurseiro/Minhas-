import type { CreditCard, Transaction } from '../types/finance';
import {
  addMonthsToYearMonth,
  calculateCreditCardSummary,
  resolveCreditCardInvoiceMonth,
} from './financeRules';

/**
 * Cartão inteligente: melhor dia de compra, projeção da fatura aberta e qual cartão usar hoje.
 * Tudo calculado das regras do próprio sistema (fechamento, vencimento, limite e histórico).
 */

export interface CardInsight {
  cardId: string;
  cardName: string;
  /** Primeiro dia do novo ciclo: compra feita nele só vence no ciclo mais distante. */
  bestPurchaseDay: number;
  /** Dias entre uma compra feita hoje e o vencimento da fatura em que ela entra. */
  daysToPayIfBoughtToday: number;
  /** Vencimento (YYYY-MM-DD) da fatura em que uma compra de hoje entra. */
  dueDateIfBoughtToday: string;
  /** Mês (YYYY-MM) da fatura aberta, aquela em que uma compra de hoje entra. */
  openInvoiceMonth: string;
  openInvoiceTotal: number;
  /** Estimativa do fechamento: o maior entre o já lançado e a média das faturas anteriores. */
  projectedInvoiceTotal: number;
  /** Quantas faturas anteriores sustentam a média (0 = sem histórico, projeção = valor atual). */
  historyMonths: number;
  availableLimit: number;
  limit: number;
}

export interface CardRecommendation {
  cardId: string;
  cardName: string;
  daysToPay: number;
  dueDate: string;
  availableLimit: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function daysInMonth(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dueDateForMonth(yearMonth: string, dueDay: number): string {
  const day = Math.min(Math.max(1, dueDay), daysInMonth(yearMonth));
  return `${yearMonth}-${String(day).padStart(2, '0')}`;
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Dia do mês em que começa o ciclo novo (o dia seguinte ao fechamento). */
export function bestPurchaseDayFor(card: Pick<CreditCard, 'closingDay'>): number {
  const closing = Math.min(Math.max(1, Math.round(card.closingDay || 1)), 31);
  return closing >= 28 ? 1 : closing + 1;
}

export function analyzeCard(
  card: CreditCard,
  transactions: Transaction[],
  referenceDate: string
): CardInsight {
  const openInvoiceMonth = resolveCreditCardInvoiceMonth(referenceDate, card);
  const dueDateIfBoughtToday = dueDateForMonth(openInvoiceMonth, card.dueDay || 1);
  const summary = calculateCreditCardSummary(card, transactions, openInvoiceMonth, referenceDate);

  // Média das faturas anteriores que tiveram valor (até 3), para estimar como a atual deve fechar.
  const previousTotals: number[] = [];
  for (let offset = 1; offset <= 3; offset += 1) {
    const month = addMonthsToYearMonth(openInvoiceMonth, -offset);
    const total = calculateCreditCardSummary(card, transactions, month, referenceDate).invoiceTotal;
    if (total > 0) previousTotals.push(total);
  }
  const average = previousTotals.length
    ? previousTotals.reduce((sum, value) => sum + value, 0) / previousTotals.length
    : 0;

  const openInvoiceTotal = round2(summary.invoiceTotal);
  return {
    cardId: card.id,
    cardName: card.name,
    bestPurchaseDay: bestPurchaseDayFor(card),
    daysToPayIfBoughtToday: daysBetween(referenceDate, dueDateIfBoughtToday),
    dueDateIfBoughtToday,
    openInvoiceMonth,
    openInvoiceTotal,
    projectedInvoiceTotal: round2(Math.max(openInvoiceTotal, average)),
    historyMonths: previousTotals.length,
    availableLimit: round2(summary.availableLimit),
    limit: card.limit,
  };
}

export function analyzeCards(
  cards: CreditCard[],
  transactions: Transaction[],
  referenceDate: string
): CardInsight[] {
  return cards.map((card) => analyzeCard(card, transactions, referenceDate));
}

/**
 * Qual cartão usar numa compra hoje: o que dá mais dias até pagar, entre os que têm limite
 * para o valor (ou qualquer valor, se não for informado). Só faz sentido com 2 ou mais cartões.
 */
export function recommendCardForPurchase(
  insights: CardInsight[],
  amount = 0
): CardRecommendation | null {
  if (insights.length < 2) return null;
  const eligible = insights.filter((item) => item.availableLimit > 0 && item.availableLimit >= amount);
  if (eligible.length === 0) return null;
  const best = [...eligible].sort(
    (a, b) => b.daysToPayIfBoughtToday - a.daysToPayIfBoughtToday || b.availableLimit - a.availableLimit
  )[0];
  return {
    cardId: best.cardId,
    cardName: best.cardName,
    daysToPay: best.daysToPayIfBoughtToday,
    dueDate: best.dueDateIfBoughtToday,
    availableLimit: best.availableLimit,
  };
}
