/** Resumos por pessoa e totais do mês. Parte de SharedExpensesTab (ver SharedExpensesTab.tsx). */
import { useMemo } from 'react';
import { calculateSharedMemberSummary, getDomesticSharedTransactions } from '../../../domain/family/sharedFinanceRules';
import type { SharedExpensesTabPropsApi } from './sharedExpensesTabConfig';
import type { SharedStateApi } from './useSharedState';

export function useSharedDerived(ctx: SharedExpensesTabPropsApi & SharedStateApi) {
  const {
    accounts,
    cards,
    categories,
    familyMembers,
    selectedMemberId,
    selectedMonth,
    transactions,
  } = ctx;
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c.name])), [cards]);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  // Filter domestic shared transactions ONLY (exclude international trip expenses so currencies never mix)
  const allSharedTxs = useMemo(() => {
    return getDomesticSharedTransactions(transactions);
  }, [transactions]);

  // Group shared transactions by member with bilateral compensation ("O que me deve" - "O que eu devo")
  const memberSummaries = useMemo(
    () => familyMembers.map((member) => ({ member, ...calculateSharedMemberSummary(allSharedTxs, member.id, selectedMonth) })),
    [familyMembers, allSharedTxs, selectedMonth]
  );

  // Overall totals across all family members
  const overallOwedToMeThisMonth = useMemo(() => {
    return memberSummaries.reduce((acc, s) => acc + s.owedToMeMonthAmount, 0);
  }, [memberSummaries]);

  const overallIOweMembersThisMonth = useMemo(() => {
    return memberSummaries.reduce((acc, s) => acc + s.iOweMemberMonthAmount, 0);
  }, [memberSummaries]);

  const overallNetCompensatedThisMonth = useMemo(() => {
    return Math.round((overallOwedToMeThisMonth - overallIOweMembersThisMonth) * 100) / 100;
  }, [overallOwedToMeThisMonth, overallIOweMembersThisMonth]);

  const overallReceivedThisMonth = useMemo(() => {
    return memberSummaries.reduce((acc, s) => acc + s.receivedMonthAmount, 0);
  }, [memberSummaries]);

  // Current active member
  const activeSummary = useMemo(() => {
    return (
      memberSummaries.find((s) => s.member.id === selectedMemberId) ||
      memberSummaries[0]
    );
  }, [memberSummaries, selectedMemberId]);

  return {
    accMap,
    activeSummary,
    cardMap,
    catMap,
    memberSummaries,
    overallIOweMembersThisMonth,
    overallNetCompensatedThisMonth,
    overallOwedToMeThisMonth,
    overallReceivedThisMonth,
  };
}

export type SharedDerivedApi = ReturnType<typeof useSharedDerived>;
