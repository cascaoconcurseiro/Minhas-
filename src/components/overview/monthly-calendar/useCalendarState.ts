/** Estado da tela: filtro, ano e mês. Parte de MonthlyCalendarView (ver MonthlyCalendarView.tsx). */
import { useMemo, useState } from 'react';
import { CalendarFilterType } from './monthlyCalendarConfig';
import type { MonthlyCalendarPropsApi } from './monthlyCalendarConfig';

export function useCalendarState(ctx: MonthlyCalendarPropsApi) {
  const {
    selectedMonth,
  } = ctx;
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilterType>('all');

  // Parse year and month
  const [yearNum, monthNum] = useMemo(
    () => selectedMonth.split('-').map(Number),
    [selectedMonth]
  );

  return {
    calendarFilter,
    monthNum,
    setCalendarFilter,
    yearNum,
  };
}

export type CalendarStateApi = ReturnType<typeof useCalendarState>;
