/** Janela de acerto de contas. Parte de SharedExpensesTab (ver SharedExpensesTab.tsx). */
import { ArrowDownLeft, X } from 'lucide-react';
import { formatBRL } from '../../../domain/finance/financeRules';
import { MissingSetupNotice } from '../../layout/MissingSetupNotice';
import { getAccountLabelWithBank } from '../../../domain/finance/accountLabels';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import type { SharedExpensesTabContext } from './sharedExpensesTabContext';

export function SharedSettlementModal({ form }: { form: SharedExpensesTabContext }) {
  const {
    accounts,
    brlAccounts,
    handleConfirmSettlement,
    onRequestCreateAccount,
    selectedSettlementAccount,
    setSettleAccountId,
    setSettleDate,
    setSettlementTarget,
    settleAccountId,
    settleDate,
    settlementError,
    settlementTarget,
  } = form;
  return (
    <>
{/* Settlement Confirmation Modal */}
      {settlementTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px] modal-shell"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSettlementTarget(null);
          }}
        >
          <div className="w-full max-w-md max-h-[90dvh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-modal-in">
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <ArrowDownLeft className="h-5 w-5" />
                <h3 className="text-base font-bold text-slate-900">
                  Confirmar Liquidação / Compensação
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSettlementTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Você está liquidando o saldo líquido compensado de{' '}
                <strong className="text-slate-900 tabular-nums">
                  {formatBRL(settlementTarget.amount)}
                </strong>{' '}
                referente a <em>"{settlementTarget.description}"</em>.
              </p>

              <div className="space-y-3">
                {settlementError && (
                  <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                    {settlementError}
                  </p>
                )}
                {brlAccounts.length === 0 && (
                  <MissingSetupNotice
                    testId="missing-brl-account-for-settlement"
                    message="Não há conta em reais cadastrada para registrar este acerto. Cadastre uma conta."
                    onAction={onRequestCreateAccount}
                  />
                )}
                <div>
                  <label htmlFor="shared-settlement-account" className="block text-xs font-semibold text-slate-700 mb-1">
                    Conta Bancária para Conciliação (PIX):
                  </label>
                  <select
                    id="shared-settlement-account"
                    value={settleAccountId}
                    onChange={(e) => setSettleAccountId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                  >
                    {brlAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {getAccountLabelWithBank(acc, accounts)}
                      </option>
                    ))}
                  </select>
                  {selectedSettlementAccount && (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                      <InstitutionMark
                        institution={selectedSettlementAccount.institution}
                        accountName={selectedSettlementAccount.name}
                        color={selectedSettlementAccount.color}
                        size="xs"
                      />
                      <span>Acerto pela conta {selectedSettlementAccount.name}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="shared-settlement-date" className="block text-xs font-semibold text-slate-700 mb-1">
                    Data do Acerto:
                  </label>
                  <input
                    type="date"
                    id="shared-settlement-date"
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setSettlementTarget(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSettlement}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                Confirmar Acerto
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
