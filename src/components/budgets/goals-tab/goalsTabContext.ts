/** Tudo o que GoalsAndSimulatorTab calcula, junto: é o que as partes da tela recebem. */
import type { GoalsAndSimulatorTabPropsApi } from './goalsTabConfig';
import type { GoalsStateApi } from './useGoalsState';
import type { GoalsDerivedApi } from './useGoalsDerived';
import type { GoalsActionsApi } from './useGoalsActions';

export type GoalsAndSimulatorTabContext = GoalsAndSimulatorTabPropsApi &
  GoalsStateApi &
  GoalsDerivedApi &
  GoalsActionsApi;
