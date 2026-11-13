import assert from 'node:assert/strict';
import test from 'node:test';
import type { CreditCard, Transaction } from '../types/finance';
import {
  applyCascadeTransactionDelete,
  canSettleTransactionDirectly,
  duplicateFinancialTransaction,
  getTransactionEditRestriction,
  toggleTransactionStatusWithCascade,
} from './financeRules';

const base = (over: Partial<Transaction>): Transaction => ({
  id: 't', description: 'x', amount: 100, date: '2026-11-05', competenceMonth: '2026-11', type: 'expense',
  status: 'pending', categoryId: 'c', paymentMethod: 'pix', recurrence: 'single', accountId: 'a', ...over,
});
const card: CreditCard = { id: 'c1', name: 'Roxinho', brand: 'Mastercard', limit: 1000, closingDay: 20, dueDay: 28, color: '#000' } as CreditCard;

test('a card purchase cannot be marked paid directly: only paying the invoice settles it', () => {
  const purchase = base({ id: 'p', creditCardId: 'c1', paymentMethod: 'credit_card' });
  assert.equal(canSettleTransactionDirectly(purchase), false);
  const result = toggleTransactionStatusWithCascade([purchase], 'p', [card]);
  assert.equal(result.blocked, true);
  assert.equal(result.updatedTransactions[0].status, 'pending');
  assert.match(result.actionDescription, /pagando a fatura/);
  assert.equal(canSettleTransactionDirectly(base({ id: 'bank' })), true);
  assert.equal(toggleTransactionStatusWithCascade([base({ id: 'bank' })], 'bank', [card]).updatedTransactions[0].status, 'paid');
});

test('a card purchase settled by an invoice payment must be reopened through the payment; an orphan "paid" purchase can be reopened', () => {
  const settled = base({ id: 'p', creditCardId: 'c1', status: 'paid', invoicePaymentId: 'inv-1' });
  assert.equal(toggleTransactionStatusWithCascade([settled], 'p', [card]).blocked, true);
  const orphan = base({ id: 'o', creditCardId: 'c1', status: 'paid' });
  const reopened = toggleTransactionStatusWithCascade([orphan], 'o', [card]);
  assert.equal(reopened.blocked, undefined);
  assert.equal(reopened.updatedTransactions[0].status, 'pending');
});

test('investment operations, exchange-lot transfers and invoice-settled purchases cannot be deleted, edited or duplicated alone', () => {
  const invest = base({ id: 'inv', type: 'transfer', targetInvestmentAssetId: 'asset-1', status: 'paid' });
  const fx = base({ id: 'tx-fxlot-1', type: 'transfer', destinationAccountId: 'b', status: 'paid' });
  const settled = base({ id: 'p', creditCardId: 'c1', status: 'paid', invoicePaymentId: 'inv-1' });
  for (const tx of [invest, fx, settled]) {
    const all = [tx, base({ id: 'other' })];
    const deletion = applyCascadeTransactionDelete(all, tx.id, 'single', [card]);
    assert.equal(deletion.deletedCount, 0, tx.id);
    assert.equal(deletion.updatedTransactions.length, 2);
    assert.ok(deletion.actionDescription);
    assert.ok(getTransactionEditRestriction(tx), tx.id);
  }
  assert.equal(duplicateFinancialTransaction(invest, 'copy'), null);
  assert.equal(duplicateFinancialTransaction(fx, 'copy'), null);
  assert.ok(duplicateFinancialTransaction(base({ id: 'normal' }), 'copy'));
});

test('a plain transaction is still deleted normally', () => {
  const all = [base({ id: 'a1' }), base({ id: 'a2' })];
  const deletion = applyCascadeTransactionDelete(all, 'a1', 'single', [card]);
  assert.equal(deletion.deletedCount, 1);
  assert.deepEqual(deletion.updatedTransactions.map((t) => t.id), ['a2']);
});

import { payCreditCardInvoice, reverseCreditCardInvoicePayment } from './financeRules';

test('reversing an invoice payment reopens the purchases and unlocks them (no stale payment link)', () => {
  const purchase = base({ id: 'p', creditCardId: 'c1', paymentMethod: 'credit_card', amount: 80, competenceMonth: '2026-11' });
  const paid = payCreditCardInvoice(card, [purchase], '2026-11', 'a', '2026-11-28');
  const payment = paid.find((tx) => tx.isInvoicePayment)!;
  const settled = paid.find((tx) => tx.id === 'p')!;
  assert.equal(settled.status, 'paid');
  assert.ok(settled.invoicePaymentId);
  assert.equal(applyCascadeTransactionDelete(paid, 'p', 'single', [card]).deletedCount, 0, 'compra quitada não some sozinha');

  const reversed = reverseCreditCardInvoicePayment(paid, payment.id, [card]);
  const reopened = reversed.updatedTransactions.find((tx) => tx.id === 'p')!;
  assert.equal(reopened.status, 'pending');
  assert.equal(reopened.invoicePaymentId, undefined);
  assert.equal(applyCascadeTransactionDelete(reversed.updatedTransactions, 'p', 'single', [card]).deletedCount, 1);
});

test('a pending purchase that still carries an old payment link (legacy data) is not locked', () => {
  const legacy = base({ id: 'old', creditCardId: 'c1', status: 'pending', invoicePaymentId: 'gone' });
  assert.equal(getTransactionEditRestriction(legacy), null);
  assert.equal(applyCascadeTransactionDelete([legacy], 'old', 'single', [card]).deletedCount, 1);
});
