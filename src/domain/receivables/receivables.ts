import type { Receivable, ReceivablePayment, Transaction } from '../../types/finance';
import { formatMonthYearPT } from '../finance/financeRules';

const round2 = (value: number) => Math.round(value * 100) / 100;

export function getReceivablePaid(receivable: Receivable): number {
  return round2(receivable.payments.reduce((sum, payment) => sum + payment.amount, 0));
}

export function getReceivableBalance(receivable: Receivable): number {
  return Math.max(0, round2(receivable.amount - getReceivablePaid(receivable)));
}

export type ReceivableStatus = 'open' | 'partial' | 'paid';

export function getReceivableStatus(receivable: Receivable): ReceivableStatus {
  const balance = getReceivableBalance(receivable);
  if (balance <= 0) return 'paid';
  return receivable.payments.length > 0 ? 'partial' : 'open';
}

export interface ReceivablesSummary {
  totalOpen: number;
  openCount: number;
  byPerson: Array<{ personName: string; balance: number; count: number }>;
}

export function summarizeReceivables(receivables: Receivable[]): ReceivablesSummary {
  const byPerson = new Map<string, { balance: number; count: number }>();
  let totalOpen = 0;
  let openCount = 0;
  for (const receivable of receivables) {
    const balance = getReceivableBalance(receivable);
    if (balance <= 0) continue;
    totalOpen += balance;
    openCount += 1;
    const entry = byPerson.get(receivable.personName) ?? { balance: 0, count: 0 };
    entry.balance = round2(entry.balance + balance);
    entry.count += 1;
    byPerson.set(receivable.personName, entry);
  }
  return {
    totalOpen: round2(totalOpen),
    openCount,
    byPerson: [...byPerson.entries()]
      .map(([personName, value]) => ({ personName, ...value }))
      .sort((a, b) => b.balance - a.balance),
  };
}

export interface CreateReceivableInput {
  id: string;
  kind: 'card_invoice' | 'loan';
  personName: string;
  description?: string;
  amount: number;
  date: string;
  dueDate?: string;
  cardId?: string;
  invoiceMonth?: string;
  /** Empréstimo: conta de onde o dinheiro saiu (opcional; sem ela, só fica o registro da dívida). */
  fromAccountId?: string;
  note?: string;
  cardName?: string;
}

export type ReceivableResult =
  | { error: string }
  | { error?: undefined; receivable: Receivable; transactions: Transaction[] };

/** Cria o valor a receber e, quando for o caso, o lançamento que mexe na fatura do cartão ou na conta. */
export function createReceivable(input: CreateReceivableInput): ReceivableResult {
  const personName = input.personName.trim();
  if (!personName) return { error: 'Informe quem vai pagar.' };
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { error: 'Informe um valor maior que zero.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: 'Informe uma data válida.' };
  const amount = round2(input.amount);

  if (input.kind === 'card_invoice') {
    if (!input.cardId) return { error: 'Escolha o cartão.' };
    if (!input.invoiceMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.invoiceMonth)) return { error: 'Informe o mês da fatura.' };
    const description = input.description?.trim() || `Fatura de ${personName}${input.cardName ? ` — ${input.cardName}` : ''} (${formatMonthYearPT(input.invoiceMonth)})`;
    const transaction: Transaction = {
      id: `tx-recv-${input.id}`,
      description,
      amount,
      date: input.date,
      competenceMonth: input.invoiceMonth,
      type: 'expense',
      status: 'pending',
      categoryId: 'cat-outros',
      creditCardId: input.cardId,
      paymentMethod: 'credit_card',
      recurrence: 'single',
      receivableId: input.id,
    };
    return {
      receivable: {
        id: input.id, kind: 'card_invoice', personName, description, amount, createdDate: input.date,
        dueDate: input.dueDate, cardId: input.cardId, invoiceMonth: input.invoiceMonth,
        linkedTransactionId: transaction.id, payments: [], note: input.note?.trim() || undefined,
      },
      transactions: [transaction],
    };
  }

  const description = input.description?.trim() || `Empréstimo para ${personName}`;
  const transactions: Transaction[] = [];
  let linkedTransactionId: string | undefined;
  if (input.fromAccountId) {
    const outflow: Transaction = {
      id: `tx-recv-out-${input.id}`,
      description,
      amount,
      date: input.date,
      competenceMonth: input.date.slice(0, 7),
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-outros',
      accountId: input.fromAccountId,
      paymentMethod: 'pix',
      recurrence: 'single',
      receivableId: input.id,
    };
    transactions.push(outflow);
    linkedTransactionId = outflow.id;
  }
  return {
    receivable: {
      id: input.id, kind: 'loan', personName, description, amount, createdDate: input.date,
      dueDate: input.dueDate, linkedTransactionId, payments: [], note: input.note?.trim() || undefined,
    },
    transactions,
  };
}

