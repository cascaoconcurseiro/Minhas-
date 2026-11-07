import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { BankAccount, Category, Transaction } from '../types/finance';
import { TransactionsTab } from './TransactionsTab';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let originalConfirm: typeof window.confirm;

const account: BankAccount = {
  id: 'account-synthetic',
  name: 'Conta sintética',
  institution: 'Banco de teste',
  type: 'checking',
  initialBalance: 0,
  color: '#000000',
  includeInTotal: true,
};

const category: Category = {
  id: 'category-synthetic',
  name: 'Alimentação',
  type: 'expense',
  bucket: 'essential',
  monthlyBudget: 100,
  color: '#16a34a',
  icon: 'utensils',
  subcategories: [],
};

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-synthetic',
    description: 'Compra sintética',
    amount: 12.34,
    date: '2026-11-03',
    competenceMonth: '2026-11',
    type: 'expense',
    status: 'paid',
    categoryId: category.id,
    accountId: account.id,
    paymentMethod: 'cash',
    recurrence: 'single',
    ...overrides,
  };
}

function renderTransactionsTab(
  transaction: Transaction | Transaction[],
  onEditTransaction: (tx: Transaction) => void,
  onDeleteTransaction: (txId: string, deleteGroup?: boolean) => void,
  onBatchSettleTransactions?: (txIds: string[]) => void | Promise<void>,
  callbacks: {
    onToggleStatus?: (txId: string) => void;
    onDuplicateTransaction?: (tx: Transaction) => void;
    onOpenNewTransaction?: (mode: 'expense' | 'credit_card' | 'income' | 'transfer') => void;
  } = {}
) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      React.createElement(TransactionsTab, {
        selectedMonth: '2026-11',
        transactions: Array.isArray(transaction) ? transaction : [transaction],
        accounts: [account],
        cards: [],
        categories: [category],
        requestedViewMode: 'table',
        onConsumeRequestedViewMode: () => {},
        onToggleStatus: callbacks.onToggleStatus ?? (() => {}),
        onBatchSettleTransactions,
        onEditTransaction,
        onDeleteTransaction,
        onOpenNewTransaction: callbacks.onOpenNewTransaction ?? (() => {}),
        onDuplicateTransaction: callbacks.onDuplicateTransaction,
      })
    );
  });
  return container;
}

beforeEach(() => {
  originalConfirm = window.confirm;
});

test('TransactionsTab preserves selected payments when batch persistence rejects', async () => {
  const transaction = makeTransaction({ status: 'pending' });
  let settleAttempts = 0;
  const page = renderTransactionsTab(transaction, () => {}, () => {}, async (ids) => {
    settleAttempts += 1;
    assert.deepEqual(ids, [transaction.id]);
    throw new Error('Falha sintética do Neon');
  });

  const reconcileButton = [...page.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Modo Conferência em Lote')
  );
  assert.ok(reconcileButton);
  await act(async () => { reconcileButton.click(); });
  const checkbox = page.querySelector<HTMLInputElement>(
    `[aria-label="Selecionar ${transaction.description}"]`
  );
  assert.ok(checkbox);
  await act(async () => { checkbox.click(); });

  const settleButton = page.querySelector<HTMLButtonElement>('[data-testid="batch-settle-btn"]');
  assert.ok(settleButton);
  await act(async () => { settleButton.click(); });

  assert.equal(settleAttempts, 1);
  assert.match(page.textContent ?? '', /Selecionados:\s*1/);
  assert.equal(checkbox.checked, true);
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  window.confirm = originalConfirm;
});

test('TransactionsTab renders the synthetic row and sends that transaction to the edit callback', async () => {
  const transaction = makeTransaction();
  let edited: Transaction | null = null;
  const page = renderTransactionsTab(transaction, (tx) => { edited = tx; }, () => {});
  const editButton = page.querySelector<HTMLButtonElement>(
    `[aria-label="Editar ${transaction.description}"]`
  );
  assert.ok(editButton);

  await act(async () => { editButton.click(); });
  assert.equal(edited, transaction);
});

