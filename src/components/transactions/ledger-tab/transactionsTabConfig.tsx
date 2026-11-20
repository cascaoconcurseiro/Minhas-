/** Tipos, auxiliares e props de TransactionsTab. */
import { BankAccount, Category, CreditCard, Transaction } from '../../../types/finance';

export interface TransactionsTabProps {
  selectedMonth: string;
  transactions: Transaction[];
  accounts: BankAccount[];
  cards: CreditCard[];
  categories: Category[];
  globalSearchQuery?: string;
  onChangeGlobalSearchQuery?: (q: string) => void;
  requestedViewMode?: 'calendar' | 'table' | null;
  onConsumeRequestedViewMode?: () => void;
  onToggleStatus: (txId: string) => void;
  onBatchSettleTransactions?: (txIds: string[]) => void | Promise<void>;
  onAnticipateInstallments?: (
    installmentGroupId: string,
    discountAmount: number,
    maxCountToAdvance?: number
  ) => void;
  onReverseAnticipation?: (targetIdOrGroupId: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDuplicateTransaction?: (tx: Transaction) => void;
  onDeleteTransaction: (txId: string, deleteGroup?: boolean) => void;
  onOpenNewTransaction: (
    mode: 'expense' | 'income' | 'credit_card' | 'transfer',
    initialDate?: string
  ) => void;
  onOpenReconciliation?: () => void;
}

export function limitDailyGroups<T extends { transactions: unknown[] }>(groups: T[], limit: number): T[] {
  const result: T[] = [];
  let used = 0;
  for (const group of groups) {
    if (used >= limit) break;
    const room = limit - used;
    result.push(group.transactions.length > room ? { ...group, transactions: group.transactions.slice(0, room) } : group);
    used += group.transactions.length;
  }
  return result;
}

/** Aplica os valores padrão das props (mesmos de antes) e devolve tudo num objeto. */
export function resolveTransactionsTabProps({
  selectedMonth,
  transactions,
  accounts,
  cards,
  categories,
  globalSearchQuery = '',
  onChangeGlobalSearchQuery,
  requestedViewMode,
  onConsumeRequestedViewMode,
  onToggleStatus,
  onBatchSettleTransactions,
  onAnticipateInstallments,
  onReverseAnticipation,
  onEditTransaction,
  onDuplicateTransaction,
  onDeleteTransaction,
  onOpenNewTransaction,
  onOpenReconciliation,
}: TransactionsTabProps) {
  return {
    selectedMonth,
    transactions,
    accounts,
    cards,
    categories,
    onChangeGlobalSearchQuery,
    requestedViewMode,
    onConsumeRequestedViewMode,
    onToggleStatus,
    onBatchSettleTransactions,
    onAnticipateInstallments,
    onReverseAnticipation,
    onEditTransaction,
    onDuplicateTransaction,
    onDeleteTransaction,
    onOpenNewTransaction,
    onOpenReconciliation,
    globalSearchQuery,
  };
}

export type TransactionsTabPropsApi = ReturnType<typeof resolveTransactionsTabProps>;
