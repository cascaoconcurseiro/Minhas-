/** Fluxo de caixa diário do mês. Parte de ReportsAndDataTab (ver ReportsAndDataTab.tsx). */
import { formatBRL, formatMonthYearPT, formatShortDateBR } from '../../../domain/finance/financeRules';
import type { ReportsAndDataTabContext } from './reportsTabContext';

export function ReportsDailyCashFlow({ form }: { form: ReportsAndDataTabContext }) {
  const {
    dailyFlow,
    lowestProjectedPoint,
    selectedMonth,
    setShowAllFlowDays,
    showAllFlowDays,
    visibleFlowDays,
  } = form;
  return (
    <>
{/* Daily Cash Flow Section */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-4 sm:px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Fluxo de Caixa Diário Acumulado — {formatMonthYearPT(selectedMonth)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Movimento real das contas, dia a dia, para evitar descoberto. Compras no cartão só saem do caixa no pagamento da fatura; o gasto em si aparece no mês da compra (gráfico por categoria, calendário e orçamento)
            </p>
          </div>
          <button
            type="button"
            data-testid="daily-flow-toggle"
            aria-expanded={showAllFlowDays}
            onClick={() => setShowAllFlowDays((value) => !value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            {showAllFlowDays ? 'Ver só dias com movimento' : `Ver todos os ${dailyFlow.length} dias`}
          </button>
          {lowestProjectedPoint && (
            <div className="text-left sm:text-right font-mono tabular-nums text-xs">
              <span className="text-slate-500">Menor saldo projetado no mês: </span>
              <strong
                className={
                  lowestProjectedPoint.projectedBalance >= 0
                    ? 'text-emerald-700'
                    : 'text-rose-700'
                }
              >
                {formatBRL(lowestProjectedPoint.projectedBalance)} (dia{' '}
                {String(lowestProjectedPoint.day).padStart(2, '0')})
              </strong>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/40 text-xs font-semibold text-slate-500">
                <th className="sticky left-0 z-10 bg-slate-50 py-3 pl-4 sm:pl-6 pr-3 whitespace-nowrap">Data</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Entradas do Dia</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Saídas do Dia</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Saldo Caixa Efetivado</th>
                <th className="py-3 pl-3 pr-4 sm:pr-6 text-right">Saldo Previsto Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-mono tabular-nums">
              {visibleFlowDays.map((pt) => (
                <tr key={pt.date} data-testid="daily-flow-row" className="hover:bg-slate-50/80">
                  <td className="sticky left-0 z-10 bg-white py-2.5 pl-4 sm:pl-6 pr-3 text-xs text-slate-700 whitespace-nowrap">
                    {formatShortDateBR(pt.date)}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap text-emerald-700">
                    {pt.income > 0 ? `+${formatBRL(pt.income)}` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap text-rose-700">
                    {pt.expense > 0 ? (
                      pt.expenseNotes?.length ? (
                        <span
                          tabIndex={0}
                          data-testid="daily-flow-expense-note"
                          title={pt.expenseNotes.join('\n')}
                          className="cursor-help underline decoration-dotted underline-offset-4"
                        >
                          -{formatBRL(pt.expense)}
                          <span className="sr-only">. {pt.expenseNotes.join('. ')}</span>
                        </span>
                      ) : (
                        `-${formatBRL(pt.expense)}`
                      )
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap font-semibold text-slate-900">
                    {formatBRL(pt.cumulativeBalance)}
                  </td>
                  <td
                    className={`py-2.5 pl-3 pr-4 sm:pr-6 text-right whitespace-nowrap font-bold ${
                      pt.projectedBalance >= 0 ? 'text-slate-900' : 'text-rose-700'
                    }`}
                  >
                    {formatBRL(pt.projectedBalance)}
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
