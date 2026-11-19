/** Constantes, tipos e props do formulário de lançamento. */
import { BankAccount, Category, CategorySharingRule, CreditCard, CurrencyCode, FamilyMember, InvestmentAsset, Transaction, Trip } from '../../../types/finance';
import React from 'react';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import { CascadeScope, CreateTransactionBatchInput } from '../../../domain/finance/financeRules';

export type DomesticSharedSplitMode = 'half' | 'percentage' | 'custom';

export function AccountSelectShell({ account, children }: { account: BankAccount | null; children: React.ReactNode }) {
  return (
    <div className="relative">
      {account && (
        <span className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2" aria-hidden="true">
          <InstitutionMark institution={account.institution} accountName={account.name} color={account.color} size="xs" />
        </span>
      )}
      {children}
    </div>
  );
}

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveBatch: (
    input: CreateTransactionBatchInput,
    editingId?: string,
    cascadeScope?: CascadeScope
  ) => void;
  accounts: BankAccount[];
  cards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  familyMembers: FamilyMember[];
  onAddFamilyMember?: (newMember: Omit<FamilyMember, 'id'>) => FamilyMember | void;
  investments?: InvestmentAsset[];
  trips?: Trip[];
  selectedMonth: string;
  editingTransaction: Transaction | null;
  defaultMode?: 'expense' | 'income' | 'credit_card' | 'transfer';
  initialDate?: string;
  initialTripId?: string;
  /** Leva a pessoa a cadastrar o que falta (conta ou cartão); o App fecha este formulário e abre o cadastro. */
  onRequestCreate?: (kind: 'account' | 'card' | 'international_account') => void;
  /** Percentual do teto da categoria em que o aviso de orçamento começa (Configurações). */
  budgetWarningPercent?: number;
  /** Divisão automática por categoria (Configurações). */
  categorySharingRules?: Record<string, CategorySharingRule>;
  /** Falso enquanto os dados ainda estão chegando da nuvem: o formulário abre, mas só salva quando estiver pronto. */
  workspaceReady?: boolean;
}

export const CURRENCY_OPTIONS: CurrencyCode[] = [
  'BRL',
  'EUR',
  'USD',
  'GBP',
  'CAD',
  'CHF',
  'ARS',
  'CLP',
  'JPY',
];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'Pix',
  credit_card: 'Cartão de crédito',
  debit_card: 'Débito',
  boleto: 'Boleto',
  cash: 'Dinheiro',
  transfer: 'Transferência',
};

/** Aplica os valores padrão das props (mesmos de antes) e devolve tudo num objeto. */
export function resolveTransactionModalProps({
  isOpen,
  onClose,
  onSaveBatch,
  accounts,
  cards,
  categories,
  transactions,
  familyMembers,
  onAddFamilyMember,
  investments = [],
  trips = [],
  selectedMonth,
  editingTransaction,
  defaultMode = 'expense',
  initialDate,
  initialTripId,
  onRequestCreate,
  budgetWarningPercent = 80,
  categorySharingRules,
  workspaceReady = true,
}: TransactionModalProps) {
  return {
    isOpen,
    onClose,
    onSaveBatch,
    accounts,
    cards,
    categories,
    transactions,
    familyMembers,
    onAddFamilyMember,
    selectedMonth,
    editingTransaction,
    initialDate,
    initialTripId,
    onRequestCreate,
    categorySharingRules,
    investments,
    trips,
    defaultMode,
    budgetWarningPercent,
    workspaceReady,
  };
}

export type TransactionModalPropsApi = ReturnType<typeof resolveTransactionModalProps>;
