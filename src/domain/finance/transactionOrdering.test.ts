import assert from 'node:assert/strict';
import test from 'node:test';
import type { Transaction } from '../../types/finance';
import { calculateInvestmentIncomeSummary } from './personalDre.ts';
import { sortChronologically } from './transactionOrdering.ts';
import { calculateSharedMemberSummary } from '../family/sharedFinanceRules.ts';

const tx = (id: string, date: string, extra: Partial<Transaction> = {}): Transaction => ({
  id, description: id, amount: 10, date, competenceMonth: date.slice(0, 7), type: 'expense', status: 'paid',
  categoryId: 'cat-mercado', paymentMethod: 'pix', recurrence: 'single', ...extra,
});

test('sortChronologically ordena do dia mais antigo ao mais novo, mantém a ordem original no mesmo dia e não altera a lista recebida', () => {
  const input = [tx('c', '2026-12-20'), tx('a1', '2026-12-02'), tx('b', '2026-12-10'), tx('a2', '2026-12-02')];
  const sorted = sortChronologically(input);
  assert.deepEqual(sorted.map((item) => item.id), ['a1', 'a2', 'b', 'c']);
  assert.deepEqual(input.map((item) => item.id), ['c', 'a1', 'b', 'a2']);
});

test('lançamentos compartilhados de um familiar no mês saem em ordem cronológica', () => {
  const shared = (id: string, date: string) => tx(id, date, {
    isShared: true, sharedMemberId: 'm1', sharedAmount: 5, sharedPaidBy: 'me', sharedStatus: 'pending', sharedSplitMode: 'half',
  });
  const summary = calculateSharedMemberSummary([shared('x', '2026-12-25'), shared('y', '2026-12-03'), shared('z', '2026-12-14')], 'm1', '2026-12');
  assert.deepEqual(summary.monthTxs.map((item) => item.id), ['y', 'z', 'x']);
});

test('rendimentos de investimento do mês saem em ordem cronológica', () => {
  const income = (id: string, date: string) => tx(id, date, { type: 'income', categoryId: 'cat-rendimentos' });
  const summary = calculateInvestmentIncomeSummary([income('b', '2026-12-20'), income('a', '2026-12-01')], '2026-12');
  assert.deepEqual(summary.monthTransactions.map((item) => item.id), ['a', 'b']);
});
