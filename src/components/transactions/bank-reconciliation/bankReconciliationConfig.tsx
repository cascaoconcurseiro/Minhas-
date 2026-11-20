/** Tipos, auxiliares e props de BankReconciliationModal. */
import { BankAccount, Category, CreditCard, FamilyMember, Transaction } from '../../../types/finance';

export interface BankReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: BankAccount[];
  cards?: CreditCard[];
  categories: Category[];
  existingTransactions: Transaction[];
  /** Familiares, para aplicar a divisão que a pessoa costuma usar em cada estabelecimento. */
  familyMembers?: FamilyMember[];
  onCommitImport: (transactions: Transaction[], accountId: string) => void | number;
  onAddAccount?: (account: Omit<BankAccount, 'id'>) => BankAccount | void;
  defaultAccountId?: string;
}

/** Aplica os valores padrão das props (mesmos de antes) e devolve tudo num objeto. */
export function resolveBankReconciliationModalProps({
  isOpen,
  onClose,
  accounts,
  cards = [],
  categories,
  existingTransactions,
  familyMembers = [],
  onCommitImport,
  onAddAccount,
  defaultAccountId,
}: BankReconciliationModalProps) {
  return {
    isOpen,
    onClose,
    accounts,
    categories,
    existingTransactions,
    onCommitImport,
    onAddAccount,
    defaultAccountId,
    cards,
    familyMembers,
  };
}

export type BankReconciliationModalPropsApi = ReturnType<typeof resolveBankReconciliationModalProps>;
