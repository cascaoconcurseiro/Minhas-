import test from 'node:test';
import assert from 'node:assert/strict';
import type { BankAccount, Transaction } from '../types/finance';
import { calculateSharedMemberSummary, reopenSharedSettlement, settleSharedExpenses, replaceIncomingSharedTransactions, applyRemoteSettlementReports, collectSharedSettlementReceipts, restoreSharedSettlementReceipts, parseSharedSettlementReceipts } from './sharedFinanceRules';
import { applyCascadeTransactionDelete, calculateAccountBalances } from './financeRules';
import { prepareRestoredBackupTransactions } from './fullBackup';

const account: BankAccount = { id: 'bank', name: 'Synthetic bank', institution: 'Test', type: 'checking', initialBalance: 100, includeInTotal: true, color: '#000000' };
const base: Transaction = { id: 'owed-to-me', description: 'Synthetic shared', amount: 100, date: '2026-11-11', competenceMonth: '2026-11',
  type: 'expense', status: 'pending', categoryId: 'food', paymentMethod: 'cash', recurrence: 'single',
  isShared: true, sharedMemberId: 'member', sharedAmount: 50, sharedPaidBy: 'me', sharedStatus: 'pending' };
const input = { memberId: 'member', month: '2026-11', memberName: 'Synthetic member', accountId: account.id, date: '2026-11-12', settlementId: 'batch-one' };

test('local receipts survive reload and reopen a zero-net mirror settlement as one group', () => {
  const a={...base,id:'tx-mirror-a'};
  const b={...base,id:'tx-mirror-b',sharedPaidBy:'member' as const};
  const settled=settleSharedExpenses([a,b],[account],input).transactions;
  const receipts=JSON.stringify(collectSharedSettlementReceipts(settled));
  const reloaded=restoreSharedSettlementReceipts([a,b],receipts,[]);
  assert.ok(reloaded.every(tx=>tx.sharedSettlementId===input.settlementId && tx.sharedSettledAccountId===account.id));
  assert.equal(reopenSharedSettlement(reloaded,a.id).affectedCount,2);
});

test('remote settlement never confirms own cash after reload, and local receipt wins over stale remote state', () => {
  const mirror={...base,id:'tx-mirror-one',sharedPaidBy:'member' as const};
  const remote={...mirror,sharedStatus:'received' as const};
  const newLocal=restoreSharedSettlementReceipts([remote],undefined,[]);
  assert.equal(newLocal[0].sharedStatus,'pending');
  assert.equal(newLocal[0].sharedRemoteStatus,'received');
  const settled=settleSharedExpenses([mirror],[account],{...input,txId:mirror.id}).transactions;
  const localMovements=settled.filter(tx=>!tx.id.startsWith('tx-mirror-'));
  const restored=restoreSharedSettlementReceipts([mirror],JSON.stringify(collectSharedSettlementReceipts(settled)),localMovements);
  assert.equal(restored[0].sharedStatus,'received');
  assert.equal(restored[0].sharedSettlementId,input.settlementId);
  assert.equal(reopenSharedSettlement([...localMovements,...restored],mirror.id).transactions.length,1);
  const legacy=restoreSharedSettlementReceipts([mirror],undefined,localMovements);
  assert.equal(legacy[0].sharedSettledAccountId,account.id);
});

test('receipt parser rejects malformed, duplicated and impossible-date records', () => {
  assert.throws(()=>parseSharedSettlementReceipts('{}'));
  assert.throws(()=>parseSharedSettlementReceipts([{id:'tx-mirror-a',status:'received',date:'2026-02-30'}]));
  assert.throws(()=>parseSharedSettlementReceipts([{id:'tx-mirror-a',status:'pending'},{id:'tx-mirror-a',status:'received'}]));
});

