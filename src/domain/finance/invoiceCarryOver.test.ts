import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCreditCardSummary, payCreditCardInvoice, getConsumptionMonth, createTransactionBatch, calculateMonthlySummary } from './financeRules.ts';
import { carryOverInvoiceBalance, getInvoiceCarryOverState, undoInvoiceCarryOver } from './invoiceCarryOver.ts';
import type { CreditCard, Transaction } from '../../types/finance';

const card = { id: 'c1', name: 'Nubank', brand: 'Visa', limit: 5000, closingDay: 28, dueDay: 5, defaultAccountId: 'acc', color: '#000' } as CreditCard;
const base = { type: 'expense' as const, categoryId: 'cat-outros', creditCardId: 'c1', paymentMethod: 'credit_card' as const, recurrence: 'single' as const };
const purchases = (): Transaction[] => [
  ...createTransactionBatch({ ...base, description: 'Geladeira', amount: 400, date: '2026-11-11', competenceMonth: '2026-12', status: 'pending' }),
  ...createTransactionBatch({ ...base, description: 'Mercado', amount: 200, date: '2026-11-20', competenceMonth: '2026-12', status: 'pending' }),
];
const partial = () => payCreditCardInvoice(card, purchases(), '2026-12', 'acc', '2026-12-05', 300);

test('não leva o restante sem ter pago parte da fatura, nem sem saldo', () => {
  assert.deepEqual(carryOverInvoiceBalance(card, purchases(), '2026-12', { feeId: 'fee' }), { error: 'Pague uma parte da fatura antes de levar o restante para a próxima.' });
  assert.deepEqual(carryOverInvoiceBalance(card, purchases(), '2027-05', { feeId: 'fee' }), { error: 'Não há saldo em aberto nesta fatura.' });
  assert.equal(getInvoiceCarryOverState(card, purchases(), '2026-12').canCarry, false);
});

test('leva o restante com encargos: fatura de dezembro zera, janeiro recebe o saldo e o gasto não muda de mês', () => {
  const afterPartial = partial();
  assert.equal(getInvoiceCarryOverState(card, afterPartial, '2026-12').canCarry, true);
  const result = carryOverInvoiceBalance(card, afterPartial, '2026-12', { feeAmount: 25.9, feeId: 'fee-1' });
  assert.ok(!('error' in result));
  assert.equal(result.nextInvoiceMonth, '2027-01');
  assert.equal(result.carriedAmount, 300);
  const dec = calculateCreditCardSummary(card, result.transactions, '2026-12', '2026-12-10');
  const jan = calculateCreditCardSummary(card, result.transactions, '2027-01', '2026-12-10');
  assert.equal(dec.invoicePendingAmount, 0, 'nada em aberto em dezembro');
  assert.equal(dec.invoiceTotal, 300, 'dezembro fica só com o que foi pago');
  assert.equal(jan.invoicePendingAmount, 325.9, 'janeiro: saldo levado + encargos');
  assert.equal(jan.usedLimit, 325.9, 'o limite continua ocupado');
  const carried = result.transactions.filter((tx) => tx.carriedFromInvoiceMonth === '2026-12');
  assert.ok(carried.every((tx) => getConsumptionMonth(tx) === '2026-11'), 'o gasto continua em novembro');
  const fee = result.transactions.find((tx) => tx.id === 'fee-1')!;
  assert.equal(fee.categoryId, 'cat-tarifas');
  assert.equal(fee.competenceMonth, '2027-01');
  assert.equal(getConsumptionMonth(fee), '2026-12', 'encargo é despesa do mês em que o banco cobra (vencimento)');
  const decSummary = calculateMonthlySummary([], [card], result.transactions, '2026-12');
  const novSummary = calculateMonthlySummary([], [card], result.transactions, '2026-11');
  assert.equal(decSummary.expenseTotal, 25.9, 'dezembro só tem os encargos');
  assert.equal(novSummary.expenseTotal, 600, 'as compras continuam em novembro, o mês em que foram feitas');
});

test('sem encargos não cria despesa; encargo inválido é recusado', () => {
  const result = carryOverInvoiceBalance(card, partial(), '2026-12', { feeId: 'fee-1' });
  assert.ok(!('error' in result));
  assert.equal(result.transactions.some((tx) => tx.id === 'fee-1'), false);
  assert.ok('error' in carryOverInvoiceBalance(card, partial(), '2026-12', { feeAmount: -5, feeId: 'fee-2' }));
  assert.ok('error' in carryOverInvoiceBalance(card, partial(), '2026-12', { feeAmount: Number.NaN, feeId: 'fee-3' }));
});

test('desfazer devolve tudo ao estado de antes e remove os encargos', () => {
  const afterPartial = partial();
  const carried = carryOverInvoiceBalance(card, afterPartial, '2026-12', { feeAmount: 10, feeId: 'fee-1' });
  assert.ok(!('error' in carried));
  assert.equal(getInvoiceCarryOverState(card, carried.transactions, '2026-12').canUndo, true);
  const undone = undoInvoiceCarryOver(card, carried.transactions, '2026-12');
  assert.ok(!('error' in undone));
  assert.equal(undone.restoredCount, 2, 'sobra da compra dividida + a compra inteira');
  assert.deepEqual(undone.transactions, afterPartial);
});

test('depois de pagar a fatura de janeiro não dá para desfazer; precisa estornar o pagamento antes', () => {
  const carried = carryOverInvoiceBalance(card, partial(), '2026-12', { feeAmount: 10, feeId: 'fee-1' });
  assert.ok(!('error' in carried));
  const paidJan = payCreditCardInvoice(card, carried.transactions, '2027-01', 'acc', '2027-01-05');
  assert.equal(getInvoiceCarryOverState(card, paidJan, '2026-12').canUndo, false);
  assert.deepEqual(undoInvoiceCarryOver(card, paidJan, '2026-12'), { error: 'Parte do saldo levado já foi paga: estorne esse pagamento antes de desfazer.' });
});
