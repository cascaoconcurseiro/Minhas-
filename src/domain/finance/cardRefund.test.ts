import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCategoryBreakdown, calculateCreditCardSummary, calculatePersonalDre, calculateMonthlySummary,
  createTransactionBatch, payCreditCardInvoice, reverseCreditCardInvoicePayment,
} from './financeRules.ts';
import { INITIAL_CATEGORIES } from './seedData.ts';
import { validateWorkspaceConsistency, parseWorkspaceArray } from '../../services/workspace/workspacePayload.ts';
import { sanitizeAndRepairFinancialState } from '../trips/travelRules.ts';
import { duplicateFinancialTransaction, getTransactionEditRestriction } from './financeRules.ts';
import type { BankAccount, CreditCard, Transaction } from '../../types/finance';

const card = { id: 'c1', name: 'Nubank', brand: 'Visa', limit: 1000, closingDay: 28, dueDay: 5, defaultAccountId: 'acc', color: '#000' } as CreditCard;
const account = { id: 'acc', name: 'Banco', institution: 'B', type: 'checking', initialBalance: 5000, color: '#000', includeInTotal: true } as BankAccount;
const base = { type: 'expense' as const, categoryId: 'cat-mercado', creditCardId: 'c1', paymentMethod: 'credit_card' as const, recurrence: 'single' as const };
const purchases = (): Transaction[] => [
  ...createTransactionBatch({ ...base, description: 'Mercado', amount: 400, date: '2026-11-10', competenceMonth: '2026-12', status: 'pending' }),
  ...createTransactionBatch({ ...base, description: 'Farmácia', amount: 200, date: '2026-11-20', competenceMonth: '2026-12', status: 'pending' }),
];
const refund = (amount = 100, date = '2026-11-25', month = '2026-12'): Transaction =>
  createTransactionBatch({ ...base, description: 'Estorno Mercado', amount, date, competenceMonth: month, status: 'paid', isCardRefund: true })[0];

test('estorno é gravado negativo, pendente, à vista e marcado; entradas inválidas são recusadas', () => {
  const r = refund(100);
  assert.equal(r.amount, -100);
  assert.equal(r.isCardRefund, true);
  assert.equal(r.status, 'pending', 'só quita junto com a fatura');
  assert.equal(r.recurrence, 'single');
  assert.equal(r.type, 'expense');
  const bad = (extra: object) => () => createTransactionBatch({ ...base, description: 'x', amount: 10, date: '2026-11-25', status: 'pending', isCardRefund: true, ...extra });
  assert.throws(bad({ creditCardId: undefined }), RangeError);
  assert.throws(bad({ amount: 0 }), RangeError);
  assert.throws(bad({ amount: -5 }), RangeError);
  assert.throws(bad({ isShared: true }), RangeError);
  assert.throws(bad({ tripId: 't1' }), RangeError);
  assert.throws(bad({ type: 'income' }), RangeError);
});

test('estorno reduz a fatura e libera o limite', () => {
  const rows = [...purchases(), refund(100)];
  const summary = calculateCreditCardSummary(card, rows, '2026-12', '2026-11-26');
  assert.equal(summary.invoiceTotal, 500);
  assert.equal(summary.invoicePendingAmount, 500);
  assert.equal(summary.usedLimit, 500);
  assert.equal(summary.availableLimit, 500);
});

test('estorno reduz o gasto da categoria no mês do estorno (o gasto original não é reescrito)', () => {
  const categories = INITIAL_CATEGORIES;
  const rows = [...purchases(), refund(100, '2026-11-25')];
  const nov = calculateCategoryBreakdown(categories, rows, '2026-11');
  const mercadoNov = nov.find((c) => c.categoryId === 'cat-mercado')!;
  assert.equal(mercadoNov.spent, 500, 'R$ 600 de compras (as duas usam esta categoria) − R$ 100 de estorno, no mesmo mês');
  const dre = calculatePersonalDre(rows, '2026-11', [], [], []);
  assert.equal(dre.consumptionExpenses, 500, 'despesas do mês: 400 + 200 − 100');
  const decRefund = [...purchases(), refund(100, '2026-12-03', '2027-01')];
  const decMercado = calculateCategoryBreakdown(categories, decRefund, '2026-12').find((c) => c.categoryId === 'cat-mercado')!;
  assert.equal(decMercado.spent, -100, 'estorno em mês sem compra aparece como categoria negativa (crédito)');
  const summary = calculateMonthlySummary([account], [card], rows, '2026-11');
  assert.equal(summary.expenseTotal, 500);
});

