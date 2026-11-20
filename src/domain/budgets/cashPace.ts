/** Ritmo de gasto do mês e pulso semanal de caixa. */
import type {
  Transaction,
} from '../../types/finance';
import {
  getEffectiveExpenseAmountForUser,
  getPurchaseTransactionsForMonth,
  isOutsidePersonalResult,
} from '../finance/financeRules';

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

  const monthTxs = getPurchaseTransactionsForMonth(transactions, selectedMonth).filter(
    (tx) =>
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
      if (isOutsidePersonalResult(tx)) continue;
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
