/** Tudo o que TransactionModal calcula, junto: é o que as partes da tela recebem. */
import type { TransactionModalPropsApi } from './transactionModalConfig';
import type { TransactionFormStateApi } from './useTransactionFormState';
import type { TransactionFormEffectsApi } from './useTransactionFormEffects';
import type { TransactionFormHandlersApi } from './useTransactionFormHandlers';
import type { TransactionFormInsightsApi } from './useTransactionFormInsights';
import type { TransactionFormActionsApi } from './buildTransactionFormActions';

export type TransactionFormContext = TransactionModalPropsApi &
  TransactionFormStateApi &
  TransactionFormEffectsApi &
  TransactionFormHandlersApi &
  TransactionFormInsightsApi &
  TransactionFormActionsApi;
