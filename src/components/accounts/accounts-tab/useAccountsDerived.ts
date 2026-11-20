/** Conta ativa, totais, extrato com saldo corrido e filtros. Parte de AccountsTab (ver AccountsTab.tsx). */
import { useMemo } from 'react';
import { calculateAccountStatementWithRunningBalance } from '../../../domain/budgets/uxEnhancementRules';
import { normalizeSearchText } from '../../../domain/finance/financeRules';
import type { AccountsTabPropsApi } from './accountsTabConfig';
import type { AccountsStateApi } from './useAccountsState';

export function useAccountsDerived(ctx: AccountsTabPropsApi & AccountsStateApi) {
  const {
    accountBalances,
    accounts,
    categories,
    searchQuery,
    selectedAccountId,
    selectedMonth,
    statementFilter,
    transactions,
  } = ctx;
  const activeAccount =
    accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  const catMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const accMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  // Totals across all accounts
  const globalTotals = useMemo(() => {
    let giroCurrent = 0;
    let giroProjected = 0;
    let totalPatrimony = 0;
    for (const acc of accounts) {
      const bal = accountBalances.find((b) => b.accountId === acc.id);
      const curr = bal?.currentBalance ?? acc.initialBalance;
      const proj = bal?.projectedBalance ?? acc.initialBalance;
      totalPatrimony += curr;
      if (acc.includeInTotal) {
        giroCurrent += curr;
        giroProjected += proj;
      }
    }
    return { giroCurrent, giroProjected, totalPatrimony };
  }, [accounts, accountBalances]);

  // Real Bank Statement with Running Balance for the active account
  const statementSummary = useMemo(() => {
    if (!activeAccount) return null;
    return calculateAccountStatementWithRunningBalance(
      activeAccount.id,
      activeAccount.initialBalance,
      transactions,
      selectedMonth,
      activeAccount.initialBalanceDate
    );
  }, [activeAccount, transactions, selectedMonth]);

  const filteredStatementEntries = useMemo(() => {
    if (!statementSummary) return [];
    // O extrato é sempre cronológico (01 → 31).
    const baseList = statementSummary.entriesChronological;

    const normQuery = normalizeSearchText(searchQuery);

    return baseList.filter((entry) => {
      const tx = entry.transaction;
      if (statementFilter === 'credit' && entry.direction !== 'credit') return false;
      if (statementFilter === 'debit' && entry.direction !== 'debit') return false;
      if (statementFilter === 'transfer' && tx.type !== 'transfer') return false;
      if (statementFilter === 'pending' && tx.status !== 'pending') return false;

      if (normQuery) {
        const cat = catMap.get(tx.categoryId);
        const searchable = normalizeSearchText(
          `${tx.description} ${cat?.name || ''} ${tx.notes || ''}`
        );
        if (!searchable.includes(normQuery)) return false;
      }
      return true;
    });
  }, [statementSummary, statementFilter, searchQuery, catMap]);

  return {
    accMap,
    activeAccount,
    catMap,
    filteredStatementEntries,
    globalTotals,
    statementSummary,
  };
}

export type AccountsDerivedApi = ReturnType<typeof useAccountsDerived>;
