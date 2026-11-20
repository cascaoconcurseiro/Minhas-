/** Indicadores do mês: gasto, contas, faturas e comprometimento. Parte de MonthlyCalendarView (ver MonthlyCalendarView.tsx). */
import { AlertCircle, ArrowDownRight, CreditCard as CreditCardIcon, Repeat } from 'lucide-react';
import { formatBRL } from '../../../domain/finance/financeRules';
import type { MonthlyCalendarContext } from './monthlyCalendarContext';

export function CalendarKpiCards({ form }: { form: MonthlyCalendarContext }) {
  const {
    accMap,
    cardMap,
    commitment,
    monthStats,
    recurringItems,
    recurringTotal,
    setShowRecurringList,
    showRecurringList,
  } = form;
  return (
    <>
<section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Contas a Vencer no Mês */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">
              Contas a Vencer (Pendentes)
            </span>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-xl font-bold tabular-nums text-amber-950 font-display">
            {formatBRL(monthStats.pendingBillsAmount)}
          </div>
          <p className="mt-1 text-xs text-amber-700">
            {monthStats.pendingBillsCount}{' '}
            {monthStats.pendingBillsCount === 1 ? 'conta aguarda' : 'contas aguardam'}{' '}
            baixa no caixa
          </p>
        </div>

        {/* KPI 2: Faturas de Cartão */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Faturas de Cartão no Mês
            </span>
            <CreditCardIcon className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-2 text-xl font-bold tabular-nums text-slate-900 font-display">
            {formatBRL(monthStats.openInvoicesAmount)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {monthStats.openInvoicesCount > 0
              ? `${monthStats.openInvoicesCount} fatura(s) aberta(s) no período`
              : 'Todas as faturas pagas ou zeradas'}
          </p>
          {commitment.cardTotal > 0 && (
            <p data-testid="calendar-card-commitment" className="mt-1 text-xs font-semibold text-slate-700">
              {commitment.cardPercent !== null
                ? `Cartão no mês: ${commitment.cardPercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% da renda (parcelas ${commitment.installmentPercent?.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`
                : `Cartão no mês: ${formatBRL(commitment.cardTotal)} · sem renda lançada`}
            </p>
          )}
        </div>

        {/* KPI 3: Parcelamentos & Custos Fixos */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Parcelados & Recorrentes
            </span>
            <Repeat className="h-4 w-4 text-violet-600" />
          </div>
          <div className="mt-2 text-xl font-bold tabular-nums text-slate-900 font-display">
            {recurringItems.length} {recurringItems.length === 1 ? 'item' : 'itens'}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {recurringItems.length > 0
              ? `Parcelas e despesas fixas do mês · ${formatBRL(recurringTotal)}`
              : 'Parcelas ativas e despesas fixas recorrentes'}
          </p>
          {recurringItems.length > 0 && (
            <button
              type="button"
              data-testid="recurring-list-toggle"
              aria-expanded={showRecurringList}
              onClick={() => setShowRecurringList((value) => !value)}
              className="mt-2 text-xs font-semibold text-violet-700 hover:underline"
            >
              {showRecurringList ? 'Ocultar lista' : 'Ver lista'}
            </button>
          )}
          {showRecurringList && recurringItems.length > 0 && (
            <ul data-testid="recurring-list" className="mt-2 max-h-64 divide-y divide-slate-100 overflow-y-auto text-xs">
              {recurringItems.map((tx) => {
                const origin = tx.creditCardId
                  ? cardMap.get(tx.creditCardId) || 'Cartão'
                  : accMap.get(tx.accountId || '') || 'Conta';
                const kind = tx.recurrence === 'installment' && tx.installmentNumber
                  ? `Parcela ${tx.installmentNumber}/${tx.installmentTotal}`
                  : 'Fixa';
                return (
                  <li key={tx.id} className="flex items-start justify-between gap-2 py-1.5">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 break-words">{tx.description}</p>
                      <p className="text-slate-500 break-words">
                        Dia {tx.date.slice(8, 10)} · {kind} · {origin}
                      </p>
                    </div>
                    <span className={`shrink-0 font-mono tabular-nums font-semibold ${tx.type === 'income' ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {formatBRL(tx.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* KPI 4: Despesas Totais Previstas */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Despesas nas Datas do Mês
            </span>
            <ArrowDownRight className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 text-xl font-bold tabular-nums text-rose-700 font-display">
            {formatBRL(monthStats.totalExpense)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Receitas: {formatBRL(monthStats.totalIncome)}
          </p>
        </div>
      </section>
    </>
  );
}
