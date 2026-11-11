import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { BankAccount, CreditCard, Transaction } from '../types/finance';
import { calculateCreditCardSummary } from '../utils/financeRules';
import { CreditCardsTab } from './CreditCardsTab';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function clickButton(page: HTMLElement, predicate: (button: HTMLButtonElement) => boolean) {
  const button = Array.from(page.querySelectorAll('button')).find(predicate);
  assert.ok(button, 'expected button to be present');
  act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('blocked card deletion keeps its dedicated page open for the warning', () => {
  const card: CreditCard = {
    id: 'card-history',
    name: 'Cartão com histórico',
    brand: 'Visa',
    limit: 5000,
    closingDay: 20,
    dueDay: 28,
    defaultAccountId: 'account-main',
    color: '#123456',
  };
  const account: BankAccount = {
    id: 'account-main',
    name: 'Conta principal',
    institution: 'Banco',
    type: 'checking',
    initialBalance: 1000,
    color: '#123456',
    includeInTotal: true,
  };
  const transaction: Transaction = {
    id: 'purchase-history',
    description: 'Compra antiga',
    amount: 120,
    date: '2026-11-05',
    competenceMonth: '2026-11',
    type: 'expense',
    status: 'pending',
    categoryId: 'cat-outros',
    creditCardId: card.id,
    paymentMethod: 'credit_card',
    recurrence: 'single',
  };
  const transactions = [transaction];
  const onDeleteCard = (cardId: string) => {
    assert.equal(cardId, card.id);
    return false;
  };

  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <CreditCardsTab
        selectedMonth="2026-11"
        cards={[card]}
        cardSummaries={[calculateCreditCardSummary(card, transactions, '2026-11')]}
        accounts={[account]}
        categories={[]}
        transactions={transactions}
        initialSelectedCardId={card.id}
        onPayInvoice={() => {}}
        onAddCard={() => {}}
        onDeleteCard={onDeleteCard}
        onDeleteTransaction={() => {}}
        onOpenNewCardExpense={() => {}}
      />
    );
  });

  assert.ok(container.querySelector('[data-testid="card-dedicated-page"]'));
  clickButton(container, (button) => button.getAttribute('aria-label') === `Excluir cartão ${card.name}`);
  clickButton(container, (button) => button.textContent?.trim() === 'Sim');

  assert.ok(container.querySelector('[data-testid="card-dedicated-page"]'));
  assert.match(container.textContent || '', /Excluir cartão\?/);
});
