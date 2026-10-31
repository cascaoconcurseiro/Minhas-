import { useState, useCallback } from 'react';
import { Transaction } from '../types/finance';

export interface UseBankReconciliationOptions {
  onImportBatch: (transactions: Transaction[], accountId: string) => void;
}

export function useBankReconciliation({ onImportBatch }: UseBankReconciliationOptions) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetAccountId, setTargetAccountId] = useState<string | undefined>(undefined);

  const openReconciliation = useCallback((accountId?: string) => {
    setTargetAccountId(accountId);
    setIsModalOpen(true);
  }, []);

  const closeReconciliation = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleCommitImport = useCallback(
    (transactions: Transaction[], accountId: string) => {
      onImportBatch(transactions, accountId);
    },
    [onImportBatch]
  );

  return {
    isModalOpen,
    targetAccountId,
    openReconciliation,
    closeReconciliation,
    handleCommitImport,
  };
}
