/** Histórico de proventos e dividendos. Parte de InvestmentsTab (ver InvestmentsTab.tsx). */
import { Coins } from 'lucide-react';
import { formatBRL, formatMonthYearPT, formatShortDateBR } from '../../../domain/finance/financeRules';
import type { InvestmentsTabContext } from './investmentsTabContext';

export function InvestmentsDividendHistory({ form }: { form: InvestmentsTabContext }) {
  const {
    accounts,
    allTimeDividendsTotal,
    monthDividendTransactions,
    monthDividendsTotal,
    selectedMonth,
  } = form;
  return (
    <>
{/* Row 4: Monthly Dividend & Passive Income History Map (#5) */}
      <section
        data-testid="dividend-history-section"
        className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4 shadow-2xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Histórico de Proventos & Dividendos no Extrato ({formatMonthYearPT(selectedMonth)})
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhe dividendos de FIIs, JCP e rendimentos recebidos ou previstos. Cada lançamento indica se já foi creditado.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-right">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                No Mês ({selectedMonth})
              </span>
              <span className="font-mono tabular-nums text-xs sm:text-sm font-extrabold text-emerald-800">
                +{formatBRL(monthDividendsTotal)}
              </span>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-right">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Registrado
              </span>
              <span className="font-mono tabular-nums text-xs sm:text-sm font-bold text-slate-900">
                {formatBRL(allTimeDividendsTotal)}
              </span>
            </div>
          </div>
        </div>

        {monthDividendTransactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
            <p className="text-xs font-semibold text-slate-700">
              Nenhum dividendo ou provento registrado no extrato em {formatMonthYearPT(selectedMonth)}.
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Use o botão <strong>+ Dividendo / $ Provento</strong> em qualquer ativo acima para creditar os proventos recebidos na sua conta.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {monthDividendTransactions.map((tx) => {
              const accName =
                accounts.find((a) => a.id === tx.accountId)?.name || 'Conta Corrente';
              return (
                <div
                  key={tx.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      <p className="text-xs font-bold text-slate-900 break-words sm:truncate">
                        {tx.description}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 break-words sm:truncate">
                      {formatShortDateBR(tx.date)} · {accName} ·{' '}
                      {tx.status === 'paid' ? 'Creditado' : 'Previsto'}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums text-sm font-extrabold text-emerald-700 shrink-0">
                    +{formatBRL(tx.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
