import assert from 'node:assert/strict';
import test from 'node:test';
import type { BankAccount, Transaction } from '../types/finance';
import {
  findSelfTransfers,
  findUnconvertedForeignTransfers,
  getAccountCurrency,
  getTransferDestinationAccounts,
  getTransferForeignLeg,
  pickDefaultTransferDestination,
  planTransferCurrency,
  resolveBankTransfer,
} from './transferRules';

const account = (over: Partial<BankAccount> & { id: string }): BankAccount => ({
  name: over.id, institution: 'Banco', type: 'checking', initialBalance: 0, color: '#000', includeInTotal: true, ...over,
});
const nubank = account({ id: 'nubank' });
const itau = account({ id: 'itau' });
const nomadUsd = account({ id: 'nomad', type: 'international', currency: 'USD' });
const wiseUsd = account({ id: 'wise', type: 'international', currency: 'USD' });
const wiseEur = account({ id: 'wise-eur', type: 'international', currency: 'EUR' });
const brokenIntl = account({ id: 'broken', type: 'international' });

test('account currency: only international accounts with a foreign currency are foreign', () => {
  assert.equal(getAccountCurrency(nubank), 'BRL');
  assert.equal(getAccountCurrency(nomadUsd), 'USD');
  assert.equal(getAccountCurrency(brokenIntl), 'BRL');
  assert.equal(getAccountCurrency(null), 'BRL');
});

test('destination list never offers the source account', () => {
  const all = [nubank, itau, nomadUsd];
  assert.deepEqual(getTransferDestinationAccounts(all, 'nubank').map((a) => a.id), ['itau', 'nomad']);
  assert.equal(pickDefaultTransferDestination(all, 'nubank'), 'itau');
  assert.equal(pickDefaultTransferDestination([nubank], 'nubank'), '', 'com uma conta só não há destino');
});

test('transfer scenarios: every currency combination', () => {
  assert.equal(planTransferCurrency(nubank, itau).kind, 'brl');
  assert.equal(planTransferCurrency(nomadUsd, nubank).kind, 'foreign_conversion');
  assert.equal(planTransferCurrency(nubank, nomadUsd).kind, 'foreign_conversion');
  assert.equal(planTransferCurrency(nomadUsd, wiseUsd).kind, 'foreign_same');
  assert.equal(planTransferCurrency(nomadUsd, wiseEur).kind, 'unsupported');
  assert.equal(planTransferCurrency(brokenIntl, nubank).kind, 'brl');
  assert.equal(planTransferCurrency(nomadUsd, null).kind, 'foreign_conversion', 'aporte saindo de conta em dólar');
});

test('resolveBankTransfer: same account, missing sides and invalid amounts are rejected', () => {
  assert.match(String(resolveBankTransfer({ source: nubank, destination: nubank, amountBrl: 10 }).error), /ela mesma/);
  assert.match(String(resolveBankTransfer({ source: null, destination: nubank, amountBrl: 10 }).error), /origem/);
  assert.match(String(resolveBankTransfer({ source: nubank, destination: null, amountBrl: 10 }).error), /destino/);
  assert.ok(resolveBankTransfer({ source: nubank, destination: itau, amountBrl: 0 }).error);
  assert.ok(resolveBankTransfer({ source: nubank, destination: itau, amountBrl: Number.NaN }).error);
});

test('resolveBankTransfer: BRL to BRL needs no exchange data', () => {
  const result = resolveBankTransfer({ source: nubank, destination: itau, amountBrl: 100 });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.error ? null : result.legs, {});
});

test('resolveBankTransfer: Nomad (USD) to Nubank asks for USD and derives the rate', () => {
  const missing = resolveBankTransfer({ source: nomadUsd, destination: nubank, amountBrl: 540 });
  assert.match(String(missing.error), /USD/);
  const ok = resolveBankTransfer({ source: nomadUsd, destination: nubank, amountBrl: 540, foreignAmount: 100 });
  assert.equal(ok.error, undefined);
  if (!ok.error) {
    assert.equal(ok.legs.transferFromAmount, 100);
    assert.equal(ok.legs.transferToAmount, undefined);
    assert.equal(ok.legs.transferExchangeRate, 5.4);
  }
});

