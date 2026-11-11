import assert from 'node:assert/strict';
import test from 'node:test';
import type { CreditCard, Transaction } from '../types/finance';
import {
  applyHighConfidenceInstallmentTotals,
  auditLegacyFinancialRecords,
  exportFinancialHistoryAuditCsv,
} from './legacyFinancialAudit';

const card: CreditCard = {
  id: 'card-audit',
  name: 'Cartão QA',
  brand: 'Visa',
  limit: 5000,
  closingDay: 20,
  dueDay: 28,
  defaultAccountId: 'account-1',
  color: '#123456',
};

function installment(
  id: string,
  number: number,
  amount: number,
  overrides: Partial<Transaction> = {}
): Transaction {
  return {
    id,
    description: 'Compra teste',
    amount,
    date: `2026-${String(number).padStart(2, '0')}-05`,
    competenceMonth: `2026-${String(number).padStart(2, '0')}`,
    type: 'expense',
    status: 'pending',
    categoryId: 'cat-outros',
    creditCardId: card.id,
    paymentMethod: 'credit_card',
    recurrence: 'installment',
    installmentGroupId: 'group-audit',
    installmentNumber: number,
    installmentTotal: 3,
    ...overrides,
  };
}

test('audit suggests a high-confidence installment total without changing source rows', () => {
  const transactions = [
    installment('parcel-1', 1, 10),
    installment('parcel-2', 2, 10),
    installment('parcel-3', 3, 10),
  ];
  const before = structuredClone(transactions);

  const report = auditLegacyFinancialRecords(transactions, [card]);

  assert.deepEqual(transactions, before);
  assert.equal(report.length, 1);
  assert.equal(report[0].issue, 'installment_total');
  assert.equal(report[0].confidence, 'high');
  assert.equal(report[0].suggestedPurchaseTotal, 30);
  assert.deepEqual(report[0].transactionIds, ['parcel-1', 'parcel-2', 'parcel-3']);
});

test('audit recombines a linked partial invoice split when estimating a series total', () => {
  const transactions = [
    installment('parcel-1', 1, 8),
    installment('parcel-1-paid-1', 1, 2, {
      status: 'paid',
      partialSplitOriginalId: 'parcel-1',
      invoicePaymentId: 'invoice-1',
    }),
    installment('parcel-2', 2, 10),
    installment('parcel-3', 3, 10),
  ];

  const report = auditLegacyFinancialRecords(transactions, [card]);
  const totalRow = report.find((row) => row.issue === 'installment_total');

  assert.equal(totalRow?.confidence, 'high');
  assert.equal(totalRow?.suggestedPurchaseTotal, 30);
});

test('audit marks incomplete installment series for manual review', () => {
  const report = auditLegacyFinancialRecords(
    [installment('parcel-1', 1, 10), installment('parcel-3', 3, 10)],
    [card]
  );

  assert.equal(report[0]?.confidence, 'review');
  assert.equal(report[0]?.suggestedPurchaseTotal, 20);
  assert.match(report[0]?.reason || '', /incompleta/);
});

test('audit restores original installment values before discounting when a series was anticipated', () => {
  const transactions = [
    installment('parcel-1', 1, 10),
    installment('parcel-2', 2, 9, {
      amount: 9,
      isAnticipated: true,
      originalAmountBeforeDiscount: 10,
    }),
    installment('parcel-3', 3, 10),
  ];

  const report = auditLegacyFinancialRecords(transactions, [card]);

  assert.equal(report[0]?.confidence, 'high');
  assert.equal(report[0]?.suggestedPurchaseTotal, 30);
});

