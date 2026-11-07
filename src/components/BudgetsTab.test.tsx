import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { Category, CategorySpendItem } from '../types/finance';
import { BudgetsTab } from './BudgetsTab';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const category: Category = {
  id: 'category-budget-synthetic',
  name: 'Moradia Sintética',
  type: 'expense',
  bucket: 'essential',
  monthlyBudget: 500,
  color: '#16a34a',
  icon: 'home',
  subcategories: [],
};

const categorySpend: CategorySpendItem = {
  categoryId: category.id,
  categoryName: category.name,
  categoryColor: category.color,
  categoryIcon: category.icon,
  bucket: category.bucket,
  spent: 125,
  realizedSpent: 125,
  pendingSpent: 0,
  budget: category.monthlyBudget,
  percentOfBudget: 25,
  percentOfTotalExpense: 100,
  status: 'ok',
  subcategoryBreakdown: [],
};

function renderBudgetsTab(onUpdateCategoryBudget: (categoryId: string, amount: number) => void) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      React.createElement(BudgetsTab, {
        selectedMonth: '2026-11',
        categories: [category],
        categoryBreakdown: [categorySpend],
        transactions: [],
        onUpdateCategoryBudget,
        onAddCategory: () => {},
        onUpdateCategory: () => {},
        onDeleteCategory: () => {},
        onAddSubcategory: () => {},
        onDeleteSubcategory: () => {},
      })
    );
  });
  return container;
}

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('BudgetsTab edits a monthly budget and parses a Brazilian currency amount', async () => {
  const updates: Array<[string, number]> = [];
  const page = renderBudgetsTab((categoryId, amount) => updates.push([categoryId, amount]));
  const editButton = page.querySelector<HTMLButtonElement>(
    `[aria-label="Editar teto de ${category.name}"]`
  );
  assert.ok(editButton);

  await act(async () => { editButton.click(); });
  const amountInput = page.querySelector<HTMLInputElement>(
    `[aria-label="Novo teto para ${category.name}"]`
  );
  assert.ok(amountInput);

  await act(async () => {
    setInputValue(amountInput, '1.234,56');
  });
  const saveButton = page.querySelector<HTMLButtonElement>(
    `[aria-label="Salvar teto de ${category.name}"]`
  );
  assert.ok(saveButton);
  await act(async () => { saveButton.click(); });

  assert.deepEqual(updates, [[category.id, 1234.56]]);
  assert.equal(page.querySelector(`[aria-label="Novo teto para ${category.name}"]`), null);
});
