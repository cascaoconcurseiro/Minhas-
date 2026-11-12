import assert from 'node:assert/strict';
import test from 'node:test';
import type { BankAccount, CreditCard, Transaction } from '../types/finance';
import { forecastCashBalance } from './cashForecast';

const account = (over: Partial<BankAccount> = {}): BankAccount => ({
  id: 'a1', name: 'Conta', institution: 'Banco', type: 'checking', initialBalance: 1000, color: '#000', includeInTotal: true, ...over,
});
const card: CreditCard = { id: 'c1', name: 'Cartão', brand: 'Visa', limit: 5000, closingDay: 25, dueDay: 5, defaultAccountId: 'a1', color: '#000' };
let n = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: `t${n++}`, description: 'x', amount: 100, date: '2026-11-20', competenceMonth: '2026-11', type: 'expense',
  status: 'pending', categoryId: 'c', paymentMethod: 'pix', recurrence: 'single', accountId: 'a1', ...over,
});
const at = (forecast: ReturnType<typeof forecastCashBalance>, date: string) => forecast?.points.find((p) => p.date === date)?.balance;

test('projects the balance day by day, across the month change', () => {
  const forecast = forecastCashBalance(
    [account()], [card],
    [
      tx({ description: 'Salário', type: 'income', amount: 3000, date: '2026-11-05', status: 'paid' }),
      tx({ description: 'Aluguel', amount: 1200, date: '2026-11-20' }),
      tx({ description: 'Salário dez', type: 'income', amount: 3000, date: '2026-12-05', competenceMonth: '2026-12' }),
      tx({ description: 'Internet', amount: 120, date: '2026-12-02', competenceMonth: '2026-12' }),
    ],
    '2026-11-12'
  );
  assert.ok(forecast);
  assert.equal(forecast.startBalance, 4000, '1000 + salário já recebido');
  assert.equal(at(forecast, '2026-11-19'), 4000);
  assert.equal(at(forecast, '2026-11-20'), 2800, 'aluguel sai no dia 20');
  assert.equal(at(forecast, '2026-12-02'), 2680, 'virada de mês continua de onde parou');
  assert.equal(at(forecast, '2026-12-05'), 5680);
  assert.equal(forecast.firstNegative, null);
  assert.deepEqual(forecast.lowPoint, { date: '2026-12-02', balance: 2680 });
  assert.equal(forecast.horizonDays, 45);
});

test('includes the card invoice on its due date and warns when the balance turns negative', () => {
  const forecast = forecastCashBalance(
    [account({ initialBalance: 500 })], [card],
    [
      tx({ description: 'Compra', amount: 900, date: '2026-11-10', competenceMonth: '2026-12', creditCardId: 'c1', accountId: undefined, paymentMethod: 'credit_card' }),
      tx({ description: 'Conta de luz', amount: 100, date: '2026-11-25' }),
    ],
    '2026-11-12'
  );
  assert.ok(forecast);
  assert.equal(at(forecast, '2026-11-25'), 400);
  assert.equal(at(forecast, '2026-12-05'), -500, 'a fatura de dezembro vence dia 5');
  assert.deepEqual(forecast.firstNegative, { date: '2026-12-05', balance: -500 });
  assert.equal(forecast.lowPoint.balance, -500);
});

test('counts overdue items from previous months as settled today', () => {
  const forecast = forecastCashBalance(
    [account()], [],
    [tx({ description: 'Conta atrasada', amount: 300, date: '2026-10-20', competenceMonth: '2026-10' })],
    '2026-11-12'
  );
  assert.equal(forecast?.startBalance, 700);
});

test('ignores accounts that are left out of the total and returns null without any included account', () => {
  assert.equal(forecastCashBalance([], [], [], '2026-11-12'), null);
  assert.equal(forecastCashBalance([account({ includeInTotal: false })], [], [], '2026-11-12'), null);
  const forecast = forecastCashBalance(
    [account(), account({ id: 'reserva', initialBalance: 9000, includeInTotal: false })], [],
    [tx({ amount: 50, date: '2026-11-15', accountId: 'reserva' })],
    '2026-11-12'
  );
  assert.equal(forecast?.startBalance, 1000);
  assert.equal(forecast?.endBalance, 1000, 'gasto da conta reserva não mexe no saldo previsto');
});
