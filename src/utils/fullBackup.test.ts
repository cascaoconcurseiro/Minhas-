import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFullFinanceBackup, resolveFullBackupOptionalState } from './fullBackup';
import type { AppSettings, FamilyMember, InvestmentTargetMap } from '../types/finance';

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

test('restoring an older backup replaces optional workspace fields with defaults instead of keeping destination data', () => {
  const backup = parseFullFinanceBackup(JSON.stringify({
    ...validBackup(),
    version: 3,
    familyMembers: undefined,
    investmentTargets: undefined,
    settings: undefined,
  }));
  assert.ok(backup);

  const result = resolveFullBackupOptionalState(backup, {
    familyMembers: [],
    investmentTargets: {
      renda_fixa_pos: 20,
      renda_fixa_ipca: 20,
      fiis: 20,
      acoes_br: 20,
      exterior_etf: 20,
    } as InvestmentTargetMap,
    settings: {
      theme: 'light',
      density: 'comfortable',
      privacyMode: false,
      showOverviewAlerts: true,
      alertsExpandedByDefault: true,
      budgetWarningPercent: 80,
      userName: 'Você',
      userPixKey: '',
    } as AppSettings,
  });

  assert.deepEqual(result.familyMembers, []);
  assert.equal(result.investmentTargets.renda_fixa_pos, 20);
  assert.equal(result.settings.userName, 'Você');
});

test('restoring a current backup uses its optional values and fills missing investment targets', () => {
  const backup = parseFullFinanceBackup(JSON.stringify({
    ...validBackup(),
    settings: { theme: 'dark', userName: 'Pessoa teste' },
    investmentTargets: { fiis: 35 },
  }));
  assert.ok(backup);

  const defaults = {
    familyMembers: [] as FamilyMember[],
    investmentTargets: {
      renda_fixa_pos: 20,
      renda_fixa_ipca: 20,
      fiis: 20,
      acoes_br: 20,
      exterior_etf: 20,
    } as InvestmentTargetMap,
    settings: {
      theme: 'light',
      density: 'comfortable',
      privacyMode: false,
      showOverviewAlerts: true,
      alertsExpandedByDefault: true,
      budgetWarningPercent: 80,
      userName: 'Você',
      userPixKey: '',
    } as AppSettings,
  };
  const result = resolveFullBackupOptionalState(backup, defaults);

  assert.equal(result.settings.theme, 'dark');
  assert.equal(result.settings.userName, 'Pessoa teste');
  assert.equal(result.investmentTargets.fiis, 35);
  assert.equal(result.investmentTargets.renda_fixa_pos, 20);
});
