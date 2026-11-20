/** Extrato da conta com saldo corrido. */
import type {
  Transaction,
} from '../../types/finance';
import {
  getCashMovementMonth,
} from '../finance/financeRules';

export interface AccountStatementEntry {
  transaction: Transaction;
  direction: 'credit' | 'debit';
  signedAmount: number;
  runningBalanceAfter: number;
  runningRealizedAfter: number;
  isTransferIncoming: boolean;
  isTransferOutgoing: boolean;
}

export interface AccountStatementSummary {
  accountId: string;
  openingBalance: number;
  closingRealizedBalance: number;
  closingProjectedBalance: number;
  monthCreditsRealized: number;
  monthDebitsRealized: number;
  monthPendingNet: number;
  entriesChronological: AccountStatementEntry[];
  entriesNewestFirst: AccountStatementEntry[];
}

/**
 * Computes a complete real bank statement for a specific BankAccount in selectedMonth,
 * including opening balance, signed credit/debit direction, and progressive running balance after each row.
 */
export function calculateAccountStatementWithRunningBalance(
  accountId: string,
  initialBalance: number,
  transactions: Transaction[],
  selectedMonth: string,
  initialBalanceDate?: string
): AccountStatementSummary {
  let openingBalance = Math.round(initialBalance * 100) / 100;
  // Lançamentos anteriores à data do saldo inicial são histórico: não entram no saldo nem no extrato.
  const isBeforeOpening = (tx: Transaction) => Boolean(initialBalanceDate) && tx.date < (initialBalanceDate as string);

  // 1. Accumulate all paid transactions prior to selectedMonth
  for (const tx of transactions) {
    if (isBeforeOpening(tx)) continue;
    if (tx.creditCardId) continue;
    if (tx.isCompanionOnlyExpense || tx.sharedPaidBy === 'member') continue;
    if (getCashMovementMonth(tx) >= selectedMonth) continue;
    if (tx.status !== 'paid') continue;

    if (tx.type === 'income' && tx.accountId === accountId) {
      openingBalance = Math.round((openingBalance + tx.amount) * 100) / 100;
    } else if (tx.type === 'expense' && tx.accountId === accountId) {
      openingBalance = Math.round((openingBalance - tx.amount) * 100) / 100;
    } else if (tx.type === 'transfer') {
      if (tx.accountId === accountId) {
        openingBalance = Math.round((openingBalance - tx.amount) * 100) / 100;
      } else if (tx.destinationAccountId === accountId) {
        openingBalance = Math.round((openingBalance + tx.amount) * 100) / 100;
      }
    }
  }

  // 2. Collect all transactions in selectedMonth touching this account
  const monthTxs = transactions
    .filter((tx) => {
      if (tx.creditCardId) return false;
      if (isBeforeOpening(tx)) return false;
      if (tx.isCompanionOnlyExpense || tx.sharedPaidBy === 'member') return false;
      if (getCashMovementMonth(tx) !== selectedMonth) return false;
      return tx.accountId === accountId || tx.destinationAccountId === accountId;
    })
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.id.localeCompare(b.id);
    });

  let runningProjected = openingBalance;
  let runningRealized = openingBalance;
  let monthCreditsRealized = 0;
  let monthDebitsRealized = 0;
  let monthPendingNet = 0;

  const entriesChronological: AccountStatementEntry[] = monthTxs.map((tx) => {
    const isTransferIncoming =
      tx.type === 'transfer' && tx.destinationAccountId === accountId;
    const isTransferOutgoing =
      tx.type === 'transfer' && tx.accountId === accountId;

    const direction: 'credit' | 'debit' =
      tx.type === 'income' || isTransferIncoming ? 'credit' : 'debit';
    const signedAmount = direction === 'credit' ? tx.amount : -tx.amount;

    runningProjected = Math.round((runningProjected + signedAmount) * 100) / 100;

    if (tx.status === 'paid') {
      runningRealized = Math.round((runningRealized + signedAmount) * 100) / 100;
      if (direction === 'credit') {
        monthCreditsRealized =
          Math.round((monthCreditsRealized + tx.amount) * 100) / 100;
      } else {
        monthDebitsRealized =
          Math.round((monthDebitsRealized + tx.amount) * 100) / 100;
      }
    } else {
      monthPendingNet = Math.round((monthPendingNet + signedAmount) * 100) / 100;
    }

    return {
      transaction: tx,
      direction,
      signedAmount,
      runningBalanceAfter: runningProjected,
      runningRealizedAfter: runningRealized,
      isTransferIncoming,
      isTransferOutgoing,
    };
  });

  return {
    accountId,
    openingBalance,
    closingRealizedBalance: runningRealized,
    closingProjectedBalance: runningProjected,
    monthCreditsRealized,
    monthDebitsRealized,
    monthPendingNet,
    entriesChronological,
    entriesNewestFirst: [...entriesChronological].reverse(),
  };
}
