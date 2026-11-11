import type {
  AppSettings,
  BankAccount,
  Category,
  CreditCard,
  FamilyMember,
  InvestmentAsset,
  InvestmentTargetMap,
  SavingsGoal,
  Transaction,
  Trip,
} from '../types/finance';
import { removeSmtpPasswordsFromSettings } from './secureSettings';
import { parseSharedSettlementReceipts } from './sharedFinanceRules';

export interface FullBackupDefaults {
  familyMembers: FamilyMember[];
  investmentTargets: InvestmentTargetMap;
  settings: AppSettings;
}

export interface FullFinanceBackup {
  version: number;
  ownerUserId?: string;
  exportedAt?: string;
  accounts: BankAccount[];
  cards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  goals: SavingsGoal[];
  investments: InvestmentAsset[];
  trips: Trip[];
  familyMembers?: FamilyMember[];
  investmentTargets?: InvestmentTargetMap;
  settings?: AppSettings;
  sharedSettlementReceiptsJson?: string;
}

export function getPortableBackupTransactions<T extends { id: string }>(
  transactions: T[]
): T[] {
  return transactions.filter((transaction) => !transaction.id.startsWith('tx-mirror-'));
}

const FAMILY_SHARE_FIELDS = [
  'isShared',
  'sharedMemberId',
  'sharedAmount',
  'sharedPaidBy',
  'sharedSplitMode',
  'sharedStatus',
  'sharedSettledDate',
  'sharedSettledAccountId',
  'sharedSettlementId',
  'sharedRemoteStatus',
  'sharedRemoteSettledDate',
  'sharedSyncId',
  'sharedOriginEmail',
  'sharedTargetEmail',
] as const;

export function prepareRestoredBackupTransactions<
  T extends { id: string; isShared?: boolean }
>(transactions: T[], sameOwner: boolean): T[] {
  const portableTransactions = getPortableBackupTransactions(transactions);
  if (sameOwner) return portableTransactions;

  return portableTransactions.map((transaction) => {
    if (!FAMILY_SHARE_FIELDS.some((field) => field in transaction)) return transaction;
    const personalTransaction = { ...transaction } as T & Record<string, unknown>;
    for (const field of FAMILY_SHARE_FIELDS) delete personalTransaction[field];
    return personalTransaction;
  });
}

export function getPortableBackupFamilyMembers<T extends { direction?: string; invitationId?: string }>(
  familyMembers: T[]
): T[] {
  return familyMembers.filter(
    (member) => member.direction !== 'incoming' && !member.invitationId
  );
}

export function mergeRestoredTransactionsWithCurrentMirrors<T extends { id: string }>(
  currentTransactions: T[],
  restoredTransactions: T[]
): T[] {
  return [
    ...getPortableBackupTransactions(restoredTransactions),
    ...currentTransactions.filter((transaction) => transaction.id.startsWith('tx-mirror-')),
  ];
}

export function mergeRestoredFamilyMembersWithCurrentIncoming<T extends { direction?: string; invitationId?: string }>(
  currentMembers: T[],
  restoredMembers: T[]
): T[] {
  return [
    ...getPortableBackupFamilyMembers(restoredMembers),
    ...currentMembers.filter(
      (member) => member.direction === 'incoming' || Boolean(member.invitationId)
    ),
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isValidBackupDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidBackupMonth(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  return true;
}

export function parseFullFinanceBackup(jsonText: string): FullFinanceBackup | null {
  try {
    const parsed: unknown = JSON.parse(jsonText);
    if (!isRecord(parsed)) return null;
    if (
      !Number.isInteger(parsed.version) ||
      (parsed.version as number) < 1 ||
      (parsed.version as number) > 6
    ) {
      return null;
    }
    if (
      ('ownerUserId' in parsed &&
        (typeof parsed.ownerUserId !== 'string' ||
          parsed.ownerUserId.trim().length === 0 ||
          parsed.ownerUserId.length > 512)) ||
      (parsed.version === 6 && typeof parsed.ownerUserId !== 'string')
    ) {
      return null;
    }

    const requiredCollections = [
      'accounts',
      'cards',
      'categories',
      'transactions',
      'goals',
      'investments',
      'trips',
    ] as const;
    if (
      !requiredCollections.every((key) => {
        const value = parsed[key];
        return Array.isArray(value) && value.every(isRecord);
      })
    ) {
      return null;
    }

    // Invalid calendar dates must not be silently rewritten to today's date by
    // the restore repair pass. Missing legacy fields remain repairable.
    const transactions = parsed.transactions as Record<string, unknown>[];
    if (
      !transactions.every(
        (transaction) =>
          (transaction.date === undefined || isValidBackupDate(transaction.date)) &&
          (transaction.competenceMonth === undefined ||
            isValidBackupMonth(transaction.competenceMonth))
      )
    ) {
      return null;
    }

    const categoryCollection = parsed.categories;
    if (
      !Array.isArray(categoryCollection) ||
      !categoryCollection.every(isRecord)
    ) {
      return null;
    }
    const categories = categoryCollection;
    if (
      categories.length === 0 ||
      !categories.every(
        (category) =>
          typeof category.id === 'string' &&
          category.id.length > 0 &&
          typeof category.name === 'string' &&
          category.name.length > 0 &&
          (category.type === 'income' || category.type === 'expense') &&
          ['essential', 'lifestyle', 'financial'].includes(String(category.bucket)) &&
          typeof category.monthlyBudget === 'number' &&
          Number.isFinite(category.monthlyBudget) &&
          category.monthlyBudget >= 0 &&
          typeof category.color === 'string' &&
          typeof category.icon === 'string' &&
          Array.isArray(category.subcategories) &&
          category.subcategories.every(
            (subcategory) =>
              isRecord(subcategory) &&
              typeof subcategory.id === 'string' &&
              typeof subcategory.name === 'string'
          )
      )
    ) {
      return null;
    }

    if (
      ('familyMembers' in parsed &&
        (!Array.isArray(parsed.familyMembers) ||
          !parsed.familyMembers.every(isRecord))) ||
      ('investmentTargets' in parsed && !isRecord(parsed.investmentTargets)) ||
      ('settings' in parsed && !isRecord(parsed.settings)) ||
      ('exportedAt' in parsed && typeof parsed.exportedAt !== 'string')
    ) {
      return null;
    }

    parseSharedSettlementReceipts(parsed.sharedSettlementReceiptsJson);
    const sanitized = { ...parsed };
    if (isRecord(sanitized.settings)) {
      sanitized.settings = removeSmtpPasswordsFromSettings(
        sanitized.settings as unknown as AppSettings
      );
    }
    return sanitized as unknown as FullFinanceBackup;
  } catch {
    return null;
  }
}

export function resolveFullBackupOptionalState(
  backup: FullFinanceBackup,
  defaults: FullBackupDefaults
): Required<Pick<FullFinanceBackup, 'familyMembers' | 'investmentTargets' | 'settings'>> {
  return {
    familyMembers: backup.familyMembers ?? [],
    investmentTargets: {
      ...defaults.investmentTargets,
      ...(backup.investmentTargets ?? {}),
    },
    settings: removeSmtpPasswordsFromSettings({
      ...defaults.settings,
      ...(backup.settings ?? {}),
    }),
  };
}
