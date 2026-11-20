/** Cabeçalho da lista de orçamentos. Parte de BudgetsTab (ver BudgetsTab.tsx). */
import type { BudgetsTabContext } from './budgetsTabContext';

export function BudgetsListHeader({ form }: { form: BudgetsTabContext }) {
  const {
    bucketFilter,
    setBucketFilter,
  } = form;
  return (
    <>
<div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Teto de Gastos Mensal por Categoria
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Acompanhe o consumo de cada orçamento e edite os limites
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setBucketFilter('all')}
                  className={`px-3 py-2.5 sm:py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    bucketFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setBucketFilter('essential')}
                  className={`px-3 py-2.5 sm:py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    bucketFilter === 'essential'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Essenciais (50%)
                </button>
                <button
                  type="button"
                  onClick={() => setBucketFilter('lifestyle')}
                  className={`px-3 py-2.5 sm:py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    bucketFilter === 'lifestyle'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Estilo de Vida (30%)
                </button>
                <button
                  type="button"
                  onClick={() => setBucketFilter('financial')}
                  className={`px-3 py-2.5 sm:py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    bucketFilter === 'financial'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Metas (20%)
                </button>
              </div>
            </div>
    </>
  );
}
