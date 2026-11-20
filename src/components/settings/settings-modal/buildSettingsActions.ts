/** Ações com a janela aberta: importar backup, criar categoria e salvar orçamento. Função comum, sem hooks: roda depois do retorno antecipado de janela fechada. Parte de SettingsModal (ver SettingsModal.tsx). */
import React from 'react';
import { parseFullFinanceBackup } from '../../../services/workspace/fullBackup';
import { parseCurrencyInput } from '../../../utils/currencyInput';
import type { SettingsModalPropsApi } from './settingsModalConfig';
import type { SettingsStateApi } from './useSettingsState';

export function buildSettingsActions(ctx: SettingsModalPropsApi & SettingsStateApi) {
  const {
    budgetEditInputs,
    categories,
    newCatBudgetStr,
    newCatGroup,
    newCatName,
    newCatType,
    onAddCategory,
    onImportFullBackupJson,
    onUpdateCategoryBudget,
    setBudgetEditInputs,
    setImportError,
    setImportSuccess,
    setIsImporting,
    setNewCatBudgetStr,
    setNewCatName,
  } = ctx;
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportSuccess(false);

    const reader = new FileReader();
    const failImport = () => {
      setImportSuccess(false);
      setImportError('Não foi possível ler ou restaurar este arquivo JSON.');
    };
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content !== 'string') return failImport();
      const backup = parseFullFinanceBackup(content);
      if (!backup) {
        setImportError('Arquivo JSON inválido ou fora do padrão do Minhas Economias BR.');
        return;
      }

      const preview = [
        `Contas: ${backup.accounts.length}`,
        `cartões: ${backup.cards.length}`,
        `categorias: ${backup.categories.length}`,
        `lançamentos: ${backup.transactions.length}`,
        `metas: ${backup.goals.length}`,
        `investimentos: ${backup.investments.length}`,
        `viagens: ${backup.trips.length}`,
      ].join(' · ');
      const confirmed = window.confirm(
        `Prévia do backup (versão ${backup.version}): ${preview}. Restaurar este arquivo substituirá os dados atuais do workspace. Se ainda não fez isso, baixe um backup atual antes de continuar. Depois da restauração, confira o status da nuvem até confirmar a sincronização com o Neon. Continuar?`
      );
      if (!confirmed) return;

      setIsImporting(true);
      void Promise.resolve()
        .then(() => onImportFullBackupJson(content))
        .then((ok) => {
          if (ok !== true) {
            setImportError('Arquivo JSON inválido ou fora do padrão do Minhas Economias BR.');
            return;
          }
          setImportSuccess(true);
          setTimeout(() => setImportSuccess(false), 3500);
        })
        .catch(failImport)
        .finally(() => setIsImporting(false));
    };
    reader.onerror = failImport;
    reader.onabort = failImport;
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !onAddCategory) return;
    const colors = [
      '#059669',
      '#2563eb',
      '#7c3aed',
      '#d97706',
      '#e11d48',
      '#0891b2',
      '#4f46e5',
    ];
    const randomColor = colors[categories.length % colors.length];
    onAddCategory({
      name: newCatName.trim(),
      type: newCatType,
      color: randomColor,
      icon: newCatType === 'income' ? 'briefcase' : 'shopping-bag',
      monthlyBudget:
        newCatType === 'expense' ? Math.max(0, parseCurrencyInput(newCatBudgetStr, 'BRL')) : 0,
      bucket: newCatType === 'expense' ? newCatGroup : 'financial',
    });
    setNewCatName('');
    setNewCatBudgetStr('600,00');
  };

  const handleSaveCategoryBudget = (catId: string, fallbackBudget: number) => {
    if (!onUpdateCategoryBudget) return;
    const raw = budgetEditInputs[catId];
    if (raw === undefined) return;
    const parsed = Math.max(0, parseCurrencyInput(raw, 'BRL'));
    onUpdateCategoryBudget(catId, parsed || fallbackBudget);
    setBudgetEditInputs((prev) => {
      const next = { ...prev };
      delete next[catId];
      return next;
    });
  };

  return {
    handleCreateCategory,
    handleFileUpload,
    handleSaveCategoryBudget,
  };
}

export type SettingsActionsApi = ReturnType<typeof buildSettingsActions>;
