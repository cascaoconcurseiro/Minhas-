/** Valores a receber: criar, receber, desfazer recebimento e apagar. Parte do App (ver src/App.tsx). */
import { useMemo } from 'react';
import { createReceivable, deleteReceivable, getReceivableBalance, registerReceivablePayment, removeReceivablePayment, summarizeReceivables } from '../domain/receivables/receivables';
import { formatBRL } from '../domain/finance/financeRules';
import type { AppStateApi } from './useAppState';

export function useReceivables(app: AppStateApi) {
  const {
    receivables,
    requireWorkspaceWrite,
    setReceivables,
    setTransactions,
    showNotice,
    transactions,
    workspaceReadOnlyMessage,
  } = app;
  // Valores a receber: fatura de cartão adicional cobrada por inteiro e empréstimos com pagamentos parciais
  const newReceivableId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const receivablesSummary = useMemo(() => summarizeReceivables(receivables), [receivables]);
  const handleCreateReceivable = (input: import('../components/receivables/ReceivablesTab').ReceivableCreateInput): string | null => {
    if (!requireWorkspaceWrite()) return workspaceReadOnlyMessage;
    const result = createReceivable({
      ...input,
      id: newReceivableId('rcv'),
    });
    if (result.error !== undefined) return result.error;
    setReceivables((previous) => [result.receivable, ...previous]);
    if (result.transactions.length > 0) setTransactions((previous) => [...result.transactions, ...previous]);
    showNotice(
      result.receivable.kind === 'card_invoice'
        ? `Fatura de ${result.receivable.personName} registrada: entra na fatura do cartão e fica a receber.`
        : `Empréstimo para ${result.receivable.personName} registrado como a receber.`
    );
    return null;
  };
  const handleRegisterReceivablePayment = (
    receivableId: string,
    input: { date: string; amount: number; accountId: string; note?: string }
  ): string | null => {
    if (!requireWorkspaceWrite()) return workspaceReadOnlyMessage;
    const target = receivables.find((item) => item.id === receivableId);
    if (!target) return 'Valor a receber não encontrado.';
    const result = registerReceivablePayment(target, { ...input, id: newReceivableId('pay') });
    if (result.error !== undefined) return result.error;
    setReceivables((previous) => previous.map((item) => (item.id === receivableId ? result.receivable : item)));
    setTransactions((previous) => [result.transaction, ...previous]);
    showNotice(
      getReceivableBalance(result.receivable) > 0
        ? `Recebimento registrado. Ainda faltam ${formatBRL(getReceivableBalance(result.receivable))} de ${target.personName}.`
        : `${target.personName} quitou este valor.`
    );
    return null;
  };
  const handleRemoveReceivablePayment = (receivableId: string, paymentId: string) => {
    if (!requireWorkspaceWrite()) return;
    const target = receivables.find((item) => item.id === receivableId);
    if (!target) return;
    const result = removeReceivablePayment(target, transactions, paymentId);
    setReceivables((previous) => previous.map((item) => (item.id === receivableId ? result.receivable : item)));
    setTransactions(result.transactions);
  };
  const handleDeleteReceivable = (receivableId: string): string | null => {
    if (!requireWorkspaceWrite()) return workspaceReadOnlyMessage;
    const result = deleteReceivable(receivables, transactions, receivableId);
    if (result.error) return result.error;
    setReceivables(result.receivables);
    setTransactions(result.transactions);
    return null;
  };

  return {
    handleCreateReceivable,
    handleDeleteReceivable,
    handleRegisterReceivablePayment,
    handleRemoveReceivablePayment,
    receivablesSummary,
  };
}

export type ReceivablesApi = ReturnType<typeof useReceivables>;
