/** Simulador de renda fixa. Parte de GoalsAndSimulatorTab (ver GoalsAndSimulatorTab.tsx). */
import { Calculator } from 'lucide-react';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { formatBRL } from '../../../domain/finance/financeRules';
import type { GoalsAndSimulatorTabContext } from './goalsTabContext';

export function FixedIncomeSimulator({ form }: { form: GoalsAndSimulatorTabContext }) {
  const {
    setSimCdiAnnual,
    setSimCdiMultiplier,
    setSimInitialStr,
    setSimIsExempt,
    setSimMonthlyStr,
    setSimMonths,
    simCdiAnnual,
    simCdiMultiplier,
    simInitialStr,
    simIsExempt,
    simMonthlyStr,
    simMonths,
    simulation,
  } = form;
  return (
    <>
{/* Simulador de Renda Fixa Brasileira (Selic / CDI / LCI vs Poupança) */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <Calculator className="h-5 w-5 text-slate-700" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Simulador de Renda Fixa Brasileira (CDI / Tesouro Selic / LCI vs. Poupança)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cálculo automático com alíquota regressiva de Imposto de Renda (22,5% a 15%)
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sim-initial" className="block text-xs font-semibold text-slate-700 mb-1">
                Valor Inicial (R$)
              </label>
              <CurrencyInput
                id="sim-initial"
                value={simInitialStr}
                currency="BRL"
                onValueChange={setSimInitialStr}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="sim-monthly" className="block text-xs font-semibold text-slate-700 mb-1">
                Aporte Mensal (R$)
              </label>
              <CurrencyInput
                id="sim-monthly"
                value={simMonthlyStr}
                currency="BRL"
                onValueChange={setSimMonthlyStr}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="sim-months" className="block text-xs font-semibold text-slate-700 mb-1">
                Prazo de Aplicação (Meses)
              </label>
              <select
                id="sim-months"
                value={simMonths}
                onChange={(e) => setSimMonths(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900"
              >
                <option value={3}>3 meses (Curto Prazo — IR 22,5%)</option>
                <option value={6}>6 meses (IR 22,5%)</option>
                <option value={12}>12 meses / 1 ano (IR 20,0%)</option>
                <option value={24}>24 meses / 2 anos (IR 17,5%)</option>
                <option value={36}>36 meses / 3 anos (IR 15,0%)</option>
                <option value={60}>60 meses / 5 anos (IR 15,0%)</option>
              </select>
            </div>

            <div>
              <label htmlFor="sim-cdi-rate" className="block text-xs font-semibold text-slate-700 mb-1">
                Taxa CDI / Selic Anual (% a.a.)
              </label>
              <input
                id="sim-cdi-rate"
                type="text"
                value={simCdiAnnual}
                onChange={(e) => setSimCdiAnnual(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="sim-cdi-mult" className="block text-xs font-semibold text-slate-700 mb-1">
                Rentabilidade (% do CDI)
              </label>
              <input
                id="sim-cdi-mult"
                type="text"
                value={simCdiMultiplier}
                onChange={(e) => setSimCdiMultiplier(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simIsExempt}
                  onChange={(e) => setSimIsExempt(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                />
                <span>Isento de IR (LCI / LCA / CRI / CRA)</span>
              </label>
            </div>
          </div>

          <div className="lg:col-span-6 lg:border-l lg:border-slate-200 lg:pl-8 space-y-4">
            <div className="flex items-baseline justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Saldo Líquido Estimado (Já descontado IR)
                </p>
                <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                  {formatBRL(simulation.netBalanceCdi)}
                </p>
              </div>
              <div className="text-right font-mono tabular-nums">
                <p className="text-xs text-slate-500">Alíquota IR Aplicada</p>
                <p className="text-sm font-bold text-slate-800">
                  {simulation.irRatePercent}% ({formatBRL(simulation.irTaxAmount)})
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono tabular-nums">
              <div>
                <p className="font-sans text-slate-500">Total Desembolsado</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">
                  {formatBRL(simulation.totalInvested)}
                </p>
              </div>
              <div>
                <p className="font-sans text-slate-500">Juros Líquidos Ganhos</p>
                <p className="font-bold text-emerald-700 text-sm mt-0.5">
                  +{formatBRL(simulation.netYieldCdi)}
                </p>
              </div>
              <div>
                <p className="font-sans text-slate-500">Na Poupança Renderia</p>
                <p className="font-bold text-slate-700 text-sm mt-0.5">
                  {formatBRL(simulation.poupancaBalance)}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">
                Vantagem real sobre a Caderneta de Poupança no período:
              </span>
              <span className="font-mono tabular-nums font-bold text-emerald-700">
                +{formatBRL(simulation.advantageOverPoupanca)} a mais no bolso
              </span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
