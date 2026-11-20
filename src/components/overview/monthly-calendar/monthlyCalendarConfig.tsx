/** Constantes, tipos e props do calendário mensal. */
import { BankAccount, Category, CreditCard, Transaction } from '../../../types/finance';

export type CalendarFilterType =
  | 'all'
  | 'pending'
  | 'cards'
  | 'recurring'
  | 'paid';

export interface MonthlyCalendarViewProps {
  selectedMonth: string; // 'YYYY-MM'
  transactions: Transaction[];
  accounts: BankAccount[];
  cards: CreditCard[];
  categories: Category[];
  onToggleStatus: (txId: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (txId: string, deleteGroup?: boolean) => void;
  onOpenNewTransaction: (
    mode: 'expense' | 'income' | 'credit_card' | 'transfer',
    initialDate?: string
  ) => void;
}

export interface CardInvoiceDueItem {
  id: string;
  cardId: string;
  cardName: string;
  cardBrand: CreditCard['brand'];
  amount: number;
  isPaid: boolean;
  closingDay: number;
  dueDay: number;
  dueDate: string;
}

export const WEEKDAY_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const WEEKDAY_NAMES_FULL = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

/** Aplica os valores padrão das props (mesmos de antes) e devolve tudo num objeto. */
export function resolveMonthlyCalendarProps({
  selectedMonth,
  transactions,
  accounts,
  cards,
  categories,
  onToggleStatus,
  onEditTransaction,
  onDeleteTransaction,
  onOpenNewTransaction,
}: MonthlyCalendarViewProps) {
  return {
    selectedMonth,
    transactions,
    accounts,
    cards,
    categories,
    onToggleStatus,
    onEditTransaction,
    onDeleteTransaction,
    onOpenNewTransaction,
  };
}

export type MonthlyCalendarPropsApi = ReturnType<typeof resolveMonthlyCalendarProps>;
