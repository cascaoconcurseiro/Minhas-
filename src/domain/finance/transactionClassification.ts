import type {
  Transaction,
} from '../../types/finance';
import { isSharedCardInvoiceId, isSharedCardInvoiceSettlementId } from '../family/sharedCardInvoiceIds.ts';

/**
 * Lançamentos que não fazem parte do seu resultado pessoal (nem gasto, nem receita): gastos só de acompanhantes de
 * viagem, movimentos de valores a receber (empréstimos e seus pagamentos) e a fatura de cartão adicional cobrada de
 * outra pessoa em Compartilhado (a linha na fatura e o recebimento dela).
 */
export function isOutsidePersonalResult(tx: Transaction): boolean {
  return Boolean(tx.isCompanionOnlyExpense || tx.receivableId || isSharedOnlyExpense(tx) ||
    isSharedCardInvoiceId(tx.id) || isSharedCardInvoiceSettlementId(tx.id));
}

export function isSharedOnlyExpense(tx: Transaction): boolean {
  return tx.id.startsWith('tx-mirror-') ||
    (tx.type === 'expense' && tx.sharedPaidBy === 'member');
}

export function isCreditCardInvoicePurchase(tx: Transaction): boolean {
  // Só despesa entra na fatura: entrada (estorno) somada aqui aumentaria a dívida em vez de reduzir.
  return tx.type === 'expense' && !tx.isInvoicePayment && !tx.isCompanionOnlyExpense && tx.sharedPaidBy !== 'member';
}

/**
 * Mês em que o gasto foi consumido (visão de competência de consumo).
 * Compras no cartão contam no mês da compra (cada parcela, no mês da própria
 * parcela) e não no mês de vencimento da fatura. Parcelas antecipadas mantêm
 * o mês original. Lançamentos de banco seguem a competência salva.
 */
export function getConsumptionMonth(tx: Transaction): string {
  if (tx.creditCardId && !tx.isInvoicePayment) {
    const date = tx.originalDateBeforeAnticipation || tx.date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date.slice(0, 7);
  }
  return tx.competenceMonth;
}

/** Mês em que o dinheiro realmente se move na conta: pagamento de fatura usa a data do pagamento. */
export function getCashMovementMonth(tx: Transaction): string {
  return tx.isInvoicePayment && /^\d{4}-\d{2}-\d{2}$/.test(tx.date)
    ? tx.date.slice(0, 7)
    : tx.competenceMonth;
}
