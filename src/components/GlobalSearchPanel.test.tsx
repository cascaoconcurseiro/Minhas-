import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { BankAccount, Category, CreditCard, FamilyMember, Transaction } from '../types/finance';
import { GlobalSearchPanel } from './GlobalSearchPanel';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;

const expenseCategory: Category = { id: 'cat-food', name: 'Alimentação', type: 'expense', bucket: 'essential', monthlyBudget: 0, color: '#059669', icon: 'shopping-cart' };
const incomeCategory: Category = { id: 'cat-income', name: 'Salário', type: 'income', bucket: 'essential', monthlyBudget: 0, color: '#059669', icon: 'wallet' };
const accounts: BankAccount[] = [{ id: 'acc-1', name: 'Conta Sintética', institution: 'Teste', type: 'checking', initialBalance: 0, color: '#059669', includeInTotal: true }];
const cards: CreditCard[] = [{ id: 'card-1', name: 'Cartão Sintético', brand: 'Visa', limit: 1000, closingDay: 20, dueDay: 27, defaultAccountId: 'acc-1', color: '#111827' }];
const members: FamilyMember[] = [{ id: 'member-1', name: 'Pessoa Sintética', relationship: 'amigo(a)', color: '#059669' }];
const transactions: Transaction[] = [
  { id: 'expense-1', description: 'Mercado', amount: 42, date: '2026-11-03', competenceMonth: '2026-11', type: 'expense', status: 'pending', categoryId: expenseCategory.id, paymentMethod: 'pix', recurrence: 'single', accountId: 'acc-1', notes: 'compra para mamãe', tags: ['reembolsavel'] },
  { id: 'income-1', description: 'Salário mensal', amount: 3000, date: '2026-10-01', competenceMonth: '2026-10', type: 'income', status: 'paid', categoryId: incomeCategory.id, paymentMethod: 'pix', recurrence: 'fixed', accountId: 'acc-1', notes: 'PIX empresa' },
  { id: 'card-1-tx', description: 'Compra cartão', amount: 25, date: '2026-11-04', competenceMonth: '2026-11', type: 'expense', status: 'pending', categoryId: expenseCategory.id, paymentMethod: 'credit_card', recurrence: 'single', creditCardId: 'card-1' },
  { id: 'shared-1', description: 'Jantar compartilhado', amount: 50, date: '2026-11-05', competenceMonth: '2026-11', type: 'expense', status: 'paid', categoryId: expenseCategory.id, paymentMethod: 'pix', recurrence: 'single', accountId: 'acc-1', isShared: true, sharedMemberId: 'member-1', sharedAmount: 25 },
];

function renderSearch(options: {
  query?: string;
  transactions?: Transaction[];
  onChangeQuery?: (value: string) => void;
  onClearSearch?: () => void;
  onToggleStatus?: (id: string) => void;
  onEditTransaction?: (tx: Transaction) => void;
  onJumpToTransactionInLedger?: (tx: Transaction) => void;
}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(GlobalSearchPanel, {
    query: options.query ?? 'e',
    onChangeQuery: options.onChangeQuery ?? (() => {}),
    onClearSearch: options.onClearSearch ?? (() => {}),
    selectedMonth: '2026-11',
    transactions: options.transactions ?? transactions,
    categories: [expenseCategory, incomeCategory],
    accounts,
    cards,
    familyMembers: members,
    onToggleStatus: options.onToggleStatus ?? (() => {}),
    onEditTransaction: options.onEditTransaction ?? (() => {}),
    onJumpToTransactionInLedger: options.onJumpToTransactionInLedger ?? (() => {}),
  })));
  return container;
}

function clickButton(page: HTMLElement, label: string) {
  const button = Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find((item) => item.textContent?.includes(label));
  assert.ok(button, `button containing ${label} exists`);
  act(() => button.click());
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('GlobalSearchPanel exercises period, field, and type filters against synthetic results', async () => {
  const page = renderSearch({ query: 'a' });
  assert.equal(page.querySelectorAll('tbody tr').length, 4);

  await act(async () => { clickButton(page, 'Novembro de 2026'); });
  assert.equal(page.querySelectorAll('tbody tr').length, 3);
  await act(async () => { clickButton(page, 'Todos os Meses'); });
  await act(async () => { clickButton(page, 'Descrição'); });
  assert.equal(page.querySelectorAll('tbody tr').length, 4);
  await act(async () => { clickButton(page, 'Categoria'); });
  assert.equal(page.querySelectorAll('tbody tr').length, 4);
  await act(async () => { clickButton(page, 'Nota'); });
  assert.equal(page.querySelectorAll('tbody tr').length, 2);
  await act(async () => { clickButton(page, 'Todos os Campos'); });

  for (const type of ['Despesas Conta', 'Cartão', 'Receitas', 'Compartilhados', 'Todos']) {
    await act(async () => { clickButton(page, type); });
    assert.ok(page.querySelector('[aria-label="Resultados da Busca Global"]'));
  }
});

test('GlobalSearchPanel routes clear, tag, status, edit, and ledger actions to the expected callbacks', async () => {
  let cleared = 0;
  const queryChanges: string[] = [];
  const toggled: string[] = [];
  const edited: string[] = [];
  const jumped: string[] = [];
  const page = renderSearch({
    onClearSearch: () => { cleared += 1; },
    onChangeQuery: (value) => queryChanges.push(value),
    onToggleStatus: (id) => toggled.push(id),
    onEditTransaction: (tx) => edited.push(tx.id),
    onJumpToTransactionInLedger: (tx) => jumped.push(tx.id),
  });

  const tagButton = Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('reembolsavel'));
  assert.ok(tagButton);
  await act(async () => { tagButton.click(); });
  assert.equal(queryChanges.at(-1), '#reembolsavel');

  const statusButton = page.querySelector<HTMLButtonElement>('[aria-label="Efetivar Mercado"]');
  assert.ok(statusButton);
  await act(async () => { statusButton.click(); });
  assert.deepEqual(toggled, ['expense-1']);

  const editButton = page.querySelector<HTMLButtonElement>('[aria-label="Editar Mercado"]');
  const ledgerButton = page.querySelector<HTMLButtonElement>('[aria-label="Ver Mercado no extrato"]');
  assert.ok(editButton && ledgerButton);
  await act(async () => { editButton.click(); ledgerButton.click(); });
  assert.deepEqual(edited, ['expense-1']);
  assert.deepEqual(jumped, ['expense-1']);
  await act(async () => { clickButton(page, 'Fechar Busca'); });
  assert.equal(cleared, 1);
});

test('GlobalSearchPanel exposes both recovery filters and examples when no result matches', async () => {
  const queryChanges: string[] = [];
  let clearCalls = 0;
  const page = renderSearch({ query: 'not-found', onChangeQuery: (value) => queryChanges.push(value), onClearSearch: () => { clearCalls += 1; } });
  await act(async () => { clickButton(page, 'Novembro de 2026'); });
  await act(async () => { clickButton(page, 'Categoria'); });
  assert.match(page.textContent ?? '', /Nenhuma transação encontrada/);
  await act(async () => { clickButton(page, 'Buscar em Todos os Meses'); });
  await act(async () => { clickButton(page, 'Buscar em Todos os Campos'); });
  await act(async () => { clickButton(page, 'Testar "Saúde"'); });
  await act(async () => { clickButton(page, 'Testar nota "mamãe"'); });
  assert.deepEqual(queryChanges, ['Saúde', 'mamãe']);
  await act(async () => { clickButton(page, 'Limpar Busca'); });
  assert.equal(clearCalls, 1);
});
