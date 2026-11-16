import type {
  AppSettings,
  BankAccount,
  Category,
  CreditCard,
  FamilyMember,
  InvestmentAsset,
  InvestmentTargetMap,
  Receivable,
  SavingsGoal,
  Transaction,
  Trip,
} from '../../types/finance';
import { removeSmtpPasswordsFromSettings } from '../../utils/secureSettings';
import { parseSharedSettlementReceipts } from '../../domain/family/sharedFinanceRules';
import { getReceivableLinkIssues, parseWorkspaceArray, validateWorkspaceConsistency } from './workspacePayload';

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
  receivables?: Receivable[];
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
  'sharedDueDate',
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
    if (personalTransaction.sharedPaidBy === 'member') {
      Object.assign(personalTransaction, { isCompanionOnlyExpense: true });
    }
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

export function validateRestoredBackupCollections(state: Pick<FullFinanceBackup,
  'accounts' | 'cards' | 'transactions' | 'goals' | 'investments' | 'receivables'
>): boolean {
  const { accounts, cards, transactions, goals, investments, receivables = [] } = state;
  if (accounts.some((account) =>
    typeof account.name !== 'string' || !account.name.trim() ||
    !['checking', 'savings', 'cash', 'investment', 'international'].includes(account.type) ||
    typeof account.initialBalance !== 'number' || !Number.isFinite(account.initialBalance) ||
    typeof account.institution !== 'string' || typeof account.color !== 'string' ||
    typeof account.includeInTotal !== 'boolean' ||
    (account.initialBalanceForeign !== undefined &&
      (typeof account.initialBalanceForeign !== 'number' || !Number.isFinite(account.initialBalanceForeign))) ||
    (account.currency !== undefined && !['BRL', 'USD', 'EUR', 'GBP', 'ARS', 'CLP', 'JPY', 'CAD', 'CHF'].includes(account.currency))
  )) return false;
  if (cards.some((card) => typeof card.name !== 'string' || !card.name.trim() ||
    !['Mastercard', 'Visa', 'Elo'].includes(card.brand) ||
    typeof card.limit !== 'number' || !Number.isFinite(card.limit) || card.limit < 0 ||
    typeof card.defaultAccountId !== 'string' || typeof card.color !== 'string' ||
    ![card.closingDay, card.dueDay].every((day) => Number.isInteger(day) && day >= 1 && day <= 31)
  )) return false;
  if (goals.some((goal) => typeof goal.name !== 'string' || !goal.name.trim() ||
    ![goal.targetAmount, goal.currentAmount, goal.monthlyContribution].every((value) =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0) ||
    !isValidBackupDate(goal.deadline) ||
    !['CDI_100', 'CDI_110', 'TESOURO_SELIC', 'LCI_92', 'POUPANCA'].includes(goal.indexer) ||
    typeof goal.category !== 'string'
  )) return false;
  if (investments.some((asset) => typeof asset.ticker !== 'string' || typeof asset.name !== 'string' ||
    !asset.ticker.trim() || !asset.name.trim() ||
    !['renda_fixa_pos', 'renda_fixa_ipca', 'fiis', 'acoes_br', 'exterior_etf'].includes(asset.assetClass) ||
    ![asset.quantity, asset.averagePrice, asset.currentPrice, asset.monthlyYieldPercent].every((value) =>
      typeof value === 'number' && Number.isFinite(value)) ||
    typeof asset.institution !== 'string' || typeof asset.isTaxExempt !== 'boolean'
  )) return false;
  if (transactions.some((tx) => (tx.tags !== undefined &&
    (!Array.isArray(tx.tags) || !tx.tags.every((tag) => typeof tag === 'string'))) ||
    (tx.tripShares !== undefined && (!Array.isArray(tx.tripShares) ||
      tx.tripShares.some((share) => !isRecord(share) || typeof share.participantId !== 'string' ||
        !Number.isFinite(share.foreignShare) || !Number.isFinite(share.brlShare))))
  )) return false;

  parseWorkspaceArray(accounts, [], 'accountsJson');
  parseWorkspaceArray(cards, [], 'cardsJson');
  parseWorkspaceArray(goals, [], 'goalsJson');
  parseWorkspaceArray(investments, [], 'investmentsJson');
  parseWorkspaceArray(transactions, [], 'transactionsJson');
  return !validateWorkspaceConsistency({ accounts, cards, transactions }) &&
    getReceivableLinkIssues(receivables, transactions, accounts).size === 0;
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
        if (!Array.isArray(value) || !value.every((item) => isRecord(item) &&
          typeof item.id === 'string' && item.id.trim())) return false;
        return new Set(value.map((item) => item.id.trim())).size === value.length;
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
          // Backups antigos podem trazer subcategorias; são aceitas e ignoradas (a subcategoria não existe mais).
          (category.subcategories === undefined || Array.isArray(category.subcategories))
      )
    ) {
      return null;
    }

    if (
      ('familyMembers' in parsed &&
        (!Array.isArray(parsed.familyMembers) ||
          !parsed.familyMembers.every((member) => isRecord(member) &&
            typeof member.id === 'string' && typeof member.name === 'string'))) ||
      ('investmentTargets' in parsed && (!isRecord(parsed.investmentTargets) ||
        !Object.values(parsed.investmentTargets).every((target) =>
          typeof target === 'number' && Number.isFinite(target) && target >= 0 && target <= 100))) ||
      ('settings' in parsed && !isRecord(parsed.settings)) ||
      ('exportedAt' in parsed && typeof parsed.exportedAt !== 'string')
    ) {
      return null;
    }

    if (isRecord(parsed.settings)) {
      const { dismissedRecurringKeys, reminders, categorySharingRules } = parsed.settings;
      if ((dismissedRecurringKeys !== undefined &&
        (!Array.isArray(dismissedRecurringKeys) || !dismissedRecurringKeys.every((key) => typeof key === 'string'))) ||
        (reminders !== undefined && (!isRecord(reminders) ||
          (reminders.smtpConfig !== undefined && !isRecord(reminders.smtpConfig)))) ||
        (categorySharingRules !== undefined && (!isRecord(categorySharingRules) ||
          !Object.values(categorySharingRules).every(isRecord)))) return null;
    }

    const trips = parseWorkspaceArray<Trip>(parsed.trips, [], 'tripsJson');
    for (const trip of trips) {
      if (typeof trip.name !== 'string' || typeof trip.destination !== 'string' ||
        !Array.isArray(trip.participants)) return null;
      const participants = parseWorkspaceArray<Trip['participants'][number]>(
        trip.participants, [], 'tripParticipants'
      );
      if (participants.some((participant) => typeof participant.name !== 'string')) return null;
    }

    parseSharedSettlementReceipts(parsed.sharedSettlementReceiptsJson);
    if ('receivables' in parsed && !Array.isArray(parsed.receivables)) return null;
    const receivables = parseWorkspaceArray<Receivable>(parsed.receivables, [], 'receivablesJson');
    if (parsed.version === 6) {
      parseWorkspaceArray(parsed.familyMembers, [], 'familyMembersJson');
      if (!validateRestoredBackupCollections({
        accounts: parsed.accounts as BankAccount[],
        cards: parsed.cards as CreditCard[],
        transactions: getPortableBackupTransactions(parsed.transactions as Transaction[]),
        goals: parsed.goals as SavingsGoal[],
        investments: parsed.investments as InvestmentAsset[],
        receivables,
      })) return null;
    }
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
): Required<Pick<FullFinanceBackup, 'familyMembers' | 'investmentTargets' | 'settings' | 'receivables'>> {
  return {
    familyMembers: backup.familyMembers ?? [],
    receivables: Array.isArray(backup.receivables) ? backup.receivables : [],
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
