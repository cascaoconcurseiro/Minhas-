import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { CreateTransactionBatchInput } from '../utils/financeRules';
import type { BankAccount, Category } from '../types/finance';
import { TransactionModal } from './TransactionModal';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderTransactionModal(
  onSaveBatch: (input: CreateTransactionBatchInput) => void,
  onClose: () => void
) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const account: BankAccount = {
    id: 'account-test',
    name: 'Conta sintética',
    institution: 'Banco de teste',
    type: 'checking',
    initialBalance: 0,
    color: '#000000',
    includeInTotal: true,
  };
  const category: Category = {
    id: 'category-test',
    name: 'Alimentação',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 300,
    color: '#16a34a',
    icon: 'utensils',
    subcategories: [{ id: 'subcategory-test', name: 'Mercado' }],
  };

  act(() => {
    root?.render(
      React.createElement(TransactionModal, {
        isOpen: true,
        onClose,
        onSaveBatch,
        accounts: [account],
        cards: [],
        categories: [category],
        categoryBreakdown: [],
        transactions: [],
        familyMembers: [],
        selectedMonth: '2026-11',
        editingTransaction: null,
        defaultMode: 'expense',
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

test('transaction modal rejects zero amount and saves a valid synthetic expense', async () => {
  const savedInputs: CreateTransactionBatchInput[] = [];
  let closeCount = 0;
  const page = renderTransactionModal(
    (input) => { savedInputs.push(input); },
    () => { closeCount += 1; }
  );

  const description = page.querySelector<HTMLInputElement>('[data-testid="tx-description-input"]');
  const amount = page.querySelector<HTMLInputElement>('[data-testid="tx-amount-input"]');
  const submit = page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]');
  assert.ok(description && amount && submit);
  assert.match(page.textContent ?? '', /Valor do Lançamento/);

  await act(async () => {
    setInputValue(description, '  Compra sintética  ');
    setInputValue(amount, '0,00');
    submit.click();
  });
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /Informe um valor válido maior que zero/);
  assert.equal(savedInputs.length, 0);
  assert.equal(closeCount, 0);

  await act(async () => {
    setInputValue(amount, '12,34');
    submit.click();
  });

  assert.equal(savedInputs.length, 1);
  const saved = savedInputs[0];
  assert.equal(saved.description, 'Compra sintética');
  assert.equal(saved.amount, 12.34);
  assert.equal(saved.type, 'expense');
  assert.equal(saved.status, 'paid');
  assert.equal(saved.categoryId, 'category-test');
  assert.equal(saved.subcategoryId, 'subcategory-test');
  assert.equal(saved.accountId, 'account-test');
  assert.equal(saved.paymentMethod, 'pix');
  assert.equal(closeCount, 1);
});
