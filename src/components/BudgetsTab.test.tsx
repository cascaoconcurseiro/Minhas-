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

function renderBudgetsTab(
  onUpdateCategoryBudget: (categoryId: string, amount: number) => void,
  options: {
    categories?: Category[];
    categoryBreakdown?: CategorySpendItem[];
    onAddCategory?: (next: Omit<Category, 'id'>) => void;
    onUpdateCategory?: (next: Category) => void;
    onDeleteCategory?: (id: string) => void;
    onAddSubcategory?: (categoryId: string, name: string) => void;
    onDeleteSubcategory?: (categoryId: string, subcategoryId: string) => void;
  } = {}
) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      React.createElement(BudgetsTab, {
        selectedMonth: '2026-11',
        categories: options.categories ?? [category],
        categoryBreakdown: options.categoryBreakdown ?? [categorySpend],
        transactions: [],
        onUpdateCategoryBudget,
        onAddCategory: options.onAddCategory ?? (() => {}),
        onUpdateCategory: options.onUpdateCategory ?? (() => {}),
        onDeleteCategory: options.onDeleteCategory ?? (() => {}),
        onAddSubcategory: options.onAddSubcategory ?? (() => {}),
        onDeleteSubcategory: options.onDeleteSubcategory ?? (() => {}),
      })
    );
  });
  return container;
}

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set?.call(select, value);
  select.dispatchEvent(new window.Event('change', { bubbles: true }));
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('budget view selector wraps on mobile and announces its selected button', async () => {
  const page = renderBudgetsTab(() => {});
  const selector = page.querySelector<HTMLElement>(
    '[role="group"][aria-label="Visualização do orçamento"]'
  );
  assert.ok(selector);
  assert.match(selector.className, /flex-col/);
  assert.match(selector.className, /sm:flex-row/);

  const budgetButton = Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.includes('Orçamentos Mensais & Alertas')
  );
  const categoryButton = Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.includes('Gerenciar Categorias & Subcategorias')
  );
  assert.ok(budgetButton && categoryButton);
  assert.match(budgetButton.className, /min-h-11/);
  assert.match(budgetButton.className, /whitespace-normal/);
  assert.equal(budgetButton.getAttribute('aria-pressed'), 'true');
  assert.equal(categoryButton.getAttribute('aria-pressed'), 'false');

  await act(async () => { categoryButton.click(); });
  assert.equal(budgetButton.getAttribute('aria-pressed'), 'false');
  assert.equal(categoryButton.getAttribute('aria-pressed'), 'true');
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

test('invalid budget input is rejected and inline edit can be canceled without saving', async () => {
  const updates: Array<[string, number]> = [];
  const page = renderBudgetsTab((categoryId, amount) => updates.push([categoryId, amount]));
  const editButton = page.querySelector<HTMLButtonElement>(`[aria-label="Editar teto de ${category.name}"]`);
  assert.ok(editButton);
  await act(async () => { editButton.click(); });
  const amountInput = page.querySelector<HTMLInputElement>(`[aria-label="Novo teto para ${category.name}"]`);
  assert.ok(amountInput);
  const saveButton = page.querySelector<HTMLButtonElement>(`[aria-label="Salvar teto de ${category.name}"]`);
  assert.ok(saveButton);
  for (const invalid of ['não é valor', '12,345', '12.345']) {
    await act(async () => { setInputValue(amountInput, invalid); saveButton.click(); });
    assert.deepEqual(updates, [], `${invalid} must not be rounded and saved`);
    assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /valor válido/);
  }
  assert.ok(page.querySelector(`[aria-label="Novo teto para ${category.name}"]`), 'validation error keeps the row editable');

  const cancelButton = page.querySelector<HTMLButtonElement>(`[aria-label="Cancelar edição do teto de ${category.name}"]`);
  assert.ok(cancelButton);
  await act(async () => { cancelButton.click(); });
  assert.equal(page.querySelector(`[aria-label="Novo teto para ${category.name}"]`), null);
  assert.deepEqual(updates, []);
});

test('category editor rejects a duplicate normalized name without calling create callback', async () => {
  let created = 0;
  const page = renderBudgetsTab(() => {}, {
    onAddCategory: () => { created += 1; },
  });
  const newCategoryButton = Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('Nova Categoria Personalizada'));
  assert.ok(newCategoryButton);
  await act(async () => { newCategoryButton.click(); });
  const form = page.querySelector<HTMLFormElement>('form');
  const nameInput = page.querySelector<HTMLInputElement>('#cat-editor-name');
  assert.ok(form && nameInput);
  await act(async () => {
    setInputValue(nameInput, '  MORADIA sintética  ');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });

  assert.equal(created, 0);
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /já existe uma categoria/i);
  assert.ok(page.querySelector('#cat-editor-name'), 'duplicate validation leaves the editor open');
});

