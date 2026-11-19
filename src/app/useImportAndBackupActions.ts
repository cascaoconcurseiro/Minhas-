/** Importação de extrato/CSV, backup completo e limpeza do workspace. Parte do App (ver src/App.tsx). */
import { getAccountCurrency } from '../domain/finance/transferRules';
import { Transaction } from '../types/finance';
import { parseQuickCsvLines } from '../services/import-export/quickCsvImport';
import { applyReconciledBankTransactions } from '../domain/finance/financeRules';
import { getPortableBackupFamilyMembers, getPortableBackupTransactions, mergeRestoredFamilyMembersWithCurrentIncoming, mergeRestoredTransactionsWithCurrentMirrors, parseFullFinanceBackup, prepareRestoredBackupTransactions, resolveFullBackupOptionalState } from '../services/workspace/fullBackup';
import { collectSharedSettlementReceipts, getSharedSyncId, restoreSharedSettlementReceipts } from '../domain/family/sharedFinanceRules';
import { removeSmtpPasswordsFromSettings } from '../utils/secureSettings';
import { INITIAL_ACCOUNTS, INITIAL_CATEGORIES, INITIAL_CREDIT_CARDS, INITIAL_FAMILY_MEMBERS, INITIAL_INVESTMENTS, INITIAL_SAVINGS_GOALS, INITIAL_TRANSACTIONS, INITIAL_TRIPS } from '../domain/finance/seedData';
import { DEFAULT_INVESTMENT_TARGETS } from '../domain/investments/investmentRules';
import { sanitizeAndRepairFinancialState } from '../domain/trips/travelRules';
import { getReceivableLinkIssues, validateWorkspaceConsistency } from '../services/workspace/workspacePayload';
import { DEFAULT_SETTINGS, STORAGE_KEY, stripLegacyMockItems } from './appConfig';
import type { AppStateApi } from './useAppState';
import type { SharedSyncApi } from './useSharedSync';

