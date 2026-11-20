/** Comparativo de 6 meses e evolução do saldo. Parte de ReportsAndDataTab (ver ReportsAndDataTab.tsx). */
import { MonthlyComparisonBarChart } from '../../overview/MonthlyComparisonBarChart';
import { TrendingUp } from 'lucide-react';
import { formatBRL } from '../../../domain/finance/financeRules';
import type { ReportsAndDataTabContext } from './reportsTabContext';

export function ReportsTrendCharts({ form }: { form: ReportsAndDataTabContext }) {
  const {
    accounts,
    cards,
    lineChartGeometry,
    periodReport,
    selectedMonth,
    transactions,
  } = form;
  return (
    <>
{/* Bar Chart & Line Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Grouped Bar Chart (Recharts): Monthly Comparison (Income vs Expense in Last 6 Months) */}
        <MonthlyComparisonBarChart
          selectedMonth={selectedMonth}
          accounts={accounts}
          cards={cards}
          transactions={transactions}
          periodMonthlySeries={periodReport.monthlySeries}
        />

        {/* Line Chart: Evolution of General Balance & Net Result */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sky-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Gráfico de Linhas — Evolução do Saldo Geral e Economia
                </h3>
                <p className="text-xs text-slate-500">
                  Trajetória do saldo acumulado nas contas e resultado mensal
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-900" /> Saldo Geral
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Economia Mês
              </span>
            </div>
          </div>

          {lineChartGeometry && (
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${lineChartGeometry.width} ${lineChartGeometry.height}`}
                className="w-full h-52"
                role="img"
                aria-label="Gráfico de linhas da evolução do saldo geral"
              >
                {/* Horizontal grid lines */}
                <line
                  x1="36"
                  y1="30"
                  x2={lineChartGeometry.width - 36}
                  y2="30"
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <line
                  x1="36"
                  y1="100"
                  x2={lineChartGeometry.width - 36}
                  y2="100"
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <line
                  x1="36"
                  y1={lineChartGeometry.zeroY}
                  x2={lineChartGeometry.width - 36}
                  y2={lineChartGeometry.zeroY}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />

                {/* Net Monthly Savings Line */}
                <polyline
                  fill="none"
                  stroke="#059669"
                  strokeWidth="2.5"
                  points={lineChartGeometry.netPolyline}
                />

                {/* Cumulative Balance Line */}
                <polyline
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth="3"
                  points={lineChartGeometry.balancePolyline}
                />

                {lineChartGeometry.balancePoints.map((pt, i) => (
                  <g key={pt.label}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="4.5"
                      fill="#0f172a"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    >
                      <title>
                        {pt.label} — Saldo Geral: {formatBRL(pt.balance)}
                      </title>
                    </circle>
                    <circle
                      cx={lineChartGeometry.netPoints[i].x}
                      cy={lineChartGeometry.netPoints[i].y}
                      r="4"
                      fill="#059669"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    >
                      <title>
                        {pt.label} — Economia Mensal: {formatBRL(pt.net)}
                      </title>
                    </circle>
                    <text
                      x={pt.x}
                      y={lineChartGeometry.height - 4}
                      textAnchor="middle"
                      className="fill-slate-600 text-[10px] font-mono"
                    >
                      {pt.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