test('category create saves selected type, bucket, color, icon, budget and initial subcategories', async () => {
  const created: Array<Omit<Category, 'id'>> = [];
  const page = renderBudgetsTab(() => {}, { onAddCategory: (next) => { created.push(next); } });
  const newButton = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Nova Categoria Personalizada'));
  assert.ok(newButton);
  await act(async () => { newButton.click(); });
  const name = page.querySelector<HTMLInputElement>('#cat-editor-name');
  const form = page.querySelector<HTMLFormElement>('form');
  assert.ok(name && form);
  await act(async () => {
    setInputValue(name, 'Viagem sintética');
    setInputValue(page.querySelector<HTMLInputElement>('#cat-editor-budget')!, '850,50');
    setSelectValue(page.querySelector<HTMLSelectElement>('#cat-editor-bucket')!, 'lifestyle');
    setInputValue(page.querySelector<HTMLInputElement>('#cat-editor-subs')!, 'Passagens, Hospedagem');
    page.querySelector<HTMLButtonElement>('[aria-label="Cor Azul Oceano"]')?.click();
    page.querySelector<HTMLButtonElement>('[aria-label^="Ícone"]')?.click();
  });
  const colorChoice = page.querySelector<HTMLButtonElement>('[aria-label="Cor Azul Oceano"]');
  assert.ok(colorChoice);
  await act(async () => {
    colorChoice.click();
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.equal(created.length, 1);
  assert.deepEqual(created[0], {
    name: 'Viagem sintética', type: 'expense', bucket: 'lifestyle', monthlyBudget: 850.5,
    color: '#0284c7', icon: 'home', subcategories: [
      { id: created[0]?.subcategories[0]?.id, name: 'Passagens' },
      { id: created[0]?.subcategories[1]?.id, name: 'Hospedagem' },
    ],
  });
  assert.equal(page.querySelector('form'), null);
});

test('category edit updates category and delete routes the selected category id', async () => {
  const updates: Category[] = [];
  const deletions: string[] = [];
  const page = renderBudgetsTab(() => {}, {
    onUpdateCategory: (next) => updates.push(next),
    onDeleteCategory: (id) => deletions.push(id),
  });
  const manager = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Gerenciar Categorias & Subcategorias'));
  assert.ok(manager);
  await act(async () => { manager.click(); });
  await act(async () => { page.querySelector<HTMLButtonElement>(`[aria-label="Editar categoria ${category.name}"]`)!.click(); });
  const form = page.querySelector<HTMLFormElement>('form');
  assert.ok(form);
  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('#cat-editor-name')!, 'Moradia editada');
    setSelectValue(page.querySelector<HTMLSelectElement>('#cat-editor-bucket')!, 'financial');
    setInputValue(page.querySelector<HTMLInputElement>('#cat-editor-subs')!, 'Condomínio');
    page.querySelector<HTMLButtonElement>('[aria-label="Cor Azul Oceano"]')!.click();
  });
  await act(async () => { form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); });
  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.id, category.id);
  assert.equal(updates[0]?.name, 'Moradia editada');
  assert.equal(updates[0]?.bucket, 'financial');
  assert.equal(updates[0]?.color, '#0284c7');
  assert.deepEqual(updates[0]?.subcategories?.map((sub) => sub.name), ['Condomínio']);
  await act(async () => { page.querySelector<HTMLButtonElement>(`[aria-label="Excluir categoria ${category.name}"]`)!.click(); });
  assert.deepEqual(deletions, [category.id]);
});

