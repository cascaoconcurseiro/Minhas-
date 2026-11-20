/** Tabela mês a mês. Parte de ReportsAndDataTab (ver ReportsAndDataTab.tsx). */
import { formatBRL } from '../../../domain/finance/financeRules';
import type { ReportsAndDataTabContext } from './reportsTabContext';

export function ReportsMonthlyTable({ form }: { form: ReportsAndDataTabContext }) {
  const {
    periodReport,
  } = form;
  return (
    <>
{/* Month-over-Month Comparative Summary Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-4 sm:px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">
            Resumo Comparativo Entre Meses
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Evolução comparativa de receitas, despesas, variação percentual mensal e saldo acumulado
          </p>
        </div>

        {/* Mobile Comparative Cards (< sm) */}
        <div className="block sm:hidden divide-y divide-slate-100">
          {periodReport.monthlySeries.map((row) => (
            <div key={row.month} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">{row.label}</span>
                <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  Poupança: {row.savingsRate}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                <div>
                  <span className="block text-[10px] font-sans text-slate-400">Receitas</span>
                  <span className="font-semibold text-emerald-700">{formatBRL(row.income)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-sans text-slate-400">Despesas</span>
                  <span className="font-semibold text-rose-700">{formatBRL(row.expense)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-sans text-slate-400">Resultado Mês</span>
                  <span
                    className={`font-bold ${
                      row.netSavings >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {row.netSavings >= 0 ? '+' : ''}
                    {formatBRL(row.netSavings)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-sans text-slate-400">Saldo Acumulado</span>
                  <span className="font-bold text-slate-900">
                    {formatBRL(row.cumulativeBalance)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Comparative Table (>= sm) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/40 text-xs font-semibold text-slate-500">
                <th className="py-3 pl-6 pr-3">Mês / Competência</th>
                <th className="py-3 px-3 text-right">Receitas</th>
                <th className="py-3 px-3 text-right">Despesas</th>
                <th className="py-3 px-3 text-right">Variação Gastos (Mês Ant.)</th>
                <th className="py-3 px-3 text-right">Resultado Líquido</th>
                <th className="py-3 px-3 text-right">Taxa Poupança</th>
                <th className="py-3 pl-3 pr-6 text-right">Saldo Geral Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-mono tabular-nums">
              {periodReport.monthlySeries.map((row) => (
                <tr key={row.month} className="hover:bg-slate-50/80">
                  <td className="py-3 pl-6 pr-3 font-sans font-semibold text-slate-900">
                    {row.label}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-700 font-semibold">
                    {formatBRL(row.income)}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-700 font-semibold">
                    {formatBRL(row.expense)}
                  </td>
                  <td className="py-3 px-3 text-right text-xs">
                    {row.expenseDeltaPercent === null ? (
                      <span className="text-slate-400">Base inicial</span>
                    ) : (
                      <span
                        className={
                          row.expenseDeltaPercent <= 0
                            ? 'text-emerald-700 font-semibold'
                            : 'text-rose-700 font-semibold'
                        }
                      >
                        {row.expenseDeltaPercent > 0 ? '+' : ''}
                        {row.expenseDeltaPercent}%
                      </span>
                    )}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-bold ${
                      row.netSavings >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {row.netSavings >= 0 ? '+' : ''}
                    {formatBRL(row.netSavings)}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700">
                    {row.savingsRate}%
                  </td>
                  <td className="py-3 pl-3 pr-6 text-right font-bold text-slate-900">
                    {formatBRL(row.cumulativeBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
