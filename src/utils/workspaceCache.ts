import type {
  AppSettings,
  BankAccount,
  Category,
  CreditCard,
  FamilyMember,
  InvestmentAsset,
  SavingsGoal,
  Transaction,
  Trip,
} from '../types/finance';

/**
 * Cópia local só de leitura da última versão do workspace, usada para abrir o app na hora enquanto o
 * Neon responde. O Neon continua sendo a única fonte: ao chegar, ele substitui esta cópia, e nenhuma
 * gravação acontece antes de o Neon ser lido com sucesso.
 */
export interface CachedWorkspaceState {
  accounts: BankAccount[];
  cards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  goals: SavingsGoal[];
  familyMembers: FamilyMember[];
  investments: InvestmentAsset[];
  investmentTargets: Record<string, number> | null;
  trips: Trip[];
  settings: Partial<AppSettings>;
}

const REQUIRED_ARRAYS = ['accounts', 'cards', 'categories', 'transactions'] as const;
const OPTIONAL_ARRAYS = ['goals', 'familyMembers', 'investments', 'trips'] as const;

/** Lê e valida a cópia local; devolve null se estiver ausente, corrompida ou incompleta. */
export function parseCachedWorkspace(raw: string | null | undefined): CachedWorkspaceState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const snapshot = parsed as Record<string, unknown>;
    for (const key of REQUIRED_ARRAYS) {
      if (!Array.isArray(snapshot[key])) return null;
    }
    for (const key of OPTIONAL_ARRAYS) {
      if (snapshot[key] !== undefined && !Array.isArray(snapshot[key])) return null;
    }
    const settings = snapshot.settings;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
    const targets = snapshot.investmentTargets;
    return {
      accounts: snapshot.accounts as BankAccount[],
      cards: snapshot.cards as CreditCard[],
      categories: snapshot.categories as Category[],
      transactions: snapshot.transactions as Transaction[],
      goals: (snapshot.goals as SavingsGoal[] | undefined) ?? [],
      familyMembers: (snapshot.familyMembers as FamilyMember[] | undefined) ?? [],
      investments: (snapshot.investments as InvestmentAsset[] | undefined) ?? [],
      investmentTargets:
        targets && typeof targets === 'object' && !Array.isArray(targets)
          ? (targets as Record<string, number>)
          : null,
      trips: (snapshot.trips as Trip[] | undefined) ?? [],
      settings: settings as Partial<AppSettings>,
    };
  } catch {
    return null;
  }
}
