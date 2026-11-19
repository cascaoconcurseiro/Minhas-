import type {
  AccountBalanceSummary,
  BankAccount,
  Transaction,
} from '../../types/finance';
import {
  getCashMovementMonth,
} from './transactionClassification.ts';

/** O lançamento é anterior à data de abertura do saldo da conta (histórico que não entra no saldo). */
export function isBeforeAccountOpening(account: Pick<BankAccount, 'initialBalanceDate'>, txDate: string): boolean {
  return Boolean(account.initialBalanceDate) && txDate < (account.initialBalanceDate as string);
}

export function calculateAccountBalances(
  accounts: BankAccount[],
  transactions: Transaction[],
  selectedMonth: string,
  throughDate?: string
): AccountBalanceSummary[] {
  return accounts.map((acc) => {
    let currentBalance = acc.initialBalance;
    let projectedBalance = acc.initialBalance;
    let monthIncome = 0;
    let monthExpense = 0;

    for (const tx of transactions) {
      if (tx.isCompanionOnlyExpense || tx.sharedPaidBy === 'member') {
        continue;
      }

      if (tx.creditCardId && !tx.isInvoicePayment) {
        continue;
      }

      const cashMovementMonth = getCashMovementMonth(tx);
      if (cashMovementMonth > selectedMonth) {
        continue;
      }

      if (throughDate && tx.date > throughDate) continue;
      const isSelectedMonth = cashMovementMonth === selectedMonth;

      const touchesAccount = tx.accountId === acc.id || tx.destinationAccountId === acc.id;
      if (touchesAccount && isBeforeAccountOpening(acc, tx.date)) continue;

      if (tx.type === 'income' && tx.accountId === acc.id) {
        if (tx.status === 'paid') {
          currentBalance += tx.amount;
          projectedBalance += tx.amount;
        } else {
          projectedBalance += tx.amount;
        }
        if (isSelectedMonth) {
          monthIncome += tx.amount;
        }
      } else if (tx.type === 'expense' && tx.accountId === acc.id) {
        if (tx.status === 'paid') {
          currentBalance -= tx.amount;
          projectedBalance -= tx.amount;
        } else {
          projectedBalance -= tx.amount;
        }
        if (isSelectedMonth) {
          monthExpense += tx.amount;
        }
      } else if (tx.type === 'transfer') {
        if (tx.accountId === acc.id) {
          if (tx.status === 'paid') {
            currentBalance -= tx.amount;
            projectedBalance -= tx.amount;
          } else {
            projectedBalance -= tx.amount;
          }
        }
        if (tx.destinationAccountId === acc.id) {
          if (tx.status === 'paid') {
            currentBalance += tx.amount;
            projectedBalance += tx.amount;
          } else {
            projectedBalance += tx.amount;
          }
        }
      }
    }

    return {
      accountId: acc.id,
      currentBalance: Math.round(currentBalance * 100) / 100,
      projectedBalance: Math.round(projectedBalance * 100) / 100,
      monthIncome: Math.round(monthIncome * 100) / 100,
      monthExpense: Math.round(monthExpense * 100) / 100,
    };
  });
}
