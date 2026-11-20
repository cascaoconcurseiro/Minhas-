/** Pulso semanal de caixa. Parte de MonthlyCalendarView (ver MonthlyCalendarView.tsx). */
import { calculateWeeklyCashPulse } from '../../../domain/budgets/uxEnhancementRules';
import { formatBRL } from '../../../domain/finance/financeRules';
import type { MonthlyCalendarContext } from './monthlyCalendarContext';

export function CalendarWeeklyPulse({ form }: { form: MonthlyCalendarContext }) {
  const {
    selectedDate,
    selectedMonth,
    setSelectedDate,
    transactions,
  } = form;
  return (
    <>
{/* Suggestion #5: Weekly Cash Pulse (Pulso Semanal do Mês — Mapa de Calor Semanal) */}
      <section
        data-testid="weekly-cash-pulse-strip"
        className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-900">
              Compras por Semana
            </h3>
            <p className="text-[11px] text-slate-500">
              Valor total das compras na semana da compra, contado uma vez. Orçamento e faturas continuam por parcela.
            </p>
          </div>
          <span className="text-[11px] font-mono tabular-nums text-slate-500">
            5 blocos semanais
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {calculateWeeklyCashPulse(transactions, selectedMonth).map((week) => {
            const selectedDayNum = Number(selectedDate.slice(8, 10));
            const isWeekActive =
              selectedDayNum >= week.startDay && selectedDayNum <= week.endDay;

            return (
              <button
                key={week.weekIndex}
                type="button"
                data-testid={`weekly-pulse-card-${week.weekIndex}`}
                onClick={() => setSelectedDate(week.firstDate)}
                className={`rounded-xl border p-3 text-left transition-all flex flex-col justify-between gap-2 ${
                  isWeekActive
                    ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600/20'
                    : week.isPeakExpenseWeek
                    ? 'border-rose-200 bg-rose-50/40 hover:border-rose-300'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-slate-900">{week.label}</span>
                  {week.isPeakExpenseWeek && (
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-800 shrink-0">
                      Pico Saídas
                    </span>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                  {week.rangeLabel} · {week.txCount} mov.
                </div>

                <div className="pt-1 border-t border-slate-200/70 flex items-center justify-between text-[11px] font-mono tabular-nums">
                  <span className="text-rose-700 font-bold">
                    -{formatBRL(week.expense)}
                  </span>
                  {week.pendingCount > 0 && (
                    <span className="text-[10px] font-semibold text-amber-700">
                      {week.pendingCount} pend.
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
