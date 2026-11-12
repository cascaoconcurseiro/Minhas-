import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Edit3,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  BudgetBucket,
  Category,
  CategoryIconName,
  CategorySpendItem,
  Transaction,
} from '../types/finance';
import {
  calculate503020Rule,
  formatBRL,
  getBudgetAlerts,
  getLocalDateISO,
  normalizeSearchText,
  parseBRLInput,
} from '../utils/financeRules';
import { calculateMonthBurnRateMarker } from '../utils/uxEnhancementRules';
import { assessBudgetPace, suggestBudgets } from '../utils/budgetIntelligence';
import { BudgetInsightsCard } from './BudgetInsightsCard';
import { CurrencyInput } from './CurrencyInput';
import { parseCurrencyInput } from '../utils/currencyInput';
import {
  CATEGORY_COLOR_PALETTE,
  CATEGORY_ICON_OPTIONS,
  CategoryIconBadge,
  renderCategoryIcon,
} from './CategoryIconBadge';

interface BudgetsTabProps {
  selectedMonth: string;
  categories: Category[];
  categoryBreakdown: CategorySpendItem[];
  transactions: Transaction[];
  onUpdateCategoryBudget: (categoryId: string, newBudget: number) => void;
  onAddCategory: (category: Omit<Category, 'id'>) => void;
  onUpdateCategory: (category: Category) => void;
  onDeleteCategory: (categoryId: string) => void;
}

function parseNonNegativeBudget(raw: string): number | null {
  if (!raw.trim()) return 0;
  const cleaned = raw.trim().replace(/[R$\s]/g, '');
  if (!/^[+-]?(?:\d+(?:[,.]\d{0,2})?|[,.]\d{1,2}|\d{1,3}(?:\.\d{3})+,\d{0,2}|\d{1,3}(?:,\d{3})+\.\d{0,2}|\d{1,3}(?:\.\d{3}){2,}|\d{1,3}(?:,\d{3}){2,})$/.test(cleaned)) return null;
  const parsed = parseCurrencyInput(raw, 'BRL');
  if (parsed < 0) return null;
  if (parsed === 0 && !/^\+?0+(?:[.,]0+)?$/.test(cleaned)) return null;
  return parsed;
}