test('remote settlement informs the owner without confirming cash or overwriting local settlement identity', () => {
  const reported=applyRemoteSettlementReports([base],[{shared_sync_id:base.id,status:'received',date:'2026-11-12'}]);
  assert.equal(reported[0].sharedRemoteStatus,'received');
  assert.equal(reported[0].sharedStatus,'pending');
  assert.equal(calculateAccountBalances([account],reported,'2026-11')[0].currentBalance,100);
  const local=settleSharedExpenses(reported,[account],input).transactions;
  const reopenedRemote=applyRemoteSettlementReports(local,[{shared_sync_id:base.id,status:'pending'}]);
  assert.equal(reopenedRemote.find(tx=>tx.id===base.id)?.sharedStatus,'received');
  assert.equal(reopenedRemote.find(tx=>tx.id===base.id)?.sharedSettlementId,input.settlementId);
  assert.equal(calculateAccountBalances([account],reopenedRemote,'2026-11')[0].currentBalance,150);
  assert.equal(applyRemoteSettlementReports(reported,[])[0].sharedRemoteStatus,undefined);
  const mirror={...base,id:'tx-mirror-source',sharedStatus:'received' as const,sharedSettledAccountId:'private-account',sharedSettlementId:'private-settlement'};
  const refreshed=replaceIncomingSharedTransactions([mirror],[{...mirror,sharedSettledAccountId:undefined,sharedSettlementId:undefined}]);
  assert.equal(refreshed[0].sharedSettledAccountId,'private-account');
  assert.equal(refreshed[0].sharedSettlementId,'private-settlement');
});

test('incoming domestic mirror remains visible and settleable without treating companion travel as domestic', () => {
  const mirror = { ...base, id: 'tx-mirror-incoming', sharedPaidBy: 'member' as const, isCompanionOnlyExpense: true };
  const travel = { ...base, id: 'travel-companion', isCompanionOnlyExpense: true };
  const summary = calculateSharedMemberSummary([mirror, travel], 'member', '2026-11');
  assert.equal(summary.iOweMemberMonthAmount, 50);
  assert.equal(summary.monthTxs.length, 1);
  const result = settleSharedExpenses([mirror, travel], [account], { ...input, txId: mirror.id });
  assert.equal(result.netAmount, -50);
  assert.equal(result.affectedCount, 1);
  assert.equal(calculateAccountBalances([account], result.transactions, '2026-11')[0].currentBalance, 50);
});

test('successful incoming refresh replaces the snapshot and removes revoked or deleted mirrors', () => {
  const removed = { ...base, id: 'tx-mirror-removed' };
  const updated = { ...base, id: 'tx-mirror-current', sharedAmount: 20 };
  const before = [base, removed, { ...updated, sharedAmount: 10 }];
  const next = replaceIncomingSharedTransactions(before, [updated]);
  assert.equal(next.length,2);
  assert.equal(next[0],base);
  assert.equal(next[1].id,updated.id);
  assert.equal(next[1].sharedAmount,20);
  assert.deepEqual(replaceIncomingSharedTransactions(next, []), [base]);
  assert.equal(before[2].sharedAmount, 10);
});

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

test('installment collection includes only the selected competence and leaves future shares pending', () => {
  const rows = Array.from({length:12}, (_, i) => ({...base, id:`installment-${i}`, amount:119.59,
    sharedAmount:i<2?59.8:59.79, recurrence:'installment' as const, installmentNumber:i+1, installmentTotal:12,
    competenceMonth:i===0?'2026-12':`2027-${String(i).padStart(2,'0')}`}));
  const summary=calculateSharedMemberSummary(rows,'member','2026-12');
  assert.equal(summary.owedToMeMonthAmount,59.8);
  assert.equal(summary.futureInstallmentReceivable,657.7);
  const result=settleSharedExpenses(rows,[account],{...input,month:'2026-12',date:'2026-12-05'});
  assert.equal(result.netAmount,59.8);
  assert.equal(result.affectedCount,1);
  assert.equal(result.transactions.filter(tx=>tx.sharedStatus==='pending').length,11);
});
