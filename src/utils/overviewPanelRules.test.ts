import test from 'node:test';
import assert from 'node:assert/strict';
import type { Transaction } from '../types/finance';
import { summarizePendingBankMovements } from './financeRules';
import { calculateSharedMemberSummary, calculateSharedMonthTotals } from './sharedFinanceRules';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 'tx', description: 'Synthetic', amount: 100, date: '2026-11-10', competenceMonth: '2026-11',
  type: 'expense', status: 'pending', categoryId: 'cat-moradia', paymentMethod: 'pix', recurrence: 'single', ...over,
});

test('pending summary keeps receivables out of the payable total', () => {
  const summary = summarizePendingBankMovements([
    tx({ id: 'rent', amount: 4800 }),
    tx({ id: 'bill', amount: 0.1 }),
    tx({ id: 'bill-2', amount: 0.2 }),
    tx({ id: 'salary', type: 'income', amount: 28000 }),
  ]);
  assert.equal(summary.payableTotal, 4800.3);
  assert.equal(summary.receivableTotal, 28000);
  assert.deepEqual(summary.payableItems.map((item) => item.id), ['rent', 'bill', 'bill-2']);
});

test('pending summary tolerates a missing list', () => {
  assert.equal(summarizePendingBankMovements(undefined).payableTotal, 0);
});

test('shared month totals follow the same rule as the per-member summary', () => {
  const shared = (over: Partial<Transaction>) =>
    tx({ isShared: true, sharedMemberId: 'ana', sharedAmount: 50, sharedPaidBy: 'me', sharedStatus: 'pending', ...over });
  const rows = [
    shared({ id: 'a' }),
    shared({ id: 'b', sharedMemberId: 'bia', sharedAmount: 30, sharedPaidBy: 'member' }),
    shared({ id: 'settled', sharedStatus: 'received' }),
    shared({ id: 'other-month', competenceMonth: '2026-12' }),
    shared({ id: 'trip', tripId: 'trip-1' }),
  ];
  const totals = calculateSharedMonthTotals(rows, '2026-11');
  assert.deepEqual(totals, { owedToMe: 50, iOwe: 30, net: 20, openItems: 2 });

  const perMember = ['ana', 'bia'].map((id) => calculateSharedMemberSummary(rows, id, '2026-11'));
  assert.equal(perMember.reduce((sum, item) => sum + item.owedToMeMonthAmount, 0), totals.owedToMe);
  assert.equal(perMember.reduce((sum, item) => sum + item.iOweMemberMonthAmount, 0), totals.iOwe);
});
