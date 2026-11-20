/** Grade do calendário com o total de cada dia. Parte de MonthlyCalendarView (ver MonthlyCalendarView.tsx). */
import { WEEKDAY_HEADERS } from './monthlyCalendarConfig';
import { calculateCalendarCellTotals, formatBRL } from '../../../domain/finance/financeRules';
import { Plus } from 'lucide-react';
import type { MonthlyCalendarContext } from './monthlyCalendarContext';

export function CalendarGrid({ form }: { form: MonthlyCalendarContext }) {
  const {
    calendarCells,
    calendarFilter,
    cardInvoicesByDate,
    onOpenNewTransaction,
    selectedDate,
    setSelectedDate,
    todayStr,
    transactionsByDate,
  } = form;
  return (
    <>
{/* The Monthly Calendar Grid */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Day-of-Week Table Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100/80 text-center text-xs font-bold text-slate-700">
          {WEEKDAY_HEADERS.map((h, i) => (
            <div
              key={h}
              className={`py-2.5 border-r border-slate-200 last:border-r-0 ${
                i === 0 || i === 6 ? 'bg-slate-200/40 text-slate-600' : ''
              }`}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Calendar Matrix Rows */}
        <div className="grid grid-cols-7 divide-y divide-slate-200 auto-rows-fr">
          {calendarCells.map((cell) => {
            const isSelected = cell.dateStr === selectedDate;
            const isToday = cell.dateStr === todayStr;

            // Raw items for this cell
            const allDayTxs = transactionsByDate.get(cell.dateStr) || [];
            const allDayInvoices = cardInvoicesByDate.get(cell.dateStr) || [];

            // Apply active calendar filter
            const filteredTxs = allDayTxs.filter((tx) => {
              if (calendarFilter === 'pending') return tx.status === 'pending';
              if (calendarFilter === 'cards') return Boolean(tx.creditCardId);
              if (calendarFilter === 'recurring')
                return tx.recurrence === 'installment' || tx.recurrence === 'fixed';
              if (calendarFilter === 'paid') return tx.status === 'paid';
              return true;
            });

            const hasPendingBills = allDayTxs.some(
              (tx) => tx.status === 'pending' && tx.type === 'expense'
            );
            const hasOpenInvoice = allDayInvoices.some(
              (inv) => !inv.isPaid && inv.amount > 0
            );

            // Total do dia (respeita o filtro ativo); os lançamentos ficam no detalhamento abaixo
            const cellTotals = calculateCalendarCellTotals(filteredTxs);

            return (
              <div
                key={cell.dateStr}
                onClick={() => setSelectedDate(cell.dateStr)}
                className={`min-h-[90px] sm:min-h-[115px] min-w-0 overflow-hidden p-1 sm:p-2 border-r border-slate-200 last:border-r-0 flex flex-col justify-between transition-colors cursor-pointer group ${
                  !cell.isCurrentMonth
                    ? 'bg-slate-50/60 text-slate-400 opacity-60'
                    : isSelected
                    ? 'bg-emerald-50/40 ring-2 ring-emerald-500 ring-inset z-10'
                    : hasPendingBills || hasOpenInvoice
                    ? 'bg-amber-50/20 hover:bg-slate-50'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                {/* Cell Header: Day Number + Daily Balance + Quick Add Button */}
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span
                        className={`inline-flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-[11px] sm:text-xs font-bold tabular-nums ${
                          isToday
                            ? 'bg-emerald-600 text-white'
                            : isSelected
                            ? 'bg-slate-900 text-white'
                            : cell.isCurrentMonth
                            ? 'text-slate-800'
                            : 'text-slate-400'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                      {hasPendingBills && (
                        <span
                          title="Conta pendente a vencer neste dia"
                          className="h-2 w-2 shrink-0 rounded-full bg-amber-500 ring-1 ring-white"
                        />
                      )}
                      {hasOpenInvoice && (
                        <span
                          title="Vencimento de fatura de cartão em aberto"
                          className="h-2 w-2 shrink-0 rounded-full bg-violet-600 ring-1 ring-white"
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Quick + Button on Hover */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDate(cell.dateStr);
                          onOpenNewTransaction('expense', cell.dateStr);
                        }}
                        title={`Lançar despesa ou receita em ${cell.dateStr}`}
                        aria-label={`Lançar em ${cell.dateStr}`}
                        className="hidden sm:inline-flex opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-opacity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Total do dia */}
                  {(cellTotals.expense > 0 || cellTotals.income > 0) && (
                    <div className="mt-2 space-y-0.5 min-w-0">
                      {cellTotals.expense > 0 && (
                        <div
                          title="Total gasto no dia"
                          className="break-words sm:truncate text-[11px] sm:text-sm font-extrabold tabular-nums text-rose-700"
                        >
                          -{formatBRL(cellTotals.expense)}
                        </div>
                      )}
                      {cellTotals.income > 0 && (
                        <div
                          title="Total recebido no dia"
                          className="break-words sm:truncate text-[11px] sm:text-sm font-extrabold tabular-nums text-emerald-700"
                        >
                          +{formatBRL(cellTotals.income)}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer status dot indicator for compact screens */}
                <div className="mt-1 flex items-center gap-1 justify-end">
                  {filteredTxs.length > 0 && (
                    <span className="text-[9px] text-slate-400 font-medium">
                      {filteredTxs.length} {filteredTxs.length === 1 ? 'item' : 'itens'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
