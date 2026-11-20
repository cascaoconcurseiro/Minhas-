/** Tudo o que MonthlyCalendarView calcula, junto: é o que as partes da tela recebem. */
import type { MonthlyCalendarPropsApi } from './monthlyCalendarConfig';
import type { CalendarStateApi } from './useCalendarState';
import type { CalendarDataApi } from './useCalendarData';

export type MonthlyCalendarContext = MonthlyCalendarPropsApi &
  CalendarStateApi &
  CalendarDataApi;
