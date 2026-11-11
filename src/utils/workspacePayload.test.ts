import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWorkspaceArray, parseWorkspaceObject } from './workspacePayload';
import { compactTransactionListForStorage } from './ofxParser';
import type { Transaction } from '../types/finance';

test('accepts empty and valid persisted workspace collections', () => {
  assert.deepEqual(parseWorkspaceArray('[]', [{ id: 'fallback' }], 'accountsJson'), []);
  assert.deepEqual(
    parseWorkspaceArray('[{"id":"acc-1"}]', [], 'accountsJson'),
    [{ id: 'acc-1' }]
  );
});

test('uses defaults only when optional persisted collections are absent', () => {
  const fallback = [{ id: 'default' }];
  assert.equal(parseWorkspaceArray(undefined, fallback, 'accountsJson'), fallback);
  assert.equal(parseWorkspaceArray(null, fallback, 'accountsJson'), fallback);
});

test('rejects malformed JSON and malformed collection entries instead of dropping data', () => {
  assert.throws(() => parseWorkspaceArray('{', [], 'transactionsJson'), /JSON inválido/);
  assert.throws(() => parseWorkspaceArray('{"id":"not-an-array"}', [], 'accountsJson'), /coleção inválida/);
  assert.throws(() => parseWorkspaceArray('[null]', [], 'accountsJson'), /coleção inválida/);
  assert.throws(() => parseWorkspaceArray('[{"id":" "}]', [], 'accountsJson'), /coleção inválida/);
});

test('rejects duplicate persisted record IDs instead of making edits ambiguous', () => {
  assert.throws(
    () => parseWorkspaceArray('[{"id":"tx-duplicate"},{"id":"tx-duplicate"}]', [], 'transactionsJson'),
    /IDs repetidos/
  );
});

test('rejects financial records with invalid money values before calculations consume them', () => {
  assert.throws(
    () => parseWorkspaceArray('[{"id":"tx-1","type":"expense","amount":"12,50"}]', [], 'transactionsJson'),
    /coleção inválida/
  );
  assert.throws(
    () => parseWorkspaceArray('[{"id":"tx-1","type":"expense","amount":-12.5}]', [], 'transactionsJson'),
    /coleção inválida/
  );
  assert.throws(
    () => parseWorkspaceArray('[{"id":"tx-precision","type":"expense","amount":0.001}]', [], 'transactionsJson'),
    /coleção inválida/
  );
  assert.throws(
    () => parseWorkspaceArray('[{"id":"tx-1","type":"expense"}]', [], 'transactionsJson'),
    /coleção inválida/
  );
  assert.throws(
    () => parseWorkspaceArray('[{"id":"tx-date","type":"expense","amount":12.5,"date":"2026-02-30","competenceMonth":"2026-02","status":"pending"}]', [], 'transactionsJson'),
    /coleção inválida/
  );
  assert.throws(
    () => parseWorkspaceArray('[{"id":"tx-month","type":"expense","amount":12.5,"date":"2026-02-28","competenceMonth":"2026-13","status":"pending"}]', [], 'transactionsJson'),
    /coleção inválida/
  );
  assert.throws(
    () => parseWorkspaceArray('[{"id":"tx-status","type":"expense","amount":12.5,"date":"2026-02-28","competenceMonth":"2026-02","status":"overdue"}]', [], 'transactionsJson'),
    /coleção inválida/
  );
  assert.throws(
    () => parseWorkspaceArray('[{"id":"acc-1","type":"checking","initialBalance":"100"}]', [], 'accountsJson'),
    /coleção inválida/
  );
  assert.deepEqual(
    parseWorkspaceArray('[{"id":"tx-zero","type":"expense","amount":0,"date":"2026-02-28","competenceMonth":"2026-02","status":"pending"}]', [], 'transactionsJson'),
    [{ id: 'tx-zero', type: 'expense', amount: 0, date: '2026-02-28', competenceMonth: '2026-02', status: 'pending' }]
  );
});

