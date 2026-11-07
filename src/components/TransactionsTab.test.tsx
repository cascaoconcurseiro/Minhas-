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
  transaction: Transaction,
  onEditTransaction: (tx: Transaction) => void,
  onDeleteTransaction: (txId: string, deleteGroup?: boolean) => void
) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      React.createElement(TransactionsTab, {
        selectedMonth: '2026-11',
        transactions: [transaction],
        accounts: [account],
        cards: [],
        categories: [category],
        requestedViewMode: 'table',
        onConsumeRequestedViewMode: () => {},
        onToggleStatus: () => {},
        onEditTransaction,
        onDeleteTransaction,
        onOpenNewTransaction: () => {},
      })
    );
  });
  return container;
}

beforeEach(() => {
  originalConfirm = window.confirm;
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
