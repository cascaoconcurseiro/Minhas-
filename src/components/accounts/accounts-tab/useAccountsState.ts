/** Estado da tela: conta aberta, filtros e campos do cadastro. Parte de AccountsTab (ver AccountsTab.tsx). */
import { useEffect, useState } from 'react';
import { AccountType, BankAccount, CurrencyCode } from '../../../types/finance';
import type { AccountsTabPropsApi } from './accountsTabConfig';

export function useAccountsState(ctx: AccountsTabPropsApi) {
  const {
    accounts,
    initialSelectedAccountId,
  } = ctx;
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    initialSelectedAccountId || accounts[0]?.id || ''
  );
  // Drill-down page state: null = Accounts Overview List, string = Dedicated Account Page
  const [activeViewAccountId, setActiveViewAccountId] = useState<string | null>(
    initialSelectedAccountId || null
  );

  useEffect(() => {
    if (initialSelectedAccountId) {
      setSelectedAccountId(initialSelectedAccountId);
      setActiveViewAccountId(initialSelectedAccountId);
    }
  }, [initialSelectedAccountId]);

  const [statementFilter, setStatementFilter] = useState<
    'all' | 'credit' | 'debit' | 'transfer' | 'pending'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Account Create / Edit Form state
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [accName, setAccName] = useState('');
  const [accInstitution, setAccInstitution] = useState('');
  const [accType, setAccType] = useState<AccountType>('checking');
  const [accCurrency, setAccCurrency] = useState<CurrencyCode>('EUR');
  const [accInitialStr, setAccInitialStr] = useState('0,00');
  const [accInitialDate, setAccInitialDate] = useState('');
  const [accInitialForeignStr, setAccInitialForeignStr] = useState('0,00');
  const [accColor, setAccColor] = useState('#059669');
  const [accIncludeInTotal, setAccIncludeInTotal] = useState(true);
  const [formError, setFormError] = useState('');

  // Quick Initial Balance Adjuster state
  const [isAdjustingInitial, setIsAdjustingInitial] = useState(false);
  const [quickInitialStr, setQuickInitialStr] = useState('');
  const [quickInitialError, setQuickInitialError] = useState('');

  return {
    accColor,
    accCurrency,
    accIncludeInTotal,
    accInitialDate,
    accInitialForeignStr,
    accInitialStr,
    accInstitution,
    accName,
    accType,
    activeViewAccountId,
    editingAccount,
    formError,
    isAdjustingInitial,
    quickInitialError,
    quickInitialStr,
    searchQuery,
    selectedAccountId,
    setAccColor,
    setAccCurrency,
    setAccIncludeInTotal,
    setAccInitialDate,
    setAccInitialForeignStr,
    setAccInitialStr,
    setAccInstitution,
    setAccName,
    setAccType,
    setActiveViewAccountId,
    setEditingAccount,
    setFormError,
    setIsAdjustingInitial,
    setQuickInitialError,
    setQuickInitialStr,
    setSearchQuery,
    setSelectedAccountId,
    setShowAccountForm,
    setStatementFilter,
    showAccountForm,
    statementFilter,
  };
}

export type AccountsStateApi = ReturnType<typeof useAccountsState>;
