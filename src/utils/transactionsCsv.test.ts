import assert from 'node:assert/strict';
import test from 'node:test';
import type { Transaction } from '../types/finance';
import { exportTransactionsToSafeCSV } from './transactionsCsv';

test('CSV export preserves negative expense values, ISO dates, and delimiters while neutralizing formula text', () => {
  const transaction = {
    id: 'tx-csv-fixture',
    date: '2026-11-07',
    competenceMonth: '2026-11',
    description: '  =HYPERLINK("https://evil.invalid";"abrir")',
    amount: 12.34,
    type: 'expense',
    status: 'paid',
    categoryId: 'category-fixture',
    accountId: 'account-fixture',
    paymentMethod: 'pix',
    recurrence: 'single',
  } as Transaction;

  const csv = exportTransactionsToSafeCSV(
    [transaction, { ...transaction, id: 'tx-csv-malformed-date', date: '=TODAY()', competenceMonth: '@SUM(1;1)' }],
    [{
      id: 'category-fixture',
      name: '\t+SUM(1;1)',
      type: 'expense',
      bucket: 'essential',
      color: '#000000',
      icon: 'tag',
      monthlyBudget: 0,
    }],
    [{ id: 'account-fixture', name: '-conta' } as never],
    []
  );

  const row = csv.split('\n')[1];
  assert.ok(row);
  assert.ok(row.includes('"2026-11-07";"2026-11"'));
  assert.ok(row.includes('"\'  =HYPERLINK(""https://evil.invalid"";""abrir"")"'));
  assert.ok(row.includes('"\'\t+SUM(1;1)"'));
  assert.ok(row.includes('"\'-conta"'));
  assert.ok(row.endsWith('"-12,34"'), 'numeric expense remains a valid negative amount, not text-prefixed');
  const malformedDateRow = csv.split('\n')[2];
  assert.ok(malformedDateRow.startsWith('"\'=TODAY()";"\'@SUM(1;1)"'));
});

test('CSV export neutralizes formula markers after spaces and C0/C1 control characters', () => {
  const prefixes = [' ', '\t', '\r', '\n', '\u0000', '\u007f', '\u0085', '\ufeff'];
  for (const prefix of prefixes) {
    const csv = exportTransactionsToSafeCSV([{
      id: `tx-${prefix.charCodeAt(0)}`,
      date: '2026-11-07',
      competenceMonth: '2026-11',
      description: `${prefix}=1+1`,
      amount: 1.25,
      type: 'expense',
      status: 'paid',
      categoryId: 'missing',
      paymentMethod: 'pix',
      recurrence: 'single',
    } as Transaction], [], [], []);
    assert.ok(csv.includes(`;"'${prefix}=1+1"`), `formula-like description after ${JSON.stringify(prefix)} is text-prefixed`);
    assert.ok(csv.endsWith('"-1,25"'), 'expense amount remains numeric and negative');
  }
});
