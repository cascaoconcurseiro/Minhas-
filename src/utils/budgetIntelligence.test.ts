import assert from 'node:assert/strict';
import test from 'node:test';
import type { Category, Transaction } from '../types/finance';
import { assessBudgetPace, suggestBudgets } from './budgetIntelligence';

const category = (id: string, over: Partial<Category> = {}): Category => ({
  id, name: id === 'cat-mercado' ? 'Supermercado' : id, type: 'expense', bucket: 'essential', monthlyBudget: 0, color: '#000', icon: 'tag', ...over,
});
let n = 0;
const spend = (categoryId: string, month: string, amount: number, day = '10'): Transaction => ({
  id: `t${n++}`, description: 'x', amount, date: `${month}-${day}`, competenceMonth: month, type: 'expense',
  status: 'paid', categoryId, paymentMethod: 'pix', recurrence: 'single', accountId: 'a1',
});

test('suggests a ceiling from the average of the last months, with a margin rounded up to ten', () => {
  const [suggestion] = suggestBudgets(
    [category('cat-mercado')],
    [spend('cat-mercado', '2026-08', 800), spend('cat-mercado', '2026-09', 900), spend('cat-mercado', '2026-10', 1000)],
    '2026-11'
  );
  assert.equal(suggestion.averageSpent, 900);
  assert.equal(suggestion.suggestedBudget, 990, '900 × 1,10');
  assert.equal(suggestion.monthsConsidered, 3);
  assert.deepEqual(suggestion.monthlySpent, [800, 900, 1000]);
  assert.equal(suggestion.currentBudget, 0);
});

test('only suggests with enough history, enough difference, and for consumption categories', () => {
  const history = [spend('cat-mercado', '2026-09', 900), spend('cat-mercado', '2026-10', 1000)];
  assert.equal(suggestBudgets([category('cat-mercado')], [spend('cat-mercado', '2026-10', 1000)], '2026-11').length, 0, 'só 1 mês');
  assert.equal(suggestBudgets([category('cat-mercado', { monthlyBudget: 1000 })], history, '2026-11').length, 0, 'teto atual já está perto');
  assert.equal(suggestBudgets([category('cat-mercado', { monthlyBudget: 400 })], history, '2026-11').length, 1, 'teto atual muito baixo');
  assert.equal(suggestBudgets([category('cat-aportes', { bucket: 'financial' })], [spend('cat-aportes', '2026-09', 500), spend('cat-aportes', '2026-10', 500)], '2026-11').length, 0, 'aporte não é teto');
  assert.equal(suggestBudgets([category('cat-mercado')], [spend('cat-mercado', '2026-11', 900), spend('cat-mercado', '2026-12', 900)], '2026-11').length, 0, 'o mês atual e os futuros não entram');
});

test('warns when spending is ahead of the month, and when it already went over the ceiling', () => {
  const cats = [category('cat-mercado', { monthlyBudget: 1000 })];
  const ahead = assessBudgetPace(cats, [spend('cat-mercado', '2026-11', 700)], '2026-11-12');
  assert.equal(ahead.length, 1);
  assert.equal(ahead[0].level, 'ahead');
  assert.equal(ahead[0].percentSpent, 70);
  assert.equal(ahead[0].percentOfMonth, 40);
  assert.match(ahead[0].message, /já gastou 70% do teto e o mês está em 40%/);

  const over = assessBudgetPace(cats, [spend('cat-mercado', '2026-11', 1200)], '2026-11-12');
  assert.equal(over[0].level, 'over');
  assert.match(over[0].message, /passou do teto/);
});

test('stays quiet when spending is on pace, early in the month, or without a ceiling', () => {
  const cats = [category('cat-mercado', { monthlyBudget: 1000 })];
  assert.equal(assessBudgetPace(cats, [spend('cat-mercado', '2026-11', 400)], '2026-11-12').length, 0, 'no ritmo');
  assert.equal(assessBudgetPace(cats, [spend('cat-mercado', '2026-11', 700)], '2026-11-03').length, 0, 'começo do mês');
  assert.equal(assessBudgetPace([category('cat-mercado')], [spend('cat-mercado', '2026-11', 900)], '2026-11-12').length, 0, 'sem teto');
});
