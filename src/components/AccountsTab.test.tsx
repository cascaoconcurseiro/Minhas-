import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { BankAccount, Category, Transaction } from '../types/finance';
import { AccountsTab } from './AccountsTab';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let originalConfirm: typeof window.confirm | null = null;

const existingAccount: BankAccount = {
  id: 'account-synthetic',
  name: 'Conta sintética',
  institution: 'Banco de teste',
  type: 'checking',
  initialBalance: 100,
  currency: 'BRL',
  color: '#059669',
  includeInTotal: true,
};

function renderAccountsTab(options: {
  accounts?: BankAccount[];
  onAddAccount?: (account: Omit<BankAccount, 'id'>) => BankAccount | void;
  onUpdateAccount?: (account: BankAccount) => void;
  onDeleteAccount?: (accountId: string) => void;
}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      React.createElement(AccountsTab, {
        selectedMonth: '2026-11',
        accounts: options.accounts ?? [],
        accountBalances: [],
        categories: [] as Category[],
        transactions: [] as Transaction[],
        onToggleAccountInTotal: () => {},
        onAddAccount: options.onAddAccount ?? (() => {}),
        onUpdateAccount: options.onUpdateAccount,
        onDeleteAccount: options.onDeleteAccount,
        onUpdateAccountInitialBalance: () => {},
        onToggleTransactionStatus: () => {},
        onEditTransaction: () => {},
        onDeleteTransaction: () => {},
        onOpenNewTransaction: () => {},
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
  if (originalConfirm) window.confirm = originalConfirm;
  originalConfirm = null;
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('AccountsTab validates and creates a checking account with a parsed synthetic balance', async () => {
  let createdAccount: Omit<BankAccount, 'id'> | null = null;
  const page = renderAccountsTab({ onAddAccount: (account) => { createdAccount = account; } });
  const openFormButton = page.querySelector<HTMLButtonElement>('[data-testid="open-new-account-btn"]');
  assert.ok(openFormButton);

  await act(async () => { openFormButton.click(); });
  const form = page.querySelector<HTMLFormElement>('[data-testid="account-create-edit-form"]');
  assert.ok(form);
  const nameInput = page.querySelector<HTMLInputElement>('[data-testid="account-form-name-input"]');
  const textInputs = form.querySelectorAll<HTMLInputElement>('input[type="text"]');
  assert.ok(nameInput);
  assert.ok(textInputs.length >= 3);
  const initialBalanceInput = textInputs[2];
  assert.ok(initialBalanceInput);

  await act(async () => {
    setInputValue(initialBalanceInput, '1.234,56');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.match(page.textContent ?? '', /Informe o nome da conta ou carteira/);
  assert.equal(createdAccount, null, 'nome vazio não deve criar uma conta');

  await act(async () => {
    setInputValue(nameInput, '  Conta Teste  ');
    setInputValue(textInputs[1]!, '  Banco Sintético  ');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });

  assert.deepEqual(createdAccount, {
    name: 'Conta Teste',
    institution: 'Banco Sintético',
    type: 'checking',
    currency: 'BRL',
    initialBalance: 1234.56,
    initialBalanceForeign: undefined,
    color: '#059669',
    includeInTotal: true,
  });
});

test('AccountsTab updates an existing synthetic account and preserves its id', async () => {
  const captured = { updatedAccounts: [] as BankAccount[] };
  const page = renderAccountsTab({
    accounts: [existingAccount],
    onUpdateAccount: (account) => { captured.updatedAccounts.push(account); },
  });
  const editButton = page.querySelector<HTMLButtonElement>(
    `[aria-label="Editar conta ${existingAccount.name}"]`
  );
  assert.ok(editButton);

  await act(async () => { editButton.click(); });
  const form = page.querySelector<HTMLFormElement>('[data-testid="account-create-edit-form"]');
  const nameInput = page.querySelector<HTMLInputElement>('[data-testid="account-form-name-input"]');
  assert.ok(form && nameInput);
  const saveButton = page.querySelector<HTMLButtonElement>('[data-testid="save-account-form-btn"]');
  assert.ok(saveButton);

  await act(async () => {
    setInputValue(nameInput, 'Conta atualizada');
    saveButton.click();
  });

  assert.equal(captured.updatedAccounts.length, 1);
  assert.equal(captured.updatedAccounts[0]?.id, existingAccount.id);
  assert.equal(captured.updatedAccounts[0]?.name, 'Conta atualizada');
  assert.equal(captured.updatedAccounts[0]?.initialBalance, existingAccount.initialBalance);
});

test('AccountsTab requires confirmation before routing account deletion', async () => {
  let deletedAccountId = '';
  originalConfirm = window.confirm;
  window.confirm = () => true;
  const page = renderAccountsTab({
    accounts: [existingAccount],
    onDeleteAccount: (accountId) => { deletedAccountId = accountId; },
  });
  const deleteButton = page.querySelector<HTMLButtonElement>(
    `[aria-label="Excluir conta ${existingAccount.name}"]`
  );
  assert.ok(deleteButton);

  await act(async () => { deleteButton.click(); });
  assert.equal(deletedAccountId, existingAccount.id);
});

test('AccountsTab does not delete an account when confirmation is canceled', async () => {
  let deletedAccountId = '';
  originalConfirm = window.confirm;
  window.confirm = () => false;
  const page = renderAccountsTab({
    accounts: [existingAccount],
    onDeleteAccount: (accountId) => { deletedAccountId = accountId; },
  });
  const deleteButton = page.querySelector<HTMLButtonElement>(
    `[aria-label="Excluir conta ${existingAccount.name}"]`
  );
  assert.ok(deleteButton);

  await act(async () => { deleteButton.click(); });

  assert.equal(deletedAccountId, '');
});
