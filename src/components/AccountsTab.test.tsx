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
let originalAlert: typeof window.alert | null = null;

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
  onToggleAccountInTotal?: (accountId: string) => void;
  onUpdateAccountInitialBalance?: (accountId: string, amount: number) => void;
  onToggleTransactionStatus?: (txId: string) => void;
  onEditTransaction?: (tx: Transaction) => void;
  onDuplicateTransaction?: (tx: Transaction) => void;
  onDeleteTransaction?: (txId: string, deleteGroup?: boolean) => void;
  onOpenNewTransaction?: (mode: 'expense' | 'income' | 'credit_card' | 'transfer') => void;
  onOpenReconciliation?: (accountId?: string) => void;
  transactions?: Transaction[];
  initialSelectedAccountId?: string;
  trips?: import('../types/finance').Trip[];
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
        transactions: options.transactions ?? [],
        trips: options.trips ?? [],
        initialSelectedAccountId: options.initialSelectedAccountId,
        onToggleAccountInTotal: options.onToggleAccountInTotal ?? (() => {}),
        onAddAccount: options.onAddAccount ?? (() => {}),
        onUpdateAccount: options.onUpdateAccount,
        onDeleteAccount: options.onDeleteAccount,
        onUpdateAccountInitialBalance: options.onUpdateAccountInitialBalance ?? (() => {}),
        onToggleTransactionStatus: options.onToggleTransactionStatus ?? (() => {}),
        onEditTransaction: options.onEditTransaction ?? (() => {}),
        onDuplicateTransaction: options.onDuplicateTransaction,
        onDeleteTransaction: options.onDeleteTransaction ?? (() => {}),
        onOpenNewTransaction: options.onOpenNewTransaction ?? (() => {}),
        onOpenReconciliation: options.onOpenReconciliation,
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
  if (originalAlert) window.alert = originalAlert;
  originalConfirm = null;
  originalAlert = null;
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

test('international account separates paid foreign expenses from pending balance impact', async () => {
  const account: BankAccount = {
    id: 'account-usd-synthetic', name: 'Conta USD', institution: 'Banco sintético',
    type: 'international', currency: 'USD', initialBalance: 5000,
    initialBalanceForeign: 1000, color: '#059669', includeInTotal: false,
  };
  const makeExpense = (
    id: string,
    amount: number,
    originalAmount: number,
    status: Transaction['status'],
    competenceMonth = '2026-11'
  ): Transaction => ({
    id, description: `Despesa ${id}`, amount, originalAmount, originalCurrency: 'USD',
    date: `${competenceMonth}-10`, competenceMonth, type: 'expense', status,
    categoryId: 'cat-synthetic', accountId: account.id, paymentMethod: 'debit_card',
    recurrence: 'single',
  });
  const page = renderAccountsTab({
    accounts: [account],
    trips: [{
      currency: 'USD',
      exchangeLots: [
        {
          id: 'future-usd-lot', date: '2026-12-01', currency: 'USD',
          foreignAmount: 40, rateBase: 5, iofPercent: 0,
          effectiveRateBrl: 5, totalBrlPaid: 200,
          sourceLabel: 'Câmbio futuro', accountId: account.id,
        },
        {
          id: 'invalid-usd-lot', date: '2026-10-01', currency: 'USD',
          foreignAmount: Number.NaN, rateBase: 5, iofPercent: 0,
          effectiveRateBrl: 5, totalBrlPaid: 200,
          sourceLabel: 'Câmbio inválido', accountId: account.id,
        },
      ],
    } as unknown as import('../types/finance').Trip],
    transactions: [
      makeExpense('paid-usd', 50, 10, 'paid'),
      makeExpense('pending-usd', 100, 20, 'pending'),
      makeExpense('future-usd', 200, 40, 'pending', '2026-12'),
      {
        ...makeExpense('income-usd', 25, 5, 'paid'),
        type: 'income',
      },
      {
        ...makeExpense('pending-income-usd', 15, 3, 'pending'),
        type: 'income',
      },
    ],
  });
  const accountCard = page.querySelector<HTMLElement>(`[data-testid="account-card-${account.id}"]`);
  assert.ok(accountCard);
  assert.match(accountCard.textContent ?? '', /Saldo na Moeda/);
  assert.match(accountCard.textContent ?? '', /Após pendências/);
  assert.match(accountCard.textContent ?? '', /995/);
  assert.match(accountCard.textContent ?? '', /978/);

  await act(async () => { accountCard.click(); });
  const banner = page.querySelector<HTMLElement>('[data-testid="intl-account-dedicated-banner"]');
  assert.ok(banner);
  assert.match(banner.textContent ?? '', /Gastos realizados/);
  assert.match(banner.textContent ?? '', /Depósitos realizados/);
  assert.match(banner.textContent ?? '', /pendentes/i);
  assert.match(banner.textContent ?? '', /Saldo previsto/);
  assert.match(banner.textContent ?? '', /995/);
  assert.match(banner.textContent ?? '', /978/);
});

