import assert from 'node:assert/strict';
import test from 'node:test';
import type { FamilyMember, Transaction } from '../types/finance';
import { describeLearnedSharing, getDescriptionLearningKey, learnSharingFromHistory } from './learningRules';

const fran = { id: 'fam-fran', name: 'FRAN', color: '#ec4899', relationship: 'cônjuge' } as FamilyMember;
let counter = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: `t${counter++}`, description: 'Apolo', amount: 100, date: '2026-11-0' + (1 + (counter % 8)), competenceMonth: '2026-11',
  type: 'expense', status: 'pending', categoryId: 'cat-mercado', paymentMethod: 'pix', recurrence: 'single', ...over,
});
const sharedHalf = (over: Partial<Transaction> = {}) =>
  tx({ isShared: true, sharedMemberId: 'fam-fran', sharedAmount: 50, sharedPaidBy: 'me', sharedSplitMode: 'half', sharedStatus: 'pending', ...over });

test('learns that a recurring establishment is split in half with the same person', () => {
  const learned = learnSharingFromHistory('apolo', [sharedHalf(), sharedHalf(), sharedHalf()], [fran]);
  assert.ok(learned);
  assert.equal(learned.memberId, 'fam-fran');
  assert.equal(learned.splitMode, 'half');
  assert.equal(learned.paidBy, 'me');
  assert.equal(learned.sharedCount, 3);
  assert.match(describeLearnedSharing(learned), /Dividido com FRAN \(metade, você pagou\)/);
});

test('matches the establishment ignoring case, accents, installment suffixes and extra words', () => {
  const history = [sharedHalf({ description: 'Apolo (1/3)' }), sharedHalf({ description: 'APOLO supermercado' })];
  assert.ok(learnSharingFromHistory('apolo', history, [fran]));
  assert.equal(getDescriptionLearningKey('  Mercadô Livre!! '), 'mercado livre');
});

test('learns a custom percentage when the proportion is stable', () => {
  const history = [sharedHalf({ sharedAmount: 30 }), sharedHalf({ sharedAmount: 30 })];
  const learned = learnSharingFromHistory('apolo', history, [fran]);
  assert.ok(learned);
  assert.equal(learned.splitMode, 'percentage');
  assert.equal(learned.percentage, 30);
});

test('does not learn from a single occurrence, mixed habits, other people or unstable proportions', () => {
  assert.equal(learnSharingFromHistory('apolo', [sharedHalf()], [fran]), null, 'uma vez só não é hábito');
  assert.equal(
    learnSharingFromHistory('apolo', [sharedHalf(), tx({}), tx({}), tx({})], [fran]),
    null,
    'dividiu só 1 de 4'
  );
  assert.equal(
    learnSharingFromHistory('apolo', [sharedHalf(), sharedHalf({ sharedMemberId: 'fam-outro' })], [fran]),
    null,
    'pessoas diferentes'
  );
  assert.equal(
    learnSharingFromHistory('apolo', [sharedHalf(), sharedHalf({ sharedPaidBy: 'member' })], [fran]),
    null,
    'pagadores diferentes'
  );
  assert.equal(
    learnSharingFromHistory('apolo', [sharedHalf({ sharedAmount: 50 }), sharedHalf({ sharedAmount: 20 })], [fran]),
    null,
    'proporção instável'
  );
  assert.equal(learnSharingFromHistory('apolo', [sharedHalf(), sharedHalf()], []), null, 'familiar removido');
});

test('ignores unrelated establishments, short names, trips, mirrors and invoice payments', () => {
  const history = [sharedHalf({ description: 'Padaria' }), sharedHalf({ description: 'Padaria' })];
  assert.equal(learnSharingFromHistory('apolo', history, [fran]), null);
  assert.equal(learnSharingFromHistory('a', [sharedHalf(), sharedHalf()], [fran]), null);
  assert.equal(learnSharingFromHistory('apolo', [sharedHalf({ tripId: 't1' }), sharedHalf({ tripId: 't1' })], [fran]), null);
  assert.equal(
    learnSharingFromHistory('apolo', [sharedHalf({ id: 'tx-mirror-1' }), sharedHalf({ id: 'tx-mirror-2' })], [fran]),
    null
  );
  assert.equal(
    learnSharingFromHistory('apolo', [sharedHalf({ isInvoicePayment: true }), sharedHalf({ isInvoicePayment: true })], [fran]),
    null
  );
});