test('pagar a fatura inteira paga o líquido e quita também a linha de estorno', () => {
  const rows = [...purchases(), refund(100)];
  const paid = payCreditCardInvoice(card, rows, '2026-12', 'acc', '2026-12-05');
  const payment = paid.find((tx) => tx.isInvoicePayment)!;
  assert.equal(payment.amount, 500);
  const lines = paid.filter((tx) => tx.creditCardId === 'c1' && !tx.isInvoicePayment);
  assert.ok(lines.every((tx) => tx.status === 'paid' && tx.invoicePaymentId === payment.id));
  assert.equal(calculateCreditCardSummary(card, paid, '2026-12', '2026-12-10').invoicePendingAmount, 0);
});

test('pagamento parcial considera o estorno (líquido) e desfazer o pagamento reabre tudo', () => {
  const rows = [...purchases(), refund(100)];
  const partial = payCreditCardInvoice(card, rows, '2026-12', 'acc', '2026-12-05', 200);
  assert.equal(partial.find((tx) => tx.isInvoicePayment)?.amount, 200);
  const stillOpen = calculateCreditCardSummary(card, partial, '2026-12', '2026-12-10').invoicePendingAmount;
  assert.equal(stillOpen, 300, 'líquido 500 − 200 pagos');
  const paymentId = partial.find((tx) => tx.isInvoicePayment)!.id;
  const reversed = reverseCreditCardInvoicePayment(partial, paymentId, [card]);
  const after = calculateCreditCardSummary(card, reversed.updatedTransactions, '2026-12', '2026-12-10');
  assert.equal(after.invoicePendingAmount, 500);
  assert.equal(reversed.updatedTransactions.filter((tx) => tx.isCardRefund).every((tx) => tx.status === 'pending'), true);
});

test('o servidor aceita estorno negativo, mas continua recusando negativo sem a marca ou fora do cartão', () => {
  const ok = { ...refund(100), accountId: undefined };
  const run = (tx: object) => validateWorkspaceConsistency({ accounts: [account], cards: [card], transactions: [tx] });
  assert.equal(run(ok), null);
  assert.ok(run({ ...ok, isCardRefund: undefined }), 'negativo sem marca é recusado');
  assert.ok(run({ ...ok, creditCardId: undefined, accountId: 'acc' }), 'negativo fora do cartão é recusado');
  assert.ok(run({ ...ok, type: 'income' }), 'entrada ligada a cartão continua recusada');
  assert.equal(parseWorkspaceArray(JSON.stringify([ok]), [], 'transactionsJson').length, 1);
  assert.throws(() => parseWorkspaceArray(JSON.stringify([{ ...ok, isCardRefund: undefined }]), [], 'transactionsJson'));
});

test('estorno não pode ser editado nem duplicado (apagar e lançar de novo)', () => {
  const r = refund(100);
  assert.match(String(getTransactionEditRestriction(r)), /apague e lance de novo/);
  assert.equal(duplicateFinancialTransaction(r, 'copy'), null);
  assert.equal(getTransactionEditRestriction(purchases()[0]), null, 'compra comum continua editável');
});

test('a rotina de reparo não "corrige" o valor negativo de um estorno, mas ainda corrige o das outras', () => {
  const broken = { ...purchases()[0], id: 'broken', amount: -50 };
  const result = sanitizeAndRepairFinancialState({
    accounts: [account], cards: [card], categories: INITIAL_CATEGORIES, goals: [], investments: [], trips: [],
    transactions: [refund(100), broken],
  });
  const byId = new Map(result.transactions.map((tx) => [tx.id, tx]));
  assert.equal(result.transactions.find((tx) => tx.isCardRefund)?.amount, -100);
  assert.equal(byId.get('broken')?.amount, 50);
});
