import React from 'react';
import { resolveTransactionModalProps } from './transaction-modal/transactionModalConfig';
import type { TransactionModalProps } from './transaction-modal/transactionModalConfig';
import { useTransactionFormState } from './transaction-modal/useTransactionFormState';
import { useTransactionFormEffects } from './transaction-modal/useTransactionFormEffects';
import { useTransactionFormHandlers } from './transaction-modal/useTransactionFormHandlers';
import { useTransactionFormInsights } from './transaction-modal/useTransactionFormInsights';
import { buildTransactionFormActions } from './transaction-modal/buildTransactionFormActions';
import type { TransactionFormContext } from './transaction-modal/transactionFormContext';

import { TransactionAmountSection } from './transaction-modal/TransactionAmountSection';
import { TransactionCoreFields } from './transaction-modal/TransactionCoreFields';
import { TransactionExtrasSection } from './transaction-modal/TransactionExtrasSection';
import { TransactionFormNotices } from './transaction-modal/TransactionFormNotices';
import { TransactionModalFooter } from './transaction-modal/TransactionModalFooter';
import { TransactionModalHeader } from './transaction-modal/TransactionModalHeader';
import { TransactionTagsSection } from './transaction-modal/TransactionTagsSection';

export type { TransactionModalProps };

/**
 * Formulário de lançamento (despesa, receita, cartão, transferência), em janela.
 * A lógica fica em transaction-modal/ (hooks chamados sempre na mesma ordem; cada um recebe o que os anteriores devolveram).
 */
export const TransactionModal: React.FC<TransactionModalProps> = (props) => {
  const ctx0 = resolveTransactionModalProps(props);
  const ctx1 = { ...ctx0, ...useTransactionFormState(ctx0) };
  const ctx2 = { ...ctx1, ...useTransactionFormEffects(ctx1) };
  const ctx3 = { ...ctx2, ...useTransactionFormHandlers(ctx2) };
  const ctx4 = { ...ctx3, ...useTransactionFormInsights(ctx3) };
  const { isOpen } = ctx4;
  if (!isOpen) return null;
  const ctxF1 = { ...ctx4, ...buildTransactionFormActions(ctx4) };
  const form: TransactionFormContext = ctxF1;
  const {
    handleSubmit,
    scrollBodyRef,
    updateScrollMetrics,
  } = form;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 p-0 sm:p-4 overflow-hidden modal-shell"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-transaction-title"
    >
      <div
        data-testid="transaction-modal-shell"
        data-action-always-reachable="true"
        className="w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-sheet-up sm:animate-modal-in modal-shell"
      >
        {/* Mobile Bottom-Sheet Pull Indicator */}
        <div className="mx-auto mt-2 -mb-1 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />

        <TransactionModalHeader form={form} />

        {/* Form Wrapper */}
        <form
          id="transaction-modal-form"
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white dark:bg-slate-900"
        >
          {/* Zone 2: Independent Scrollable Form Body */}
          <div
            ref={scrollBodyRef}
            onScroll={updateScrollMetrics}
            data-testid="transaction-modal-scroll-body"
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar native-scroll modal-form-scroll bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
          >
            <TransactionFormNotices form={form} />

            <TransactionAmountSection form={form} />

            <TransactionCoreFields form={form} />

            <TransactionTagsSection form={form} />

            <TransactionExtrasSection form={form} />
          </div>

          <TransactionModalFooter form={form} />
        </form>
      </div>
    </div>
  );
};
