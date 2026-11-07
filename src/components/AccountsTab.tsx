import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Edit3,
  FileCheck2,
  Globe,
  Landmark,
  Link2,
  Plane,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  AccountBalanceSummary,
  AccountType,
  BankAccount,
  Category,
  CurrencyCode,
  Transaction,
  Trip,
} from '../types/finance';
import {
  formatBRL,
  formatMonthYearPT,
  formatShortDateBR,
  normalizeSearchText,
  parseBRLInput,
} from '../utils/financeRules';
import { CURRENCY_CATALOG, formatForeignCurrency } from '../utils/travelRules';
import { calculateAccountStatementWithRunningBalance } from '../utils/uxEnhancementRules';
import { CategoryIconBadge } from './CategoryIconBadge';

const FOREIGN_CURRENCY_OPTIONS: CurrencyCode[] = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CAD',
  'ARS',
  'CLP',
  'JPY',
];

const INTL_ACCOUNT_PRESETS: {
  label: string;
  name: string;
  institution: string;
  currency: CurrencyCode;
  color: string;
}[] = [
  {
    label: 'Wise (EUR)',
    name: 'Wise Conta Global Euro',
    institution: 'Wise',
    currency: 'EUR',
    color: '#059669',
  },
  {
    label: 'Wise (USD)',
    name: 'Wise Conta Global Dólar',
    institution: 'Wise',
    currency: 'USD',
    color: '#059669',
  },
  {
    label: 'Nomad (USD)',
    name: 'Nomad Global Account',
    institution: 'Nomad',
    currency: 'USD',
    color: '#d97706',
  },
  {
    label: 'Avenue (USD)',
    name: 'Avenue Banking Dólar',
    institution: 'Avenue',
    currency: 'USD',
    color: '#2563eb',
  },
  {
    label: 'C6 Global (EUR)',
    name: 'C6 Conta Global Euro',
    institution: 'C6 Bank',
    currency: 'EUR',
    color: '#334155',
  },
  {
    label: 'Inter Global (USD)',
    name: 'Inter Global Account USD',
    institution: 'Banco Inter',
    currency: 'USD',
    color: '#d97706',
  },
];

