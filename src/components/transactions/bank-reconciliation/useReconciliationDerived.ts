/** Conta e moeda alvo, câmbio, faturas em aberto e montagem dos candidatos. Parte de BankReconciliationModal (ver BankReconciliationModal.tsx). */
import { useMemo } from 'react';
import { parseBankStatement, prepareReconciliationCandidates } from '../../../services/import-export/ofxParser';
import type { BankReconciliationModalPropsApi } from './bankReconciliationConfig';
import type { ReconciliationStateApi } from './useReconciliationState';

export function useReconciliationDerived(ctx: BankReconciliationModalPropsApi & ReconciliationStateApi) {
  const {
    cards,
    categories,
    existingTransactions,
    familyMembers,
    selectedAccountId,
    setCandidates,
    setExchangeRateInput,
    setIsProcessing,
    setParseFeedback,
    setParsedItems,
    setPasteMode,
    setStatementMeta,
    setSuccessCount,
  } = ctx;
  const pendingInvoiceTotalsByCard = useMemo(() => {
    const cardIds = new Set(cards.map((card) => card.id));
    const totals = new Map<string, Map<string, number>>();
    for (const tx of existingTransactions) {
      if (
        !tx.creditCardId || !cardIds.has(tx.creditCardId) || tx.status !== 'pending' ||
        tx.isInvoicePayment || tx.isCompanionOnlyExpense || tx.sharedPaidBy === 'member'
      ) continue;
      const cardTotals = totals.get(tx.creditCardId) || new Map<string, number>();
      cardTotals.set(tx.competenceMonth, Math.round(((cardTotals.get(tx.competenceMonth) || 0) + tx.amount) * 100) / 100);
      totals.set(tx.creditCardId, cardTotals);
    }
    return totals;
  }, [cards, existingTransactions]);

  const buildCandidates = (
    items: ReturnType<typeof parseBankStatement>['items'],
    accountId: string,
    currency = 'BRL',
    exchangeRate?: number
  ) => prepareReconciliationCandidates(
    items,
    existingTransactions,
    categories,
    accountId,
    cards,
    { currency, exchangeRate },
    familyMembers
  );

  const handleProcessRawText = (text: string, fileName?: string) => {
    setIsProcessing(true);
    setSuccessCount(null);
    setParseFeedback('');
    try {
      const parsed = parseBankStatement(text);
      const currency = parsed.metadata.currency || (parsed.fileFormat === 'csv' ? 'BRL' : undefined);
      setParsedItems(parsed.items);
      setExchangeRateInput('');
      setStatementMeta({
        fileFormat: parsed.fileFormat,
        bankId: parsed.metadata.bankId,
        accountId: parsed.metadata.accountId,
        currency,
        fileName: fileName || (parsed.fileFormat === 'ofx' ? 'extrato.ofx' : 'extrato.csv'),
      });

      const candList = buildCandidates(parsed.items, selectedAccountId, currency || 'BRL', currency === 'BRL' ? 1 : undefined);
      setCandidates(candList);
      if (parsed.items.length === 0) {
        setParseFeedback(
          parsed.skippedInvalidCount > 0
            ? `Nenhum lançamento válido foi encontrado; ${parsed.skippedInvalidCount} linha(s) inválida(s) foram ignoradas. Confira datas e valores.`
            : 'Nenhum lançamento foi encontrado neste extrato.'
        );
      } else if (parsed.skippedInvalidCount > 0) {
        setParseFeedback(
          `${parsed.skippedInvalidCount} linha(s) inválida(s) foram ignoradas. Revise o extrato antes de importar os lançamentos válidos.`
        );
      }
      setPasteMode(false);
    } catch (err) {
      console.error('Erro ao processar extrato bancário:', err);
      setParseFeedback('Não foi possível processar este extrato. Confira o formato do arquivo e tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    buildCandidates,
    handleProcessRawText,
    pendingInvoiceTotalsByCard,
  };
}

export type ReconciliationDerivedApi = ReturnType<typeof useReconciliationDerived>;
