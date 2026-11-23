import type { CreditCard, FamilyMember, Transaction } from '../../types/finance';
import { formatMonthYearPT, isValidISODate } from '../finance/formatting.ts';
import { getSharedSyncId } from './sharedFinanceRules.ts';
import { isSharedCardInvoiceId, SHARED_CARD_INVOICE_PREFIX } from './sharedCardInvoiceIds.ts';

export { SHARED_CARD_INVOICE_PREFIX };

/**
 * Fatura de cartão adicional cobrada de outra pessoa (ex.: cartão da esposa dentro do seu cartão).
 * Vive em Compartilhado: é uma compra no seu cartão, paga por você, 100% da outra pessoa, no mês da fatura.
 * Por isso entra na fatura e no limite do cartão e soma ao que a pessoa te deve naquele mês.
 */
const INVOICE_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isSharedCardInvoice(tx: Transaction): boolean {
  return isSharedCardInvoiceId(tx.id) && Boolean(tx.isShared);
}

export function describeSharedCardInvoice(memberName: string, cardName: string | undefined, invoiceMonth: string): string {
  return `Fatura de ${memberName}${cardName ? ` — ${cardName}` : ''} (${formatMonthYearPT(invoiceMonth)})`;
}

function validateValues(amount: number, invoiceMonth: string): { cents: number } | { error: string } {
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) return { error: 'Informe um valor válido maior que zero.' };
  if (!INVOICE_MONTH.test(invoiceMonth)) return { error: 'Informe o mês da fatura.' };
  return { cents };
}

export type SharedCardInvoiceResult =
  | { error: string }
  | { error?: undefined; transaction: Transaction };

export function createSharedCardInvoice(input: {
  id: string;
  memberId: string;
  memberName: string;
  card: CreditCard | undefined;
  invoiceMonth: string;
  amount: number;
  date: string;
}): SharedCardInvoiceResult {
  if (!input.memberId) return { error: 'Escolha de quem é a fatura.' };
  if (!input.card) return { error: 'Escolha o cartão.' };
  if (!isValidISODate(input.date)) return { error: 'Informe uma data válida.' };
  const checked = validateValues(input.amount, input.invoiceMonth);
  if ('error' in checked) return { error: checked.error };
  const amount = checked.cents / 100;
  return {
    transaction: {
      id: `${SHARED_CARD_INVOICE_PREFIX}${input.id}`,
      description: describeSharedCardInvoice(input.memberName, input.card.name, input.invoiceMonth),
      amount,
      date: input.date,
      competenceMonth: input.invoiceMonth,
      type: 'expense',
      status: 'pending',
      categoryId: 'cat-outros',
      creditCardId: input.card.id,
      paymentMethod: 'credit_card',
      recurrence: 'single',
      isShared: true,
      sharedMemberId: input.memberId,
      sharedAmount: amount,
      sharedPaidBy: 'me',
      sharedSplitMode: 'full',
      sharedStatus: 'pending',
    },
  };
}

function findEditable(transactions: Transaction[], txId: string): { tx: Transaction } | { error: string } {
  const tx = transactions.find((item) => item.id === txId);
  if (!tx || !isSharedCardInvoice(tx)) return { error: 'Fatura não encontrada.' };
  if (tx.sharedStatus === 'received') return { error: 'Reabra o acerto antes de mexer nesta fatura.' };
  if (tx.status === 'paid' || tx.invoicePaymentId || tx.partialSplitOriginalId) {
    return { error: 'Estorne o pagamento da fatura em Cartões antes de mexer nesta fatura.' };
  }
  return { tx };
}

/** Atualiza o valor cheio e/ou o mês da fatura. O que a pessoa deve acompanha o valor (é 100% dela). */
export function updateSharedCardInvoice(
  transactions: Transaction[],
  txId: string,
  input: { amount: number; invoiceMonth: string; memberName: string; cardName?: string }
): { transactions: Transaction[]; transaction?: Transaction; error?: string } {
  const found = findEditable(transactions, txId);
  if ('error' in found) return { transactions, error: found.error };
  const checked = validateValues(input.amount, input.invoiceMonth);
  if ('error' in checked) return { transactions, error: checked.error };
  const amount = checked.cents / 100;
  const updated: Transaction = {
    ...found.tx,
    amount,
    sharedAmount: amount,
    competenceMonth: input.invoiceMonth,
    description: describeSharedCardInvoice(input.memberName, input.cardName, input.invoiceMonth),
  };
  return { transactions: transactions.map((tx) => (tx.id === txId ? updated : tx)), transaction: updated };
}

export function deleteSharedCardInvoice(
  transactions: Transaction[],
  txId: string
): { transactions: Transaction[]; removedSharedSyncId?: string; error?: string } {
  const found = findEditable(transactions, txId);
  if ('error' in found) return { transactions, error: found.error };
  return {
    transactions: transactions.filter((tx) => tx.id !== txId),
    removedSharedSyncId: getSharedSyncId(found.tx),
  };
}

/**
 * Faturas de cartão adicional ainda não acertadas, por pessoa: é dinheiro que a pessoa te deve e entra no
 * "a receber" do patrimônio (a fatura já está na dívida do seu cartão). `throughDate` ignora as lançadas depois dele.
 */
export function listOpenSharedCardInvoices(
  transactions: Transaction[],
  members: FamilyMember[],
  throughDate?: string
): Array<{ personName: string; balance: number }> {
  const byMember = new Map<string, number>();
  for (const tx of transactions) {
    if (!isSharedCardInvoice(tx) || tx.sharedStatus === 'received') continue;
    if (throughDate && tx.date > throughDate) continue;
    const cents = Math.round((tx.sharedAmount || 0) * 100);
    if (cents <= 0 || !tx.sharedMemberId) continue;
    byMember.set(tx.sharedMemberId, (byMember.get(tx.sharedMemberId) ?? 0) + cents);
  }
  return [...byMember.entries()].map(([memberId, cents]) => ({
    personName: members.find((member) => member.id === memberId)?.name || 'Familiar',
    balance: cents / 100,
  }));
}