interface AccountsTabProps {
  selectedMonth: string;
  accounts: BankAccount[];
  accountBalances: AccountBalanceSummary[];
  categories: Category[];
  transactions: Transaction[];
  trips?: Trip[];
  initialSelectedAccountId?: string;
  onToggleAccountInTotal: (accountId: string) => void;
  onAddAccount: (account: Omit<BankAccount, 'id'>) => BankAccount | void;
  onUpdateAccount?: (account: BankAccount) => void;
  onDeleteAccount?: (accountId: string) => void;
  onUpdateAccountInitialBalance: (accountId: string, newInitial: number) => void;
  onUpdateTrip?: (trip: Trip) => void;
  onToggleTransactionStatus: (txId: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDuplicateTransaction?: (tx: Transaction) => void;
  onDeleteTransaction: (txId: string, deleteGroup?: boolean) => void;
  onOpenNewTransaction: (
    mode: 'expense' | 'income' | 'credit_card' | 'transfer',
    initialDate?: string
  ) => void;
  onOpenReconciliation?: (accountId?: string) => void;
}

const ACCOUNT_COLORS = [
  { name: 'Esmeralda', hex: '#059669' },
  { name: 'Azul Itaú', hex: '#2563eb' },
  { name: 'Roxo Nubank', hex: '#7c3aed' },
  { name: 'Âmbar Inter', hex: '#d97706' },
  { name: 'Ardósia', hex: '#334155' },
  { name: 'Rosa', hex: '#e11d48' },
];

export const AccountsTab: React.FC<AccountsTabProps> = ({
  selectedMonth,
  accounts,
  accountBalances,
  categories,
  transactions,
  trips = [],
  initialSelectedAccountId,
  onToggleAccountInTotal,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onUpdateAccountInitialBalance,
  onUpdateTrip,
  onToggleTransactionStatus,
  onEditTransaction,
  onDuplicateTransaction,
  onDeleteTransaction,
  onOpenNewTransaction,
  onOpenReconciliation,
}) => {
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
  const [statementOrder, setStatementOrder] = useState<'chronological' | 'newest'>(
    'chronological'
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Account Create / Edit Form state
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [accName, setAccName] = useState('');
  const [accInstitution, setAccInstitution] = useState('');
  const [accType, setAccType] = useState<AccountType>('checking');
  const [accCurrency, setAccCurrency] = useState<CurrencyCode>('EUR');
  const [accInitialStr, setAccInitialStr] = useState('0,00');
  const [accInitialForeignStr, setAccInitialForeignStr] = useState('0,00');
  const [accColor, setAccColor] = useState('#059669');
  const [accIncludeInTotal, setAccIncludeInTotal] = useState(true);
  const [formError, setFormError] = useState('');

  // Quick Initial Balance Adjuster state
  const [isAdjustingInitial, setIsAdjustingInitial] = useState(false);
  const [quickInitialStr, setQuickInitialStr] = useState('');

  const activeAccount =
    accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  const catMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const accMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  // Totals across all accounts
  const globalTotals = useMemo(() => {
    let giroCurrent = 0;
    let giroProjected = 0;
    let totalPatrimony = 0;
    for (const acc of accounts) {
      const bal = accountBalances.find((b) => b.accountId === acc.id);
      const curr = bal?.currentBalance ?? acc.initialBalance;
      const proj = bal?.projectedBalance ?? acc.initialBalance;
      totalPatrimony += curr;
      if (acc.includeInTotal) {
        giroCurrent += curr;
        giroProjected += proj;
      }
    }
    return { giroCurrent, giroProjected, totalPatrimony };
  }, [accounts, accountBalances]);

  // Real Bank Statement with Running Balance for the active account
  const statementSummary = useMemo(() => {
    if (!activeAccount) return null;
    return calculateAccountStatementWithRunningBalance(
      activeAccount.id,
      activeAccount.initialBalance,
      transactions,
      selectedMonth
    );
  }, [activeAccount, transactions, selectedMonth]);

  const filteredStatementEntries = useMemo(() => {
    if (!statementSummary) return [];
    const baseList =
      statementOrder === 'chronological'
        ? statementSummary.entriesChronological
        : statementSummary.entriesNewestFirst;

    const normQuery = normalizeSearchText(searchQuery);

    return baseList.filter((entry) => {
      const tx = entry.transaction;
      if (statementFilter === 'credit' && entry.direction !== 'credit') return false;
      if (statementFilter === 'debit' && entry.direction !== 'debit') return false;
      if (statementFilter === 'transfer' && tx.type !== 'transfer') return false;
      if (statementFilter === 'pending' && tx.status !== 'pending') return false;

      if (normQuery) {
        const cat = catMap.get(tx.categoryId);
        const searchable = normalizeSearchText(
          `${tx.description} ${cat?.name || ''} ${tx.notes || ''}`
        );
        if (!searchable.includes(normQuery)) return false;
      }
      return true;
    });
  }, [statementSummary, statementOrder, statementFilter, searchQuery, catMap]);

  const openNewAccountForm = (initialType: AccountType = 'checking') => {
    setEditingAccount(null);
    setAccName('');
    setAccInstitution('');
    setAccType(initialType);
    setAccCurrency('EUR');
    setAccInitialStr('0,00');
    setAccInitialForeignStr('0,00');
    setAccColor('#059669');
    setAccIncludeInTotal(initialType !== 'international');
    setFormError('');
    setShowAccountForm(true);
  };

  const openEditAccountForm = (acc: BankAccount) => {
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccInstitution(acc.institution);
    setAccType(acc.type);
    const curr = acc.currency && acc.currency !== 'BRL' ? acc.currency : 'EUR';
    setAccCurrency(curr);
    setAccInitialStr(acc.initialBalance.toFixed(2).replace('.', ','));
    setAccInitialForeignStr(
      (acc.initialBalanceForeign ?? 0).toFixed(2).replace('.', ',')
    );
    setAccColor(acc.color || '#059669');
    setAccIncludeInTotal(acc.includeInTotal);
    setFormError('');
    setShowAccountForm(true);
  };

  // Compute foreign balance for an international account
  const getInternationalAccountForeignMetrics = (acc: BankAccount) => {
    const currency: CurrencyCode =
      acc.currency && acc.currency !== 'BRL' ? acc.currency : 'EUR';
    const baseForeign = acc.initialBalanceForeign ?? 0;

    // Sum exchange lots explicitly credited to this account
    let purchasedLotsForeign = 0;
    let totalLotsBrl = 0;
    for (const t of trips) {
      if (t.currency !== currency) continue;
      for (const lot of t.exchangeLots) {
        if (lot.accountId === acc.id) {
          purchasedLotsForeign += lot.foreignAmount;
          totalLotsBrl += lot.totalBrlPaid;
        }
      }
    }

    // Sum foreign expenses paid via this account
    let spentForeign = 0;
    for (const tx of transactions) {
      if (
        tx.accountId === acc.id &&
        tx.type === 'expense' &&
        !tx.isCompanionOnlyExpense &&
        (tx.originalCurrency === currency || (!tx.originalCurrency && tx.tripId))
      ) {
        spentForeign += tx.originalAmount ?? 0;
      }
    }

    const currentForeignBalance =
      Math.round((baseForeign + purchasedLotsForeign - spentForeign) * 100) / 100;
    const avgRate =
      purchasedLotsForeign > 0
        ? totalLotsBrl / purchasedLotsForeign
        : CURRENCY_CATALOG[currency]?.defaultCommercialRateBrl || 6.0;
    const estimatedBrlValue = Math.round(currentForeignBalance * avgRate * 100) / 100;

    return {
      currency,
      currentForeignBalance,
      purchasedLotsForeign,
      spentForeign,
      avgRate,
      estimatedBrlValue,
    };
  };

  const handleSaveAccountForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) {
      setFormError('Informe o nome da conta ou carteira (ex: Itaú Conta Corrente ou Wise Euro).');
      return;
    }
    const isIntl = accType === 'international';
    const parsedInitialBrl = parseBRLInput(accInitialStr);
    const parsedInitialForeign = parseBRLInput(accInitialForeignStr);
    const effectiveCurrency: CurrencyCode = isIntl ? accCurrency : 'BRL';
    const fallbackRate =
      CURRENCY_CATALOG[effectiveCurrency]?.defaultCommercialRateBrl || 1;
    const finalInitialBrl = isIntl
      ? Math.round(parsedInitialForeign * fallbackRate * 100) / 100
      : parsedInitialBrl;

    if (editingAccount) {
      if (onUpdateAccount) {
        onUpdateAccount({
          ...editingAccount,
          name: accName.trim(),
          institution:
            accInstitution.trim() || (isIntl ? 'Conta Global' : 'Instituição / Carteira'),
          type: accType,
          currency: effectiveCurrency,
          initialBalance: finalInitialBrl,
          initialBalanceForeign: isIntl ? parsedInitialForeign : undefined,
          color: accColor,
          includeInTotal: isIntl ? false : accIncludeInTotal,
        });
      } else {
        onUpdateAccountInitialBalance(editingAccount.id, finalInitialBrl);
      }
    } else {
      onAddAccount({
        name: accName.trim(),
        institution: accInstitution.trim() || (isIntl ? 'Conta Global' : 'Banco / Carteira'),
        type: accType,
        currency: effectiveCurrency,
        initialBalance: finalInitialBrl,
        initialBalanceForeign: isIntl ? parsedInitialForeign : undefined,
        color: accColor,
        includeInTotal: isIntl ? false : accIncludeInTotal,
      });
    }

    setShowAccountForm(false);
    setEditingAccount(null);
  };

