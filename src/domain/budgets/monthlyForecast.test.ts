import test from 'node:test';
import assert from 'node:assert/strict';
import type { BankAccount, Transaction } from '../../types/finance';
import { buildMonthlyForecast } from './monthlyForecast';

const account: BankAccount = { id: 'bank', name: 'Conta', institution: 'Teste', type: 'checking', initialBalance: 0, includeInTotal: true, color: '#000' };
const base: Transaction = { id: 'x', description: 'x', amount: 0, date: '2026-12-01', competenceMonth: '2026-12', type: 'expense',
  status: 'pending', categoryId: 'cat-outros', paymentMethod: 'cash', recurrence: 'single' };
const tx = (over: Partial<Transaction>): Transaction => ({ ...base, ...over });
const run = (transactions: Transaction[], includeEstimate = false, startBalance = 1000, includeIncomeEstimate = false) =>
  buildMonthlyForecast({ accounts: [account], transactions, startBalance, referenceDate: '2026-11-23', months: 6, includeEstimate, includeIncomeEstimate });

test('soma entradas, faturas e contas do banco por mês e acumula o saldo a partir de hoje', () => {
  const forecast = run([
    tx({ id: 'sal1', type: 'income', amount: 5000, accountId: 'bank', competenceMonth: '2026-12' }),
    tx({ id: 'sal2', type: 'income', amount: 5000, accountId: 'bank', competenceMonth: '2027-01', date: '2027-01-01' }),
    tx({ id: 'luz', amount: 400, accountId: 'bank', competenceMonth: '2026-12' }),
    tx({ id: 'c1', amount: 1500, creditCardId: 'card', paymentMethod: 'credit_card', competenceMonth: '2026-12', installmentGroupId: 'g' }),
    tx({ id: 'c2', amount: 700, creditCardId: 'card', paymentMethod: 'credit_card', competenceMonth: '2027-01', installmentGroupId: 'g' }),
  ]);
  const [nov, dec, jan] = forecast.rows;
  assert.equal(nov.month, '2026-11');
  assert.deepEqual([dec.income, dec.cardInvoices, dec.bankExpenses, dec.net, dec.balance], [5000, 1500, 400, 3100, 4100]);
  assert.deepEqual([jan.income, jan.cardInvoices, jan.net, jan.balance], [5000, 700, 4300, 8400]);
  assert.equal(nov.balance, 1000);
});

test('o que já foi pago, pagamento de fatura, espelho e "eu devo" não entram', () => {
  const forecast = run([
    tx({ id: 'pago', amount: 300, accountId: 'bank', status: 'paid' }),
    tx({ id: 'fat', amount: 900, accountId: 'bank', isInvoicePayment: true }),
    tx({ id: 'tx-mirror-1', amount: 80, accountId: 'bank' }),
    tx({ id: 'devo', amount: 60, accountId: 'bank', isShared: true, sharedPaidBy: 'member', sharedAmount: 30, sharedMemberId: 'p' }),
  ]);
  assert.equal(forecast.rows[1].bankExpenses, 0);
  assert.equal(forecast.rows[1].balance, 1000);
});

test('conta atrasada de mês passado entra no mês atual e é contada', () => {
  const forecast = run([tx({ id: 'atraso', amount: 250, accountId: 'bank', competenceMonth: '2026-10', date: '2026-10-05' })]);
  assert.equal(forecast.rows[0].bankExpenses, 250);
  assert.equal(forecast.overdueCount, 1);
  assert.equal(forecast.rows[0].balance, 750);
});

test('mostra a parte que as pessoas devem e o saldo se elas pagarem', () => {
  const forecast = run([
    tx({ id: 'cart', amount: 1000, creditCardId: 'card', paymentMethod: 'credit_card', installmentGroupId: 'g', isShared: true,
      sharedPaidBy: 'me', sharedAmount: 400, sharedMemberId: 'fran', sharedStatus: 'pending' }),
  ]);
  const dec = forecast.rows[1];
  assert.equal(dec.balance, 0);
  assert.equal(dec.owedByPeople, 400);
  assert.equal(dec.balanceWithOwed, 400);
  assert.equal(forecast.rows[2].balanceWithOwed, 400, 'o que devem fica somado nos meses seguintes');
});

