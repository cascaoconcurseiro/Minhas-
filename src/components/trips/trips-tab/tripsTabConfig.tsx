/** Constantes, tipos e props da aba de viagens. */
import { BankAccount, Category, CurrencyCode, FamilyMember, Transaction, Trip, TripExchangeLot, TripSettlement } from '../../../types/finance';

export interface TripsTabProps {
  getAuthToken: () => Promise<string>;
  trips: Trip[];
  transactions: Transaction[];
  categories: Category[];
  accounts: BankAccount[];
  /** Leva ao cadastro de conta quando falta uma conta (em reais ou internacional). */
  onRequestCreateAccount?: (kind: 'account' | 'international_account') => void;
  familyMembers?: FamilyMember[];
  privacyMode?: boolean;
  onAddTrip: (trip: Trip) => void;
  onUpdateTrip: (trip: Trip) => void;
  onDeleteTrip: (tripId: string) => void;
  onAddExchangeLot: (
    tripId: string,
    lot: TripExchangeLot,
    debitFromAccountId?: string
  ) => void;
  onDeleteExchangeLot: (tripId: string, lotId: string) => void;
  onRecordSettlement: (
    tripId: string,
    settlement: TripSettlement,
    bankAccountEffect?: {
      accountId: string;
      type: 'income' | 'expense';
      brlAmount: number;
      description: string;
    }
  ) => void;
  onOpenNewTripExpense: (tripId: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (txId: string) => void;
  onAddAccount?: (account: Omit<BankAccount, 'id'>) => BankAccount | void;
}

export const CURRENCY_OPTIONS: CurrencyCode[] = [
  'EUR',
  'USD',
  'GBP',
  'CAD',
  'CHF',
  'ARS',
  'CLP',
  'JPY',
  'BRL',
];

export const PARTICIPANT_COLORS = [
  '#059669',
  '#ec4899',
  '#3b82f6',
  '#8b5cf6',
  '#d97706',
  '#0284c7',
  '#e11d48',
];

/** Aplica os valores padrão das props (mesmos de antes) e devolve tudo num objeto. */
export function resolveTripsTabProps({
  getAuthToken,
  trips,
  transactions,
  categories,
  accounts,
  onRequestCreateAccount,
  familyMembers = [],
  privacyMode = false,
  onAddTrip,
  onUpdateTrip,
  onDeleteTrip,
  onAddExchangeLot,
  onDeleteExchangeLot,
  onRecordSettlement,
  onOpenNewTripExpense,
  onEditTransaction,
  onDeleteTransaction,
  onAddAccount,
}: TripsTabProps) {
  return {
    getAuthToken,
    trips,
    transactions,
    categories,
    accounts,
    onRequestCreateAccount,
    onAddTrip,
    onUpdateTrip,
    onDeleteTrip,
    onAddExchangeLot,
    onDeleteExchangeLot,
    onRecordSettlement,
    onOpenNewTripExpense,
    onEditTransaction,
    onDeleteTransaction,
    onAddAccount,
    familyMembers,
    privacyMode,
  };
}

export type TripsTabPropsApi = ReturnType<typeof resolveTripsTabProps>;
