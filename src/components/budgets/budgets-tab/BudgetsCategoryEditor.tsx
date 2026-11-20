/** Formulário de categoria. Parte de BudgetsTab (ver BudgetsTab.tsx). */
import { X } from 'lucide-react';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { BudgetBucket } from '../../../types/finance';
import { CATEGORY_COLOR_PALETTE, CATEGORY_ICON_OPTIONS, renderCategoryIcon } from '../../ui/CategoryIconBadge';
import type { BudgetsTabContext } from './budgetsTabContext';

export function BudgetsCategoryEditor({ form }: { form: BudgetsTabContext }) {
  const {
    catBucket,
    catBudgetStr,
    catColor,
    catIcon,
    catName,
    catType,
    categoryFormError,
    editingFullCategory,
    handleSaveCategoryForm,
    setCatBucket,
    setCatBudgetStr,
    setCatColor,
    setCatIcon,
    setCatName,
    setCatType,
    setCategoryFormError,
    setShowCatEditor,
    showCatEditor,
  } = form;
  return (
    <>
{showCatEditor && (
        <form
          onSubmit={handleSaveCategoryForm}
          className="rounded-xl border border-slate-300 bg-white p-6 space-y-5 shadow-sm"
        >
          {categoryFormError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {categoryFormError}
            </p>
          )}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {editingFullCategory
                  ? `Editar Categoria: ${editingFullCategory.name}`
                  : 'Criar Nova Categoria Personalizada'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Escolha o nome, tipo (Despesa ou Receita), cor e ícone
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCatEditor(false)}
              aria-label="Fechar editor de categoria"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="cat-editor-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Nome da Categoria
              </label>
              <input
                id="cat-editor-name"
                type="text"
                value={catName}
                onChange={(e) => {
                  setCatName(e.target.value);
                  setCategoryFormError('');
                }}
                placeholder="Ex: Pets & Veterinário, Academia, Dividendos"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="cat-editor-type" className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Categoria
              </label>
              <select
                id="cat-editor-type"
                value={catType}
                onChange={(e) => {
                  const nextType = e.target.value as 'expense' | 'income';
                  setCatType(nextType);
                  setCatBucket(nextType === 'income' ? 'financial' : 'essential');
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                <option value="expense">Despesa (Gasto)</option>
                <option value="income">Receita (Fonte de Renda)</option>
              </select>
            </div>

            {catType === 'expense' ? (
              <div>
                <label htmlFor="cat-editor-budget" className="block text-xs font-semibold text-slate-700 mb-1">
                  Orçamento Mensal / Teto (R$)
                </label>
                <CurrencyInput
                  id="cat-editor-budget"
                  value={catBudgetStr}
                  currency="BRL"
                  onValueChange={(value) => {
                    setCatBudgetStr(value);
                    setCategoryFormError('');
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Classificação
                </label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Fonte de Receita Mensal
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {catType === 'expense' && (
              <div className="lg:col-span-3">
                <label htmlFor="cat-editor-bucket" className="block text-xs font-semibold text-slate-700 mb-1">
                  Bloco da Regra 50-30-20
                </label>
                <select
                  id="cat-editor-bucket"
                  value={catBucket}
                  onChange={(e) => setCatBucket(e.target.value as BudgetBucket)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                >
                  <option value="essential">Essencial (50%)</option>
                  <option value="lifestyle">Estilo de Vida & Lazer (30%)</option>
                  <option value="financial">Objetivos & Poupança (20%)</option>
                </select>
              </div>
            )}

            <div className={catType === 'expense' ? 'lg:col-span-4' : 'lg:col-span-6'}>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Cor de Identificação
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {CATEGORY_COLOR_PALETTE.map((swatch) => (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => setCatColor(swatch.hex)}
                    aria-label={`Cor ${swatch.name}`}
                    className={`h-7 w-7 rounded-lg transition-transform ${
                      catColor === swatch.hex
                        ? 'ring-2 ring-slate-900 ring-offset-2 scale-105'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  />
                ))}
              </div>
            </div>

          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ícone da Categoria
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-10 gap-2">
              {CATEGORY_ICON_OPTIONS.map((opt) => {
                const selected = catIcon === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCatIcon(opt.id)}
                    title={opt.label}
                    aria-label={`Ícone ${opt.label}`}
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-xs transition-colors ${
                      selected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {renderCategoryIcon(opt.id, 'h-4 w-4')}
                    <span className="text-[10px] break-words sm:truncate max-w-full">
                      {opt.label.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setShowCatEditor(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              {editingFullCategory ? 'Salvar Categoria' : 'Criar Categoria'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
