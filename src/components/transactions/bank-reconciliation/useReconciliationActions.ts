/** Ações: ler arquivo ou texto, escolher categoria, pagamento de fatura e confirmar. Parte de BankReconciliationModal (ver BankReconciliationModal.tsx). */
import { parseExchangeRateInput } from '../../../utils/currencyInput';
import React, { useMemo } from 'react';
import { convertCandidatesToTransactions } from '../../../services/import-export/ofxParser';
import { sortChronologically } from '../../../domain/finance/transactionOrdering';
import type { BankReconciliationModalPropsApi } from './bankReconciliationConfig';
import type { ReconciliationStateApi } from './useReconciliationState';
import type { ReconciliationDerivedApi } from './useReconciliationDerived';

export function useReconciliationActions(ctx: BankReconciliationModalPropsApi & ReconciliationStateApi & ReconciliationDerivedApi) {
  const {
    accounts,
    buildCandidates,
    candidates,
    cards,
    handleProcessRawText,
    onAddAccount,
    onCommitImport,
    parsedExchangeRate,
    parsedItems,
    pendingInvoiceTotalsByCard,
    selectedAccountId,
    setCandidates,
    setExchangeRateInput,
    setIsDragging,
    setSelectedAccountId,
    setSuccessCount,
    showOnlyNew,
    statementCurrencyError,
    statementMeta,
  } = ctx;
  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    if (parsedItems.length > 0) {
      setCandidates(buildCandidates(
        parsedItems,
        accountId,
        statementMeta.currency || 'BRL',
        statementMeta.currency === 'BRL' ? 1 : parsedExchangeRate
      ));
    }
  };

  const handleExchangeRateChange = (value: string) => {
    setExchangeRateInput(value);
    if (parsedItems.length > 0) {
      setCandidates(buildCandidates(
        parsedItems,
        selectedAccountId,
        statementMeta.currency || 'BRL',
        parseExchangeRateInput(value)
      ));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleProcessRawText(content, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleProcessRawText(content, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleToggleCandidate = (id: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleCategoryChange = (id: string, categoryId: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, suggestedCategoryId: categoryId } : c))
    );
  };

  const getOpenInvoiceMonths = (cardId: string) => {
    return [...(pendingInvoiceTotalsByCard.get(cardId) || new Map<string, number>())]
      .filter(([, amount]) => amount > 0)
      .map(([month]) => month)
      .sort();
  };

  const handleInvoicePaymentChange = (id: string, isInvoicePayment: boolean) => {
    setCandidates((prev) => prev.map((candidate) => {
      if (candidate.id !== id) return candidate;
      if (!isInvoicePayment) {
        return { ...candidate, isInvoicePayment: false, settledCardId: undefined, settledInvoiceMonth: undefined };
      }
      const cardId = candidate.settledCardId || cards[0]?.id;
      const months = cardId ? getOpenInvoiceMonths(cardId) : [];
      return {
        ...candidate,
        isInvoicePayment: true,
        settledCardId: cardId,
        settledInvoiceMonth: candidate.settledInvoiceMonth && months.includes(candidate.settledInvoiceMonth)
          ? candidate.settledInvoiceMonth
          : months[0],
      };
    }));
  };

  const handleInvoiceCardChange = (id: string, cardId: string) => {
    const months = getOpenInvoiceMonths(cardId);
    setCandidates((prev) => prev.map((candidate) => candidate.id === id
      ? { ...candidate, settledCardId: cardId, settledInvoiceMonth: months[0] }
      : candidate));
  };

  const handleInvoiceMonthChange = (id: string, invoiceMonth: string) => {
    setCandidates((prev) => prev.map((candidate) => candidate.id === id
      ? { ...candidate, settledInvoiceMonth: invoiceMonth }
      : candidate));
  };

  const handleDescriptionChange = (id: string, desc: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, description: desc } : c))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setCandidates((prev) =>
      prev.map((c) => ({
        ...c,
        selected: select ? !c.isPotentialInvoicePayment || Boolean(c.isInvoicePayment) : false,
      }))
    );
  };

  const handleSelectOnlyNew = () => {
    setCandidates((prev) =>
      prev.map((c) => ({
        ...c,
        selected: !c.isDuplicate && (!c.isPotentialInvoicePayment || Boolean(c.isInvoicePayment)),
      }))
    );
  };

  const filteredCandidates = useMemo(() => {
    // Sempre cronológico, mesmo que o arquivo do banco venha do mais novo para o mais antigo.
    return sortChronologically(showOnlyNew ? candidates.filter((c) => !c.isDuplicate) : candidates);
  }, [candidates, showOnlyNew]);

  const summary = useMemo(() => {
    const totalItems = candidates.length;
    const selectedList = candidates.filter((c) => c.selected);
    const duplicates = candidates.filter((c) => c.isDuplicate).length;
    const invalidInvoicePayments = candidates.filter((candidate) => {
      if (!candidate.selected || !candidate.isInvoicePayment) return false;
      if (!candidate.settledCardId || !candidate.settledInvoiceMonth) return true;
      const card = cards.find((item) => item.id === candidate.settledCardId);
      if (!card) return true;
      const pendingAmount = pendingInvoiceTotalsByCard.get(card.id)?.get(candidate.settledInvoiceMonth) || 0;
      return candidate.amount <= 0 || candidate.amount > pendingAmount;
    }).length;

    let totalCredits = 0;
    let totalDebits = 0;
    for (const c of selectedList) {
      if (c.type === 'income') totalCredits += c.amount;
      else totalDebits += c.amount;
    }

    return {
      totalItems,
      selectedCount: selectedList.length,
      duplicates,
      invalidInvoicePayments,
      totalCredits: Math.round(totalCredits * 100) / 100,
      totalDebits: Math.round(totalDebits * 100) / 100,
      netFlow: Math.round((totalCredits - totalDebits) * 100) / 100,
    };
  }, [candidates, cards, pendingInvoiceTotalsByCard]);

  const handleCommit = () => {
    if (summary.selectedCount === 0 || statementCurrencyError) return;
    let targetAccId = selectedAccountId;
    if (!targetAccId && accounts.length === 0 && onAddAccount) {
      const created = onAddAccount({
        name: statementMeta.bankId === '260' ? 'Nubank Principal' : 'Conta Corrente',
        institution: statementMeta.bankId === '260' ? 'Nubank' : 'Banco',
        type: 'checking',
        initialBalance: 0,
        color: statementMeta.bankId === '260' ? '#7c3aed' : '#059669',
        includeInTotal: true,
      });
      if (created) {
        targetAccId = created.id;
        setSelectedAccountId(created.id);
      }
    }
    if (!targetAccId) return;

    const batchId = `import-${Date.now().toString(36)}`;
    const txsToImport = convertCandidatesToTransactions(
      candidates,
      targetAccId,
      batchId
    );

    const committedCount = onCommitImport(txsToImport, targetAccId);
    if (committedCount === 0) return;
    setSuccessCount(committedCount ?? txsToImport.length);
    setCandidates([]);
  };

  return {
    filteredCandidates,
    getOpenInvoiceMonths,
    handleAccountChange,
    handleCategoryChange,
    handleCommit,
    handleDescriptionChange,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleExchangeRateChange,
    handleFileChange,
    handleInvoiceCardChange,
    handleInvoiceMonthChange,
    handleInvoicePaymentChange,
    handleSelectAll,
    handleSelectOnlyNew,
    handleToggleCandidate,
    summary,
  };
}

export type ReconciliationActionsApi = ReturnType<typeof useReconciliationActions>;
