import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import type { DataHealthIssue } from '../utils/dataHealth';

interface DataHealthCardProps {
  issues: DataHealthIssue[];
}

/** Lista o que está incompleto ou inconsistente nos cadastros. Some quando está tudo certo. */
export const DataHealthCard: React.FC<DataHealthCardProps> = ({ issues }) => {
  if (issues.length === 0) return null;
  return (
    <section
      aria-label="Saúde dos dados"
      data-testid="data-health"
      className="rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-4 sm:p-5 space-y-3"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Dados para revisar</h2>
      </div>
      <ul className="space-y-2.5">
        {issues.map((issue) => (
          <li key={issue.id} data-testid={`data-health-${issue.id}`} className="flex items-start gap-2 text-sm">
            {issue.severity === 'warn' ? (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            ) : (
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            )}
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{issue.title}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{issue.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