test('AccountsTab rejects malformed balance text instead of saving it as zero', async () => {
  let addCalls = 0;
  const page = renderAccountsTab({ onAddAccount: () => { addCalls += 1; } });
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="open-new-account-btn"]')!.click(); });
  const form = page.querySelector<HTMLFormElement>('[data-testid="account-create-edit-form"]');
  assert.ok(form);
  for (const malformed of ['12abc', 'abc0', '0abc', ',', '.', 'R$ ,', '12,345', '12.345']) {
    await act(async () => {
      setInputValue(page.querySelector<HTMLInputElement>('[data-testid="account-form-name-input"]')!, 'Conta de teste');
      setInputValue(page.querySelector<HTMLInputElement>('#account-form-initial-balance-input')!, malformed);
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    });
    assert.equal(addCalls, 0, `${malformed} must not be persisted as zero`);
    assert.match(page.textContent ?? '', /saldo inicial válido/i, `${malformed} should show a validation error`);
    assert.ok(page.querySelector('[data-testid="account-create-edit-form"]'), 'keep the form open so the user can correct the value');
  }
});

test('AccountsTab rejects fractional opening balances for zero-decimal currencies', async () => {
  let addCalls = 0;
  const page = renderAccountsTab({ onAddAccount: () => { addCalls += 1; } });
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="open-new-account-btn"]')!.click(); });
  const form = page.querySelector<HTMLFormElement>('[data-testid="account-create-edit-form"]');
  const typeSelect = page.querySelector<HTMLSelectElement>('[data-testid="account-form-type-select"]');
  assert.ok(form && typeSelect);

  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set?.call(typeSelect, 'international');
    typeSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  const currencySelect = page.querySelector<HTMLSelectElement>('[data-testid="account-form-currency-select"]');
  assert.ok(currencySelect);
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set?.call(currencySelect, 'JPY');
    currencySelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="account-form-name-input"]')!, 'Conta JPY');
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="account-form-initial-foreign-input"]')!, '1,5');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });

  assert.equal(addCalls, 0);
  assert.match(page.textContent ?? '', /até 0 casa\(s\) decimal/);
});

test('AccountsTab accepts a deliberate zero opening balance', async () => {
  const createdAccounts: Array<Omit<BankAccount, 'id'>> = [];
  const page = renderAccountsTab({ onAddAccount: (account) => { createdAccounts.push(account); } });
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="open-new-account-btn"]')!.click(); });
  const form = page.querySelector<HTMLFormElement>('[data-testid="account-create-edit-form"]');
  assert.ok(form);
  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="account-form-name-input"]')!, 'Conta com zero');
    setInputValue(page.querySelector<HTMLInputElement>('#account-form-initial-balance-input')!, '0,00');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.equal(createdAccounts[0]?.initialBalance, 0);
});

