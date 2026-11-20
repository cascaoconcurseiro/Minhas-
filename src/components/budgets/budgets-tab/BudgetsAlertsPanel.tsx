/** Painel de alertas do orçamento. Parte de BudgetsTab (ver BudgetsTab.tsx). */
import { AlertTriangle } from 'lucide-react';
import { CategoryIconBadge } from '../../ui/CategoryIconBadge';
import { formatBRL } from '../../../domain/finance/financeRules';
import type { BudgetsTabContext } from './budgetsTabContext';

export function BudgetsAlertsPanel({ form }: { form: BudgetsTabContext }) {
  const {
    budgetAlerts,
    overAlerts,
  } = form;
  return (
    <>
{budgetAlerts.length > 0 && (
        <section
          aria-label="Painel de alertas de limites de orçamento"
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={`h-4 w-4 ${
                  overAlerts.length > 0 ? 'text-rose-600' : 'text-amber-600'
                }`}
              />
              <h2 className="text-sm font-bold text-slate-900">
                Alertas Visuais de Limite de Orçamento ({budgetAlerts.length})
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Atenção a partir de 80% · Alerta crítico acima de 100%
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {budgetAlerts.map((alert) => {
              const isOver = alert.status === 'over';
              const excessOrRemaining = Math.abs(alert.budget - alert.spent);
              return (
                <div
                  key={alert.categoryId}
                  className={`rounded-lg border p-3.5 space-y-2 ${
                    isOver
                      ? 'border-rose-200 bg-rose-50/60'
                      : 'border-amber-200 bg-amber-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CategoryIconBadge
                        icon={alert.categoryIcon}
                        color={alert.categoryColor}
                        size="sm"
                      />
                      <span className="text-xs font-bold text-slate-900 break-words sm:truncate">
                        {alert.categoryName}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold font-mono tabular-nums shrink-0 ${
                        isOver ? 'text-rose-700' : 'text-amber-800'
                      }`}
                    >
                      {alert.percentOfBudget}%
                    </span>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white">
                    <div
                      className={`h-full rounded-full ${
                        isOver ? 'bg-rose-600' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, alert.percentOfBudget)}%` }}
                    />
                  </div>

                  <p className="text-xs font-mono tabular-nums text-slate-700">
                    {isOver ? (
                      <span className="text-rose-800 font-semibold">
                        Excedido em {formatBRL(excessOrRemaining)} (Gasto: {formatBRL(alert.spent)})
                      </span>
                    ) : (
                      <span className="text-amber-900">
                        Restam apenas {formatBRL(excessOrRemaining)} de {formatBRL(alert.budget)}
                      </span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
