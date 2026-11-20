/** Tudo o que AccountsTab calcula, junto: é o que as partes da tela recebem. */
import type { AccountsTabPropsApi } from './accountsTabConfig';
import type { AccountsStateApi } from './useAccountsState';
import type { AccountsDerivedApi } from './useAccountsDerived';
import type { AccountsActionsApi } from './useAccountsActions';

export type AccountsTabContext = AccountsTabPropsApi &
  AccountsStateApi &
  AccountsDerivedApi &
  AccountsActionsApi;

/**
 * O que as partes da conta aberta recebem: conta ativa e extrato nunca são nulos aqui, porque essas partes só
 * aparecem quando AccountsTab confere que existem.
 */
export type AccountDetailContext = Omit<AccountsTabContext, 'activeAccount' | 'statementSummary'> & {
  activeAccount: NonNullable<AccountsTabContext['activeAccount']>;
  statementSummary: NonNullable<AccountsTabContext['statementSummary']>;
};
