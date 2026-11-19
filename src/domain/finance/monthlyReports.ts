import type {
  BankAccount,
  Category,
  CategorySpendItem,
  CreditCard,
  MonthlyComparisonRow,
  MonthlyFinancialSummary,
  PeriodReportSummary,
  ReportDistributionSlice,
  Transaction,
  TransactionStatus,
} from '../../types/finance';
import {
  addMonthsToYearMonth,
  formatMonthYearPT,
  formatShortMonthPT,
  getMonthRange,
} from './formatting.ts';
import {
  calculateAccountBalances,
} from './accountBalances.ts';
import {
  CreateTransactionBatchInput,
  createTransactionBatch,
} from './transactionBatch.ts';
import {
  getConsumptionMonth,
  isCreditCardInvoicePurchase,
  isOutsidePersonalResult,
} from './transactionClassification.ts';
import {
  CascadeScope,
  applyCascadeTransactionEdit,
} from './transactionOperations.ts';

/** Returns transactions that would lose their category if it were deleted. */
export function getTransactionsLinkedToCategory(
  categoryId: string,
  transactions: Transaction[]
): Transaction[] {
  return transactions.filter((tx) => tx.categoryId === categoryId);
}

/**
 * Calcula o impacto da despesa pessoal. O acerto de uma despesa paga pelo familiar
 * entra no resultado pelo movimento bancário criado ao quitar a dívida.
 */
export function getEffectiveExpenseAmountForUser(
  tx: Transaction
): { amount: number; status: TransactionStatus } | null {
  if (
    tx.type !== 'expense' ||
    tx.isInvoicePayment ||
    isOutsidePersonalResult(tx)
  ) {
    return null;
  }

  return {
    amount: tx.amount,
    status: tx.status,
  };
}

export function calculateMonthlySummary(
  accounts: BankAccount[],
  cards: CreditCard[],
  transactions: Transaction[],
  selectedMonth: string
): MonthlyFinancialSummary {
  const accountBalances = calculateAccountBalances(accounts, transactions, selectedMonth);
  const includedIds = new Set(accounts.filter((a) => a.includeInTotal).map((a) => a.id));

  let totalCurrentBalance = 0;
  let totalProjectedBalance = 0;
  for (const ab of accountBalances) {
    if (includedIds.has(ab.accountId)) {
      totalCurrentBalance += ab.currentBalance;
      totalProjectedBalance += ab.projectedBalance;
    }
  }

  const monthTxs = transactions.filter((tx) => getConsumptionMonth(tx) === selectedMonth);

  let incomeRealized = 0;
  let incomePending = 0;
  let expenseRealized = 0;
  let expensePending = 0;
  let creditCardMonthTotal = 0;

  for (const tx of monthTxs) {
    if (tx.type === 'transfer' || tx.isInvoicePayment || isOutsidePersonalResult(tx)) {
      continue;
    }

    if (tx.type === 'income') {
      if (tx.sharedPaidBy === 'member') continue;
      if (tx.status === 'paid') {
        incomeRealized += tx.amount;
      } else {
        incomePending += tx.amount;
      }
    } else if (tx.type === 'expense') {
      const effectiveExp = getEffectiveExpenseAmountForUser(tx);
      if (!effectiveExp) continue;

      if (tx.creditCardId) {
        creditCardMonthTotal += effectiveExp.amount;
      }
      if (effectiveExp.status === 'paid') {
        expenseRealized += effectiveExp.amount;
      } else {
        expensePending += effectiveExp.amount;
      }
    }
  }

  const unpaidCardInvoicesThroughMonthCents = transactions.reduce((cents, tx) => {
    if (
      !tx.creditCardId ||
      tx.competenceMonth > selectedMonth ||
      tx.status !== 'pending' ||
      !isCreditCardInvoicePurchase(tx)
    ) return cents;
    return cents + Math.round(tx.amount * 100);
  }, 0);
  const unpaidCardInvoicesThroughMonth = unpaidCardInvoicesThroughMonthCents / 100;

  totalProjectedBalance -= unpaidCardInvoicesThroughMonth;

  const incomeTotal = Math.round((incomeRealized + incomePending) * 100) / 100;
  const expenseTotal = Math.round((expenseRealized + expensePending) * 100) / 100;
  const netResultProjected = Math.round((incomeTotal - expenseTotal) * 100) / 100;
  const netResultRealized = Math.round((incomeRealized - expenseRealized) * 100) / 100;
  const savingsRateProjected =
    incomeTotal > 0 ? Math.round(((incomeTotal - expenseTotal) / incomeTotal) * 1000) / 10 : 0;

  return {
    month: selectedMonth,
    totalCurrentBalance: Math.round(totalCurrentBalance * 100) / 100,
    totalProjectedBalance: Math.round(totalProjectedBalance * 100) / 100,
    incomeRealized: Math.round(incomeRealized * 100) / 100,
    incomePending: Math.round(incomePending * 100) / 100,
    incomeTotal,
    expenseRealized: Math.round(expenseRealized * 100) / 100,
    expensePending: Math.round(expensePending * 100) / 100,
    expenseTotal,
    creditCardMonthTotal: Math.round(creditCardMonthTotal * 100) / 100,
    netResultProjected,
    netResultRealized,
    savingsRateProjected,
  };
}