  const getAccountTypeLabel = (type: AccountType, currency?: CurrencyCode) => {
    switch (type) {
      case 'international':
        return `Conta Internacional (${currency && currency !== 'BRL' ? currency : 'Global'})`;
      case 'checking':
        return 'Conta Corrente';
      case 'savings':
        return 'Poupança';
      case 'investment':
        return 'Reserva / Investimento';
      case 'cash':
        return 'Dinheiro em Espécie';
      default:
        return 'Conta';
    }
  };

  const getMethodLabel = (method: Transaction['paymentMethod']) => {
    switch (method) {
      case 'pix':
        return 'PIX';
      case 'debit_card':
        return 'Cartão Débito';
      case 'boleto':
        return 'Boleto / Déb. Auto';
      case 'cash':
        return 'Espécie';
      case 'transfer':
        return 'TED / Transferência';
      default:
        return method;
    }
  };

  const isAccountDetailOpen = Boolean(
    activeViewAccountId &&
      activeAccount &&
      statementSummary &&
      accounts.some((a) => a.id === activeViewAccountId)
  );

  return (
    <div className="space-y-6 min-w-0 max-w-full" data-testid="accounts-tab-view">
      {/* VIEW 1: ACCOUNTS OVERVIEW LIST (Shown when no specific account page is opened) */}
      {!isAccountDetailOpen && (
        <>
          {/* Row 1: Consolidated Cash & Patrimony KPI Strip */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
                <span className="truncate">Saldo no Giro (Caixa)</span>
                <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 truncate">
                {formatBRL(globalTotals.giroCurrent)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums truncate">
                Proj. fim do mês: {formatBRL(globalTotals.giroProjected)}
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
                <span className="truncate">Patrimônio Contas</span>
                <Landmark className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 truncate">
                {formatBRL(globalTotals.totalPatrimony)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 truncate">
                {accounts.length} conta(s) ativa(s)
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
                <span className="truncate">Contas no Giro Mensal</span>
                <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 truncate">
                {accounts.filter((a) => a.includeInTotal).length} de {accounts.length}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 truncate">
                Compõem o caixa principal
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
                <span className="truncate">Reservas Fora do Giro</span>
                <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-600 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-sky-700 truncate">
                {formatBRL(Math.max(0, globalTotals.totalPatrimony - globalTotals.giroCurrent))}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 truncate">
                Protegido fora do caixa diário
              </p>
            </div>
          </section>

          {/* Row 2: Interactive Bank Account & Wallet Cards Grid */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Suas Contas Bancárias, Contas Internacionais (Wise / Nomad) e Carteiras
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clique em qualquer conta abaixo para entrar na página exclusiva da conta. Suas contas internacionais (EUR, USD, GBP...) são independentes e não precisam ficar vinculadas a uma viagem.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenNewTransaction('transfer')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 text-slate-600" />
                  <span>Transferir entre Contas</span>
                </button>
                <button
                  type="button"
                  data-testid="open-new-intl-account-btn"
                  onClick={() => openNewAccountForm('international')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100 transition-colors"
                >
                  <Globe className="h-3.5 w-3.5 text-sky-700" />
                  <span>+ Conta Internacional (Wise / Nomad)</span>
                </button>
                {onOpenReconciliation && (
                  <button
                    type="button"
                    onClick={() => onOpenReconciliation()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition-colors"
                  >
                    <FileCheck2 className="h-3.5 w-3.5 text-emerald-700" />
                    <span>Importar Extrato / OFX</span>
                  </button>
                )}
                <button
                  type="button"
                  data-testid="open-new-account-btn"
                  onClick={() => openNewAccountForm('checking')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Nova Conta / Carteira</span>
                </button>
              </div>
            </div>

            {/* Create / Edit Account Modal Form */}
            {showAccountForm && (
              <form
                onSubmit={handleSaveAccountForm}
                data-testid="account-create-edit-form"
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-4 animate-expand-in"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    {accType === 'international' ? (
                      <Globe className="h-4 w-4 text-sky-600" />
                    ) : (
                      <Building2 className="h-4 w-4 text-emerald-600" />
                    )}
                    <h3 className="text-sm font-bold text-slate-900">
                      {editingAccount
                        ? `Editar Conta — ${editingAccount.name}`
                        : accType === 'international'
                        ? 'Cadastrar Conta Internacional / Global (Wise, Nomad, Avenue, C6 Global)'
                        : 'Cadastrar Nova Conta ou Carteira'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAccountForm(false)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {formError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                    {formError}
                  </div>
                )}

                {accType === 'international' && (
                  <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-sky-900">
                        Modelos Rápidos de Conta Internacional (1 clique):
                      </span>
                      <span className="text-[11px] font-semibold text-sky-700">
                        Conta independente em moeda estrangeira ({accCurrency})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {INTL_ACCOUNT_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setAccName(preset.name);
                            setAccInstitution(preset.institution);
                            setAccCurrency(preset.currency);
                            setAccColor(preset.color);
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                            accName === preset.name && accCurrency === preset.currency
                              ? 'border-sky-600 bg-sky-600 text-white shadow-2xs'
                              : 'border-sky-200 bg-white text-sky-900 hover:bg-sky-100'
                          }`}
                        >
                          <span>{CURRENCY_CATALOG[preset.currency].flag}</span>
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Modalidade da Conta
                    </label>
                    <select
                      data-testid="account-form-type-select"
                      value={accType}
                      onChange={(e) => {
                        const nextType = e.target.value as AccountType;
                        setAccType(nextType);
                        if (nextType === 'international') {
                          setAccIncludeInTotal(false);
                          if (!accName.trim()) {
                            setAccName('Wise Conta Global Euro');
                            setAccInstitution('Wise');
                          }
                        } else {
                          setAccIncludeInTotal(true);
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                    >
                      <option value="checking">Conta Corrente / Digital (R$)</option>
                      <option value="international">
                        🌎 Conta Internacional / Global (Wise, Nomad, Avenue, C6)
                      </option>
                      <option value="cash">Carteira Física (Dinheiro R$)</option>
                      <option value="savings">Conta Poupança (R$)</option>
                      <option value="investment">Reserva / Investimento (CDB, Tesouro)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome da Conta / Carteira
                    </label>
                    <input
                      type="text"
                      data-testid="account-form-name-input"
                      value={accName}
                      onChange={(e) => setAccName(e.target.value)}
                      placeholder={
                        accType === 'international'
                          ? 'Ex: Wise Conta Global Euro, Nomad USD'
                          : 'Ex: Itaú Unibanco, Carteira Física'
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Instituição Financeira
                    </label>
                    <input
                      type="text"
                      value={accInstitution}
                      onChange={(e) => setAccInstitution(e.target.value)}
                      placeholder={
                        accType === 'international'
                          ? 'Ex: Wise, Nomad, Avenue, C6 Global'
                          : 'Ex: Itaú, Nubank, Caixa, Dinheiro'
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  {accType === 'international' ? (
                    <div>
                      <label className="block text-xs font-semibold text-sky-900 mb-1">
                        Moeda Oficial da Conta Internacional
                      </label>
                      <select
                        data-testid="account-form-currency-select"
                        value={accCurrency}
                        onChange={(e) => {
                          const nextCurr = e.target.value as CurrencyCode;
                          setAccCurrency(nextCurr);
                        }}
                        className="w-full rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-950"
                      >
                        {FOREIGN_CURRENCY_OPTIONS.map((code) => (
                          <option key={code} value={code}>
                            {CURRENCY_CATALOG[code].flag} {code} — {CURRENCY_CATALOG[code].name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Saldo Inicial de Implantação (R$)
                      </label>
                      <input
                        type="text"
                        value={accInitialStr}
                        onChange={(e) => setAccInitialStr(e.target.value)}
                        placeholder="0,00"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                      />
                    </div>
                  )}
                </div>

                {accType === 'international' && (
                  <div className="rounded-xl border border-sky-200/80 bg-white p-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Saldo Inicial na Moeda ({CURRENCY_CATALOG[accCurrency].symbol} {accCurrency})
                      </label>
                      <input
                        type="text"
                        data-testid="account-form-initial-foreign-input"
                        value={accInitialForeignStr}
                        onChange={(e) => setAccInitialForeignStr(e.target.value)}
                        placeholder="0,00"
                        className="w-full sm:max-w-xs rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold tabular-nums text-slate-900"
                      />
                      <span className="block text-[10px] text-slate-500 mt-1">
                        Sua conta internacional em {accCurrency} funciona de forma independente (igual na vida real) e pode ser usada em compras internacionais ou em viagens nessa moeda.
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-700 mr-1">Cor:</span>
                      {ACCOUNT_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setAccColor(c.hex)}
                          title={c.name}
                          className={`h-6 w-6 rounded-full transition-transform ${
                            accColor === c.hex
                              ? 'ring-2 ring-slate-900 ring-offset-2 scale-110'
                              : 'opacity-80 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </div>

                    {accType !== 'international' ? (
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={accIncludeInTotal}
                          onChange={(e) => setAccIncludeInTotal(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                        />
                        <span>Incluir no Saldo de Giro Mensal (Caixa Principal em R$)</span>
                      </label>
                    ) : (
                      <span className="text-[11px] font-semibold text-sky-800 bg-sky-100/80 px-2.5 py-1 rounded-md">
                        🔒 Conta em {accCurrency}: isolada do giro doméstico em R$
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setShowAccountForm(false)}
                      className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      data-testid="save-account-form-btn"
                      className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      {editingAccount ? 'Salvar Alterações' : 'Criar Conta'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {accounts.length === 0 ? (
              <div
                data-testid="accounts-empty-state"
                className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center space-y-3"
              >
                <Wallet className="mx-auto h-9 w-9 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Nenhuma conta cadastrada ainda
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Sem dados fictícios (mock): cadastre apenas as suas contas reais (Itaú, Nubank, Inter, Caixa) ou contas internacionais (Wise, Nomad, Avenue, C6 Global).
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openNewAccountForm('checking')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Cadastrar Conta Nacional (R$)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openNewAccountForm('international')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100"
                  >
                    <Globe className="h-3.5 w-3.5 text-sky-700" />
                    <span>Cadastrar Conta Internacional (Wise / Nomad)</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Clean Grid of Account Cards — Click any card to enter its dedicated page */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((acc) => {
                  const bal = accountBalances.find((b) => b.accountId === acc.id);
                  const current = bal?.currentBalance ?? acc.initialBalance;
                  const projected = bal?.projectedBalance ?? acc.initialBalance;
                  const isIntl = acc.type === 'international';
                  const intlMetrics = isIntl
                    ? getInternationalAccountForeignMetrics(acc)
                    : null;

                  return (
                    <div
                      key={acc.id}
                      data-testid={`account-card-${acc.id}`}
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        setActiveViewAccountId(acc.id);
                        setIsAdjustingInitial(false);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedAccountId(acc.id);
                          setActiveViewAccountId(acc.id);
                        }
                      }}
                      className={`group rounded-2xl border p-5 text-left transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                        isIntl
                          ? 'border-sky-200 bg-gradient-to-br from-white to-sky-50/40 hover:border-sky-500 hover:shadow-md'
                          : 'border-slate-200 bg-white hover:border-emerald-500 hover:shadow-md'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-2xs"
                              style={{ backgroundColor: acc.color || '#059669' }}
                            >
                              {isIntl ? (
                                <Globe className="h-4.5 w-4.5" />
                              ) : (
                                <Building2 className="h-4.5 w-4.5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-bold text-slate-900 block truncate group-hover:text-emerald-700 transition-colors">
                                  {acc.name}
                                </span>
                                {isIntl && intlMetrics && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-extrabold text-sky-900 border border-sky-200">
                                    {CURRENCY_CATALOG[intlMetrics.currency].flag}{' '}
                                    {intlMetrics.currency}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 truncate">
                                {acc.institution} · {getAccountTypeLabel(acc.type, acc.currency)}
                              </p>
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => openEditAccountForm(acc)}
                              aria-label={`Editar conta ${acc.name}`}
                              title="Editar conta"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            {onDeleteAccount && (
                              <button
                                type="button"
                                onClick={() => {
                                  const confirmed = window.confirm(
                                    `Excluir a conta "${acc.name}"? Os lançamentos serão transferidos para outra conta cadastrada quando possível. Esta ação não pode ser desfeita.`
                                  );
                                  if (confirmed) onDeleteAccount(acc.id);
                                }}
                                aria-label={`Excluir conta ${acc.name}`}
                                title="Excluir conta"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {isIntl && intlMetrics ? (
                          <div>
                            <p className="text-[11px] font-medium text-sky-800">
                              Saldo na Moeda ({intlMetrics.currency})
                            </p>
                            <p className="text-xl font-extrabold font-mono tabular-nums text-slate-900">
                              {formatForeignCurrency(
                                intlMetrics.currentForeignBalance,
                                intlMetrics.currency
                              )}
                            </p>
                            <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                              Equiv. câmbio médio: {formatBRL(intlMetrics.estimatedBrlValue)}
                            </p>
                          </div>
                        ) : (
                          <>
                            <div>
                              <p className="text-[11px] font-medium text-slate-500">
                                Saldo Atual em Conta
                              </p>
                              <p
                                className={`text-xl font-extrabold font-mono tabular-nums ${
                                  current >= 0 ? 'text-slate-900' : 'text-rose-700'
                                }`}
                              >
                                {formatBRL(current)}
                              </p>
                            </div>

                            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                              <span className="font-mono tabular-nums text-slate-500">
                                Previsto mês: {formatBRL(projected)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleAccountInTotal(acc.id);
                                }}
                                className={`font-semibold underline ${
                                  acc.includeInTotal ? 'text-emerald-700' : 'text-slate-400'
                                }`}
                              >
                                {acc.includeInTotal ? 'No giro' : 'Reserva'}
                              </button>
                            </div>
                          </>
                        )}

                        <div className="pt-2 flex items-center justify-between text-xs font-bold text-emerald-700 group-hover:text-emerald-800">
                          <span>Abrir página e extrato da conta</span>
                          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* VIEW 2: DEDICATED ACCOUNT PAGE WITH FULL BANK STATEMENT */}
      {isAccountDetailOpen && activeAccount && statementSummary && (
        <div className="space-y-5 animate-expand-in" data-testid="account-dedicated-page">
          {/* Top Navigation Bar: Back to All Accounts + Quick Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
            <button
              type="button"
              data-testid="back-to-accounts-list-btn"
              onClick={() => setActiveViewAccountId(null)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar para Todas as Contas ({accounts.length})</span>
            </button>

            {accounts.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-medium text-slate-400 mr-1 hidden sm:inline">
                  Alternar conta:
                </span>
                {accounts.map((acc) => {
                  const isCurrent = acc.id === activeAccount.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        setActiveViewAccountId(acc.id);
                        setIsAdjustingInitial(false);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                        isCurrent
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: isCurrent ? '#ffffff' : acc.color || '#059669' }}
                      />
                      <span>{acc.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {activeAccount && activeAccount.type === 'international' && (() => {
            const intlMetrics = getInternationalAccountForeignMetrics(activeAccount);
            return (
              <div
                data-testid="intl-account-dedicated-banner"
                className="rounded-xl border border-sky-200 bg-sky-50/90 p-4 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {CURRENCY_CATALOG[intlMetrics.currency].flag}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-sky-900">
                        Conta Internacional em {intlMetrics.currency} ({activeAccount.institution})
                      </span>
                    </div>
                    <p className="text-xs text-sky-800 mt-0.5">
                      Saldo em Moeda Estrangeira:{' '}
                      <strong className="font-mono">
                        {formatForeignCurrency(
                          intlMetrics.currentForeignBalance,
                          intlMetrics.currency
                        )}
                      </strong>{' '}
                      · Lotes de câmbio creditados:{' '}
                      <strong className="font-mono">
                        +{formatForeignCurrency(intlMetrics.purchasedLotsForeign, intlMetrics.currency)}
                      </strong>{' '}
                      · Gastos realizados:{' '}
                      <strong className="font-mono">
                        -{formatForeignCurrency(intlMetrics.spentForeign, intlMetrics.currency)}
                      </strong>
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Account-Specific KPI Strip */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
                <span className="truncate">Saldo Atual ({activeAccount.name})</span>
                <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 truncate">
                {activeAccount.type === 'international'
                  ? formatForeignCurrency(
                      getInternationalAccountForeignMetrics(activeAccount).currentForeignBalance,
                      getInternationalAccountForeignMetrics(activeAccount).currency
                    )
                  : formatBRL(statementSummary.closingRealizedBalance)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums truncate">
                {activeAccount.type === 'international'
                  ? `Equiv. R$: ${formatBRL(
                      getInternationalAccountForeignMetrics(activeAccount).estimatedBrlValue
                    )}`
                  : `Abertura 01/${selectedMonth.slice(5, 7)}: ${formatBRL(
                      statementSummary.openingBalance
                    )}`}
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
                <span className="truncate">Previsto Fim do Mês</span>
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 truncate">
                {formatBRL(statementSummary.closingProjectedBalance)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 truncate">
                {activeAccount.includeInTotal ? 'Incluída no giro mensal' : 'Conta Reserva'}
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
                <span className="truncate">Entradas no Mês</span>
                <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 truncate">
                +{formatBRL(statementSummary.monthCreditsRealized)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 truncate">
                Créditos efetivados na conta
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
                <span className="truncate">Saídas no Mês</span>
                <ArrowDownRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-600 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-rose-700 truncate">
                -{formatBRL(statementSummary.monthDebitsRealized)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums truncate">
                Pend. na conta: {formatBRL(statementSummary.monthPendingNet)}
              </p>
            </div>
          </section>

          {/* Real Bank Statement (Extrato Bancário Completo com Saldo Progressivo) */}
          <section
            data-testid="real-bank-statement-section"
            className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs"
          >
            {/* Bank Statement Top Header */}
            <div className="border-b border-slate-200 bg-slate-50/70 px-4 sm:px-6 py-4 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white font-bold shadow-2xs"
                    style={{ backgroundColor: activeAccount.color || '#059669' }}
                  >
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        Extrato Bancário — {activeAccount.name}
                      </h2>
                      <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {getAccountTypeLabel(activeAccount.type)}
                      </span>
                    </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Competência {formatMonthYearPT(selectedMonth)} · Saldo calculado linha a linha como no extrato do seu banco
                </p>
              </div>
            </div>

            {/* Quick Account Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {onOpenReconciliation && (
                <button
                  type="button"
                  onClick={() => onOpenReconciliation(activeAccount.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
                >
                  <FileCheck2 className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Importar OFX Nesta Conta</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsAdjustingInitial((prev) => !prev);
                  setQuickInitialStr(
                    activeAccount.initialBalance.toFixed(2).replace('.', ',')
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                <span>Ajustar Saldo Inicial</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenNewTransaction('income')}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Receita</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenNewTransaction('expense')}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Despesa</span>
              </button>
            </div>
          </div>

          {/* Inline Initial Balance Reconciler */}
          {isAdjustingInitial && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex flex-wrap items-center justify-between gap-3 animate-expand-in">
              <div className="text-xs text-emerald-950">
                <strong>Conciliação de Saldo Inicial ({activeAccount.name}):</strong> Ajuste o saldo base de implantação para que o saldo atual bata exatamente com o aplicativo do seu banco.
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs font-mono font-bold text-slate-700">R$</span>
                <input
                  type="text"
                  value={quickInitialStr}
                  onChange={(e) => setQuickInitialStr(e.target.value)}
                  className="w-32 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-mono tabular-nums text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    onUpdateAccountInitialBalance(
                      activeAccount.id,
                      parseBRLInput(quickInitialStr)
                    );
                    setIsAdjustingInitial(false);
                  }}
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Salvar Saldo
                </button>
              </div>
            </div>
          )}

          {/* Filter & Search Bar inside Account Statement */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pt-1">
            <div className="flex overflow-x-auto no-scrollbar items-center gap-1 rounded-lg bg-slate-200/70 p-1 max-w-full">
              {[
                { id: 'all', label: 'Tudo' },
                { id: 'credit', label: 'Entradas (+)' },
                { id: 'debit', label: 'Saídas (-)' },
                { id: 'transfer', label: 'Transferências (⇄)' },
                { id: 'pending', label: 'Pendentes' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatementFilter(tab.id as any)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    statementFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar histórico desta conta..."
                  className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <select
                aria-label="Ordenação do extrato bancário"
                value={statementOrder}
                onChange={(e) =>
                  setStatementOrder(e.target.value as 'chronological' | 'newest')
                }
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
              >
                <option value="chronological">Ordem Bancária (01 → 31)</option>
                <option value="newest">Mais Recentes Primeiro</option>
              </select>
            </div>
          </div>
        </div>

        {/* Opening Balance Banner Row (Saldo Anterior em 01/MM) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/70 px-4 sm:px-6 py-2.5 text-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-700">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span>
              Saldo Anterior / Abertura do Mês (01/{selectedMonth.slice(5, 7)}/
              {selectedMonth.slice(0, 4)})
            </span>
          </div>
          <span
            data-testid="statement-opening-balance"
            className={`font-mono tabular-nums font-bold ${
              statementSummary.openingBalance >= 0 ? 'text-slate-900' : 'text-rose-700'
            }`}
          >
            {formatBRL(statementSummary.openingBalance)}
          </span>
        </div>

        {/* Statement Entries */}
        {filteredStatementEntries.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-slate-900">
              Nenhuma movimentação encontrada nesta conta para o filtro selecionado.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Registre um pagamento, depósito PIX ou transferência entre contas para movimentar o extrato.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Statement Cards (< sm) */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {filteredStatementEntries.map((entry) => {
                const tx = entry.transaction;
                const cat = catMap.get(tx.categoryId);
                const counterpartyName = entry.isTransferIncoming
                  ? accMap.get(tx.accountId || '')?.name || 'Outra Conta'
                  : entry.isTransferOutgoing
                  ? accMap.get(tx.destinationAccountId || '')?.name || 'Outra Conta'
                  : null;

                return (
                  <div key={tx.id} className="p-4 space-y-2 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CategoryIconBadge
                          icon={cat?.icon}
                          color={cat?.color}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {tx.description}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            <span className="font-mono tabular-nums">
                              {formatShortDateBR(tx.date)}
                            </span>
                            <span aria-hidden="true"> · </span>
                            <span>
                              {entry.isTransferIncoming
                                ? `Recebido de ${counterpartyName}`
                                : entry.isTransferOutgoing
                                ? `Enviado p/ ${counterpartyName}`
                                : cat?.name || 'Geral'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p
                          className={`text-xs font-extrabold font-mono tabular-nums ${
                            entry.direction === 'credit'
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {entry.direction === 'credit' ? '+' : '-'}
                          {formatBRL(tx.amount)}
                        </p>
                        <p className="text-[10px] font-mono tabular-nums text-slate-500">
                          Saldo: {formatBRL(entry.runningBalanceAfter)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px]">
                      <button
                        type="button"
                        onClick={() => onToggleTransactionStatus(tx.id)}
                        className={`font-semibold ${
                          tx.status === 'paid'
                            ? 'text-emerald-700'
                            : 'text-amber-700 underline'
                        }`}
                      >
                        {tx.status === 'paid' ? '✓ Compensado no Saldo' : '⏳ Pendente (Efetivar)'}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEditTransaction(tx)}
                          className="text-slate-500 hover:text-slate-900 font-medium"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTransaction(tx.id)}
                          className="text-rose-600 hover:text-rose-800 font-medium"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Real Bank Statement Table (>= sm) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-500">
                    <th className="py-3 pl-6 pr-3 whitespace-nowrap">Data</th>
                    <th className="py-3 px-3">Histórico / Lançamento</th>
                    <th className="py-3 px-3 whitespace-nowrap">Meio</th>
                    <th className="py-3 px-3 whitespace-nowrap">Compensação</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Movimento (R$)</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">
                      Saldo Após Lançamento
                    </th>
                    <th className="py-3 pl-3 pr-6 text-right whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredStatementEntries.map((entry) => {
                    const tx = entry.transaction;
                    const cat = catMap.get(tx.categoryId);
                    const subName = cat?.subcategories?.find(
                      (s) => s.id === tx.subcategoryId
                    )?.name;
                    const counterpartyName = entry.isTransferIncoming
                      ? accMap.get(tx.accountId || '')?.name || 'Outra Conta'
                      : entry.isTransferOutgoing
                      ? accMap.get(tx.destinationAccountId || '')?.name || 'Outra Conta'
                      : null;

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/90 transition-colors">
                        <td className="py-3 pl-6 pr-3 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                          {formatShortDateBR(tx.date)}
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <CategoryIconBadge
                              icon={cat?.icon}
                              color={cat?.color}
                              size="sm"
                            />
                            <div>
                              <p className="font-semibold text-slate-900">{tx.description}</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {entry.isTransferIncoming ? (
                                  <span className="font-medium text-emerald-700">
                                    Transferência recebida de {counterpartyName}
                                  </span>
                                ) : entry.isTransferOutgoing ? (
                                  <span className="font-medium text-slate-700">
                                    Transferência enviada para {counterpartyName}
                                  </span>
                                ) : (
                                  <span>
                                    {cat?.name || 'Geral'}
                                    {subName ? ` › ${subName}` : ''}
                                  </span>
                                )}
                                {tx.notes && (
                                  <>
                                    <span aria-hidden="true"> · </span>
                                    <span className="italic">{tx.notes}</span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
                          {getMethodLabel(tx.paymentMethod)}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onToggleTransactionStatus(tx.id)}
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              tx.status === 'paid'
                                ? 'text-emerald-700 hover:text-emerald-900'
                                : 'text-amber-700 underline hover:text-amber-900'
                            }`}
                          >
                            {tx.status === 'paid' ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Compensado</span>
                              </>
                            ) : (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                <span>Previsto (Efetivar)</span>
                              </>
                            )}
                          </button>
                        </td>

                        <td
                          className={`py-3 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                            entry.direction === 'credit'
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {entry.direction === 'credit' ? '+' : '-'}
                          {formatBRL(tx.amount)}
                        </td>

                        <td
                          data-testid="statement-running-balance-cell"
                          className={`py-3 px-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                            entry.runningBalanceAfter >= 0
                              ? 'text-slate-900'
                              : 'text-rose-700'
                          }`}
                        >
                          {formatBRL(entry.runningBalanceAfter)}
                        </td>

                        <td className="py-3 pl-3 pr-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            {onDuplicateTransaction && (
                              <button
                                type="button"
                                onClick={() => onDuplicateTransaction(tx)}
                                title="Duplicar lançamento"
                                className="rounded p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-900"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onEditTransaction(tx)}
                              title="Editar lançamento"
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-900"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onDeleteTransaction(tx.id, Boolean(tx.installmentGroupId))
                              }
                              title="Excluir lançamento"
                              className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Closing Balance Footer Row */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-600 font-mono tabular-nums">
            Saldo Realizado Atual ({activeAccount.name}):{' '}
            <strong
              className={
                statementSummary.closingRealizedBalance >= 0
                  ? 'text-emerald-700 font-bold'
                  : 'text-rose-700 font-bold'
              }
            >
              {formatBRL(statementSummary.closingRealizedBalance)}
            </strong>
          </div>
          <div className="text-slate-700 font-mono tabular-nums">
            Saldo Projetado Fim de {formatMonthYearPT(selectedMonth)}:{' '}
            <strong
              className={
                statementSummary.closingProjectedBalance >= 0
                  ? 'text-slate-900 font-bold'
                  : 'text-rose-700 font-bold'
              }
            >
              {formatBRL(statementSummary.closingProjectedBalance)}
            </strong>
          </div>
        </div>
      </section>
      </div>
      )}
    </div>
  );
};
