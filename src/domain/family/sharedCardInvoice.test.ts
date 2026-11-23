import test from 'node:test';
import assert from 'node:assert/strict';
import type { BankAccount, CreditCard, FamilyMember, Transaction } from '../../types/finance';
import { calculateSharedMemberSummary, reopenSharedSettlement, settleSharedExpenses } from './sharedFinanceRules';
import { isOutsidePersonalResult } from '../finance/transactionClassification';
import { calculatePersonalDre } from '../finance/personalDre';
import { createSharedCardInvoice, deleteSharedCardInvoice, isSharedCardInvoice, listOpenSharedCardInvoices, updateSharedCardInvoice } from './sharedCardInvoice';
import { summarizeReceivables } from '../receivables/receivables';

const card: CreditCard = { id: 'card-1', name: 'Itaú azul', brand: 'Visa', limit: 5000, closingDay: 5, dueDay: 12, defaultAccountId: 'acc', color: '#000' };
const ordinary: Transaction = { id: 'ord', description: 'Mercado', amount: 100, date: '2026-12-02', competenceMonth: '2026-12',
  type: 'expense', status: 'pending', categoryId: 'food', paymentMethod: 'cash', recurrence: 'single',
  isShared: true, sharedMemberId: 'fran', sharedAmount: 50, sharedPaidBy: 'me', sharedStatus: 'pending' };

const create = (amount = 800, invoiceMonth = '2026-12') => createSharedCardInvoice({
  id: 'one', memberId: 'fran', memberName: 'Fran', card, invoiceMonth, amount, date: '2026-11-23' });

test('a fatura do cartão adicional é compra no cartão, 100% da pessoa, no mês da fatura', () => {
  const result = create();
  assert.equal(result.error, undefined);
  const tx = (result as { transaction: Transaction }).transaction;
  assert.equal(isSharedCardInvoice(tx), true);
  assert.equal(tx.creditCardId, card.id);
  assert.equal(tx.competenceMonth, '2026-12');
  assert.equal(tx.amount, 800);
  assert.equal(tx.sharedAmount, 800);
  assert.equal(tx.sharedPaidBy, 'me');
  assert.equal(tx.receivableId, undefined);
});

test('soma ao que a pessoa me deve no mês da fatura, e só nele', () => {
  const tx = (create() as { transaction: Transaction }).transaction;
  const december = calculateSharedMemberSummary([ordinary, tx], 'fran', '2026-12');
  assert.equal(december.owedToMeMonthAmount, 850);
  assert.equal(calculateSharedMemberSummary([ordinary, tx], 'fran', '2026-11').owedToMeMonthAmount, 0);
});

test('rejeita valor zero, mês inválido, cartão e pessoa ausentes', () => {
  assert.match(create(0).error ?? '', /valor/i);
  assert.match(create(10, '2026-13').error ?? '', /mês/i);
  assert.match(createSharedCardInvoice({ id: 'x', memberId: 'fran', memberName: 'Fran', card: undefined, invoiceMonth: '2026-12', amount: 5, date: '2026-11-23' }).error ?? '', /cartão/i);
  assert.match(createSharedCardInvoice({ id: 'x', memberId: '', memberName: '', card, invoiceMonth: '2026-12', amount: 5, date: '2026-11-23' }).error ?? '', /de quem/i);
});

test('editar o valor e o mês atualiza a parte da pessoa junto', () => {
  const tx = (create() as { transaction: Transaction }).transaction;
  const edited = updateSharedCardInvoice([ordinary, tx], tx.id, { amount: 950.5, invoiceMonth: '2027-01', memberName: 'Fran', cardName: card.name });
  assert.equal(edited.error, undefined);
  const next = edited.transactions.find((item) => item.id === tx.id)!;
  assert.equal(next.amount, 950.5);
  assert.equal(next.sharedAmount, 950.5);
  assert.equal(next.competenceMonth, '2027-01');
  assert.match(next.description, /janeiro/i);
  assert.equal(edited.transactions.find((item) => item.id === 'ord'), ordinary);
});

test('fatura já acertada ou já paga não pode ser editada nem apagada', () => {
  const tx = (create() as { transaction: Transaction }).transaction;
  const settled = { ...tx, sharedStatus: 'received' as const };
  const paid = { ...tx, status: 'paid' as const, invoicePaymentId: 'pay' };
  for (const blocked of [settled, paid]) {
    assert.ok(updateSharedCardInvoice([blocked], tx.id, { amount: 10, invoiceMonth: '2026-12', memberName: 'Fran' }).error);
    assert.ok(deleteSharedCardInvoice([blocked], tx.id).error);
  }
});

