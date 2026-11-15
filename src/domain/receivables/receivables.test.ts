import assert from 'node:assert/strict';
import test from 'node:test';
import type { BankAccount, CreditCard, Receivable, Transaction } from '../../types/finance';
import {
  createReceivable, deleteReceivable, getInvoiceMonthOptions, getReceivableBalance, getReceivableStatus,
  registerReceivablePayment, removeReceivablePayment, summarizeReceivables,
} from './receivables';
import { reclassifyClosingDayPurchases, resolveCreditCardInvoiceMonth, calculateNetWorth, calculateAccountBalances, calculateCreditCardSummary, calculateMonthlySummary, calculateCategoryBreakdown } from '../finance/financeRules';

const account: BankAccount = { id: 'a', name: 'Conta', institution: 'Banco', type: 'checking', initialBalance: 1000, color: '#000', includeInTotal: true };
const card: CreditCard = { id: 'c', name: 'Itaú azul', brand: 'Visa', limit: 5000, closingDay: 20, dueDay: 28, defaultAccountId: 'a', color: '#00f' };
const own: Transaction = { id: 'own', description: 'Mercado', amount: 200, date: '2026-11-05', competenceMonth: '2026-11', type: 'expense', status: 'paid', categoryId: 'cat-mercado', accountId: 'a', recurrence: 'single', paymentMethod: 'pix' };

function invoiceReceivable() {
  const result = createReceivable({ id: 'r1', kind: 'card_invoice', personName: 'Esposa', amount: 1800, date: '2026-11-20', cardId: 'c', invoiceMonth: '2026-11', cardName: 'Itaú azul' });
  assert.ok(!result.error);
  return result as Exclude<typeof result, { error: string }>;
}

test('fatura do cartão adicional: entra na fatura e no limite, mas não é gasto seu', () => {
  const { receivable, transactions } = invoiceReceivable();
  assert.equal(receivable.amount, 1800);
  assert.equal(transactions.length, 1);
  const all = [own, ...transactions];
  const invoice = calculateCreditCardSummary(card, all, '2026-11');
  assert.equal(invoice.invoiceTotal, 1800, 'a fatura do banco inclui o valor da esposa');
  assert.equal(invoice.usedLimit, 1800);
  const summary = calculateMonthlySummary([account], [card], all, '2026-11');
  assert.equal(summary.expenseTotal, 200, 'só o gasto próprio conta como despesa');
  assert.equal(summary.creditCardMonthTotal, 0);
  const categories = [{ id: 'cat-mercado', name: 'Mercado', type: 'expense', monthlyBudget: 0, bucket: 'essential' }, { id: 'cat-outros', name: 'Outros', type: 'expense', monthlyBudget: 0, bucket: 'essential' }] as never;
  const spent = calculateCategoryBreakdown(categories, all, '2026-11').reduce((sum, item) => sum + item.spent, 0);
  assert.equal(spent, 200);
});

test('pagamentos parciais abatem a dívida; recebimento entra na conta mas não é receita', () => {
  const { receivable, transactions } = invoiceReceivable();
  let current: Receivable = receivable;
  let all: Transaction[] = [own, ...transactions];
  const first = registerReceivablePayment(current, { id: 'p1', date: '2026-12-02', amount: 500, accountId: 'a' });
  assert.ok(!first.error);
  if (first.error !== undefined) return;
  current = first.receivable; all = [...all, first.transaction];
  assert.equal(getReceivableBalance(current), 1300);
  assert.equal(getReceivableStatus(current), 'partial');
  const dec = calculateAccountBalances([account], all, '2026-12')[0];
  assert.equal(dec.currentBalance, 1000 - 200 + 500, 'o dinheiro entra na conta');
  assert.equal(calculateMonthlySummary([account], [card], all, '2026-12').incomeTotal, 0, 'não conta como receita');
  const rest = registerReceivablePayment(current, { id: 'p2', date: '2026-12-20', amount: 1300, accountId: 'a' });
  assert.ok(!rest.error);
  if (rest.error !== undefined) return;
  assert.equal(getReceivableStatus(rest.receivable), 'paid');
  assert.ok(registerReceivablePayment(rest.receivable, { id: 'p3', date: '2026-12-21', amount: 1, accountId: 'a' }).error, 'quitado não recebe mais');
});

