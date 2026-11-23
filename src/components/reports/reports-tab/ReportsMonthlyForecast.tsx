/** Previsão mês a mês: entradas, faturas, contas e saldo acumulado dos próximos 12 meses. Parte de ReportsAndDataTab. */
import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarRange } from 'lucide-react';
import { formatBRL, formatMonthYearPT, getLocalDateISO } from '../../../domain/finance/financeRules';
import { calculateCurrentPosition } from '../../../domain/finance/wealthAndHealth';
import { buildMonthlyForecast } from '../../../domain/budgets/monthlyForecast';
import type { ReportsAndDataTabContext } from './reportsTabContext';

const money = (value: number) => (value === 0 ? '—' : formatBRL(value));

export function ReportsMonthlyForecast({ form }: { form: ReportsAndDataTabContext }) {
  const { accounts, cards, transactions, currentPosition } = form;
  const [includeEstimate, setIncludeEstimate] = useState(true);
  const today = getLocalDateISO();

  const forecast = useMemo(() => {
    const position = currentPosition ?? calculateCurrentPosition(accounts, cards, transactions, today);
    const included = new Set(accounts.filter((account) => account.includeInTotal).map((account) => account.id));
    const startBalance = Math.round(position.accountBalances
      .filter((balance) => included.has(balance.accountId))
      .reduce((sum, balance) => sum + Math.round(balance.currentBalance * 100), 0)) / 100;
    return buildMonthlyForecast({ accounts, transactions, startBalance, referenceDate: today, includeEstimate });
  }, [accounts, cards, transactions, currentPosition, includeEstimate, today]);

  const hasAnyData = forecast.rows.some((row) => row.income || row.cardInvoices || row.bankExpenses);

  return (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden" data-testid="monthly-forecast">
      <div className="border-b border-slate-200 px-4 sm:px-6 py-4 space-y-2">
        <div className="flex items-start gap-2">
          <CalendarRange className="h-4 w-4 mt-1 text-emerald-700 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Previsão mês a mês (12 meses)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Parte do saldo de hoje ({formatBRL(forecast.startBalance)}) e soma só o que ainda está pendente: entradas, faturas dos
              cartões no mês da fatura e contas no banco. Contas atrasadas entram no mês atual.
            </p>
          </div>
        </div>
        <label className="flex items-start gap-2 text-xs text-slate-700">
          <input type="checkbox" data-testid="forecast-estimate-toggle" checked={includeEstimate} onChange={(e) => setIncludeEstimate(e.target.checked)} className="mt-0.5 h-4 w-4" />
          <span>
            Estimar compras novas no cartão
            {forecast.estimate
              ? ` (média de ${formatBRL(forecast.estimate.monthlyAverage)} por mês, pelas compras à vista de ${forecast.estimate.monthsUsed} mês(es) já lançado(s))`
              : ' (ainda não há compras à vista lançadas para tirar a média)'}
          </span>
        </label>
        {forecast.firstNegativeMonth && (
          <p role="alert" className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            O saldo previsto fica negativo a partir de {formatMonthYearPT(forecast.firstNegativeMonth)}.
          </p>
        )}
        {forecast.incomeEndsAfter && (
          <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Não há nenhuma entrada lançada depois de {formatMonthYearPT(forecast.incomeEndsAfter)}. Se o salário continua, a previsão desses meses está pior do que a realidade.
          </p>
        )}
        {forecast.overdueCount > 0 && (
          <p className="text-xs text-slate-600">{forecast.overdueCount} conta(s) atrasada(s) de meses passados foram somadas ao mês atual.</p>
        )}
      </div>

      {!hasAnyData ? (
        <p className="p-6 text-center text-xs text-slate-500">Ainda não há entradas, faturas ou contas pendentes para prever.</p>
      ) : (
        <>
          {/* Celular */}
          <div className="block sm:hidden divide-y divide-slate-100">
            {forecast.rows.map((row) => (
              <div key={row.month} className="p-4 space-y-2" data-testid={`forecast-card-${row.month}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900">{formatMonthYearPT(row.month)}</span>
                  <span className={`text-xs font-mono tabular-nums font-bold ${row.balance < 0 ? 'text-rose-700' : 'text-slate-900'}`}>Saldo {formatBRL(row.balance)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                  <div><span className="block text-[10px] font-sans text-slate-400">Entradas</span><span className="font-semibold text-emerald-700">{money(row.income)}</span></div>
                  <div><span className="block text-[10px] font-sans text-slate-400">Faturas</span><span className="font-semibold text-rose-700">{money(row.cardInvoices)}</span></div>
                  <div><span className="block text-[10px] font-sans text-slate-400">Contas no banco</span><span className="font-semibold text-rose-700">{money(row.bankExpenses)}</span></div>
                  <div><span className="block text-[10px] font-sans text-slate-400">Compras novas (estim.)</span><span className="font-semibold text-slate-600">{money(row.estimatedPurchases)}</span></div>
                  <div><span className="block text-[10px] font-sans text-slate-400">Sobra do mês</span><span className={`font-semibold ${row.net < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatBRL(row.net)}</span></div>
                  <div><span className="block text-[10px] font-sans text-slate-400">Pessoas te devem</span><span className="font-semibold text-slate-700">{money(row.owedByPeople)}</span></div>
                </div>
                <p className="text-[11px] text-slate-500">Saldo se pagarem o que devem: <span className="font-mono tabular-nums font-semibold">{formatBRL(row.balanceWithOwed)}</span></p>
              </div>
            ))}
          </div>

          {/* Computador */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Mês</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Entradas</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Faturas</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Contas no banco</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Compras novas (estim.)</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Sobra do mês</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Saldo</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Pessoas te devem</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Saldo se pagarem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {forecast.rows.map((row) => (
                  <tr key={row.month} data-testid={`forecast-row-${row.month}`}>
                    <th scope="row" className="px-4 py-2.5 text-left font-sans font-bold text-slate-900 whitespace-nowrap">{formatMonthYearPT(row.month)}</th>
                    <td className="px-3 py-2.5 text-right text-emerald-700">{money(row.income)}</td>
                    <td className="px-3 py-2.5 text-right text-rose-700">{money(row.cardInvoices)}</td>
                    <td className="px-3 py-2.5 text-right text-rose-700">{money(row.bankExpenses)}</td>
                    <td className="px-3 py-2.5 text-right italic text-slate-500">{money(row.estimatedPurchases)}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${row.net < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatBRL(row.net)}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${row.balance < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{formatBRL(row.balance)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{money(row.owedByPeople)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{formatBRL(row.balanceWithOwed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 sm:px-6 py-3 text-[11px] text-slate-500 border-t border-slate-100">
            É uma previsão do que já está lançado, não uma garantia. Compras novas só aparecem se a estimativa estiver ligada. O que as
            pessoas te devem é a parte dos compartilhados que você pagou e elas ainda não acertaram.
          </p>
        </>
      )}
    </section>
  );
}
