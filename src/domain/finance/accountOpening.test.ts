import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAccountBalances, isBeforeAccountOpening } from './accountBalances.ts';
import { calculateAccountStatementWithRunningBalance } from '../budgets/uxEnhancementRules.ts';
import { validateWorkspaceConsistency, parseWorkspaceArray } from '../../services/workspace/workspacePayload.ts';
import type { BankAccount, Transaction } from '../../types/finance';

const account: BankAccount = { id: 'a1', name: 'Banco', institution: 'B', type: 'checking', initialBalance: 1000, color: '#000', includeInTotal: true };
const tx = (id: string, date: string, type: 'income' | 'expense', amount: number): Transaction => ({
  id, description: id, amount, date, competenceMonth: date.slice(0, 7), type, status: 'paid', categoryId: 'c', accountId: 'a1', paymentMethod: 'pix', recurrence: 'single',
} as Transaction);
const history = [tx('antigo', '2026-10-20', 'expense', 300), tx('antes', '2026-11-04', 'expense', 50), tx('no-dia', '2026-11-05', 'expense', 100), tx('depois', '2026-11-10', 'income', 40)];

test('sem data de abertura todos os lançamentos contam (contas antigas não mudam)', () => {
  const [balance] = calculateAccountBalances([account], history, '2026-11');
  assert.equal(balance.currentBalance, 1000 - 300 - 50 - 100 + 40);
});

test('com data de abertura só conta do próprio dia em diante; antes é histórico', () => {
  const opened = { ...account, initialBalanceDate: '2026-11-05' };
  const [balance] = calculateAccountBalances([opened], history, '2026-11');
  assert.equal(balance.currentBalance, 1000 - 100 + 40, 'saldo no começo de 05/11 é R$ 1.000; entram 05/11 e depois');
  assert.equal(balance.monthExpense, 100, 'o gasto de 04/11 não entra no mês da conta');
  assert.equal(isBeforeAccountOpening(opened, '2026-11-04'), true);
  assert.equal(isBeforeAccountOpening(opened, '2026-11-05'), false);
  assert.equal(isBeforeAccountOpening(account, '1999-01-01'), false);
});

test('transferência anterior à abertura não mexe na conta que abriu depois, mas mexe na outra', () => {
  const other: BankAccount = { ...account, id: 'a2', initialBalance: 0 };
  const opened = { ...account, initialBalanceDate: '2026-11-05' };
  const transfer = { ...tx('t', '2026-11-01', 'expense', 200), type: 'transfer', destinationAccountId: 'a2' } as Transaction;
  const [a1, a2] = calculateAccountBalances([opened, other], [transfer], '2026-11');
  assert.equal(a1.currentBalance, 1000, 'saiu antes da abertura: não conta');
  assert.equal(a2.currentBalance, 200, 'a outra conta recebeu normalmente');
});

test('extrato com saldo corrido respeita a data de abertura', () => {
  const statement = calculateAccountStatementWithRunningBalance('a1', 1000, history, '2026-11', '2026-11-05');
  assert.equal(statement.entriesChronological.map((entry) => entry.transaction.id).join(','), 'no-dia,depois');
  assert.equal(statement.entriesChronological.at(-1)?.runningRealizedAfter, 940);
  const legacy = calculateAccountStatementWithRunningBalance('a1', 1000, history, '2026-11');
  assert.equal(legacy.entriesChronological.length, 3);
});

test('o servidor recusa data de abertura inválida e aceita ausente ou real', () => {
  const run = (initialBalanceDate?: string) => validateWorkspaceConsistency({ accounts: [{ ...account, initialBalanceDate }], cards: [], transactions: [] });
  assert.equal(run(undefined), null);
  assert.equal(run('2026-11-05'), null);
  const okItem = JSON.stringify([{ ...account, initialBalanceDate: '2026-11-05' }]);
  assert.equal(parseWorkspaceArray(okItem, [], 'accountsJson').length, 1);
  assert.throws(() => parseWorkspaceArray(JSON.stringify([{ ...account, initialBalanceDate: '2026-13-45' }]), [], 'accountsJson'));
});
