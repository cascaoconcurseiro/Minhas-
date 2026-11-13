import assert from 'node:assert/strict';
import test from 'node:test';
import type { Transaction } from '../types/finance';
import { assessAmount, decideChoice, findProbableDuplicate, learnPaymentHabit } from './decisionEngine';

let n = 0;
const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: `t${n++}`, description: 'Apolo', amount: 100, date: '2026-10-' + String(10 + (n % 15)).padStart(2, '0'),
  competenceMonth: '2026-10', type: 'expense', status: 'paid', categoryId: 'cat-mercado',
  paymentMethod: 'pix', recurrence: 'single', accountId: 'acc-a', ...over,
});

test('decideChoice picks the dominant option with confidence and reason', () => {
  const decision = decideChoice(['acc-a', 'acc-a', 'acc-a']);
  assert.ok(decision);
  assert.equal(decision.value, 'acc-a');
  assert.equal(decision.support, 3);
  assert.ok(decision.confidence >= 0.8);
  assert.match(decision.reason, /3 de 3/);
});

test('decideChoice stays silent with too little or mixed evidence', () => {
  assert.equal(decideChoice(['acc-a']), null, 'uma observação não basta');
  assert.equal(decideChoice([]), null);
  assert.equal(decideChoice(['acc-a', 'acc-b']), null, 'empate');
  assert.equal(decideChoice(['acc-a', 'acc-b', 'acc-a', 'acc-b', 'acc-b']), null, 'hábito dividido');
  assert.equal(decideChoice([undefined, '', null]), null);
});

test('decideChoice weighs recent habits more than old ones', () => {
  const decision = decideChoice(['acc-new', 'acc-new', 'acc-new', 'acc-old', 'acc-old']);
  assert.equal(decision?.value, 'acc-new');
});

test('learnPaymentHabit learns the usual account and payment method, or the usual card', () => {
  const bank = [tx(), tx(), tx()];
  const habit = learnPaymentHabit('apolo', bank, 'expense');
  assert.equal(habit.accountId?.value, 'acc-a');
  assert.equal(habit.paymentMethod?.value, 'pix');
  assert.equal(habit.creditCardId, undefined);

  const cards = [tx({ creditCardId: 'card-1', paymentMethod: 'credit_card', accountId: undefined }), tx({ creditCardId: 'card-1', paymentMethod: 'credit_card', accountId: undefined })];
  const cardHabit = learnPaymentHabit('Apolo', [...bank, ...cards], 'credit_card');
  assert.equal(cardHabit.creditCardId?.value, 'card-1');
  assert.equal(cardHabit.accountId, undefined);

  assert.deepEqual(learnPaymentHabit('padaria', bank, 'expense'), {}, 'outro lugar não herda o hábito');
});

test('assessAmount flags a value far above the usual for that place, and only then', () => {
  const history = [tx({ amount: 100 }), tx({ amount: 120 }), tx({ amount: 110 }), tx({ amount: 90 })];
  const high = assessAmount('apolo', 400, history);
  assert.ok(high);
  assert.equal(high.typical, 105);
  assert.match(high.message, /3,8x maior que o usual/);
  assert.equal(assessAmount('apolo', 150, history), null, 'dentro do normal');
  assert.equal(assessAmount('apolo', 400, history.slice(0, 2)), null, 'pouco histórico');
  assert.equal(assessAmount('apolo', 0, history), null);
  const small = [tx({ amount: 5 }), tx({ amount: 6 }), tx({ amount: 5 })];
  assert.equal(assessAmount('apolo', 14, small), null, 'diferença absoluta pequena não incomoda');
});

test('findProbableDuplicate catches the same purchase registered twice, but not installments or fixed bills', () => {
  const existing = tx({ id: 'orig', amount: 135, date: '2026-11-11' });
  const dup = findProbableDuplicate({ description: 'APOLO', amount: 135, date: '2026-11-11' }, [existing]);
  assert.ok(dup);
  assert.equal(dup.transactionId, 'orig');
  assert.match(dup.message, /11\/11\/2026/);
  assert.ok(findProbableDuplicate({ description: 'apolo', amount: 135, date: '2026-11-13' }, [existing]), 'até 2 dias');
  assert.equal(findProbableDuplicate({ description: 'apolo', amount: 135, date: '2026-11-20' }, [existing]), null);
  assert.equal(findProbableDuplicate({ description: 'apolo', amount: 136, date: '2026-11-11' }, [existing]), null);
  assert.equal(findProbableDuplicate({ description: 'apolo', amount: 135, date: '2026-11-11' }, [existing], 'orig'), null, 'ignora o próprio lançamento ao editar');
  const fixed = tx({ amount: 135, date: '2026-11-11', recurrence: 'fixed' });
  assert.equal(findProbableDuplicate({ description: 'apolo', amount: 135, date: '2026-11-11' }, [fixed]), null);
});

test('findProbableDuplicate also covers income and transfers (transfers need the same source and destination)', () => {
  const income = tx({ id: 'sal', type: 'income', description: 'Salário', amount: 5000, date: '2026-11-05' });
  assert.ok(findProbableDuplicate({ description: 'salario', amount: 5000, date: '2026-11-05', type: 'income' }, [income]));
  assert.equal(findProbableDuplicate({ description: 'salario', amount: 5000, date: '2026-11-05' }, [income]), null, 'despesa não confunde com receita');

  const transfer = tx({ id: 'tr', type: 'transfer', description: 'Reserva', amount: 300, date: '2026-11-05', accountId: 'a', destinationAccountId: 'b' });
  const base = { description: 'reserva', amount: 300, date: '2026-11-06', type: 'transfer' as const };
  const dup = findProbableDuplicate({ ...base, accountId: 'a', destinationKey: 'b' }, [transfer]);
  assert.ok(dup);
  assert.match(dup.message, /transferência igual/);
  assert.equal(findProbableDuplicate({ ...base, accountId: 'a', destinationKey: 'c' }, [transfer]), null, 'outro destino não é duplicidade');
  assert.equal(findProbableDuplicate({ ...base, accountId: 'x', destinationKey: 'b' }, [transfer]), null, 'outra origem não é duplicidade');
});
