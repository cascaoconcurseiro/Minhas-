/** Barra de navegação: voltar para todas as viagens e troca rápida de viagem. Parte de TripsTab (ver TripsTab.tsx). */
import { ArrowLeft, Plus } from 'lucide-react';
import { CURRENCY_CATALOG } from '../../../domain/trips/travelRules';
import type { TripPageContext } from './tripsTabContext';

export function TripTopBar({ form }: { form: TripPageContext }) {
  const {
    activeTrip,
    displayedTrips,
    handleOpenNewTripModal,
    handleSelectTrip,
    setActiveViewTripId,
    trips,
  } = form;
  return (
    <>
{/* Top Navigation Bar: Back to All Trips + Quick Trip Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          data-testid="back-to-trips-list-btn"
          onClick={() => setActiveViewTripId(null)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-2xs"
        >
          <ArrowLeft className="h-4 w-4 text-sky-600" />
          <span>Voltar para Todas as Viagens ({trips.length})</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {displayedTrips.map((t) => {
            const isSelected = t.id === activeTrip.id;
            const flag = CURRENCY_CATALOG[t.currency]?.flag || '🌍';
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleSelectTrip(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all border ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-emerald-600 dark:border-emerald-500 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                <span>{flag}</span>
                <span className="break-words sm:truncate max-w-[160px]">{t.name}</span>
                <span className="text-[10px] opacity-80">({t.currency})</span>
              </button>
            );
          })}
          <button
            type="button"
            data-testid="new-trip-btn"
            onClick={handleOpenNewTripModal}
            className="inline-flex items-center gap-1 rounded-xl border border-dashed border-emerald-400 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nova Viagem</span>
          </button>
        </div>
      </div>
    </>
  );
}