test('audit withholds an estimate for an anticipated installment that was also split partially', () => {
  const transactions = [
    installment('parcel-1', 1, 8, {
      isAnticipated: true,
      originalAmountBeforeDiscount: 10,
    }),
    installment('parcel-1-paid-1', 1, 2, {
      status: 'paid',
      partialSplitOriginalId: 'parcel-1',
      invoicePaymentId: 'invoice-1',
      isAnticipated: true,
      originalAmountBeforeDiscount: 10,
    }),
    installment('parcel-2', 2, 10),
    installment('parcel-3', 3, 10),
  ];

  const report = auditLegacyFinancialRecords(transactions, [card]);

  assert.equal(report[0]?.confidence, 'review');
  assert.equal(report[0]?.suggestedPurchaseTotal, null);
  assert.match(report[0]?.reason || '', /não permite estimar/);
});

test('audit flags a saved original total that does not match the complete installment sum', () => {
  const transactions = [
    installment('parcel-1', 1, 10, { installmentPurchaseTotal: 35 }),
    installment('parcel-2', 2, 10, { installmentPurchaseTotal: 35 }),
    installment('parcel-3', 3, 10, { installmentPurchaseTotal: 35 }),
  ];

  const report = auditLegacyFinancialRecords(transactions, [card]);

  assert.equal(report.length, 1);
  assert.equal(report[0].confidence, 'review');
  assert.equal(report[0].suggestedPurchaseTotal, 30);
  assert.match(report[0].reason, /diverge/);
});

test('explicit migration helper fills only high-confidence missing totals and preserves installment amounts', () => {
  const transactions = [
    installment('parcel-1', 1, 10),
    installment('parcel-2', 2, 10),
    installment('parcel-3', 3, 10),
    installment('incomplete-1', 1, 7, { installmentGroupId: 'group-incomplete' }),
    installment('unrelated-same-group-id', 1, 99, {
      recurrence: 'fixed',
      creditCardId: undefined,
    }),
  ];
  const before = structuredClone(transactions);

  const result = applyHighConfidenceInstallmentTotals(transactions, [card]);

  assert.equal(result.updatedGroups, 1);
  assert.equal(result.updatedRows, 3);
  assert.equal(result.updatedTransactions[0].installmentPurchaseTotal, 30);
  assert.equal(result.updatedTransactions[1].amount, 10);
  assert.equal(result.updatedTransactions[2].amount, 10);
  assert.equal(result.updatedTransactions[3].installmentPurchaseTotal, undefined);
  assert.equal(result.updatedTransactions[4].installmentPurchaseTotal, undefined);
  assert.deepEqual(transactions, before);
});

test('audit only flags invoice competence differences for review using current card settings', () => {
  const purchase: Transaction = {
    ...installment('purchase-competence', 1, 10, {
      recurrence: 'single',
      installmentGroupId: undefined,
      installmentNumber: undefined,
      installmentTotal: undefined,
      date: '2026-11-21',
      competenceMonth: '2026-12',
    }),
  };

  const cardWithChangedSettings = { ...card, dueDay: 5 };
  const report = auditLegacyFinancialRecords([purchase], [cardWithChangedSettings]);

  assert.equal(report.length, 1);
  assert.equal(report[0].issue, 'invoice_competence');
  assert.equal(report[0].confidence, 'review');
  assert.equal(report[0].savedCompetence, '2026-12');
  assert.equal(report[0].suggestedCompetence, '2027-01');
  assert.match(report[0].reason, /Não corrigir automaticamente/);
});

test('audit CSV safely quotes formula-like values and uses Brazilian amount formatting', () => {
  const csv = exportFinancialHistoryAuditCsv([
    {
      issue: 'installment_total',
      confidence: 'high',
      cardName: '=Cartão',
      cardId: 'card-audit',
      groupId: 'group-audit',
      transactionIds: ['tx-1', 'tx-2'],
      savedCompetence: '2026-11',
      suggestedCompetence: '',
      suggestedPurchaseTotal: 1255.5,
      reason: 'Revisar; não gravar automaticamente.',
    },
  ]);

  assert.match(csv, /"'=Cartão"/);
  assert.match(csv, /"1255,50"/);
  assert.match(csv, /"tx-1,tx-2"/);
  assert.match(csv, /"Revisar; não gravar automaticamente\."/);
});
