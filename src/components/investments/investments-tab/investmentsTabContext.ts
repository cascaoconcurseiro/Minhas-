/** Tudo o que InvestmentsTab calcula, junto: é o que as partes da tela recebem. */
import type { InvestmentsTabPropsApi } from './investmentsTabConfig';
import type { InvestmentsStateApi } from './useInvestmentsState';
import type { InvestmentsMarketDataApi } from './useInvestmentsMarketData';
import type { InvestmentsDerivedApi } from './useInvestmentsDerived';
import type { InvestmentsActionsApi } from './useInvestmentsActions';

export type InvestmentsTabContext = InvestmentsTabPropsApi &
  InvestmentsStateApi &
  InvestmentsMarketDataApi &
  InvestmentsDerivedApi &
  InvestmentsActionsApi;
