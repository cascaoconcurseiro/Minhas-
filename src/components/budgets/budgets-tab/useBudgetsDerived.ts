/** Regra 50/30/20, alertas, totais e categorias filtradas. Parte de BudgetsTab (ver BudgetsTab.tsx). */
import { calculate503020Rule, getBudgetAlerts, getLocalDateISO } from '../../../domain/finance/financeRules';
import { useMemo } from 'react';
import { assessBudgetPace, suggestBudgets } from '../../../domain/budgets/budgetIntelligence';
import type { BudgetsTabPropsApi } from './budgetsTabConfig';
import type { BudgetsStateApi } from './useBudgetsState';

export function useBudgetsDerived(ctx: BudgetsTabPropsApi & BudgetsStateApi) {
  const {
    bucketFilter,
    categories,
    categoryBreakdown,
    selectedMonth,
    transactions,
  } = ctx;
  const rule503020 = calculate503020Rule(categories, transactions, selectedMonth);
  const budgetSuggestions = useMemo(
    () => suggestBudgets(categories, transactions, selectedMonth),
    [categories, transactions, selectedMonth]
  );
  const paceAlerts = useMemo(
    () => (selectedMonth === getLocalDateISO().slice(0, 7) ? assessBudgetPace(categories, transactions, getLocalDateISO()) : []),
    [categories, transactions, selectedMonth]
  );
  const budgetAlerts = getBudgetAlerts(categoryBreakdown);
  const overAlerts = budgetAlerts.filter((a) => a.status === 'over');
  const warningAlerts = budgetAlerts.filter((a) => a.status === 'warning');

  const totalBudgeted = categoryBreakdown.reduce((sum, item) => sum + item.budget, 0);
  const totalSpent = categoryBreakdown.reduce((sum, item) => sum + item.spent, 0);

  const filteredItems = categoryBreakdown.filter((item) =>
    bucketFilter === 'all' ? true : item.bucket === bucketFilter
  );

  return {
    budgetAlerts,
    budgetSuggestions,
    filteredItems,
    overAlerts,
    paceAlerts,
    rule503020,
    totalBudgeted,
    totalSpent,
  };
}

export type BudgetsDerivedApi = ReturnType<typeof useBudgetsDerived>;
