import type {
  BankAccount,
  CreditCard,
  DailyCashFlowPoint,
  Transaction,
} from '../../types/finance';
import {
  formatBRL,
  addMonthsToYearMonth,
  getClampedMonthDate,
  formatMonthYearPT,
} from './formatting.ts';
import {
  calculateAccountBalances,
} from './accountBalances.ts';
import {
  getEffectiveExpenseAmountForUser,
} from './monthlyReports.ts';
import {
  getCashMovementMonth,
  isCreditCardInvoicePurchase,
  isOutsidePersonalResult,
  isSharedOnlyExpense,
} from './transactionClassification.ts';

export function calculateDailyCashFlow(
  accounts: BankAccount[],
  cards: CreditCard[],
  transactions: Transaction[],
  selectedMonth: string
): DailyCashFlowPoint[] {
  const [yStr, mStr] = selectedMonth.split('-');
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  const prevMonth = addMonthsToYearMonth(selectedMonth, -1);
  const openingBalances = calculateAccountBalances(accounts, transactions, prevMonth);
  const includedIds = new Set(accounts.filter((a) => a.includeInTotal).map((a) => a.id));

  let runningRealized = openingBalances
    .filter((b) => includedIds.has(b.accountId))
    .reduce((sum, b) => sum + b.currentBalance, 0);
  // A projeção abre com tudo o que ficou pendente (a pagar/receber) em meses anteriores, igual ao saldo projetado
  // mensal: item vencido e ainda não pago entra no começo do mês em vez de sumir da curva.
  let runningProjected = openingBalances
    .filter((b) => includedIds.has(b.accountId))
    .reduce((sum, b) => sum + b.projectedBalance, 0);

  const monthBankTxs = transactions.filter(
    (tx) =>
      getCashMovementMonth(tx) === selectedMonth &&
      (!tx.creditCardId || tx.isInvoicePayment) &&
      !tx.isCompanionOnlyExpense &&
      tx.sharedPaidBy !== 'member'
  );
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const cardInvoiceOutflowsByDate = new Map<string, number>();
  // Explica cada saída de fatura: data -> (texto -> centavos), para o aviso na tabela.
  const outflowNotesByDate = new Map<string, Map<string, number>>();
  const addOutflowNote = (date: string, label: string, cents: number) => {
    const byLabel = outflowNotesByDate.get(date) ?? new Map<string, number>();
    byLabel.set(label, (byLabel.get(label) || 0) + cents);
    outflowNotesByDate.set(date, byLabel);
  };
  for (const tx of transactions) {
    if (
      !tx.creditCardId ||
      tx.status !== 'pending' ||
      !isCreditCardInvoicePurchase(tx) ||
      tx.competenceMonth > selectedMonth ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(tx.competenceMonth) ||
      !Number.isFinite(tx.amount) ||
      tx.amount === 0
    ) continue; // estorno no cartão (valor negativo) reduz a fatura que vence

    // Older unpaid invoices are overdue at the start of this month's cash forecast.
    const dueDate = tx.competenceMonth < selectedMonth
      ? `${selectedMonth}-01`
      : getClampedMonthDate(selectedMonth, cardById.get(tx.creditCardId)?.dueDay ?? 1);
    const amountCents = Math.round(tx.amount * 100);
    if (!Number.isSafeInteger(amountCents)) continue;
    cardInvoiceOutflowsByDate.set(
      dueDate,
      (cardInvoiceOutflowsByDate.get(dueDate) || 0) + amountCents
    );
    const cardName = cardById.get(tx.creditCardId)?.name ?? 'cartão';
    addOutflowNote(
      dueDate,
      tx.competenceMonth < selectedMonth
        ? `Fatura de ${formatMonthYearPT(tx.competenceMonth)} do ${cardName}, ainda não paga (em atraso): entra no dia 1 do mês`
        : `Fatura de ${formatMonthYearPT(tx.competenceMonth)} do ${cardName}: vencimento neste dia`,
      amountCents
    );
  }

  const points: DailyCashFlowPoint[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
    const dayTxs = monthBankTxs.filter((tx) => tx.date === dayStr);

    let dayIncome = 0;
    let dayExpense = 0;

    for (const tx of dayTxs) {
      const isAccountIncluded = !tx.accountId || includedIds.has(tx.accountId);

      if (tx.type === 'income') {
        if (!isAccountIncluded) continue;
        dayIncome += tx.amount;
        runningProjected += tx.amount;
        if (tx.status === 'paid') runningRealized += tx.amount;
      } else if (tx.type === 'expense') {
        if (!isAccountIncluded) continue;
        dayExpense += tx.amount;
        runningProjected -= tx.amount;
        if (tx.status === 'paid') runningRealized -= tx.amount;
      } else if (tx.type === 'transfer') {
        const fromIncluded = Boolean(tx.accountId && includedIds.has(tx.accountId));
        const toIncluded = Boolean(
          tx.destinationAccountId && includedIds.has(tx.destinationAccountId)
        );
        // Transfer out of liquid included accounts (e.g., direct investment contribution or transfer to excluded account)
        if (fromIncluded && !toIncluded) {
          runningProjected -= tx.amount;
          if (tx.status === 'paid') runningRealized -= tx.amount;
        } else if (!fromIncluded && toIncluded) {
          runningProjected += tx.amount;
          if (tx.status === 'paid') runningRealized += tx.amount;
        }
      }
    }

    const dueCardInvoiceCents = cardInvoiceOutflowsByDate.get(dayStr) || 0;
    const dueCardInvoiceAmount = dueCardInvoiceCents / 100;
    dayExpense += dueCardInvoiceAmount;
    runningProjected -= dueCardInvoiceAmount;

    const notes = Array.from(outflowNotesByDate.get(dayStr) ?? []).map(
      ([label, cents]) => `${label} — ${formatBRL(cents / 100)}`
    );
    points.push({
      day: d,
      date: dayStr,
      income: Math.round(dayIncome * 100) / 100,
      expense: Math.round(dayExpense * 100) / 100,
      cumulativeBalance: Math.round(runningRealized * 100) / 100,
      projectedBalance: Math.round(runningProjected * 100) / 100,
      ...(notes.length > 0 ? { expenseNotes: notes } : {}),
    });
  }

  return points;
}

