/** Tudo o que BudgetsTab calcula, junto: é o que as partes da tela recebem. */
import type { BudgetsTabPropsApi } from './budgetsTabConfig';
import type { BudgetsStateApi } from './useBudgetsState';
import type { BudgetsDerivedApi } from './useBudgetsDerived';
import type { BudgetsActionsApi } from './useBudgetsActions';

export type BudgetsTabContext = BudgetsTabPropsApi &
  BudgetsStateApi &
  BudgetsDerivedApi &
  BudgetsActionsApi;