test('TransactionsTab asks before deleting one transaction and respects cancel or confirm', async () => {
  const transaction = makeTransaction();
  const confirmations: string[] = [];
  let accepted = false;
  window.confirm = (message?: string) => {
    confirmations.push(message ?? '');
    return accepted;
  };
  const deleted: Array<[string, boolean | undefined]> = [];
  const page = renderTransactionsTab(transaction, () => {}, (id, group) => {
    deleted.push([id, group]);
  });
  const deleteButton = page.querySelector<HTMLButtonElement>(
    `[aria-label="Excluir ${transaction.description}"]`
  );
  assert.ok(deleteButton);

  await act(async () => { deleteButton.click(); });
  assert.match(confirmations[0] ?? '', /Excluir o lançamento "Compra sintética"/);
  assert.deepEqual(deleted, [], 'cancelar deve impedir a chamada do callback');

  accepted = true;
  await act(async () => { deleteButton.click(); });
  assert.deepEqual(deleted, [['tx-synthetic', false]]);
});

test('TransactionsTab identifies the full installment series before invoking grouped deletion', async () => {
  const transaction = makeTransaction({
    id: 'tx-installment-1',
    description: 'Notebook parcelado',
    installmentGroupId: 'installment-group-synthetic',
    installmentNumber: 1,
    installmentTotal: 3,
    recurrence: 'installment',
  });
  let confirmationMessage = '';
  window.confirm = (message?: string) => {
    confirmationMessage = message ?? '';
    return true;
  };
  const deleted: Array<[string, boolean | undefined]> = [];
  const page = renderTransactionsTab(transaction, () => {}, (id, group) => {
    deleted.push([id, group]);
  });
  const deleteButton = page.querySelector<HTMLButtonElement>(
    `[aria-label="Excluir ${transaction.description}"]`
  );
  assert.ok(deleteButton);

  await act(async () => { deleteButton.click(); });
  assert.match(confirmationMessage, /todas as parcelas da série "Notebook parcelado"/);
  assert.deepEqual(deleted, [['tx-installment-1', true]]);
});

test('TransactionsTab routes quick actions to expense, card purchase, and income modes', async () => {
  const openedModes: string[] = [];
  const page = renderTransactionsTab(makeTransaction(), () => {}, () => {}, undefined, {
    onOpenNewTransaction: (mode) => openedModes.push(mode),
  });
  const quickAction = (label: string) => [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === label);

  await act(async () => { quickAction('Lançar Despesa')?.click(); });
  await act(async () => { quickAction('+ Compra Parcelada')?.click(); });
  await act(async () => { quickAction('+ Receita')?.click(); });

  assert.deepEqual(openedModes, ['expense', 'credit_card', 'income']);
});

test('TransactionsTab type filter shows only incomes and the row status action reaches its callback', async () => {
  const expense = makeTransaction({ id: 'expense-filter-test', description: 'Despesa filtrável' });
  const income: Transaction = {
    ...makeTransaction({ id: 'income-filter-test', description: 'Receita filtrável', type: 'income' }),
    categoryId: 'income-category-test',
  };
  const toggled: string[] = [];
  let duplicated: Transaction | null = null;
  const page = renderTransactionsTab([expense, income], () => {}, () => {}, undefined, {
    onToggleStatus: (id) => toggled.push(id),
    onDuplicateTransaction: (tx) => { duplicated = tx; },
  });

  assert.ok(page.querySelector('[aria-label="Editar Despesa filtrável"]'));
  assert.ok(page.querySelector('[aria-label="Editar Receita filtrável"]'));
  const incomesFilter = [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Receitas');
  assert.ok(incomesFilter);
  await act(async () => { incomesFilter.click(); });
  assert.equal(page.querySelector('[aria-label="Editar Despesa filtrável"]'), null);
  assert.ok(page.querySelector('[aria-label="Editar Receita filtrável"]'));

  await act(async () => {
    page.querySelector<HTMLButtonElement>('[aria-label="Alternar situação de Receita filtrável"]')?.click();
    page.querySelector<HTMLButtonElement>('[aria-label="Duplicar Receita filtrável"]')?.click();
  });
  assert.deepEqual(toggled, [income.id]);
  assert.equal(duplicated, income);
});
