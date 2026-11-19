import React from 'react';
import { Archive, Calendar, FileDown, Plane, Plus, Trash2 } from 'lucide-react';
import { CURRENCY_CATALOG, calculateTripDashboardSummary, formatExchangeRateBR, formatForeignCurrency } from '../../domain/trips/travelRules';
import { formatBRL, formatShortDateBR } from '../../domain/finance/financeRules';
import { resolveTripsTabProps } from './trips-tab/tripsTabConfig';
import type { TripsTabProps } from './trips-tab/tripsTabConfig';
import { useTripsState } from './trips-tab/useTripsState';
import { useTripsDerived } from './trips-tab/useTripsDerived';
import { useTripsActions } from './trips-tab/useTripsActions';
import { useTripsModals } from './trips-tab/useTripsModals';
import type { TripPageContext } from './trips-tab/tripsTabContext';

import { TripConverterAndKpis } from './trips-tab/TripConverterAndKpis';
import { TripFxWalletView } from './trips-tab/TripFxWalletView';
import { TripGroupSplitView } from './trips-tab/TripGroupSplitView';
import { TripHeaderCard } from './trips-tab/TripHeaderCard';
import { TripHowItWorksView } from './trips-tab/TripHowItWorksView';
import { TripLotAndParticipantModals } from './trips-tab/TripLotAndParticipantModals';
import { TripSettlementAndPdfModals } from './trips-tab/TripSettlementAndPdfModals';
import { TripSpendView } from './trips-tab/TripSpendView';
import { TripSubNav } from './trips-tab/TripSubNav';
import { TripTopBar } from './trips-tab/TripTopBar';

export type { TripsTabProps };

/**
 * Aba Viagens: lista de viagens e página de cada viagem (gastos, divisão, carteira de câmbio).
 * A lógica fica em trips-tab/ (hooks chamados sempre na mesma ordem; cada um recebe o que os anteriores devolveram).
 */
