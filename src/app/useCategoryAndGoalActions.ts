/** Ações de categorias, orçamentos e metas. Parte do App (ver src/App.tsx). */
import { Category, SavingsGoal } from '../types/finance';
import { newEntityId } from '../utils/ids';
import { formatBRL, getLocalDateISO, getTransactionsLinkedToCategory } from '../domain/finance/financeRules';
import { applyHighConfidenceInstallmentTotals } from '../domain/budgets/legacyFinancialAudit';
import { isValidISODate } from '../domain/finance/formatting';
import { getAccountCurrency } from '../domain/finance/transferRules';
import { createGoalInvestmentContribution } from '../domain/investments/investmentRules';
import type { AppStateApi } from './useAppState';

export function useCategoryAndGoalActions(app: AppStateApi) {
  const {
    accounts,
    cards,
    categories,
    goals,
    investments,
    requireWorkspaceWrite,
    setCategories,
    setGoals,
    setInvestments,
    setTransactions,
    showNotice,
    transactions,
  } = app;
  const handleUpdateCategoryBudget = (categoryId: string, newBudget: number) => {
    if (!requireWorkspaceWrite()) return;
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId ? { ...cat, monthlyBudget: newBudget } : cat
      )
    );
    showNotice('Teto de gastos da categoria atualizado.');
  };

  const handleAddCategory = (newCat: Omit<Category, 'id'>) => {
    if (!requireWorkspaceWrite()) return;
    const created: Category = {
      ...newCat,
      id: newEntityId('cat'),
    };
    setCategories((prev) => [...prev, created]);
    showNotice(`Categoria "${created.name}" criada.`);
  };

  const handleUpdateCategory = (updatedCat: Category) => {
    if (!requireWorkspaceWrite()) return;
    setCategories((prev) =>
      prev.map((cat) => (cat.id === updatedCat.id ? updatedCat : cat))
    );
    showNotice(`Categoria "${updatedCat.name}" atualizada.`);
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (!requireWorkspaceWrite()) return;
    const target = categories.find((c) => c.id === categoryId);
    if (!target) return;
    const linkedTransactions = getTransactionsLinkedToCategory(categoryId, transactions);
    if (linkedTransactions.length > 0) {
      showNotice(
        `A categoria "${target.name}" está em ${linkedTransactions.length} lançamento(s). Reclassifique esses lançamentos antes de excluir para preservar os relatórios.`,
        undefined,
        true
      );
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    showNotice(`Categoria "${target.name}" removida.`);
  };

  const handleApplyHistoricalInstallmentTotals = () => {
    if (!requireWorkspaceWrite()) return;
    const previousTransactions = [...transactions];
    const result = applyHighConfidenceInstallmentTotals(transactions, cards);
    if (result.updatedRows === 0) {
      showNotice('Nenhum total de parcelamento de alta confiança precisa ser preenchido.', undefined, true);
      return;
    }
    setTransactions(result.updatedTransactions);
    showNotice(
      `Total original preenchido em ${result.updatedRows} parcela(s) de ${result.updatedGroups} série(s). Valores das parcelas e competências preservados. Use Desfazer no aviso se precisar reverter.`,
      previousTransactions
    );
  };

  const handleContributeGoal = (
    goalId: string,
    amount: number,
    debitAccountId?: string,
    contributionDate: string = getLocalDateISO()
  ) => {
    if (!requireWorkspaceWrite()) return;
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal || !Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 100)) || Math.round(amount * 100) <= 0) return;
    if (!isValidISODate(contributionDate)) { showNotice('Informe uma data válida para o aporte.', undefined, true); return; }
    if (debitAccountId && !accounts.some(account => account.id === debitAccountId && getAccountCurrency(account) === 'BRL')) { showNotice('Selecione uma conta em reais para debitar o aporte.', undefined, true); return; }
    if (targetGoal?.linkedAssetId) {
      const linkedAsset = investments.find((a) => a.id === targetGoal.linkedAssetId);
      if (!linkedAsset) { showNotice('O investimento vinculado à meta não foi encontrado.', undefined, true); return; }
      try {
        const result = createGoalInvestmentContribution(targetGoal, linkedAsset, amount, contributionDate, debitAccountId, newEntityId('tx-goal'));
        setInvestments(prev => prev.map(asset => asset.id === linkedAsset.id ? result.asset : asset));
        setGoals(prev => prev.map(goal => goal.id === targetGoal.id ? result.goal : goal));
        if (result.transaction) { const movement = result.transaction; setTransactions(prev => [movement, ...prev]); }
        showNotice(`Aporte de ${formatBRL(amount)} registrado na meta${debitAccountId ? ' e debitado da conta' : ''}.`);
      } catch (error) { showNotice(error instanceof Error ? error.message : 'Não foi possível registrar o aporte.', undefined, true); }
      return;
    }
    const nextGoalCents = Math.round(targetGoal.currentAmount * 100) + Math.round(amount * 100);
    if (!Number.isSafeInteger(nextGoalCents) || nextGoalCents < 0) { showNotice('O saldo da meta excede o limite de valores permitido.', undefined, true); return; }
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? { ...g, currentAmount: nextGoalCents / 100 }
          : g
      )
    );
    showNotice(`Reserva de ${formatBRL(amount)} registrada na meta.`);
  };

  const handleAddGoal = (newGoal: Omit<SavingsGoal, 'id'>) => {
    if (!requireWorkspaceWrite()) return;
    const created: SavingsGoal = {
      ...newGoal,
      id: newEntityId('goal'),
    };
    setGoals((prev) => [...prev, created]);
    showNotice(`Meta "${created.name}" criada.`);
  };

  const handleUpdateGoal = (updatedGoal: SavingsGoal) => {
    if (!requireWorkspaceWrite()) return;
    setGoals((prev) =>
      prev.map((g) => (g.id === updatedGoal.id ? updatedGoal : g))
    );
    showNotice(`Meta "${updatedGoal.name}" atualizada.`);
  };

  const handleDeleteGoal = (goalId: string) => {
    if (!requireWorkspaceWrite()) return;
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
    showNotice('Meta de economia removida.');
  };

  return {
    handleAddCategory,
    handleAddGoal,
    handleApplyHistoricalInstallmentTotals,
    handleContributeGoal,
    handleDeleteCategory,
    handleDeleteGoal,
    handleUpdateCategory,
    handleUpdateCategoryBudget,
    handleUpdateGoal,
  };
}

export type CategoryAndGoalActionsApi = ReturnType<typeof useCategoryAndGoalActions>;
