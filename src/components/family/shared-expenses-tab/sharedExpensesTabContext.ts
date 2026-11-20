/** Tudo o que SharedExpensesTab calcula, junto: é o que as partes da tela recebem. */
import type { SharedExpensesTabPropsApi } from './sharedExpensesTabConfig';
import type { SharedStateApi } from './useSharedState';
import type { SharedDerivedApi } from './useSharedDerived';
import type { SharedActionsApi } from './useSharedActions';

export type SharedExpensesTabContext = SharedExpensesTabPropsApi &
  SharedStateApi &
  SharedDerivedApi &
  SharedActionsApi;
