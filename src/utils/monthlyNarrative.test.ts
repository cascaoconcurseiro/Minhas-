import assert from 'node:assert/strict';
import test from 'node:test';
import type { BankAccount, Category, CreditCard, FamilyMember, Transaction } from '../types/finance';
import { buildMonthlyInsights } from './monthlyNarrative';

const account: BankAccount = { id: 'a1', name: 'Conta', institution: 'Banco', type: 'checking', initialBalance: 0, color: '#000', includeInTotal: true };
const card: CreditCard = { id: 'c1', name: 'Cartão', brand: 'Visa', limit: 5000, closingDay: 25, dueDay: 5, defaultAccountId: 'a1', color: '#000' };
const cat = (id: string, name: string, over: Partial<Category> = {}): Category => ({ id, name, type: 'expense', bucket: 'essential', monthlyBudget: 0, color: '#000', icon: 'tag', ...over });
const categories = [cat('cat-mercado', 'Supermercado'), cat('cat-lazer', 'Lazer', { bucket: 'lifestyle' }), cat('cat-salario', 'Salário', { type: 'income', bucket: 'financial' })];
const fran = { id: 'fam-fran', name: 'FRAN', color: '#ec4899', relationship: 'cônjuge' } as FamilyMember;
let n = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: `t${n++}`, description: 'x', amount: 100, date: '2026-10-10', competenceMonth: '2026-10', type: 'expense', status: 'paid',
  categoryId: 'cat-mercado', paymentMethod: 'pix', recurrence: 'single', accountId: 'a1', ...over,
});
const insights = (transactions: Transaction[], selectedMonth: string, referenceDate: string, cats = categories) =>
  buildMonthlyInsights({ accounts: [account], cards: [card], categories: cats, transactions, familyMembers: [fran], selectedMonth, referenceDate });
const get = (list: ReturnType<typeof insights>, id: string) => list.find((item) => item.id === id);

const closedMonth = [
  tx({ type: 'income', categoryId: 'cat-salario', amount: 5000, date: '2026-10-05', competenceMonth: '2026-10' }),
  tx({ amount: 1500, categoryId: 'cat-mercado' }),
  tx({ amount: 400, categoryId: 'cat-lazer' }),
  tx({ amount: 1000, categoryId: 'cat-mercado', date: '2026-09-10', competenceMonth: '2026-09' }),
  tx({ amount: 100, categoryId: 'cat-lazer', date: '2026-09-12', competenceMonth: '2026-09' }),
];

test('closed month: compares with the previous month, names the biggest category and the one that rose the most in reais', () => {
  const list = insights(closedMonth, '2026-10', '2026-11-12');
  assert.match(get(list, 'spending')?.text ?? '', /gastou R\$\s?1\.900,00 em outubro, 73% a mais que em setembro/);
  assert.equal(get(list, 'spending')?.tone, 'warn');
  assert.match(get(list, 'top-category')?.text ?? '', /Supermercado: R\$\s?1\.500,00 \(79% dos gastos\)/);
  assert.match(get(list, 'category-jump')?.text ?? '', /Supermercado subiu R\$\s?500,00 \(\+50%\) em relação a setembro/);
  assert.match(get(list, 'balance')?.text ?? '', /Sobrou R\$\s?3\.100,00 em outubro \(62% do que você recebeu\)/);
  assert.equal(get(list, 'balance')?.tone, 'good');
});

test('month in progress: says "até agora" and does not compare a partial month as if it were finished', () => {
  const list = insights(closedMonth.map((t) => (t.date.startsWith('2026-10') ? { ...t, date: t.date.replace('2026-10', '2026-11'), competenceMonth: '2026-11' } : { ...t, date: t.date.replace('2026-09', '2026-10'), competenceMonth: '2026-10' })), '2026-11', '2026-11-12');
  const spending = get(list, 'spending')?.text ?? '';
  assert.match(spending, /Até agora você gastou/);
  assert.match(spending, /outubro fechou em/);
  assert.equal(get(list, 'category-jump'), undefined);
});

test('flags spending above income and budgets that were exceeded', () => {
  const cats = [cat('cat-mercado', 'Supermercado', { monthlyBudget: 1000 }), ...categories.slice(1)];
  const list = insights(
    [tx({ type: 'income', categoryId: 'cat-salario', amount: 1000, date: '2026-10-05', competenceMonth: '2026-10' }), tx({ amount: 1500 })],
    '2026-10', '2026-11-12', cats
  );
  assert.match(get(list, 'over-budget')?.text ?? '', /Passou do teto: Supermercado \(R\$\s?1\.500,00 de R\$\s?1\.000,00\)/);
  assert.match(get(list, 'balance')?.text ?? '', /gastou R\$\s?500,00 a mais do que recebeu/);
});

test('tells how much the family still owes, only from expenses you paid and that are pending', () => {
  const shared = (over: Partial<Transaction>) => tx({ isShared: true, sharedMemberId: 'fam-fran', sharedAmount: 50, sharedPaidBy: 'me', sharedStatus: 'pending', ...over });
  const list = insights([
    tx({ amount: 100 }), shared({}), shared({ date: '2026-09-10', competenceMonth: '2026-09' }),
    shared({ sharedStatus: 'received' }), shared({ sharedPaidBy: 'member' }),
  ], '2026-10', '2026-11-12');
  assert.match(get(list, 'owed-fam-fran')?.text ?? '', /FRAN ainda te deve R\$\s?100,00 de gastos divididos/);
});

test('says nothing when there is no data to support a sentence', () => {
  assert.deepEqual(insights([], '2026-10', '2026-11-12'), []);
  const onlyIncome = insights([tx({ type: 'income', categoryId: 'cat-salario', amount: 5000 })], '2026-10', '2026-11-12');
  assert.equal(get(onlyIncome, 'spending'), undefined);
  assert.equal(get(onlyIncome, 'balance'), undefined);
});