test('não aceita pagamento maior que o saldo, sem conta ou valor inválido', () => {
  const { receivable } = invoiceReceivable();
  assert.match(registerReceivablePayment(receivable, { id: 'x', date: '2026-12-01', amount: 1800.01, accountId: 'a' }).error ?? '', /passa do que falta/);
  assert.match(registerReceivablePayment(receivable, { id: 'x', date: '2026-12-01', amount: 10, accountId: '' }).error ?? '', /conta/);
  assert.match(registerReceivablePayment(receivable, { id: 'x', date: '2026-12-01', amount: 0, accountId: 'a' }).error ?? '', /maior que zero/);
});

test('empréstimo: sem prazo, com ou sem saída da conta, fora dos seus gastos', () => {
  const withOutflow = createReceivable({ id: 'r2', kind: 'loan', personName: 'Irmã', amount: 1000, date: '2026-11-10', fromAccountId: 'a' });
  assert.ok(!withOutflow.error);
  if (withOutflow.error !== undefined) return;
  assert.equal(withOutflow.transactions.length, 1);
  const all = [own, ...withOutflow.transactions];
  assert.equal(calculateAccountBalances([account], all, '2026-11')[0].currentBalance, 1000 - 200 - 1000);
  assert.equal(calculateMonthlySummary([account], [card], all, '2026-11').expenseTotal, 200);
  const record = createReceivable({ id: 'r3', kind: 'loan', personName: 'Irmã', amount: 500, date: '2026-11-10' });
  assert.ok(!record.error);
  if (record.error !== undefined) return;
  assert.equal(record.transactions.length, 0, 'só o registro da dívida');
});

test('resumo por pessoa, desfazer pagamento e apagar tudo', () => {
  const a = invoiceReceivable();
  const l = createReceivable({ id: 'r2', kind: 'loan', personName: 'Irmã', amount: 1000, date: '2026-11-10' }) as Exclude<ReturnType<typeof createReceivable>, { error: string }>;
  const paid = registerReceivablePayment(a.receivable, { id: 'p1', date: '2026-12-02', amount: 300, accountId: 'a' }) as Exclude<ReturnType<typeof registerReceivablePayment>, { error: string }>;
  const summary = summarizeReceivables([paid.receivable, l.receivable]);
  assert.equal(summary.totalOpen, 1500 + 1000);
  assert.deepEqual(summary.byPerson.map((p) => [p.personName, p.balance]), [['Esposa', 1500], ['Irmã', 1000]]);
  const undone = removeReceivablePayment(paid.receivable, [...a.transactions, paid.transaction], 'p1');
  assert.equal(getReceivableBalance(undone.receivable), 1800);
  assert.equal(undone.transactions.length, 1);
  const wiped = deleteReceivable([paid.receivable, l.receivable], [...a.transactions, paid.transaction], 'r1');
  assert.equal(wiped.receivables.length, 1);
  assert.equal(wiped.transactions.length, 0);
});

test('o servidor aceita o campo receivablesJson no mesmo formato do workspace', async () => {
  const { parseWorkspaceArray } = await import('../../services/workspace/workspacePayload');
  const { receivable } = invoiceReceivable();
  const withPayment = registerReceivablePayment(receivable, { id: 'p1', date: '2026-12-02', amount: 500, accountId: 'a' });
  assert.ok(withPayment.error === undefined);
  if (withPayment.error !== undefined) return;
  const parsed = parseWorkspaceArray<Receivable>(JSON.stringify([withPayment.receivable]), [], 'receivablesJson');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].payments[0].amount, 500);
  assert.match(receivable.description, /novembro de 2026/i);
});

test('meses da fatura: do mês atual até o último mês com compra no cartão', () => {
  const buy = (id: string, month: string, cardId = 'c'): Transaction => ({ ...own, id, creditCardId: cardId, competenceMonth: month, date: `${month}-10` });
  const txs = [buy('a', '2026-09'), buy('b', '2027-01'), buy('c2', '2028-01', 'outro')];
  assert.deepEqual(getInvoiceMonthOptions(txs, 'c', '2026-11-14'), ['2026-11', '2026-12', '2027-01']);
  assert.deepEqual(getInvoiceMonthOptions([], 'c', '2026-11-14'), ['2026-11']);
});