export function getCalendarTransactionsForMonth(transactions: Transaction[], month: string): Transaction[] {
  return transactions.filter((tx) => tx.date.slice(0, 7) === month);
}

export function getPurchaseTransactionsForMonth(transactions: Transaction[], month: string): Transaction[] {
  const groups = new Map<string, Transaction[]>();
  const purchases: Transaction[] = [];
  // Despesa fixa no cartão: só o primeiro lançamento é uma compra nova. As cobranças dos meses
  // seguintes já estão no cartão e só aparecem na fatura, como as parcelas.
  const firstFixedCardDate = new Map<string, string>();
  for (const tx of transactions) {
    if (tx.creditCardId && tx.recurrence === 'fixed' && tx.installmentGroupId) {
      const current = firstFixedCardDate.get(tx.installmentGroupId);
      if (current === undefined || tx.date < current) firstFixedCardDate.set(tx.installmentGroupId, tx.date);
    }
  }
  for (const tx of transactions) {
    if (tx.creditCardId && tx.recurrence === 'fixed' && tx.installmentGroupId &&
      tx.date !== firstFixedCardDate.get(tx.installmentGroupId)) {
      continue;
    }
    if (tx.recurrence !== 'installment' || !tx.installmentGroupId) {
      if (tx.recurrence !== 'installment') purchases.push(tx);
      else if (tx.installmentNumber === 1 && tx.installmentPurchaseTotal !== undefined) {
        purchases.push({ ...tx, amount: tx.installmentPurchaseTotal });
      }
      continue;
    }
    const group = groups.get(tx.installmentGroupId) || [];
    group.push(tx);
    groups.set(tx.installmentGroupId, group);
  }
  for (const rows of groups.values()) {
    const first = rows.filter((tx) => tx.installmentNumber === 1)
      .sort((a, b) => (a.originalDateBeforeAnticipation || a.date).localeCompare(b.originalDateBeforeAnticipation || b.date))[0];
    if (!first) continue;
    const total = rows.find((tx) => tx.installmentPurchaseTotal !== undefined)?.installmentPurchaseTotal;
    const numbers = new Set(rows.map((tx) => tx.installmentNumber));
    const complete = first.installmentTotal && Array.from({ length: first.installmentTotal }, (_, i) => i + 1).every((i) => numbers.has(i));
    const amount = total ?? (complete ? rows.reduce((sum, tx) => sum + Math.round(tx.amount * 100), 0) / 100 : undefined);
    if (amount === undefined) continue;
    purchases.push({ ...first, date: first.originalDateBeforeAnticipation || first.date, amount,
      status: rows.some((tx) => tx.status === 'pending') ? 'pending' : 'paid' });
  }
  return getCalendarTransactionsForMonth(purchases, month);
}

/**
 * Returns the ledger rows for a month. Credit-card installments are represented
 * once, on the original purchase date, while bank-account installments remain
 * scheduled in the months they are due.
 */
