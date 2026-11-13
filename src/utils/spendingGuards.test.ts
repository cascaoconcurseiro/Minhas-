import assert from 'node:assert/strict';
import test from 'node:test';
import type { BankAccount, CreditCard, Transaction } from '../types/finance';
import { assessAccountBalanceImpact, assessCardLimitImpact } from './spendingGuards';

const checking: BankAccount = { id: 'a', name: 'Nubank', institution: 'Nubank', type: 'checking', initialBalance: 100, color: '#000', includeInTotal: true };
const usd: BankAccount = { id: 'u', name: 'Nomad', institution: 'Nomad', type: 'international', currency: 'USD', initialBalance: 100, color: '#000', includeInTotal: true };
const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't1', description: 'x', amount: 10, date: '2026-11-05', competenceMonth: '2026-11', type: 'expense', status: 'paid',
  categoryId: 'c', paymentMethod: 'pix', recurrence: 'single', accountId: 'a', ...over,
});

test('balance guard warns when a paid expense would leave the account negative', () => {
  const warning = assessAccountBalanceImpact({ account: checking, accounts: [checking], transactions: [], amount: 150, date: '2026-11-10', status: 'paid' });
  assert.ok(warning);
  assert.equal(warning.kind, 'insufficient_balance');
  assert.equal(warning.shortfall, 50);
  assert.equal(assessAccountBalanceImpact({ account: checking, accounts: [checking], transactions: [], amount: 100, date: '2026-11-10', status: 'paid' }), null, 'saldo exato não é problema');
});

test('balance guard counts what was already spent and ignores the transaction being edited', () => {
  const spent = tx({ id: 'spent', amount: 60 });
  assert.ok(assessAccountBalanceImpact({ account: checking, accounts: [checking], transactions: [spent], amount: 50, date: '2026-11-10', status: 'paid' }));
  assert.equal(
    assessAccountBalanceImpact({ account: checking, accounts: [checking], transactions: [spent], amount: 100, date: '2026-11-10', status: 'paid', ignoreTransactionId: 'spent' }),
    null
  );
});

test('balance guard: a pending expense uses the projected balance; foreign accounts are not judged in reais', () => {
  const pendingIncome = tx({ id: 'inc', type: 'income', amount: 200, status: 'pending' });
  assert.equal(assessAccountBalanceImpact({ account: checking, accounts: [checking], transactions: [pendingIncome], amount: 250, date: '2026-11-10', status: 'pending' }), null);
  assert.equal(assessAccountBalanceImpact({ account: usd, accounts: [usd], transactions: [], amount: 9999, date: '2026-11-10', status: 'paid' }), null);
});

const card: CreditCard = { id: 'c1', name: 'Nubank Roxinho', brand: 'Mastercard', limit: 1000, closingDay: 20, dueDay: 28, color: '#000' } as CreditCard;
const purchase = (over: Partial<Transaction>): Transaction => ({
  id: 'p1', description: 'Compra', amount: 700, date: '2026-11-05', competenceMonth: '2026-11', type: 'expense', status: 'pending',
  categoryId: 'c', paymentMethod: 'credit_card', recurrence: 'single', creditCardId: 'c1', ...over,
});

test('card guard warns when the purchase passes the free limit, counting the whole installment total', () => {
  const warning = assessCardLimitImpact({ card, transactions: [purchase({})], purchaseTotal: 400, date: '2026-11-10' });
  assert.ok(warning);
  assert.equal(warning.kind, 'card_limit');
  assert.equal(warning.shortfall, 100);
  assert.equal(assessCardLimitImpact({ card, transactions: [purchase({})], purchaseTotal: 300, date: '2026-11-10' }), null);
  assert.equal(assessCardLimitImpact({ card: { ...card, limit: 0 }, transactions: [], purchaseTotal: 5000, date: '2026-11-10' }), null, 'sem limite informado não avisa');
  assert.equal(assessCardLimitImpact({ card, transactions: [purchase({})], purchaseTotal: 400, date: '2026-11-10', ignoreTransactionId: 'p1' }), null, 'editando a própria compra');
});

import { assessDateSanity } from './spendingGuards';

test('date guard flags paid-in-the-future and far-away dates, but not normal ones', () => {
  const today = '2026-11-13';
  assert.match(String(assessDateSanity({ date: '2026-11-20', status: 'paid', today })), /pago, mas a data é futura/);
  assert.equal(assessDateSanity({ date: '2026-11-20', status: 'pending', today }), null);
  assert.equal(assessDateSanity({ date: '2026-11-01', status: 'paid', today }), null);
  assert.equal(assessDateSanity({ date: '2026-10-01', status: 'pending', today }), null, 'conta vencida pendente é normal');
  assert.match(String(assessDateSanity({ date: '2206-11-13', status: 'pending', today })), /mais de um ano/);
});
