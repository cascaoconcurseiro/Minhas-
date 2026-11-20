/** Tudo o que OverviewTab calcula, junto: é o que as partes da tela recebem. */
import type { OverviewTabPropsApi } from './overviewTabConfig';
import type { OverviewDataApi } from './useOverviewData';

export type OverviewTabContext = OverviewTabPropsApi &
  OverviewDataApi;
