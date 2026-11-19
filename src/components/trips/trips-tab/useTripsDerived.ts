/** Viagem ativa, resumo, lançamentos da viagem e máscara de valores. Parte de TripsTab (ver TripsTab.tsx). */
import { useMemo } from 'react';
import { calculateTripDashboardSummary } from '../../../domain/trips/travelRules';
import type { TripsTabPropsApi } from './tripsTabConfig';
import type { TripsStateApi } from './useTripsState';

export function useTripsDerived(ctx: TripsTabPropsApi & TripsStateApi) {
  const {
    activeViewTripId,
    categories,
    privacyMode,
    selectedTripId,
    setActiveViewTripId,
    setIsChartLoading,
    setIsConverterOpen,
    setSelectedTripId,
    setTripTabFilter,
    transactions,
    tripTabFilter,
    trips,
  } = ctx;
  // Active vs. Archived Trips Filtering
  const activeTrips = useMemo(() => trips.filter((t) => !t.isArchived), [trips]);
  const archivedTrips = useMemo(() => trips.filter((t) => Boolean(t.isArchived)), [trips]);
  const displayedTrips = tripTabFilter === 'active' ? activeTrips : archivedTrips;

  const effectiveTripId = activeViewTripId || selectedTripId;

  const activeTrip = useMemo(() => {
    const foundById = trips.find((t) => t.id === effectiveTripId);
    if (foundById) return foundById;
    const foundInDisplayed = displayedTrips.find((t) => t.id === selectedTripId);
    if (foundInDisplayed) return foundInDisplayed;
    if (displayedTrips.length > 0) return displayedTrips[0];
    return trips[0] || null;
  }, [displayedTrips, trips, effectiveTripId, selectedTripId]);

  const handleSelectTrip = (tripId: string) => {
    setSelectedTripId(tripId);
    setActiveViewTripId(tripId);
    setIsConverterOpen(true);
    if (tripId !== activeTrip?.id) {
      setIsChartLoading(true);
      window.setTimeout(() => {
        setIsChartLoading(false);
      }, 260);
    }
  };

  const handleSetTripTabFilter = (filter: 'active' | 'archived') => {
    if (filter !== tripTabFilter) {
      setIsChartLoading(true);
      setTripTabFilter(filter);
      window.setTimeout(() => {
        setIsChartLoading(false);
      }, 260);
    }
  };

  const summary = useMemo(() => {
    if (!activeTrip) return null;
    return calculateTripDashboardSummary(activeTrip, transactions, categories);
  }, [activeTrip, transactions, categories]);

  const tripTransactions = useMemo(() => {
    if (!activeTrip) return [];
    return transactions
      .filter(
        (tx) =>
          tx.tripId === activeTrip.id &&
          tx.type === 'expense' &&
          !tx.isInvoicePayment
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [activeTrip, transactions]);

  const maskValue = (formatted: string) => (privacyMode ? '••••••' : formatted);

  return {
    activeTrip,
    activeTrips,
    archivedTrips,
    displayedTrips,
    handleSelectTrip,
    handleSetTripTabFilter,
    maskValue,
    summary,
    tripTransactions,
  };
}

export type TripsDerivedApi = ReturnType<typeof useTripsDerived>;
