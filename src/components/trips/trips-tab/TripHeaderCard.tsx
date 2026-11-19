/** Cartão da viagem: nome, destino, datas, moeda, viajantes e ações. Parte de TripsTab (ver TripsTab.tsx). */
import { Archive, ArchiveRestore, Calculator, Calendar, Coins, FileDown, Globe, Plane, Plus, Trash2, UserPlus } from 'lucide-react';
import { formatExchangeRateBR } from '../../../domain/trips/travelRules';
import { formatShortDateBR } from '../../../domain/finance/financeRules';
import type { TripPageContext } from './tripsTabContext';

export function TripHeaderCard({ form }: { form: TripPageContext }) {
  const {
    activeTrip,
    chartPeriodMode,
    currencyMeta,
    handleExportPdfReport,
    handleOpenEditTripModal,
    handleOpenLotModal,
    handleToggleArchiveTrip,
    isConverterOpen,
    onDeleteTrip,
    onOpenNewTripExpense,
    setActiveViewTripId,
    setChartPeriodMode,
    setIsConverterOpen,
    setIsParticipantModalOpen,
    summary,
  } = form;
  return (
    <>
{/* Dedicated Trip Header Card */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Row 1: Badges & Right-Aligned Toolbar (Segmented Control Period Selector + Export Button) */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800">
              <Plane className="h-3.5 w-3.5" />
              Página Exclusiva: {activeTrip.name}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <span>{currencyMeta.flag}</span>
              <span>Moeda Exclusiva: {activeTrip.currency} ({currencyMeta.symbol})</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
              Câmbio VET Médio: {formatExchangeRateBR(summary.weightedAverageRate)}
            </span>
            {activeTrip.isArchived && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <Archive className="h-3 w-3" />
                Viagem Arquivada / Concluída
              </span>
            )}
          </div>

          {/* Right-Aligned Toolbar: Period Segmented Control + Export Button + Action Buttons */}
          <div
            data-testid="trips-right-toolbar"
            className="flex flex-wrap items-center justify-end gap-2.5 sm:gap-3 ml-auto"
          >
            {/* Segmented Control: Period Selector */}
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

            {/* PDF Report Export Button */}
            <button
              type="button"
              data-testid="export-pdf-report-btn"
              onClick={handleExportPdfReport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-2xs"
              title="Exportar Resumo PDF com Lotes de Câmbio, Economia e Despesas (Download Direto)"
            >
              <FileDown className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Exportar Relatório PDF</span>
            </button>

            {/* Smart Currency Converter Toggle */}
            <button
              type="button"
              data-testid="toggle-smart-converter-btn"
              onClick={() => setIsConverterOpen(!isConverterOpen)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
                isConverterOpen
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
              }`}
              title="Abrir utilitário de conversão inteligente com o último câmbio"
            >
              <Calculator className="h-3.5 w-3.5 text-emerald-600" />
              <span>Conversor Inteligente</span>
            </button>

            <button
              type="button"
              onClick={handleOpenLotModal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
            >
              <Coins className="h-3.5 w-3.5 text-amber-600" />
              <span>+ Câmbio</span>
            </button>

            <button
              type="button"
              data-testid="add-trip-participant-btn"
              onClick={() => setIsParticipantModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5 text-sky-600" />
              <span>+ Convidar Viajante</span>
            </button>

            <button
              type="button"
              data-testid="launch-trip-expense-btn"
              onClick={() => onOpenNewTripExpense(activeTrip.id)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Lançar Gasto ({activeTrip.currency})</span>
            </button>
          </div>
        </div>

        {/* Trip Subtitle, Dates, Archival Action & Participants Info */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
              <Globe className="h-3.5 w-3.5 text-sky-600" />
              {activeTrip.destination}
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              {formatShortDateBR(activeTrip.startDate)} até{' '}
              {formatShortDateBR(activeTrip.endDate)} ({summary.totalDays} dias)
            </span>

            {/* Archive / Unarchive Button */}
            <button
              type="button"
              data-testid="toggle-archive-trip-btn"
              onClick={() => handleToggleArchiveTrip(activeTrip)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors inline-flex items-center gap-1 ${
                activeTrip.isArchived
                  ? 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 hover:bg-sky-100'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
              title={
                activeTrip.isArchived
                  ? 'Desarquivar e retornar aos roteiros ativos'
                  : 'Arquivar viagem (mover para histórico e remover das ativas)'
              }
            >
              {activeTrip.isArchived ? (
                <>
                  <ArchiveRestore className="h-3 w-3 text-sky-600" />
                  <span>Restaurar para Ativas</span>
                </>
              ) : (
                <>
                  <Archive className="h-3 w-3 text-amber-600" />
                  <span>Arquivar Viagem</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleOpenEditTripModal(activeTrip)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
            >
              Editar Roteiro
            </button>

            <button
              type="button"
              data-testid="delete-active-trip-btn"
              onClick={() => {
                onDeleteTrip(activeTrip.id);
                setActiveViewTripId(null);
              }}
              className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40 px-2.5 py-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors inline-flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
              <span>Excluir Viagem</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400">
              Participantes ({activeTrip.participants.length}):
            </span>
            {activeTrip.participants.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
