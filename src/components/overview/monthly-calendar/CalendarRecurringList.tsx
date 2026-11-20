/** Contas fixas e parcelas do mês. Parte de MonthlyCalendarView (ver MonthlyCalendarView.tsx). */
import type { MonthlyCalendarContext } from './monthlyCalendarContext';

export function CalendarRecurringList({ form }: { form: MonthlyCalendarContext }) {
  const {
    calendarFilter,
    setCalendarFilter,
  } = form;
  return (
    <>
{/* Calendar Filter Toolbar & Legend */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setCalendarFilter('all')}
              className={`px-3 py-2.5 sm:py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                calendarFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos os Itens
            </button>
            <button
              type="button"
              onClick={() => setCalendarFilter('pending')}
              className={`px-3 py-2.5 sm:py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                calendarFilter === 'pending'
                  ? 'bg-amber-100 text-amber-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚠️ Pendências & A Vencer
            </button>
            <button
              type="button"
              onClick={() => setCalendarFilter('cards')}
              className={`px-3 py-2.5 sm:py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                calendarFilter === 'cards'
                  ? 'bg-violet-100 text-violet-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              💳 Faturas de Cartão
            </button>
            <button
              type="button"
              onClick={() => setCalendarFilter('recurring')}
              className={`px-3 py-2.5 sm:py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                calendarFilter === 'recurring'
                  ? 'bg-blue-100 text-blue-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🔁 Parcelados & Fixos
            </button>
            <button
              type="button"
              onClick={() => setCalendarFilter('paid')}
              className={`px-3 py-2.5 sm:py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                calendarFilter === 'paid'
                  ? 'bg-emerald-100 text-emerald-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ✅ Pagos & Efetivados
            </button>
          </div>

          {/* Quick Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
              Conta a Vencer
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-600" />
              Fatura de Cartão
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
              Parcelado / Recorrente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Pago / Recebido
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
