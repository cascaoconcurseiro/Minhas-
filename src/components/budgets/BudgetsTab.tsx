import React from 'react';
import { Edit3, Trash2 } from 'lucide-react';
import { CategoryIconBadge } from '../ui/CategoryIconBadge';
import { BudgetInsightsCard } from '../overview/BudgetInsightsCard';
import { formatBRL } from '../../domain/finance/financeRules';
import { resolveBudgetsTabProps } from './budgets-tab/budgetsTabConfig';
import type { BudgetsTabProps } from './budgets-tab/budgetsTabConfig';
import { useBudgetsState } from './budgets-tab/useBudgetsState';
import { useBudgetsDerived } from './budgets-tab/useBudgetsDerived';
import { useBudgetsActions } from './budgets-tab/useBudgetsActions';
import type { BudgetsTabContext } from './budgets-tab/budgetsTabContext';

import { BudgetsAlertsPanel } from './budgets-tab/BudgetsAlertsPanel';
import { BudgetsCategoryEditor } from './budgets-tab/BudgetsCategoryEditor';
import { BudgetsHeader } from './budgets-tab/BudgetsHeader';
import { BudgetsListBody } from './budgets-tab/BudgetsListBody';
import { BudgetsListHeader } from './budgets-tab/BudgetsListHeader';
import { BudgetsRuleStrip } from './budgets-tab/BudgetsRuleStrip';

export type { BudgetsTabProps };

/**
 * Orçamentos: tetos por categoria, regra 50/30/20, ritmo do mês e cadastro de categorias.
 * A lógica fica em budgets-tab/ (hooks chamados sempre na mesma ordem; cada um recebe o que os anteriores devolveram).
 */
export const BudgetsTab: React.FC<BudgetsTabProps> = (props) => {
  const ctx0 = resolveBudgetsTabProps(props);
  const ctx1 = { ...ctx0, ...useBudgetsState() };
  const ctx2 = { ...ctx1, ...useBudgetsDerived(ctx1) };
  const ctx3 = { ...ctx2, ...useBudgetsActions(ctx2) };
  const form: BudgetsTabContext = ctx3;
  const {
    budgetSuggestions,
    catTypeTab,
    categories,
    displayedCategoriesForManager,
    getBucketLabel,
    onDeleteCategory,
    onUpdateCategoryBudget,
    openEditCategoryForm,
    paceAlerts,
    setCatTypeTab,
    viewMode,
  } = form;
  return (
    <div className="module-page space-y-6">
      {/* Sub-navigation between Monthly Budgets and the Custom Category Manager */}
      <BudgetsHeader form={form} />

      {/* Category Editor Form */}
      <BudgetsCategoryEditor form={form} />

      <BudgetInsightsCard
        suggestions={budgetSuggestions}
        paceAlerts={paceAlerts}
        onApplySuggestion={(suggestion) => onUpdateCategoryBudget(suggestion.categoryId, suggestion.suggestedBudget)}
      />

      {/* Visual Alerts Panel for Categories Near or Over Budget */}
      <BudgetsAlertsPanel form={form} />

      {viewMode === 'budgets' ? (
        <>
          {/* 50-30-20 Diagnostic Strip */}
          <BudgetsRuleStrip form={form} />

          {/* Category Budget Table */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <BudgetsListHeader form={form} />

            <BudgetsListBody form={form} />
          </section>
        </>
      ) : (
        /* Custom Category Manager View */
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Categorias Personalizáveis
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Adicione, edite cores e ícones, ou exclua categorias de gastos e receitas
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setCatTypeTab('expense')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    catTypeTab === 'expense'
                      ? 'bg-white text-rose-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Categorias de Gastos ({categories.filter((c) => c.type === 'expense').length})
                </button>
                <button
                  type="button"
                  onClick={() => setCatTypeTab('income')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    catTypeTab === 'income'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Categorias de Receitas ({categories.filter((c) => c.type === 'income').length})
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {displayedCategoriesForManager.map((cat) => {
              return (
                <div key={cat.id} className="p-6 space-y-3 hover:bg-slate-50/40">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <CategoryIconBadge icon={cat.icon} color={cat.color} size="md" />
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{cat.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          <span>
                            {cat.type === 'expense'
                              ? getBucketLabel(cat.bucket)
                              : 'Fonte de Receita'}
                          </span>
                          {cat.type === 'expense' && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono tabular-nums">
                                Teto mensal: {formatBRL(cat.monthlyBudget)}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditCategoryForm(cat)}
                        aria-label={`Editar categoria ${cat.name}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Editar Cor / Ícone
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCategory(cat.id)}
                        aria-label={`Excluir categoria ${cat.name}`}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
