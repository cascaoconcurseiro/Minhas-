/** Alocação por classe, metas e recomendações de aporte. Parte de InvestmentsTab (ver InvestmentsTab.tsx). */
import { PieChart, ShieldCheck, Sliders, Sparkles } from 'lucide-react';
import { formatBRL } from '../../../domain/finance/financeRules';
import { CurrencyInput } from '../../ui/CurrencyInput';
import type { InvestmentsTabContext } from './investmentsTabContext';

export function InvestmentsAllocationRow({ form }: { form: InvestmentsTabContext }) {
  const {
    contributionAmount,
    contributionDraftStr,
    handleSaveTargets,
    localTargets,
    setContributionDraftStr,
    setLocalTargets,
    setShowTargetEditor,
    showTargetEditor,
    smartRecommendations,
    summary,
    targetMap,
  } = form;
  return (
    <>
{/* Row 2: Asset Allocation Map + Smart Contribution Rebalancer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: Asset Class Allocation vs Target */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-emerald-600" />
                  <span>Alocação Estratégica por Classe de Ativo</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Diversificação entre Renda Fixa Selic/CDI, Inflação IPCA+, FIIs, Ações B3 e Exterior
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setLocalTargets(targetMap);
                  setShowTargetEditor((prev) => !prev);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors max-sm:min-h-10"
              >
                <Sliders className="h-3.5 w-3.5 text-slate-500" />
                <span>{showTargetEditor ? 'Fechar Metas' : 'Definir % Ideal'}</span>
              </button>
            </div>

            {/* Stacked Portfolio Allocation Bar */}
            <div className="h-3.5 w-full rounded-full bg-slate-100 overflow-hidden flex border border-slate-200/70">
              {summary.classAllocations.map((cls) => (
                <div
                  key={cls.assetClass}
                  style={{
                    width: `${cls.currentPercent}%`,
                    backgroundColor: cls.color,
                  }}
                  title={`${cls.shortLabel}: ${cls.currentPercent}% (${formatBRL(
                    cls.currentValue
                  )})`}
                  className="h-full transition-all duration-300"
                />
              ))}
            </div>

            {/* Optional Target Allocation Editor */}
            {showTargetEditor && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 animate-expand-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Ajustar Percentual Ideal de Cada Classe (Soma recomendada: 100%)
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveTargets}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Salvar Metas
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {summary.classAllocations.map((cls) => (
                    <div key={cls.assetClass}>
                      <label className="block text-[11px] font-semibold text-slate-600 break-words sm:truncate mb-1">
                        {cls.shortLabel} (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={localTargets[cls.assetClass]}
                        onChange={(e) =>
                          setLocalTargets((prev) => ({
                            ...prev,
                            [cls.assetClass]: Number(e.target.value) || 0,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Class Breakdown Rows */}
            <div className="divide-y divide-slate-100">
              {summary.classAllocations.map((cls) => {
                const isUnderTarget = cls.deviationPercent < -2;
                return (
                  <div
                    key={cls.assetClass}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: cls.color }}
                        />
                        <span className="text-xs sm:text-sm font-bold text-slate-900 break-words sm:truncate">
                          {cls.label}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          ({cls.assetsCount})
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-slate-600">
                        <span>
                          Saldo: <strong className="text-slate-900">{formatBRL(cls.currentValue)}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Atual: <strong>{cls.currentPercent}%</strong> / Meta:{' '}
                          <strong>{cls.targetPercent}%</strong>
                        </span>
                        {isUnderTarget && (
                          <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-sans font-semibold text-amber-800">
                            Faltam {formatBRL(cls.missingAmountToTarget)} p/ meta
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right font-mono tabular-nums shrink-0">
                      <span
                        className={`text-xs font-bold ${
                          cls.capitalGain >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {cls.capitalGain >= 0 ? '+' : ''}
                        {formatBRL(cls.capitalGain)} ({cls.profitabilityPercent}%)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Renda: +{formatBRL(cls.estimatedMonthlyIncome)}/mês
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Patrimônio Isento de IR (LCI/LCA, FIIs e Ações):{' '}
              <strong className="text-slate-800 font-mono">
                {formatBRL(summary.taxExemptValue)} ({summary.taxExemptPercent}%)
              </strong>
            </span>
          </div>
        </section>

        {/* Right 5 Cols: Smart Contribution Rebalancer (Onde aportar este mês sem vender) */}
        <section
          data-testid="smart-rebalancer-panel"
          className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span>Simulador de Próximo Aporte</span>
                </h2>
                <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Rebalancear Sem Vender
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Informe quanto você vai investir neste mês. O sistema direciona o aporte para as classes abaixo da meta, evitando vendas e pagamento de IR.
              </p>
            </div>

            <div>
              <label
                htmlFor="smart-contribution-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Valor do Novo Aporte Mensal (R$)
              </label>
              <div className="flex items-center gap-2">
                <CurrencyInput
                  id="smart-contribution-input"
                  value={contributionDraftStr}
                  currency="BRL"
                  onValueChange={setContributionDraftStr}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base font-bold font-mono tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
                {[1000, 2500, 5000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      setContributionDraftStr(preset.toFixed(2).replace('.', ','))
                    }
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-mono font-semibold text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 transition-colors shrink-0"
                  >
                    {preset / 1000}k
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <p className="text-xs font-bold text-slate-700">
                Distribuição Recomendada para {formatBRL(contributionAmount)}:
              </p>
              {smartRecommendations.map((rec) => (
                <div
                  key={rec.assetClass}
                  className={`rounded-xl border p-3 transition-colors ${
                    rec.recommendedAmount > 0
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-slate-200/70 bg-slate-50/50 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: rec.color }}
                      />
                      {rec.shortLabel}
                    </span>
                    <span className="font-mono tabular-nums font-extrabold text-emerald-800">
                      {rec.recommendedAmount > 0
                        ? `Aportar ${formatBRL(rec.recommendedAmount)}`
                        : 'Já acima da meta (R$ 0,00)'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500">
                    <span>
                      Antes: {rec.currentPercent}% → Após: {rec.projectedPercentAfter}%
                    </span>
                    <span>Meta: {rec.targetPercent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-slate-100/80 p-3 text-[11px] text-slate-600">
            Dica B3 & IR: Rebalancear comprando os ativos descontados mantém sua carteira alinhada sem gerar DARF de ganho de capital.
          </div>
        </section>
      </div>
    </>
  );
}