export function getLedgerTransactionsForMonth(transactions: Transaction[], month: string): Transaction[] {
  const personalTransactions = transactions.filter((tx) => !isSharedOnlyExpense(tx));
  const cardTransactions = personalTransactions.filter((tx) => Boolean(tx.creditCardId));
  const originalTransactionsById = new Map(cardTransactions.map((tx) => [tx.id, tx]));
  const cardPurchases = getPurchaseTransactionsForMonth(cardTransactions, month)
    .map((purchase) => {
      const original = originalTransactionsById.get(purchase.id);
      return {
        ...purchase,
        amount: original?.amount ?? purchase.amount,
        status: original?.status ?? purchase.status,
      };
    });
  const representedCardPurchaseIds = new Set(cardPurchases.map((purchase) => purchase.id));
  const incompleteCardPurchases = cardTransactions
    .filter((tx) =>
      tx.recurrence === 'installment' &&
      tx.installmentNumber === 1 &&
      !representedCardPurchaseIds.has(tx.id)
    )
    .map((tx) => ({
      ...tx,
      date: tx.originalDateBeforeAnticipation || tx.date,
    }))
    .filter((tx) => tx.date.slice(0, 7) === month);
  const otherTransactions = getCalendarTransactionsForMonth(
    personalTransactions.filter((tx) => !tx.creditCardId),
    month
  );

  return [...otherTransactions, ...cardPurchases, ...incompleteCardPurchases]
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

/**
 * Tudo que é parcelado ou recorrente e cai no mês: parcelas e despesas fixas, no cartão ou no banco
 * (água, luz, assinaturas etc.), uma linha por cobrança do mês. Não inclui pagamento de fatura nem
 * transferências.
 */
export function getInstallmentAndRecurringItemsForMonth(transactions: Transaction[], month: string): Transaction[] {
  return transactions
    .filter((tx) =>
      (tx.recurrence === 'installment' || tx.recurrence === 'fixed') &&
      tx.date.slice(0, 7) === month &&
      !tx.isInvoicePayment &&
      !isOutsidePersonalResult(tx) &&
      tx.type !== 'transfer'
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description));
}

export interface CalendarDaySummary {
  pendingExpense: number;
  paidExpense: number;
  income: number;
  dayBalance: number;
}

/**
 * Total mostrado na célula do calendário: o que foi gasto e o que entrou naquele dia.
 * Compras no cartão entram na data da compra e as parceladas contam pelo valor total da compra
 * (a parcela e a fatura aparecem no detalhamento do dia). Pagamento de fatura e transferência ficam
 * de fora para não contar a mesma compra duas vezes.
 */
export function calculateCalendarCellTotals(dayTransactions: Transaction[]): {
  expense: number;
  income: number;
} {
  let expense = 0;
  let income = 0;
  for (const tx of dayTransactions) {
    if (tx.isInvoicePayment || tx.type === 'transfer' || isOutsidePersonalResult(tx)) continue;
    if (tx.type === 'income') {
      if (tx.sharedPaidBy !== 'member') income += tx.amount;
      continue;
    }
    if (tx.type !== 'expense') continue;
    const effective = getEffectiveExpenseAmountForUser(tx);
    if (!effective) continue;
    if (tx.installmentPurchaseTotal !== undefined && tx.amount > 0) {
      expense += tx.installmentPurchaseTotal * (effective.amount / tx.amount);
    } else {
      expense += effective.amount;
    }
  }
  return {
    expense: Math.round(expense * 100) / 100,
    income: Math.round(income * 100) / 100,
  };
}

/**
 * Summarizes the expenses and income recorded on a calendar day.
 * Credit-card purchases stay on their purchase date; invoice due cards are
 * shown separately by the calendar and must not be added to these totals.
 * Invoice payment transactions are cash settlements of those purchases, so
 * they also stay out of spending totals to avoid counting the same purchase twice.
 */
export function calculateCalendarDaySummary(
  dayTransactions: Transaction[]
): CalendarDaySummary {
  let pendingExpense = 0;
  let paidExpense = 0;
  let income = 0;

  for (const tx of dayTransactions) {
    if (tx.isInvoicePayment || tx.type === 'transfer' || isOutsidePersonalResult(tx)) {
      continue;
    }
    if (tx.type === 'income') {
      if (tx.sharedPaidBy !== 'member') income += tx.amount;
      continue;
    }
    if (tx.type !== 'expense') continue;

    const effectiveExpense = getEffectiveExpenseAmountForUser(tx);
    if (!effectiveExpense) continue;
    if (effectiveExpense.status === 'pending') {
      pendingExpense += effectiveExpense.amount;
    } else {
      paidExpense += effectiveExpense.amount;
    }
  }

  const roundedPending = Math.round(pendingExpense * 100) / 100;
  const roundedPaid = Math.round(paidExpense * 100) / 100;
  const roundedIncome = Math.round(income * 100) / 100;
  return {
    pendingExpense: roundedPending,
    paidExpense: roundedPaid,
    income: roundedIncome,
    dayBalance: Math.round((roundedIncome - roundedPending - roundedPaid) * 100) / 100,
  };
}
