import assert from 'node:assert/strict';
import test from 'node:test';
import type { BankAccount } from '../types/finance';
import { getAccountLabel } from './accountLabels';

const acc = (over: Partial<BankAccount>): BankAccount =>
  ({ id: 'a', name: 'Conta corrente', institution: 'Nubank', type: 'checking', initialBalance: 0, color: '#000', includeInTotal: true, ...over }) as BankAccount;

test('conta com nome genérico mostra o banco, não o tipo da conta', () => {
  assert.equal(getAccountLabel(acc({})), 'Nubank');
  assert.equal(getAccountLabel(acc({ name: 'Conta Corrente ' })), 'Nubank');
  assert.equal(getAccountLabel(acc({ name: 'Poupança', type: 'savings', institution: 'Caixa' })), 'Caixa');
});

test('nome próprio da conta é mantido', () => {
  assert.equal(getAccountLabel(acc({ name: 'Reserva de viagem' })), 'Reserva de viagem');
  assert.equal(getAccountLabel(acc({ name: 'Wise USD', institution: 'Wise', type: 'international' })), 'Wise USD');
});

test('dois nomes genéricos do mesmo banco levam o tipo para não confundir', () => {
  const corrente = acc({ id: '1' });
  const poupanca = acc({ id: '2', name: 'Poupança', type: 'savings' });
  assert.equal(getAccountLabel(corrente, [corrente, poupanca]), 'Nubank · Conta corrente');
  assert.equal(getAccountLabel(poupanca, [corrente, poupanca]), 'Nubank · Poupança');
});

test('sem banco informado usa o nome da conta', () => {
  assert.equal(getAccountLabel(acc({ institution: '', name: 'Carteira', type: 'cash' })), 'Carteira');
  assert.equal(getAccountLabel(acc({ institution: '', name: '' })), 'Conta corrente');
});