test('category manager switches expense/income tabs and routes add/remove subcategory actions', async () => {
  const income: Category = { ...category, id: 'category-income-synthetic', name: 'Salário sintético', type: 'income', bucket: 'financial', monthlyBudget: 0 };
  const added: Array<[string, string]> = [];
  const removed: Array<[string, string]> = [];
  const page = renderBudgetsTab(() => {}, {
    categories: [category, income],
    onAddSubcategory: (categoryId, name) => added.push([categoryId, name]),
    onDeleteSubcategory: (categoryId, subcategoryId) => removed.push([categoryId, subcategoryId]),
  });
  const manager = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Gerenciar Categorias & Subcategorias'));
  assert.ok(manager);
  await act(async () => { manager.click(); });
  assert.match(page.textContent ?? '', /Moradia Sintética/);
  assert.doesNotMatch(page.textContent ?? '', /Salário sintético/);
  const incomeTab = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Categorias de Receitas'));
  assert.ok(incomeTab);
  await act(async () => { incomeTab.click(); });
  assert.match(page.textContent ?? '', /Salário sintético/);
  assert.doesNotMatch(page.textContent ?? '', /Moradia Sintética/);

  await act(async () => { incomeTab.click(); });
  const expenseTab = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Categorias de Gastos'));
  assert.ok(expenseTab);
  await act(async () => { expenseTab.click(); });
  const addSub = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('+ Subcategoria'));
  assert.ok(addSub);
  await act(async () => { addSub.click(); });
  const subInput = page.querySelector<HTMLInputElement>(`[aria-label="Nova subcategoria para ${category.name}"]`);
  assert.ok(subInput);
  await act(async () => { setInputValue(subInput, 'Energia sintética'); });
  const addButton = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Adicionar');
  assert.ok(addButton);
  await act(async () => { addButton.click(); });
  assert.deepEqual(added, [[category.id, 'Energia sintética']]);

  const categoryWithSub = { ...category, subcategories: [{ id: 'sub-synthetic', name: 'Energia sintética' }] };
  const pageWithSub = renderBudgetsTab(() => {}, { categories: [categoryWithSub], onDeleteSubcategory: (categoryId, subId) => removed.push([categoryId, subId]) });
  const manager2 = Array.from(pageWithSub.querySelectorAll('button')).find((button) => button.textContent?.includes('Gerenciar Categorias & Subcategorias'));
  assert.ok(manager2);
  await act(async () => { manager2.click(); });
  await act(async () => { pageWithSub.querySelector<HTMLButtonElement>('[aria-label="Remover subcategoria Energia sintética"]')!.click(); });
  assert.deepEqual(removed, [[category.id, 'sub-synthetic']]);
});

test('income category type hides expense-only fields and saves as income with zero budget', async () => {
  const created: Array<Omit<Category, 'id'>> = [];
  const page = renderBudgetsTab(() => {}, { onAddCategory: (next) => { created.push(next); } });
  await act(async () => {
    Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Nova Categoria Personalizada'))!.click();
  });
  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('#cat-editor-name')!, 'Renda sintética');
    setSelectValue(page.querySelector<HTMLSelectElement>('#cat-editor-type')!, 'income');
  });
  assert.equal(page.querySelector('#cat-editor-budget'), null);
  assert.equal(page.querySelector('#cat-editor-bucket'), null);
  await act(async () => { page.querySelector<HTMLFormElement>('form')!.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); });
  assert.equal(created.length, 1);
  assert.equal(created[0]?.type, 'income');
  assert.equal(created[0]?.bucket, 'financial');
  assert.equal(created[0]?.monthlyBudget, 0);
});

test('monthly budget bucket filters show only matching synthetic category rows', async () => {
  const lifestyle: CategorySpendItem = { ...categorySpend, categoryId: 'cat-life', categoryName: 'Lazer sintético', bucket: 'lifestyle' };
  const financial: CategorySpendItem = { ...categorySpend, categoryId: 'cat-finance', categoryName: 'Reserva sintética', bucket: 'financial' };
  const page = renderBudgetsTab(() => {}, { categoryBreakdown: [categorySpend, lifestyle, financial] });
  assert.match(page.textContent ?? '', /Moradia Sintética/);
  assert.match(page.textContent ?? '', /Lazer sintético/);
  assert.match(page.textContent ?? '', /Reserva sintética/);
  const lifestyleFilter = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Estilo de Vida (30%)');
  assert.ok(lifestyleFilter);
  await act(async () => { lifestyleFilter.click(); });
  assert.match(page.textContent ?? '', /Lazer sintético/);
  assert.doesNotMatch(page.textContent ?? '', /Moradia Sintética/);
  assert.doesNotMatch(page.textContent ?? '', /Reserva sintética/);
  const allFilter = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Todas');
  assert.ok(allFilter);
  await act(async () => { allFilter.click(); });
  assert.match(page.textContent ?? '', /Moradia Sintética/);
  assert.match(page.textContent ?? '', /Lazer sintético/);
  assert.match(page.textContent ?? '', /Reserva sintética/);
});
