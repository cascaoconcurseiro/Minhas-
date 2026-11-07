import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { CreateTransactionBatchInput } from '../utils/financeRules';
import type { BankAccount, Category, CreditCard } from '../types/finance';
import { TransactionModal } from './TransactionModal';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderTransactionModal(
  onSaveBatch: (input: CreateTransactionBatchInput) => void,
  onClose: () => void,
  options: { accounts?: BankAccount[]; cards?: CreditCard[]; categories?: Category[] } = {}
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
  const cards = options.cards ?? [];

  act(() => {
    root?.render(
      React.createElement(TransactionModal, {
        isOpen: true,
        onClose,
        onSaveBatch,
        accounts: options.accounts ?? [account],
        cards,
        categories: options.categories ?? [category],
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

const incomeCategory: Category = {
  id: 'income-category-test',
  name: 'Salário',
  type: 'income',
  bucket: 'financial',
  monthlyBudget: 0,
  color: '#16a34a',
  icon: 'wallet',
  subcategories: [],
};

const secondAccount: BankAccount = {
  id: 'account-destination-test',
  name: 'Conta destino sintética',
  institution: 'Banco de teste',
  type: 'savings',
  initialBalance: 0,
  color: '#000000',
  includeInTotal: true,
};

const testCard: CreditCard = {
  id: 'card-test',
  name: 'Cartão sintético',
  brand: 'Visa',
  limit: 5000,
  closingDay: 20,
  dueDay: 5,
  defaultAccountId: 'account-test',
  color: '#000000',
};

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

test('expense category, subcategory and account selectors have associated labels', () => {
  const page = renderTransactionModal(() => {}, () => {});
  for (const id of ['tx-category-select', 'tx-subcategory-select', 'tx-payment-source-select']) {
    const field = page.querySelector<HTMLElement>(`#${id}`);
    assert.ok(field, `expected field #${id}`);
    assert.ok(Array.from(page.querySelectorAll('label')).some((label) => label.control === field), `expected an associated label for #${id}`);
  }
});

test('transaction modal submits the date selected in the date control', async () => {
  const saved: CreateTransactionBatchInput[] = [];
  const page = renderTransactionModal((input) => saved.push(input), () => {});
  const date = page.querySelector<HTMLInputElement>('[data-testid="tx-date-input"]');
  assert.ok(date);
  assert.equal(date.value, '2026-11-15');

  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-description-input"]')!, 'Compra com data sintética');
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-amount-input"]')!, '5,00');
    setInputValue(date, '2026-11-07');
    assert.equal(date.value, '2026-11-07');
    page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]')?.click();
  });

  assert.equal(saved.length, 1);
  assert.equal(saved[0].date, '2026-11-07');
  assert.equal(saved[0].competenceMonth, '2026-11');
});

test('income mode persists the selected category, pending status and fixed-month schedule', async () => {
  const saved: CreateTransactionBatchInput[] = [];
  const page = renderTransactionModal((input) => saved.push(input), () => {}, {
    categories: [
      {
        id: 'category-test', name: 'Alimentação', type: 'expense', bucket: 'essential',
        monthlyBudget: 300, color: '#16a34a', icon: 'utensils', subcategories: [],
      },
      incomeCategory,
    ],
    accounts: [
      {
        id: 'account-test', name: 'Conta sintética', institution: 'Banco de teste',
        type: 'checking', initialBalance: 0, color: '#000000', includeInTotal: true,
      },
    ],
  });

  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="mode-income-btn"]')?.click();
    page.querySelector<HTMLButtonElement>('[data-testid="recurrence-fixed-btn"]')?.click();
  });
  const months = page.querySelector<HTMLSelectElement>('[data-testid="main-recurrence-selector"] select');
  assert.ok(months);
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set?.call(months, '12');
    months.dispatchEvent(new window.Event('change', { bubbles: true }));
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-description-input"]')!, 'Salário sintético');
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-amount-input"]')!, '2500,00');
    [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('A Receber'))?.click();
  });
  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]')?.click();
  });

  assert.equal(saved.length, 1);
  assert.equal(saved[0].type, 'income');
  assert.equal(saved[0].categoryId, incomeCategory.id);
  assert.equal(saved[0].amount, 2500);
  assert.equal(saved[0].status, 'pending');
  assert.equal(saved[0].recurrence, 'fixed');
  assert.equal(saved[0].fixedMonthsCount, 12);
  assert.equal(saved[0].accountId, 'account-test');
});

test('credit-card purchase creates pending installments tied to the chosen card', async () => {
  const saved: CreateTransactionBatchInput[] = [];
  const page = renderTransactionModal((input) => saved.push(input), () => {}, { cards: [testCard] });
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="mode-credit-card-btn"]')?.click(); });
  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="recurrence-installment-btn"]')?.click();
  });
  const selects = [...page.querySelectorAll<HTMLSelectElement>('select')];
  const installmentCount = selects.find((select) => [...select.options].some((option) => option.value === '3'));
  assert.ok(installmentCount);
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set?.call(installmentCount, '3');
    installmentCount.dispatchEvent(new window.Event('change', { bubbles: true }));
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-description-input"]')!, 'Notebook sintético');
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-amount-input"]')!, '3.000,00');
  });
  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]')?.click();
  });

  assert.equal(saved.length, 1);
  assert.equal(saved[0].type, 'expense');
  assert.equal(saved[0].status, 'pending');
  assert.equal(saved[0].creditCardId, testCard.id);
  assert.equal(saved[0].paymentMethod, 'credit_card');
  assert.equal(saved[0].recurrence, 'installment');
  assert.equal(saved[0].installmentTotal, 3);
  assert.equal(saved[0].accountId, undefined);
});

test('bank transfer rejects same source and destination, then submits both distinct accounts', async () => {
  const saved: CreateTransactionBatchInput[] = [];
  const accounts = [
    {
      id: 'account-test', name: 'Conta origem sintética', institution: 'Banco teste',
      type: 'checking' as const, initialBalance: 0, color: '#000000', includeInTotal: true,
    },
    secondAccount,
  ];
  const page = renderTransactionModal((input) => saved.push(input), () => {}, { accounts });
  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="mode-transfer-btn"]')?.click();
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-description-input"]')!, 'Transferência sintética');
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-amount-input"]')!, '50,00');
    const destination = page.querySelector<HTMLSelectElement>('#tx-transfer-destination-select');
    assert.ok(destination);
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set?.call(destination, 'account-test');
    destination.dispatchEvent(new window.Event('change', { bubbles: true }));
    page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]')?.click();
  });
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /contas de origem e destino diferentes/);
  assert.equal(saved.length, 0);

  await act(async () => {
    const destination = page.querySelector<HTMLSelectElement>('#tx-transfer-destination-select');
    assert.ok(destination);
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set?.call(destination, secondAccount.id);
    destination.dispatchEvent(new window.Event('change', { bubbles: true }));
    page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]')?.click();
  });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].type, 'transfer');
  assert.equal(saved[0].accountId, 'account-test');
  assert.equal(saved[0].destinationAccountId, secondAccount.id);
  assert.equal(saved[0].paymentMethod, 'transfer');
});
