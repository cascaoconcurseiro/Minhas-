import React from 'react';
import { CalendarClock, X } from 'lucide-react';
import type { Category } from '../types/finance';
import { formatBRL } from '../utils/financeRules';
import type { RecurringCandidate } from '../utils/recurrenceDetection';

interface RecurringSuggestionsCardProps {
  suggestions: RecurringCandidate[];
  categories: Category[];
  onSchedule: (candidate: RecurringCandidate) => void;
  onDismiss: (candidate: RecurringCandidate) => void;
  /** Quantas sugestões mostrar de uma vez. */
  limit?: number;
}

function formatDay(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

/** Sugestões de gastos que se repetem todo mês, com ação de prever os próximos meses. */
export const RecurringSuggestionsCard: React.FC<RecurringSuggestionsCardProps> = ({
  suggestions,
  categories,
  onSchedule,
  onDismiss,
  limit = 3,
}) => {
  if (suggestions.length === 0) return null;
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const visible = suggestions.slice(0, limit);

  return (
    <section
      aria-label="Gastos que se repetem"
      data-testid="recurring-suggestions"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3"
    >
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-indigo-600 shrink-0" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Gastos que se repetem</h2>
        {suggestions.length > limit && (
          <span className="text-[11px] text-slate-400">+{suggestions.length - limit} outros</span>
        )}
      </div>

      <ul className="space-y-2">
        {visible.map((item) => (
          <li
            key={item.key}
            data-testid={`recurring-suggestion-${item.key}`}
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {item.description}
                <span className="ml-2 font-mono tabular-nums font-bold">{formatBRL(item.lastAmount)}</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Todo mês por volta do dia {item.dayOfMonth} · {item.monthsInARow} meses seguidos
                {categoryName.get(item.categoryId) ? ` · ${categoryName.get(item.categoryId)}` : ''}
                {item.amountPattern === 'variable' ? ' · valor varia' : ''}
              </p>
              {item.priceChange && (
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {item.priceChange.percent > 0 ? 'Aumentou' : 'Baixou'} {Math.abs(item.priceChange.percent).toString().replace('.', ',')}%
                  {' '}({formatBRL(item.priceChange.from)} → {formatBRL(item.priceChange.to)})
                </p>
              )}
              {item.missingThisMonth && (
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                  Ainda não apareceu neste mês (costuma ser dia {item.dayOfMonth}).
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onSchedule(item)}
                className="rounded-lg bg-slate-900 dark:bg-white px-3 py-1.5 text-xs font-bold text-white dark:text-slate-900 hover:opacity-90"
              >
                Prever próximos meses (a partir de {formatDay(item.nextExpectedDate)})
              </button>
              <button
                type="button"
                onClick={() => onDismiss(item)}
                aria-label={`Ignorar ${item.description}`}
                title="Não sugerir de novo"
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
