/** Cabeçalho e troca de visão. Parte de BudgetsTab (ver BudgetsTab.tsx). */
import { Plus } from 'lucide-react';
import type { BudgetsTabContext } from './budgetsTabContext';

export function BudgetsHeader({ form }: { form: BudgetsTabContext }) {
  const {
    categories,
    openNewCategoryForm,
    setViewMode,
    viewMode,
  } = form;
  return (
    <>
<div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div
          role="group"
          aria-label="Visualização do orçamento"
          className="flex w-full min-w-0 flex-col items-stretch gap-1 rounded-lg bg-slate-100 p-1 sm:w-auto sm:flex-row sm:items-center"
        >
          <button
            type="button"
            onClick={() => setViewMode('budgets')}
            aria-pressed={viewMode === 'budgets'}
            className={`min-h-11 w-full min-w-0 rounded-md px-3 py-2 text-left text-xs font-semibold leading-snug transition-colors whitespace-normal ${
              viewMode === 'budgets'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            } sm:w-auto sm:px-4 sm:text-center sm:whitespace-nowrap`}
          >
            Orçamentos Mensais & Alertas (50-30-20)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('categories')}
            aria-pressed={viewMode === 'categories'}
            className={`min-h-11 w-full min-w-0 rounded-md px-3 py-2 text-left text-xs font-semibold leading-snug transition-colors whitespace-normal ${
              viewMode === 'categories'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            } sm:w-auto sm:px-4 sm:text-center sm:whitespace-nowrap`}
          >
            Gerenciar Categorias ({categories.length})
          </button>
        </div>

          <button
          type="button"
          onClick={() => openNewCategoryForm('expense')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova Categoria Personalizada
        </button>
      </div>
    </>
  );
}
