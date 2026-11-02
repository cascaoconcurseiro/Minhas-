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

export interface FullFinanceBackup {
  version: number;
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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function parseFullFinanceBackup(jsonText: string): FullFinanceBackup | null {
  try {
    const parsed: unknown = JSON.parse(jsonText);
    if (!isRecord(parsed)) return null;
    if (
      !Number.isInteger(parsed.version) ||
      (parsed.version as number) < 1 ||
      (parsed.version as number) > 5
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

    return parsed as unknown as FullFinanceBackup;
  } catch {
    return null;
  }
}
