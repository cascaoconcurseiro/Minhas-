import assert from 'node:assert/strict';
import test from 'node:test';
import { isSharedTransactionCreatedByOther } from './financeRules';
import type { Transaction } from '../types/finance';

const base = { id: 't1', description: 'x', amount: 1, date: '2026-11-01', type: 'expense' } as Transaction;

test('própria ou sem origem: pode editar', () => {
  assert.equal(isSharedTransactionCreatedByOther({ ...base, isShared: true }, 'a@x.com'), false);
  assert.equal(isSharedTransactionCreatedByOther({ ...base, isShared: true, sharedOriginEmail: 'A@x.com' }, 'a@x.com'), false);
  assert.equal(isSharedTransactionCreatedByOther(base, 'a@x.com'), false);
});

test('criada por outra pessoa: bloqueia', () => {
  assert.equal(isSharedTransactionCreatedByOther({ ...base, isShared: true, sharedOriginEmail: 'b@x.com' }, 'a@x.com'), true);
  assert.equal(isSharedTransactionCreatedByOther({ ...base, id: 'tx-mirror-1' }, 'a@x.com'), true);
});
