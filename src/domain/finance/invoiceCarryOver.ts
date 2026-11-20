import type { CreditCard, Transaction } from '../../types/finance';
import { addMonthsToYearMonth, getClampedMonthDate } from './formatting.ts';
import { isCreditCardInvoicePurchase } from './transactionClassification.ts';

/**
 * Pagamento parcial de fatura: o que sobra pode ser levado para a fatura seguinte, como o banco faz (rotativo).
 * As compras continuam com a data original (o gasto não muda de mês); só a fatura delas passa para o mês
 * seguinte. Os encargos do banco (juros, IOF), se informados, entram como despesa na fatura seguinte.
 * Desfazer é possível enquanto nada do que foi levado tiver sido pago.
 */

const isRealYearMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

function pendingInvoiceLines(card: CreditCard, transactions: Transaction[], invoiceMonth: string): Transaction[] {
  return transactions.filter(
    (tx) =>
      tx.creditCardId === card.id &&
      tx.competenceMonth === invoiceMonth &&
      tx.status === 'pending' &&
      isCreditCardInvoicePurchase(tx)
  );
}

function hasPaymentOnInvoice(card: CreditCard, transactions: Transaction[], invoiceMonth: string): boolean {
  return transactions.some(
    (tx) =>
      tx.creditCardId === card.id &&
      tx.competenceMonth === invoiceMonth &&
      tx.status === 'paid' &&
      Boolean(tx.invoicePaymentId) &&
      isCreditCardInvoicePurchase(tx)
  );
}

function carriedLines(card: CreditCard, transactions: Transaction[], invoiceMonth: string): Transaction[] {
  return transactions.filter((tx) => tx.creditCardId === card.id && tx.carriedFromInvoiceMonth === invoiceMonth);
}

function feeLines(card: CreditCard, transactions: Transaction[], invoiceMonth: string): Transaction[] {
  return transactions.filter((tx) => tx.creditCardId === card.id && tx.carryOverFeeForInvoiceMonth === invoiceMonth);
}

export interface InvoiceCarryOverState {
  /** Há saldo em aberto e parte da fatura já foi paga: dá para levar o restante. */
  canCarry: boolean;
  /** Valor em aberto que seria levado (negativo quando a fatura ficou com crédito). */
  pendingAmount: number;
  /** A fatura fechou com crédito (estornos maiores que as compras): dá para levar o crédito para a próxima, sem pagar nada. */
  canCarryCredit: boolean;
  /** Valor do crédito (positivo), quando houver. */
  creditAmount: number;
  /** Já existe saldo levado desta fatura e ainda sem pagamento: dá para desfazer. */
  canUndo: boolean;
  /** Valor ainda em aberto que já foi levado desta fatura. */
  carriedAmount: number;
}

const cents = (rows: Transaction[]) => rows.reduce((sum, tx) => sum + Math.round(tx.amount * 100), 0) / 100;

export function getInvoiceCarryOverState(card: CreditCard, transactions: Transaction[], invoiceMonth: string): InvoiceCarryOverState {
  const pending = pendingInvoiceLines(card, transactions, invoiceMonth);
  const carried = carriedLines(card, transactions, invoiceMonth);
  const fees = feeLines(card, transactions, invoiceMonth);
  const stillOpen = [...carried, ...fees].every((tx) => tx.status === 'pending');
  const net = cents(pending);
  return {
    canCarry: pending.length > 0 && net > 0 && hasPaymentOnInvoice(card, transactions, invoiceMonth),
    canCarryCredit: pending.length > 0 && net < 0,
    creditAmount: net < 0 ? -net : 0,
    pendingAmount: net,
    canUndo: carried.length > 0 && stillOpen,
    carriedAmount: cents(carried.filter((tx) => tx.status === 'pending')),
  };
}

export type InvoiceCarryOverResult =
  | { transactions: Transaction[]; movedCount: number; carriedAmount: number; nextInvoiceMonth: string }
  | { error: string };

export function carryOverInvoiceBalance(
  card: CreditCard,
  transactions: Transaction[],
  invoiceMonth: string,
  options: { feeAmount?: number; feeId: string }
): InvoiceCarryOverResult {
  if (!isRealYearMonth(invoiceMonth)) return { error: 'Fatura inválida.' };
  const pending = pendingInvoiceLines(card, transactions, invoiceMonth);
  if (pending.length === 0) return { error: 'Não há saldo em aberto nesta fatura.' };
  const netCents = Math.round(cents(pending) * 100);
  if (netCents === 0) return { error: 'Esta fatura já está zerada: não há o que levar.' };
  const isCredit = netCents < 0;
  if (!isCredit && !hasPaymentOnInvoice(card, transactions, invoiceMonth)) {
    return { error: 'Pague uma parte da fatura antes de levar o restante para a próxima.' };
  }
  if (isCredit && options.feeAmount !== undefined && options.feeAmount !== 0) {
    return { error: 'Crédito levado para a próxima fatura não tem encargos.' };
  }
  const feeCents = options.feeAmount === undefined ? 0 : Math.round(options.feeAmount * 100);
  if (options.feeAmount !== undefined && (!Number.isFinite(options.feeAmount) || feeCents < 0 || !Number.isSafeInteger(feeCents))) {
    return { error: 'Informe um valor de encargos válido (ou deixe em branco).' };
  }
  if (feeCents > 0 && transactions.some((tx) => tx.id === options.feeId)) return { error: 'Encargo já registrado.' };

  const next = addMonthsToYearMonth(invoiceMonth, 1);
  const movedIds = new Set(pending.map((tx) => tx.id));
  const moved = transactions.map((tx) =>
    movedIds.has(tx.id) ? { ...tx, competenceMonth: next, carriedFromInvoiceMonth: invoiceMonth } : tx
  );
  const fee: Transaction[] = feeCents > 0 ? [{
    id: options.feeId,
    description: `Encargos do saldo levado — ${card.name} (fatura ${invoiceMonth})`,
    amount: feeCents / 100,
    date: getClampedMonthDate(invoiceMonth, card.dueDay),
    competenceMonth: next,
    type: 'expense',
    status: 'pending',
    categoryId: 'cat-tarifas',
    creditCardId: card.id,
    paymentMethod: 'credit_card',
    recurrence: 'single',
    carryOverFeeForInvoiceMonth: invoiceMonth,
  }] : [];
  return { transactions: [...fee, ...moved], movedCount: pending.length, carriedAmount: cents(pending), nextInvoiceMonth: next };
}

export type InvoiceCarryOverUndoResult = { transactions: Transaction[]; restoredCount: number } | { error: string };

export function undoInvoiceCarryOver(card: CreditCard, transactions: Transaction[], invoiceMonth: string): InvoiceCarryOverUndoResult {
  const carried = carriedLines(card, transactions, invoiceMonth);
  if (carried.length === 0) return { error: 'Não há saldo levado desta fatura.' };
  const fees = feeLines(card, transactions, invoiceMonth);
  if ([...carried, ...fees].some((tx) => tx.status !== 'pending')) {
    return { error: 'Parte do saldo levado já foi paga: estorne esse pagamento antes de desfazer.' };
  }
  const carriedIds = new Set(carried.map((tx) => tx.id));
  const feeIds = new Set(fees.map((tx) => tx.id));
  const restored = transactions
    .filter((tx) => !feeIds.has(tx.id))
    .map((tx) => {
      if (!carriedIds.has(tx.id)) return tx;
      const { carriedFromInvoiceMonth: _removed, ...rest } = tx;
      return { ...rest, competenceMonth: invoiceMonth };
    });
  return { transactions: restored, restoredCount: carried.length };
}
