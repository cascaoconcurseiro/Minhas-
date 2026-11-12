import type { Transaction } from '../types/finance';

/** Texto único de confirmação antes de excluir um lançamento (ou a série dele). */
export function getTransactionDeletionMessage(transaction: Pick<Transaction, 'description' | 'isInvoicePayment'>, deleteGroup = false): string {
  if (transaction.isInvoicePayment) return 'Excluir o pagamento da fatura e refazer o efeito cascata?';
  if (deleteGroup) return `Excluir este lançamento e todas as parcelas da série "${transaction.description}"?`;
  return `Excluir o lançamento "${transaction.description}"?`;
}

/** Pede confirmação ao usuário. Retorna false se o lançamento não existe ou se ele cancelar. */
export function confirmTransactionDeletion(
  transaction: Pick<Transaction, 'description' | 'isInvoicePayment'> | undefined,
  deleteGroup = false
): boolean {
  if (!transaction) return false;
  return window.confirm(getTransactionDeletionMessage(transaction, deleteGroup));
}
