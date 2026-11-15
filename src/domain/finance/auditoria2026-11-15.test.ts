/**
 * Regressões da auditoria financeira de 2026-11-15 (achados A01–A12). Cada teste descreve o resultado correto.
 * Achados que dependem de decisão de produto ou de mudança de modelo estão no CHECKLIST.md, seção D.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAccountBalances, createTransactionBatch, calculateCreditCardSummary, calculateDailyCashFlow, calculateMonthlySummary,
  payCreditCardInvoice, reverseCreditCardInvoicePayment, toggleTransactionStatusWithCascade,
} from './financeRules';
import { anticipateCardInstallments, reverseInstallmentAnticipation } from '../budgets/uxEnhancementRules';
import { calculateTripExpenseSplit, simplifyTripDebts } from '../trips/travelRules';
import type { BankAccount, CreditCard, Transaction } from '../../types/finance';

const acc: BankAccount = { id: 'a1', name: 'Banco', institution: 'X', type: 'checking', initialBalance: 1000, color: '#000', includeInTotal: true };
const card: CreditCard = { id: 'c1', name: 'Cartão', brand: 'Visa', limit: 5000, closingDay: 10, dueDay: 15, defaultAccountId: 'a1', color: '#000' };
const purchase = (o: Partial<Transaction> = {}): Transaction => ({ id: 'p1', description: 'Compra', amount: 100, date: '2026-11-02', competenceMonth: '2026-11',
  type: 'expense', status: 'pending', categoryId: 'cat', creditCardId: 'c1', paymentMethod: 'credit_card', recurrence: 'single', ...o } as Transaction);

const debt = (txs: Transaction[]) => calculateCreditCardSummary(card, txs, '2026-11').invoicePendingAmount;
const bank = (txs: Transaction[]) => calculateAccountBalances([acc], txs, '2026-11')[0].currentBalance;

test('A02 estorno do 1º pagamento parcial não reabre o valor pago pelo 2º', () => {
  let txs = [purchase()];
  txs = payCreditCardInvoice(card, txs, '2026-11', 'a1', '2026-11-10', 40);
  const p1 = txs.find((t) => t.isInvoicePayment)!.id;
  txs = payCreditCardInvoice(card, txs, '2026-11', 'a1', '2026-11-11', 60);
  assert.equal(debt(txs), 0);
  const rev = reverseCreditCardInvoicePayment(txs, p1, [card]);
  assert.equal(debt(rev.updatedTransactions), 40, 'dívida deve ser 100 - 60 pagos');
  assert.equal(bank(rev.updatedTransactions), 940);
});

test('A02 ordem inversa: estorna o 2º pagamento', () => {
  let txs = [purchase()];
  txs = payCreditCardInvoice(card, txs, '2026-11', 'a1', '2026-11-10', 40);
  txs = payCreditCardInvoice(card, txs, '2026-11', 'a1', '2026-11-11', 60);
  const p2 = txs.filter((t) => t.isInvoicePayment).find((t) => t.amount === 60)!.id;
  const rev = reverseCreditCardInvoicePayment(txs, p2, [card]);
  assert.equal(debt(rev.updatedTransactions), 60);
  assert.equal(bank(rev.updatedTransactions), 960);
});

test('A04 desconto na antecipação conserva centavos e data válida', () => {
  const mk = (n: number, d: string, m: string): Transaction => purchase({ id: `i${n}`, recurrence: 'installment', installmentGroupId: 'g', installmentNumber: n, installmentTotal: 3, amount: 100, date: d, competenceMonth: m });
  const txs = [mk(1, '2026-11-31'.replace('31', '30'), '2026-11'), mk(2, '2026-12-31', '2026-12'), mk(3, '2027-01-31', '2027-01'), mk(4, '2027-03-31', '2027-03')];
  const r = anticipateCardInstallments(txs, 'g', '2027-02', 0.02);
  const moved = r.updatedTransactions.filter((t) => t.isAnticipated);
  assert.ok(moved.length >= 1);
  assert.equal(Math.round((r.originalSum - r.finalSum) * 100), 2, 'desconto total = 0,02');
  for (const t of moved) assert.ok(!Number.isNaN(Date.parse(`${t.date}T00:00:00Z`)) && new Date(`${t.date}T00:00:00Z`).toISOString().slice(0, 10) === t.date, `data válida ${t.date}`);
});

test('A05 não desfaz antecipação já paga', () => {
  const t = purchase({ id: 'x', recurrence: 'installment', installmentGroupId: 'g', installmentNumber: 2, installmentTotal: 3, isAnticipated: true,
    originalAmountBeforeDiscount: 100, amount: 90, originalCompetenceMonth: '2027-01', originalDateBeforeAnticipation: '2027-01-02', status: 'paid', invoicePaymentId: 'pay' });
  const r = reverseInstallmentAnticipation([t], 'x');
  assert.equal(r.restoredCount, 0);
  assert.equal(r.updatedTransactions[0].amount, 90);
});

test('A07 fluxo diário inclui pendência bancária de mês anterior', () => {
  const old: Transaction = { id: 'e1', description: 'Conta', amount: 100, date: '2026-10-20', competenceMonth: '2026-10', type: 'expense', status: 'pending', categoryId: 'cat', accountId: 'a1', paymentMethod: 'pix', recurrence: 'single' };
  const flow = calculateDailyCashFlow([acc], [card], [old], '2026-11');
  const monthly = calculateAccountBalances([acc], [old], '2026-11')[0].projectedBalance;
  assert.equal(flow[flow.length - 1].projectedBalance ?? (flow[flow.length - 1] as any).projected, monthly);
});

test('A15 rateio em moeda sem casas decimais (JPY) dá unidades inteiras', () => {
  const parts = [{ id: 'a', name: 'A', isMe: true }, { id: 'b', name: 'B', isMe: false }] as any;
  const s = calculateTripExpenseSplit(101, 101, parts, ['a', 'b'], 'equal', [], 'JPY');
  assert.deepEqual(s.map((x) => x.foreignShare).sort(), [50, 51]);
});

test('A01 compra de cartão pendente não é baixada direto (só pagando a fatura)', () => {
  const r = toggleTransactionStatusWithCascade([purchase()], 'p1', [card]);
  assert.equal(r.blocked, true);
  assert.equal(r.updatedTransactions[0].status, 'pending');
  assert.equal(bank(r.updatedTransactions), 1000);
});

test('A12 alternar status de aporte de investimento é bloqueado', () => {
  const t: Transaction = { id: 'inv', description: 'Aporte', amount: 100, date: '2026-11-02', competenceMonth: '2026-11', type: 'transfer', status: 'paid', categoryId: 'cat-aportes', accountId: 'a1', targetInvestmentAssetId: 'asset', paymentMethod: 'transfer', recurrence: 'single' };
  const r = toggleTransactionStatusWithCascade([t], 'inv', []);
  assert.equal(r.blocked, true);
});

const sumField = (rows: Transaction[], pick: (t: Transaction) => number) => Math.round(rows.reduce((s, t) => s + pick(t), 0) * 100) / 100;

test('A06 parcelar compra de viagem não multiplica moeda estrangeira nem cotas', () => {
  const rows = createTransactionBatch({
    description: 'Hotel', amount: 300, date: '2026-11-02', type: 'expense', status: 'pending', categoryId: 'cat', creditCardId: 'c1',
    paymentMethod: 'credit_card', recurrence: 'installment', installmentTotal: 3, amountMode: 'total_divided',
    tripId: 't1', originalCurrency: 'USD', originalAmount: 60, myPersonalShareBrl: 150, myPersonalShareForeign: 30,
    tripShares: [
      { participantId: 'p1', foreignShare: 30, brlShare: 150, percentage: 50, sharesWeight: 1 },
      { participantId: 'p2', foreignShare: 30, brlShare: 150, percentage: 50, sharesWeight: 1 },
    ],
  } as any);
  assert.equal(rows.length, 3);
  assert.equal(sumField(rows, (t) => t.originalAmount || 0), 60);
  assert.equal(sumField(rows, (t) => t.myPersonalShareBrl || 0), 150);
  assert.equal(sumField(rows, (t) => t.myPersonalShareForeign || 0), 30);
  assert.equal(sumField(rows, (t) => t.tripShares?.find((s) => s.participantId === 'p1')?.brlShare || 0), 150);
  assert.equal(sumField(rows, (t) => t.tripShares?.find((s) => s.participantId === 'p2')?.foreignShare || 0), 30);
});

test('A06 pagamento parcial divide a moeda estrangeira e a reversão a recompõe', () => {
  const trip = purchase({ originalCurrency: 'USD', originalAmount: 20, tripId: 't1',
    tripShares: [{ participantId: 'p1', foreignShare: 20, brlShare: 100, percentage: 100, sharesWeight: 1 }] } as any);
  const paid = payCreditCardInvoice(card, [trip], '2026-11', 'a1', '2026-11-10', 40);
  const purchases = paid.filter((t) => !t.isInvoicePayment);
  assert.equal(sumField(purchases, (t) => t.originalAmount || 0), 20);
  assert.equal(sumField(purchases, (t) => t.tripShares?.[0]?.brlShare || 0), 100);
  const pay = paid.find((t) => t.isInvoicePayment)!;
  const back = reverseCreditCardInvoicePayment(paid, pay.id, [card]).updatedTransactions.filter((t) => !t.isInvoicePayment);
  assert.equal(back.length, 1);
  assert.equal(back[0].originalAmount, 20);
  assert.equal(back[0].tripShares?.[0]?.brlShare, 100);
});

test('A09 espelho de despesa compartilhada recebida entra no consumo e na projeção pela cota pessoal', () => {
  const mirror: Transaction = { id: 'tx-mirror-s1', description: 'Mercado (do familiar)', amount: 100, date: '2026-11-05', competenceMonth: '2026-11',
    type: 'expense', status: 'pending', categoryId: 'cat', paymentMethod: 'pix', recurrence: 'single', isShared: true, sharedMemberId: 'm1',
    sharedAmount: 50, sharedPaidBy: 'member', sharedStatus: 'pending', isCompanionOnlyExpense: true } as Transaction;
  const s = calculateMonthlySummary([acc], [], [mirror], '2026-11');
  assert.equal(s.expenseTotal, 50, 'a minha cota (50) é gasto do mês');
  assert.equal(bank([mirror]), 1000, 'não debita a conta antes do acerto');
  const flow = calculateDailyCashFlow([acc], [], [mirror], '2026-11');
  assert.equal(flow[flow.length - 1].projectedBalance, 950, 'a projeção desconta a cota pendente');
});

test('A10 identificador do extrato (FITID) só vale dentro da mesma conta', async () => {
  const { checkItemDuplicate, buildDuplicateLookup } = await import('../../services/import-export/ofxParser');
  const existing: Transaction = { id: 'e1', description: 'PADARIA', amount: 10, date: '2026-11-05', competenceMonth: '2026-11', type: 'expense', status: 'paid',
    categoryId: 'cat', accountId: 'contaA', paymentMethod: 'pix', recurrence: 'single', fitid: 'csv-2026-11-05-1000-padaria-1' } as Transaction;
  const item = { fitid: 'csv-2026-11-05-1000-padaria-1', date: '2026-11-05', amount: 10, description: 'PADARIA', rawType: 'expense' as const };
  assert.equal(checkItemDuplicate(item, [existing], 'contaA').isDuplicate, true, 'mesma conta: duplicado');
  assert.equal(checkItemDuplicate(item, [existing], 'contaB').isDuplicate, false, 'outra conta: não é duplicado');
  assert.equal(checkItemDuplicate(item, [existing], 'contaB', 'BRL', undefined, undefined, buildDuplicateLookup([existing])).isDuplicate, false);
});

test('A16 a dívida da viagem é na moeda da viagem: saldo estrangeiro zero não gera cobrança, mesmo com diferença em reais', () => {
  const b = (id: string, f: number, r: number) => ({ participantId: id, participantName: id, netBalanceForeign: f, netBalanceBrl: r }) as any;
  assert.deepEqual(simplifyTripDebts([b('a', 0, 50), b('b', 0, -50)], 5), []);
  const t = simplifyTripDebts([b('a', 20, 100), b('b', -20, -100)], 5);
  assert.equal(t.length, 1);
  assert.equal(t[0].amountForeign, 20, 'a cobrança é em moeda da viagem');
});

test('fatura do cartão lista as compras em ordem cronológica (mais antiga primeiro)', () => {
  const rows = [purchase({ id: 'b', date: '2026-11-20' }), purchase({ id: 'a', date: '2026-11-03' }), purchase({ id: 'c', date: '2026-11-11' })];
  const summary = calculateCreditCardSummary(card, rows, '2026-11');
  assert.deepEqual(summary.transactions.map((t) => t.id), ['a', 'c', 'b']);
});

import { rebuildTransactionSeries } from './financeRules';

const batchInput = (o: Record<string, unknown> = {}) => ({
  description: 'TV', amount: 300, date: '2026-11-02', type: 'expense' as const, status: 'pending' as const, categoryId: 'cat',
  creditCardId: 'c1', paymentMethod: 'credit_card' as const, recurrence: 'installment' as const, installmentTotal: 3, amountMode: 'total_divided' as const, ...o,
});

test('editar parcelamento: trocar 3x por 5x refaz a série com o mesmo total e no mesmo lugar', () => {
  const original = createTransactionBatch(batchInput() as any);
  const other = purchase({ id: 'outra', date: '2026-11-09' });
  const list = [other, ...original];
  const r = rebuildTransactionSeries(list, original[1].id, batchInput({ installmentTotal: 5 }) as any);
  assert.equal(r.error, undefined);
  assert.equal(r.removedCount, 3);
  assert.equal(r.createdCount, 5);
  const rows = r.updatedTransactions.filter((t) => t.installmentGroupId);
  assert.equal(rows.length, 5);
  assert.equal(Math.round(rows.reduce((s, t) => s + t.amount, 0) * 100), 30000);
  assert.equal(r.updatedTransactions[0].id, 'outra');
});

test('editar parcelamento: de parcelado para à vista e de à vista para parcelado', () => {
  const series = createTransactionBatch(batchInput() as any);
  const toSingle = rebuildTransactionSeries(series, series[0].id, batchInput({ recurrence: 'single', installmentTotal: undefined }) as any);
  assert.equal(toSingle.updatedTransactions.length, 1);
  assert.equal(toSingle.updatedTransactions[0].amount, 300);
  const toInstallments = rebuildTransactionSeries(toSingle.updatedTransactions, toSingle.updatedTransactions[0].id, batchInput({ installmentTotal: 4 }) as any);
  assert.equal(toInstallments.updatedTransactions.length, 4);
});

test('editar parcelamento é recusado se alguma parcela já foi paga (nada muda)', () => {
  const series = createTransactionBatch(batchInput() as any);
  const paid = payCreditCardInvoice(card, series, '2026-11', 'a1', '2026-11-10');
  const r = rebuildTransactionSeries(paid, series[1].id, batchInput({ installmentTotal: 5 }) as any);
  assert.ok(r.error);
  assert.equal(r.updatedTransactions, paid);
});

test('editar parcelado no cartão e trocar para conta/débito vira um lançamento único na conta', () => {
  const series = createTransactionBatch(batchInput() as any);
  const r = rebuildTransactionSeries(series, series[0].id, batchInput({ creditCardId: undefined, accountId: 'a1', paymentMethod: 'pix', recurrence: 'single', installmentTotal: undefined, status: 'paid' }) as any);
  assert.equal(r.error, undefined);
  assert.equal(r.updatedTransactions.length, 1);
  assert.equal(r.updatedTransactions[0].creditCardId, undefined);
  assert.equal(r.updatedTransactions[0].accountId, 'a1');
  assert.equal(r.updatedTransactions[0].amount, 300);
});

import { adjustFixedSeriesLength } from './financeRules';

test('fixo: aumentar e diminuir a quantidade de meses sem refazer o que existe', () => {
  const fixed = createTransactionBatch({ description: 'Aluguel', amount: 100, date: '2026-11-05', type: 'expense', status: 'paid', categoryId: 'cat', accountId: 'a1', paymentMethod: 'pix', recurrence: 'fixed', fixedMonthsCount: 6 } as any);
  const more = adjustFixedSeriesLength(fixed, fixed[0].id, 9);
  assert.equal(more.updatedTransactions.length, 9);
  assert.equal(more.updatedTransactions[0].id, fixed[0].id, 'o que existia continua igual (inclusive o mês já pago)');
  assert.equal(more.updatedTransactions[8].competenceMonth, '2027-07');
  assert.equal(more.updatedTransactions[8].status, 'pending');
  const less = adjustFixedSeriesLength(more.updatedTransactions, fixed[0].id, 3);
  assert.equal(less.updatedTransactions.length, 3);
  const paidTail = more.updatedTransactions.map((t, i) => (i === 8 ? { ...t, status: 'paid' as const } : t));
  assert.ok(adjustFixedSeriesLength(paidTail, fixed[0].id, 3).error, 'não tira meses já pagos');
});

import { releaseExchangeLotMovements } from './financeRules';

test('A19 apagar a viagem mantém o dinheiro da compra de câmbio no extrato (editável depois)', () => {
  const fx: Transaction = { id: 'tx-fxlot-L1', description: 'Câmbio', amount: 600, date: '2026-11-03', competenceMonth: '2026-11', type: 'transfer', status: 'paid', categoryId: 'cat-viagens', accountId: 'a1', destinationAccountId: 'usd', paymentMethod: 'transfer', recurrence: 'single' };
  const out = releaseExchangeLotMovements([fx], ['L1']);
  assert.equal(out.length, 1);
  assert.equal(out[0].amount, 600);
  assert.equal(out[0].id.startsWith('tx-fxlot-'), false);
});
