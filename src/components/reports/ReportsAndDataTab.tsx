import React from 'react';
import { resolveReportsAndDataTabProps } from './reports-tab/reportsTabConfig';
import type { ReportsAndDataTabProps } from './reports-tab/reportsTabConfig';
import { useReportsState } from './reports-tab/useReportsState';
import { useReportsDerived } from './reports-tab/useReportsDerived';
import { useReportsActions } from './reports-tab/useReportsActions';
import { useReportsChartData } from './reports-tab/useReportsChartData';
import type { ReportsAndDataTabContext } from './reports-tab/reportsTabContext';

import { ReportsDailyCashFlow } from './reports-tab/ReportsDailyCashFlow';
import { ReportsMonthlyTable } from './reports-tab/ReportsMonthlyTable';
import { ReportsPeriodSummary } from './reports-tab/ReportsPeriodSummary';
import { ReportsPieCharts } from './reports-tab/ReportsPieCharts';
import { ReportsTrendCharts } from './reports-tab/ReportsTrendCharts';
import { ReportsWealthAndDre } from './reports-tab/ReportsWealthAndDre';

export type { ReportsAndDataTabProps };

/**
 * Relatórios e DRE: período, resultado, fluxo de caixa, patrimônio, importação e exportação.
 * A lógica fica em reports-tab/ (hooks chamados sempre na mesma ordem; cada um recebe o que os anteriores devolveram).
 */
export const ReportsAndDataTab: React.FC<ReportsAndDataTabProps> = (props) => {
  const ctx0 = resolveReportsAndDataTabProps(props);
  const ctx1 = { ...ctx0, ...useReportsState(ctx0) };
  const ctx2 = { ...ctx1, ...useReportsDerived(ctx1) };
  const ctx3 = { ...ctx2, ...useReportsActions(ctx2) };
  const ctx4 = { ...ctx3, ...useReportsChartData(ctx3) };
  const form: ReportsAndDataTabContext = ctx4;
  const {

  } = form;
  return (
    <div className="module-page space-y-6 sm:space-y-8">
      <ReportsPeriodSummary form={form} />

      <ReportsPieCharts form={form} />

      <ReportsTrendCharts form={form} />

      <ReportsMonthlyTable form={form} />

      <ReportsDailyCashFlow form={form} />

      <ReportsWealthAndDre form={form} />
    </div>
  );
};
