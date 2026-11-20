/** Tudo o que ReportsAndDataTab calcula, junto: é o que as partes da tela recebem. */
import type { ReportsAndDataTabPropsApi } from './reportsTabConfig';
import type { ReportsStateApi } from './useReportsState';
import type { ReportsDerivedApi } from './useReportsDerived';
import type { ReportsActionsApi } from './useReportsActions';
import type { ReportsChartDataApi } from './useReportsChartData';

export type ReportsAndDataTabContext = ReportsAndDataTabPropsApi &
  ReportsStateApi &
  ReportsDerivedApi &
  ReportsActionsApi &
  ReportsChartDataApi;
