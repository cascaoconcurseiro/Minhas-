/** Lista de posições no celular. Parte de InvestmentsTab (ver InvestmentsTab.tsx). */
import { INVESTMENT_CLASS_META, isMarketQuotedAsset } from '../../../domain/investments/investmentRules';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import { formatBRL } from '../../../domain/finance/financeRules';
import { RefreshCw } from 'lucide-react';
import type { InvestmentsTabContext } from './investmentsTabContext';

export function InvestmentPositionsMobileList({ form }: { form: InvestmentsTabContext }) {
  const {
    filteredPositions,
    handleSyncPortfolioWithGoogleFinance,
    isSyncingGoogleFinance,
    openEditAssetForm,
    openOperationModal,
  } = form;
  return (
    <>
{/* Mobile Cards (< sm) */}
        <div className="block sm:hidden divide-y divide-slate-100">
          {filteredPositions.map((pos) => {
            const { asset } = pos;
            const meta = INVESTMENT_CLASS_META[asset.assetClass];
            return (
              <div key={asset.id} className="p-4 space-y-2.5 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="text-xs font-extrabold font-mono text-slate-900">
                        {asset.ticker}
                      </span>
                      {asset.isTaxExempt && (
                        <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                          Isento IR
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-700 mt-0.5">
                      {asset.name}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <InstitutionMark institution={asset.institution} size="xs" />
                      {asset.institution} · {asset.indexerLabel}
                    </p>
                  </div>

                  <div className="text-right shrink-0 font-mono tabular-nums">
                    <p className="text-sm font-extrabold text-slate-900">
                      {formatBRL(pos.currentValue)}
                    </p>
                    <p
                      className={`text-[11px] font-bold ${
                        pos.capitalGain >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {pos.capitalGain >= 0 ? '+' : ''}
                      {formatBRL(pos.capitalGain)} ({pos.profitabilityPercent}%)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2 text-[11px] font-mono tabular-nums">
                  <div>
                    <span className="text-slate-400 block">Qtd / PM</span>
                    <span className="text-slate-800 font-semibold">
                      {asset.quantity} × {formatBRL(asset.averagePrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Cotação</span>
                    <span className="text-slate-800 font-semibold">
                      {formatBRL(asset.currentPrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Renda/Mês</span>
                    <span className="text-emerald-700 font-bold">
                      +{formatBRL(pos.estimatedMonthlyIncome)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5 [&>button]:whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openOperationModal(asset, 'buy')}
                      className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-xs font-semibold sm:px-2.5 sm:py-1 sm:text-[11px] text-emerald-800"
                    >
                      + Aportar
                    </button>
                    <button
                      type="button"
                      onClick={() => openOperationModal(asset, 'sell')}
                      className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold sm:px-2.5 sm:py-1 sm:text-[11px] text-slate-700"
                    >
                      Resgatar
                    </button>
                    <button
                      type="button"
                      onClick={() => openOperationModal(asset, 'dividend')}
                      className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold sm:px-2.5 sm:py-1 sm:text-[11px] text-amber-900"
                    >
                      + Dividendo
                    </button>
                    {isMarketQuotedAsset(asset) && (
                      <button
                        type="button"
                        onClick={() => handleSyncPortfolioWithGoogleFinance([asset])}
                        disabled={isSyncingGoogleFinance}
                        className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs font-semibold sm:px-2.5 sm:py-1 sm:text-[11px] text-sky-900 disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${
                            isSyncingGoogleFinance ? 'animate-spin' : ''
                          }`}
                        />
                        <span>Cotação</span>
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditAssetForm(asset)}
                    className="text-[11px] font-medium text-slate-500 underline"
                  >
                    Editar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
    </>
  );
}
