import React from 'react';
import { resolveBankReconciliationModalProps } from './bank-reconciliation/bankReconciliationConfig';
import type { BankReconciliationModalProps } from './bank-reconciliation/bankReconciliationConfig';
import { useReconciliationState } from './bank-reconciliation/useReconciliationState';
import { useReconciliationDerived } from './bank-reconciliation/useReconciliationDerived';
import { useReconciliationActions } from './bank-reconciliation/useReconciliationActions';
import type { BankReconciliationModalContext } from './bank-reconciliation/bankReconciliationContext';

import { ReconciliationCandidates } from './bank-reconciliation/ReconciliationCandidates';
import { ReconciliationControls } from './bank-reconciliation/ReconciliationControls';
import { ReconciliationFooter } from './bank-reconciliation/ReconciliationFooter';
import { ReconciliationHeader } from './bank-reconciliation/ReconciliationHeader';

export type { BankReconciliationModalProps };

/**
 * Importação de extrato OFX/CSV: conferir, categorizar e lançar.
 * A lógica fica em bank-reconciliation/ (hooks chamados sempre na mesma ordem; cada um recebe o que os anteriores devolveram).
 */
export const BankReconciliationModal: React.FC<BankReconciliationModalProps> = (props) => {
  const ctx0 = resolveBankReconciliationModalProps(props);
  const ctx1 = { ...ctx0, ...useReconciliationState(ctx0) };
  const ctx2 = { ...ctx1, ...useReconciliationDerived(ctx1) };
  const ctx3 = { ...ctx2, ...useReconciliationActions(ctx2) };
  const { isOpen } = ctx3;
  if (!isOpen) return null;
  const form: BankReconciliationModalContext = ctx3;
  const {

  } = form;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200 modal-shell"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reconciliation-modal-title"
    >
      <div className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800 overflow-hidden">
        {/* Modal Header */}
        <ReconciliationHeader form={form} />

        {/* Account Bar & Toolbar */}
        <ReconciliationControls form={form} />

        {/* Modal Body */}
        <ReconciliationCandidates form={form} />

        {/* Modal Footer */}
        <ReconciliationFooter form={form} />
      </div>
    </div>
  );
};
