/** Estado da janela: aba ativa, importação e campos de nova categoria. Parte de SettingsModal (ver SettingsModal.tsx). */
import { useEffect, useRef, useState } from 'react';
import { BudgetBucket } from '../../../types/finance';
import type { SettingsModalPropsApi } from './settingsModalConfig';

export function useSettingsState(ctx: SettingsModalPropsApi) {
  const {
    initialTab,
    isOpen,
    onClose,
  } = ctx;
  const [activeTab, setActiveTab] = useState<
    'appearance' | 'categories' | 'rules' | 'reminders' | 'profile'
  >(initialTab);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [testNotificationSent, setTestNotificationSent] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Category creation & inline budget editing state
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense');
  const [newCatBudgetStr, setNewCatBudgetStr] = useState('600,00');
  const [newCatGroup, setNewCatGroup] = useState<BudgetBucket>('essential');
  const [budgetEditInputs, setBudgetEditInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return {
    activeTab,
    budgetEditInputs,
    confirmReset,
    fileInputRef,
    importError,
    importSuccess,
    isImporting,
    newCatBudgetStr,
    newCatGroup,
    newCatName,
    newCatType,
    setActiveTab,
    setBudgetEditInputs,
    setConfirmReset,
    setImportError,
    setImportSuccess,
    setIsImporting,
    setNewCatBudgetStr,
    setNewCatGroup,
    setNewCatName,
    setNewCatType,
    setShowSmtpPassword,
    setTestNotificationSent,
    showSmtpPassword,
    testNotificationSent,
  };
}

export type SettingsStateApi = ReturnType<typeof useSettingsState>;
