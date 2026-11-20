/** Tudo o que BankReconciliationModal calcula, junto: é o que as partes da tela recebem. */
import type { BankReconciliationModalPropsApi } from './bankReconciliationConfig';
import type { ReconciliationStateApi } from './useReconciliationState';
import type { ReconciliationDerivedApi } from './useReconciliationDerived';
import type { ReconciliationActionsApi } from './useReconciliationActions';

export type BankReconciliationModalContext = BankReconciliationModalPropsApi &
  ReconciliationStateApi &
  ReconciliationDerivedApi &
  ReconciliationActionsApi;