test('resolveBankTransfer: Nubank to Nomad records the foreign amount received', () => {
  const ok = resolveBankTransfer({ source: nubank, destination: nomadUsd, amountBrl: 550, foreignAmount: 100 });
  assert.equal(ok.error, undefined);
  if (!ok.error) {
    assert.equal(ok.legs.transferToAmount, 100);
    assert.equal(ok.legs.transferFromAmount, undefined);
    assert.equal(ok.legs.transferExchangeRate, 5.5);
  }
});

test('resolveBankTransfer: same foreign currency keeps both legs, different foreign currencies are refused', () => {
  const same = resolveBankTransfer({ source: nomadUsd, destination: wiseUsd, amountBrl: 540, foreignAmount: 100 });
  assert.equal(same.error, undefined);
  if (!same.error) {
    assert.equal(same.legs.transferFromAmount, 100);
    assert.equal(same.legs.transferToAmount, 100);
  }
  assert.match(String(resolveBankTransfer({ source: nomadUsd, destination: wiseEur, amountBrl: 540, foreignAmount: 100 }).error), /USD e EUR/);
});

test('resolveBankTransfer: investment contribution from a foreign account needs the foreign amount', () => {
  assert.equal(resolveBankTransfer({ source: nubank, destination: null, destinationIsInvestment: true, amountBrl: 100 }).error, undefined);
  assert.ok(resolveBankTransfer({ source: nomadUsd, destination: null, destinationIsInvestment: true, amountBrl: 100 }).error);
  const ok = resolveBankTransfer({ source: nomadUsd, destination: null, destinationIsInvestment: true, amountBrl: 540, foreignAmount: 100 });
  assert.equal(ok.error, undefined);
});

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't', description: 'Transferência', amount: 540, date: '2026-11-01', competenceMonth: '2026-11', type: 'transfer',
  status: 'paid', categoryId: 'c', paymentMethod: 'transfer', recurrence: 'single', ...over,
});

test('foreign leg is read from the right side of the transfer', () => {
  const out = tx({ accountId: 'nomad', destinationAccountId: 'nubank', transferFromAmount: 100, transferExchangeRate: 5.4 });
  assert.deepEqual(getTransferForeignLeg(out, nomadUsd), { direction: 'out', amount: 100, rate: 5.4 });
  assert.equal(getTransferForeignLeg(out, nubank), null);
  const incoming = tx({ accountId: 'nubank', destinationAccountId: 'nomad', transferToAmount: 100, transferExchangeRate: 5.4 });
  assert.deepEqual(getTransferForeignLeg(incoming, nomadUsd), { direction: 'in', amount: 100, rate: 5.4 });
  assert.equal(getTransferForeignLeg(tx({ type: 'expense', accountId: 'nomad', transferFromAmount: 1 }), nomadUsd), null);
});

test('legacy transfers: self transfers and unconverted foreign transfers are flagged', () => {
  const accounts = [nubank, itau, nomadUsd, wiseEur];
  const self = tx({ id: 'self', accountId: 'nubank', destinationAccountId: 'nubank' });
  const legacyFx = tx({ id: 'legacy', accountId: 'nomad', destinationAccountId: 'nubank' });
  const convertedFx = tx({ id: 'ok', accountId: 'nomad', destinationAccountId: 'nubank', transferFromAmount: 100, transferExchangeRate: 5.4 });
  const plain = tx({ id: 'plain', accountId: 'nubank', destinationAccountId: 'itau' });
  const crossForeign = tx({ id: 'cross', accountId: 'nomad', destinationAccountId: 'wise-eur', transferFromAmount: 100 });
  assert.deepEqual(findSelfTransfers([self, plain]).map((t) => t.id), ['self']);
  assert.deepEqual(
    findUnconvertedForeignTransfers([legacyFx, convertedFx, plain, crossForeign], accounts).map((t) => t.id),
    ['legacy', 'cross']
  );
});

import { describeTransferForeignLeg } from './transferRules';

test('transfer list note shows the foreign amount and rate only when there is one', () => {
  const accounts = [nubank, nomadUsd];
  const out = tx({ accountId: 'nomad', destinationAccountId: 'nubank', transferFromAmount: 100, transferExchangeRate: 5.4 });
  assert.match(describeTransferForeignLeg(out, accounts), /^ · .*100,00 a R\$\s5,40$/);
  assert.equal(describeTransferForeignLeg(tx({ accountId: 'nubank', destinationAccountId: 'itau' }), accounts), '');
});
