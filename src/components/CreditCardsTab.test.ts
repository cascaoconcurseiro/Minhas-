import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { BankAccount, CreditCard, CreditCardSummary, Transaction } from '../types/finance';
import { CreditCardsTab } from './CreditCardsTab';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderEmptyCardsTab(
  onAddCard: (card: Omit<CreditCard, 'id'>) => void,
  options: {
    card?: CreditCard;
    onUpdateCard?: (card: CreditCard) => void;
    invoicePendingAmount?: number;
    onPayInvoice?: (cardId: string, accountId: string, customAmount?: number) => void;
    onDeleteCard?: (cardId: string) => void;
    onDeleteTransaction?: (txId: string, deleteGroup?: boolean) => void;
    transactions?: import('../types/finance').Transaction[];
    invoicePaid?: boolean;
    accounts?: BankAccount[];
  } = {}
) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const account: BankAccount = {
    id: 'account-1',
    name: 'Conta sintética',
    institution: 'Banco de teste',
    type: 'checking',
    initialBalance: 0,
    color: '#000000',
    includeInTotal: true,
  };
  act(() => {
    root?.render(
      React.createElement(CreditCardsTab, {
        selectedMonth: '2026-11',
        cards: options.card ? [options.card] : [],
        cardSummaries: options.card ? [{ cardId: options.card.id, invoiceMonth: '2026-11', invoiceTotal: options.invoicePaid ? 100 : (options.invoicePendingAmount ?? 0), invoicePaidAmount: options.invoicePaid ? 100 : 0, invoicePendingAmount: options.invoicePaid ? 0 : (options.invoicePendingAmount ?? 0), isInvoicePaid: Boolean(options.invoicePaid), usedLimit: options.invoicePendingAmount ?? 100, availableLimit: options.card.limit - (options.invoicePendingAmount ?? 0), usagePercent: 0, transactions: [] } satisfies CreditCardSummary] : [],
        accounts: options.accounts ?? [account],
        categories: [],
        transactions: options.transactions ?? [],
        onPayInvoice: options.onPayInvoice ?? (() => {}),
        onAddCard,
        onUpdateCard: options.onUpdateCard,
        onDeleteTransaction: options.onDeleteTransaction ?? (() => {}),
        onDeleteCard: options.onDeleteCard,
        onOpenNewCardExpense: () => {},
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

test('keeps every React hook above the empty-card early return', () => {
  const source = readFileSync(new URL('./CreditCardsTab.tsx', import.meta.url), 'utf8');
  const emptyStateReturn = source.indexOf('if (!activeCard || !activeSummary) {');

  assert.notEqual(emptyStateReturn, -1, 'expected the empty-card state guard');
  assert.doesNotMatch(
    source.slice(emptyStateReturn),
    /\buse(?:State|Effect|Memo|Callback|Ref|Reducer|Id|Context|ImperativeHandle|LayoutEffect|InsertionEffect)\s*\(/,
    'hooks after the guard change hook order when the first card is added'
  );
});

test('creates a credit card from the empty state after validating required fields', async () => {
  let createdCard: Omit<CreditCard, 'id'> | null = null;
  const page = renderEmptyCardsTab((card) => { createdCard = card; });
  const openFormButton = Array.from(page.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Cadastrar Primeiro Cartão')
  );
  assert.ok(openFormButton);

  await act(async () => { openFormButton.click(); });
  const form = page.querySelector('form');
  assert.ok(form);
  for (const labelText of ['Nome do Cartão', 'Bandeira', 'Limite Total (R$)', 'Dia Fecha', 'Dia Vence', 'Conta padrão:']) {
    assert.ok(Array.from(page.querySelectorAll('label')).some((label) => label.textContent?.trim() === labelText));
  }

  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.match(page.textContent ?? '', /Informe o nome do cartão/);
  assert.equal(createdCard, null);

  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('#card-name-input')!, ' Inter Black ');
    setInputValue(page.querySelector<HTMLInputElement>('#card-limit-input')!, '0');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.match(page.textContent ?? '', /Informe um limite total válido/);
  assert.equal(createdCard, null);

  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('#card-limit-input')!, '5.000,00');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });

  assert.deepEqual(createdCard, {
    name: 'Inter Black',
    brand: 'Mastercard',
    limit: 5000,
    closingDay: 20,
    dueDay: 28,
    defaultAccountId: 'account-1',
    color: '#0f172a',
  });
  assert.equal(page.querySelector('form'), null, 'successful creation closes the form');
});

test('card edit form labels are associated with their controls', async () => {
  const card: CreditCard = { id: 'card-test', name: 'Cartão sintético', brand: 'Visa', limit: 1000, closingDay: 10, dueDay: 20, defaultAccountId: 'account-1', color: '#000000' };
  const page = renderEmptyCardsTab(() => {}, { card, onUpdateCard: () => {} });
  await act(async () => { page.querySelector<HTMLElement>('[data-testid="credit-card-item-card-test"]')!.click(); });
  const editButton = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Editar Cartão'));
  assert.ok(editButton);
  await act(async () => { editButton.click(); });
  for (const id of ['card-edit-name-input', 'card-edit-brand-select', 'card-edit-limit-input', 'card-edit-closing-input', 'card-edit-due-input', 'card-edit-default-account-select']) {
    const field = page.querySelector<HTMLElement>(`#${id}`);
    assert.ok(field, `expected field #${id}`);
    assert.ok(Array.from(page.querySelectorAll('label')).some((label) => label.control === field), `expected an associated label for #${id}`);
  }
});

test('partial invoice payment rejects zero and forwards a valid amount and account', async () => {
  const card: CreditCard = { id: 'card-partial-test', name: 'Cartão sintético', brand: 'Visa', limit: 1000, closingDay: 10, dueDay: 20, defaultAccountId: 'account-1', color: '#000000' };
  const payments: Array<[string, string, number?]> = [];
  const page = renderEmptyCardsTab(() => {}, {
    card,
    invoicePendingAmount: 100,
    onPayInvoice: (...args) => payments.push(args),
  });
  await act(async () => { page.querySelector<HTMLElement>(`[data-testid="credit-card-item-${card.id}"]`)?.click(); });
  const openPartialButton = [...page.querySelectorAll('button')]
    .find((button) => button.textContent?.includes('Pagar Parcial'));
  assert.ok(openPartialButton);
  await act(async () => { openPartialButton.click(); });

  const amountInput = page.querySelector<HTMLInputElement>('[data-testid="partial-invoice-payment-panel"] input');
  const confirmButton = [...page.querySelectorAll<HTMLButtonElement>('[data-testid="partial-invoice-payment-panel"] button')]
    .find((button) => button.textContent?.includes('Confirmar Abatimento'));
  assert.ok(amountInput && confirmButton);

  await act(async () => {
    setInputValue(amountInput, '0');
    confirmButton.click();
  });
  assert.equal(payments.length, 0);
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /maior que zero/);

  await act(async () => {
    setInputValue(amountInput, '25,00');
    confirmButton.click();
  });
  assert.deepEqual(payments, [[card.id, 'account-1', 25]]);
});

test('submits edited card settings and preserves its id', async () => {
  const card: CreditCard = { id: 'edit-card', name: 'Cartão antigo', brand: 'Visa', limit: 1000, closingDay: 10, dueDay: 20, defaultAccountId: 'account-1', color: '#000000' };
  const updated: CreditCard[] = [];
  const page = renderEmptyCardsTab(() => {}, { card, onUpdateCard: (next) => { updated.push(next); } });
  await act(async () => { page.querySelector<HTMLElement>(`[data-testid="credit-card-item-${card.id}"]`)!.click(); });
  await act(async () => { [...page.querySelectorAll('button')].find((b) => b.textContent?.includes('Editar Cartão'))!.click(); });
  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('#card-edit-name-input')!, '  Cartão atualizado  ');
    setInputValue(page.querySelector<HTMLInputElement>('#card-edit-limit-input')!, '2.500,50');
    page.querySelector<HTMLFormElement>('form')!.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.equal(updated.length, 1);
  assert.deepEqual(updated[0], { ...card, name: 'Cartão atualizado', limit: 2500.5 });
  assert.equal(page.querySelector('#card-edit-name-input'), null);
});