export function calculateCategoryBreakdown(
  categories: Category[],
  transactions: Transaction[],
  selectedMonth: string,
  warningThresholdPercent = 80
): CategorySpendItem[] {
  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const monthExpenses: Array<{
    tx: Transaction;
    effectiveAmount: number;
    effectiveStatus: TransactionStatus;
  }> = [];

  for (const tx of transactions) {
    if (getConsumptionMonth(tx) !== selectedMonth) continue;
    const eff = getEffectiveExpenseAmountForUser(tx);
    if (!eff) continue;
    monthExpenses.push({
      tx,
      effectiveAmount: eff.amount,
      effectiveStatus: eff.status,
    });
  }

  const totalMonthExpense = monthExpenses.reduce(
    (sum, item) => sum + item.effectiveAmount,
    0
  );
  const thresholdRatio = Math.max(50, Math.min(99, warningThresholdPercent)) / 100;

  return expenseCategories
    .map((cat) => {
      const catItems = monthExpenses.filter((item) => item.tx.categoryId === cat.id);
      const realizedSpent = catItems
        .filter((item) => item.effectiveStatus === 'paid')
        .reduce((sum, item) => sum + item.effectiveAmount, 0);
      const pendingSpent = catItems
        .filter((item) => item.effectiveStatus === 'pending')
        .reduce((sum, item) => sum + item.effectiveAmount, 0);
      const spent = Math.round((realizedSpent + pendingSpent) * 100) / 100;
      // Categoria com estorno maior que o gasto do mês fica com valor negativo (crédito); os percentuais não descem de 0.
      const percentOfBudget =
        cat.monthlyBudget > 0 ? Math.max(0, Math.round((spent / cat.monthlyBudget) * 1000) / 10) : 0;
      const percentOfTotalExpense =
        totalMonthExpense > 0 ? Math.max(0, Math.round((spent / totalMonthExpense) * 1000) / 10) : 0;

      let status: 'ok' | 'warning' | 'over' = 'ok';
      if (cat.monthlyBudget > 0) {
        if (spent > cat.monthlyBudget) status = 'over';
        else if (spent >= cat.monthlyBudget * thresholdRatio) status = 'warning';
      }

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryColor: cat.color || '#1e293b',
        categoryIcon: cat.icon || 'tag',
        bucket: cat.bucket,
        spent,
        realizedSpent: Math.round(realizedSpent * 100) / 100,
        pendingSpent: Math.round(pendingSpent * 100) / 100,
        budget: cat.monthlyBudget,
        percentOfBudget,
        percentOfTotalExpense,
        status,
      };
    })
    .sort((a, b) => b.spent - a.spent);
}

