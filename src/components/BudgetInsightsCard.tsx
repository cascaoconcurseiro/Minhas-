import React from 'react';
import { Lightbulb } from 'lucide-react';
import { formatBRL } from '../utils/financeRules';
import type { BudgetSuggestion, PaceAlert } from '../utils/budgetIntelligence';

interface BudgetInsightsCardProps {
  suggestions: BudgetSuggestion[];
  paceAlerts: PaceAlert[];
  onApplySuggestion: (suggestion: BudgetSuggestion) => void;
  /** Quantas sugestões de teto mostrar de uma vez. */
  limit?: number;
}

/** Ritmo do mês e sugestões de teto pela média dos últimos meses. */
export const BudgetInsightsCard: React.FC<BudgetInsightsCardProps> = ({
  suggestions,
  paceAlerts,
  onApplySuggestion,
  limit = 4,
}) => {
  if (suggestions.length === 0 && paceAlerts.length === 0) return null;
  const visible = suggestions.slice(0, limit);

  return (
    <section
      aria-label="Orçamento inteligente"
      data-testid="budget-insights"
      className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
    >
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-600 shrink-0" />
        <h2 className="text-sm font-bold text-slate-900">Orçamento inteligente</h2>
      </div>

      {paceAlerts.length > 0 && (
        <ul className="space-y-1.5" data-testid="budget-pace-alerts">
          {paceAlerts.map((alert) => (
            <li
              key={alert.categoryId}
              className={`text-xs font-semibold ${alert.level === 'over' ? 'text-rose-700' : 'text-amber-700'}`}
            >
              {alert.message}
            </li>
          ))}
        </ul>
      )}

      {visible.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            Sugestão de teto mensal pela média dos últimos meses, com 10% de folga.
            {suggestions.length > limit ? ` (+${suggestions.length - limit} outras)` : ''}
          </p>
          <ul className="space-y-2">
            {visible.map((suggestion) => (
              <li
                key={suggestion.categoryId}
                data-testid={`budget-suggestion-${suggestion.categoryId}`}
                className="rounded-lg border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{suggestion.categoryName}</p>
                  <p className="text-xs text-slate-500">
                    Média de {formatBRL(suggestion.averageSpent)} em {suggestion.monthsConsidered} meses
                    {suggestion.currentBudget > 0 ? ` · teto atual ${formatBRL(suggestion.currentBudget)}` : ' · sem teto'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onApplySuggestion(suggestion)}
                  className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                >
                  Definir teto de {formatBRL(suggestion.suggestedBudget)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
