/** Tipos, auxiliares e props de AuthAndCloudTab. */
import { AppSettings, BankAccount, Category, CreditCard, InvestmentAsset, SavingsGoal, Transaction, Trip } from '../../../types/finance';

export interface AuthAndCloudTabProps {
  userEmail: string | null;
  userDisplayName: string | null;
  isAnonymousUser: boolean;
  autoVaultId: string;
  cloudSyncStatus: 'local' | 'syncing' | 'synced' | 'error';
  lastSyncedAt: string | null;
  settings: AppSettings;
  accounts: BankAccount[];
  cards: CreditCard[];
  categories?: Category[];
  transactions: Transaction[];
  investments: InvestmentAsset[];
  goals: SavingsGoal[];
  trips: Trip[];
  onSignInEmail: (email: string, pass: string) => Promise<void>;
  onRegisterEmail: (name: string, email: string, pass: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onForceCloudSync: () => Promise<void>;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onRunDiagnosticAndRepair?: () => { repairedCount: number; repairedLog: string[] };
}

/** Aplica os valores padrão das props (mesmos de antes) e devolve tudo num objeto. */
export function resolveAuthAndCloudTabProps({
  userEmail,
  userDisplayName,
  isAnonymousUser,
  autoVaultId,
  cloudSyncStatus,
  lastSyncedAt,
  settings,
  accounts,
  cards,
  categories = [],
  transactions,
  investments,
  goals,
  trips,
  onSignInEmail,
  onRegisterEmail,
  onSignOut,
  onForceCloudSync,
  onUpdateSettings,
  onRunDiagnosticAndRepair,
}: AuthAndCloudTabProps) {
  return {
    userEmail,
    userDisplayName,
    isAnonymousUser,
    autoVaultId,
    cloudSyncStatus,
    lastSyncedAt,
    settings,
    accounts,
    cards,
    transactions,
    investments,
    goals,
    trips,
    onSignInEmail,
    onRegisterEmail,
    onSignOut,
    onForceCloudSync,
    onUpdateSettings,
    onRunDiagnosticAndRepair,
    categories,
  };
}

export type AuthAndCloudTabPropsApi = ReturnType<typeof resolveAuthAndCloudTabProps>;
