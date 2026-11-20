/** Tipos e props da aba de cartões. */
import { BankAccount, Category, CreditCard, CreditCardSummary, Transaction } from '../../../types/finance';

export interface CreditCardsTabProps {
  selectedMonth: string;
  cards: CreditCard[];
  cardSummaries: CreditCardSummary[];
  accounts: BankAccount[];
  categories: Category[];
  transactions: Transaction[];
  initialSelectedCardId?: string;
  /** Abre o cadastro de novo cartão ao entrar na tela (pedido pelo formulário de lançamento). */
  autoOpenCreate?: boolean;
  onAutoOpenHandled?: () => void;
  /** Leva ao cadastro de conta quando falta uma conta em reais. */
  onRequestCreateAccount?: () => void;
  onPayInvoice: (cardId: string, accountId: string, customAmount?: number) => void;
  /** Leva o restante da fatura (depois de um pagamento parcial) para a próxima, com encargos opcionais. */
  onCarryOverInvoice?: (cardId: string, feeAmount?: number) => void;
  onUndoInvoiceCarryOver?: (cardId: string) => void;
  onAnticipateInstallments?: (
    installmentGroupId: string,
    discountAmount: number,
    maxCountToAdvance?: number
  ) => void;
  onReverseAnticipation?: (targetIdOrGroupId: string) => void;
  onAddCard: (card: Omit<CreditCard, 'id'>) => void;
  onUpdateCard?: (card: CreditCard) => void;
  onDeleteCard?: (cardId: string) => boolean | void;
  onDeleteTransaction: (txId: string, deleteGroup?: boolean) => void;
  onOpenNewCardExpense: () => void;
  /** Limite do cartão (% da renda do mês) e o aviso, definidos em Configurações > Regras. */
  commitmentLimitPercent?: number;
  commitmentWarnPercent?: number;
  onOpenCommitmentSettings?: () => void;
}

/** Aplica os valores padrão das props (mesmos de antes) e devolve tudo num objeto. */
export function resolveCreditCardsTabProps({
  selectedMonth,
  cards,
  cardSummaries,
  accounts,
  categories,
  transactions,
  initialSelectedCardId,
  autoOpenCreate,
  onAutoOpenHandled,
  onRequestCreateAccount,
  onPayInvoice,
  onCarryOverInvoice,
  onUndoInvoiceCarryOver,
  onAnticipateInstallments,
  onReverseAnticipation,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onDeleteTransaction,
  onOpenNewCardExpense,
  commitmentLimitPercent,
  commitmentWarnPercent,
  onOpenCommitmentSettings,
}: CreditCardsTabProps) {
  return {
    selectedMonth,
    cards,
    cardSummaries,
    accounts,
    categories,
    transactions,
    initialSelectedCardId,
    autoOpenCreate,
    onAutoOpenHandled,
    onRequestCreateAccount,
    onPayInvoice,
    onCarryOverInvoice,
    onUndoInvoiceCarryOver,
    onAnticipateInstallments,
    onReverseAnticipation,
    onAddCard,
    onUpdateCard,
    onDeleteCard,
    onDeleteTransaction,
    onOpenNewCardExpense,
    commitmentLimitPercent,
    commitmentWarnPercent,
    onOpenCommitmentSettings,
  };
}

export type CreditCardsTabPropsApi = ReturnType<typeof resolveCreditCardsTabProps>;