test('patrimônio: o a receber em aberto entra como ativo e compensa a fatura do cartão adicional', () => {
  const { receivable, transactions } = invoiceReceivable();
  const all = [own, ...transactions];
  const balances = calculateAccountBalances([account], all, '2026-11');
  const summaries = [calculateCreditCardSummary(card, all, '2026-11')];
  const without = calculateNetWorth(balances, [], summaries);
  const withReceivable = calculateNetWorth(balances, [], summaries, summarizeReceivables([receivable]).totalOpen);
  assert.equal(without.totalNetWorth, 800 - 1800, 'sem o a receber, a fatura dela parece perda');
  assert.equal(withReceivable.totalNetWorth, 800, 'com o a receber, o patrimônio não cai');
  assert.equal(withReceivable.receivablesTotal, 1800);
});

test('fechamento: compra no dia do fechamento vai para a próxima fatura só se o cartão assim configurar', () => {
  const normal = { closingDay: 30, dueDay: 10 };
  assert.equal(resolveCreditCardInvoiceMonth('2026-11-30', normal), '2026-12', 'fecha 30, vence 10: compra até o dia 30 vence em dezembro');
  assert.equal(resolveCreditCardInvoiceMonth('2026-11-30', { ...normal, closingDayStartsNextInvoice: true }), '2027-01');
  assert.equal(resolveCreditCardInvoiceMonth('2026-11-29', { ...normal, closingDayStartsNextInvoice: true }), '2026-12');
});

test('ao marcar a regra do fechamento, compras pendentes feitas no dia do fechamento mudam de fatura', () => {
  const itau: CreditCard = { ...card, id: 'i', closingDay: 30, dueDay: 5 };
  const base: Transaction = { ...own, type: 'expense', status: 'pending', paymentMethod: 'credit_card', creditCardId: 'i', accountId: 'a' };
  const onClosing: Transaction = { ...base, id: 'x1', date: '2026-10-30', competenceMonth: '2026-11' };
  const before: Transaction = { ...base, id: 'x2', date: '2026-10-29', competenceMonth: '2026-11' };
  const manual: Transaction = { ...base, id: 'x3', date: '2026-10-30', competenceMonth: '2027-02' };
  const paid: Transaction = { ...base, id: 'x4', date: '2026-10-30', competenceMonth: '2026-11', status: 'paid' };
  const installment: Transaction = { ...base, id: 'x5', date: '2026-10-30', competenceMonth: '2026-11', installmentGroupId: 'g' };
  const next = { ...itau, closingDayStartsNextInvoice: true };
  const out = reclassifyClosingDayPurchases([onClosing, before, manual, paid, installment], itau, next);
  assert.equal(out[0].competenceMonth, '2026-12');
  assert.equal(out[1].competenceMonth, '2026-11', 'véspera do fechamento não muda');
  assert.equal(out[2].competenceMonth, '2027-02', 'ajuste manual preservado');
  assert.equal(out[3].competenceMonth, '2026-11', 'já pago não muda');
  assert.equal(out[4].competenceMonth, '2026-11', 'parcelamento não muda');
  assert.equal(reclassifyClosingDayPurchases(out, next, itau)[0].competenceMonth, '2026-11', 'desmarcar volta ao normal');
});

test('o servidor rejeita valor a receber corrompido (kind, valor, data, pagamentos maiores que a dívida)', async () => {
  const { parseWorkspaceArray } = await import('../../services/workspace/workspacePayload');
  const ok = { id: 'r', kind: 'loan', personName: 'Muri', amount: 6500, createdDate: '2026-11-14', payments: [] };
  assert.equal(parseWorkspaceArray(JSON.stringify([ok]), [], 'receivablesJson').length, 1);
  const bad = (patch: Record<string, unknown>) => () => parseWorkspaceArray(JSON.stringify([{ ...ok, ...patch }]), [], 'receivablesJson');
  assert.throws(bad({ kind: 'outro' }));
  assert.throws(bad({ amount: -1 }));
  assert.throws(bad({ amount: 10.005 }));
  assert.throws(bad({ createdDate: '2026-13-40' }));
  assert.throws(bad({ amount: 10, payments: [{ id: 'p', amount: 11, date: '2026-11-15', accountId: 'a' }] }));
  assert.throws(bad({ payments: [{ id: 'p', amount: 1, date: '2026-11-15', accountId: 'a' }, { id: 'p', amount: 1, date: '2026-11-15', accountId: 'a' }] }));
});
