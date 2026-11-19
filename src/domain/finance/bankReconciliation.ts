import type {
  CreditCard,
  Transaction,
} from '../../types/finance';
import {
  payCreditCardInvoice,
} from './creditCardInvoices.ts';

export interface ReconciledImportResult {
  updatedTransactions: Transaction[];
  importedCount: number;
  rejectedInvoicePayments: number;
}

/** Imports bank rows and applies invoice rows through the normal card settlement cascade. */
export function applyReconciledBankTransactions(
  existingTransactions: Transaction[],
  importedTransactions: Transaction[],
  cards: CreditCard[]
): ReconciledImportResult {
  let updatedTransactions = [...existingTransactions];
  let importedCount = 0;
  let rejectedInvoicePayments = 0;

  for (const imported of importedTransactions) {
    if (imported.settlesPendingTransactionId) {
      const pendingIndex = updatedTransactions.findIndex(
        (tx) => tx.id === imported.settlesPendingTransactionId && tx.status === 'pending'
      );
      if (pendingIndex >= 0) {
        // Extrato quita uma conta que já estava cadastrada: baixa a pendente em vez de duplicar
        const pending = updatedTransactions[pendingIndex];
        updatedTransactions = updatedTransactions.map((tx, index) =>
          index === pendingIndex
            ? {
                ...pending,
                status: 'paid' as const,
                date: imported.date,
                accountId: pending.accountId || imported.accountId,
                fitid: imported.fitid,
                importBatchId: imported.importBatchId,
                reconciled: true,
              }
            : tx
        );
        importedCount += 1;
        continue;
      }
    }

    if (!imported.isInvoicePayment) {
      const { settlesPendingTransactionId: _transient, ...toStore } = imported;
      void _transient;
      updatedTransactions = [toStore, ...updatedTransactions];
      importedCount += 1;
      continue;
    }

    const card = cards.find((candidate) => candidate.id === imported.settledCardId);
    const invoiceMonth = imported.settledInvoiceMonth;
    if (!card || !invoiceMonth || !imported.accountId) {
      rejectedInvoicePayments += 1;
      continue;
    }

    const settledTransactions = payCreditCardInvoice(
      card,
      updatedTransactions,
      invoiceMonth,
      imported.accountId,
      imported.date,
      imported.amount
    );
    if (settledTransactions === updatedTransactions) {
      rejectedInvoicePayments += 1;
      continue;
    }

    const generatedPayment = settledTransactions[0];
    if (!generatedPayment?.isInvoicePayment) {
      rejectedInvoicePayments += 1;
      continue;
    }

    updatedTransactions = settledTransactions.map((transaction) => {
      if (transaction.id === generatedPayment.id) {
        return {
          ...generatedPayment,
          id: imported.id,
          description: imported.description,
          fitid: imported.fitid,
          importBatchId: imported.importBatchId,
          reconciled: true,
          originalAmount: imported.originalAmount,
          originalCurrency: imported.originalCurrency,
          exchangeRate: imported.exchangeRate,
          effectiveExchangeRate: imported.effectiveExchangeRate,
          currencyRegime: imported.currencyRegime,
          notes: [generatedPayment.notes, imported.notes].filter(Boolean).join(' · '),
        };
      }
      return transaction.invoicePaymentId === generatedPayment.id
        ? { ...transaction, invoicePaymentId: imported.id }
        : transaction;
    });
    importedCount += 1;
  }

  return { updatedTransactions, importedCount, rejectedInvoicePayments };
}
