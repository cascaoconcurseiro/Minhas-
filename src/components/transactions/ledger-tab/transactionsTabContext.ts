/** Tudo o que TransactionsTab calcula, junto: é o que as partes da tela recebem. */
import type { TransactionsTabPropsApi } from './transactionsTabConfig';
import type { LedgerStateApi } from './useLedgerState';
import type { LedgerDerivedApi } from './useLedgerDerived';
import type { LedgerActionsApi } from './useLedgerActions';

export type TransactionsTabContext = TransactionsTabPropsApi &
  LedgerStateApi &
  LedgerDerivedApi &
  LedgerActionsApi;
