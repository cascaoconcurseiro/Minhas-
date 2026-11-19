import test from 'node:test';
import assert from 'node:assert/strict';
import type { CreditCard, Transaction } from '../../types/finance';
import { getSharedChargeDate, withSharedDueDates } from './sharedFinanceRules';

const card: CreditCard = { id: 'card-1', name: 'Azul', brand: 'Visa', limit: 5000, closingDay: 20, dueDay: 28, defaultAccountId: '', color: '#000' };
const tx = (extra: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1', description: 'Amazon', amount: 100, date: '2026-10-30', competenceMonth: '2026-12', type: 'expense',
  status: 'pending', categoryId: 'cat-outros', paymentMethod: 'credit_card', recurrence: 'single',
  isShared: true, sharedStatus: 'pending', sharedAmount: 50, ...extra,
} as Transaction);

test('quem tem o cartão cobra no vencimento da fatura (dia do cartão no mês da fatura)', () => {
  assert.equal(getSharedChargeDate(tx({ creditCardId: 'card-1' }), [card]), '2026-12-28');
});

test('dia de vencimento maior que o mês é ajustado para o último dia', () => {
  assert.equal(getSharedChargeDate(tx({ creditCardId: 'card-1', competenceMonth: '2027-02' }), [{ ...card, dueDay: 31 }]), '2027-03-01', '28/02/2027 é domingo: próximo dia útil');
});

test('quem recebe usa a data de vencimento enviada por quem lançou', () => {
  assert.equal(getSharedChargeDate(tx({ id: 'tx-mirror-1', sharedDueDate: '2026-12-28' }), []), '2026-12-28');
});

test('sem a data enviada, compra no cartão recebida só vence no fim do mês da fatura (nunca atrasa antes)', () => {
  assert.equal(getSharedChargeDate(tx({ id: 'tx-mirror-1' }), []), '2026-12-31');
});

test('data de vencimento inválida é ignorada', () => {
  assert.equal(getSharedChargeDate(tx({ id: 'tx-mirror-1', sharedDueDate: '2026-02-31' }), []), '2026-12-31');
  assert.equal(getSharedChargeDate(tx({ id: 'tx-mirror-1', sharedDueDate: 'amanhã' }), []), '2026-12-31');
});

test('fora do cartão a cobrança segue a data do lançamento', () => {
  assert.equal(getSharedChargeDate(tx({ paymentMethod: 'pix', date: '2026-11-10', competenceMonth: '2026-11' }), []), '2026-11-10');
});

test('o que é enviado à outra conta leva o vencimento da fatura; o original não é alterado', () => {
  const original = tx({ creditCardId: 'card-1' });
  const sent = withSharedDueDates([original, tx({ id: 'tx-2', paymentMethod: 'pix' }), tx({ id: 'tx-3', creditCardId: 'card-gone' })], [card]);
  assert.equal(sent[0].sharedDueDate, '2026-12-28');
  assert.equal(sent[1].sharedDueDate, undefined, 'fora do cartão não leva vencimento');
  assert.equal(sent[2].sharedDueDate, undefined, 'cartão removido: sem vencimento');
  assert.equal(original.sharedDueDate, undefined);
});
