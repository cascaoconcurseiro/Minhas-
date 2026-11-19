/** Ações de contas e investimentos. Parte do App (ver src/App.tsx). */
import { BankAccount, InvestmentAsset, Transaction } from '../types/finance';
import { newEntityId } from '../utils/ids';
import { applyCascadeAccountDelete, formatBRL, getLocalDateISO } from '../domain/finance/financeRules';
import { applyAssetOperation, createInvestmentCashMovement, getInvestmentDeletionRestriction } from '../domain/investments/investmentRules';
import { getAccountCurrency } from '../domain/finance/transferRules';
import { isValidISODate } from '../domain/finance/formatting';
import type { AppStateApi } from './useAppState';

export function useAccountAndInvestmentActions(app: AppStateApi) {
  const {
    accounts,
    cards,
    goals,
    investments,
    receivables,
    requireWorkspaceWrite,
    setAccounts,
    setCards,
    setInvestments,
    setTransactions,
    showNotice,
    transactions,
    trips,
  } = app;
  const handleAddAccount = (newAcc: Omit<BankAccount, 'id'>): BankAccount | undefined => {
    if (!requireWorkspaceWrite()) return;
    const created: BankAccount = {
      ...newAcc,
      id: newEntityId('acc'),
    };
    setAccounts((prev) => [...prev, created]);
    showNotice(`Conta ${created.name} cadastrada.`);
    return created;
  };

  const handleUpdateAccount = (updatedAcc: BankAccount) => {
    if (!requireWorkspaceWrite()) return;
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === updatedAcc.id ? updatedAcc : acc))
    );
    showNotice(`Conta ${updatedAcc.name} atualizada.`);
  };

  const handleDeleteAccount = (accountId: string) => {
    if (!requireWorkspaceWrite()) return;
    if (receivables.some((item) => item.payments.some((payment) => payment.accountId === accountId))) {
      showNotice('Esta conta tem recebimentos vinculados em A Receber. Desfaça ou corrija esses recebimentos antes de remover a conta.', undefined, true);
      return;
    }
    const tripsUsingAccount = trips.filter((trip) =>
      trip.linkedAccountId === accountId ||
      trip.exchangeLots.some((lot) => lot.accountId === accountId || lot.debitAccountId === accountId)
    );
    if (tripsUsingAccount.length > 0) {
      showNotice(
        `Conta não removida: está vinculada às viagens ${[...new Set(tripsUsingAccount.map((trip) => trip.name))].join(', ')}. Remova ou troque esses vínculos primeiro.`
      );
      return;
    }

    const result = applyCascadeAccountDelete(accounts, cards, transactions, accountId);
    if (result.error) {
      showNotice(result.error, undefined, true);
      return;
    }
    if (!result.deletedAccount) return;

    setAccounts(result.updatedAccounts);
    setCards(result.updatedCards);
    setTransactions(result.updatedTransactions);
    const cleanupMessage = result.deletedTransactionCount > 0
      ? ` ${result.deletedTransactionCount} transferência(s) incompatível(is) foram removidas.`
      : '';
    showNotice(`Conta ${result.deletedAccount.name} removida.${cleanupMessage}`);
  };

  const handleUpdateAccountInitialBalance = (accountId: string, newInitial: number) => {
    if (!requireWorkspaceWrite()) return;
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === accountId ? { ...acc, initialBalance: newInitial } : acc
      )
    );
    showNotice('Saldo inicial da conta atualizado.');
  };

  const handleAddInvestmentAsset = (newAsset: Omit<InvestmentAsset, 'id'>) => {
    if (!requireWorkspaceWrite()) return;
    const created: InvestmentAsset = {
      ...newAsset,
      id: newEntityId('inv'),
    };
    setInvestments((prev) => [...prev, created]);
    showNotice(`Ativo ${created.ticker} cadastrado na carteira.`);
  };

  const handleUpdateInvestmentAsset = (updatedAsset: InvestmentAsset) => {
    if (!requireWorkspaceWrite()) return;
    setInvestments((prev) =>
      prev.map((a) => (a.id === updatedAsset.id ? updatedAsset : a))
    );
    showNotice(`Ativo ${updatedAsset.ticker} atualizado.`);
  };

  const handleBatchUpdateInvestmentAssets = (updatedAssets: InvestmentAsset[]) => {
    if (!requireWorkspaceWrite()) return;
    setInvestments(updatedAssets);
    showNotice(
      'Cotações sincronizadas automaticamente com o Google Finance!',
      undefined,
      true
    );
  };

  const handleDeleteInvestmentAsset = (assetId: string) => {
    if (!requireWorkspaceWrite()) return;
    const target = investments.find((a) => a.id === assetId);
    if (!target) return;
    const restriction = getInvestmentDeletionRestriction(target, transactions, goals);
    if (restriction) { showNotice(restriction, undefined, true); return; }
    setInvestments((prev) => prev.filter((a) => a.id !== assetId));
    showNotice(`Ativo ${target?.ticker || ''} removido da carteira.`);
  };

  const handleOperateInvestmentAsset = (
    assetId: string,
    operationType: 'buy' | 'sell' | 'update_quote',
    quantityDelta: number,
    unitPrice: number,
    settlementAccountId?: string,
    operationDate: string = getLocalDateISO()
  ) => {
    if (!requireWorkspaceWrite()) return;
    const targetAsset = investments.find((a) => a.id === assetId);
    if (!targetAsset) return;

    let ledgerTx: Transaction | undefined;
    try {
      if (operationType !== 'update_quote' && settlementAccountId) {
        if (!accounts.some((account) => account.id === settlementAccountId && getAccountCurrency(account) === 'BRL')) throw new Error('Selecione uma conta em reais: compra e venda de ativo movimentam reais.');
        ledgerTx = createInvestmentCashMovement(targetAsset, operationType, quantityDelta, unitPrice, settlementAccountId, operationDate, newEntityId('tx-inv'));
      }
      if (!Number.isFinite(unitPrice) || unitPrice <= 0 || (operationType !== 'update_quote' && (!Number.isFinite(quantityDelta) || quantityDelta <= 0)) || (operationType === 'sell' && quantityDelta > targetAsset.quantity)) throw new Error('Confira a quantidade e o preço da operação.');
    } catch (error) { showNotice(error instanceof Error ? error.message : 'Operação inválida.', undefined, true); return; }
    const updatedAsset = applyAssetOperation(
      targetAsset,
      operationType,
      quantityDelta,
      unitPrice
    );

    setInvestments((prev) =>
      prev.map((a) => (a.id === assetId ? updatedAsset : a))
    );

    const financialTotal = Math.round(quantityDelta * unitPrice * 100) / 100;

    if (ledgerTx) {
      const movement = ledgerTx;
      setTransactions((prev) => [movement, ...prev]);
    }

    if (operationType === 'buy') {
      showNotice(
        `Aporte em ${targetAsset.ticker} registrado! Novo Preço Médio: ${formatBRL(
          updatedAsset.averagePrice
        )}.`
      );
    } else if (operationType === 'sell') {
      showNotice(
        `Resgate / Venda de ${targetAsset.ticker} registrado (${formatBRL(
          financialTotal
        )}).`
      );
    } else {
      showNotice(
        `Cotação de ${targetAsset.ticker} atualizada para ${formatBRL(unitPrice)}.`
      );
    }
  };

  const handleRecordDividendIncome = (
    asset: InvestmentAsset,
    dividendAmount: number,
    receivingAccountId: string,
    dividendDate: string = getLocalDateISO()
  ) => {
    if (!requireWorkspaceWrite()) return;
    if (!isValidISODate(dividendDate) || !Number.isFinite(dividendAmount) || Math.round(dividendAmount * 100) <= 0 || !Number.isSafeInteger(Math.round(dividendAmount * 100)) || !accounts.some(account => account.id === receivingAccountId && getAccountCurrency(account) === 'BRL')) return;
    const dividendTx: Transaction = {
      id: newEntityId('tx-div'),
      description: `Proventos / Dividendos — ${asset.ticker} (${asset.name})`,
      amount: Math.round(dividendAmount * 100) / 100,
      date: dividendDate,
      competenceMonth: dividendDate.slice(0, 7),
      type: 'income',
      status: 'paid',
      categoryId: 'cat-rendimentos',
      accountId: receivingAccountId,
      paymentMethod: 'pix',
      recurrence: 'single',
      notes: `Rendimento / dividendo creditado por ${asset.institution}`,
    };
    setTransactions((prev) => [dividendTx, ...prev]);
    showNotice(
      `Provento de ${formatBRL(dividendAmount)} (${asset.ticker}) creditado no extrato bancário!`
    );
  };

  return {
    handleAddAccount,
    handleAddInvestmentAsset,
    handleBatchUpdateInvestmentAssets,
    handleDeleteAccount,
    handleDeleteInvestmentAsset,
    handleOperateInvestmentAsset,
    handleRecordDividendIncome,
    handleUpdateAccount,
    handleUpdateAccountInitialBalance,
    handleUpdateInvestmentAsset,
  };
}

export type AccountAndInvestmentActionsApi = ReturnType<typeof useAccountAndInvestmentActions>;
