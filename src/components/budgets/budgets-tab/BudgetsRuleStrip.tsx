/** Diagnóstico 50/30/20 e ritmo do mês. Parte de BudgetsTab (ver BudgetsTab.tsx). */
import { formatBRL } from '../../../domain/finance/financeRules';
import type { BudgetsTabContext } from './budgetsTabContext';

export function BudgetsRuleStrip({ form }: { form: BudgetsTabContext }) {
  const {
    rule503020,
    totalBudgeted,
    totalSpent,
  } = form;
  return (
    <>
<section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Diagnóstico da Regra 50-30-20 no Mês
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Divisão recomendada da renda líquida mensal ({formatBRL(rule503020.incomeBase)}) entre gastos essenciais, estilo de vida e futuro
                </p>
              </div>
              <div className="text-left sm:text-right font-mono tabular-nums text-xs text-slate-600">
                <span className="block sm:inline">
                  Orçamento Total Planejado: <strong>{formatBRL(totalBudgeted)}</strong>
                </span>
                <span aria-hidden="true" className="hidden sm:inline"> · </span>
                <span className="block sm:inline">
                  Realizado + Previsto: <strong>{formatBRL(totalSpent)}</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 pt-2">
              <div className="pb-4 md:pb-0 md:pr-6 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">
                    01. Necessidades Essenciais (Meta 50%)
                  </span>
                  <span
                    className={`font-mono tabular-nums font-bold ${
                      rule503020.essentialPercent <= 55 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {rule503020.essentialPercent}% da renda
                  </span>
                </div>
                <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
                  {formatBRL(rule503020.essentialSpent)}
                  <span className="text-xs font-normal text-slate-500">
                    {' '}
                    / ideal até {formatBRL(rule503020.essentialTarget)}
                  </span>
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      rule503020.essentialPercent <= 50 ? 'bg-emerald-600' : 'bg-amber-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (rule503020.essentialPercent / 50) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Moradia, condomínio, mercado, saúde, transporte e luz/internet.
                </p>
              </div>

              <div className="py-4 md:py-0 md:px-6 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">
                    02. Estilo de Vida & Lazer (Meta 30%)
                  </span>
                  <span
                    className={`font-mono tabular-nums font-bold ${
                      rule503020.lifestylePercent <= 30 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {rule503020.lifestylePercent}% da renda
                  </span>
                </div>
                <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
                  {formatBRL(rule503020.lifestyleSpent)}
                  <span className="text-xs font-normal text-slate-500">
                    {' '}
                    / ideal até {formatBRL(rule503020.lifestyleTarget)}
                  </span>
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      rule503020.lifestylePercent <= 30 ? 'bg-slate-800' : 'bg-rose-600'
                    }`}
                    style={{
                      width: `${Math.min(100, (rule503020.lifestylePercent / 30) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Restaurantes, iFood, viagens, compras parceladas e streaming.
                </p>
              </div>

              <div className="pt-4 md:pt-0 md:pl-6 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">
                    03. Poupança & Futuro (Meta ≥ 20%)
                  </span>
                  <span
                    className={`font-mono tabular-nums font-bold ${
                      rule503020.financialPercent >= 20 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {rule503020.financialPercent}% da renda
                  </span>
                </div>
                <p className="text-lg font-bold font-mono tabular-nums text-emerald-700">
                  {formatBRL(rule503020.financialSavings)}
                  <span className="text-xs font-normal text-slate-500">
                    {' '}
                    / meta mínima {formatBRL(rule503020.financialTarget)}
                  </span>
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{
                      width: `${Math.min(100, (rule503020.financialPercent / 20) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Aportes diretos em metas mais saldo livre poupado no mês.
                </p>
              </div>
            </div>
          </section>
    </>
  );
}
