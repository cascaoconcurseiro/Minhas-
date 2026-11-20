/** Totais das metas e resultado da simulação. Parte de GoalsAndSimulatorTab (ver GoalsAndSimulatorTab.tsx). */
import { useMemo } from 'react';
import { SavingsGoal } from '../../../types/finance';
import { parseBRLInput, simulateFixedIncomeBR } from '../../../domain/finance/financeRules';
import type { GoalsAndSimulatorTabPropsApi } from './goalsTabConfig';
import type { GoalsStateApi } from './useGoalsState';

export function useGoalsDerived(ctx: GoalsAndSimulatorTabPropsApi & GoalsStateApi) {
  const {
    goals,
    investments,
    simCdiAnnual,
    simCdiMultiplier,
    simInitialStr,
    simIsExempt,
    simMonthlyStr,
    simMonths,
  } = ctx;
  const assetMap = useMemo(
    () => new Map(investments.map((a) => [a.id, a])),
    [investments]
  );

  const getEffectiveGoalAmount = (goal: SavingsGoal): number => {
    if (goal.linkedAssetId) {
      const linked = assetMap.get(goal.linkedAssetId);
      if (linked) {
        return Math.round(linked.quantity * linked.currentPrice * 100) / 100;
      }
    }
    return goal.currentAmount;
  };

  const totalSavedInGoals = useMemo(
    () => goals.reduce((sum, g) => sum + getEffectiveGoalAmount(g), 0),
    [goals, assetMap]
  );
  const totalTargetInGoals = useMemo(
    () => goals.reduce((sum, g) => sum + g.targetAmount, 0),
    [goals]
  );

  const simulation = useMemo(() => {
    return simulateFixedIncomeBR({
      initialAmount: parseBRLInput(simInitialStr),
      monthlyContribution: parseBRLInput(simMonthlyStr),
      months: simMonths,
      cdiAnnualRatePercent: parseBRLInput(simCdiAnnual) || 10.75,
      cdiMultiplierPercent: parseBRLInput(simCdiMultiplier) || 100,
      isTaxExempt: simIsExempt,
    });
  }, [simInitialStr, simMonthlyStr, simMonths, simCdiAnnual, simCdiMultiplier, simIsExempt]);

  const getIndexerLabel = (indexer: SavingsGoal['indexer']) => {
    switch (indexer) {
      case 'TESOURO_SELIC':
        return 'Tesouro Selic (100% Selic)';
      case 'CDI_110':
        return 'CDB Liquidez 110% CDI';
      case 'LCI_92':
        return 'LCI / LCA 92% CDI (Isento IR)';
      case 'POUPANCA':
        return 'Caderneta de Poupança';
      default:
        return 'CDB / Caixinha 100% CDI';
    }
  };

  return {
    assetMap,
    getEffectiveGoalAmount,
    getIndexerLabel,
    simulation,
    totalSavedInGoals,
    totalTargetInGoals,
  };
}

export type GoalsDerivedApi = ReturnType<typeof useGoalsDerived>;
