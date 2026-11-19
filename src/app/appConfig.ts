/** Constantes, tipos e funções puras do App (sem estado). */
import { AppSettings, BankAccount, Category, CreditCard, FamilyMember, InvestmentAsset, InvestmentTargetMap, Receivable, SavingsGoal, Transaction, Trip } from '../types/finance';
import { stripLegacyMockRecords } from '../domain/trips/travelRules';
import { parseWorkspaceArray } from '../services/workspace/workspacePayload';
import { DEFAULT_REMINDER_SETTINGS } from '../domain/reminders/reminderRules';

export type ActiveTab =
  | 'overview'
  | 'accounts'
  | 'investments'
  | 'transactions'
  | 'cards'
  | 'shared'
  | 'receivables'
  | 'trips'
  | 'budgets'
  | 'goals'
  | 'reports'
  | 'cloud';

export interface UndoHistoryEntry {
  label: string;
  timestamp: number;
  accounts: BankAccount[];
  cards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  goals: SavingsGoal[];
  receivables?: Receivable[];
  familyMembers: FamilyMember[];
  investments: InvestmentAsset[];
  investmentTargets: InvestmentTargetMap;
  trips: Trip[];
}

export const STORAGE_KEY = 'minhas_economias_br_state_v6';

export function stripLegacyMockItems<T extends { id: string }>(items: T[]): T[] {
  return stripLegacyMockRecords(items);
}

export function stripLegacyMockItemsFromWorkspace(
  workspace: Record<string, unknown>
): { payload: Record<string, unknown>; removedCount: number } {
  const payload = { ...workspace };
  let removedCount = 0;
  const fields = [
    'accountsJson',
    'cardsJson',
    'transactionsJson',
    'goalsJson',
    'familyMembersJson',
    'investmentsJson',
    'tripsJson',
  ];

  for (const field of fields) {
    const raw = payload[field];
    if (raw === undefined || raw === null) continue;
    const items = parseWorkspaceArray<Record<string, unknown>>(raw, [], field);

    const cleanItems = stripLegacyMockItems(items as Array<{ id: string }>);
    if (cleanItems.length === items.length) continue;

    removedCount += items.length - cleanItems.length;
    payload[field] = typeof raw === 'string' ? JSON.stringify(cleanItems) : cleanItems;
  }

  return { payload, removedCount };
}

export function settingsUserNameFallback(email: string | null): string | null {
  if (!email) return null;
  const localPart = email.split('@')[0] || '';
  const firstToken = localPart.split(/[._-]/)[0] || localPart;
  if (!firstToken) return null;
  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1).toLowerCase();
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  density: 'comfortable',
  privacyMode: false,
  showOverviewAlerts: true,
  alertsExpandedByDefault: true,
  budgetWarningPercent: 80,
  userName: 'Você',
  userPixKey: '',
  defaultCascadeMode: 'this_and_future',
  autoConvertTripExpenses: true,
  viewClarityMode: 'complete',
  reminders: DEFAULT_REMINDER_SETTINGS,
};

export const MOBILE_TAB_TITLES: Record<string, string> = {
  overview: 'Visão Geral',
  accounts: 'Contas',
  investments: 'Investimentos',
  transactions: 'Extrato',
  cards: 'Cartões',
  shared: 'Compartilhado',
  receivables: 'A receber',
  trips: 'Viagens',
  budgets: 'Orçamentos',
  goals: 'Metas',
  reports: 'Relatórios',
  cloud: 'Conta e Nuvem',
};
