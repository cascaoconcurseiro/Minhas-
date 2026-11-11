import test from 'node:test';
import assert from 'node:assert/strict';
import type { BankAccount, Transaction } from '../types/finance';
import { calculateSharedMemberSummary, reopenSharedSettlement, settleSharedExpenses } from './sharedFinanceRules';
import { applyCascadeTransactionDelete, calculateAccountBalances } from './financeRules';
import { prepareRestoredBackupTransactions } from './fullBackup';

const account: BankAccount = { id: 'bank', name: 'Synthetic bank', institution: 'Test', type: 'checking', initialBalance: 100, includeInTotal: true, color: '#000000' };
const base: Transaction = { id: 'owed-to-me', description: 'Synthetic shared', amount: 100, date: '2026-11-11', competenceMonth: '2026-11',
  type: 'expense', status: 'pending', categoryId: 'food', paymentMethod: 'cash', recurrence: 'single',
  isShared: true, sharedMemberId: 'member', sharedAmount: 50, sharedPaidBy: 'me', sharedStatus: 'pending' };
const input = { memberId: 'member', month: '2026-11', memberName: 'Synthetic member', accountId: account.id, date: '2026-11-12', settlementId: 'batch-one' };

test('bilateral summary and settlement agree and repeated settlement cannot create duplicate cash', () => {
  const rows = [base, { ...base, id: 'i-owe', sharedPaidBy: 'member' as const, sharedAmount: 20 }];
  const summary = calculateSharedMemberSummary(rows, 'member', '2026-11');
  const settled = settleSharedExpenses(rows, [account], input);
  assert.equal(summary.netCompensatedMonthAmount, 30);
  assert.equal(settled.netAmount, summary.netCompensatedMonthAmount);
  assert.equal(settled.transactions.filter((tx) => tx.id.startsWith('tx-reimb-')).length, 1);
  assert.equal(calculateAccountBalances([account], settled.transactions, '2026-11')[0].currentBalance, 130);
  const again = settleSharedExpenses(settled.transactions, [account], { ...input, settlementId: 'retry' });
  assert.equal(again.affectedCount, 0);
  assert.deepEqual(again.transactions, settled.transactions);
  const reopened = reopenSharedSettlement(settled.transactions, base.id);
  assert.equal(reopened.affectedCount, 2);
  assert.equal(reopened.transactions.length, 2);
  assert.equal(calculateAccountBalances([account], reopened.transactions, '2026-11')[0].currentBalance, 100);
});

test('zero net settlement retains a group link and reopens the entire group without a cash movement', () => {
  const rows = [base, { ...base, id: 'i-owe', sharedPaidBy: 'member' as const }];
  const result = settleSharedExpenses(rows, [account], input);
  assert.equal(result.netAmount, 0);
  assert.equal(result.transactions.length, 2);
  assert.ok(result.transactions.every((tx) => tx.sharedSettlementId === input.settlementId));
  const reopened = reopenSharedSettlement(result.transactions, base.id);
  assert.equal(reopened.affectedCount, 2);
  assert.ok(reopened.transactions.every((tx) => tx.sharedStatus === 'pending' && !tx.sharedSettlementId));
  const deleted = applyCascadeTransactionDelete(result.transactions, base.id, 'single', []);
  assert.equal(deleted.updatedTransactions[0].sharedStatus, 'pending');
});

test('reopening and deleting an exact settlement never touch an unrelated same-day settlement', () => {
  const one = settleSharedExpenses([base], [account], { ...input, txId: base.id });
  const other = { ...base, id: 'unrelated', sharedMemberId: 'other' };
  const two = settleSharedExpenses([...one.transactions, other], [account], { ...input, txId: other.id, settlementId: 'batch-two' });
  const bankOne = two.transactions.find((tx) => tx.id.startsWith('tx-reimb-') && tx.sharedSettlementId === input.settlementId)!;
  const deleted = applyCascadeTransactionDelete(two.transactions, bankOne.id, 'single', []);
  assert.equal(deleted.updatedTransactions.find((tx) => tx.id === base.id)?.sharedStatus, 'pending');
  assert.equal(deleted.updatedTransactions.find((tx) => tx.id === other.id)?.sharedStatus, 'received');
  assert.ok(deleted.updatedTransactions.some((tx) => tx.id.startsWith('tx-reimb-') && tx.sharedSettlementId === 'batch-two'));
});

test('settlement validates account and date, excludes trips, and portable restore respects ownership', () => {
  assert.ok(settleSharedExpenses([base], [], input).error);
  assert.ok(settleSharedExpenses([base], [account], { ...input, date: '2026-02-30' }).error);
  assert.equal(settleSharedExpenses([{ ...base, tripId: 'trip' }], [account], input).affectedCount, 0);
  const settled = settleSharedExpenses([base], [account], input).transactions;
  assert.ok(prepareRestoredBackupTransactions(settled, true).some((tx) => tx.sharedSettlementId));
  assert.ok(prepareRestoredBackupTransactions(settled, false).every((tx) => !tx.sharedSettlementId));
});

test('settled-in-month totals follow actual settlement date instead of original expense competence', () => {
  const settled = settleSharedExpenses([base], [account], { ...input, date: '2026-12-02' }).transactions;
  assert.equal(calculateSharedMemberSummary(settled, 'member', '2026-11').receivedMonthAmount, 0);
  assert.equal(calculateSharedMemberSummary(settled, 'member', '2026-12').receivedMonthAmount, 50);
});
