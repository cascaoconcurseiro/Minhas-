import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Coins,
  FileDown,
  Info,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { CurrencyCode, TripExchangeLot } from '../types/finance';
import { formatBRL, formatShortDateBR } from '../utils/financeRules';
import {
  calculateExchangeSavingsAnalysis,
  ExchangeSavingsAnalysis,
  formatExchangeRateBR,
  formatForeignCurrency,
  LotSavingsItem,
  MonthlySavingsItem,
} from '../utils/travelRules';
import { TripSavingsChartSkeleton } from './SkeletonScreens';

export { TripSavingsChartSkeleton };

export interface TripSavingsChartProps {
  exchangeLots: TripExchangeLot[];
  currency: CurrencyCode;
  fallbackBenchmarkRate: number;
  privacyMode?: boolean;
  isLoading?: boolean;
  periodMode?: 'lot' | 'month';
  onPeriodModeChange?: (mode: 'lot' | 'month') => void;
  onExportPdfReport?: () => void;
}

export const TripSavingsChart: React.FC<TripSavingsChartProps> = ({
  exchangeLots,
  currency,
  fallbackBenchmarkRate,
  privacyMode = false,
  isLoading = false,
  periodMode: controlledPeriodMode,
  onPeriodModeChange,
  onExportPdfReport,
}) => {
  const [internalPeriodMode, setInternalPeriodMode] = useState<'lot' | 'month'>('lot');
  const periodMode = controlledPeriodMode ?? internalPeriodMode;
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const analysis: ExchangeSavingsAnalysis = React.useMemo(() => {
    return calculateExchangeSavingsAnalysis(
      exchangeLots,
      currency,
      fallbackBenchmarkRate
    );
  }, [exchangeLots, currency, fallbackBenchmarkRate]);

  const mask = (v: string) => (privacyMode ? '••••••' : v);

  const handlePeriodChange = (newMode: 'lot' | 'month') => {
    if (newMode !== periodMode) {
      if (onPeriodModeChange) {
        onPeriodModeChange(newMode);
      }
      setIsProcessing(true);
      setActiveTooltipId(null);
      window.setTimeout(() => {
        setInternalPeriodMode(newMode);
        setAnimationKey((prev) => prev + 1);
        setIsProcessing(false);
      }, 220);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(2.0, Math.round((prev + 0.25) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(0.6, Math.round((prev - 0.25) * 100) / 100));
  };

  const handleResetZoom = () => {
    setZoomLevel(1.0);
  };

  // Render skeleton screen while data is loading or being processed
  if (isLoading || isProcessing) {
    return <TripSavingsChartSkeleton />;
  }

  if (analysis.lotCount === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-500 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
              Economia Cambial Realizada vs. Taxa Comercial Média
            </h3>
          </div>

          {/* Right-Aligned Toolbar: Segmented Control Period Selector + Export Button */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 sm:gap-3 ml-auto">
            <div
              role="group"
              aria-label="Seletor de período do câmbio"
              className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/90 p-1 border border-slate-200/80 dark:border-slate-700 gap-1"
            >
              <button
                type="button"
                data-testid="chart-period-lot-btn"
                aria-pressed={periodMode === 'lot'}
                onClick={() => handlePeriodChange('lot')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  periodMode === 'lot'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Por Lote (0)
              </button>
              <button
                type="button"
                data-testid="chart-period-month-btn"
                aria-pressed={periodMode === 'month'}
                onClick={() => handlePeriodChange('month')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  periodMode === 'month'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Por Mês (0)
              </button>
            </div>

            {onExportPdfReport && (
              <button
                type="button"
                onClick={onExportPdfReport}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-2xs"
                title="Exportar Relatório PDF"
              >
                <FileDown className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Exportar Relatório PDF</span>
              </button>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-500">
          Nenhum lote de câmbio registrado ainda. Registre remessas (Wise/Nomad) ou compras em espécie para visualizar o comparativo de economia cambial.
        </div>
      </div>
    );
  }

  // Determine items based on periodMode
  const items = periodMode === 'lot' ? analysis.lotSeries : analysis.monthlySeries;

  // Max absolute savings for bar height scaling
  const maxSavingsAbs = Math.max(
    10,
    ...items.map((it) => Math.abs(it.savingsTotalBrl))
  );

  const baseColWidth = Math.round(76 * zoomLevel);

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-4">
      {/* Top Header & Metrics */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" />
              Economia Cambial por Antecipação de Lotes ({currency})
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                analysis.totalSavingsBrl >= 0
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}
            >
              {analysis.totalSavingsBrl >= 0 ? (
                <>
                  <Sparkles className="h-3 w-3" />
                  Economia Total: {mask(`+${formatBRL(analysis.totalSavingsBrl)}`)} (
                  +{analysis.overallSavingsPercent}%)
                </>
              ) : (
                <>
                  Variação vs Referência:{' '}
                  {mask(formatBRL(Math.abs(analysis.totalSavingsBrl)))}
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Compara a taxa efetiva (VET c/ IOF) de cada compra com a cotação comercial de referência do período ({formatExchangeRateBR(analysis.benchmarkRateUsed)} por 1 {currency})
          </p>
        </div>

        {/* Right-Aligned Toolbar: Segmented Control Period Selector, Export Button & Zoom */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 sm:gap-3 ml-auto">
          {/* Period Selector Segmented Control */}
          <div
            role="group"
            aria-label="Seletor de período do câmbio"
            className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/90 p-1 border border-slate-200/80 dark:border-slate-700 gap-1"
          >
            <button
              type="button"
              data-testid="chart-period-lot-btn"
              aria-pressed={periodMode === 'lot'}
              onClick={() => handlePeriodChange('lot')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                periodMode === 'lot'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Por Lote ({analysis.lotSeries.length})
            </button>
            <button
              type="button"
              data-testid="chart-period-month-btn"
              aria-pressed={periodMode === 'month'}
              onClick={() => handlePeriodChange('month')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                periodMode === 'month'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Por Mês ({analysis.monthlySeries.length})
            </button>
          </div>

          {onExportPdfReport && (
            <button
              type="button"
              onClick={onExportPdfReport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-2xs"
              title="Exportar Relatório PDF"
            >
              <FileDown className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Exportar Relatório PDF</span>
            </button>
          )}

          {/* Zoom Controls */}
          <div className="inline-flex items-center gap-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/60 dark:border-slate-700">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.6}
              title="Diminuir Zoom (-)"
              aria-label="Diminuir Zoom no gráfico"
              className="rounded-lg p-1 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              title="Redefinir Zoom para 100%"
              className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 2.0}
              title="Aumentar Zoom (+)"
              aria-label="Aumentar Zoom no gráfico"
              className="rounded-lg p-1 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Info toggle */}
          <button
            type="button"
            onClick={() => setIsExplanationOpen(!isExplanationOpen)}
            title="O que representa este cálculo de economia?"
            className={`rounded-xl border p-1.5 transition-colors ${
              isExplanationOpen
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-slate-800'
            }`}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Info / Tooltip Explanation Drawer */}
      {isExplanationOpen && (
        <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/40 p-3.5 text-xs text-slate-700 dark:text-slate-300 space-y-1.5 animate-expand-in">
          <p className="font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
            <Info className="h-4 w-4 text-sky-600" />
            Como o cálculo de economia cambial funciona:
          </p>
          <p className="text-[11px] leading-relaxed">
            Ao planejar viagens internacionais, comprar moeda estrangeira aos poucos (preço médio) permite travar cotações em momentos oportunos. O gráfico compara o <strong>VET Efetivo Real</strong> pago em cada remessa (incluindo IOF e taxa da conta global/corretora) com a <strong>taxa comercial média de referência</strong> do período da viagem ({formatExchangeRateBR(analysis.benchmarkRateUsed)}).
          </p>
          <ul className="text-[11px] list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300">
            <li>
              <strong>Barras Verdes:</strong> Você pagou menos que a taxa comercial média, economizando dinheiro real no bolso.
            </li>
            <li>
              <strong>Barras Âmbar/Laranja:</strong> Cotações acima da média (pagamento de prêmio por urgência ou alta do mercado).
            </li>
          </ul>
        </div>
      )}

      {/* Interactive Bar Chart Container with smooth 'fade-in-up' animation */}
      <div
        key={`savings-chart-${periodMode}-${animationKey}`}
        className="animate-fade-in-up relative rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 p-4 overflow-hidden"
      >
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
          <span className="font-semibold">
            {periodMode === 'lot' ? 'Lotes Registrados' : 'Meses de Compra'} •{' '}
            <span className="font-mono">{items.length} períodos</span>
          </span>
          <span className="text-[10px] text-slate-400">
            Passe o mouse ou toque nas barras para ver detalhes da economia
          </span>
        </div>

        {/* Horizontal Scrollable Bar Stage with Zoom scaling */}
        <div className="overflow-x-auto custom-scrollbar pb-3 pt-2">
          <div
            className="flex items-end gap-3 min-h-[190px] pt-4"
            style={{ minWidth: `${items.length * (baseColWidth + 12)}px` }}
          >
            {items.map((item, index) => {
              const isLot = periodMode === 'lot';
              const lotItem = item as LotSavingsItem;
              const monthItem = item as MonthlySavingsItem;

              const id = isLot ? lotItem.id : monthItem.month;
              const label = isLot ? lotItem.label : monthItem.monthLabel;
              const subLabel = isLot
                ? formatShortDateBR(lotItem.date)
                : `${monthItem.lotCount} lote(s)`;
              const foreignAmt = item.foreignAmount;
              const effectiveRate = isLot
                ? lotItem.effectiveRate
                : monthItem.weightedEffectiveRate;
              const savingsBrl = item.savingsTotalBrl;
              const isEconomy = item.isEconomy;
              const savingsPct = item.savingsPercent;
              const isSelected = activeTooltipId === id;

              // Compute normalized height percentage (between 18% and 94%)
              const heightPct = Math.min(
                94,
                Math.max(20, Math.round((Math.abs(savingsBrl) / maxSavingsAbs) * 100))
              );

              return (
                <div
                  key={id}
                  style={{ width: `${baseColWidth}px` }}
                  className="flex flex-col items-center justify-end h-full shrink-0 group relative cursor-pointer"
                  onMouseEnter={() => setActiveTooltipId(id)}
                  onMouseLeave={() => setActiveTooltipId(null)}
                  onClick={() => setActiveTooltipId(isSelected ? null : id)}
                >
                  {/* Floating Interactive Tooltip */}
                  {isSelected && (
                    <div
                      className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-30 w-64 rounded-xl bg-slate-900/95 dark:bg-slate-950 text-white p-3 shadow-xl text-left border border-slate-700 pointer-events-none animate-expand-in"
                      role="tooltip"
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                        <span className="font-bold text-xs text-white">
                          {isLot ? `${lotItem.sourceLabel}` : monthItem.monthLabel}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {isLot ? formatShortDateBR(lotItem.date) : `${monthItem.lotCount} lotes`}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Volume Comprado:</span>
                          <span className="font-mono font-bold">
                            {formatForeignCurrency(foreignAmt, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">VET Efetivo Pago:</span>
                          <span className="font-mono font-bold text-sky-400">
                            {formatExchangeRateBR(effectiveRate)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Taxa Comercial Média:</span>
                          <span className="font-mono font-bold text-slate-300">
                            {formatExchangeRateBR(item.benchmarkRate)}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-800">
                          <span className="text-slate-400">Total Pago:</span>
                          <span className="font-mono">
                            {formatBRL(item.totalBrlPaid)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Custo no Benchmark:</span>
                          <span className="font-mono text-slate-400">
                            {formatBRL(item.benchmarkBrlTotal)}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`mt-2.5 pt-1.5 border-t border-slate-800 rounded-lg p-1.5 text-center text-xs font-bold ${
                          isEconomy
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50'
                            : 'bg-amber-950/80 text-amber-300 border border-amber-700/50'
                        }`}
                      >
                        {isEconomy ? (
                          <>
                            Economia:{' '}
                            <span className="font-mono">
                              +{mask(formatBRL(savingsBrl))}
                            </span>{' '}
                            (+{savingsPct}%)
                          </>
                        ) : (
                          <>
                            Variação:{' '}
                            <span className="font-mono">
                              {mask(formatBRL(savingsBrl))}
                            </span>{' '}
                            ({savingsPct}%)
                          </>
                        )}
                      </div>
                      <p className="mt-1 text-[9px] text-slate-400 leading-tight">
                        Cálculo comparativo baseado na cotação comercial média do período da viagem.
                      </p>
                    </div>
                  )}

                  {/* Top Savings Indicator Tag */}
                  <span
                    className={`text-[10px] font-mono font-bold mb-1 transition-transform ${
                      isSelected ? 'scale-110' : ''
                    } ${
                      isEconomy
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {isEconomy ? `+${mask(formatBRL(savingsBrl))}` : mask(formatBRL(savingsBrl))}
                  </span>

                  {/* Bar Visual Slot */}
                  <div className="w-full bg-slate-200/80 dark:bg-slate-700/60 rounded-t-lg h-32 flex items-end overflow-hidden p-1">
                    <div
                      className={`w-full rounded-md transition-all duration-300 ${
                        isEconomy
                          ? isSelected
                            ? 'bg-emerald-600 shadow-md ring-2 ring-emerald-400'
                            : 'bg-emerald-500 hover:bg-emerald-600'
                          : isSelected
                          ? 'bg-amber-600 shadow-md ring-2 ring-amber-400'
                          : 'bg-amber-500 hover:bg-amber-600'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>

                  {/* Bottom Labels */}
                  <span className="mt-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 break-words sm:truncate max-w-full">
                    {label}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono break-words sm:truncate max-w-full">
                    {formatExchangeRateBR(effectiveRate)}
                  </span>
                  <span className="text-[9px] text-slate-400 break-words sm:truncate max-w-full">
                    {subLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend / Benchmark reference baseline */}
        <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              <span>Economia Positiva (VET &lt; Cotação Comercial Média)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
              <span>Variação Neutra/Alta</span>
            </span>
          </div>

          <div className="font-mono text-[11px]">
            Taxa Média de Referência:{' '}
            <strong className="text-slate-900 dark:text-white">
              {formatExchangeRateBR(analysis.benchmarkRateUsed)}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};
