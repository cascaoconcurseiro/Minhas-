/** Tudo o que TripsTab calcula, junto. */
import type { CurrencyCode, Trip } from '../../../types/finance';
import type { CURRENCY_CATALOG } from '../../../domain/trips/travelRules';
import type { TripsTabPropsApi } from './tripsTabConfig';
import type { TripsStateApi } from './useTripsState';
import type { TripsDerivedApi } from './useTripsDerived';
import type { TripsActionsApi } from './useTripsActions';
import type { TripsModalsApi } from './useTripsModals';

export type TripsTabContext = TripsTabPropsApi &
  TripsStateApi &
  TripsDerivedApi &
  TripsActionsApi &
  TripsModalsApi;

/**
 * O que as subtelas da viagem aberta recebem: a viagem ativa, o resumo e a moeda nunca são nulos aqui,
 * porque a tela principal só é montada depois de TripsTab conferir que existem.
 */
export type TripPageContext = Omit<TripsTabContext, 'activeTrip' | 'summary'> & {
  activeTrip: Trip;
  summary: NonNullable<TripsDerivedApi['summary']>;
  currencyMeta: (typeof CURRENCY_CATALOG)[CurrencyCode];
};