export type PaymentResult =
  | { error: string }
  | { error?: undefined; receivable: Receivable; transaction: Transaction; applied: number };

/** Registra um pagamento recebido (parcial ou total): entra na conta, mas não conta como receita. */
export function registerReceivablePayment(
  receivable: Receivable,
  input: { id: string; date: string; amount: number; accountId: string; note?: string }
): PaymentResult {
  if (!input.accountId) return { error: 'Escolha a conta onde o dinheiro entrou.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: 'Informe uma data válida.' };
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { error: 'Informe um valor maior que zero.' };
  const balance = getReceivableBalance(receivable);
  if (balance <= 0) return { error: 'Este valor já foi totalmente recebido.' };
  const amount = round2(input.amount);
  if (amount > balance + 0.004) return { error: `O valor passa do que falta receber (${balance.toFixed(2).replace('.', ',')}).` };
  const payment: ReceivablePayment = { id: input.id, date: input.date, amount, accountId: input.accountId, note: input.note?.trim() || undefined };
  const transaction: Transaction = {
    id: `tx-recv-pay-${input.id}`,
    description: `Recebimento de ${receivable.personName} — ${receivable.description}`,
    amount,
    date: input.date,
    competenceMonth: input.date.slice(0, 7),
    type: 'income',
    status: 'paid',
    categoryId: 'cat-outros',
    accountId: input.accountId,
    paymentMethod: 'pix',
    recurrence: 'single',
    receivableId: receivable.id,
  };
  return { receivable: { ...receivable, payments: [...receivable.payments, payment] }, transaction, applied: amount };
}

/** Desfaz um pagamento registrado (some o lançamento do recebimento e a dívida volta a subir). */
export function removeReceivablePayment(
  receivable: Receivable,
  transactions: Transaction[],
  paymentId: string
): { receivable: Receivable; transactions: Transaction[] } {
  return {
    receivable: { ...receivable, payments: receivable.payments.filter((payment) => payment.id !== paymentId) },
    transactions: transactions.filter((tx) => tx.id !== `tx-recv-pay-${paymentId}`),
  };
}

/** Apaga o valor a receber com tudo o que ele criou (linha da fatura, saída da conta e recebimentos). */
export function deleteReceivable(
  receivables: Receivable[],
  transactions: Transaction[],
  receivableId: string
): { receivables: Receivable[]; transactions: Transaction[] } {
  return {
    receivables: receivables.filter((item) => item.id !== receivableId),
    transactions: transactions.filter((tx) => tx.receivableId !== receivableId),
  };
}

/** Meses de fatura permitidos: do mês atual até o último mês com lançamento naquele cartão (mínimo: o mês atual). */
export function getInvoiceMonthOptions(transactions: Transaction[], cardId: string, today: string): string[] {
  const current = today.slice(0, 7);
  let last = current;
  for (const tx of transactions) {
    if (tx.creditCardId !== cardId || tx.type !== 'expense' || !tx.competenceMonth) continue;
    if (tx.competenceMonth > last) last = tx.competenceMonth;
  }
  const months: string[] = [];
  let [year, month] = current.split('-').map(Number);
  while (`${year}-${String(month).padStart(2, '0')}` <= last && months.length < 60) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return months;
}
