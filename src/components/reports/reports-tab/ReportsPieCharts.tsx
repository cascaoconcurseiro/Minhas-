/** Despesas por categoria e receitas por origem. Parte de ReportsAndDataTab (ver ReportsAndDataTab.tsx). */
import { PieChart as PieChartIcon } from 'lucide-react';
import { SvgPieDonutChart } from './reportsTabConfig';
import { CategoryIconBadge } from '../../ui/CategoryIconBadge';
import { formatBRL } from '../../../domain/finance/financeRules';
import type { ReportsAndDataTabContext } from './reportsTabContext';

export function ReportsPieCharts({ form }: { form: ReportsAndDataTabContext }) {
  const {
    periodReport,
  } = form;
  return (
    <>
{/* Visual Pie Charts Row: Expenses by Category & Incomes by Source */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Pie Chart 1: Expenses by Category */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-rose-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Gráfico de Pizza — Gastos por Categoria
                </h3>
                <p className="text-xs text-slate-500">
                  Participação de cada categoria nas despesas do período
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
            <div className="sm:col-span-5">
              <SvgPieDonutChart
                slices={periodReport.expensesByCategory}
                totalAmount={periodReport.totalExpense}
                centerLabel="Total Gastos"
                emptyMessage="Nenhuma despesa registrada no período."
              />
            </div>

            <div className="sm:col-span-7 space-y-3 sm:max-h-72 sm:overflow-y-auto sm:pr-1">
              {periodReport.expensesByCategory.map((slice) => (
                <div key={slice.id} className="space-y-1 border-b border-slate-100 pb-2.5 last:border-b-0">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <CategoryIconBadge icon={slice.icon} color={slice.color} size="sm" />
                      <span className="font-semibold text-slate-900 break-words sm:truncate">
                        {slice.name}
                      </span>
                    </div>
                    <div className="font-mono tabular-nums text-right shrink-0">
                      <span className="font-bold text-slate-900">{formatBRL(slice.amount)}</span>
                      <span className="ml-1.5 text-slate-500">({slice.percent}%)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pie Chart 2: Incomes by Source */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Gráfico de Pizza — Receitas por Fonte
                </h3>
                <p className="text-xs text-slate-500">
                  Detalhamento das entradas por fonte de renda
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
            <div className="sm:col-span-5">
              <SvgPieDonutChart
                slices={periodReport.incomesBySource}
                totalAmount={periodReport.totalIncome}
                centerLabel="Total Receitas"
                emptyMessage="Nenhuma receita registrada no período."
              />
            </div>

            <div className="sm:col-span-7 space-y-3 sm:max-h-72 sm:overflow-y-auto sm:pr-1">
              {periodReport.incomesBySource.map((slice) => (
                <div key={slice.id} className="space-y-1 border-b border-slate-100 pb-2.5 last:border-b-0">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <CategoryIconBadge icon={slice.icon} color={slice.color} size="sm" />
                      <span className="font-semibold text-slate-900 break-words sm:truncate">
                        {slice.name}
                      </span>
                    </div>
                    <div className="font-mono tabular-nums text-right shrink-0">
                      <span className="font-bold text-emerald-700">{formatBRL(slice.amount)}</span>
                      <span className="ml-1.5 text-slate-500">({slice.percent}%)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
