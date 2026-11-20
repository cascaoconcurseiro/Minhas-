/** Estado da tela: aporte, formulário da meta e campos do simulador. Parte de GoalsAndSimulatorTab (ver GoalsAndSimulatorTab.tsx). */
import { useState } from 'react';
import { getLocalDateISO } from '../../../domain/finance/financeRules';
import { getAccountCurrency } from '../../../domain/finance/transferRules';
import { SavingsGoal } from '../../../types/finance';
import type { GoalsAndSimulatorTabPropsApi } from './goalsTabConfig';

export function useGoalsState(ctx: GoalsAndSimulatorTabPropsApi) {
  const {
    accounts,
  } = ctx;
  const [activeGoalContributeId, setActiveGoalContributeId] = useState<string | null>(null);
  const [contributeAmountStr, setContributeAmountStr] = useState('500,00');
  const [contributeAccountId, setContributeAccountId] = useState<string>('');
  const [contributeDate, setContributeDate] = useState(getLocalDateISO);
  const [contributeError, setContributeError] = useState('');
  const brlAccounts = accounts.filter((account) => getAccountCurrency(account) === 'BRL');
  const contributeAccount = brlAccounts.find((account) => account.id === contributeAccountId) ?? null;
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);

  // Goal Form State
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('0,00');
  const [goalMonthly, setGoalMonthly] = useState('0,00');
  const [goalDeadline, setGoalDeadline] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return getLocalDateISO(d);
  });
  const [goalIndexer, setGoalIndexer] = useState<SavingsGoal['indexer']>('TESOURO_SELIC');
  const [goalCategory, setGoalCategory] = useState('Patrimônio');
  const [goalNotes, setGoalNotes] = useState('');
  const [goalLinkedAssetId, setGoalLinkedAssetId] = useState('');

  // Brazilian Fixed Income Simulator State
  const [simInitialStr, setSimInitialStr] = useState('0,00');
  const [simMonthlyStr, setSimMonthlyStr] = useState('0,00');
  const [simMonths, setSimMonths] = useState(24);
  const [simCdiAnnual, setSimCdiAnnual] = useState('10,75');
  const [simCdiMultiplier, setSimCdiMultiplier] = useState('100');
  const [simIsExempt, setSimIsExempt] = useState(false);

  return {
    activeGoalContributeId,
    brlAccounts,
    contributeAccount,
    contributeAccountId,
    contributeAmountStr,
    contributeDate,
    contributeError,
    editingGoal,
    goalCategory,
    goalCurrent,
    goalDeadline,
    goalIndexer,
    goalLinkedAssetId,
    goalMonthly,
    goalName,
    goalNotes,
    goalTarget,
    setActiveGoalContributeId,
    setContributeAccountId,
    setContributeAmountStr,
    setContributeDate,
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
    setSimCdiAnnual,
    setSimCdiMultiplier,
    setSimInitialStr,
    setSimIsExempt,
    setSimMonthlyStr,
    setSimMonths,
    showGoalForm,
    simCdiAnnual,
    simCdiMultiplier,
    simInitialStr,
    simIsExempt,
    simMonthlyStr,
    simMonths,
  };
}

export type GoalsStateApi = ReturnType<typeof useGoalsState>;
