import type { CreditCard, FamilyMember, Receivable, Transaction } from '../../types/finance';
import { deleteReceivable } from '../receivables/receivables.ts';
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
 * Leva uma fatura de cartão adicional que ainda está em A Receber (dado antigo) para Compartilhado.
 * Só vale sem recebimentos registrados e com a pessoa cadastrada em Compartilhado (mesmo nome).
 */
export function convertReceivableToSharedCardInvoice(input: {
  receivables: Receivable[];
  transactions: Transaction[];
  members: FamilyMember[];
  cards: CreditCard[];
  receivableId: string;
  newId: string;
}): { receivables: Receivable[]; transactions: Transaction[]; error?: string } {
  const { receivables, transactions } = input;
  const fail = (error: string) => ({ receivables, transactions, error });
  const item = receivables.find((entry) => entry.id === input.receivableId);
  if (!item || item.kind !== 'card_invoice') return fail('Só faturas de cartão adicional podem ir para Compartilhado.');
  if (item.payments.length > 0) return fail('Esta fatura já tem recebimentos registrados. Desfaça-os antes de mover.');
  const name = item.personName.trim().toLowerCase();
  const member = input.members.find((entry) => entry.name.trim().toLowerCase() === name);
  if (!member) return fail(`Cadastre ${item.personName} em Compartilhado (Pessoas) com o mesmo nome antes de mover.`);
  const created = createSharedCardInvoice({
    id: input.newId, memberId: member.id, memberName: member.name,
    card: input.cards.find((card) => card.id === item.cardId), invoiceMonth: item.invoiceMonth || '',
    amount: item.amount, date: item.createdDate,
  });
  if (created.error !== undefined) return fail(created.error);
  const removed = deleteReceivable(receivables, transactions, item.id);
  if (removed.error) return fail(removed.error);
  return { receivables: removed.receivables, transactions: [created.transaction, ...removed.transactions] };
}
