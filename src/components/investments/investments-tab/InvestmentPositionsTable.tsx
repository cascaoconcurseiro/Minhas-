/** Tabela de posições no computador. Parte de InvestmentsTab (ver InvestmentsTab.tsx). */
import { INVESTMENT_CLASS_META, isMarketQuotedAsset } from '../../../domain/investments/investmentRules';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import { formatBRL } from '../../../domain/finance/financeRules';
import { Edit3, RefreshCw, Trash2 } from 'lucide-react';
import type { InvestmentsTabContext } from './investmentsTabContext';

export function InvestmentPositionsTable({ form }: { form: InvestmentsTabContext }) {
  const {
    filteredPositions,
    handleSyncPortfolioWithGoogleFinance,
    isSyncingGoogleFinance,
    onDeleteAsset,
    openEditAssetForm,
    openOperationModal,
  } = form;
  return (
    <>
{/* Desktop Table (>= sm) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-500">
                <th className="py-3 pl-6 pr-3">Ativo & Indexador</th>
                <th className="py-3 px-3 whitespace-nowrap">Classe & Liquidez</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Qtd · Preço Médio</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Cotação Atual</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Saldo Bruto</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Rentabilidade</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Renda Passiva/Mês</th>
                <th className="py-3 pl-3 pr-6 text-right whitespace-nowrap">Operações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredPositions.map((pos) => {
                const { asset } = pos;
                const meta = INVESTMENT_CLASS_META[asset.assetClass];

                return (
                  <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 pl-6 pr-3">
                      <div className="flex items-start gap-2.5">
                        <span
                          className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">
                              {asset.ticker}
                            </span>
                            {asset.isTaxExempt && (
                              <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                Isento IR
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-700">{asset.name}</p>
                          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                            <InstitutionMark institution={asset.institution} size="xs" />
                            {asset.institution} · {asset.indexerLabel}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-xs whitespace-nowrap">
                      <p className="font-semibold text-slate-800">{meta.shortLabel}</p>
                      <p className="text-[11px] text-slate-500">{asset.liquidity}</p>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                      <div>
                        <strong>{asset.quantity}</strong> un.
                      </div>
                      <div className="text-[11px] text-slate-500">
                        PM: {formatBRL(asset.averagePrice)}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs font-semibold text-slate-900 whitespace-nowrap">
                      <div className="flex flex-col items-end gap-0.5">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openOperationModal(asset, 'update_quote')}
                            title="Clique para editar cotação manualmente"
                            className="hover:underline inline-flex items-center gap-1"
                          >
                            <span>{formatBRL(asset.currentPrice)}</span>
                          </button>
                          {isMarketQuotedAsset(asset) && (
                            <button
                              type="button"
                              onClick={() => handleSyncPortfolioWithGoogleFinance([asset])}
                              disabled={isSyncingGoogleFinance}
                              title={`Sincronizar ${asset.ticker} com o Google Finance`}
                              className="rounded p-1 text-sky-600 hover:bg-sky-50 transition-colors"
                            >
                              <RefreshCw
                                className={`h-3 w-3 ${
                                  isSyncingGoogleFinance ? 'animate-spin' : ''
                                }`}
                              />
                            </button>
                          )}
                        </div>
                        {typeof asset.dailyChangePercent === 'number' && (
                          <span
                            className={`text-[10px] font-bold ${
                              asset.dailyChangePercent >= 0
                                ? 'text-emerald-600'
                                : 'text-rose-600'
                            }`}
                          >
                            Hoje: {asset.dailyChangePercent >= 0 ? '+' : ''}
                            {asset.dailyChangePercent}%
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="font-bold text-slate-900">
                        {formatBRL(pos.currentValue)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {pos.portfolioSharePercent}% da carteira
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div
                        className={`font-bold text-xs ${
                          pos.capitalGain >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {pos.capitalGain >= 0 ? '+' : ''}
                        {formatBRL(pos.capitalGain)}
                      </div>
                      <div
                        className={`text-[11px] font-semibold ${
                          pos.profitabilityPercent >= 0
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {pos.profitabilityPercent >= 0 ? '+' : ''}
                        {pos.profitabilityPercent}%
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="font-bold text-emerald-700 text-xs">
                        +{formatBRL(pos.estimatedMonthlyIncome)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {asset.monthlyYieldPercent}% a.m.
                      </div>
                    </td>

                    <td className="py-3.5 pl-3 pr-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openOperationModal(asset, 'buy')}
                          title="Registrar novo aporte / compra"
                          className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          + Aportar
                        </button>
                        <button
                          type="button"
                          onClick={() => openOperationModal(asset, 'sell')}
                          title="Registrar resgate / venda"
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Resgatar
                        </button>
                        <button
                          type="button"
                          onClick={() => openOperationModal(asset, 'dividend')}
                          title="Lançar dividendo/provento recebido na conta corrente"
                          className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          $ Provento
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditAssetForm(asset)}
                          aria-label={`Editar ${asset.ticker}`}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteAsset(asset.id)}
                          aria-label={`Excluir ${asset.ticker}`}
                          className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
    </>
  );
}