export const TripsTab: React.FC<TripsTabProps> = (props) => {
  const ctx0 = resolveTripsTabProps(props);
  const ctx1 = { ...ctx0, ...useTripsState(ctx0) };
  const ctx2 = { ...ctx1, ...useTripsDerived(ctx1) };
  const ctx3 = { ...ctx2, ...useTripsActions(ctx2) };
  const ctx4 = { ...ctx3, ...useTripsModals(ctx3) };
  const { activeTrip, activeTrips, activeViewTripId, archivedTrips, categories, chartPeriodMode, displayedTrips, handleOpenNewTripModal, handleSelectTrip, handleSetTripTabFilter, maskValue, newTripModalNode, onDeleteTrip, onOpenNewTripExpense, setChartPeriodMode, summary, transactions, tripTabFilter } = ctx4;
  if (!activeTrip || !summary) {
    return (
      <div id="trips-container" className="module-page space-y-5">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800">
                <Plane className="h-3.5 w-3.5" />
                TravelSpend + Splitwise Multi-Moeda
              </span>
            </div>

            {/* Right-Aligned Toolbar: Segmented Control Period Selector + Export Button */}
            <div
              data-testid="trips-right-toolbar"
              className="flex flex-wrap items-center justify-end gap-2.5 sm:gap-3 ml-auto"
            >
              <div
                role="group"
                aria-label="Seletor de período"
                className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/90 p-1 border border-slate-200/80 dark:border-slate-700 gap-1"
              >
                <button
                  type="button"
                  data-testid="toolbar-period-lot-btn"
                  aria-pressed={chartPeriodMode === 'lot'}
                  onClick={() => setChartPeriodMode('lot')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    chartPeriodMode === 'lot'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Por Lote
                </button>
                <button
                  type="button"
                  data-testid="toolbar-period-month-btn"
                  aria-pressed={chartPeriodMode === 'month'}
                  onClick={() => setChartPeriodMode('month')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    chartPeriodMode === 'month'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Por Mês
                </button>
              </div>

              <button
                type="button"
                data-testid="export-pdf-report-btn"
                disabled
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-2xs"
                title="Cadastre uma viagem para exportar o relatório PDF"
              >
                <FileDown className="h-3.5 w-3.5 text-slate-400" />
                <span>Exportar Relatório PDF</span>
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-xs">
          <Plane className="mx-auto h-10 w-10 text-emerald-600 mb-3" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">
            Nenhuma viagem cadastrada
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Crie um roteiro internacional ou nacional para acompanhar gastos por dia (estilo TravelSpend), câmbio médio ponderado e divisão de despesas em grupo.
          </p>
          <button
            type="button"
            data-testid="create-first-trip-btn"
            onClick={handleOpenNewTripModal}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Criar Primeira Viagem
          </button>
        </div>

        {newTripModalNode}
      </div>
    );
  }

  const currencyMeta = CURRENCY_CATALOG[activeTrip.currency];

  // OVERVIEW GRID VIEW (When no specific trip is open in dedicated page mode)
  if (!activeViewTripId) {
    return (
      <div id="trips-container" className="space-y-5">
        {/* Executive Header of Trips Overview */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800">
                <Plane className="h-3.5 w-3.5" />
                Minhas Viagens & Roteiros Internacionais
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-display mt-1.5">
              Escolha uma Viagem para Abrir sua Página Exclusiva
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cada viagem possui seu próprio extrato na moeda oficial (EUR, USD, GBP...), câmbio médio ponderado (Wise/Nomad) e divisão de despesas isolada do Real.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label="Filtro de status das viagens"
              className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/90 p-1 border border-slate-200/80 dark:border-slate-700 gap-1"
            >
              <button
                type="button"
                data-testid="filter-active-trips-btn"
                aria-pressed={tripTabFilter === 'active'}
                onClick={() => handleSetTripTabFilter('active')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  tripTabFilter === 'active'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/30'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <span>Ativas ({activeTrips.length})</span>
              </button>
              <button
                type="button"
                data-testid="filter-archived-trips-btn"
                aria-pressed={tripTabFilter === 'archived'}
                onClick={() => handleSetTripTabFilter('archived')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  tripTabFilter === 'archived'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/30'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Archive className="h-3 w-3" />
                <span>Arquivadas ({archivedTrips.length})</span>
              </button>
            </div>

            <button
              type="button"
              data-testid="new-trip-btn"
              onClick={handleOpenNewTripModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Criar Nova Viagem</span>
            </button>
          </div>
        </div>

        {/* Grid of Trip Cards (Same Pattern as Accounts and Credit Cards) */}
        <div
          data-testid="trips-overview-grid"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {displayedTrips.map((t) => {
            const tSummary = calculateTripDashboardSummary(t, transactions, categories);
            const tMeta = CURRENCY_CATALOG[t.currency];
            const tTxCount = transactions.filter(
              (tx) => tx.tripId === t.id && tx.type === 'expense' && !tx.isInvoicePayment
            ).length;

            return (
              <div
                key={t.id}
                data-testid={`trip-card-${t.id}`}
                onClick={() => handleSelectTrip(t.id)}
                className="group cursor-pointer rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-sky-500 dark:hover:border-sky-500 hover:shadow-md transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-xl shrink-0">
                        {tMeta?.flag || '✈️'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white break-words sm:truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          {t.name}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 break-words sm:truncate">
                          {t.destination}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-lg bg-sky-100 dark:bg-sky-900/70 px-2 py-0.5 text-[11px] font-extrabold font-mono text-sky-900 dark:text-sky-200 shrink-0">
                      {t.currency} ({tMeta?.symbol})
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Minha Parte ({t.currency})
                      </span>
                      <span className="text-sm font-extrabold font-mono text-slate-900 dark:text-white">
                        {maskValue(
                          formatForeignCurrency(tSummary.myPersonalSpendForeign, t.currency)
                        )}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 block">
                        ≈ {maskValue(formatBRL(tSummary.myPersonalSpendBrl))}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Câmbio Médio (VET)
                      </span>
                      <span className="text-sm font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
                        {formatExchangeRateBR(tSummary.weightedAverageRate)}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {t.exchangeLots.length} compra(s) de câmbio
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {formatShortDateBR(t.startDate)} a {formatShortDateBR(t.endDate)}
                    </span>
                    <span className="font-semibold">
                      {t.participants.length} viajante(s) • {tTxCount} gasto(s)
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-sky-700 dark:text-sky-400 group-hover:underline">
                    Abrir Página da Viagem →
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenNewTripExpense(t.id);
                      }}
                      className="rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                    >
                      + Gasto ({t.currency})
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTrip(t.id);
                      }}
                      aria-label={`Excluir viagem ${t.name}`}
                      title="Excluir viagem"
                      className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40 p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {newTripModalNode}
      </div>
    );
  }
  const form: TripPageContext = { ...ctx4, activeTrip, summary, currencyMeta };
  const {

  } = form;
  return (
    <div id="trips-container" data-testid="trip-dedicated-page" className="module-page space-y-5">
      <TripTopBar form={form} />

      <TripHeaderCard form={form} />

      <TripConverterAndKpis form={form} />

      <TripSubNav form={form} />

      <TripSpendView form={form} />

      <TripGroupSplitView form={form} />

      <TripFxWalletView form={form} />

      <TripHowItWorksView form={form} />

      <TripLotAndParticipantModals form={form} />

      <TripSettlementAndPdfModals form={form} />
    </div>
  );
};
