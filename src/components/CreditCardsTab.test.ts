import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { BankAccount, CreditCard } from '../types/finance';
import { CreditCardsTab } from './CreditCardsTab';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderEmptyCardsTab(onAddCard: (card: Omit<CreditCard, 'id'>) => void) {
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
        cards: [],
        cardSummaries: [],
        accounts: [account],
        categories: [],
        transactions: [],
        onPayInvoice: () => {},
        onAddCard,
        onDeleteTransaction: () => {},
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
