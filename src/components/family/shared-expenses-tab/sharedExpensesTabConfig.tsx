/** Tipos e props de SharedExpensesTab. */
import { BankAccount, Category, CreditCard as CreditCardType, FamilyMember, Transaction } from '../../../types/finance';

export interface SharedExpensesTabProps {
  selectedMonth: string;
  transactions: Transaction[];
  familyMembers: FamilyMember[];
  accounts: BankAccount[];
  /** Leva ao cadastro de conta quando falta uma conta em reais. */
  onRequestCreateAccount?: () => void;
  cards: CreditCardType[];
  categories: Category[];
  onAddFamilyMember: (member: Omit<FamilyMember, 'id'>) => void | boolean | Promise<void | boolean>;
  onUpdateFamilyMember: (member: FamilyMember) => void | boolean | Promise<void | boolean>;
  onDeleteFamilyMember: (memberId: string) => void;
  onSettleSharedTransaction: (
    txId: string,
    receivingAccountId: string,
    settledDate: string
  ) => void;
  onSettleAllMemberInvoices: (
    memberId: string,
    month: string,
    receivingAccountId: string,
    settledDate: string
  ) => void;
  onReopenSharedTransaction: (txId: string) => void;
  onOpenNewSharedTransaction: (memberId?: string) => void;
  onAcceptFamilyInvite?: (member: FamilyMember, code: string) => void;
  onDeclineFamilyInvite?: (member: FamilyMember) => void;
  onResendFamilyInvite?: (member: FamilyMember) => void | boolean | Promise<void | boolean>;
  /** E-mail (minúsculo) → a pessoa convidada já tem conta? Só para convites pendentes que eu enviei. */
  inviteeHasAccount?: Record<string, boolean>;
  /** E-mail (minúsculo) → código do convite que eu enviei, para a pessoa digitar ao aceitar. */
  inviteCodes?: Record<string, string>;
  userPixKey?: string;
}

export const MEMBER_COLORS = [
  '#ec4899', // pink
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#6366f1', // indigo
];

/** Aplica os valores padrão das props (mesmos de antes) e devolve tudo num objeto. */
export function resolveSharedExpensesTabProps({
  selectedMonth,
  transactions,
  familyMembers,
  accounts,
  onRequestCreateAccount,
  cards,
  categories,
  onAddFamilyMember,
  onUpdateFamilyMember,
  onDeleteFamilyMember,
  onSettleSharedTransaction,
  onSettleAllMemberInvoices,
  onReopenSharedTransaction,
  onOpenNewSharedTransaction,
  onAcceptFamilyInvite,
  onDeclineFamilyInvite,
  onResendFamilyInvite,
  inviteeHasAccount,
  inviteCodes,
  userPixKey,
}: SharedExpensesTabProps) {
  return {
    selectedMonth,
    transactions,
    familyMembers,
    accounts,
    onRequestCreateAccount,
    cards,
    categories,
    onAddFamilyMember,
    onUpdateFamilyMember,
    onDeleteFamilyMember,
    onSettleSharedTransaction,
    onSettleAllMemberInvoices,
    onReopenSharedTransaction,
    onOpenNewSharedTransaction,
    onAcceptFamilyInvite,
    onDeclineFamilyInvite,
    onResendFamilyInvite,
    inviteeHasAccount,
    inviteCodes,
    userPixKey,
  };
}

export type SharedExpensesTabPropsApi = ReturnType<typeof resolveSharedExpensesTabProps>;