export const BudgetsTab: React.FC<BudgetsTabProps> = ({
  selectedMonth,
  categories,
  categoryBreakdown,
  transactions,
  onUpdateCategoryBudget,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}) => {
  const [viewMode, setViewMode] = useState<'budgets' | 'categories'>('budgets');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editValueStr, setEditValueStr] = useState('');
  const [budgetEditError, setBudgetEditError] = useState('');
  const [bucketFilter, setBucketFilter] = useState<'all' | BudgetBucket>('all');
  const [catTypeTab, setCatTypeTab] = useState<'expense' | 'income'>('expense');

  // Create / Edit Category Modal/Form State
  const [showCatEditor, setShowCatEditor] = useState(false);
  const [editingFullCategory, setEditingFullCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'expense' | 'income'>('expense');
  const [catBucket, setCatBucket] = useState<BudgetBucket>('essential');
  const [catBudgetStr, setCatBudgetStr] = useState('');
  const [catColor, setCatColor] = useState<string>(CATEGORY_COLOR_PALETTE[0].hex);
  const [catIcon, setCatIcon] = useState<CategoryIconName>('home');
  const [categoryFormError, setCategoryFormError] = useState('');

  const rule503020 = calculate503020Rule(categories, transactions, selectedMonth);
  const budgetSuggestions = useMemo(
    () => suggestBudgets(categories, transactions, selectedMonth),
    [categories, transactions, selectedMonth]
  );
  const paceAlerts = useMemo(
    () => (selectedMonth === getLocalDateISO().slice(0, 7) ? assessBudgetPace(categories, transactions, getLocalDateISO()) : []),
    [categories, transactions, selectedMonth]
  );
  const budgetAlerts = getBudgetAlerts(categoryBreakdown);
  const overAlerts = budgetAlerts.filter((a) => a.status === 'over');
  const warningAlerts = budgetAlerts.filter((a) => a.status === 'warning');

  const totalBudgeted = categoryBreakdown.reduce((sum, item) => sum + item.budget, 0);
  const totalSpent = categoryBreakdown.reduce((sum, item) => sum + item.spent, 0);

  const filteredItems = categoryBreakdown.filter((item) =>
    bucketFilter === 'all' ? true : item.bucket === bucketFilter
  );

  const openNewCategoryForm = (defaultType: 'expense' | 'income' = 'expense') => {
    setEditingFullCategory(null);
    setCategoryFormError('');
    setCatName('');
    setCatType(defaultType);
    setCatBucket(defaultType === 'income' ? 'financial' : 'essential');
    setCatBudgetStr('');
    setCatColor(CATEGORY_COLOR_PALETTE[0].hex);
    setCatIcon(defaultType === 'income' ? 'briefcase' : 'tag');
    setShowCatEditor(true);
  };

  const openEditCategoryForm = (cat: Category) => {
    setEditingFullCategory(cat);
    setCategoryFormError('');
    setCatName(cat.name);
    setCatType(cat.type);
    setCatBucket(cat.bucket);
    setCatBudgetStr(cat.monthlyBudget.toFixed(2).replace('.', ','));
    setCatColor(cat.color || CATEGORY_COLOR_PALETTE[0].hex);
    setCatIcon(cat.icon || 'tag');
    setShowCatEditor(true);
  };

  const handleSaveCategoryForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      setCategoryFormError('Informe o nome da categoria.');
      return;
    }
    const normalizedName = normalizeSearchText(catName.trim());
    const duplicate = categories.some(
      (category) =>
        category.type === catType &&
        category.id !== editingFullCategory?.id &&
        normalizeSearchText(category.name) === normalizedName
    );
    if (duplicate) {
      setCategoryFormError('Já existe uma categoria desse tipo com esse nome.');
      return;
    }

    const parsedBudgetValue = catType === 'expense' ? parseNonNegativeBudget(catBudgetStr) : 0;
    if (parsedBudgetValue === null) {
      setCategoryFormError('Informe um orçamento válido e não negativo.');
      return;
    }
    const parsedBudget = parsedBudgetValue;
    setCategoryFormError('');

    if (editingFullCategory) {
      onUpdateCategory({
        ...editingFullCategory,
        name: catName.trim(),
        type: catType,
        bucket: catBucket,
        monthlyBudget: parsedBudget,
        color: catColor,
        icon: catIcon,
      });
    } else {
      onAddCategory({
        name: catName.trim(),
        type: catType,
        bucket: catBucket,
        monthlyBudget: parsedBudget,
        color: catColor,
        icon: catIcon,
      });
    }

    setShowCatEditor(false);
    setEditingFullCategory(null);
  };

  const startEditingBudget = (item: CategorySpendItem) => {
    setEditingCatId(item.categoryId);
    setEditValueStr(item.budget.toFixed(2).replace('.', ','));
    setBudgetEditError('');
  };

  const saveBudget = (categoryId: string) => {
    const parsed = parseNonNegativeBudget(editValueStr);
    if (parsed === null) {
      setBudgetEditError('Informe um valor válido e não negativo.');
      return;
    }
    onUpdateCategoryBudget(categoryId, parsed);
    setBudgetEditError('');
    setEditingCatId(null);
  };

  const cancelBudgetEdit = () => {
    setEditingCatId(null);
    setBudgetEditError('');
  };

  const getBucketLabel = (bucket: BudgetBucket) => {
    if (bucket === 'essential') return 'Essencial (50%)';
    if (bucket === 'lifestyle') return 'Estilo de Vida (30%)';
    return 'Objetivos & Poupança (20%)';
  };

  const displayedCategoriesForManager = categories.filter((c) => c.type === catTypeTab);

  return (
    <div className="module-page space-y-6">
      {/* Sub-navigation between Monthly Budgets and the Custom Category Manager */}
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

      {/* Category Editor Form */}
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

      <BudgetInsightsCard
        suggestions={budgetSuggestions}
        paceAlerts={paceAlerts}
        onApplySuggestion={(suggestion) => onUpdateCategoryBudget(suggestion.categoryId, suggestion.suggestedBudget)}
      />

      {/* Visual Alerts Panel for Categories Near or Over Budget */}
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

      {viewMode === 'budgets' ? (
        <>
          {/* 50-30-20 Diagnostic Strip */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Diagnóstico da Regra 50-30-20 no Mês
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Divisão recomendada da renda líquida mensal ({formatBRL(rule503020.incomeBase)}) entre gastos essenciais, estilo de vida e futuro
                </p>
              </div>
              <div className="text-left sm:text-right font-mono tabular-nums text-xs text-slate-600">
                <span className="block sm:inline">
                  Orçamento Total Planejado: <strong>{formatBRL(totalBudgeted)}</strong>
                </span>
                <span aria-hidden="true" className="hidden sm:inline"> · </span>
                <span className="block sm:inline">
                  Realizado + Previsto: <strong>{formatBRL(totalSpent)}</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 pt-2">
              <div className="pb-4 md:pb-0 md:pr-6 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">
                    01. Necessidades Essenciais (Meta 50%)
                  </span>
                  <span
                    className={`font-mono tabular-nums font-bold ${
                      rule503020.essentialPercent <= 55 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {rule503020.essentialPercent}% da renda
                  </span>
                </div>
                <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
                  {formatBRL(rule503020.essentialSpent)}
                  <span className="text-xs font-normal text-slate-500">
                    {' '}
                    / ideal até {formatBRL(rule503020.essentialTarget)}
                  </span>
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      rule503020.essentialPercent <= 50 ? 'bg-emerald-600' : 'bg-amber-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (rule503020.essentialPercent / 50) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Moradia, condomínio, mercado, saúde, transporte e luz/internet.
                </p>
              </div>

              <div className="py-4 md:py-0 md:px-6 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">
                    02. Estilo de Vida & Lazer (Meta 30%)
                  </span>
                  <span
                    className={`font-mono tabular-nums font-bold ${
                      rule503020.lifestylePercent <= 30 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {rule503020.lifestylePercent}% da renda
                  </span>
                </div>
                <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
                  {formatBRL(rule503020.lifestyleSpent)}
                  <span className="text-xs font-normal text-slate-500">
                    {' '}
                    / ideal até {formatBRL(rule503020.lifestyleTarget)}
                  </span>
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      rule503020.lifestylePercent <= 30 ? 'bg-slate-800' : 'bg-rose-600'
                    }`}
                    style={{
                      width: `${Math.min(100, (rule503020.lifestylePercent / 30) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Restaurantes, iFood, viagens, compras parceladas e streaming.
                </p>
              </div>

              <div className="pt-4 md:pt-0 md:pl-6 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">
                    03. Poupança & Futuro (Meta ≥ 20%)
                  </span>
                  <span
                    className={`font-mono tabular-nums font-bold ${
                      rule503020.financialPercent >= 20 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {rule503020.financialPercent}% da renda
                  </span>
                </div>
                <p className="text-lg font-bold font-mono tabular-nums text-emerald-700">
                  {formatBRL(rule503020.financialSavings)}
                  <span className="text-xs font-normal text-slate-500">
                    {' '}
                    / meta mínima {formatBRL(rule503020.financialTarget)}
                  </span>
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{
                      width: `${Math.min(100, (rule503020.financialPercent / 20) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Aportes diretos em metas mais saldo livre poupado no mês.
                </p>
              </div>
            </div>
          </section>

          {/* Category Budget Table */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
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
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
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
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
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
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
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
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    bucketFilter === 'financial'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Metas (20%)
                </button>
              </div>
            </div>

            <p className="px-6 pt-3 text-xs text-slate-500 xl:hidden" role="note">
              Deslize horizontalmente para acessar todas as colunas e ações.
            </p>
            <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-[920px] text-left border-collapse xl:min-w-0">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/40 text-xs font-semibold text-slate-500">
                    <th className="py-3 pl-6 pr-3">Categoria</th>
                    <th className="py-3 px-3">Progresso & Alerta</th>
                    <th className="py-3 px-3 text-right">Gasto Real + Cartão</th>
                    <th className="py-3 px-3 text-right">Teto Planejado</th>
                    <th className="py-3 px-3 text-right">Saldo Disponível</th>
                    <th className="py-3 pl-3 pr-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredItems.map((item) => {
                    const remaining = item.budget - item.spent;
                    const isEditing = editingCatId === item.categoryId;
                    const fullCat = categories.find((c) => c.id === item.categoryId);

                    return (
                      <tr key={item.categoryId} className="hover:bg-slate-50/80">
                        <td className="py-3.5 pl-6 pr-3">
                          <div className="flex items-start gap-3">
                            <CategoryIconBadge
                              icon={item.categoryIcon}
                              color={item.categoryColor}
                              size="md"
                            />
                            <div>
                              <p className="font-semibold text-slate-900">{item.categoryName}</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                <span>{getBucketLabel(item.bucket)}</span>
                                <span aria-hidden="true"> · </span>
                                <span>{item.percentOfTotalExpense}% das despesas</span>
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 min-w-[230px]">
                          {(() => {
                            const burnRate = calculateMonthBurnRateMarker(
                              selectedMonth,
                              item.percentOfBudget
                            );
                            return (
                              <div>
                                <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-1">
                                  <span
                                    className={
                                      item.status === 'over'
                                        ? 'font-bold text-rose-700'
                                        : item.status === 'warning'
                                        ? 'font-semibold text-amber-700'
                                        : 'text-slate-600'
                                    }
                                  >
                                    {item.status === 'over'
                                      ? 'Alerta: Limite Excedido!'
                                      : item.status === 'warning'
                                      ? 'Alerta: Próximo (>80%)'
                                      : 'Dentro do limite'}
                                  </span>
                                  <span className="text-slate-700 font-semibold">
                                    {item.percentOfBudget}%
                                  </span>
                                </div>
                                <div className="relative h-2.5 w-full rounded-full bg-slate-100">
                                  <div
                                    className={`h-full rounded-full ${
                                      item.status === 'over'
                                        ? 'bg-rose-600'
                                        : item.status === 'warning'
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-600'
                                    }`}
                                    style={{ width: `${Math.min(100, item.percentOfBudget)}%` }}
                                  />
                                  {/* Monthly Burn Rate Marker (Ritmo do Mês) */}
                                  <div
                                    data-testid="burn-rate-marker"
                                    title={`Ritmo ideal hoje (Dia ${burnRate.referenceDay}/${burnRate.daysInMonth}): ${burnRate.monthProgressPercent}% do mês decorrido`}
                                    className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 bg-slate-900/80 rounded-full"
                                    style={{ left: `${burnRate.monthProgressPercent}%` }}
                                  />
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-500">
                                  <span>
                                    Ritmo dia {burnRate.referenceDay}/{burnRate.daysInMonth}:{' '}
                                    {burnRate.monthProgressPercent}%
                                  </span>
                                  <span
                                    className={
                                      burnRate.paceStatus === 'over_pace'
                                        ? 'text-amber-700 font-semibold'
                                        : burnRate.paceStatus === 'under_pace'
                                        ? 'text-emerald-700 font-semibold'
                                        : 'text-slate-500'
                                    }
                                  >
                                    {burnRate.paceLabel}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                          {formatBRL(item.spent)}
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          {isEditing ? (
                            <CurrencyInput
                              aria-label={`Novo teto para ${item.categoryName}`}
                              value={editValueStr}
                              currency="BRL"
                              onValueChange={(value) => {
                                setEditValueStr(value);
                                setBudgetEditError('');
                              }}
                              className="w-28 rounded border border-emerald-600 px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-900"
                            />
                          ) : (
                            <span className="text-slate-700">{formatBRL(item.budget)}</span>
                          )}
                        </td>

                        <td
                          className={`py-3.5 px-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                            remaining >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {formatBRL(remaining)}
                        </td>

                        <td className="py-3.5 pl-3 pr-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => saveBudget(item.categoryId)}
                                  aria-label={`Salvar teto de ${item.categoryName}`}
                                  className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelBudgetEdit}
                                  aria-label={`Cancelar edição do teto de ${item.categoryName}`}
                                  className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEditingBudget(item)}
                                  aria-label={`Editar teto de ${item.categoryName}`}
                                  className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  Teto
                                </button>
                                {fullCat && (
                                  <button
                                    type="button"
                                    onClick={() => openEditCategoryForm(fullCat)}
                                    aria-label={`Personalizar ${item.categoryName}`}
                                    className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                  >
                                    Personalizar
                                  </button>
                                )}
                              </>
                            )}
                            {isEditing && budgetEditError && (
                              <p role="alert" className="mt-1 text-xs text-rose-700">{budgetEditError}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