export function getBudgetAlerts(items: CategorySpendItem[]): CategorySpendItem[] {
  return items
    .filter((i) => i.budget > 0 && (i.status === 'over' || i.status === 'warning'))
    .sort((a, b) => b.percentOfBudget - a.percentOfBudget);
}

export interface Rule503020Summary {
  incomeBase: number;
  essentialSpent: number;
  essentialPercent: number;
  essentialTarget: number;
  lifestyleSpent: number;
  lifestylePercent: number;
  lifestyleTarget: number;
  financialSavings: number;
  financialPercent: number;
  financialTarget: number;
}

export function calculate503020Rule(
  categories: Category[],
  transactions: Transaction[],
  selectedMonth: string
): Rule503020Summary {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const monthTxs = transactions.filter(
    (tx) =>
      getConsumptionMonth(tx) === selectedMonth &&
      !tx.isInvoicePayment &&
      !isOutsidePersonalResult(tx)
  );

  let incomeBase = 0;
  let essentialSpent = 0;
  let lifestyleSpent = 0;
  let financialExpense = 0;

  for (const tx of monthTxs) {
    if (tx.type === 'income') {
      if (tx.sharedPaidBy === 'member') continue;
      incomeBase += tx.amount;
    } else if (tx.type === 'expense') {
      const eff = getEffectiveExpenseAmountForUser(tx);
      if (!eff) continue;
      const cat = catMap.get(tx.categoryId);
      const bucket = cat?.bucket || 'essential';
      if (bucket === 'essential') essentialSpent += eff.amount;
      else if (bucket === 'lifestyle') lifestyleSpent += eff.amount;
      else financialExpense += eff.amount;
    }
  }

  const totalOut = essentialSpent + lifestyleSpent;
  const unallocatedSurplus = Math.max(0, incomeBase - totalOut - financialExpense);
  const financialSavings = Math.round((financialExpense + unallocatedSurplus) * 100) / 100;

  const safeIncome = incomeBase > 0 ? incomeBase : 1;

  return {
    incomeBase: Math.round(incomeBase * 100) / 100,
    essentialSpent: Math.round(essentialSpent * 100) / 100,
    essentialPercent:
      incomeBase > 0 ? Math.round((essentialSpent / safeIncome) * 1000) / 10 : 0,
    essentialTarget: Math.round(incomeBase * 0.5 * 100) / 100,
    lifestyleSpent: Math.round(lifestyleSpent * 100) / 100,
    lifestylePercent:
      incomeBase > 0 ? Math.round((lifestyleSpent / safeIncome) * 1000) / 10 : 0,
    lifestyleTarget: Math.round(incomeBase * 0.3 * 100) / 100,
    financialSavings,
    financialPercent:
      incomeBase > 0 ? Math.round((financialSavings / safeIncome) * 1000) / 10 : 0,
    financialTarget: Math.round(incomeBase * 0.2 * 100) / 100,
  };
}

