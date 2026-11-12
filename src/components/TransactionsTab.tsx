import { confirmTransactionDeletion } from '../utils/transactionDeletion';
import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  Copy,
  Edit3,
  FastForward,
  FileCheck2,
  List,
  Plus,
  RotateCcw,
  Search,
  Tag,
  Trash2,
} from 'lucide-react';
import {
  BankAccount,
  Category,
  CreditCard,
  Transaction,
} from '../types/finance';
import {
  extractAvailableTransactionTags,
  formatBRL,
  formatShortDateBR,
  getEffectiveExpenseAmountForUser,
  getLedgerTransactionsForMonth,
  normalizeSearchText,
} from '../utils/financeRules';
import { groupTransactionsByDate } from '../utils/uxEnhancementRules';
import { CategoryIconBadge } from './CategoryIconBadge';
import { CardNetworkMark } from './CardNetworkMark';
import { InstitutionMark } from './InstitutionMark';
import { MonthlyCalendarView } from './MonthlyCalendarView';
import { SwipeableTransactionCard } from './SwipeableTransactionCard';
import { TransactionActionSheet } from './TransactionActionSheet';

interface TransactionsTabProps {
  selectedMonth: string;
  transactions: Transaction[];
  accounts: BankAccount[];
  cards: CreditCard[];
  categories: Category[];
  globalSearchQuery?: string;
  onChangeGlobalSearchQuery?: (q: string) => void;
  requestedViewMode?: 'calendar' | 'table' | null;
  onConsumeRequestedViewMode?: () => void;
  onToggleStatus: (txId: string) => void;
  onBatchSettleTransactions?: (txIds: string[]) => void | Promise<void>;
  onAnticipateInstallments?: (
    installmentGroupId: string,
    discountAmount: number,
    maxCountToAdvance?: number
  ) => void;
  onReverseAnticipation?: (targetIdOrGroupId: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDuplicateTransaction?: (tx: Transaction) => void;
  onDeleteTransaction: (txId: string, deleteGroup?: boolean) => void;
  onOpenNewTransaction: (
    mode: 'expense' | 'income' | 'credit_card' | 'transfer',
    initialDate?: string
  ) => void;
  onOpenReconciliation?: () => void;
}

export const TransactionsTab: React.FC<TransactionsTabProps> = ({
  selectedMonth,
  transactions,
  accounts,
  cards,
  categories,
  globalSearchQuery = '',
  onChangeGlobalSearchQuery,
  requestedViewMode,
  onConsumeRequestedViewMode,
  onToggleStatus,
  onBatchSettleTransactions,
  onAnticipateInstallments,
  onReverseAnticipation,
  onEditTransaction,
  onDuplicateTransaction,
  onDeleteTransaction,
  onOpenNewTransaction,
  onOpenReconciliation,
}) => {
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'table' : 'calendar'
  );
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income' | 'credit_card' | 'transfer'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [actionSheetTx, setActionSheetTx] = useState<Transaction | null>(null);
  const [isReconcileMode, setIsReconcileMode] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);

  React.useEffect(() => {
    if (requestedViewMode) {
      setViewMode(requestedViewMode);
      onConsumeRequestedViewMode?.();
    }
  }, [requestedViewMode, onConsumeRequestedViewMode]);

  const effectiveSearchQuery =
    onChangeGlobalSearchQuery !== undefined ? globalSearchQuery : localSearchQuery;

  const handleSearchInputChange = (val: string) => {
    if (onChangeGlobalSearchQuery) {
      onChangeGlobalSearchQuery(val);
    } else {
      setLocalSearchQuery(val);
    }
  };

  const requestTransactionDeletion = (txId: string, deleteGroup = false) => {
    const transaction = transactions.find((tx) => tx.id === txId);
    if (!transaction) return;

    if (confirmTransactionDeletion(transaction, deleteGroup)) {
      onDeleteTransaction(txId, deleteGroup);
    }
  };

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c.name])), [cards]);
  const selectedSourceAccount = accounts.find((account) => account.id === sourceFilter) ?? null;
  const selectedSourceCard = cards.find((card) => card.id === sourceFilter) ?? null;
  const getTransactionOriginMarks = (transaction: Transaction) => {
    const sourceAccount = transaction.creditCardId
      ? null
      : accounts.find((account) => account.id === transaction.accountId) ?? null;
    const sourceCard = transaction.creditCardId
      ? cards.find((card) => card.id === transaction.creditCardId) ?? null
      : null;
    const destinationAccount = transaction.type === 'transfer'
      ? accounts.find((account) => account.id === transaction.destinationAccountId) ?? null
      : null;

    return (
      <span className="inline-flex items-center gap-1">
        {sourceCard ? (
          <CardNetworkMark brand={sourceCard.brand} compact />
        ) : sourceAccount ? (
          <InstitutionMark
            institution={sourceAccount.institution}
            accountName={sourceAccount.name}
            color={sourceAccount.color}
            size="xs"
          />
        ) : null}
        {destinationAccount && (
          <>
            <span aria-hidden="true">→</span>
            <InstitutionMark
              institution={destinationAccount.institution}
              accountName={destinationAccount.name}
              color={destinationAccount.color}
              size="xs"
            />
          </>
        )}
      </span>
    );
  };

  const groupsWithFutureInstallments = useMemo(() => {
    const set = new Set<string>();
    for (const tx of transactions) {
      if (
        tx.installmentGroupId &&
        tx.competenceMonth > selectedMonth &&
        tx.status === 'pending'
      ) {
        set.add(tx.installmentGroupId);
      }
    }
    return set;
  }, [transactions, selectedMonth]);

  const usedTagsInLedger = useMemo(
    () => extractAvailableTransactionTags(transactions, false),
    [transactions]
  );

  const monthTransactions = useMemo(() => {
    const normalizedQuery = normalizeSearchText(effectiveSearchQuery).replace(/#/g, '');
    const tokens = normalizedQuery ? normalizedQuery.split(/\s+/).filter(Boolean) : [];

    return getLedgerTransactionsForMonth(transactions, selectedMonth)
      .filter((tx) => {
        if (typeFilter === 'expense') return tx.type === 'expense' && !tx.creditCardId;
        if (typeFilter === 'credit_card') return Boolean(tx.creditCardId);
        if (typeFilter === 'income') return tx.type === 'income';
        if (typeFilter === 'transfer') return tx.type === 'transfer';
        return true;
      })
      .filter((tx) => {
        if (statusFilter === 'all') return true;
        return tx.status === statusFilter;
      })
      .filter((tx) => {
        if (categoryFilter === 'all') return true;
        return tx.categoryId === categoryFilter;
      })
      .filter((tx) => {
        if (sourceFilter === 'all') return true;
        return tx.accountId === sourceFilter || tx.creditCardId === sourceFilter;
      })
      .filter((tx) => {
        if (tagFilter === 'all') return true;
        const normTarget = normalizeSearchText(tagFilter);
        return (tx.tags || []).some((t) => normalizeSearchText(t) === normTarget);
      })
      .filter((tx) => {
        if (tokens.length === 0) return true;
        const cat = catMap.get(tx.categoryId);
        const catName = cat?.name || '';
        const subName =
          cat?.subcategories?.find((s) => s.id === tx.subcategoryId)?.name || '';
        const searchable = normalizeSearchText(
          `${tx.description} ${catName} ${subName} ${tx.notes || ''} ${(tx.tags || []).join(' ')}`
        );
        return tokens.every((tk) => searchable.includes(tk));
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [
    transactions,
    selectedMonth,
    typeFilter,
    statusFilter,
    categoryFilter,
    sourceFilter,
    tagFilter,
    effectiveSearchQuery,
    catMap,
  ]);

  const dailyGroups = useMemo(
    () => groupTransactionsByDate(monthTransactions, `${selectedMonth}-15`),
    [monthTransactions, selectedMonth]
  );

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let pendingAmount = 0;
    let pendingCount = 0;
    for (const tx of monthTransactions) {
      if (tx.isInvoicePayment || tx.type === 'transfer' || tx.isCompanionOnlyExpense) continue;
      if (tx.type === 'income') {
        if (tx.sharedPaidBy === 'member') continue;
        income += tx.amount;
        if (tx.status === 'pending') {
          pendingAmount += tx.amount;
        }
      } else if (tx.type === 'expense') {
        const expenseForSummary = tx.creditCardId && tx.installmentPurchaseTotal !== undefined
          ? { ...tx, amount: tx.installmentPurchaseTotal }
          : tx;
        const eff = getEffectiveExpenseAmountForUser(expenseForSummary);
        if (!eff) continue;
        expense += eff.amount;
        if (eff.status === 'pending') {
          pendingAmount += eff.amount;
          pendingCount += 1;
        }
      }
    }
    return {
      income: Math.round(income * 100) / 100,
      expense: Math.round(expense * 100) / 100,
      net: Math.round((income - expense) * 100) / 100,
      pendingAmount: Math.round(pendingAmount * 100) / 100,
      pendingCount,
    };
  }, [monthTransactions]);

  const getMethodLabel = (method: Transaction['paymentMethod']) => {
    switch (method) {
      case 'pix':
        return 'PIX';
      case 'credit_card':
        return 'Cartão de Crédito';
      case 'debit_card':
        return 'Débito';
      case 'boleto':
        return 'Boleto';
      case 'cash':
        return 'Dinheiro';
      case 'transfer':
        return 'Transferência';
      default:
        return method;
    }
  };

  const toggleSelectTx = (txId: string) => {
    setSelectedTxIds((prev) =>
      prev.includes(txId) ? prev.filter((id) => id !== txId) : [...prev, txId]
    );
  };

  const handleSelectPendingInFilter = () => {
    const pendingIds = monthTransactions
      .filter(
        (tx) =>
          tx.status === 'pending' &&
          !tx.creditCardId &&
          !tx.isCompanionOnlyExpense &&
          tx.sharedPaidBy !== 'member'
      )
      .map((tx) => tx.id);
    setSelectedTxIds(pendingIds);
  };

  const selectedSummary = useMemo(() => {
    const idSet = new Set(selectedTxIds);
    let sum = 0;
    let pendingCount = 0;
    for (const tx of monthTransactions) {
      if (idSet.has(tx.id)) {
        sum = Math.round((sum + tx.amount) * 100) / 100;
        if (tx.status === 'pending') pendingCount += 1;
      }
    }
    return { count: selectedTxIds.length, sum, pendingCount };
  }, [monthTransactions, selectedTxIds]);

  const handleConfirmBatchSettle = async () => {
    if (selectedTxIds.length === 0) return;
    const idsToSettle = [...selectedTxIds];
    try {
      if (onBatchSettleTransactions) {
        await onBatchSettleTransactions(idsToSettle);
      } else {
        for (const id of idsToSettle) {
        const target = monthTransactions.find((t) => t.id === id);
        if (target && target.status === 'pending') {
            await onToggleStatus(id);
          }
        }
      }
      setSelectedTxIds((current) => current.filter((id) => !idsToSettle.includes(id)));
    } catch {
      // Keep the failed selection visible so the user can retry or inspect it.
    }
  };

  return (
    <div className="module-page space-y-6">
      {/* Top View Mode Switcher: Extrato em Lista vs. Calendário Mensal */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-4">
          <div className="w-full sm:w-auto grid grid-cols-2 sm:flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="h-4 w-4 text-emerald-600" />
              <span>Calendário</span>
              {totals.pendingCount > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  {totals.pendingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <List className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span>Extrato ({monthTransactions.length})</span>
            </button>
          </div>

          <div className="hidden sm:grid w-full min-w-0 grid-cols-2 2xl:flex 2xl:w-auto 2xl:flex-wrap items-center gap-2">
            {onOpenReconciliation && (
              <button
                type="button"
                onClick={onOpenReconciliation}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
              >
                <FileCheck2 className="h-3.5 w-3.5 text-emerald-700" />
                <span>Importar Extrato OFX</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenNewTransaction('expense')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Lançar Despesa
            </button>
            <button
              type="button"
              onClick={() => onOpenNewTransaction('credit_card')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              + Compra Parcelada
            </button>
            <button
              type="button"
              onClick={() => onOpenNewTransaction('income')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
            >
              + Receita
            </button>
          </div>
        </div>
      </section>

      {/* Render Selected View */}
      {viewMode === 'calendar' ? (
        <MonthlyCalendarView
          selectedMonth={selectedMonth}
          transactions={transactions}
          accounts={accounts}
          cards={cards}
          categories={categories}
          onToggleStatus={onToggleStatus}
          onEditTransaction={onEditTransaction}
          onDeleteTransaction={onDeleteTransaction}
          onOpenNewTransaction={onOpenNewTransaction}
        />
      ) : (
        <div className="space-y-6">
          {/* Filter & Search Toolbar */}
          <section className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 max-w-full">
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos os Lançamentos
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('expense')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === 'expense'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Despesas Conta
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('credit_card')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === 'credit_card'
                  ? 'bg-white text-violet-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Compras Cartão
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('income')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === 'income'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Receitas
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('transfer')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === 'transfer'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Transferências
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenNewTransaction('expense')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Lançar Despesa
            </button>
            <button
              type="button"
              onClick={() => onOpenNewTransaction('credit_card')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              + Compra Parcelada
            </button>
            <button
              type="button"
              onClick={() => onOpenNewTransaction('income')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
            >
              + Receita
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              aria-label="Buscar lançamento por descrição, categoria ou subcategoria"
              value={effectiveSearchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              placeholder="Buscar descrição, subcategoria ou nota..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <select
            aria-label="Filtrar por situação"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'paid' | 'pending')}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
          >
            <option value="all">Todas as Situações (Efetivados + Pendentes)</option>
            <option value="paid">Somente Efetivados (Pagos / Recebidos)</option>
            <option value="pending">Somente Pendentes (Previstos)</option>
          </select>

          <select
            aria-label="Filtrar por categoria"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
          >
            <option value="all">Todas as Categorias</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <div className="min-w-0">
            <select
              aria-label="Filtrar por conta ou cartão"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
            >
              <option value="all">Todas as Contas e Cartões</option>
              <optgroup label="Contas e Carteiras">
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    Conta: {acc.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Cartões de Crédito">
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    Cartão: {card.name}
                  </option>
                ))}
              </optgroup>
            </select>
            {(selectedSourceAccount || selectedSourceCard) && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                {selectedSourceAccount ? (
                  <InstitutionMark
                    institution={selectedSourceAccount.institution}
                    accountName={selectedSourceAccount.name}
                    color={selectedSourceAccount.color}
                    size="xs"
                  />
                ) : selectedSourceCard ? (
                  <CardNetworkMark brand={selectedSourceCard.brand} compact />
                ) : null}
                <span>{selectedSourceAccount?.name || selectedSourceCard?.name}</span>
              </div>
            )}
          </div>
        </div>

        {usedTagsInLedger.length > 0 && (
          <div
            data-testid="ledger-tag-filter-bar"
            className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100"
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 mr-1">
              <Tag className="h-3 w-3 text-emerald-600" />
              Filtrar por Tag:
            </span>
            <button
              type="button"
              onClick={() => setTagFilter('all')}
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                tagFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas
            </button>
            {usedTagsInLedger.map((tag) => (
              <button
                key={tag}
                type="button"
                data-testid={`ledger-filter-tag-${tag}`}
                onClick={() => setTagFilter(tagFilter === tag ? 'all' : tag)}
                className={`inline-flex items-center gap-0.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  tagFilter === tag
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <span className="font-mono">#</span>
                <span>{tag}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* High-Density Ledger Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-4 sm:px-6 py-3.5 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="font-medium text-slate-600">
              Exibindo{' '}
              <span className="font-bold font-mono tabular-nums text-slate-900">
                {monthTransactions.length}
              </span>{' '}
              lançamento(s)
            </div>

            <button
              type="button"
              data-testid="toggle-reconcile-mode"
              onClick={() => {
                const next = !isReconcileMode;
                setIsReconcileMode(next);
                if (!next) setSelectedTxIds([]);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                isReconcileMode
                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isReconcileMode ? 'Sair do Modo Conferência' : 'Modo Conferência em Lote'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums">
            <span className="text-emerald-700">
              Entradas: <strong>{formatBRL(totals.income)}</strong>
            </span>
            <span className="text-slate-300" aria-hidden="true">|</span>
            <span className="text-rose-700">
              Saídas: <strong>{formatBRL(totals.expense)}</strong>
            </span>
            <span className="text-slate-300" aria-hidden="true">|</span>
            <span className={totals.net >= 0 ? 'text-slate-900' : 'text-rose-700'}>
              Saldo Filtro: <strong>{formatBRL(totals.net)}</strong>
            </span>
          </div>
        </div>

        {/* Batch Reconciliation Action Bar (Modo Conferência) */}
        {isReconcileMode && (
          <div
            data-testid="batch-reconcile-bar"
            className="border-b border-emerald-200 bg-emerald-50/80 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 animate-expand-in"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-emerald-950">
                Conferência de Extrato:
              </span>
              <button
                type="button"
                onClick={handleSelectPendingInFilter}
                className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
              >
                Selecionar Pendentes
              </button>
              <button
                type="button"
                onClick={() => setSelectedTxIds(monthTransactions.map((t) => t.id))}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Todos ({monthTransactions.length})
              </button>
              {selectedTxIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTxIds([])}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 ml-auto">
              <div className="text-xs font-mono tabular-nums text-emerald-950">
                Selecionados: <strong>{selectedSummary.count}</strong> · Soma:{' '}
                <strong className="font-bold">{formatBRL(selectedSummary.sum)}</strong>
              </div>
              <button
                type="button"
                data-testid="batch-settle-btn"
                disabled={selectedSummary.count === 0}
                onClick={handleConfirmBatchSettle}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-2xs"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Efetivar Selecionados ({selectedSummary.count})</span>
              </button>
            </div>
          </div>
        )}

        {monthTransactions.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-semibold text-slate-900">
              Nenhum lançamento encontrado com os filtros aplicados.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Limpe os filtros ou registre uma nova movimentação manual no mês.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  handleSearchInputChange('');
                  setTypeFilter('all');
                  setStatusFilter('all');
                  setCategoryFilter('all');
                  setSourceFilter('all');
                  setTagFilter('all');
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Limpar Filtros
              </button>
              <button
                type="button"
                onClick={() => onOpenNewTransaction('expense')}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Novo Lançamento
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Mobile Native Card List Grouped by Date (< sm screens) */}
            <div className="block sm:hidden" data-testid="mobile-grouped-ledger">
              {/* Ergonomic Mobile Gestures Tip Bar */}
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-medium">
                  Deslize p/ os lados ou segure para ações
                </span>
                <span className="text-[10px] text-slate-400">
                  ← Menu | Efetivar →
                </span>
              </div>

              <div className="divide-y divide-slate-200">
                {dailyGroups.map((group) => (
                  <div key={group.date} data-testid={`daily-group-${group.date}`}>
                    {/* Daily Group Header with Subtotal */}
                    <div className="flex items-center justify-between gap-2 bg-slate-100/80 px-4 py-2 border-b border-slate-200/80">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800">
                          {group.dayHeaderLabel}
                        </span>
                        {group.weekdayLabel && (
                          <span className="text-[11px] text-slate-500 ml-1.5">
                            · {group.weekdayLabel}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums shrink-0">
                        <span className="text-slate-500 mr-1">Saldo do dia:</span>
                        <strong
                          className={
                            group.dayNet > 0
                              ? 'text-emerald-700 font-bold'
                              : group.dayNet < 0
                              ? 'text-rose-700 font-bold'
                              : 'text-slate-700 font-bold'
                          }
                        >
                          {group.dayNet > 0 ? '+' : ''}
                          {formatBRL(group.dayNet)}
                        </strong>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {group.transactions.map((tx) => {
                        const cat = catMap.get(tx.categoryId);
                        const originMarks = getTransactionOriginMarks(tx);
                        const originLabel = tx.creditCardId
                          ? `Cartão ${cardMap.get(tx.creditCardId) || ''}`
                          : tx.type === 'transfer'
                          ? `${accMap.get(tx.accountId || '') || 'Origem'} → ${
                              accMap.get(tx.destinationAccountId || '') || 'Destino'
                            }`
                          : accMap.get(tx.accountId || '') || 'Carteira';

                        const installmentMeta =
                          tx.installmentTotal && tx.installmentTotal > 1
                            ? `${tx.installmentNumber}/${tx.installmentTotal}`
                            : null;

                        return (
                          <div key={tx.id} className="flex items-stretch">
                            {isReconcileMode && (
                              <label className="flex items-center justify-center pl-3.5 pr-1 bg-white cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedTxIds.includes(tx.id)}
                                  onChange={() => toggleSelectTx(tx.id)}
                                  aria-label={`Selecionar ${tx.description} para conferência`}
                                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                              </label>
                            )}
                            <div className="flex-1 min-w-0">
                              <SwipeableTransactionCard
                                transaction={tx}
                                category={cat}
                                originLabel={originLabel}
                                originMarks={originMarks}
                                installmentMeta={installmentMeta}
                                onToggleStatus={onToggleStatus}
                                onEdit={onEditTransaction}
                                onDuplicate={onDuplicateTransaction}
                                onDelete={requestTransactionDeletion}
                                onOpenActionSheet={(targetTx) => setActionSheetTx(targetTx)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Table View (>= sm screens) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/40 text-xs font-semibold text-slate-500">
                    {isReconcileMode && (
                      <th className="py-3 pl-5 pr-2 w-10">
                        <input
                          type="checkbox"
                          aria-label="Selecionar todos os lançamentos visíveis"
                          checked={
                            monthTransactions.length > 0 &&
                            selectedTxIds.length === monthTransactions.length
                          }
                          onChange={(e) =>
                            setSelectedTxIds(
                              e.target.checked ? monthTransactions.map((t) => t.id) : []
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                    )}
                    <th className="py-3 pl-6 pr-3 whitespace-nowrap">Data</th>
                    <th className="py-3 px-3">Descrição, Categoria & Subcategoria</th>
                    <th className="py-3 px-3 whitespace-nowrap">Conta / Cartão</th>
                    <th className="py-3 px-3 whitespace-nowrap">Situação</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Valor (R$)</th>
                    <th className="py-3 pl-3 pr-6 text-right whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {monthTransactions.map((tx) => {
                    const cat = catMap.get(tx.categoryId);
                    const catName =
                      tx.type === 'transfer'
                        ? 'Transferência entre Contas'
                        : tx.isInvoicePayment
                        ? 'Pagamento de Fatura'
                        : cat?.name || 'Geral';
                    const subName = cat?.subcategories?.find(
                      (s) => s.id === tx.subcategoryId
                    )?.name;

                    const originLabel = tx.creditCardId
                      ? `Cartão ${cardMap.get(tx.creditCardId) || ''}`
                      : tx.type === 'transfer'
                      ? `${accMap.get(tx.accountId || '') || 'Origem'} → ${
                          accMap.get(tx.destinationAccountId || '') || 'Destino'
                        }`
                      : accMap.get(tx.accountId || '') || 'Carteira';
                    const originMarks = getTransactionOriginMarks(tx);

                    const installmentMeta =
                      tx.installmentTotal && tx.installmentTotal > 1
                        ? `Parcela ${tx.installmentNumber}/${tx.installmentTotal}`
                        : tx.recurrence === 'fixed'
                        ? 'Fixo Mensal'
                        : 'Único';

                    return (
                      <tr
                        key={tx.id}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setActionSheetTx(tx);
                        }}
                        title="Clique com botão direito para abrir menu de ações"
                        className={`hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors group cursor-context-menu ${
                          isReconcileMode && selectedTxIds.includes(tx.id)
                            ? 'bg-emerald-50/40'
                            : ''
                        }`}
                      >
                        {isReconcileMode && (
                          <td className="py-3 pl-5 pr-2">
                            <input
                              type="checkbox"
                              checked={selectedTxIds.includes(tx.id)}
                              onChange={() => toggleSelectTx(tx.id)}
                              aria-label={`Selecionar ${tx.description}`}
                              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                        )}
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
                              <div className="font-semibold text-slate-900 flex flex-wrap items-center gap-1.5">
                                <span>{tx.description}</span>
                                {tx.isInvoicePayment && (
                                  <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800 border border-violet-200">
                                    Pagamento de Fatura (Cascata)
                                  </span>
                                )}
                                {tx.isAnticipated && (
                                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                                    Antecipada
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span className="font-medium text-slate-700">
                                  {catName}
                                  {subName ? ` › ${subName}` : ''}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{getMethodLabel(tx.paymentMethod)}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">{installmentMeta}</span>
                                {tx.installmentPurchaseTotal !== undefined && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-medium text-violet-700">
                                      Compra total {formatBRL(tx.installmentPurchaseTotal)}
                                    </span>
                                  </>
                                )}
                                {tx.notes && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="italic text-slate-500">{tx.notes}</span>
                                  </>
                                )}
                              </div>
                              {tx.tags && tx.tags.length > 0 && (
                                <div
                                  data-testid="ledger-row-tags"
                                  className="mt-1 flex flex-wrap items-center gap-1"
                                >
                                  {tx.tags.map((tag) => (
                                    <button
                                      key={tag}
                                      type="button"
                                      data-testid="ledger-tag-badge"
                                      onClick={() =>
                                        setTagFilter((prev) => (prev === tag ? 'all' : tag))
                                      }
                                      title={`Filtrar pela tag #${tag}`}
                                      className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
                                    >
                                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                        #
                                      </span>
                                      <span>{tag}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-xs text-slate-700 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            {originMarks}
                            {originLabel}
                          </span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onToggleStatus(tx.id)}
                            aria-label={`Alternar situação de ${tx.description}`}
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                              tx.isInvoicePayment
                                ? 'text-violet-700 hover:text-violet-900 underline decoration-violet-400/70 underline-offset-2'
                                : tx.status === 'paid'
                                ? 'text-emerald-700 hover:text-emerald-900'
                                : 'text-amber-700 hover:text-amber-900 underline decoration-amber-400/70 underline-offset-2'
                            }`}
                          >
                            {tx.isInvoicePayment ? (
                              <>
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Estornar Fatura</span>
                              </>
                            ) : (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                <span>
                                  {tx.status === 'paid'
                                    ? tx.type === 'income'
                                      ? 'Recebido'
                                      : 'Efetivado'
                                    : tx.creditCardId
                                    ? 'Na Fatura'
                                    : 'Pendente (Efetivar)'}
                                </span>
                              </>
                            )}
                          </button>
                        </td>

                        <td
                          className={`py-3 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                            tx.type === 'income'
                              ? 'text-emerald-700'
                              : tx.type === 'transfer'
                              ? 'text-slate-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                          {formatBRL(tx.installmentPurchaseTotal ?? tx.amount)}
                          {tx.installmentPurchaseTotal !== undefined && (
                            <div className="text-xs font-medium text-slate-500">
                              Em {tx.installmentTotal}x · parcela {tx.installmentNumber}/{tx.installmentTotal}: {formatBRL(tx.amount)}
                            </div>
                          )}
                        </td>

                        <td className="py-3 pl-3 pr-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            {tx.installmentGroupId &&
                              groupsWithFutureInstallments.has(tx.installmentGroupId) &&
                              onAnticipateInstallments && (
                                <button
                                  type="button"
                                  data-testid="ledger-anticipate-btn"
                                  onClick={() =>
                                    onAnticipateInstallments(tx.installmentGroupId!, 0)
                                  }
                                  title="Adiantar parcelas futuras desta compra para o mês atual"
                                  className="inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-800 hover:bg-violet-100 transition-colors"
                                >
                                  <FastForward className="h-3 w-3" />
                                  Adiantar
                                </button>
                              )}
                            {tx.isAnticipated && onReverseAnticipation && (
                              <button
                                type="button"
                                data-testid="ledger-reverse-anticipation-btn"
                                onClick={() => onReverseAnticipation(tx.id)}
                                title="Desfazer antecipação desta parcela"
                                className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-100 transition-colors"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Desfazer Antecip.
                              </button>
                            )}
                            {onDuplicateTransaction && (
                              <button
                                type="button"
                                onClick={() => onDuplicateTransaction(tx)}
                                aria-label={`Duplicar ${tx.description}`}
                                title="Duplicar lançamento"
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onEditTransaction(tx)}
                              aria-label={`Editar ${tx.description}`}
                              title="Editar lançamento"
                              className="rounded p-1.5 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                requestTransactionDeletion(tx.id, Boolean(tx.installmentGroupId))
                              }
                              aria-label={`Excluir ${tx.description}`}
                              title={
                                tx.isInvoicePayment
                                  ? 'Excluir pagamento de fatura e refazer efeito cascata'
                                  : 'Excluir lançamento'
                              }
                              className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
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
          </div>
        )}
      </section>
    </div>
  )}

      {/* Native Mobile Press-and-Hold / Quick Action Bottom Sheet */}
      <TransactionActionSheet
        isOpen={Boolean(actionSheetTx)}
        onClose={() => setActionSheetTx(null)}
        transaction={actionSheetTx}
        category={actionSheetTx ? catMap.get(actionSheetTx.categoryId) : undefined}
        hasFutureInstallments={
          actionSheetTx?.installmentGroupId
            ? groupsWithFutureInstallments.has(actionSheetTx.installmentGroupId)
            : false
        }
        originLabel={
          actionSheetTx
            ? actionSheetTx.creditCardId
              ? `Cartão ${cardMap.get(actionSheetTx.creditCardId) || ''}`
              : actionSheetTx.type === 'transfer'
              ? `${accMap.get(actionSheetTx.accountId || '') || 'Origem'} → ${
                  accMap.get(actionSheetTx.destinationAccountId || '') || 'Destino'
                }`
              : accMap.get(actionSheetTx.accountId || '') || 'Carteira'
            : ''
        }
        onEdit={onEditTransaction}
        onToggleStatus={onToggleStatus}
        onDuplicate={onDuplicateTransaction || (() => {})}
        onDelete={requestTransactionDeletion}
        onAnticipateInstallments={
          onAnticipateInstallments
            ? (groupId) => onAnticipateInstallments(groupId, 0)
            : undefined
        }
        onReverseAnticipation={onReverseAnticipation}
      />
    </div>
  );
};