test('apagar remove só a fatura e devolve o id para avisar a outra conta', () => {
  const tx = (create() as { transaction: Transaction }).transaction;
  const result = deleteSharedCardInvoice([ordinary, tx], tx.id);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.transactions, [ordinary]);
  assert.equal(result.removedSharedSyncId, tx.id);
});

test('lançamento comum não é tratado como fatura de cartão adicional', () => {
  assert.equal(isSharedCardInvoice(ordinary), false);
  assert.ok(updateSharedCardInvoice([ordinary], 'ord', { amount: 10, invoiceMonth: '2026-12', memberName: 'Fran' }).error);
});

const account: BankAccount = { id: 'bank', name: 'Conta sintética', institution: 'Teste', type: 'checking', initialBalance: 0, includeInTotal: true, color: '#000' };
const settleInput = { memberId: 'fran', month: '2026-12', memberName: 'Fran', accountId: account.id, date: '2026-12-13', settlementId: 'acerto-1' };

test('a fatura e o recebimento dela ficam fora do resultado pessoal (não é gasto nem receita sua)', () => {
  const tx = (create() as { transaction: Transaction }).transaction;
  assert.equal(isOutsidePersonalResult(tx), true);
  const settled = settleSharedExpenses([tx], [account], { ...settleInput, txId: tx.id }).transactions;
  const movement = settled.find((item) => item.id.startsWith('tx-reimb-'))!;
  assert.equal(movement.type, 'income');
  assert.equal(movement.amount, 800);
  assert.equal(isOutsidePersonalResult(movement), true);
  const dre = calculatePersonalDre(settled, '2026-12', [], [], []);
  assert.equal(dre.consumptionExpenses, 0);
  assert.equal(dre.totalIncome, 0);
});

test('acerto do mês com fatura + despesa comum gera dois movimentos e só o comum conta como receita', () => {
  const invoice = (create() as { transaction: Transaction }).transaction;
  const result = settleSharedExpenses([ordinary, invoice], [account], settleInput);
  assert.equal(result.netAmount, 850);
  const movements = result.transactions.filter((item) => item.id.startsWith('tx-reimb-'));
  assert.equal(movements.length, 2);
  const invoiceMovement = movements.find((item) => item.id.endsWith('-cardinv'))!;
  const regularMovement = movements.find((item) => !item.id.endsWith('-cardinv'))!;
  assert.equal(invoiceMovement.amount, 800);
  assert.equal(regularMovement.amount, 50);
  assert.equal(isOutsidePersonalResult(invoiceMovement), true);
  assert.equal(isOutsidePersonalResult(regularMovement), false);
  assert.ok(result.transactions.filter((item) => item.isShared).every((item) => item.sharedStatus === 'received'));
});

test('reabrir o acerto remove os dois movimentos', () => {
  const invoice = (create() as { transaction: Transaction }).transaction;
  const settled = settleSharedExpenses([ordinary, invoice], [account], settleInput).transactions;
  const reopened = reopenSharedSettlement(settled, invoice.id);
  assert.equal(reopened.transactions.filter((item) => item.id.startsWith('tx-reimb-')).length, 0);
  assert.ok(reopened.transactions.filter((item) => item.isShared).every((item) => item.sharedStatus === 'pending'));
});

test('fatura em aberto conta no a receber do patrimônio e sai quando é acertada', () => {
  const members: FamilyMember[] = [{ id: 'fran', name: 'Fran', relationship: 'cônjuge', color: '#000' }];
  const invoice = (create(800) as { transaction: Transaction }).transaction;
  const open = listOpenSharedCardInvoices([ordinary, invoice], members, '2026-11-30');
  assert.deepEqual(open, [{ personName: 'Fran', balance: 800 }]);
  assert.equal(summarizeReceivables([], '2026-11-30', open).totalOpen, 800);
  assert.deepEqual(listOpenSharedCardInvoices([invoice], members, '2026-11-01'), [], 'lançada depois da data não conta');
  assert.deepEqual(listOpenSharedCardInvoices([{ ...invoice, sharedStatus: 'received' }], members), []);
});
