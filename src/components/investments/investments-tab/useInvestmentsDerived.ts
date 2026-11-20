/** Resumo da carteira, recomendações e posições filtradas. Parte de InvestmentsTab (ver InvestmentsTab.tsx). */
import { useMemo } from 'react';
import { calculatePortfolioSummary, calculateSmartContributionAllocation } from '../../../domain/investments/investmentRules';
import { normalizeSearchText, parseBRLInput } from '../../../domain/finance/financeRules';
import type { InvestmentsTabPropsApi } from './investmentsTabConfig';
import type { InvestmentsStateApi } from './useInvestmentsState';

export function useInvestmentsDerived(ctx: InvestmentsTabPropsApi & InvestmentsStateApi) {
  const {
    assets,
    classFilter,
    contributionDraftStr,
    monthlyLivingExpense,
    searchQuery,
    targetMap,
  } = ctx;
  const summary = useMemo(
    () =>
      calculatePortfolioSummary(
        assets,
        targetMap,
        monthlyLivingExpense > 0 ? monthlyLivingExpense : 5000
      ),
    [assets, targetMap, monthlyLivingExpense]
  );

  const contributionAmount = Math.max(0, parseBRLInput(contributionDraftStr));
  const smartRecommendations = useMemo(
    () =>
      calculateSmartContributionAllocation(
        assets,
        targetMap,
        contributionAmount
      ),
    [assets, targetMap, contributionAmount]
  );

  const filteredPositions = useMemo(() => {
    const normQuery = normalizeSearchText(searchQuery);
    return summary.positions.filter((pos) => {
      if (classFilter !== 'all' && pos.asset.assetClass !== classFilter) {
        return false;
      }
      if (normQuery) {
        const searchable = normalizeSearchText(
          `${pos.asset.ticker} ${pos.asset.name} ${pos.asset.institution} ${pos.asset.indexerLabel}`
        );
        if (!searchable.includes(normQuery)) return false;
      }
      return true;
    });
  }, [summary.positions, classFilter, searchQuery]);

  return {
    contributionAmount,
    filteredPositions,
    smartRecommendations,
    summary,
  };
}

export type InvestmentsDerivedApi = ReturnType<typeof useInvestmentsDerived>;