test('AccountsTab labels are programmatically associated with every visible create-form field', async () => {
  const page = renderAccountsTab({});
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="open-new-account-btn"]')!.click(); });
  const form = page.querySelector('[data-testid="account-create-edit-form"]');
  assert.ok(form);
  for (const id of ['account-form-type-select', 'account-form-name-input', 'account-form-institution-input', 'account-form-initial-balance-input']) {
    const field = form.querySelector<HTMLElement>(`#${id}`);
    assert.ok(field, `expected field #${id}`);
    assert.ok(Array.from(form.querySelectorAll('label')).some((label) => label.control === field), `expected an associated label for #${id}`);
  }
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

test('AccountsTab blocks an invalid edited opening balance and allows correction', async () => {
  const updatedAccounts: BankAccount[] = [];
  const page = renderAccountsTab({
    accounts: [existingAccount],
    onUpdateAccount: (account) => updatedAccounts.push(account),
  });
  await act(async () => {
    page.querySelector<HTMLButtonElement>(`[aria-label="Editar conta ${existingAccount.name}"]`)!.click();
  });
  const form = page.querySelector<HTMLFormElement>('[data-testid="account-create-edit-form"]');
  const balance = page.querySelector<HTMLInputElement>('#account-form-initial-balance-input');
  assert.ok(form && balance);

  await act(async () => {
    setInputValue(balance, '12abc');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.equal(updatedAccounts.length, 0, 'saldo malformado não deve acionar a edição');
  assert.match(page.textContent ?? '', /saldo inicial válido/i);
  assert.ok(page.querySelector('[data-testid="account-create-edit-form"]'), 'formulário permanece aberto para correção');

  await act(async () => {
    setInputValue(balance, '2.345,67');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.equal(updatedAccounts.length, 1);
  assert.equal(updatedAccounts[0]?.id, existingAccount.id);
  assert.equal(updatedAccounts[0]?.initialBalance, 2345.67);
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

test('AccountsTab blocks deletion when a trip references the account and keeps confirm flow untouched', async () => {
  let deletedAccountId = '';
  let alertMessage = '';
  let confirmCount = 0;
  originalAlert = window.alert;
  originalConfirm = window.confirm;
  window.alert = (message?: string) => { alertMessage = message ?? ''; };
  window.confirm = () => { confirmCount += 1; return true; };
  const page = renderAccountsTab({
    accounts: [existingAccount],
    trips: [{
      id: 'trip-linked',
      name: 'Viagem ligada',
      destination: 'Lisboa',
      startDate: '2026-12-01',
      endDate: '2026-12-10',
      status: 'planning',
      currency: 'EUR',
      defaultExchangeRate: 6,
      budgetForeign: 100,
      participants: [],
      exchangeLots: [{ id: 'lot-linked', date: '2026-12-01', currency: 'EUR', foreignAmount: 10, rateBase: 6, iofPercent: 1.1, effectiveRateBrl: 6.1, totalBrlPaid: 61, sourceLabel: 'Conta ligada', accountId: existingAccount.id }],
      settlements: [],
      coverColor: '#000000',
    }, {
      id: 'trip-account-link',
      name: 'Viagem com conta vinculada',
      destination: 'Porto',
      startDate: '2027-01-01',
      endDate: '2027-01-05',
      status: 'planning',
      currency: 'EUR',
      defaultExchangeRate: 6,
      budgetForeign: 100,
      participants: [],
      exchangeLots: [],
      settlements: [],
      coverColor: '#000000',
      linkedAccountId: existingAccount.id,
    }],
    onDeleteAccount: (accountId) => { deletedAccountId = accountId; },
  });
  const deleteButton = page.querySelector<HTMLButtonElement>(`[aria-label="Excluir conta ${existingAccount.name}"]`);
  assert.ok(deleteButton);
  await act(async () => { deleteButton.click(); });
  assert.match(alertMessage, /Viagem ligada/);
  assert.match(alertMessage, /Viagem com conta vinculada/);
  assert.equal(confirmCount, 0, 'blocked deletion should explain the trip reference before asking for confirmation');
  assert.equal(deletedAccountId, '');
});

test('AccountsTab routes transfer and reconciliation actions to the expected callbacks', async () => {
  const calls: Array<string | undefined> = [];
  const modes: string[] = [];
  const page = renderAccountsTab({
    accounts: [existingAccount],
    onOpenNewTransaction: (mode) => modes.push(mode),
    onOpenReconciliation: (accountId) => calls.push(accountId),
  });
  const transfer = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Transferir entre Contas'));
  const reconcileAll = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Importar Extrato / OFX'));
  assert.ok(transfer && reconcileAll);
  await act(async () => { transfer.click(); reconcileAll.click(); });
  assert.deepEqual(modes, ['transfer']);
  assert.deepEqual(calls, [undefined]);

  const accountCard = page.querySelector<HTMLElement>(`[data-testid="account-card-${existingAccount.id}"]`);
  assert.ok(accountCard);
  await act(async () => { accountCard.click(); });
  const reconcileAccount = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Importar OFX Nesta Conta'));
  assert.ok(reconcileAccount);
  await act(async () => { reconcileAccount.click(); });
  assert.deepEqual(calls, [undefined, existingAccount.id]);
});

test('AccountsTab toggles account inclusion and validates quick opening balance before callback', async () => {
  const toggles: string[] = [];
  const updates: Array<[string, number]> = [];
  const page = renderAccountsTab({
    accounts: [existingAccount],
    onToggleAccountInTotal: (id) => toggles.push(id),
    onUpdateAccountInitialBalance: (id, amount) => updates.push([id, amount]),
  });
  const toggle = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'No giro');
  assert.ok(toggle);
  await act(async () => { toggle.click(); });
  assert.deepEqual(toggles, [existingAccount.id]);

  await act(async () => { page.querySelector<HTMLElement>(`[data-testid="account-card-${existingAccount.id}"]`)!.click(); });
  const adjust = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Ajustar Saldo Inicial'));
  assert.ok(adjust);
  await act(async () => { adjust.click(); });
  const balance = page.querySelector<HTMLInputElement>('input[value="100,00"]');
  assert.ok(balance);
  const save = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Salvar Saldo');
  assert.ok(save);
  for (const malformed of ['12abc', 'abc0', '0abc', ',', '.']) {
    await act(async () => { setInputValue(balance, malformed); });
    await act(async () => { save.click(); });
    assert.deepEqual(updates, [], `${malformed} must not be saved as a zero balance`);
    assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /saldo válido/i);
  }

  await act(async () => { setInputValue(balance, '2.345,67'); });
  await act(async () => { save.click(); });
  assert.deepEqual(updates, [[existingAccount.id, 2345.67]]);
});

test('AccountsTab filters imported statement rows and routes status, edit, duplicate, and delete callbacks', async () => {
  const expense: Transaction = {
    id: 'tx-synthetic-expense', description: 'Compra mercado teste', amount: 25, date: '2026-11-03', competenceMonth: '2026-11',
    type: 'expense', status: 'pending', categoryId: 'cat-synthetic', accountId: existingAccount.id,
    paymentMethod: 'pix', recurrence: 'single',
  };
  const income: Transaction = {
    id: 'tx-synthetic-income', description: 'Reembolso teste', amount: 10, date: '2026-11-04', competenceMonth: '2026-11',
    type: 'income', status: 'paid', categoryId: 'cat-synthetic', accountId: existingAccount.id,
    paymentMethod: 'pix', recurrence: 'single',
  };
  const calls: string[] = [];
  const deleted: string[] = [];
  const edited: Transaction[] = [];
  const duplicated: Transaction[] = [];
  const page = renderAccountsTab({
    accounts: [existingAccount], initialSelectedAccountId: existingAccount.id, transactions: [expense, income],
    onToggleTransactionStatus: (id) => calls.push(id), onDeleteTransaction: (id) => deleted.push(id),
    onEditTransaction: (tx) => edited.push(tx), onDuplicateTransaction: (tx) => duplicated.push(tx),
  });
  assert.match(page.textContent ?? '', /Compra mercado teste/);
  assert.match(page.textContent ?? '', /Reembolso teste/);
  const search = page.querySelector<HTMLInputElement>('input[placeholder="Filtrar histórico desta conta..."]');
  assert.ok(search);
  await act(async () => { setInputValue(search, 'reembolso'); });
  assert.match(page.textContent ?? '', /Reembolso teste/);
  assert.doesNotMatch(page.textContent ?? '', /Compra mercado teste/);
  await act(async () => { setInputValue(search, ''); });
  const pending = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Previsto (Efetivar)'));
  assert.ok(pending);
  await act(async () => { pending.click(); });
  assert.deepEqual(calls, [expense.id]);
  const row = Array.from(page.querySelectorAll('tr')).find((tr) => tr.textContent?.includes(expense.description));
  assert.ok(row);
  originalConfirm = window.confirm;
  const prompts: string[] = [];
  window.confirm = (message?: string) => { prompts.push(String(message)); return false; };
  await act(async () => {
    row.querySelector<HTMLButtonElement>('button[title="Editar lançamento"]')!.click();
    row.querySelector<HTMLButtonElement>('button[title="Duplicar lançamento"]')!.click();
    row.querySelector<HTMLButtonElement>('button[title="Excluir lançamento"]')!.click();
  });
  assert.deepEqual(edited, [expense]);
  assert.deepEqual(duplicated, [expense]);
  // Cancelar a confirmação não exclui nada.
  assert.deepEqual(prompts, [`Excluir o lançamento "${expense.description}"?`]);
  assert.deepEqual(deleted, []);
  window.confirm = () => true;
  await act(async () => {
    row.querySelector<HTMLButtonElement>('button[title="Excluir lançamento"]')!.click();
  });
  assert.deepEqual(deleted, [expense.id]);
});
