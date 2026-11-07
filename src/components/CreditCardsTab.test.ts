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
    summaryTransactions?: Transaction[];
    invoicePaid?: boolean;
    accounts?: BankAccount[];
    onOpenNewCardExpense?: () => void;
    onAnticipateInstallments?: (groupId: string, discount: number, maxCount?: number) => void;
    onReverseAnticipation?: (targetIdOrGroupId: string) => void;
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
        cardSummaries: options.card ? [{ cardId: options.card.id, invoiceMonth: '2026-11', invoiceTotal: options.invoicePaid ? 100 : (options.invoicePendingAmount ?? 0), invoicePaidAmount: options.invoicePaid ? 100 : 0, invoicePendingAmount: options.invoicePaid ? 0 : (options.invoicePendingAmount ?? 0), isInvoicePaid: Boolean(options.invoicePaid), usedLimit: options.invoicePendingAmount ?? 100, availableLimit: options.card.limit - (options.invoicePendingAmount ?? 0), usagePercent: 0, transactions: options.summaryTransactions ?? [] } satisfies CreditCardSummary] : [],
        accounts: options.accounts ?? [account],
        categories: [],
        transactions: options.transactions ?? [],
        onPayInvoice: options.onPayInvoice ?? (() => {}),
        onAddCard,
        onUpdateCard: options.onUpdateCard,
        onDeleteTransaction: options.onDeleteTransaction ?? (() => {}),
        onDeleteCard: options.onDeleteCard,
        onOpenNewCardExpense: options.onOpenNewCardExpense ?? (() => {}),
        onAnticipateInstallments: options.onAnticipateInstallments,
        onReverseAnticipation: options.onReverseAnticipation,
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
    setInputValue(amountInput, '100,01');
    confirmButton.click();
  });
  assert.equal(payments.length, 0);
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /não pode ultrapassar/);

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
  const deletedTransactions: Array<[string, boolean | undefined]> = [];
  const page = renderEmptyCardsTab(() => {}, {
    card, invoicePaid: true, transactions: [paymentTx],
    onDeleteCard: (id) => { deletedCardId = id; },
    onDeleteTransaction: (id, deleteGroup) => { deletedTransactions.push([id, deleteGroup]); },
  });
  await act(async () => { page.querySelector<HTMLElement>(`[data-testid="credit-card-item-${card.id}"]`)!.click(); });
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="reverse-invoice-payment-btn"]')!.click(); });
  assert.deepEqual(deletedTransactions, [['payment-1', false]]);
  const paymentBanner = page.querySelector<HTMLElement>('[data-testid="invoice-payment-cascade-banner"]');
  assert.ok(paymentBanner);
  assert.match(paymentBanner.textContent ?? '', /Pago em 02\/11\/2026 via Conta sintética/);
  await act(async () => {
    [...paymentBanner.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Apagar Pagamento e Reabrir Fatura'))!
      .click();
  });
  assert.deepEqual(deletedTransactions, [['payment-1', false], ['payment-1', false]]);
  await act(async () => { page.querySelector<HTMLButtonElement>(`[aria-label="Excluir cartão ${card.name}"]`)!.click(); });
  assert.equal(deletedCardId, '');
  await act(async () => { [...page.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Não')!.click(); });
  assert.equal(deletedCardId, '');
  await act(async () => { page.querySelector<HTMLButtonElement>(`[aria-label="Excluir cartão ${card.name}"]`)!.click(); });
  await act(async () => { [...page.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Sim')!.click(); });
  assert.equal(deletedCardId, card.id);
});

test('empty card registration can be opened and closed without creating a card', async () => {
  let createCalls = 0;
  const page = renderEmptyCardsTab(() => { createCalls += 1; });
  const toggle = [...page.querySelectorAll('button')]
    .find((button) => button.textContent?.includes('Cadastrar Primeiro Cartão'));
  assert.ok(toggle);

  await act(async () => { toggle.click(); });
  assert.ok(page.querySelector('form'));
  await act(async () => {
    [...page.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Fechar Cadastro'))!
      .click();
  });

  assert.equal(page.querySelector('form'), null);
  assert.equal(createCalls, 0);
  assert.match(page.textContent ?? '', /Nenhum cartão de crédito cadastrado/);
});

test('card purchase shortcuts work from overview and detail and the card page returns to overview', async () => {
  const card: CreditCard = { id: 'shortcut-card', name: 'Cartão sintético', brand: 'Visa', limit: 1000, closingDay: 10, dueDay: 20, defaultAccountId: 'account-1', color: '#000000' };
  let purchaseOpens = 0;
  const page = renderEmptyCardsTab(() => {}, { card, onOpenNewCardExpense: () => { purchaseOpens += 1; } });

  await act(async () => {
    [...page.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Compra no Cartão'))!
      .click();
  });
  assert.equal(purchaseOpens, 1);

  const cardTile = page.querySelector<HTMLElement>(`[data-testid="credit-card-item-${card.id}"]`);
  assert.ok(cardTile);
  await act(async () => { cardTile.click(); });
  assert.ok(page.querySelector('[data-testid="card-dedicated-page"]'));
  await act(async () => {
    [...page.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Compra Cartão'))!
      .click();
  });
  assert.equal(purchaseOpens, 2);

  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="back-to-cards-list-btn"]')!.click(); });
  assert.equal(page.querySelector('[data-testid="card-dedicated-page"]'), null);
  assert.ok(page.querySelector(`[data-testid="credit-card-item-${card.id}"]`));
});

test('card edit cancellation discards draft values without dispatching an update', async () => {
  const card: CreditCard = { id: 'cancel-edit-card', name: 'Cartão original', brand: 'Visa', limit: 1000, closingDay: 10, dueDay: 20, defaultAccountId: 'account-1', color: '#000000' };
  const updates: CreditCard[] = [];
  const page = renderEmptyCardsTab(() => {}, { card, onUpdateCard: (next) => updates.push(next) });
  await act(async () => { page.querySelector<HTMLElement>(`[data-testid="credit-card-item-${card.id}"]`)!.click(); });
  await act(async () => {
    [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Editar Cartão'))!.click();
  });
  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('#card-edit-name-input')!, 'Rascunho não salvo');
    [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Cancelar')!.click();
  });

  assert.equal(page.querySelector('#card-edit-name-input'), null);
  assert.equal(updates.length, 0);
  assert.match(page.textContent ?? '', /Cartão original/);
  assert.doesNotMatch(page.textContent ?? '', /Rascunho não salvo/);
});

test('installment anticipation controls submit the selected group, discount and count', async () => {
  const card: CreditCard = { id: 'anticipate-card', name: 'Cartão parcelado', brand: 'Visa', limit: 1000, closingDay: 10, dueDay: 20, defaultAccountId: 'account-1', color: '#000000' };
  const currentInstallment: Transaction = {
    id: 'installment-1', description: 'Notebook (1/3)', amount: 100, date: '2026-11-02',
    competenceMonth: '2026-11', type: 'expense', status: 'pending', categoryId: 'cat',
    paymentMethod: 'credit_card', recurrence: 'single', creditCardId: card.id,
    installmentGroupId: 'notebook-group', installmentNumber: 1, installmentTotal: 3,
  };
  const futureOne: Transaction = {
    ...currentInstallment, id: 'installment-2', description: 'Notebook (2/3)', date: '2026-12-02',
    competenceMonth: '2026-12', installmentNumber: 2,
  };
  const futureTwo: Transaction = {
    ...currentInstallment, id: 'installment-3', description: 'Notebook (3/3)', date: '2027-01-02',
    competenceMonth: '2027-01', installmentNumber: 3,
  };
  const anticipationCalls: Array<[string, number, number?]> = [];
  const page = renderEmptyCardsTab(() => {}, {
    card,
    invoicePendingAmount: 100,
    transactions: [currentInstallment, futureOne, futureTwo],
    summaryTransactions: [currentInstallment],
    onAnticipateInstallments: (...args) => anticipationCalls.push(args),
  });
  await act(async () => { page.querySelector<HTMLElement>(`[data-testid="credit-card-item-${card.id}"]`)!.click(); });
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="open-anticipate-center-btn"]')!.click(); });
  const panel = page.querySelector<HTMLElement>('[data-testid="anticipate-installments-panel"]');
  assert.ok(panel);
  assert.match(panel.textContent ?? '', /Notebook/);
  assert.match(panel.textContent ?? '', /Central de Antecipação de Parcelas/);

  await act(async () => {
    [...panel.querySelectorAll('button')].find((button) => button.textContent?.trim() === '+1x')!.click();
    setInputValue(panel.querySelector<HTMLInputElement>('input[placeholder="0,00"]')!, '25,00');
    panel.querySelector<HTMLButtonElement>('[data-testid="confirm-anticipate-btn"]')!.click();
  });

  assert.deepEqual(anticipationCalls, [['notebook-group', 25, 1]]);
  assert.equal(page.querySelector('[data-testid="anticipate-installments-panel"]'), null);
});
