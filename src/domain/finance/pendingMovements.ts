import { getNextBankBusinessDay } from './businessDays.ts';
import type {
  CreditCard,
  Transaction,
} from '../../types/finance';
import {
  getLocalDateISO,
  getClampedMonthDate,
  isValidISODate,
} from './formatting.ts';
import {
  calculateCreditCardSummary,
} from './creditCardInvoices.ts';
import {
  isCreditCardInvoicePurchase,
} from './transactionClassification.ts';

/**
 * Regra única de "conta pendente na conta bancária": lançamento ainda não pago, que mexe no caixa
 * (não é transferência, não é compra de cartão, não é gasto só do acompanhante nem pago por familiar).
 * A Visão Geral e as notificações usam esta mesma definição.
 */
export function isPendingBankObligation(tx: Transaction | null | undefined): tx is Transaction {
  return Boolean(
    tx &&
      tx.status === 'pending' &&
      tx.type !== 'transfer' &&
      !tx.creditCardId &&
      !tx.isCompanionOnlyExpense &&
      tx.sharedPaidBy !== 'member' &&
      isValidISODate(tx.date)
  );
}

/** Returns unpaid bank income/expense movements for the selected month, including overdue items in the current month. */
export function getPendingBankMovements(
  transactions: Transaction[] | null | undefined,
  selectedMonth: string,
  todayDate: string = getLocalDateISO()
): Transaction[] {
  if (
    !Array.isArray(transactions) ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth) ||
    !isValidISODate(todayDate)
  ) {
    return [];
  }
  const currentMonth = todayDate.slice(0, 7);
  return transactions
    .filter((tx) => {
      if (!isPendingBankObligation(tx)) return false;

      const competenceMonth = tx.competenceMonth || tx.date.slice(0, 7);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competenceMonth)) return false;
      if (competenceMonth === selectedMonth) return true;
      return selectedMonth === currentMonth &&
        competenceMonth < selectedMonth &&
        tx.date <= todayDate;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface PendingCardInvoice {
  cardId: string;
  cardName: string;
  invoiceMonth: string; // YYYY-MM (mês de vencimento)
  dueDate: string; // YYYY-MM-DD
  amount: number; // valor ainda em aberto
  isOverdue: boolean;
  defaultAccountId?: string;
}

/**
 * Faturas de cartão ainda em aberto para a lista de contas a pagar do mês.
 * Uma linha por cartão e mês de vencimento, com o valor pendente. No mês atual,
 * faturas de meses anteriores sem pagamento aparecem como atrasadas.
 */
export function getPendingCardInvoices(
  cards: CreditCard[] | null | undefined,
  transactions: Transaction[] | null | undefined,
  selectedMonth: string,
  todayDate: string = getLocalDateISO()
): PendingCardInvoice[] {
  if (
    !Array.isArray(cards) ||
    !Array.isArray(transactions) ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth) ||
    !isValidISODate(todayDate)
  ) {
    return [];
  }
  const currentMonth = todayDate.slice(0, 7);
  const invoices: PendingCardInvoice[] = [];
  for (const card of cards) {
    const months = new Set<string>();
    for (const tx of transactions) {
      if (
        tx.creditCardId === card.id &&
        tx.status === 'pending' &&
        isCreditCardInvoicePurchase(tx) &&
        /^\d{4}-(0[1-9]|1[0-2])$/.test(tx.competenceMonth || '')
      ) {
        months.add(tx.competenceMonth);
      }
    }
    for (const month of months) {
      const isSelected = month === selectedMonth;
      const isOverdueCarry = selectedMonth === currentMonth && month < selectedMonth;
      if (!isSelected && !isOverdueCarry) continue;
      const amount = calculateCreditCardSummary(card, transactions, month, todayDate).invoicePendingAmount;
      if (!(amount > 0)) continue;
      // Vencimento em fim de semana/feriado: pode pagar no próximo dia útil sem atraso.
      const dueDate = getNextBankBusinessDay(getClampedMonthDate(month, card.dueDay));
      invoices.push({
        cardId: card.id,
        cardName: card.name,
        invoiceMonth: month,
        dueDate,
        amount: Math.round(amount * 100) / 100,
        isOverdue: dueDate < todayDate,
        defaultAccountId: card.defaultAccountId,
      });
    }
  }
  return invoices.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Soma, em centavos, o que há a pagar e a receber numa lista de movimentos bancários pendentes. */
export function summarizePendingBankMovements(movements: Transaction[] | null | undefined) {
  const list = Array.isArray(movements) ? movements : [];
  const cents = (rows: Transaction[]) => rows.reduce((sum, tx) => sum + Math.round((tx.amount || 0) * 100), 0);
  const payableItems = list.filter((tx) => tx.type === 'expense');
  const receivableItems = list.filter((tx) => tx.type === 'income');
  return {
    payableItems,
    receivableItems,
    payableTotal: cents(payableItems) / 100,
    receivableTotal: cents(receivableItems) / 100,
  };
}