export function calculatePeriodReport(
  accounts: BankAccount[],
  cards: CreditCard[],
  categories: Category[],
  transactions: Transaction[],
  startMonth: string,
  endMonth: string
): PeriodReportSummary {
  const months = getMonthRange(startMonth, endMonth);
  const monthSet = new Set(months);

  const periodTxs = transactions.filter(
    (tx) =>
      monthSet.has(getConsumptionMonth(tx)) &&
      !tx.isInvoicePayment &&
      tx.type !== 'transfer' &&
      !isOutsidePersonalResult(tx)
  );

  const expenseTxs: Transaction[] = [];
  for (const tx of periodTxs) {
    if (tx.type !== 'expense') continue;
    const eff = getEffectiveExpenseAmountForUser(tx);
    if (!eff) continue;
    expenseTxs.push(
      eff.amount === tx.amount ? tx : { ...tx, amount: eff.amount, status: eff.status }
    );
  }
  const incomeTxs = periodTxs.filter(
    (tx) => tx.type === 'income' && tx.sharedPaidBy !== 'member'
  );

  const totalExpense = Math.round(
    expenseTxs.reduce((sum, tx) => sum + tx.amount, 0) * 100
  ) / 100;
  const totalIncome = Math.round(
    incomeTxs.reduce((sum, tx) => sum + tx.amount, 0) * 100
  ) / 100;

  const catMap = new Map(categories.map((c) => [c.id, c]));

  // Group expenses by category
  const expByCatMap = new Map<string, Transaction[]>();
  for (const tx of expenseTxs) {
    const list = expByCatMap.get(tx.categoryId) || [];
    list.push(tx);
    expByCatMap.set(tx.categoryId, list);
  }

  const expensesByCategory: ReportDistributionSlice[] = Array.from(expByCatMap.entries())
    .map(([catId, txs]) => {
      const cat = catMap.get(catId);
      const amount = Math.round(txs.reduce((s, t) => s + t.amount, 0) * 100) / 100;
      const percent = totalExpense > 0 ? Math.round((amount / totalExpense) * 1000) / 10 : 0;

      return {
        id: catId,
        name: cat?.name || 'Outras Despesas',
        color: cat?.color || '#64748b',
        icon: cat?.icon || 'tag',
        amount,
        percent,
        count: txs.length,
      };
    })
    // Categoria cujo estorno superou o gasto no período fica fora das fatias (o total já considera o estorno).
    .filter((slice) => slice.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  // Group incomes by category/source
  const incByCatMap = new Map<string, Transaction[]>();
  for (const tx of incomeTxs) {
    const list = incByCatMap.get(tx.categoryId) || [];
    list.push(tx);
    incByCatMap.set(tx.categoryId, list);
  }

  const incomesBySource: ReportDistributionSlice[] = Array.from(incByCatMap.entries())
    .map(([catId, txs]) => {
      const cat = catMap.get(catId);
      const amount = Math.round(txs.reduce((s, t) => s + t.amount, 0) * 100) / 100;
      const percent = totalIncome > 0 ? Math.round((amount / totalIncome) * 1000) / 10 : 0;

      return {
        id: catId,
        name: cat?.name || 'Outras Receitas',
        color: cat?.color || '#059669',
        icon: cat?.icon || 'briefcase',
        amount,
        percent,
        count: txs.length,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // Monthly Comparative Series
  const monthlySeries: MonthlyComparisonRow[] = [];
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const summary = calculateMonthlySummary(accounts, cards, transactions, m);
    const prev = i > 0 ? monthlySeries[i - 1] : null;

    const expenseDeltaPercent =
      prev && prev.expense > 0
        ? Math.round(((summary.expenseTotal - prev.expense) / prev.expense) * 1000) / 10
        : null;
    const incomeDeltaPercent =
      prev && prev.income > 0
        ? Math.round(((summary.incomeTotal - prev.income) / prev.income) * 1000) / 10
        : null;

    monthlySeries.push({
      month: m,
      label: formatMonthYearPT(m),
      shortLabel: formatShortMonthPT(m),
      income: summary.incomeTotal,
      expense: summary.expenseTotal,
      netSavings: summary.netResultProjected,
      savingsRate: summary.savingsRateProjected,
      cumulativeBalance: summary.totalProjectedBalance,
      expenseDeltaPercent,
      incomeDeltaPercent,
    });
  }

  const monthsCount = Math.max(1, months.length);
  const netSavings = Math.round((totalIncome - totalExpense) * 100) / 100;
  const savingsRate =
    totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 1000) / 10 : 0;
  const endingBalance =
    monthlySeries.length > 0
      ? monthlySeries[monthlySeries.length - 1].cumulativeBalance
      : 0;

  return {
    startMonth: months[0] || startMonth,
    endMonth: months[months.length - 1] || endMonth,
    monthsCount,
    totalIncome,
    totalExpense,
    netSavings,
    averageMonthlyIncome: Math.round((totalIncome / monthsCount) * 100) / 100,
    averageMonthlyExpense: Math.round((totalExpense / monthsCount) * 100) / 100,
    savingsRate,
    endingBalance,
    expensesByCategory,
    incomesBySource,
    monthlySeries,
  };
}

export interface SixMonthComparativePoint extends MonthlyComparisonRow {
  isSurplus: boolean;
  healthStatus: 'surplus' | 'balanced' | 'deficit';
}

export interface SixMonthComparativeSummary {
  startMonth: string;
  endMonth: string;
  months: SixMonthComparativePoint[];
  totalIncome6m: number;
  totalExpense6m: number;
  netSavings6m: number;
  averageIncome6m: number;
  averageExpense6m: number;
  overallSavingsRate6m: number;
  surplusMonthsCount: number;
  deficitMonthsCount: number;
  financialHealthStatus: 'strong' | 'positive' | 'neutral' | 'deficit';
  financialHealthLabel: string;
}

/**
 * Calcula a evolução comparativa mensal de Receitas vs. Despesas nos últimos 6 meses
 * encerrados em `referenceMonth` (inclusive), fornecendo indicadores de saúde financeira.
 */
export function calculateSixMonthComparativeSeries(
  accounts: BankAccount[],
  cards: CreditCard[],
  transactions: Transaction[],
  referenceMonth: string
): SixMonthComparativeSummary {
  const startMonth = addMonthsToYearMonth(referenceMonth, -5);
  const endMonth = referenceMonth;
  const monthList = getMonthRange(startMonth, endMonth);

  const months: SixMonthComparativePoint[] = [];
  let totalIncome6m = 0;
  let totalExpense6m = 0;
  let surplusMonthsCount = 0;
  let deficitMonthsCount = 0;

  for (let i = 0; i < monthList.length; i++) {
    const m = monthList[i];
    const summary = calculateMonthlySummary(accounts, cards, transactions, m);
    const prev = i > 0 ? months[i - 1] : null;

    const income = Math.round(summary.incomeTotal * 100) / 100;
    const expense = Math.round(summary.expenseTotal * 100) / 100;
    const netSavings = Math.round((income - expense) * 100) / 100;

    totalIncome6m = Math.round((totalIncome6m + income) * 100) / 100;
    totalExpense6m = Math.round((totalExpense6m + expense) * 100) / 100;

    let healthStatus: 'surplus' | 'balanced' | 'deficit' = 'balanced';
    if (income > expense) {
      healthStatus = 'surplus';
      surplusMonthsCount += 1;
    } else if (expense > income) {
      healthStatus = 'deficit';
      deficitMonthsCount += 1;
    }

    const expenseDeltaPercent =
      prev && prev.expense > 0
        ? Math.round(((expense - prev.expense) / prev.expense) * 1000) / 10
        : null;
    const incomeDeltaPercent =
      prev && prev.income > 0
        ? Math.round(((income - prev.income) / prev.income) * 1000) / 10
        : null;

    months.push({
      month: m,
      label: formatMonthYearPT(m),
      shortLabel: formatShortMonthPT(m),
      income,
      expense,
      netSavings,
      savingsRate: summary.savingsRateProjected,
      cumulativeBalance: summary.totalProjectedBalance,
      expenseDeltaPercent,
      incomeDeltaPercent,
      isSurplus: netSavings >= 0,
      healthStatus,
    });
  }

  const count = Math.max(1, months.length);
  const netSavings6m = Math.round((totalIncome6m - totalExpense6m) * 100) / 100;
  const averageIncome6m = Math.round((totalIncome6m / count) * 100) / 100;
  const averageExpense6m = Math.round((totalExpense6m / count) * 100) / 100;
  const overallSavingsRate6m =
    totalIncome6m > 0
      ? Math.round(((totalIncome6m - totalExpense6m) / totalIncome6m) * 1000) / 10
      : 0;

  let financialHealthStatus: 'strong' | 'positive' | 'neutral' | 'deficit' = 'neutral';
  let financialHealthLabel = 'Sem Movimentação no Semestre';

  if (totalIncome6m === 0 && totalExpense6m === 0) {
    financialHealthStatus = 'neutral';
    financialHealthLabel = 'Sem Movimentação no Semestre';
  } else if (netSavings6m >= 0 && overallSavingsRate6m >= 20) {
    financialHealthStatus = 'strong';
    financialHealthLabel = 'Saúde Financeira Excelente';
  } else if (netSavings6m > 0) {
    financialHealthStatus = 'positive';
    financialHealthLabel = 'Superávit Positivo no Semestre';
  } else if (netSavings6m === 0) {
    financialHealthStatus = 'neutral';
    financialHealthLabel = 'Orçamento no Limite (Zero a Zero)';
  } else {
    financialHealthStatus = 'deficit';
    financialHealthLabel = 'Atenção: Despesas Acima das Receitas';
  }

  return {
    startMonth,
    endMonth,
    months,
    totalIncome6m,
    totalExpense6m,
    netSavings6m,
    averageIncome6m,
    averageExpense6m,
    overallSavingsRate6m,
    surplusMonthsCount,
    deficitMonthsCount,
    financialHealthStatus,
    financialHealthLabel,
  };
}

export function previewCategoryBudget(
  categories: Category[],
  transactions: Transaction[],
  draft: CreateTransactionBatchInput,
  editingId?: string,
  scope: CascadeScope = 'single',
  warningThresholdPercent = 80
) {
  const warningRatio = Math.max(50, Math.min(99, warningThresholdPercent)) / 100;
  const month = draft.creditCardId
    ? draft.date.slice(0, 7)
    : draft.competenceMonth || draft.date.slice(0, 7);
  const category = categories.find((item) => item.id === draft.categoryId);
  if (!category || category.type !== 'expense') return null;
  let projected: Transaction[];
  let draftRows: Transaction[];
  const original = editingId ? transactions.find((tx) => tx.id === editingId) : undefined;
  if (original) {
    const edit = applyCascadeTransactionEdit(transactions, { ...original, ...draft, competenceMonth: draft.competenceMonth || draft.date.slice(0, 7) }, scope);
    if (edit.error) return null;
    projected = edit.updatedTransactions;
    draftRows = projected.filter((tx) => tx.id === original.id);
  } else {
    try {
      draftRows = createTransactionBatch(draft);
      projected = [...transactions, ...draftRows];
    } catch (error) {
      if (error instanceof RangeError) return null;
      throw error;
    }
  }
  const before = calculateCategoryBreakdown(categories, transactions, month).find((item) => item.categoryId === category.id);
  const after = calculateCategoryBreakdown(categories, projected, month).find((item) => item.categoryId === category.id);
  const spentBefore = before?.spent || 0;
  const projectedSpent = after?.spent || 0;
  return {
    hasBudget: category.monthlyBudget > 0, categoryName: category.name, month, budgetLimit: category.monthlyBudget,
    draftMonthlyAmount: draftRows.filter((tx) => getConsumptionMonth(tx) === month)
      .reduce((sum, tx) => sum + Math.round((getEffectiveExpenseAmountForUser(tx)?.amount || 0) * 100), 0) / 100,
    draftSharedAmount: draftRows.filter((tx) => getConsumptionMonth(tx) === month)
      .reduce((sum, tx) => sum + Math.round((tx.sharedAmount || 0) * 100), 0) / 100,
    spentBefore, projectedSpent,
    remainingAfter: Math.round((category.monthlyBudget - projectedSpent) * 100) / 100,
    percentAfter: category.monthlyBudget > 0 ? Math.round(projectedSpent / category.monthlyBudget * 1000) / 10 : 0,
    statusAfter: projectedSpent > category.monthlyBudget ? 'over' : projectedSpent >= category.monthlyBudget * warningRatio ? 'warning' : 'ok',
  };
}
