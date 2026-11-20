/** Ações: abrir formulário, confirmar aporte e salvar meta. Parte de GoalsAndSimulatorTab (ver GoalsAndSimulatorTab.tsx). */
import { getLocalDateISO, parseBRLInput } from '../../../domain/finance/financeRules';
import { SavingsGoal } from '../../../types/finance';
import { isValidISODate } from '../../../domain/finance/formatting';
import React from 'react';
import type { GoalsAndSimulatorTabPropsApi } from './goalsTabConfig';
import type { GoalsStateApi } from './useGoalsState';
import type { GoalsDerivedApi } from './useGoalsDerived';

export function useGoalsActions(ctx: GoalsAndSimulatorTabPropsApi & GoalsStateApi & GoalsDerivedApi) {
  const {
    assetMap,
    contributeAccountId,
    contributeAmountStr,
    contributeDate,
    editingGoal,
    getEffectiveGoalAmount,
    goalCategory,
    goalCurrent,
    goalDeadline,
    goalIndexer,
    goalLinkedAssetId,
    goalMonthly,
    goalName,
    goalNotes,
    goalTarget,
    goals,
    onAddGoal,
    onContributeGoal,
    onUpdateGoal,
    setActiveGoalContributeId,
    setContributeError,
    setEditingGoal,
    setGoalCategory,
    setGoalCurrent,
    setGoalDeadline,
    setGoalIndexer,
    setGoalLinkedAssetId,
    setGoalMonthly,
    setGoalName,
    setGoalNotes,
    setGoalTarget,
    setShowGoalForm,
  } = ctx;
  const openNewGoalForm = () => {
    setEditingGoal(null);
    setGoalName('');
    setGoalTarget('');
    setGoalCurrent('0,00');
    setGoalMonthly('0,00');
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setGoalDeadline(getLocalDateISO(nextYear));
    setGoalIndexer('TESOURO_SELIC');
    setGoalCategory('Sonhos & Patrimônio');
    setGoalNotes('');
    setGoalLinkedAssetId('');
    setShowGoalForm(true);
  };

  const openEditGoalForm = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setGoalName(goal.name);
    setGoalTarget(goal.targetAmount.toFixed(2).replace('.', ','));
    const effectiveAmt = getEffectiveGoalAmount(goal);
    setGoalCurrent(effectiveAmt.toFixed(2).replace('.', ','));
    setGoalMonthly(goal.monthlyContribution.toFixed(2).replace('.', ','));
    setGoalDeadline(goal.deadline);
    setGoalIndexer(goal.indexer);
    setGoalCategory(goal.category);
    setGoalNotes(goal.notes || '');
    setGoalLinkedAssetId(goal.linkedAssetId || '');
    setShowGoalForm(true);
  };

  const handleConfirmContribution = (goalId: string) => {
    if (!isValidISODate(contributeDate)) {
      setContributeError('Informe uma data válida para o aporte.');
      return;
    }
    const val = parseBRLInput(contributeAmountStr);
    if (val > 0) {
      const goal = goals.find(item => item.id === goalId);
      onContributeGoal(goalId, val, goal?.linkedAssetId ? contributeAccountId || undefined : undefined, contributeDate);
    }
    setActiveGoalContributeId(null);
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const targetVal = parseBRLInput(goalTarget);
    if (!goalName.trim() || targetVal <= 0) return;

    const linkedAsset = goalLinkedAssetId ? assetMap.get(goalLinkedAssetId) : undefined;
    const syncedCurrentVal = linkedAsset
      ? Math.round(linkedAsset.quantity * linkedAsset.currentPrice * 100) / 100
      : parseBRLInput(goalCurrent);

    if (editingGoal) {
      onUpdateGoal({
        ...editingGoal,
        name: goalName.trim(),
        targetAmount: targetVal,
        currentAmount: syncedCurrentVal,
        monthlyContribution: parseBRLInput(goalMonthly),
        deadline: goalDeadline,
        indexer: goalIndexer,
        category: goalCategory,
        notes: goalNotes.trim() || undefined,
        linkedAssetId: goalLinkedAssetId || undefined,
      });
    } else {
      onAddGoal({
        name: goalName.trim(),
        targetAmount: targetVal,
        currentAmount: syncedCurrentVal,
        monthlyContribution: parseBRLInput(goalMonthly),
        deadline: goalDeadline,
        indexer: goalIndexer,
        category: goalCategory,
        notes: goalNotes.trim() || undefined,
        linkedAssetId: goalLinkedAssetId || undefined,
      });
    }

    setGoalName('');
    setEditingGoal(null);
    setShowGoalForm(false);
  };

  return {
    handleConfirmContribution,
    handleSaveGoal,
    openEditGoalForm,
    openNewGoalForm,
  };
}

export type GoalsActionsApi = ReturnType<typeof useGoalsActions>;
