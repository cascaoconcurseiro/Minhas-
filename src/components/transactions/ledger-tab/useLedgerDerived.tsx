/** Lançamentos do mês, grupos por dia, totais e etiquetas. Parte de TransactionsTab (ver TransactionsTab.tsx). */
import { useMemo } from 'react';
import { Transaction } from '../../../types/finance';
import { CardNetworkMark } from '../../cards/CardNetworkMark';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import { extractAvailableTransactionTags, getEffectiveExpenseAmountForUser, getLedgerTransactionsForMonth, isOutsidePersonalResult, normalizeSearchText } from '../../../domain/finance/financeRules';
import { groupTransactionsByDate } from '../../../domain/budgets/uxEnhancementRules';
import type { TransactionsTabPropsApi } from './transactionsTabConfig';
import type { LedgerStateApi } from './useLedgerState';

export function useLedgerDerived(ctx: TransactionsTabPropsApi & LedgerStateApi) {
  const {
    accounts,
    cards,
    categories,
    categoryFilter,
    effectiveSearchQuery,
    selectedMonth,
    sourceFilter,
    statusFilter,
    tagFilter,
    transactions,
    typeFilter,
  } = ctx;
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
        const searchable = normalizeSearchText(
          `${tx.description} ${catName} ${tx.notes || ''} ${(tx.tags || []).join(' ')}`
        );
        return tokens.every((tk) => searchable.includes(tk));
      })
      // Sempre em ordem cronológica (do dia 1 para o fim do mês).
      .sort((a, b) => a.date.localeCompare(b.date));
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
      if (tx.isInvoicePayment || tx.type === 'transfer' || isOutsidePersonalResult(tx)) continue;
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

  return {
    accMap,
    cardMap,
    catMap,
    dailyGroups,
    getMethodLabel,
    getTransactionOriginMarks,
    groupsWithFutureInstallments,
    monthTransactions,
    selectedSourceAccount,
    selectedSourceCard,
    totals,
    usedTagsInLedger,
  };
}

export type LedgerDerivedApi = ReturnType<typeof useLedgerDerived>;
