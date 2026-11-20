/** Aba Categorias e orçamentos. Parte de SettingsModal (ver SettingsModal.tsx). */
import { Plus, Trash2 } from 'lucide-react';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { BudgetBucket } from '../../../types/finance';
import { formatBRL } from '../../../domain/finance/financeRules';
import type { SettingsModalContext } from './settingsModalContext';

export function SettingsCategoriesTab({ form }: { form: SettingsModalContext }) {
  const {
    activeTab,
    budgetEditInputs,
    categories,
    handleCreateCategory,
    handleSaveCategoryBudget,
    newCatBudgetStr,
    newCatGroup,
    newCatName,
    newCatType,
    onDeleteCategory,
    setBudgetEditInputs,
    setNewCatBudgetStr,
    setNewCatGroup,
    setNewCatName,
    setNewCatType,
  } = form;
  return (
    <>
{activeTab === 'categories' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <h3 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <Plus className="h-4 w-4 text-emerald-600" />
                  Criar Nova Categoria Financeira
                </h3>
                <form
                  onSubmit={handleCreateCategory}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                >
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Nome da Categoria
                    </label>
                    <input
                      type="text"
                      required
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Ex: Educação, Pets, Impostos..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Tipo
                    </label>
                    <select
                      value={newCatType}
                      onChange={(e) =>
                        setNewCatType(e.target.value as 'expense' | 'income')
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                    >
                      <option value="expense">Despesa</option>
                      <option value="income">Receita</option>
                    </select>
                  </div>
                  {newCatType === 'expense' && (
                    <>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Teto Mensal (R$)
                        </label>
                        <CurrencyInput
                          value={newCatBudgetStr}
                          currency="BRL"
                          onValueChange={setNewCatBudgetStr}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Bloco 50/30/20
                        </label>
                        <select
                          value={newCatGroup}
                          onChange={(e) =>
                            setNewCatGroup(e.target.value as BudgetBucket)
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
                        >
                          <option value="essential">50% Essenciais</option>
                          <option value="lifestyle">30% Estilo de Vida</option>
                          <option value="financial">20% Futuro</option>
                        </select>
                      </div>
                    </>
                  )}
                  <div
                    className={
                      newCatType === 'expense' ? 'sm:col-span-2' : 'sm:col-span-6'
                    }
                  >
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition-colors"
                    >
                      + Adicionar
                    </button>
                  </div>
                </form>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Categorias Cadastradas ({categories.length}) — Edite os Tetos de Gasto
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categories.map((cat) => {
                    const isEditingBudget = budgetEditInputs[cat.id] !== undefined;
                    return (
                      <div
                        key={cat.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="text-xs font-bold text-slate-900 break-words sm:truncate">
                              {cat.name}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                cat.type === 'income'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {cat.type === 'income' ? 'Receita' : 'Despesa'}
                            </span>
                          </div>
                          {onDeleteCategory && categories.length > 3 && (
                            <button
                              type="button"
                              onClick={() => onDeleteCategory(cat.id)}
                              title="Excluir categoria"
                              className="text-slate-400 hover:text-rose-600 p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {cat.type === 'expense' && (
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 bg-white rounded-lg border border-slate-200/80 px-2.5 py-1.5">
                            <span>Teto de Orçamento:</span>
                            {isEditingBudget ? (
                              <div className="flex items-center gap-1">
                                <CurrencyInput
                                  value={budgetEditInputs[cat.id]}
                                  currency="BRL"
                                  onValueChange={(value) =>
                                    setBudgetEditInputs((prev) => ({
                                      ...prev,
                                      [cat.id]: value,
                                    }))
                                  }
                                  className="w-20 rounded border border-emerald-400 px-1.5 py-0.5 text-xs font-mono font-bold text-slate-900"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSaveCategoryBudget(
                                      cat.id,
                                      cat.monthlyBudget
                                    )
                                  }
                                  className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white"
                                >
                                  Salvar
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setBudgetEditInputs((prev) => ({
                                    ...prev,
                                    [cat.id]: String(cat.monthlyBudget),
                                  }))
                                }
                                className="font-mono font-bold text-slate-900 hover:text-emerald-700 underline decoration-dotted"
                              >
                                {formatBRL(cat.monthlyBudget)} (Editar)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
    </>
  );
}
