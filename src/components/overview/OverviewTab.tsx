import React from 'react';
import { resolveOverviewTabProps } from './overview-tab/overviewTabConfig';
import type { OverviewTabProps } from './overview-tab/overviewTabConfig';
import { useOverviewData } from './overview-tab/useOverviewData';
import type { OverviewTabContext } from './overview-tab/overviewTabContext';

import { OverviewAccountsAndBills } from './overview-tab/OverviewAccountsAndBills';
import { OverviewBudgetAlerts } from './overview-tab/OverviewBudgetAlerts';
import { OverviewCardsAndBudgets } from './overview-tab/OverviewCardsAndBudgets';
import { OverviewGreeting } from './overview-tab/OverviewGreeting';
import { OverviewHealthPanel } from './overview-tab/OverviewHealthPanel';
import { OverviewKpis } from './overview-tab/OverviewKpis';
import { OverviewRecurringSuggestions } from './overview-tab/OverviewRecurringSuggestions';

export type { OverviewTabProps };

/**
 * Visão Geral: saldo, previsão, contas a pagar, alertas e score de saúde.
 * A lógica fica em overview-tab/ (hooks chamados sempre na mesma ordem; cada um recebe o que os anteriores devolveram).
 */
export const OverviewTab: React.FC<OverviewTabProps> = (props) => {
  const ctx0 = resolveOverviewTabProps(props);
  const ctx1 = { ...ctx0, ...useOverviewData(ctx0) };
  const form: OverviewTabContext = ctx1;
  const {

  } = form;
  return (
    <div className="overview-dashboard space-y-6 min-w-0 max-w-full">
      {/* Clean Executive Greeting Header */}
      <OverviewGreeting form={form} />

      <OverviewKpis form={form} />

      <OverviewHealthPanel form={form} />

      <OverviewRecurringSuggestions form={form} />

      <OverviewBudgetAlerts form={form} />

      <OverviewAccountsAndBills form={form} />

      <OverviewCardsAndBudgets form={form} />
    </div>
  );
};
