import React from 'react';
import { MonthlyCalendarView } from '../overview/MonthlyCalendarView';
import { describeTransferForeignLeg } from '../../domain/finance/transferRules';
import { TransactionActionSheet } from './TransactionActionSheet';
import { resolveTransactionsTabProps } from './ledger-tab/transactionsTabConfig';
import type { TransactionsTabProps } from './ledger-tab/transactionsTabConfig';
import { useLedgerState } from './ledger-tab/useLedgerState';
import { useLedgerDerived } from './ledger-tab/useLedgerDerived';
import { useLedgerActions } from './ledger-tab/useLedgerActions';
import type { TransactionsTabContext } from './ledger-tab/transactionsTabContext';

import { LedgerFilters } from './ledger-tab/LedgerFilters';
import { LedgerListBody } from './ledger-tab/LedgerListBody';
import { LedgerListToolbar } from './ledger-tab/LedgerListToolbar';
import { LedgerToolbarCard } from './ledger-tab/LedgerToolbarCard';

export type { TransactionsTabProps };

/**
 * Lançamentos: calendário, extrato, filtros, ações em lote e conciliação.
 * A lógica fica em ledger-tab/ (hooks chamados sempre na mesma ordem; cada um recebe o que os anteriores devolveram).
 */
export const TransactionsTab: React.FC<TransactionsTabProps> = (props) => {
  const ctx0 = resolveTransactionsTabProps(props);
  const ctx1 = { ...ctx0, ...useLedgerState(ctx0) };
  const ctx2 = { ...ctx1, ...useLedgerDerived(ctx1) };
  const ctx3 = { ...ctx2, ...useLedgerActions(ctx2) };
  const form: TransactionsTabContext = ctx3;
  const {
    accMap,
    accounts,
    actionSheetTx,
    cardMap,
    cards,
    catMap,
    categories,
    groupsWithFutureInstallments,
    onAnticipateInstallments,
    onDeleteTransaction,
    onDuplicateTransaction,
    onEditTransaction,
    onOpenNewTransaction,
    onReverseAnticipation,
    onToggleStatus,
    requestTransactionDeletion,
    selectedMonth,
    setActionSheetTx,
    transactions,
    viewMode,
  } = form;
  return (
    <div className="module-page space-y-6">
      <LedgerToolbarCard form={form} />

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
          <LedgerFilters form={form} />

      {/* High-Density Ledger Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <LedgerListToolbar form={form} />

        <LedgerListBody form={form} />
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
                }${describeTransferForeignLeg(actionSheetTx, accounts)}`
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