test('full invoice payment uses the selected default account', async () => {
  const card: CreditCard = { id: 'full-card', name: 'Cartão sintético', brand: 'Visa', limit: 1000, closingDay: 10, dueDay: 20, defaultAccountId: 'account-1', color: '#000000' };
  const calls: Array<[string, string, number?]> = [];
  const secondAccount: BankAccount = { id: 'account-2', name: 'Segunda conta sintética', institution: 'Teste', type: 'checking', initialBalance: 0, color: '#111111', includeInTotal: true };
  const page = renderEmptyCardsTab(() => {}, { card, accounts: [
    { id: 'account-1', name: 'Conta sintética', institution: 'Banco de teste', type: 'checking', initialBalance: 0, color: '#000000', includeInTotal: true },
    secondAccount,
  ], invoicePendingAmount: 350, onPayInvoice: (...args) => calls.push(args) });
  await act(async () => { page.querySelector<HTMLElement>(`[data-testid="credit-card-item-${card.id}"]`)!.click(); });
  await act(async () => {
    const accountSelect = page.querySelector<HTMLSelectElement>('[aria-label="Conta para debitar pagamento da fatura"]')!;
    accountSelect.value = secondAccount.id;
    accountSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="pay-full-invoice-btn"]')!.click(); });
  assert.deepEqual(calls, [[card.id, 'account-2']]);
});

test('invoice payment reversal and card deletion require explicit confirmation', async () => {
  const card: CreditCard = { id: 'delete-card', name: 'Cartão sintético', brand: 'Visa', limit: 1000, closingDay: 10, dueDay: 20, defaultAccountId: 'account-1', color: '#000000' };
  const paymentTx: Transaction = {
    id: 'payment-1', description: 'Pagamento Cartão sintético', amount: 100, date: '2026-11-02',
    competenceMonth: '2026-11', type: 'expense', status: 'paid', categoryId: 'cat',
    paymentMethod: 'transfer', recurrence: 'single', isInvoicePayment: true, settledCardId: card.id,
    accountId: 'account-1',
  };
  let deletedCardId = '';
  const deletedTransactions: string[] = [];
  const page = renderEmptyCardsTab(() => {}, {
    card, invoicePaid: true, transactions: [paymentTx],
    onDeleteCard: (id) => { deletedCardId = id; },
    onDeleteTransaction: (id) => { deletedTransactions.push(id); },
  });
  await act(async () => { page.querySelector<HTMLElement>(`[data-testid="credit-card-item-${card.id}"]`)!.click(); });
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="reverse-invoice-payment-btn"]')!.click(); });
  assert.deepEqual(deletedTransactions, ['payment-1']);
  await act(async () => { page.querySelector<HTMLButtonElement>(`[aria-label="Excluir cartão ${card.name}"]`)!.click(); });
  assert.equal(deletedCardId, '');
  await act(async () => { [...page.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Não')!.click(); });
  assert.equal(deletedCardId, '');
  await act(async () => { page.querySelector<HTMLButtonElement>(`[aria-label="Excluir cartão ${card.name}"]`)!.click(); });
  await act(async () => { [...page.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Sim')!.click(); });
  assert.equal(deletedCardId, card.id);
});
