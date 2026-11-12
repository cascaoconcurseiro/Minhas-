import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { BudgetSuggestion, PaceAlert } from '../utils/budgetIntelligence';
import { BudgetInsightsCard } from './BudgetInsightsCard';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;

const suggestion = (over: Partial<BudgetSuggestion> = {}): BudgetSuggestion => ({
  categoryId: 'cat-mercado', categoryName: 'Supermercado', currentBudget: 0, suggestedBudget: 990, averageSpent: 900,
  monthsConsidered: 3, monthlySpent: [800, 900, 1000], ...over,
});
const alert: PaceAlert = {
  categoryId: 'cat-lazer', categoryName: 'Lazer', budget: 500, spent: 350, percentSpent: 70, percentOfMonth: 40, level: 'ahead',
  message: 'Lazer: já gastou 70% do teto e o mês está em 40%.',
};

function render(suggestions: BudgetSuggestion[], paceAlerts: PaceAlert[], onApply = (_: BudgetSuggestion) => {}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(BudgetInsightsCard, { suggestions, paceAlerts, onApplySuggestion: onApply })));
  return container;
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('shows nothing when there is nothing to suggest or warn', () => {
  assert.equal(render([], []).querySelector('[data-testid="budget-insights"]'), null);
});

test('shows the pace warnings and the suggested ceiling with the average behind it', () => {
  const page = render([suggestion()], [alert]);
  assert.match(page.textContent ?? '', /já gastou 70% do teto e o mês está em 40%/);
  assert.match(page.textContent ?? '', /Média de R\$\s?900,00 em 3 meses · sem teto/);
  assert.match(page.textContent ?? '', /Definir teto de R\$\s?990,00/);
});

test('applying a suggestion routes the chosen category and value', async () => {
  const applied: Array<[string, number]> = [];
  const page = render([suggestion(), suggestion({ categoryId: 'cat-lazer', categoryName: 'Lazer', suggestedBudget: 330 })], [], (s) => applied.push([s.categoryId, s.suggestedBudget]));
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="budget-suggestion-cat-lazer"] button')?.click(); });
  assert.deepEqual(applied, [['cat-lazer', 330]]);
});

test('limits how many suggestions are shown at once', () => {
  const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => suggestion({ categoryId: id, categoryName: `Categoria ${id}` }));
  const page = render(many, []);
  assert.equal(page.querySelectorAll('li').length, 4);
  assert.match(page.textContent ?? '', /\+2 outras/);
});
