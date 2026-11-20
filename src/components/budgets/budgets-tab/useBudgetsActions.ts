/** Ações: cadastrar/editar categoria, editar e salvar teto. Parte de BudgetsTab (ver BudgetsTab.tsx). */
import { CATEGORY_COLOR_PALETTE } from '../../ui/CategoryIconBadge';
import { BudgetBucket, Category, CategorySpendItem } from '../../../types/finance';
import React from 'react';
import { normalizeSearchText } from '../../../domain/finance/financeRules';
import { parseNonNegativeBudget } from './budgetsTabConfig';
import type { BudgetsTabPropsApi } from './budgetsTabConfig';
import type { BudgetsStateApi } from './useBudgetsState';

export function useBudgetsActions(ctx: BudgetsTabPropsApi & BudgetsStateApi) {
  const {
    catBucket,
    catBudgetStr,
    catColor,
    catIcon,
    catName,
    catType,
    catTypeTab,
    categories,
    editValueStr,
    editingFullCategory,
    onAddCategory,
    onUpdateCategory,
    onUpdateCategoryBudget,
    setBudgetEditError,
    setCatBucket,
    setCatBudgetStr,
    setCatColor,
    setCatIcon,
    setCatName,
    setCatType,
    setCategoryFormError,
    setEditValueStr,
    setEditingCatId,
    setEditingFullCategory,
    setShowCatEditor,
  } = ctx;
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

  return {
    cancelBudgetEdit,
    displayedCategoriesForManager,
    getBucketLabel,
    handleSaveCategoryForm,
    openEditCategoryForm,
    openNewCategoryForm,
    saveBudget,
    startEditingBudget,
  };
}

export type BudgetsActionsApi = ReturnType<typeof useBudgetsActions>;
