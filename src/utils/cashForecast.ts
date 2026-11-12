import type { BankAccount, CreditCard, Transaction } from '../types/finance';
import {
  addMonthsToYearMonth,
  calculateAccountBalances,
  calculateDailyCashFlow,
  getPendingBankMovements,
} from './financeRules';

/**
 * Previsão do saldo dos próximos dias: parte do que já aconteceu, soma o que está agendado
 * (contas a pagar e a receber, lançamentos fixos, parcelas e faturas de cartão no vencimento) e
 * mostra onde o saldo fica mais baixo ou negativo. Considera só contas incluídas no total.
 */
export interface ForecastPoint {
  date: string;
  /** Saldo previsto ao fim do dia. */
  balance: number;
  /** O quanto o dia mexe no saldo (entradas menos saídas). */
  delta: number;
}

export interface CashForecast {
  points: ForecastPoint[];
  startBalance: number;
  endBalance: number;
  lowPoint: { date: string; balance: number };
  /** Primeiro dia em que o saldo previsto fica abaixo de zero, se houver. */
  firstNegative: { date: string; balance: number } | null;
  horizonDays: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function forecastCashBalance(
  accounts: BankAccount[],
  cards: CreditCard[],
  transactions: Transaction[],
  referenceDate: string,
  horizonDays = 45
): CashForecast | null {
  const included = accounts.filter((account) => account.includeInTotal);
  if (included.length === 0) return null;
  const includedIds = new Set(included.map((account) => account.id));

  const endDate = addDays(referenceDate, horizonDays);
  const firstMonth = referenceDate.slice(0, 7);
  const months: string[] = [];
  for (let month = firstMonth; month <= endDate.slice(0, 7); month = addMonthsToYearMonth(month, 1)) {
    months.push(month);
  }

  // Quanto cada dia mexe no saldo, reconstruído a partir do fluxo diário de cada mês
  const deltas = new Map<string, number>();
  let monthStartBalance = 0;
  months.forEach((month, index) => {
    const opening = calculateAccountBalances(accounts, transactions, addMonthsToYearMonth(month, -1))
      .filter((balance) => includedIds.has(balance.accountId))
      .reduce((sum, balance) => sum + balance.currentBalance, 0);
    if (index === 0) monthStartBalance = opening;
    let previous = opening;
    for (const point of calculateDailyCashFlow(accounts, cards, transactions, month)) {
      deltas.set(point.date, round2(point.projectedBalance - previous));
      previous = point.projectedBalance;
    }
  });

  // Contas atrasadas de meses anteriores: assume que serão resolvidas hoje
  const overdue = getPendingBankMovements(transactions, firstMonth, referenceDate).filter(
    (tx) =>
      (tx.competenceMonth || tx.date.slice(0, 7)) < firstMonth &&
      (!tx.accountId || includedIds.has(tx.accountId))
  );
  const overdueDelta = overdue.reduce(
    (sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount),
    0
  );

  // Saldo previsto de hoje = início do mês + tudo o que já está (ou deveria estar) lançado até hoje
  let balance = monthStartBalance + overdueDelta;
  for (let date = `${firstMonth}-01`; date <= referenceDate; date = addDays(date, 1)) {
    balance += deltas.get(date) ?? 0;
  }
  const startBalance = round2(balance);

  const points: ForecastPoint[] = [];
  for (let date = addDays(referenceDate, 1); date <= endDate; date = addDays(date, 1)) {
    const delta = deltas.get(date) ?? 0;
    balance += delta;
    points.push({ date, balance: round2(balance), delta: round2(delta) });
  }
  if (points.length === 0) return null;

  const lowest = points.reduce((low, point) => (point.balance < low.balance ? point : low), points[0]);
  const negative = points.find((point) => point.balance < 0) ?? null;
  return {
    points,
    startBalance,
    endBalance: points[points.length - 1].balance,
    lowPoint: { date: lowest.date, balance: lowest.balance },
    firstNegative: negative ? { date: negative.date, balance: negative.balance } : null,
    horizonDays,
  };
}
