import type { BankAccount, CreditCard, Transaction } from '../types/finance';
import {
  calculateAccountBalances,
  calculateCreditCardSummary,
  formatBRL,
} from './financeRules';
import { getAccountCurrency } from './transferRules';

/**
 * Avisos antes de salvar: saldo insuficiente na conta e compra acima do limite do cartão.
 * São só avisos (a pessoa pode seguir): o banco real pode ter cheque especial ou limite extra.
 */
export interface SpendingWarning {
  kind: 'insufficient_balance' | 'card_limit';
  message: string;
  shortfall: number;
}

export function assessAccountBalanceImpact(input: {
  account: BankAccount | null | undefined;
  accounts: BankAccount[];
  transactions: Transaction[];
  amount: number;
  date: string;
  status: 'paid' | 'pending';
  ignoreTransactionId?: string;
}): SpendingWarning | null {
  const { account, accounts, amount, date, status, ignoreTransactionId } = input;
  if (!account || !Number.isFinite(amount) || amount <= 0) return null;
  // Conta em moeda estrangeira: o saldo em reais é só uma estimativa, não serve de base para o aviso.
  if (getAccountCurrency(account) !== 'BRL') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const others = input.transactions.filter((tx) => tx.id !== ignoreTransactionId);
  const month = date.slice(0, 7);
  const summary = calculateAccountBalances(accounts, others, month).find(
    (item) => item.accountId === account.id
  );
  if (!summary) return null;
  const before = status === 'paid' ? summary.currentBalance : summary.projectedBalance;
  const after = Math.round((before - amount) * 100) / 100;
  if (after >= 0) return null;
  const shortfall = Math.abs(after);
  return {
    kind: 'insufficient_balance',
    shortfall,
    message:
      before < 0
        ? `${account.name} já está negativa (${formatBRL(before)}). Este lançamento deixa ${formatBRL(after)}.`
        : `Saldo de ${account.name}: ${formatBRL(before)}. Este lançamento deixa a conta em ${formatBRL(after)} (faltam ${formatBRL(shortfall)}).`,
  };
}

export function assessCardLimitImpact(input: {
  card: CreditCard | null | undefined;
  transactions: Transaction[];
  /** Valor total da compra (para parcelado, o total, pois o limite é comprometido por inteiro). */
  purchaseTotal: number;
  date: string;
  ignoreGroupId?: string;
  ignoreTransactionId?: string;
}): SpendingWarning | null {
  const { card, purchaseTotal, date } = input;
  if (!card || !(card.limit > 0) || !Number.isFinite(purchaseTotal) || purchaseTotal <= 0) return null;
  const others = input.transactions.filter(
    (tx) =>
      tx.id !== input.ignoreTransactionId &&
      !(input.ignoreGroupId && tx.installmentGroupId === input.ignoreGroupId)
  );
  const summary = calculateCreditCardSummary(card, others, date.slice(0, 7) || '1970-01');
  const after = Math.round((summary.usedLimit + purchaseTotal) * 100) / 100;
  if (after <= card.limit + 0.004) return null;
  const shortfall = Math.round((after - card.limit) * 100) / 100;
  return {
    kind: 'card_limit',
    shortfall,
    message: `Limite livre de ${card.name}: ${formatBRL(summary.availableLimit)}. Esta compra (${formatBRL(purchaseTotal)}) passa o limite em ${formatBRL(shortfall)}.`,
  };
}

/** Avisos de data: "pago" com data futura e datas muito distantes de hoje (erro de digitação no ano). */
export function assessDateSanity(input: {
  date: string;
  status: 'paid' | 'pending';
  today: string;
}): string | null {
  const { date, status, today } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (Math.abs(days) > 400) {
    const [year, month, day] = date.split('-');
    return `A data ${day}/${month}/${year} está a mais de um ano de hoje. Confira se o ano está certo.`;
  }
  if (status === 'paid' && days > 0) {
    return 'Este lançamento está como pago, mas a data é futura. Se o dinheiro ainda não saiu ou entrou, marque como pendente.';
  }
  return null;
}
