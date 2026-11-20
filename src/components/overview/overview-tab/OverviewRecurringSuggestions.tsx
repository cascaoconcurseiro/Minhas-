/** Sugestões de gastos que se repetem. Parte de OverviewTab (ver OverviewTab.tsx). */
import { CashForecastCard } from '../CashForecastCard';
import { RecurringSuggestionsCard } from '../RecurringSuggestionsCard';
import type { OverviewTabContext } from './overviewTabContext';

export function OverviewRecurringSuggestions({ form }: { form: OverviewTabContext }) {
  const {
    cashForecast,
    categories,
    onDismissRecurring,
    onScheduleRecurring,
    recurringSuggestions,
  } = form;
  return (
    <>
<CashForecastCard forecast={cashForecast} />
      {onScheduleRecurring && onDismissRecurring && (
        <RecurringSuggestionsCard
          suggestions={recurringSuggestions}
          categories={categories}
          onSchedule={onScheduleRecurring}
          onDismiss={onDismissRecurring}
        />
      )}
    </>
  );
}
