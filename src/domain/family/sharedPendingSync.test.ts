import test from 'node:test';
import assert from 'node:assert/strict';
import type { FamilyMember, Transaction } from '../../types/finance';
import { findUnsentSharedTransactions, getSharedSyncId } from './sharedFinanceRules';

const fran: FamilyMember = {
  id: 'fam-1', name: 'FRAN', relationship: 'cônjuge', color: '#000',
  email: 'Fran@Example.com', inviteStatus: 'accepted', direction: 'outgoing',
};
const shared = (id: string, extra: Partial<Transaction> = {}): Transaction => ({
  id, description: id, amount: 100, date: '2026-12-01', competenceMonth: '2026-12', type: 'expense',
  status: 'pending', categoryId: 'cat-outros', paymentMethod: 'credit_card', recurrence: 'single',
  isShared: true, sharedMemberId: 'fam-1', sharedAmount: 50, sharedPaidBy: 'me', sharedStatus: 'pending',
  ...extra,
} as Transaction);

test('compartilhados lançados antes do aceite do convite são enviados à pessoa vinculada', () => {
  const transactions = [shared('tx-a'), shared('tx-b'), shared('tx-c', { sharedSyncId: 'sync-c' })];
  const pending = findUnsentSharedTransactions(transactions, [fran], new Set(['tx-a']), 'eu@example.com');
  assert.equal(pending.length, 1);
  assert.equal(pending[0].partnerEmail, 'fran@example.com');
  assert.equal(pending[0].memberId, 'fam-1');
  assert.deepEqual(pending[0].transactions.map((tx) => tx.id), ['tx-b', 'tx-c']);
  assert.equal(getSharedSyncId(transactions[2]), 'sync-c');
});

test('nada a enviar quando tudo já está no servidor', () => {
  const transactions = [shared('tx-a'), shared('tx-b')];
  assert.deepEqual(findUnsentSharedTransactions(transactions, [fran], new Set(['tx-a', 'tx-b']), 'eu@example.com'), []);
});

test('não envia para convite pendente, sem e-mail, nem para mim mesmo', () => {
  const transactions = [shared('tx-a')];
  for (const member of [
    { ...fran, inviteStatus: 'invited' as const },
    { ...fran, email: undefined },
    { ...fran, email: 'eu@example.com' },
  ]) {
    assert.deepEqual(findUnsentSharedTransactions(transactions, [member], new Set(), 'eu@example.com'), []);
  }
});

test('ignora espelhos recebidos, viagens, não compartilhados e lançamentos de outra pessoa', () => {
  const transactions = [
    shared('tx-mirror-x', { sharedSyncId: 'x' }),
    shared('tx-trip', { tripId: 'trip-1' }),
    shared('tx-solo', { isShared: false }),
    shared('tx-other', { sharedMemberId: 'fam-2' }),
    shared('tx-ok'),
  ];
  const pending = findUnsentSharedTransactions(transactions, [fran], new Set(), 'eu@example.com');
  assert.deepEqual(pending[0].transactions.map((tx) => tx.id), ['tx-ok']);
});

test('convite recebido (direção de entrada) usa o e-mail de quem convidou', () => {
  const owner: FamilyMember = {
    id: 'fam-inv-w', name: 'W', relationship: 'cônjuge', color: '#000',
    invitedByEmail: 'w@example.com', inviteStatus: 'accepted', direction: 'incoming',
  };
  const pending = findUnsentSharedTransactions([shared('tx-1', { sharedMemberId: 'fam-inv-w' })], [owner], new Set(), 'eu@example.com');
  assert.equal(pending[0].partnerEmail, 'w@example.com');
});
