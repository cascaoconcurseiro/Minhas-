import React from 'react';
import { resolveGoalsAndSimulatorTabProps } from './goals-tab/goalsTabConfig';
import type { GoalsAndSimulatorTabProps } from './goals-tab/goalsTabConfig';
import { useGoalsState } from './goals-tab/useGoalsState';
import { useGoalsDerived } from './goals-tab/useGoalsDerived';
import { useGoalsActions } from './goals-tab/useGoalsActions';
import type { GoalsAndSimulatorTabContext } from './goals-tab/goalsTabContext';

import { FixedIncomeSimulator } from './goals-tab/FixedIncomeSimulator';
import { GoalsList } from './goals-tab/GoalsList';
import { GoalsSummaryAndForm } from './goals-tab/GoalsSummaryAndForm';

export type { GoalsAndSimulatorTabProps };

/**
 * Metas e simulador: metas de poupança, aportes e simulação de renda fixa.
 * A lógica fica em goals-tab/ (hooks chamados sempre na mesma ordem; cada um recebe o que os anteriores devolveram).
 */
export const GoalsAndSimulatorTab: React.FC<GoalsAndSimulatorTabProps> = (props) => {
  const ctx0 = resolveGoalsAndSimulatorTabProps(props);
  const ctx1 = { ...ctx0, ...useGoalsState(ctx0) };
  const ctx2 = { ...ctx1, ...useGoalsDerived(ctx1) };
  const ctx3 = { ...ctx2, ...useGoalsActions(ctx2) };
  const form: GoalsAndSimulatorTabContext = ctx3;
  const {

  } = form;
  return (
    <div className="module-page space-y-6 sm:space-y-8 min-w-0 max-w-full">
      {/* Header & Summary */}
      <GoalsSummaryAndForm form={form} />

      <GoalsList form={form} />

      <FixedIncomeSimulator form={form} />
    </div>
  );
};