export function useImportAndBackupActions(app: AppStateApi & SharedSyncApi) {
  const {
    accounts,
    cards,
    categories,
    currentMonth,
    currentUser,
    familyMembers,
    goals,
    investmentTargets,
    investments,
    receivables,
    requireWorkspaceWrite,
    selectedMonth,
    setAccounts,
    setCards,
    setCategories,
    setFamilyMembers,
    setGoals,
    setInvestmentTargets,
    setInvestments,
    setIsReconciliationModalOpen,
    setReceivables,
    setReconciliationTargetAccountId,
    setSelectedMonth,
    setSettings,
    setTransactions,
    setTrips,
    settings,
    sharedWorkspaceProjectionRef,
    showNotice,
    transactions,
    triggerCrossAccountSharedTxSync,
    triggerDataLoadingTransition,
    trips,
  } = app;
  const handleImportQuickCsvLines = (linesText: string, targetAccountId: string): number => {
    if (!requireWorkspaceWrite()) return 0;
    const importAccount = accounts.find((account) => account.id === targetAccountId);
    if (!importAccount) {
      showNotice('Escolha uma conta cadastrada para importar os lançamentos.', undefined, true);
      return 0;
    }
    if (getAccountCurrency(importAccount) !== 'BRL') {
      showNotice('A importação por lote é em reais. Escolha uma conta em reais (conta internacional: lance pelo formulário, com o câmbio).', undefined, true);
      return 0;
    }
    const imported: Transaction[] = parseQuickCsvLines(linesText).valid.map((row, idx) => ({
      id: `tx-imp-${Date.now()}-${idx}`,
      description: row.description,
      amount: row.amount,
      date: row.date,
      competenceMonth: row.date.slice(0, 7),
      type: row.isNegative ? 'expense' : 'income',
      status: 'paid',
      categoryId: row.isNegative ? 'cat-mercado' : 'cat-freela',
      accountId: targetAccountId,
      paymentMethod: 'pix',
      recurrence: 'single',
      notes: 'Importado manualmente via lote CSV',
    }));

    if (imported.length > 0) {
      showNotice(`${imported.length} lançamento(s) importado(s) via lote CSV.`);
      setTransactions((prev) => [...imported, ...prev]);
      triggerDataLoadingTransition(240);
    }
    return imported.length;
  };

  const handleOpenReconciliation = (accountId?: string) => {
    if (!requireWorkspaceWrite()) return;
    setReconciliationTargetAccountId(accountId || accounts[0]?.id);
    setIsReconciliationModalOpen(true);
  };

  const handleCommitReconciliationBatch = (
    newTxs: Transaction[],
    accountId: string
  ) => {
    if (!requireWorkspaceWrite()) return 0;
    if (newTxs.length === 0) return;
    const result = applyReconciledBankTransactions(transactions, newTxs, cards);
    if (result.importedCount === 0) {
      showNotice('Nenhum lançamento válido foi importado. Revise os vínculos de cartão e fatura.', undefined, true);
      return 0;
    }
    setTransactions(result.updatedTransactions);
    const acc = accounts.find((a) => a.id === accountId);
    showNotice(
      `${result.importedCount} lançamento(s) conciliado(s) com sucesso na conta ${
        acc?.name || 'selecionada'
      }!${result.rejectedInvoicePayments > 0 ? ` ${result.rejectedInvoicePayments} pagamento(s) de fatura não puderam ser vinculados e foram ignorados.` : ''}`,
      undefined,
      result.rejectedInvoicePayments > 0
    );
    triggerDataLoadingTransition(220);
    return result.importedCount;
  };

  const handleExportFullBackupJson = () => {
    if (!currentUser?.uid) {
      showNotice('Entre na sua conta para exportar o backup do workspace.');
      return;
    }
    const payload = {
      version: 6,
      ownerUserId: currentUser?.uid,
      exportedAt: new Date().toISOString(),
      accounts,
      cards,
      categories,
      transactions: getPortableBackupTransactions(transactions),
      sharedSettlementReceiptsJson: JSON.stringify(collectSharedSettlementReceipts(transactions)),
      goals,
      receivables,
      familyMembers: getPortableBackupFamilyMembers(familyMembers),
      investments,
      investmentTargets,
      trips,
      settings: removeSmtpPasswordsFromSettings(settings),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minhas-economias-backup-${selectedMonth}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotice('Backup do workspace (.JSON) exportado com sucesso.', undefined, true);
  };

  const handleImportFullBackupJson = (jsonText: string): boolean => {
    if (!requireWorkspaceWrite()) return false;
    try {
      const parsed = parseFullFinanceBackup(jsonText);
      if (!parsed) return false;
      const sameOwner = Boolean(currentUser?.uid && parsed.ownerUserId === currentUser.uid);
      const optionalState = resolveFullBackupOptionalState(parsed, {
        familyMembers: INITIAL_FAMILY_MEMBERS,
        investmentTargets: DEFAULT_INVESTMENT_TARGETS,
        settings: DEFAULT_SETTINGS,
      });

      const repaired = sanitizeAndRepairFinancialState({
        accounts: parsed.accounts,
        cards: parsed.cards,
        categories: parsed.categories,
        transactions: prepareRestoredBackupTransactions(
          parsed.transactions,
          sameOwner
        ),
        goals: parsed.goals,
        investments: parsed.investments,
        trips: parsed.trips,
      });
      const restoredFamilyMembers = stripLegacyMockItems(
        mergeRestoredFamilyMembersWithCurrentIncoming(
          familyMembers,
          optionalState.familyMembers
        )
      );
      const restoredTransactions = mergeRestoredTransactionsWithCurrentMirrors(
        transactions,
        repaired.transactions
      );
      const restoredWithReceipts = sameOwner && parsed.sharedSettlementReceiptsJson
        ? [...restoredTransactions.filter((tx) => !tx.id.startsWith('tx-mirror-')),
          ...restoreSharedSettlementReceipts(restoredTransactions.filter((tx) => tx.id.startsWith('tx-mirror-')), parsed.sharedSettlementReceiptsJson, restoredTransactions)]
        : restoredTransactions;
      const consistencyError = validateWorkspaceConsistency({
        accounts: repaired.accounts,
        cards: repaired.cards,
        transactions: repaired.transactions,
      });
      const receivableIssues = getReceivableLinkIssues(
        optionalState.receivables, repaired.transactions, repaired.accounts
      );
      if (consistencyError || receivableIssues.size) {
        showNotice(consistencyError || 'O backup contém valores a receber sem movimentos correspondentes.', undefined, true);
        return false;
      }
      setAccounts(repaired.accounts);
      setCards(repaired.cards);
      setCategories(parsed.categories);
      setGoals(repaired.goals);
      setReceivables(optionalState.receivables);
      setTransactions(restoredWithReceipts);
      setFamilyMembers(restoredFamilyMembers);
      setInvestments(repaired.investments);
      setTrips(repaired.trips);
      setInvestmentTargets(optionalState.investmentTargets);
      setSettings(optionalState.settings);
      if (sameOwner && !sharedWorkspaceProjectionRef.current) {
        const restoredIds = new Set(restoredWithReceipts.filter((tx) => tx.isShared && !tx.tripId).map(getSharedSyncId));
        const removed = transactions.filter((tx) =>
          tx.isShared && !tx.tripId && !tx.id.startsWith('tx-mirror-') && !restoredIds.has(getSharedSyncId(tx))
        );
        triggerCrossAccountSharedTxSync(restoredWithReceipts, restoredFamilyMembers, removed.map(getSharedSyncId));
      }
      showNotice(
        'Backup carregado nesta sessão. Confira o status da nuvem para confirmar o salvamento no Neon.'
      );
      triggerDataLoadingTransition(260);
      return true;
    } catch {
      return false;
    }
  };

  const handleResetWorkspaceData = () => {
    if (!requireWorkspaceWrite()) return;
    showNotice('Dados do workspace pessoal removidos. Convites e lançamentos compartilhados não foram alterados.');
    setAccounts(INITIAL_ACCOUNTS);
    setCards(INITIAL_CREDIT_CARDS);
    setCategories(INITIAL_CATEGORIES);
    setTransactions(INITIAL_TRANSACTIONS);
    setGoals(INITIAL_SAVINGS_GOALS);
    setReceivables([]);
    setFamilyMembers(INITIAL_FAMILY_MEMBERS);
    setInvestments(INITIAL_INVESTMENTS);
    setInvestmentTargets(DEFAULT_INVESTMENT_TARGETS);
    setTrips(INITIAL_TRIPS);
    setSelectedMonth(currentMonth);
    localStorage.removeItem(STORAGE_KEY);
    triggerDataLoadingTransition(240);
  };

  return {
    handleCommitReconciliationBatch,
    handleExportFullBackupJson,
    handleImportFullBackupJson,
    handleImportQuickCsvLines,
    handleOpenReconciliation,
    handleResetWorkspaceData,
  };
}

export type ImportAndBackupActionsApi = ReturnType<typeof useImportAndBackupActions>;
