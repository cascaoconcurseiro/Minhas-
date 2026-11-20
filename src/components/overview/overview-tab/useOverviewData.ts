/** Estado da tela e dados derivados: contas a pagar, faturas, saúde financeira e orçamento. Parte de OverviewTab (ver OverviewTab.tsx). */
import { useMemo, useState } from 'react';
import { calculateFinancialHealthScore360, getBudgetAlerts, getLocalDateISO, getPendingBankMovements, getPendingCardInvoices } from '../../../domain/finance/financeRules';
import type { OverviewTabPropsApi } from './overviewTabConfig';

export function useOverviewData(ctx: OverviewTabPropsApi) {
  const {
    accountBalances,
    accounts,
    alertsExpandedByDefault,
    cardSummaries,
    cards,
    categories,
    categoryBreakdown,
    currentPosition,
    investments,
    monthlySummary,
    receivablesSummary,
    selectedMonth,
    transactions,
    userName,
  } = ctx;
  const [isAlertsExpanded, setIsAlertsExpanded] = useState<boolean>(alertsExpandedByDefault);
  const [isHealthDetailsOpen, setIsHealthDetailsOpen] = useState<boolean>(false);
  const [billsFilterMode, setBillsFilterMode] = useState<'pending' | 'paid'>('pending');
  // Mostra as primeiras contas e abre o resto sob demanda: listas enormes deixavam a tela inicial pesada
  const [billsLimit, setBillsLimit] = useState(20);

  const greetingPrefix = (() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  const firstName = userName?.trim().split(/\s+/)[0] || '';

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const accMap = new Map(accounts.map((a) => [a.id, a.name]));

  const todayDate = getLocalDateISO();
  const todayMonth = todayDate.slice(0, 7);
  const pendingBills = getPendingBankMovements(transactions, selectedMonth, todayDate);
  const pendingInvoices = getPendingCardInvoices(cards, transactions, selectedMonth, todayDate);
  const pendingCount = pendingBills.length + pendingInvoices.length;

  const paidBankBills = transactions
    .filter(
      (tx) =>
        tx.competenceMonth === selectedMonth &&
        tx.status === 'paid' &&
        !tx.creditCardId &&
        tx.type !== 'transfer' &&
        !tx.isCompanionOnlyExpense &&
        tx.sharedPaidBy !== 'member'
    )
    .sort((a, b) => a.date.localeCompare(b.date));


  const health360 = useMemo(
    () =>
      calculateFinancialHealthScore360({
        selectedMonth,
        monthlySummary,
        accounts,
        accountBalances,
        cards,
        cardSummaries,
        categoryBreakdown,
        investments,
        currentPosition,
        receivablesTotal: receivablesSummary?.totalOpen ?? 0,
      }),
    [
      selectedMonth,
      monthlySummary,
      accounts,
      accountBalances,
      cards,
      cardSummaries,
      categoryBreakdown,
      investments,
      currentPosition,
      receivablesSummary?.totalOpen,
    ]
  );

  const budgetAlerts = getBudgetAlerts(categoryBreakdown);
  const includedAccountIds = new Set(accounts.filter((account) => account.includeInTotal).map((account) => account.id));
  const todayAccountBalance = currentPosition
    ? currentPosition.accountBalances.reduce((total, balance) =>
        total + (includedAccountIds.has(balance.accountId) ? Math.round(balance.currentBalance * 100) : 0), 0) / 100
    : monthlySummary.totalCurrentBalance;
  const overBudgetItems = budgetAlerts.filter((i) => i.status === 'over');
  const warningBudgetItems = budgetAlerts.filter((i) => i.status === 'warning');

  const topCategories = categoryBreakdown.filter((c) => c.spent > 0 || c.budget > 0).slice(0, 6);

  return {
    accMap,
    billsFilterMode,
    billsLimit,
    budgetAlerts,
    catMap,
    firstName,
    greetingPrefix,
    health360,
    isAlertsExpanded,
    isHealthDetailsOpen,
    overBudgetItems,
    paidBankBills,
    pendingBills,
    pendingCount,
    pendingInvoices,
    setBillsFilterMode,
    setBillsLimit,
    setIsAlertsExpanded,
    setIsHealthDetailsOpen,
    todayAccountBalance,
    todayMonth,
    topCategories,
    warningBudgetItems,
  };
}

export type OverviewDataApi = ReturnType<typeof useOverviewData>;
