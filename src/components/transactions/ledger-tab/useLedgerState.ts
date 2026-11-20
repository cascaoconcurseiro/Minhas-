/** Estado da tela: modo de visão, filtros, seleção e busca. Parte de TransactionsTab (ver TransactionsTab.tsx). */
import React, { useState } from 'react';
import { Transaction } from '../../../types/finance';
import { confirmTransactionDeletion } from '../../../domain/finance/transactionDeletion';
import type { TransactionsTabPropsApi } from './transactionsTabConfig';

export function useLedgerState(ctx: TransactionsTabPropsApi) {
  const {
    globalSearchQuery,
    onChangeGlobalSearchQuery,
    onConsumeRequestedViewMode,
    onDeleteTransaction,
    requestedViewMode,
    transactions,
  } = ctx;
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'table' : 'calendar'
  );
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  // Mostra os primeiros lançamentos e abre o resto sob demanda: o mês inteiro de uma vez deixava a tela pesada
  const [rowLimit, setRowLimit] = useState(80);
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income' | 'credit_card' | 'transfer'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [actionSheetTx, setActionSheetTx] = useState<Transaction | null>(null);
  const [isReconcileMode, setIsReconcileMode] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);

  React.useEffect(() => {
    if (requestedViewMode) {
      setViewMode(requestedViewMode);
      onConsumeRequestedViewMode?.();
    }
  }, [requestedViewMode, onConsumeRequestedViewMode]);

  const effectiveSearchQuery =
    onChangeGlobalSearchQuery !== undefined ? globalSearchQuery : localSearchQuery;

  const handleSearchInputChange = (val: string) => {
    if (onChangeGlobalSearchQuery) {
      onChangeGlobalSearchQuery(val);
    } else {
      setLocalSearchQuery(val);
    }
  };

  const requestTransactionDeletion = (txId: string, deleteGroup = false) => {
    const transaction = transactions.find((tx) => tx.id === txId);
    if (!transaction) return;

    if (confirmTransactionDeletion(transaction, deleteGroup)) {
      onDeleteTransaction(txId, deleteGroup);
    }
  };

  return {
    actionSheetTx,
    categoryFilter,
    effectiveSearchQuery,
    handleSearchInputChange,
    isReconcileMode,
    requestTransactionDeletion,
    rowLimit,
    selectedTxIds,
    setActionSheetTx,
    setCategoryFilter,
    setIsReconcileMode,
    setRowLimit,
    setSelectedTxIds,
    setSourceFilter,
    setStatusFilter,
    setTagFilter,
    setTypeFilter,
    setViewMode,
    sourceFilter,
    statusFilter,
    tagFilter,
    typeFilter,
    viewMode,
  };
}

export type LedgerStateApi = ReturnType<typeof useLedgerState>;
