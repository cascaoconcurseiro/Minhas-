import React from 'react';
import { resolveAccountsTabProps } from './accounts-tab/accountsTabConfig';
import type { AccountsTabProps } from './accounts-tab/accountsTabConfig';
import { useAccountsState } from './accounts-tab/useAccountsState';
import { useAccountsDerived } from './accounts-tab/useAccountsDerived';
import { useAccountsActions } from './accounts-tab/useAccountsActions';
import type { AccountDetailContext, AccountsTabContext } from './accounts-tab/accountsTabContext';

import { AccountDetailHeader } from './accounts-tab/AccountDetailHeader';
import { AccountDetailKpis } from './accounts-tab/AccountDetailKpis';
import { AccountForm } from './accounts-tab/AccountForm';
import { AccountInternationalMetrics } from './accounts-tab/AccountInternationalMetrics';
import { AccountStatementEntries } from './accounts-tab/AccountStatementEntries';
import { AccountStatementFooter } from './accounts-tab/AccountStatementFooter';
import { AccountStatementToolbar } from './accounts-tab/AccountStatementToolbar';
import { AccountsKpis } from './accounts-tab/AccountsKpis';
import { AccountsListHeader } from './accounts-tab/AccountsListHeader';
import { AccountsListSection } from './accounts-tab/AccountsListSection';

export type { AccountsTabProps };

/**
 * Aba Contas e Carteiras: lista de contas, extrato com saldo corrido e cadastro.
 * A lógica fica em accounts-tab/ (hooks chamados sempre na mesma ordem; cada um recebe o que os anteriores devolveram).
 */
export const AccountsTab: React.FC<AccountsTabProps> = (props) => {
  const ctx0 = resolveAccountsTabProps(props);
  const ctx1 = { ...ctx0, ...useAccountsState(ctx0) };
  const ctx2 = { ...ctx1, ...useAccountsDerived(ctx1) };
  const ctx3 = { ...ctx2, ...useAccountsActions(ctx2) };
  const form: AccountsTabContext = ctx3;
  const detailForm = form as AccountDetailContext;
  const {
    activeAccount,
    isAccountDetailOpen,
    statementSummary,
  } = form;
  return (
    <div className="module-page space-y-6 min-w-0 max-w-full" data-testid="accounts-tab-view">
      {/* VIEW 1: ACCOUNTS OVERVIEW LIST (Shown when no specific account page is opened) */}
      {!isAccountDetailOpen && (
        <>
          {/* Row 1: Consolidated Cash & Patrimony KPI Strip */}
          <AccountsKpis form={form} />

          {/* Row 2: Interactive Bank Account & Wallet Cards Grid */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-5">
            <AccountsListHeader form={form} />

            <AccountForm form={form} />

            <AccountsListSection form={form} />
          </section>
        </>
      )}

      {/* VIEW 2: DEDICATED ACCOUNT PAGE WITH FULL BANK STATEMENT */}
      {isAccountDetailOpen && activeAccount && statementSummary && (
        <div className="module-page space-y-5 animate-expand-in" data-testid="account-dedicated-page">
          {/* Top Navigation Bar: Back to All Accounts + Quick Switcher */}
          <AccountDetailHeader form={detailForm} />

          <AccountInternationalMetrics form={detailForm} />

          {/* Account-Specific KPI Strip */}
          <AccountDetailKpis form={detailForm} />

          {/* Real Bank Statement (Extrato Bancário Completo com Saldo Progressivo) */}
          <section
            data-testid="real-bank-statement-section"
            className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs"
          >
            <AccountStatementToolbar form={detailForm} />

        <AccountStatementEntries form={detailForm} />

        <AccountStatementFooter form={detailForm} />
      </section>
      </div>
      )}
    </div>
  );
};
