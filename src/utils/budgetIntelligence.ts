import type { Category, Transaction } from '../types/finance';
import { addMonthsToYearMonth, calculateCategoryBreakdown } from './financeRules';

/**
 * Orçamento inteligente: sugere o teto de cada categoria pela média dos últimos meses e avisa
 * quando o ritmo do mês está acima do esperado, antes de estourar o teto.
 */
export interface BudgetSuggestion {
  categoryId: string;
  categoryName: string;
  currentBudget: number;
  suggestedBudget: number;
  /** Média mensal gasta nos meses considerados. */
  averageSpent: number;
  monthsConsidered: number;
  /** Gasto de cada mês considerado, do mais antigo ao mais recente. */
  monthlySpent: number[];
}

const MIN_MONTHS_WITH_SPEND = 2;
const BUDGET_MARGIN = 1.1;
const MIN_CHANGE_RATIO = 0.2;

function roundUpToTen(value: number): number {
  // Arredonda os centavos antes para o ponto flutuante não empurrar 990,0000001 para 1.000
  return Math.ceil(Math.round(value * 100) / 100 / 10) * 10;
}

export function suggestBudgets(
  categories: Category[],
  transactions: Transaction[],
  referenceMonth: string,
  monthsBack = 3
): BudgetSuggestion[] {
  const months = Array.from({ length: monthsBack }, (_, i) => addMonthsToYearMonth(referenceMonth, -(monthsBack - i)));
  const breakdowns = months.map((month) => calculateCategoryBreakdown(categories, transactions, month));

  const suggestions: BudgetSuggestion[] = [];
  for (const category of categories) {
    // Teto só faz sentido para gasto de consumo (não para aportes, fatura ou receitas)
    if (category.type !== 'expense' || category.bucket === 'financial') continue;
    const monthlySpent = breakdowns.map(
      (breakdown) => breakdown.find((item) => item.categoryId === category.id)?.spent ?? 0
    );
    const withSpend = monthlySpent.filter((amount) => amount > 0);
    if (withSpend.length < MIN_MONTHS_WITH_SPEND) continue;

    const averageSpent = Math.round((withSpend.reduce((sum, amount) => sum + amount, 0) / withSpend.length) * 100) / 100;
    const suggestedBudget = roundUpToTen(averageSpent * BUDGET_MARGIN);
    const changesEnough =
      category.monthlyBudget <= 0 ||
      Math.abs(suggestedBudget - category.monthlyBudget) / category.monthlyBudget >= MIN_CHANGE_RATIO;
    if (!changesEnough) continue;

    suggestions.push({
      categoryId: category.id,
      categoryName: category.name,
      currentBudget: category.monthlyBudget,
      suggestedBudget,
      averageSpent,
      monthsConsidered: withSpend.length,
      monthlySpent,
    });
  }
  return suggestions.sort((a, b) => b.averageSpent - a.averageSpent);
}

export interface PaceAlert {
  categoryId: string;
  categoryName: string;
  budget: number;
  spent: number;
  percentSpent: number;
  /** Quanto do mês já passou, em %. */
  percentOfMonth: number;
  level: 'ahead' | 'over';
  message: string;
}

const MIN_DAY_FOR_PACE = 5;
const MIN_PERCENT_SPENT = 60;
const AHEAD_MARGIN_POINTS = 20;

/** Avisa quando o gasto do mês está adiantado em relação ao teto (ou já passou dele). */
export function assessBudgetPace(
  categories: Category[],
  transactions: Transaction[],
  referenceDate: string
): PaceAlert[] {
  const month = referenceDate.slice(0, 7);
  const day = Number(referenceDate.slice(8, 10));
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const percentOfMonth = Math.round((day / daysInMonth) * 100);
  const names = new Map(categories.map((category) => [category.id, category.name]));

  const alerts: PaceAlert[] = [];
  for (const item of calculateCategoryBreakdown(categories, transactions, month)) {
    if (item.budget <= 0 || item.bucket === 'financial') continue;
    const percentSpent = Math.round((item.spent / item.budget) * 100);
    const name = names.get(item.categoryId) ?? item.categoryName;
    if (item.spent > item.budget) {
      alerts.push({
        categoryId: item.categoryId, categoryName: name, budget: item.budget, spent: item.spent,
        percentSpent, percentOfMonth, level: 'over',
        message: `${name}: passou do teto (${percentSpent}% do limite) e o mês ainda não acabou.`,
      });
    } else if (
      day >= MIN_DAY_FOR_PACE &&
      percentSpent >= MIN_PERCENT_SPENT &&
      percentSpent >= percentOfMonth + AHEAD_MARGIN_POINTS
    ) {
      alerts.push({
        categoryId: item.categoryId, categoryName: name, budget: item.budget, spent: item.spent,
        percentSpent, percentOfMonth, level: 'ahead',
        message: `${name}: já gastou ${percentSpent}% do teto e o mês está em ${percentOfMonth}%.`,
      });
    }
  }
  return alerts.sort((a, b) => b.percentSpent - a.percentSpent);
}
