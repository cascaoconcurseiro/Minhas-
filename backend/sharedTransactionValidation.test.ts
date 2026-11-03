import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSharedAmount } from './sharedTransactionValidation';

test('normalizes valid shared amounts at cent precision', () => {
  assert.equal(normalizeSharedAmount(150, 75), 75);
  assert.equal(normalizeSharedAmount(150, 0), 0);
  assert.equal(normalizeSharedAmount(150, undefined), 150);
  assert.equal(normalizeSharedAmount(100.01, 33.333), 33.33);
  assert.equal(normalizeSharedAmount(0.01, 0.01), 0.01);
});

test('rejects negative, non-finite, or over-total shares', () => {
  assert.equal(normalizeSharedAmount(-1, 0), null);
  assert.equal(normalizeSharedAmount(100, -0.01), null);
  assert.equal(normalizeSharedAmount(100, 100.01), null);
  assert.equal(normalizeSharedAmount(Number.NaN, 1), null);
  assert.equal(normalizeSharedAmount(Number.POSITIVE_INFINITY, 1), null);
  assert.equal(normalizeSharedAmount(100, Number.NaN), null);
  assert.equal(normalizeSharedAmount('100', 20), null);
  assert.equal(normalizeSharedAmount(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER), null);
});
