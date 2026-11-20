/** Tipos, auxiliares e props de BudgetsTab. */
import { Category, CategorySpendItem, Transaction } from '../../../types/finance';
import { parseCurrencyInput } from '../../../utils/currencyInput';

export interface BudgetsTabProps {
  selectedMonth: string;
  categories: Category[];
  categoryBreakdown: CategorySpendItem[];
  transactions: Transaction[];
  onUpdateCategoryBudget: (categoryId: string, newBudget: number) => void;
  onAddCategory: (category: Omit<Category, 'id'>) => void;
  onUpdateCategory: (category: Category) => void;
  onDeleteCategory: (categoryId: string) => void;
}

export function parseNonNegativeBudget(raw: string): number | null {
  if (!raw.trim()) return 0;
  const cleaned = raw.trim().replace(/[R$\s]/g, '');
  if (!/^[+-]?(?:\d+(?:[,.]\d{0,2})?|[,.]\d{1,2}|\d{1,3}(?:\.\d{3})+,\d{0,2}|\d{1,3}(?:,\d{3})+\.\d{0,2}|\d{1,3}(?:\.\d{3}){2,}|\d{1,3}(?:,\d{3}){2,})$/.test(cleaned)) return null;
  const parsed = parseCurrencyInput(raw, 'BRL');
  if (parsed < 0) return null;
  if (parsed === 0 && !/^\+?0+(?:[.,]0+)?$/.test(cleaned)) return null;
  return parsed;
}

/** Aplica os valores padrão das props (mesmos de antes) e devolve tudo num objeto. */
export function resolveBudgetsTabProps({
  selectedMonth,
  categories,
  categoryBreakdown,
  transactions,
  onUpdateCategoryBudget,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}: BudgetsTabProps) {
  return {
    selectedMonth,
    categories,
    categoryBreakdown,
    transactions,
    onUpdateCategoryBudget,
    onAddCategory,
    onUpdateCategory,
    onDeleteCategory,
  };
}

export type BudgetsTabPropsApi = ReturnType<typeof resolveBudgetsTabProps>;
