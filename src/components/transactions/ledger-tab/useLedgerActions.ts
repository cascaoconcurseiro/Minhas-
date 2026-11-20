/** Ações: selecionar, baixa em lote e liquidar pendentes. Parte de TransactionsTab (ver TransactionsTab.tsx). */
import { useMemo } from 'react';
import type { TransactionsTabPropsApi } from './transactionsTabConfig';
import type { LedgerStateApi } from './useLedgerState';
import type { LedgerDerivedApi } from './useLedgerDerived';

export function useLedgerActions(ctx: TransactionsTabPropsApi & LedgerStateApi & LedgerDerivedApi) {
  const {
    monthTransactions,
    onBatchSettleTransactions,
    onToggleStatus,
    selectedTxIds,
    setSelectedTxIds,
  } = ctx;
  const toggleSelectTx = (txId: string) => {
    setSelectedTxIds((prev) =>
      prev.includes(txId) ? prev.filter((id) => id !== txId) : [...prev, txId]
    );
  };

  const handleSelectPendingInFilter = () => {
    const pendingIds = monthTransactions
      .filter(
        (tx) =>
          tx.status === 'pending' &&
          !tx.creditCardId &&
          !tx.isCompanionOnlyExpense &&
          tx.sharedPaidBy !== 'member'
      )
      .map((tx) => tx.id);
    setSelectedTxIds(pendingIds);
  };

  const selectedSummary = useMemo(() => {
    const idSet = new Set(selectedTxIds);
    let sum = 0;
    let pendingCount = 0;
    for (const tx of monthTransactions) {
      if (idSet.has(tx.id)) {
        sum = Math.round((sum + tx.amount) * 100) / 100;
        if (tx.status === 'pending') pendingCount += 1;
      }
    }
    return { count: selectedTxIds.length, sum, pendingCount };
  }, [monthTransactions, selectedTxIds]);

  const handleConfirmBatchSettle = async () => {
    if (selectedTxIds.length === 0) return;
    const idsToSettle = [...selectedTxIds];
    try {
      if (onBatchSettleTransactions) {
        await onBatchSettleTransactions(idsToSettle);
      } else {
        for (const id of idsToSettle) {
        const target = monthTransactions.find((t) => t.id === id);
        if (target && target.status === 'pending') {
            await onToggleStatus(id);
          }
        }
      }
      setSelectedTxIds((current) => current.filter((id) => !idsToSettle.includes(id)));
    } catch {
      // Keep the failed selection visible so the user can retry or inspect it.
    }
  };

  return {
    handleConfirmBatchSettle,
    handleSelectPendingInFilter,
    selectedSummary,
    toggleSelectTx,
  };
}

export type LedgerActionsApi = ReturnType<typeof useLedgerActions>;
