import React from 'react';
import { resolveSharedExpensesTabProps } from './shared-expenses-tab/sharedExpensesTabConfig';
import type { SharedExpensesTabProps } from './shared-expenses-tab/sharedExpensesTabConfig';
import { useSharedState } from './shared-expenses-tab/useSharedState';
import { useSharedDerived } from './shared-expenses-tab/useSharedDerived';
import { useSharedActions } from './shared-expenses-tab/useSharedActions';
import type { SharedExpensesTabContext } from './shared-expenses-tab/sharedExpensesTabContext';

import { SharedInvitesBanner } from './shared-expenses-tab/SharedInvitesBanner';
import { SharedKpiCards } from './shared-expenses-tab/SharedKpiCards';
import { SharedMemberModal } from './shared-expenses-tab/SharedMemberModal';
import { SharedSettlementModal } from './shared-expenses-tab/SharedSettlementModal';
import { SharedSubTabContent } from './shared-expenses-tab/SharedSubTabContent';
import { SharedSubTabHeader } from './shared-expenses-tab/SharedSubTabHeader';

export type { SharedExpensesTabProps };

/**
 * Aba Compartilhado: pessoas, despesas divididas, acertos e convites.
 * A lógica fica em shared-expenses-tab/ (hooks chamados sempre na mesma ordem; cada um recebe o que os anteriores devolveram).
 */
export const SharedExpensesTab: React.FC<SharedExpensesTabProps> = (props) => {
  const ctx0 = resolveSharedExpensesTabProps(props);
  const ctx1 = { ...ctx0, ...useSharedState(ctx0) };
  const ctx2 = { ...ctx1, ...useSharedDerived(ctx1) };
  const ctx3 = { ...ctx2, ...useSharedActions(ctx2) };
  const form: SharedExpensesTabContext = ctx3;
  const {

  } = form;
  return (
    <div className="module-page space-y-6">
      {/* Incoming Family Invitations Banner */}
      <SharedInvitesBanner form={form} />

      {/* Top Banner & Bilateral Compensation KPI Summary */}
      <SharedKpiCards form={form} />

      <SharedSubTabHeader form={form} />

      <SharedSubTabContent form={form} />

      <SharedSettlementModal form={form} />

      <SharedMemberModal form={form} />
    </div>
  );
};