test('validates persisted goals, investments, and trip foreign-exchange precision', () => {
  const goal = {
    id: 'goal-1', targetAmount: 1000, currentAmount: 25.5, monthlyContribution: 12.34,
    deadline: '2027-02-28',
  };
  assert.deepEqual(parseWorkspaceArray([goal], [], 'goalsJson'), [goal]);
  assert.throws(() => parseWorkspaceArray([{ ...goal, targetAmount: 1.001 }], [], 'goalsJson'), /coleção inválida/);
  assert.throws(() => parseWorkspaceArray([{ ...goal, currentAmount: Number.NaN }], [], 'goalsJson'), /coleção inválida/);
  assert.throws(() => parseWorkspaceArray([{ ...goal, deadline: '2027-02-29' }], [], 'goalsJson'), /coleção inválida/);

  const investment = {
    id: 'investment-1', quantity: 0.12345678, averagePrice: 0.12345678,
    currentPrice: 0.12345678, monthlyYieldPercent: 0.5, dailyChangePercent: -1.25,
  };
  assert.deepEqual(parseWorkspaceArray([investment], [], 'investmentsJson'), [investment]);
  assert.throws(() => parseWorkspaceArray([{ ...investment, quantity: -1 }], [], 'investmentsJson'), /coleção inválida/);
  assert.throws(() => parseWorkspaceArray([{ ...investment, monthlyYieldPercent: -0.01 }], [], 'investmentsJson'), /coleção inválida/);
  assert.throws(() => parseWorkspaceArray([{ ...investment, currentPrice: Number.POSITIVE_INFINITY }], [], 'investmentsJson'), /coleção inválida/);

  const trip = {
    id: 'trip-1', name: 'Lisboa', startDate: '2026-11-11', endDate: '2026-11-15',
    currency: 'EUR', defaultExchangeRate: 5.12345678, budgetForeign: 125.12,
    exchangeLots: [{
      id: 'lot-1', date: '2026-11-11', currency: 'EUR', foreignAmount: 100.12,
      rateBase: 5.12345678, iofPercent: 1.1, effectiveRateBrl: 5.1798148,
      totalBrlPaid: 518.56,
    }],
    settlements: [{
      id: 'settlement-1', date: '2026-11-12', foreignAmountEquivalent: 10.12,
      brlAmountSettled: 52.42, exchangeRateUsed: 5.1798148,
    }],
  };
  assert.deepEqual(parseWorkspaceArray([trip], [], 'tripsJson'), [trip]);
  const zeroDecimalTrip = {
    ...trip,
    currency: 'JPY',
    budgetForeign: 100,
    exchangeLots: [{ ...trip.exchangeLots[0], currency: 'JPY', foreignAmount: 100 }],
    settlements: [{ ...trip.settlements[0], foreignAmountEquivalent: 10 }],
  };
  assert.deepEqual(parseWorkspaceArray([zeroDecimalTrip], [], 'tripsJson'), [zeroDecimalTrip]);
  assert.throws(() => parseWorkspaceArray([{ ...trip, exchangeLots: [{ ...trip.exchangeLots[0], date: '2026-02-30' }] }], [], 'tripsJson'), /coleção inválida/);
  assert.throws(() => parseWorkspaceArray([{ ...trip, exchangeLots: [{ ...trip.exchangeLots[0], iofPercent: 100.01 }] }], [], 'tripsJson'), /coleção inválida/);
  assert.throws(() => parseWorkspaceArray([{ ...trip, exchangeLots: [{ ...trip.exchangeLots[0], totalBrlPaid: 1.001 }] }], [], 'tripsJson'), /coleção inválida/);
  assert.throws(() => parseWorkspaceArray([{ ...trip, budgetForeign: 125.123 }], [], 'tripsJson'), /coleção inválida/);
  assert.throws(() => parseWorkspaceArray([{ ...trip, currency: 'JPY', budgetForeign: 100.5 }], [], 'tripsJson'), /coleção inválida/);
  assert.throws(() => parseWorkspaceArray([{ ...trip, settlements: [{ ...trip.settlements[0], foreignAmountEquivalent: 10.123 }] }], [], 'tripsJson'), /coleção inválida/);
  assert.throws(() => parseWorkspaceArray([{ ...trip, settlements: [{ ...trip.settlements[0], exchangeRateUsed: 0 }] }], [], 'tripsJson'), /coleção inválida/);
  assert.throws(() => parseWorkspaceArray([{ ...trip, endDate: '2026-11-10' }], [], 'tripsJson'), /coleção inválida/);
});

test('merges defaults with a valid persisted object and rejects damaged objects', () => {
  assert.deepEqual(
    parseWorkspaceObject('{"theme":"dark"}', { theme: 'light', density: 'comfortable' }, 'settingsJson'),
    { theme: 'dark', density: 'comfortable' }
  );
  assert.throws(() => parseWorkspaceObject('{', {}, 'settingsJson'), /JSON inválido/);
  assert.throws(() => parseWorkspaceObject('[]', {}, 'settingsJson'), /objeto inválido/);
});

test('finance metadata survives local cache and Neon workspace JSON serialization', () => {
  const transaction = {
    id: 'purchase-paid-partial',
    amount: 30,
    invoicePaymentId: 'tx-inv-card-2026-11-123',
    installmentPurchaseTotal: 120,
    isInvoicePayment: true,
    settledCardId: 'card-1',
    settledInvoiceMonth: '2026-11',
    originalAmount: 12.5,
    originalCurrency: 'USD',
    exchangeRate: 5.2,
    effectiveExchangeRate: 5.2,
    currencyRegime: 'global_account',
  } as Transaction;

  const localCache = JSON.parse(JSON.stringify({ transactions: [transaction] }));
  assert.equal(localCache.transactions[0].invoicePaymentId, transaction.invoicePaymentId);

  const requestBody = JSON.parse(JSON.stringify({
    transactionsJson: JSON.stringify(compactTransactionListForStorage([transaction])),
  }));
  const hydrated = parseWorkspaceArray<Transaction>(requestBody.transactionsJson, [], 'transactionsJson');
  assert.equal(hydrated[0].invoicePaymentId, transaction.invoicePaymentId);
  assert.equal(hydrated[0].installmentPurchaseTotal, transaction.installmentPurchaseTotal);
  assert.equal(hydrated[0].isInvoicePayment, true);
  assert.equal(hydrated[0].settledCardId, transaction.settledCardId);
  assert.equal(hydrated[0].settledInvoiceMonth, transaction.settledInvoiceMonth);
  assert.equal(hydrated[0].originalAmount, transaction.originalAmount);
  assert.equal(hydrated[0].originalCurrency, transaction.originalCurrency);
  assert.equal(hydrated[0].exchangeRate, transaction.exchangeRate);
  assert.equal(hydrated[0].effectiveExchangeRate, transaction.effectiveExchangeRate);
  assert.equal(hydrated[0].currencyRegime, transaction.currencyRegime);
});
