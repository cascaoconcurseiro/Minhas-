/** Formulário de cadastro e edição do ativo. Parte de InvestmentsTab (ver InvestmentsTab.tsx). */
import { Loader2, RefreshCw, X } from 'lucide-react';
import { InvestmentAssetClass, InvestmentLiquidity } from '../../../types/finance';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import { CurrencyInput } from '../../ui/CurrencyInput';
import type { InvestmentsTabContext } from './investmentsTabContext';

export function InvestmentAssetForm({ form }: { form: InvestmentsTabContext }) {
  const {
    assetClass,
    avgPriceStr,
    currPriceStr,
    editingAsset,
    formError,
    handleLookupSingleTickerOnGoogleFinance,
    handleSaveAssetForm,
    indexerLabel,
    institution,
    isLookingUpTicker,
    isTaxExempt,
    liquidity,
    name,
    quantityStr,
    setAssetClass,
    setAvgPriceStr,
    setCurrPriceStr,
    setIndexerLabel,
    setInstitution,
    setIsTaxExempt,
    setLiquidity,
    setName,
    setQuantityStr,
    setShowAssetForm,
    setTicker,
    setYieldStr,
    showAssetForm,
    ticker,
    yieldStr,
  } = form;
  return (
    <>
{/* Add / Edit Asset Form */}
        {showAssetForm && (
          <form
            onSubmit={handleSaveAssetForm}
            className="border-b border-slate-200 bg-slate-50 p-4 sm:p-6 space-y-4 animate-expand-in"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingAsset
                  ? `Editar Ativo — ${editingAsset.ticker}`
                  : 'Cadastrar Novo Ativo na Carteira'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAssetForm(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label htmlFor="investment-form-ticker" className="block text-xs font-semibold text-slate-700 mb-1">
                  Código / Ticker (B3 / Global)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    id="investment-form-ticker"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    placeholder="Ex: PETR4, HGLG11, IVVB11"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono uppercase text-slate-900"
                  />
                  <button
                    type="button"
                    data-testid="lookup-ticker-google-finance-btn"
                    onClick={handleLookupSingleTickerOnGoogleFinance}
                    disabled={isLookingUpTicker}
                    title="Buscar cotação atual e nome do ativo no Google Finance"
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-2 text-[11px] font-bold text-sky-900 hover:bg-sky-100 transition-colors shrink-0 disabled:opacity-60"
                  >
                    {isLookingUpTicker ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-700" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 text-sky-700" />
                    )}
                    <span>Cotação</span>
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="investment-form-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Descritivo do Ativo
                </label>
                <input
                  type="text"
                  id="investment-form-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: CSHG Logística FII / Tesouro Selic"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="investment-form-class" className="block text-xs font-semibold text-slate-700 mb-1">
                  Classe do Ativo
                </label>
                <select
                  id="investment-form-class"
                  value={assetClass}
                  onChange={(e) =>
                    setAssetClass(e.target.value as InvestmentAssetClass)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  <option value="renda_fixa_pos">Renda Fixa Pós (Selic / CDI)</option>
                  <option value="renda_fixa_ipca">Renda Fixa Inflação (IPCA+)</option>
                  <option value="fiis">Fundos Imobiliários (FIIs)</option>
                  <option value="acoes_br">Ações Brasil (B3)</option>
                  <option value="exterior_etf">Exterior & ETFs</option>
                </select>
              </div>

              <div>
                <label htmlFor="investment-form-institution" className="block text-xs font-semibold text-slate-700 mb-1">
                  Instituição / Corretora
                </label>
                <div className="flex min-w-0 items-center gap-2">
                  <InstitutionMark institution={institution} size="sm" />
                  <input
                    type="text"
                    id="investment-form-institution"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Ex: XP, BTG, Itaú, NuInvest"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="investment-form-quantity" className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantidade de Cotas / Títulos
                </label>
                <input
                  type="text"
                  id="investment-form-quantity"
                  value={quantityStr}
                  onChange={(e) => setQuantityStr(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="investment-form-average-price" className="block text-xs font-semibold text-slate-700 mb-1">
                  Preço Médio de Compra (R$)
                </label>
                <CurrencyInput
                  id="investment-form-average-price"
                  value={avgPriceStr}
                  currency="BRL"
                  onValueChange={setAvgPriceStr}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="investment-form-current-price" className="block text-xs font-semibold text-slate-700 mb-1">
                  Cotação / Valor Unitário Atual (R$)
                </label>
                <CurrencyInput
                  id="investment-form-current-price"
                  value={currPriceStr}
                  currency="BRL"
                  onValueChange={setCurrPriceStr}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="investment-form-yield" className="block text-xs font-semibold text-slate-700 mb-1">
                  Rendimento / Dividend Yield Mensal (%)
                </label>
                <input
                  type="text"
                  id="investment-form-yield"
                  value={yieldStr}
                  onChange={(e) => setYieldStr(e.target.value)}
                  placeholder="Ex: 0,85"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-center">
              <div>
                <label htmlFor="investment-form-indexer" className="block text-xs font-semibold text-slate-700 mb-1">
                  Indexador / Rentabilidade Contratada
                </label>
                <input
                  type="text"
                  id="investment-form-indexer"
                  value={indexerLabel}
                  onChange={(e) => setIndexerLabel(e.target.value)}
                  placeholder="Ex: 102% CDI, IPCA + 6,4%, DY 10% a.a."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="investment-form-liquidity" className="block text-xs font-semibold text-slate-700 mb-1">
                  Prazo de Liquidez (Resgate)
                </label>
                <select
                  id="investment-form-liquidity"
                  value={liquidity}
                  onChange={(e) =>
                    setLiquidity(e.target.value as InvestmentLiquidity)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  <option value="D+0 (Liquidez Diária)">D+0 (Liquidez Diária)</option>
                  <option value="D+1">D+1</option>
                  <option value="D+2 (Bolsa B3)">D+2 (Bolsa B3)</option>
                  <option value="No Vencimento">Somente no Vencimento</option>
                </select>
              </div>

              <div className="pt-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isTaxExempt}
                    onChange={(e) => setIsTaxExempt(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                  />
                  <span>Ativo Isento de Imposto de Renda (LCI/LCA/FII)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowAssetForm(false)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                {editingAsset ? 'Salvar Ativo' : 'Adicionar à Carteira'}
              </button>
            </div>
          </form>
        )}
    </>
  );
}
