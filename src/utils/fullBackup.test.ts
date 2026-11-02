import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFullFinanceBackup } from './fullBackup';

function validBackup() {
  return {
    version: 5,
    exportedAt: '2026-11-02T12:00:00.000Z',
    accounts: [],
    cards: [],
    categories: [
      {
        id: 'cat-food',
        name: 'Alimentação',
        type: 'expense',
        bucket: 'essential',
        monthlyBudget: 0,
        color: '#059669',
        icon: 'shopping-cart',
        subcategories: [],
      },
    ],
    transactions: [],
    goals: [],
    investments: [],
    trips: [],
    familyMembers: [],
    investmentTargets: {},
    settings: {},
  };
}

test('accepts a complete version 5 backup', () => {
  const result = parseFullFinanceBackup(JSON.stringify(validBackup()));
  assert.equal(result?.version, 5);
  assert.equal(result?.categories[0]?.id, 'cat-food');
});

test('accepts earlier supported backup versions with optional fields omitted', () => {
  const backup = validBackup();
  const legacyBackup = {
    ...backup,
    version: 3,
    familyMembers: undefined,
    investmentTargets: undefined,
    settings: undefined,
    exportedAt: undefined,
  };
  assert.equal(parseFullFinanceBackup(JSON.stringify(legacyBackup))?.version, 3);
});

test('rejects malformed JSON and non-object payloads', () => {
  assert.equal(parseFullFinanceBackup('{'), null);
  assert.equal(parseFullFinanceBackup('null'), null);
  assert.equal(parseFullFinanceBackup('[]'), null);
});

test('rejects unsupported versions or missing required collections', () => {
  assert.equal(
    parseFullFinanceBackup(JSON.stringify({ ...validBackup(), version: 6 })),
    null
  );
  const missingTransactions = { ...validBackup(), transactions: undefined };
  assert.equal(parseFullFinanceBackup(JSON.stringify(missingTransactions)), null);
});

test('rejects invalid category records and nested subcategories before applying state', () => {
  const emptyCategories = { ...validBackup(), categories: [] };
  const invalidBudget = {
    ...validBackup(),
    categories: [{ ...validBackup().categories[0], monthlyBudget: Number.NaN }],
  };
  const invalidSubcategory = {
    ...validBackup(),
    categories: [
      { ...validBackup().categories[0], subcategories: [null] },
    ],
  };
  assert.equal(parseFullFinanceBackup(JSON.stringify(emptyCategories)), null);
  assert.equal(parseFullFinanceBackup(JSON.stringify(invalidBudget)), null);
  assert.equal(parseFullFinanceBackup(JSON.stringify(invalidSubcategory)), null);
});

test('rejects non-object entries in the collections sanitized by the app', () => {
  const invalidTransaction = {
    ...validBackup(),
    transactions: [null],
  };
  assert.equal(parseFullFinanceBackup(JSON.stringify(invalidTransaction)), null);
});
