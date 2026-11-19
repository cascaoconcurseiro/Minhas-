/** Subtela Carteira de câmbio: lotes e taxa média ponderada. Parte de TripsTab (ver TripsTab.tsx). */
import { Plus, Trash2 } from 'lucide-react';
import { SmartCurrencyConverterCard } from '../SmartCurrencyConverterCard';
import { TripSavingsChart } from '../TripSavingsChart';
import { formatExchangeRateBR, formatForeignCurrency } from '../../../domain/trips/travelRules';
import { formatBRL, formatShortDateBR } from '../../../domain/finance/financeRules';
import type { TripPageContext } from './tripsTabContext';

export function TripFxWalletView({ form }: { form: TripPageContext }) {
  const {
    activeSubView,
    activeTrip,
    chartPeriodMode,
    getAuthToken,
    handleExportPdfReport,
    handleOpenLotModal,
    isChartLoading,
    onDeleteExchangeLot,
    onOpenNewTripExpense,
    privacyMode,
    setChartPeriodMode,
    summary,
  } = form;
  return (
    <>
{/* SUB-VIEW 3: FX WALLET & WEIGHTED AVERAGE RATE LOTS */}
      {activeSubView === 'fx_wallet' && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                Bolsos de Câmbio & Preço Médio Ponderado ({activeTrip.currency})
              </h3>
              <p className="text-xs text-slate-500">
                Cadastre suas remessas Wise, Nomad ou compras em espécie para o app calcular automaticamente seu Câmbio Médio Real (VET)
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenLotModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors self-start"
            >
              <Plus className="h-3.5 w-3.5" />
              Registrar Compra de {activeTrip.currency}
            </button>
          </div>

          {/* Smart Currency Converter Utility in FX Wallet */}
          <SmartCurrencyConverterCard
            exchangeLots={activeTrip.exchangeLots}
            getAuthToken={getAuthToken}
            currency={activeTrip.currency}
            defaultExchangeRate={activeTrip.defaultExchangeRate}
            remainingForeignBalance={summary.remainingForeignWalletBalance}
            privacyMode={privacyMode}
            onUseConvertedValue={() => onOpenNewTripExpense(activeTrip.id)}
          />

          {/* Exchange Savings Bar Chart in FX Wallet */}
          <TripSavingsChart
            exchangeLots={activeTrip.exchangeLots}
            currency={activeTrip.currency}
            fallbackBenchmarkRate={activeTrip.defaultExchangeRate}
            privacyMode={privacyMode}
            isLoading={isChartLoading}
            periodMode={chartPeriodMode}
            onPeriodModeChange={setChartPeriodMode}
            onExportPdfReport={handleExportPdfReport}
          />

          {activeTrip.exchangeLots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center">
              <p className="text-xs text-slate-500">
                Nenhum lote de câmbio registrado. O sistema está usando a cotação referência padrão ({formatExchangeRateBR(activeTrip.defaultExchangeRate)}).
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeTrip.exchangeLots.map((lot) => (
                <div
                  key={lot.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {lot.sourceLabel}
                      </span>
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                        {formatShortDateBR(lot.date)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Cotação Base: {formatExchangeRateBR(lot.rateBase)} + IOF{' '}
                      {lot.iofPercent}% →{' '}
                      <strong className="text-emerald-700 dark:text-emerald-400 font-mono">
                        VET {formatExchangeRateBR(lot.effectiveRateBrl)}
                      </strong>
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="text-right font-mono">
                      <span className="block text-sm font-extrabold text-slate-900 dark:text-white">
                        +{formatForeignCurrency(lot.foreignAmount, lot.currency)}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        Custo: {formatBRL(lot.totalBrlPaid)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteExchangeLot(activeTrip.id, lot.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Remover lote de câmbio"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