test('estimativa de compras novas: média das compras à vista, só o que falta nos meses com compra', () => {
  const avista = (id: string, amount: number, month: string) =>
    tx({ id, amount, creditCardId: 'card', paymentMethod: 'credit_card', competenceMonth: month });
  const transactions = [avista('a', 3000, '2026-12'), avista('b', 1000, '2027-01'),
    tx({ id: 'parc', amount: 500, creditCardId: 'card', paymentMethod: 'credit_card', competenceMonth: '2027-02', installmentGroupId: 'g' })];
  const off = run(transactions, false);
  const on = run(transactions, true);
  assert.deepEqual(on.estimate, { monthlyAverage: 2000, monthsUsed: 2 });
  assert.equal(off.rows[1].estimatedPurchases, 0);
  assert.equal(on.rows[1].estimatedPurchases, 0, 'dezembro já tem 3.000 lançados, acima da média');
  assert.equal(on.rows[2].estimatedPurchases, 1000, 'janeiro tem 1.000 lançados: faltam 1.000 para a média');
  assert.equal(on.rows[3].estimatedPurchases, 2000);
  assert.ok(on.rows[5].balance < off.rows[5].balance);
});

test('avisa o primeiro mês negativo e quando as entradas acabam', () => {
  const forecast = run([
    tx({ id: 'sal', type: 'income', amount: 3000, accountId: 'bank', competenceMonth: '2026-12' }),
    tx({ id: 'c3', amount: 4000, creditCardId: 'card', paymentMethod: 'credit_card', competenceMonth: '2027-02', installmentGroupId: 'g' }),
  ], false, 0);
  assert.equal(forecast.incomeEndsAfter, '2026-12');
  assert.equal(forecast.firstNegativeMonth, '2027-02');
  assert.equal(run([], false, 100).firstNegativeMonth, null);
});

test('estimativa de entrada: depois da última entrada lançada usa a mediana dos últimos meses e ignora o 13º', () => {
  const income = (id: string, amount: number, month: string) =>
    tx({ id, type: 'income', amount, accountId: 'bank', competenceMonth: month, date: `${month}-01` });
  const transactions = [income('a', 11000, '2026-12'), income('b', 8000, '2027-01'), income('c', 8200, '2027-02')];
  const off = run(transactions, false, 0, false);
  const on = run(transactions, false, 0, true);
  assert.deepEqual(on.incomeEstimate, { monthlyAmount: 8200, monthsUsed: 3 }, 'mediana de 11000, 8000 e 8200');
  assert.equal(on.rows[3].estimatedIncome, 0, 'fevereiro tem entrada lançada: não recebe estimativa');
  assert.equal(on.rows[4].estimatedIncome, 8200, 'a estimativa começa em março, depois da última entrada');
  assert.equal(on.rows[5].estimatedIncome, 8200);
  assert.equal(on.rows[0].estimatedIncome, 0, 'mês atual, antes da última entrada, não recebe estimativa');
  assert.equal(off.incomeEstimate, null);
  assert.equal(off.rows[4].estimatedIncome, 0);
  assert.equal(on.rows[5].balance - off.rows[5].balance, 8200 * 2);
});

test('sem entrada lançada, ou com entrada até o último mês, não há estimativa de entrada', () => {
  assert.equal(run([], false, 0, true).incomeEstimate, null);
  const all = ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04'].map((month) =>
    tx({ id: `i-${month}`, type: 'income', amount: 1000, accountId: 'bank', competenceMonth: month, date: `${month}-01` }));
  assert.equal(run(all, false, 0, true).incomeEstimate, null);
});
