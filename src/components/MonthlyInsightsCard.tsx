import React from 'react';
import { Sparkles } from 'lucide-react';
import type { MonthlyInsight } from '../utils/monthlyNarrative';

interface MonthlyInsightsCardProps {
  insights: MonthlyInsight[];
  /** Nome do mês mostrado no título, ex.: "novembro". */
  monthLabel: string;
}

const toneStyles: Record<MonthlyInsight['tone'], string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  info: 'bg-slate-400',
};

/** Resumo do mês em frases curtas. */
export const MonthlyInsightsCard: React.FC<MonthlyInsightsCardProps> = ({ insights, monthLabel }) => {
  if (insights.length === 0) return null;
  return (
    <section
      aria-label="Resumo do mês"
      data-testid="monthly-insights"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Resumo de {monthLabel}</h2>
      </div>
      <ul className="space-y-2">
        {insights.map((insight) => (
          <li key={insight.id} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
            <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneStyles[insight.tone]}`} />
            <span>{insight.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
