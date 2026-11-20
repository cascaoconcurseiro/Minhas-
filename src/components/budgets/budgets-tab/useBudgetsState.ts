/** Estado da tela: modo, edição de teto e campos de categoria. Parte de BudgetsTab (ver BudgetsTab.tsx). */
import { useIsMobile } from '../../../hooks/useIsMobile';
import { useState } from 'react';
import { BudgetBucket, Category, CategoryIconName } from '../../../types/finance';
import { CATEGORY_COLOR_PALETTE } from '../../ui/CategoryIconBadge';

export function useBudgetsState() {
  const isMobile = useIsMobile();
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

  return {
    bucketFilter,
    budgetEditError,
    catBucket,
    catBudgetStr,
    catColor,
    catIcon,
    catName,
    catType,
    catTypeTab,
    categoryFormError,
    editValueStr,
    editingCatId,
    editingFullCategory,
    isMobile,
    setBucketFilter,
    setBudgetEditError,
    setCatBucket,
    setCatBudgetStr,
    setCatColor,
    setCatIcon,
    setCatName,
    setCatType,
    setCatTypeTab,
    setCategoryFormError,
    setEditValueStr,
    setEditingCatId,
    setEditingFullCategory,
    setShowCatEditor,
    setViewMode,
    showCatEditor,
    viewMode,
  };
}

export type BudgetsStateApi = ReturnType<typeof useBudgetsState>;
