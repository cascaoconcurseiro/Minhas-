import assert from 'node:assert/strict';
import test from 'node:test';
import type { BankAccount, Category, CreditCard, FamilyMember, Transaction } from '../types/finance';
import { assessDataHealth } from './dataHealth';

const account = (over: Partial<BankAccount> = {}): BankAccount => ({
  id: 'a1', name: 'Nubank', type: 'checking', initialBalance: 100, color: '#000', includeInTotal: true, ...over,
} as BankAccount);
const card = (over: Partial<CreditCard> = {}): CreditCard => ({
  id: 'c1', name: 'Visa', brand: 'Visa', limit: 1000, closingDay: 10, dueDay: 18, defaultAccountId: 'a1', color: '#000', ...over,
});
const category = { id: 'cat1', name: 'Mercado', type: 'expense' } as Category;
const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1', description: 'x', amount: 100, date: '2026-11-01', competenceMonth: '2026-11', type: 'expense',
  status: 'paid', categoryId: 'cat1', accountId: 'a1', paymentMethod: 'debit', recurrence: 'single', ...over,
} as Transaction);
const run = (over: Partial<Parameters<typeof assessDataHealth>[0]> = {}) =>
  assessDataHealth({ accounts: [account()], cards: [card()], categories: [category], transactions: [tx()], familyMembers: [], ...over });

test('dados completos não geram problemas', () => {
  assert.deepEqual(run(), []);
});

test('aponta lançamentos sem categoria válida, ignorando transferências e pagamento de fatura', () => {
  const issues = run({
    transactions: [
      tx({ id: '1', categoryId: '' }),
      tx({ id: '2', categoryId: 'apagada' }),
      tx({ id: '3', categoryId: '', type: 'transfer' }),
      tx({ id: '4', categoryId: '', isInvoicePayment: true }),
    ],
  });
  assert.equal(issues.find((i) => i.id === 'uncategorized')?.count, 2);
});

test('aponta referências a conta, cartão e familiar que não existem', () => {
  const ids = run({
    transactions: [
      tx({ id: '1', accountId: 'sumiu' }),
      tx({ id: '2', creditCardId: 'sumiu' }),
      tx({ id: '3', isShared: true, sharedMemberId: 'sumiu', sharedAmount: 10 }),
    ],
  }).map((i) => i.id);
  assert.ok(ids.includes('missing_account'));
  assert.ok(ids.includes('missing_card'));
  assert.ok(ids.includes('missing_member'));
});

test('aponta divisão maior que o valor', () => {
  const issues = run({
    familyMembers: [{ id: 'm1' } as FamilyMember],
    transactions: [tx({ isShared: true, sharedMemberId: 'm1', sharedAmount: 150 })],
  });
  assert.equal(issues.find((i) => i.id === 'shared_amount_over_total')?.count, 1);
});

test('conta sem saldo e sem movimento é só aviso informativo', () => {
  const issues = run({ accounts: [account({ initialBalance: 0 })], transactions: [] });
  const found = issues.find((i) => i.id === 'account_without_balance');
  assert.equal(found?.severity, 'info');
  assert.match(found?.detail ?? '', /Nubank/);
});

test('conta sem saldo mas com movimento não é apontada', () => {
  assert.deepEqual(run({ accounts: [account({ initialBalance: 0 })] }), []);
});

test('cartão com dias inválidos e sem limite', () => {
  const ids = run({ cards: [card({ closingDay: 0, limit: 0 })] }).map((i) => i.id);
  assert.ok(ids.includes('card_invalid_days'));
  assert.ok(ids.includes('card_without_limit'));
});
