/** Indicadores da fatura do mês: total, pago, em aberto e limite. Parte de CreditCardsTab (ver CreditCardsTab.tsx). */
import { formatBRL, formatMonthYearPT } from '../../../domain/finance/financeRules';
import type { CardPageContext } from './creditCardsTabContext';

export function CardKpiStrip({ form }: { form: CardPageContext }) {
  const {
    activeCard,
    activeSummary,
    selectedMonth,
  } = form;
  return (
    <>
{/* Active Card KPI Strip (2x2 on Mobile, 4 Columns on Desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 break-words sm:truncate">
                Fatura {formatMonthYearPT(selectedMonth)}
              </p>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 break-words sm:truncate">
                {formatBRL(activeSummary.invoiceTotal)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 break-words sm:truncate">
                <span>Fecha {activeCard.closingDay}</span>
                <span aria-hidden="true"> · </span>
                <span>Vence {activeCard.dueDay}</span>
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 break-words sm:truncate">Status da Fatura</p>
              <p
                className={`mt-1.5 sm:mt-2 text-base sm:text-xl font-bold break-words sm:truncate ${
                  activeSummary.isInvoicePaid ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {activeSummary.isInvoicePaid
                  ? 'Fatura Quitada'
                  : activeSummary.invoicePendingAmount < 0
                  ? 'Com crédito'
                  : activeSummary.invoiceTotal === 0
                  ? 'Sem fatura no mês'
                  : 'Em Aberto'}
              </p>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs font-mono tabular-nums text-slate-500 break-words sm:truncate">
            Resta: {formatBRL(activeSummary.invoicePendingAmount)}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
          <p className="text-[11px] sm:text-xs font-medium text-slate-500 break-words sm:truncate">
            Limite Tomado Total
          </p>
          <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-rose-700 break-words sm:truncate">
            {formatBRL(activeSummary.usedLimit)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs font-mono tabular-nums text-slate-500 break-words sm:truncate">
            {activeSummary.usagePercent}% de {formatBRL(activeCard.limit)}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
          <p className="text-[11px] sm:text-xs font-medium text-slate-500 break-words sm:truncate">Limite Disponível</p>
          <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 break-words sm:truncate">
            {formatBRL(activeSummary.availableLimit)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 break-words sm:truncate">
            Liberado ao pagar fatura
          </p>
        </div>
      </div>
    </>
  );
}
