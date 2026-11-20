/** Indicadores de todos os cartões e comprometimento da renda. Parte de CreditCardsTab (ver CreditCardsTab.tsx). */
import { formatBRL, formatMonthYearPT, getLocalDateISO } from '../../../domain/finance/financeRules';
import { CardCommitmentSection } from '../CardCommitmentSection';
import type { CardPageContext } from './creditCardsTabContext';

export function CardsListKpis({ form }: { form: CardPageContext }) {
  const {
    cards,
    commitmentLimitPercent,
    commitmentWarnPercent,
    globalCardsTotals,
    onOpenCommitmentSettings,
    selectedMonth,
    transactions,
  } = form;
  return (
    <>
{/* Consolidated KPIs Across All Credit Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 break-words sm:truncate">
                Faturas em {formatMonthYearPT(selectedMonth)}
              </p>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 break-words sm:truncate">
                {formatBRL(globalCardsTotals.totalInvoicesMonth)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 break-words sm:truncate">
                Soma de {cards.length} cartão(ões)
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 break-words sm:truncate">
                Limite Total Consolidado
              </p>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 break-words sm:truncate">
                {formatBRL(globalCardsTotals.totalLimit)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 break-words sm:truncate">
                Crédito total aprovado
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 break-words sm:truncate">
                Limite Tomado (Parcelas)
              </p>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-rose-700 break-words sm:truncate">
                {formatBRL(globalCardsTotals.totalUsed)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 break-words sm:truncate">
                Faturas atuais + futuras
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 break-words sm:truncate">
                Limite Disponível Total
              </p>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 break-words sm:truncate">
                {formatBRL(globalCardsTotals.totalAvailable)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 break-words sm:truncate">
                Livre para novas compras
              </p>
            </div>
          </div>

          <CardCommitmentSection
            transactions={transactions}
            referenceMonth={getLocalDateISO().slice(0, 7)}
            limitPercent={commitmentLimitPercent}
            warnPercent={commitmentWarnPercent}
            onOpenSettings={onOpenCommitmentSettings}
          />
    </>
  );
}
