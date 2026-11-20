/** Tipos, auxiliares e props de OverviewTab. */
import { type CurrentPosition } from '../../../domain/finance/financeRules';
import { AccountBalanceSummary, BankAccount, Category, CategorySpendItem, CreditCard, CreditCardSummary, InvestmentAsset, MonthlyFinancialSummary, Transaction } from '../../../types/finance';
import { type RecurringCandidate } from '../../../domain/budgets/recurrenceDetection';
import { type CashForecast } from '../../../domain/budgets/cashForecast';

export interface OverviewTabProps {
  selectedMonth: string;
  /** Posição de hoje (saldos e dívida de cartão), independente do mês navegado. */
  currentPosition?: CurrentPosition;
  monthlySummary: MonthlyFinancialSummary;
  accounts: BankAccount[];
  accountBalances: AccountBalanceSummary[];
  cards: CreditCard[];
  cardSummaries: CreditCardSummary[];
  categories: Category[];
  categoryBreakdown: CategorySpendItem[];
  transactions: Transaction[];
  investments?: InvestmentAsset[];
  showOverviewAlerts?: boolean;
  alertsExpandedByDefault?: boolean;
  viewClarityMode?: 'complete' | 'essential';
  onChangeClarityMode?: (mode: 'complete' | 'essential') => void;
  /** Gastos que se repetem detectados no histórico, com as ações de prever e ignorar. */
  recurringSuggestions?: RecurringCandidate[];
  /** Previsão do saldo dos próximos dias (null sem conta incluída no total). */
  cashForecast?: CashForecast | null;
  /** Total que outras pessoas devem (faturas de cartão adicional e empréstimos). */
  receivablesSummary?: { totalOpen: number; byPerson: Array<{ personName: string; balance: number }> } | null;
  onScheduleRecurring?: (candidate: RecurringCandidate) => void;
  onDismissRecurring?: (candidate: RecurringCandidate) => void;
  onToggleStatus: (txId: string) => void;
  onToggleAccountInTotal: (accountId: string) => void;
  onOpenNewTransaction: (mode: 'expense' | 'income' | 'credit_card' | 'transfer') => void;
  userName?: string;
  onNavigateToAccount?: (accountId: string) => void;
  onNavigateToCard?: (cardId: string) => void;
  onNavigateTab: (
    tab:
      | 'overview'
      | 'accounts'
      | 'investments'
      | 'transactions'
      | 'cards'
      | 'budgets'
      | 'goals'
      | 'trips'
      | 'reports'
      | 'cloud'
  ) => void;
}

/** Aplica os valores padrão das props (mesmos de antes) e devolve tudo num objeto. */
export function resolveOverviewTabProps({
  selectedMonth,
  currentPosition,
  monthlySummary,
  accounts,
  accountBalances,
  cards,
  cardSummaries,
  categories,
  categoryBreakdown,
  transactions,
  investments = [],
  showOverviewAlerts = true,
  alertsExpandedByDefault = true,
  viewClarityMode = 'complete',
  onChangeClarityMode,
  recurringSuggestions = [],
  cashForecast = null,
  receivablesSummary = null,
  onScheduleRecurring,
  onDismissRecurring,
  onToggleStatus,
  onToggleAccountInTotal,
  onOpenNewTransaction,
  userName,
  onNavigateToAccount,
  onNavigateToCard,
  onNavigateTab,
}: OverviewTabProps) {
  return {
    selectedMonth,
    currentPosition,
    monthlySummary,
    accounts,
    accountBalances,
    cards,
    cardSummaries,
    categories,
    categoryBreakdown,
    transactions,
    onChangeClarityMode,
    onScheduleRecurring,
    onDismissRecurring,
    onToggleStatus,
    onToggleAccountInTotal,
    onOpenNewTransaction,
    userName,
    onNavigateToAccount,
    onNavigateToCard,
    onNavigateTab,
    investments,
    showOverviewAlerts,
    alertsExpandedByDefault,
    viewClarityMode,
    recurringSuggestions,
    cashForecast,
    receivablesSummary,
  };
}

export type OverviewTabPropsApi = ReturnType<typeof resolveOverviewTabProps>;
