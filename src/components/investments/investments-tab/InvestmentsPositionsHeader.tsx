/** Cabeçalho das posições: busca, filtros, cotações e novo ativo. Parte de InvestmentsTab (ver InvestmentsTab.tsx). */
import { CheckCircle2, ExternalLink, Loader2, Plus, RefreshCw, Search, TrendingUp } from 'lucide-react';
import type { InvestmentsTabContext } from './investmentsTabContext';

export function InvestmentsPositionsHeader({ form }: { form: InvestmentsTabContext }) {
  const {
    assets,
    autoSyncEnabled,
    classFilter,
    googleFinanceError,
    googleFinanceMessage,
    googleFinanceSources,
    handleSyncPortfolioWithGoogleFinance,
    isSyncingGoogleFinance,
    marketQuotedAssets,
    openNewAssetForm,
    searchQuery,
    setAutoSyncEnabled,
    setClassFilter,
    setSearchQuery,
  } = form;
  return (
    <>
<div className="border-b border-slate-200 bg-slate-50/70 px-4 sm:px-6 py-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Posições Detalhadas da Carteira ({assets.length} ativos)
                </h2>
                <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                  <TrendingUp className="h-3 w-3 text-sky-600" />
                  Google Finance Sync
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Sincronize automaticamente ações da B3, FIIs e ETFs com o Google Finance em tempo real
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setAutoSyncEnabled(next);
                    try {
                      localStorage.setItem(
                        'minhas_economias_gfinance_autosync',
                        next ? '1' : '0'
                      );
                    } catch {
                      // Ignore
                    }
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600"
                />
                <span>Auto-sync Google Finance</span>
              </label>

              <button
                type="button"
                data-testid="sync-google-finance-btn"
                onClick={() => handleSyncPortfolioWithGoogleFinance(marketQuotedAssets)}
                disabled={isSyncingGoogleFinance}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100 transition-colors disabled:opacity-60 max-sm:min-h-10"
              >
                {isSyncingGoogleFinance ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-700" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 text-sky-700" />
                )}
                <span>
                  {isSyncingGoogleFinance
                    ? 'Atualizando Cotações...'
                    : 'Atualizar Cotações'}
                </span>
              </button>

              <button
                type="button"
                data-testid="open-new-investment-btn"
                onClick={openNewAssetForm}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-2xs"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Ativo / Aplicação</span>
              </button>
            </div>
          </div>

          {googleFinanceMessage && (
            <div
              data-testid="google-finance-sync-banner"
              className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-3.5 py-2.5 text-xs text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <span className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                {googleFinanceMessage}
              </span>
              {googleFinanceSources.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {googleFinanceSources.slice(0, 2).map((src, idx) => (
                    <a
                      key={`${src.uri}-${idx}`}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-medium text-emerald-800 hover:underline max-w-[180px] break-words sm:truncate"
                    >
                      <span className="break-words sm:truncate">{src.title}</span>
                      <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {googleFinanceError && (
            <div role="alert" data-testid="google-finance-error" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-800">
              {googleFinanceError}
            </div>
          )}

          {/* Filter & Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex overflow-x-auto no-scrollbar items-center gap-1 rounded-lg bg-slate-200/70 p-1 max-w-full">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'renda_fixa_pos', label: 'RF Pós (Selic/CDI)' },
                { id: 'renda_fixa_ipca', label: 'RF IPCA+' },
                { id: 'fiis', label: 'FIIs' },
                { id: 'acoes_br', label: 'Ações B3' },
                { id: 'exterior_etf', label: 'Exterior' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setClassFilter(tab.id as any)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    classFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="pointer-events-none absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Buscar ativo por ticker, corretora ou indexador"
                placeholder="Buscar ticker, corretora ou indexador..."
                className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>
        </div>
    </>
  );
}
