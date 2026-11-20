/** Tipos e props de AccountsTab. */
import { AccountBalanceSummary, AccountType, BankAccount, Category, CurrencyCode, Transaction, Trip } from '../../../types/finance';
import { isCurrencyInputValid } from '../../../utils/currencyInput';

export const FOREIGN_CURRENCY_OPTIONS: CurrencyCode[] = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CAD',
  'ARS',
  'CLP',
  'JPY',
];

export const isValidBalanceInput = (raw: string, currency: CurrencyCode): boolean => {
  return !raw.trim() || isCurrencyInputValid(raw, currency);
};

export const isValidBrlBalanceInput = (raw: string): boolean => {
  if (!raw.trim()) return true;
  const cleaned = raw.trim().replace(/[R$\s]/g, '');
  return /^[+-]?(?:\d+(?:[,.]\d{0,2})?|[,.]\d{1,2}|\d{1,3}(?:\.\d{3})+,\d{0,2}|\d{1,3}(?:,\d{3})+\.\d{0,2}|\d{1,3}(?:\.\d{3}){2,}|\d{1,3}(?:,\d{3}){2,})$/.test(cleaned);
};

export const INTL_ACCOUNT_PRESETS: {
  label: string;
  name: string;
  institution: string;
  currency: CurrencyCode;
  color: string;
}[] = [
  {
    label: 'Wise (EUR)',
    name: 'Wise Conta Global Euro',
    institution: 'Wise',
    currency: 'EUR',
    color: '#059669',
  },
  {
    label: 'Wise (USD)',
    name: 'Wise Conta Global Dólar',
    institution: 'Wise',
    currency: 'USD',
    color: '#059669',
  },
  {
    label: 'Nomad (USD)',
    name: 'Nomad Global Account',
    institution: 'Nomad',
    currency: 'USD',
    color: '#d97706',
  },
  {
    label: 'Avenue (USD)',
    name: 'Avenue Banking Dólar',
    institution: 'Avenue',
    currency: 'USD',
    color: '#2563eb',
  },
  {
    label: 'C6 Global (EUR)',
    name: 'C6 Conta Global Euro',
    institution: 'C6 Bank',
    currency: 'EUR',
    color: '#334155',
  },
  {
    label: 'Inter Global (USD)',
    name: 'Inter Global Account USD',
    institution: 'Banco Inter',
    currency: 'USD',
    color: '#d97706',
  },
];

export interface AccountsTabProps {
  selectedMonth: string;
  accounts: BankAccount[];
  accountBalances: AccountBalanceSummary[];
  categories: Category[];
  transactions: Transaction[];
  trips?: Trip[];
  initialSelectedAccountId?: string;
  /** Abre o cadastro de nova conta ao entrar na tela (pedido pelo formulário de lançamento). */
  autoOpenCreate?: boolean;
  autoOpenCreateType?: AccountType;
  onAutoOpenHandled?: () => void;
  onToggleAccountInTotal: (accountId: string) => void;
  onAddAccount: (account: Omit<BankAccount, 'id'>) => BankAccount | void;
  onUpdateAccount?: (account: BankAccount) => void;
  onDeleteAccount?: (accountId: string) => void;
  onUpdateAccountInitialBalance: (accountId: string, newInitial: number) => void;
  onUpdateTrip?: (trip: Trip) => void;
  onToggleTransactionStatus: (txId: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDuplicateTransaction?: (tx: Transaction) => void;
  onDeleteTransaction: (txId: string, deleteGroup?: boolean) => void;
  onOpenNewTransaction: (
    mode: 'expense' | 'income' | 'credit_card' | 'transfer',
    initialDate?: string
  ) => void;
  onOpenReconciliation?: (accountId?: string) => void;
}

export const ACCOUNT_COLORS = [
  { name: 'Esmeralda', hex: '#059669' },
  { name: 'Azul Itaú', hex: '#2563eb' },
  { name: 'Roxo Nubank', hex: '#7c3aed' },
  { name: 'Âmbar Inter', hex: '#d97706' },
  { name: 'Ardósia', hex: '#334155' },
  { name: 'Rosa', hex: '#e11d48' },
];

/** Aplica os valores padrão das props (mesmos de antes) e devolve tudo num objeto. */
export function resolveAccountsTabProps({
  selectedMonth,
  accounts,
  accountBalances,
  categories,
  transactions,
  trips = [],
  initialSelectedAccountId,
  autoOpenCreate,
  autoOpenCreateType = 'checking',
  onAutoOpenHandled,
  onToggleAccountInTotal,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onUpdateAccountInitialBalance,
  onUpdateTrip,
  onToggleTransactionStatus,
  onEditTransaction,
  onDuplicateTransaction,
  onDeleteTransaction,
  onOpenNewTransaction,
  onOpenReconciliation,
}: AccountsTabProps) {
  return {
    selectedMonth,
    accounts,
    accountBalances,
    categories,
    transactions,
    initialSelectedAccountId,
    autoOpenCreate,
    onAutoOpenHandled,
    onToggleAccountInTotal,
    onAddAccount,
    onUpdateAccount,
    onDeleteAccount,
    onUpdateAccountInitialBalance,
    onUpdateTrip,
    onToggleTransactionStatus,
    onEditTransaction,
    onDuplicateTransaction,
    onDeleteTransaction,
    onOpenNewTransaction,
    onOpenReconciliation,
    trips,
    autoOpenCreateType,
  };
}

export type AccountsTabPropsApi = ReturnType<typeof resolveAccountsTabProps>;
