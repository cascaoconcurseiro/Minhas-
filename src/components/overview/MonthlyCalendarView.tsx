import React from 'react';
import { resolveMonthlyCalendarProps } from './monthly-calendar/monthlyCalendarConfig';
import type { MonthlyCalendarViewProps } from './monthly-calendar/monthlyCalendarConfig';
import { useCalendarState } from './monthly-calendar/useCalendarState';
import { useCalendarData } from './monthly-calendar/useCalendarData';
import type { MonthlyCalendarContext } from './monthly-calendar/monthlyCalendarContext';

import { CalendarDayDetail } from './monthly-calendar/CalendarDayDetail';
import { CalendarGrid } from './monthly-calendar/CalendarGrid';
import { CalendarKpiCards } from './monthly-calendar/CalendarKpiCards';
import { CalendarRecurringList } from './monthly-calendar/CalendarRecurringList';
import { CalendarWeeklyPulse } from './monthly-calendar/CalendarWeeklyPulse';

export type { MonthlyCalendarViewProps };

/**
 * Calendário mensal: gastos por dia, faturas, contas fixas e detalhe do dia selecionado.
 * A lógica fica em monthly-calendar/ (hooks chamados sempre na mesma ordem; cada um recebe o que os anteriores devolveram).
 */
export const MonthlyCalendarView: React.FC<MonthlyCalendarViewProps> = (props) => {
  const ctx0 = resolveMonthlyCalendarProps(props);
  const ctx1 = { ...ctx0, ...useCalendarState(ctx0) };
  const ctx2 = { ...ctx1, ...useCalendarData(ctx1) };
  const form: MonthlyCalendarContext = ctx2;
  const {

  } = form;
  return (
    <div className="space-y-6">
      {/* Visual KPI Strip: Calendar Insights & Pending Due Dates */}
      <CalendarKpiCards form={form} />

      <CalendarWeeklyPulse form={form} />

      <CalendarRecurringList form={form} />

      <CalendarGrid form={form} />

      <CalendarDayDetail form={form} />
    </div>
  );
};
