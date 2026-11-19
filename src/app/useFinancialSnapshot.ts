/** Cálculos do mês selecionado (saldos, cartões, resumo e categorias), sempre pelas regras de src/domain. Parte do App (ver src/App.tsx). */
import { useMemo } from 'react';
import { calculateAccountBalances, calculateCategoryBreakdown, calculateCreditCardSummary, calculateMonthlySummary } from '../domain/finance/financeRules';
import type { AppStateApi } from './useAppState';

export function useFinancialSnapshot(app: AppStateApi) {
  const {
    accounts,
    cards,
    categories,
    selectedMonth,
    settings,
    transactions,
  } = app;
  // Derived financial calculations (Single Source of Truth)
  const accountBalances = useMemo(
    () => calculateAccountBalances(accounts, transactions, selectedMonth),
    [accounts, transactions, selectedMonth]
  );

  const cardSummaries = useMemo(
    () =>
      cards.map((card) =>
        calculateCreditCardSummary(card, transactions, selectedMonth)
      ),
    [cards, transactions, selectedMonth]
  );

  const monthlySummary = useMemo(
    () => calculateMonthlySummary(accounts, cards, transactions, selectedMonth),
    [accounts, cards, transactions, selectedMonth]
  );

  const categoryBreakdown = useMemo(
    () =>
      calculateCategoryBreakdown(
        categories,
        transactions,
        selectedMonth,
        settings.budgetWarningPercent
      ),
    [categories, transactions, selectedMonth, settings.budgetWarningPercent]
  );

  return {
    accountBalances,
    cardSummaries,
    categoryBreakdown,
    monthlySummary,
  };
}

export type FinancialSnapshotApi = ReturnType<typeof useFinancialSnapshot>;
