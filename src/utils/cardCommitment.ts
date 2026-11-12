import type { Transaction } from '../types/finance';
import { addMonthsToYearMonth, formatMonthYearPT, getConsumptionMonth } from './financeRules';

/**
 * Quanto da renda de cada mês está comprometido com o cartão de crédito.
 *
 * - Renda do mês: só o que está lançado ou previsto naquele mês (nunca média nem estimativa).
 * - Cartão: todas as compras cuja fatura vence no mês (à vista, parceladas e fixas), o mesmo
 *   valor que aparece na fatura. As parcelas são mostradas separadas dentro desse total.
 * - Sem renda lançada no mês: só o valor em R$, sem porcentagem.
 */
export type CardCommitmentStatus = 'no_limit' | 'no_income' | 'ok' | 'warning' | 'over';

export interface CardCommitmentMonth {
  month: string;
  /** Tudo que foi lançado ou previsto como entrada no mês. */
  income: number;
  /** Total das compras do cartão que vencem no mês. */
  cardTotal: number;
  /** Parte do total que é parcela. */
  installmentTotal: number;
  /** Compras à vista e despesas fixas no cartão. */
  otherTotal: number;
  /** Porcentagem da renda (uma casa decimal), ou null quando o mês não tem renda lançada. */
  cardPercent: number | null;
  installmentPercent: number | null;
  status: CardCommitmentStatus;
}

export interface CardCommitmentItem {
  id: string;
  description: string;
  amount: number;
  isInstallment: boolean;
  /** Ex.: "2/10" quando for parcela. */
  installmentLabel: string;
}

export const DEFAULT_COMMITMENT_WARN_PERCENT = 80;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function isCardPurchase(tx: Transaction): boolean {
  return (
    Boolean(tx.creditCardId) &&
    tx.type === 'expense' &&
    !tx.isInvoicePayment &&
    !tx.isCompanionOnlyExpense &&
    tx.sharedPaidBy !== 'member'
  );
}

function isIncomeEntry(tx: Transaction): boolean {
  return tx.type === 'income' && !tx.isInvoicePayment && !tx.isCompanionOnlyExpense && tx.sharedPaidBy !== 'member';
}

export function normalizeCommitmentLimit(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(100, round1(n));
}

export function calculateCardCommitmentByMonth(input: {
  transactions: Transaction[];
  referenceMonth: string;
  monthsBack?: number;
  monthsAhead?: number;
  /** Limite em % da renda. Vazio = sem limite definido. */
  limitPercent?: number | null;
  /** Aviso ao chegar em X% do limite (padrão 80). */
  warnPercent?: number;
}): CardCommitmentMonth[] {
  const { transactions, referenceMonth } = input;
  const monthsBack = input.monthsBack ?? 3;
  const monthsAhead = input.monthsAhead ?? 9;
  const limit = normalizeCommitmentLimit(input.limitPercent);
  const warn = Math.min(100, Math.max(1, input.warnPercent ?? DEFAULT_COMMITMENT_WARN_PERCENT));

  const incomeByMonth = new Map<string, number>();
  const cardByMonth = new Map<string, { total: number; installments: number }>();

  for (const tx of transactions) {
    if (isIncomeEntry(tx)) {
      const month = getConsumptionMonth(tx);
      incomeByMonth.set(month, (incomeByMonth.get(month) ?? 0) + tx.amount);
    } else if (isCardPurchase(tx)) {
      const month = tx.competenceMonth;
      const entry = cardByMonth.get(month) ?? { total: 0, installments: 0 };
      entry.total += tx.amount;
      if (tx.recurrence === 'installment') entry.installments += tx.amount;
      cardByMonth.set(month, entry);
    }
  }

  const rows: CardCommitmentMonth[] = [];
  for (let offset = -monthsBack; offset <= monthsAhead; offset += 1) {
    const month = addMonthsToYearMonth(referenceMonth, offset);
    const income = round2(incomeByMonth.get(month) ?? 0);
    const card = cardByMonth.get(month) ?? { total: 0, installments: 0 };
    const cardTotal = round2(card.total);
    const installmentTotal = round2(card.installments);
    const hasIncome = income > 0;
    const cardPercent = hasIncome ? round1((cardTotal / income) * 100) : null;
    const installmentPercent = hasIncome ? round1((installmentTotal / income) * 100) : null;

    let status: CardCommitmentStatus;
    if (!hasIncome) status = 'no_income';
    else if (limit === null) status = 'no_limit';
    else if ((cardPercent ?? 0) >= limit) status = 'over';
    else if ((cardPercent ?? 0) >= (limit * warn) / 100) status = 'warning';
    else status = 'ok';

    rows.push({
      month,
      income,
      cardTotal,
      installmentTotal,
      otherTotal: round2(cardTotal - installmentTotal),
      cardPercent,
      installmentPercent,
      status,
    });
  }
  return rows;
}

/** Compras e parcelas que formam o total do cartão no mês, da maior para a menor. */
export function listCardCommitmentItems(transactions: Transaction[], month: string): CardCommitmentItem[] {
  return transactions
    .filter((tx) => isCardPurchase(tx) && tx.competenceMonth === month)
    .map((tx) => ({
      id: tx.id,
      description: tx.description,
      amount: round2(tx.amount),
      isInstallment: tx.recurrence === 'installment',
      installmentLabel:
        tx.recurrence === 'installment' && tx.installmentNumber && tx.installmentTotal
          ? `${tx.installmentNumber}/${tx.installmentTotal}`
          : '',
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** Meses do mês atual até os próximos 2 que já estão perto do limite ou acima dele. */
export function getCommitmentAlerts(rows: CardCommitmentMonth[], referenceMonth: string): CardCommitmentMonth[] {
  const last = addMonthsToYearMonth(referenceMonth, 2);
  return rows.filter(
    (row) => row.month >= referenceMonth && row.month <= last && (row.status === 'warning' || row.status === 'over')
  );
}

/**
 * Texto curto para mostrar logo depois de lançar compras no cartão, quando algum mês afetado ficou
 * perto ou acima do limite. Só informa; a compra já foi feita. Sem limite definido, devolve null.
 */
export function describeCommitmentAfterPurchase(input: {
  transactions: Transaction[];
  created: Transaction[];
  limitPercent?: number | null;
  warnPercent?: number;
}): string | null {
  const limit = normalizeCommitmentLimit(input.limitPercent);
  if (limit === null) return null;
  const months = [...new Set(input.created.filter(isCardPurchase).map((tx) => tx.competenceMonth))].sort();
  let worst: CardCommitmentMonth | null = null;
  for (const month of months) {
    const [row] = calculateCardCommitmentByMonth({
      transactions: input.transactions,
      referenceMonth: month,
      monthsBack: 0,
      monthsAhead: 0,
      limitPercent: limit,
      warnPercent: input.warnPercent,
    });
    if (row.status !== 'over' && row.status !== 'warning') continue;
    if (!worst || (row.status === 'over' && worst.status !== 'over')) worst = row;
  }
  if (!worst) return null;
  const percent = (worst.cardPercent ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const limitText = limit.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${formatMonthYearPT(worst.month)} ficou em ${percent}% da renda no cartão (${
    worst.status === 'over' ? 'acima do' : 'perto do'
  } limite de ${limitText}%).`;
}
