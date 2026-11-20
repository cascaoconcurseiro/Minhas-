import React from 'react';
import { resolveInvestmentsTabProps } from './investments-tab/investmentsTabConfig';
import type { InvestmentsTabProps } from './investments-tab/investmentsTabConfig';
import { useInvestmentsState } from './investments-tab/useInvestmentsState';
import { useInvestmentsMarketData } from './investments-tab/useInvestmentsMarketData';
import { useInvestmentsDerived } from './investments-tab/useInvestmentsDerived';
import { useInvestmentsActions } from './investments-tab/useInvestmentsActions';
import type { InvestmentsTabContext } from './investments-tab/investmentsTabContext';

import { InvestmentAssetForm } from './investments-tab/InvestmentAssetForm';
import { InvestmentOperationForm } from './investments-tab/InvestmentOperationForm';
import { InvestmentPositionsMobileList } from './investments-tab/InvestmentPositionsMobileList';
import { InvestmentPositionsTable } from './investments-tab/InvestmentPositionsTable';
import { InvestmentsAllocationRow } from './investments-tab/InvestmentsAllocationRow';
import { InvestmentsDividendHistory } from './investments-tab/InvestmentsDividendHistory';
import { InvestmentsKpis } from './investments-tab/InvestmentsKpis';
import { InvestmentsPositionsHeader } from './investments-tab/InvestmentsPositionsHeader';

export type { InvestmentsTabProps };

/**
 * Aba Investimentos: carteira, cotações, aportes, resgates e metas de alocação.
 * A lógica fica em investments-tab/ (hooks chamados sempre na mesma ordem; cada um recebe o que os anteriores devolveram).
 */
export const InvestmentsTab: React.FC<InvestmentsTabProps> = (props) => {
  const ctx0 = resolveInvestmentsTabProps(props);
  const ctx1 = { ...ctx0, ...useInvestmentsState(ctx0) };
  const ctx2 = { ...ctx1, ...useInvestmentsMarketData(ctx1) };
  const ctx3 = { ...ctx2, ...useInvestmentsDerived(ctx2) };
  const ctx4 = { ...ctx3, ...useInvestmentsActions(ctx3) };
  const form: InvestmentsTabContext = ctx4;
  const {

  } = form;
  return (
    <div className="module-page space-y-6 min-w-0 max-w-full" data-testid="investments-tab-view">
      {/* Row 1: 4 Executive Wealth & Passive Income KPIs (2x2 on Mobile, 4 Columns on Desktop) */}
      <InvestmentsKpis form={form} />

      <InvestmentsAllocationRow form={form} />

      {/* Row 3: Detailed Assets Table & Operations */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <InvestmentsPositionsHeader form={form} />

        <InvestmentAssetForm form={form} />

        <InvestmentOperationForm form={form} />

        <InvestmentPositionsMobileList form={form} />

        <InvestmentPositionsTable form={form} />
      </section>

      <InvestmentsDividendHistory form={form} />
    </div>
  );
};
