import assert from 'node:assert/strict';
import test from 'node:test';
import type { Transaction } from '../types/finance';
import {
  calculateCardCommitmentByMonth,
  describeCommitmentAfterPurchase,
  getCommitmentAlerts,
  listCardCommitmentItems,
  normalizeCommitmentLimit,
} from './cardCommitment';

let seq = 0;
const tx = (over: Partial<Transaction>): Transaction =>
  ({
    id: `t${++seq}`, description: 'x', amount: 100, date: '2026-12-05', competenceMonth: '2026-12', type: 'expense',
    status: 'pending', categoryId: 'c', paymentMethod: 'credit_card', recurrence: 'single', ...over,
  }) as Transaction;
const income = (month: string, amount: number, over: Partial<Transaction> = {}) =>
  tx({ type: 'income', amount, competenceMonth: month, date: `${month}-05`, paymentMethod: 'pix', accountId: 'a1', ...over });
const card = (month: string, amount: number, over: Partial<Transaction> = {}) =>
  tx({ creditCardId: 'c1', amount, competenceMonth: month, date: `${month}-02`, ...over });
const row = (rows: ReturnType<typeof calculateCardCommitmentByMonth>, month: string) => rows.find((r) => r.month === month)!;

test('gera 3 meses para trás e 9 para frente a partir do mês de referência', () => {
  const rows = calculateCardCommitmentByMonth({ transactions: [], referenceMonth: '2026-11' });
  assert.equal(rows.length, 13);
  assert.equal(rows[0].month, '2026-08');
  assert.equal(rows[12].month, '2027-08');
});

test('porcentagem = total do cartão ÷ renda lançada ou prevista do mês', () => {
  const rows = calculateCardCommitmentByMonth({
    referenceMonth: '2026-11',
    transactions: [
      income('2026-12', 6000), income('2026-12', 2000, { status: 'paid' }),
      card('2026-12', 1500), card('2026-12', 500, { recurrence: 'installment', installmentNumber: 2, installmentTotal: 10 }),
    ],
  });
  const dec = row(rows, '2026-12');
  assert.equal(dec.income, 8000);
  assert.equal(dec.cardTotal, 2000);
  assert.equal(dec.installmentTotal, 500);
  assert.equal(dec.otherTotal, 1500);
  assert.equal(dec.cardPercent, 25);
  assert.equal(dec.installmentPercent, 6.3);
});

test('mês sem renda lançada mostra só o valor, sem porcentagem e sem média', () => {
  const rows = calculateCardCommitmentByMonth({
    referenceMonth: '2026-11', limitPercent: 30,
    transactions: [income('2026-10', 5000), income('2026-11', 5000), card('2026-12', 900)],
  });
  const dec = row(rows, '2026-12');
  assert.equal(dec.income, 0);
  assert.equal(dec.cardTotal, 900);
  assert.equal(dec.cardPercent, null);
  assert.equal(dec.status, 'no_income');
});

test('status segue o limite e o aviso', () => {
  const base = { referenceMonth: '2026-11', limitPercent: 30, warnPercent: 80 };
  const run = (amount: number) =>
    row(calculateCardCommitmentByMonth({ ...base, transactions: [income('2026-12', 1000), card('2026-12', amount)] }), '2026-12').status;
  assert.equal(run(200), 'ok');
  assert.equal(run(240), 'warning'); // 24% = 80% do limite de 30%
  assert.equal(run(300), 'over');
  assert.equal(
    row(calculateCardCommitmentByMonth({ referenceMonth: '2026-11', transactions: [income('2026-12', 1000), card('2026-12', 900)] }), '2026-12').status,
    'no_limit'
  );
});

test('ignora pagamento de fatura, transferências, gasto de acompanhante e compras pagas por familiar', () => {
  const rows = calculateCardCommitmentByMonth({
    referenceMonth: '2026-11',
    transactions: [
      income('2026-12', 1000),
      card('2026-12', 100),
      card('2026-12', 999, { isInvoicePayment: true }),
      card('2026-12', 888, { isCompanionOnlyExpense: true }),
      card('2026-12', 777, { sharedPaidBy: 'member' }),
      income('2026-12', 5000, { type: 'transfer' }),
      income('2026-12', 3000, { sharedPaidBy: 'member' }),
    ],
  });
  const dec = row(rows, '2026-12');
  assert.equal(dec.cardTotal, 100);
  assert.equal(dec.income, 1000);
});

test('lista as compras do mês, maior primeiro, com o rótulo da parcela', () => {
  const items = listCardCommitmentItems(
    [
      card('2026-12', 50, { description: 'Padaria' }),
      card('2026-12', 400, { description: 'Notebook', recurrence: 'installment', installmentNumber: 3, installmentTotal: 10 }),
      card('2027-01', 999, { description: 'Outro mês' }),
    ],
    '2026-12'
  );
  assert.deepEqual(items.map((i) => i.description), ['Notebook', 'Padaria']);
  assert.equal(items[0].installmentLabel, '3/10');
  assert.equal(items[1].installmentLabel, '');
});

test('alertas só do mês atual até os próximos 2, e só com aviso ou acima do limite', () => {
  const rows = calculateCardCommitmentByMonth({
    referenceMonth: '2026-11', limitPercent: 30,
    transactions: [
      income('2026-10', 1000), card('2026-10', 900), // mês passado: não alerta
      income('2026-11', 1000), card('2026-11', 100),
      income('2026-12', 1000), card('2026-12', 350),
      income('2027-01', 1000), card('2027-01', 250),
      income('2027-02', 1000), card('2027-02', 900), // fora da janela de 2 meses
    ],
  });
  const alerts = getCommitmentAlerts(rows, '2026-11');
  assert.deepEqual(alerts.map((a) => [a.month, a.status]), [['2026-12', 'over'], ['2027-01', 'warning']]);
});

test('limite inválido vira "sem limite"', () => {
  assert.equal(normalizeCommitmentLimit(0), null);
  assert.equal(normalizeCommitmentLimit(-5), null);
  assert.equal(normalizeCommitmentLimit('abc'), null);
  assert.equal(normalizeCommitmentLimit(30), 30);
  assert.equal(normalizeCommitmentLimit(250), 100);
});

test('depois de lançar compra no cartão avisa só se o mês ficou perto ou acima do limite', () => {
  const base = [income('2026-12', 1000), card('2026-12', 200)];
  const created = [card('2026-12', 150)];
  const all = [...created, ...base];
  assert.match(
    describeCommitmentAfterPurchase({ transactions: all, created, limitPercent: 30 }) ?? '',
    /Dezembro de 2026 ficou em 35% da renda no cartão \(acima do limite de 30%\)/
  );
  assert.equal(describeCommitmentAfterPurchase({ transactions: all, created, limitPercent: 60 }), null);
  assert.equal(describeCommitmentAfterPurchase({ transactions: all, created }), null, 'sem limite não avisa');
  assert.equal(describeCommitmentAfterPurchase({ transactions: all, created: [income('2026-12', 10)], limitPercent: 30 }), null, 'só compra no cartão');
});
