import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPortableBackupFamilyMembers,
  getPortableBackupTransactions,
  mergeRestoredFamilyMembersWithCurrentIncoming,
  mergeRestoredTransactionsWithCurrentMirrors,
  parseFullFinanceBackup,
  prepareRestoredBackupTransactions,
  resolveFullBackupOptionalState,
} from './fullBackup';
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

test('accepts version 6 only when it is bound to the authenticated user UID', () => {
  const backup = { ...validBackup(), version: 6, ownerUserId: 'neon-user-1' };
  assert.equal(parseFullFinanceBackup(JSON.stringify(backup))?.ownerUserId, 'neon-user-1');
  assert.equal(
    parseFullFinanceBackup(JSON.stringify({ ...backup, ownerUserId: undefined })),
    null
  );
});

test('portable workspace backup excludes incoming shared mirrors and incoming family links', () => {
  const transactions = getPortableBackupTransactions([
    { id: 'tx-personal-1', amount: 10 },
    { id: 'tx-mirror-shared-1', amount: 20 },
  ]);
  const familyMembers = getPortableBackupFamilyMembers([
    { id: 'local-member', direction: 'outgoing' },
    { id: 'incoming-member', direction: 'incoming' },
    { id: 'linked-member', direction: 'outgoing', invitationId: 'invite-1' },
    { id: 'local-contact' },
  ]);

  assert.deepEqual(transactions.map(({ id }) => id), ['tx-personal-1']);
  assert.deepEqual(familyMembers.map(({ id }) => id), ['local-member', 'local-contact']);
});

test('restoring a personal backup preserves current Neon shared mirrors and incoming links', () => {
  const transactions = mergeRestoredTransactionsWithCurrentMirrors(
    [
      { id: 'tx-current-personal', amount: 30 },
      { id: 'tx-mirror-live', amount: 40 },
    ],
    [
      { id: 'tx-backup-personal', amount: 10 },
      { id: 'tx-mirror-old-backup', amount: 20 },
    ]
  );
  const familyMembers = mergeRestoredFamilyMembersWithCurrentIncoming(
    [
      { id: 'outgoing-old', direction: 'outgoing' },
      { id: 'incoming-live', direction: 'incoming' },
      { id: 'linked-live', direction: 'outgoing', invitationId: 'invite-live' },
    ],
    [
      { id: 'outgoing-backup', direction: 'outgoing' },
      { id: 'linked-backup-stale', direction: 'outgoing', invitationId: 'invite-old' },
    ]
  );

  assert.deepEqual(transactions.map(({ id }) => id), ['tx-backup-personal', 'tx-mirror-live']);
  assert.deepEqual(familyMembers.map(({ id }) => id), ['outgoing-backup', 'incoming-live', 'linked-live']);
});

test('import sanitization does not restore incoming shared mirrors as personal transactions', () => {
  const backup = validBackup();
  const parsed = parseFullFinanceBackup(JSON.stringify({
    ...backup,
    transactions: [
      { id: 'tx-personal-1', description: 'Pessoal' },
      { id: 'tx-mirror-shared-1', description: 'Recebida de outra conta' },
    ],
  }));
  assert.ok(parsed);
  assert.deepEqual(getPortableBackupTransactions(parsed.transactions).map(({ id }) => id), ['tx-personal-1']);
});

test('restoring a portable backup in another account strips family-share linkage metadata', () => {
  const result = prepareRestoredBackupTransactions([
    {
      id: 'tx-shared',
      isShared: true,
      sharedMemberId: 'old-member',
      sharedAmount: 8,
      amount: 10,
    },
    { id: 'tx-stale-shared-field', isShared: false, sharedMemberId: 'old-member', amount: 15 },
    { id: 'tx-personal', amount: 20 },
    { id: 'tx-mirror-incoming', amount: 30 },
  ], false);

  assert.deepEqual(result, [
    { id: 'tx-shared', amount: 10 },
    { id: 'tx-stale-shared-field', amount: 15 },
    { id: 'tx-personal', amount: 20 },
  ]);

  const sameAccount = prepareRestoredBackupTransactions([
    { id: 'tx-shared', isShared: true, sharedMemberId: 'member-1' },
  ], true);
  assert.deepEqual(sameAccount, [
    { id: 'tx-shared', isShared: true, sharedMemberId: 'member-1' },
  ]);
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

test('backup import strips SMTP passwords from both legacy and nested settings shapes', () => {
  const backupSecret = 'synthetic-backup-smtp-secret';
  const backup = parseFullFinanceBackup(JSON.stringify({
    ...validBackup(),
    settings: {
      theme: 'dark',
      reminders: {
        smtpPass: backupSecret,
        smtpConfig: {
          host: 'smtp.example.test',
          port: 587,
          user: 'user@example.test',
          pass: backupSecret,
        },
      },
    },
  }));
  assert.ok(backup);
  assert.equal(backup.settings?.reminders?.smtpPass, undefined);
  assert.equal(backup.settings?.reminders?.smtpConfig?.pass, undefined);
  assert.doesNotMatch(JSON.stringify(backup), /synthetic-backup-smtp-secret/);

  const restored = resolveFullBackupOptionalState(backup, {
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
  assert.equal(restored.settings.reminders?.smtpPass, undefined);
  assert.equal(restored.settings.reminders?.smtpConfig?.pass, undefined);
});
