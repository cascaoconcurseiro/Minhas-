/** Agrupamento do extrato por dia e cabeçalhos de data em português. */
import type {
  Transaction,
} from '../../types/finance';
import {
  getEffectiveExpenseAmountForUser,
  getLocalDateISO,
  isOutsidePersonalResult,
} from '../finance/financeRules';

export interface DailyTransactionGroup {
  date: string;
  dayHeaderLabel: string;
  weekdayLabel: string;
  dayIncome: number;
  dayExpense: number;
  dayNet: number;
  transactions: Transaction[];
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
 * Formats a YYYY-MM-DD date string into a friendly Brazilian daily group header.
 */
export function formatDailyGroupHeaderPT(
  dateStr: string,
  referenceDateStr = getLocalDateISO()
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
  referenceDateStr = getLocalDateISO()
): DailyTransactionGroup[] {
  const map = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    const key = tx.date;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(tx);
  }

  const sortedDates = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));

  return sortedDates.map((dateStr) => {
    const dayTxs = map.get(dateStr) || [];
    let dayIncome = 0;
    let dayExpense = 0;

    for (const tx of dayTxs) {
      if (tx.isInvoicePayment || tx.type === 'transfer') continue;
      if (isOutsidePersonalResult(tx)) continue;
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
