import type { BankAccount, Transaction } from '../../types/finance';
import { addMonthsToYearMonth } from '../finance/formatting.ts';
import { getDomesticSharedTransactions } from '../family/sharedFinanceRules.ts';
import { isCreditCardInvoicePurchase } from '../finance/transactionClassification.ts';

/**
 * Previsão mês a mês: parte do saldo de hoje e soma, para cada um dos próximos meses, o que ainda está pendente
 * (entradas, faturas dos cartões no mês da fatura e contas no banco). Opcionalmente soma uma estimativa de compras
 * novas no cartão, pela média das compras à vista dos meses que já existem. Contas atrasadas entram no mês atual.
 */
export interface MonthlyForecastRow {
  month: string;
  income: number;
  cardInvoices: number;
  bankExpenses: number;
  /** Compras novas estimadas no cartão (0 quando a estimativa está desligada ou não há histórico). */
  estimatedPurchases: number;
  /** Entradas menos tudo o que sai. */
  net: number;
  /** Saldo no fim do mês, só com o que está previsto. */
  balance: number;
  /** Compartilhados que você pagou e as pessoas ainda te devem naquele mês (inclui a parte estimada). */
  owedByPeople: number;
  /** Saldo no fim do mês se as pessoas pagarem o que devem. */
  balanceWithOwed: number;
}

export interface MonthlyForecast {
  startBalance: number;
  rows: MonthlyForecastRow[];
  /** Base da estimativa de compras novas (null quando não há compras à vista para tirar a média). */
  estimate: { monthlyAverage: number; monthsUsed: number } | null;
  firstNegativeMonth: string | null;
  /** Último mês com entrada, quando os meses seguintes ficam sem nenhuma (provável lançamento fixo que acabou). */
  incomeEndsAfter: string | null;
  /** Contas pendentes de meses passados, somadas ao mês atual. */
  overdueCount: number;
}

const cents = (value: number) => Math.round(value * 100);

export function buildMonthlyForecast(input: {
  accounts: BankAccount[];
  transactions: Transaction[];
  startBalance: number;
  referenceDate: string;
  months?: number;
  includeEstimate?: boolean;
}): MonthlyForecast {
  const { accounts, transactions, referenceDate, includeEstimate = true } = input;
  const horizon = input.months ?? 12;
  const currentMonth = referenceDate.slice(0, 7);
  const monthList = Array.from({ length: horizon }, (_, index) => addMonthsToYearMonth(currentMonth, index));
  const index = new Map(monthList.map((month, position) => [month, position]));
  const includedAccounts = new Set(accounts.filter((account) => account.includeInTotal).map((account) => account.id));
  const accountCounts = (tx: Transaction) => !tx.accountId || includedAccounts.has(tx.accountId);
  const bucket = (tx: Transaction) => {
    const month = tx.competenceMonth || tx.date.slice(0, 7);
    return month < currentMonth ? currentMonth : month;
  };

  const income = new Array<number>(horizon).fill(0);
  const cardInvoices = new Array<number>(horizon).fill(0);
  const bankExpenses = new Array<number>(horizon).fill(0);
  const cashSharedOwed = new Array<number>(horizon).fill(0);
  const cardCashOnlyAVista = new Array<number>(horizon).fill(0);
  let overdueCount = 0;

  const countable = (tx: Transaction) =>
    tx.status === 'pending' && !tx.isInvoicePayment && !tx.id.startsWith('tx-mirror-') &&
    !tx.isCompanionOnlyExpense && tx.sharedPaidBy !== 'member';

  for (const tx of transactions) {
    if (!countable(tx)) continue;
    const position = index.get(bucket(tx));
    if (position === undefined) continue;
    if ((tx.competenceMonth || tx.date.slice(0, 7)) < currentMonth) overdueCount += 1;
    if (tx.creditCardId) {
      if (!isCreditCardInvoicePurchase(tx)) continue;
      cardInvoices[position] += cents(tx.amount);
      if (!tx.installmentGroupId && tx.recurrence !== 'fixed') cardCashOnlyAVista[position] += cents(tx.amount);
    } else if (tx.type === 'income' && accountCounts(tx)) {
      income[position] += cents(tx.amount);
    } else if (tx.type === 'expense' && accountCounts(tx)) {
      bankExpenses[position] += cents(tx.amount);
    }
  }

  for (const tx of getDomesticSharedTransactions(transactions)) {
    if (tx.id.startsWith('tx-mirror-') || tx.sharedPaidBy === 'member' || tx.sharedStatus === 'received') continue;
    const position = index.get(bucket(tx));
    if (position !== undefined) cashSharedOwed[position] += cents(tx.sharedAmount || 0);
  }

  // Estimativa de compras novas: média das compras à vista (nem parcelas nem fixos) dos meses de fatura já lançados,
  // pegando até 3 meses a partir de 3 meses atrás. Nos meses futuros entra só o que falta para chegar à média.
  const history = new Map<string, { total: number; shared: number }>();
  for (const tx of transactions) {
    if (!tx.creditCardId || !isCreditCardInvoicePurchase(tx) || tx.installmentGroupId || tx.recurrence === 'fixed' ||
        tx.receivableId || tx.isCardRefund || tx.tripId) continue;
    const month = tx.competenceMonth || tx.date.slice(0, 7);
    if (month < addMonthsToYearMonth(currentMonth, -3)) continue;
    const entry = history.get(month) ?? { total: 0, shared: 0 };
    entry.total += cents(tx.amount);
    entry.shared += tx.sharedPaidBy === 'me' ? cents(tx.sharedAmount || 0) : 0;
    history.set(month, entry);
  }
  const used = [...history.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 3).map(([, value]) => value);
  const averageCents = used.length ? Math.round(used.reduce((sum, value) => sum + value.total, 0) / used.length) : 0;
  const averageSharedCents = used.length ? Math.round(used.reduce((sum, value) => sum + value.shared, 0) / used.length) : 0;
  const estimateActive = includeEstimate && averageCents > 0;

  const rows: MonthlyForecastRow[] = [];
  let balanceCents = cents(input.startBalance);
  let owedCumulative = 0;
  monthList.forEach((month, position) => {
    const estimated = estimateActive ? Math.max(0, averageCents - cardCashOnlyAVista[position]) : 0;
    const estimatedShared = estimateActive && averageCents > 0
      ? Math.round(averageSharedCents * (estimated / averageCents)) : 0;
    const netCents = income[position] - cardInvoices[position] - bankExpenses[position] - estimated;
    balanceCents += netCents;
    const owed = cashSharedOwed[position] + estimatedShared;
    owedCumulative += owed;
    rows.push({
      month,
      income: income[position] / 100,
      cardInvoices: cardInvoices[position] / 100,
      bankExpenses: bankExpenses[position] / 100,
      estimatedPurchases: estimated / 100,
      net: netCents / 100,
      balance: balanceCents / 100,
      owedByPeople: owed / 100,
      balanceWithOwed: (balanceCents + owedCumulative) / 100,
    });
  });

  const lastIncome = rows.reduce((last, row, position) => (row.income > 0 ? position : last), -1);
  return {
    startBalance: input.startBalance,
    rows,
    estimate: used.length && averageCents > 0 ? { monthlyAverage: averageCents / 100, monthsUsed: used.length } : null,
    firstNegativeMonth: rows.find((row) => row.balance < 0)?.month ?? null,
    incomeEndsAfter: lastIncome >= 0 && lastIncome < rows.length - 1 ? rows[lastIncome].month : null,
    overdueCount,
  };
}
