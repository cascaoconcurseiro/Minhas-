import assert from 'node:assert/strict';
import test from 'node:test';
import type { Transaction } from '../types/finance';
import { detectRecurringExpenses } from './recurrenceDetection';

let n = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: `t${n++}`, description: 'Netflix', amount: 55.9, date: '2026-10-10', competenceMonth: '2026-10',
  type: 'expense', status: 'paid', categoryId: 'cat-assinaturas', paymentMethod: 'credit_card',
  recurrence: 'single', creditCardId: 'card-1', ...over,
});
const monthly = (description: string, amounts: number[], startMonth: number, day = 10, extra: Partial<Transaction> = {}) =>
  amounts.map((amount, i) => {
    const month = String(startMonth + i).padStart(2, '0');
    return tx({ description, amount, date: `2026-${month}-${String(day).padStart(2, '0')}`, competenceMonth: `2026-${month}`, ...extra });
  });

test('detects a subscription that repeats every month and predicts the next date', () => {
  const found = detectRecurringExpenses(monthly('Netflix', [55.9, 55.9, 55.9, 55.9], 8), '2026-11-12');
  assert.equal(found.length, 1);
  const [netflix] = found;
  assert.equal(netflix.key, 'netflix');
  assert.equal(netflix.monthsInARow, 4);
  assert.equal(netflix.amountPattern, 'stable');
  assert.equal(netflix.dayOfMonth, 10);
  assert.equal(netflix.nextExpectedDate, '2026-12-10', 'já lançou novembro: o próximo é dezembro');
  assert.equal(netflix.missingThisMonth, false);
  assert.equal(netflix.creditCardId, 'card-1');
  assert.ok(netflix.confidence >= 0.82);
});

test('flags a subscription that has not shown up this month after its usual day', () => {
  const found = detectRecurringExpenses(monthly('Spotify', [21.9, 21.9, 21.9], 8), '2026-11-15');
  assert.equal(found[0].missingThisMonth, true);
  assert.equal(found[0].nextExpectedDate, '2026-11-10');
  const early = detectRecurringExpenses(monthly('Spotify', [21.9, 21.9, 21.9], 8), '2026-11-11');
  assert.equal(early[0].missingThisMonth, false, 'ainda dentro da tolerância');
});

test('detects a price increase on a stable subscription', () => {
  const found = detectRecurringExpenses(monthly('Netflix', [44.9, 44.9, 44.9, 55.9], 7), '2026-11-12');
  assert.deepEqual(found[0].priceChange, { from: 44.9, to: 55.9, percent: 24.5 });
  assert.equal(found[0].lastAmount, 55.9);
});

test('a variable bill (energy) is still detected but marked as variable', () => {
  const found = detectRecurringExpenses(monthly('Enel', [180, 230, 210, 260], 7, 15, { creditCardId: undefined, paymentMethod: 'boleto', accountId: 'a1' }), '2026-11-20');
  assert.equal(found.length, 1);
  assert.equal(found[0].amountPattern, 'variable');
  assert.equal(found[0].accountId, 'a1');
});

test('does not suggest one-offs, broken chains, wild amounts or erratic days', () => {
  assert.equal(detectRecurringExpenses(monthly('Netflix', [55.9, 55.9], 10), '2026-11-12').length, 0, 'só 2 meses');
  assert.equal(detectRecurringExpenses([...monthly('Cinema', [30], 5), ...monthly('Cinema', [30, 30], 9)], '2026-11-12').length, 0, 'mês faltando no meio');
  assert.equal(detectRecurringExpenses(monthly('Netflix', [55.9, 55.9, 55.9], 4), '2026-11-12').length, 0, 'parou de aparecer');
  assert.equal(detectRecurringExpenses(monthly('Mercado', [50, 400, 90], 8), '2026-11-12').length, 0, 'valor muito irregular');
  const erratic = [tx({ date: '2026-09-02', competenceMonth: '2026-09' }), tx({ date: '2026-10-25', competenceMonth: '2026-10' }), tx({ date: '2026-11-10', competenceMonth: '2026-11' })];
  assert.equal(detectRecurringExpenses(erratic, '2026-11-12').length, 0, 'dia do mês muda demais');
});

test('skips what is already scheduled, dismissed, an installment, a trip or a transfer-like item', () => {
  const base = monthly('Netflix', [55.9, 55.9, 55.9], 9);
  assert.equal(detectRecurringExpenses([...base, tx({ description: 'Netflix', recurrence: 'fixed', date: '2026-12-10' })], '2026-11-12').length, 0, 'já é fixo');
  assert.equal(detectRecurringExpenses(base, '2026-11-12', ['netflix']).length, 0, 'ignorado pela pessoa');
  assert.equal(detectRecurringExpenses(monthly('Netflix', [55.9, 55.9, 55.9], 9, 10, { recurrence: 'installment' }), '2026-11-12').length, 0);
  assert.equal(detectRecurringExpenses(monthly('Netflix', [55.9, 55.9, 55.9], 9, 10, { tripId: 'trip-1' }), '2026-11-12').length, 0);
  assert.equal(detectRecurringExpenses(monthly('Netflix', [55.9, 55.9, 55.9], 9, 10, { isInvoicePayment: true }), '2026-11-12').length, 0);
});

test('keeps the order by confidence and treats the name ignoring case and accents', () => {
  const found = detectRecurringExpenses(
    [...monthly('NETFLIX', [55.9, 55.9, 55.9, 55.9, 55.9], 6), ...monthly('Padária Pão', [20, 24, 22], 9, 5, { creditCardId: undefined, paymentMethod: 'pix' })],
    '2026-11-12'
  );
  assert.equal(found[0].key, 'netflix');
  assert.equal(found[1].key, 'padaria pao');
  assert.ok(found[0].confidence > found[1].confidence);
});
