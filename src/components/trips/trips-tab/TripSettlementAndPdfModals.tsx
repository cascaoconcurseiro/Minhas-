/** Janelas de acerto/reembolso e do relatório em PDF. Parte de TripsTab (ver TripsTab.tsx). */
import { X } from 'lucide-react';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { formatExchangeRateBR, formatForeignCurrency } from '../../../domain/trips/travelRules';
import { MissingSetupNotice } from '../../layout/MissingSetupNotice';
import { getAccountLabelWithBank } from '../../../domain/finance/accountLabels';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import { parseCurrencyInput, parseExchangeRateInput } from '../../../utils/currencyInput';
import { formatBRL } from '../../../domain/finance/financeRules';
import { TripPdfReportModal } from '../TripPdfReportModal';
import type { TripPageContext } from './tripsTabContext';

export function TripSettlementAndPdfModals({ form }: { form: TripPageContext }) {
  const {
    accounts,
    activeSettlementDebt,
    activeTrip,
    brlAccounts,
    categories,
    currencyMeta,
    handleConfirmSettlement,
    isPdfReportModalOpen,
    onRequestCreateAccount,
    selectedSettlementBankAccount,
    setActiveSettlementDebt,
    setIsPdfReportModalOpen,
    setSettlementBankAccountId,
    setSettlementCustomRateStr,
    setSettlementError,
    setSettlementForeignAmountStr,
    setSettlementMethod,
    setSettlementRateMode,
    setSettlementRecordInBank,
    settlementBankAccountId,
    settlementCustomRateStr,
    settlementError,
    settlementForeignAmountStr,
    settlementMethod,
    settlementRateMode,
    settlementRecordInBank,
    summary,
    transactions,
  } = form;
  return (
    <>
{/* MODAL 4: LIQUIDAR / RECEBER REEMBOLSO MULTI-MOEDA */}
      {activeSettlementDebt && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 p-0 sm:p-4 overflow-hidden modal-shell"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-sheet-up sm:animate-modal-in">
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                  Acerto de Contas Multi-Moeda ({activeSettlementDebt.fromName} →{' '}
                  {activeSettlementDebt.toName})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Escolha se o reembolso será feito em Reais (PIX) ou na moeda da viagem ({activeTrip.currency})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSettlementDebt(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSettlement} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 modal-form-scroll custom-scrollbar text-xs">
                {settlementError && (
                  <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                    {settlementError}
                  </p>
                )}
                {/* Method Selection */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Como esse pagamento está sendo realizado?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSettlementMethod('pix_brl')}
                      className={`rounded-xl border p-2.5 text-left transition-all ${
                        settlementMethod === 'pix_brl'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-bold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <span className="block text-xs">🇧🇷 PIX em Reais (R$)</span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">
                        Converte para R$ e pode cair na sua conta bancária
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettlementMethod('wise_foreign')}
                      className={`rounded-xl border p-2.5 text-left transition-all ${
                        settlementMethod === 'wise_foreign'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-bold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <span className="block text-xs">
                        {currencyMeta.flag} Wise / Nomad ({activeTrip.currency})
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">
                        Transferência direta em {activeTrip.currency} entre contas globais
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettlementMethod('cash_foreign')}
                      className={`rounded-xl border p-2.5 text-left transition-all ${
                        settlementMethod === 'cash_foreign'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-bold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <span className="block text-xs">
                        💵 Notas em Espécie ({activeTrip.currency})
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">
                        Pago em mãos com papel moeda durante a viagem
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Valor Abatido da Dívida ({activeTrip.currency})
                    </label>
                    <CurrencyInput
                      required
                      value={settlementForeignAmountStr}
                      currency={activeTrip.currency}
                      onValueChange={(value) => {
                        setSettlementForeignAmountStr(value);
                        setSettlementError(null);
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Qual câmbio usar para converter em R$?
                    </label>
                    <select
                      value={settlementRateMode}
                      onChange={(e) =>
                        setSettlementRateMode(
                          e.target.value as 'effective_vet' | 'custom_ptax'
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-semibold"
                    >
                      <option value="effective_vet">
                        VET Efetivo c/ IOF ({formatExchangeRateBR(activeSettlementDebt.impliedEffectiveRate)})
                      </option>
                      <option value="custom_ptax">
                        Cotação Combinada / PTAX Manual
                      </option>
                    </select>
                  </div>
                </div>

                {settlementRateMode === 'custom_ptax' && (
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Cotação Combinada (R$ por 1 {activeTrip.currency})
                    </label>
                    <input
                      type="text"
                      value={settlementCustomRateStr}
                      onChange={(e) => {
                        setSettlementCustomRateStr(e.target.value);
                        setSettlementError(null);
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                )}

                {/* Bank Account Reconciliation Option when settling in BRL */}
                {settlementMethod === 'pix_brl' &&
                  (activeSettlementDebt.fromParticipantId === 'me' ||
                    activeSettlementDebt.toParticipantId === 'me') && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-2.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settlementRecordInBank}
                          onChange={(e) => setSettlementRecordInBank(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {activeSettlementDebt.toParticipantId === 'me'
                            ? 'Creditar automaticamente este PIX recebido no meu saldo bancário'
                            : 'Debitar automaticamente este PIX pago do meu saldo bancário'}
                        </span>
                      </label>

                      {settlementRecordInBank && brlAccounts.length === 0 && (
                        <MissingSetupNotice
                          testId="missing-brl-account-for-trip-settlement"
                          message="Não há conta em reais cadastrada para registrar este Pix. Cadastre uma conta ou desmarque o registro no banco."
                          onAction={onRequestCreateAccount ? () => onRequestCreateAccount('account') : undefined}
                        />
                      )}
                      {settlementRecordInBank && brlAccounts.length > 0 && (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                            Conta Bancária do PIX:
                          </label>
                          <select
                            value={settlementBankAccountId}
                            onChange={(e) => setSettlementBankAccountId(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white font-semibold"
                          >
                            {brlAccounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {getAccountLabelWithBank(acc, accounts)}
                              </option>
                            ))}
                          </select>
                        {selectedSettlementBankAccount && (
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <InstitutionMark
                              institution={selectedSettlementBankAccount.institution}
                              accountName={selectedSettlementBankAccount.name}
                              color={selectedSettlementBankAccount.color}
                              size="xs"
                            />
                            <span>PIX registrado em {selectedSettlementBankAccount.name}</span>
                          </div>
                        )}
                        </div>
                      )}
                    </div>
                  )}

                {/* Summary Preview Box */}
                {(() => {
                  const fAmt =
                    parseCurrencyInput(settlementForeignAmountStr, activeTrip.currency) ||
                    activeSettlementDebt.amountForeign;
                  const rUsed =
                    settlementRateMode === 'effective_vet'
                      ? activeSettlementDebt.impliedEffectiveRate
                      : Math.max(0.0001, parseExchangeRateInput(settlementCustomRateStr));
                  const totalBrl = Math.round(fAmt * rUsed * 100) / 100;

                  return (
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5 flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                          Dívida Abatida na Viagem
                        </span>
                        <span className="text-sm font-mono font-extrabold text-emerald-900 dark:text-white">
                          {formatForeignCurrency(fAmt, activeTrip.currency)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                          Valor Equivalente em Reais
                        </span>
                        <span className="text-base font-mono font-extrabold text-emerald-900 dark:text-white">
                          {formatBRL(totalBrl)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 shrink-0 bg-slate-50/70 dark:bg-slate-800/40 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
                <button
                  type="button"
                  onClick={() => setActiveSettlementDebt(null)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                >
                  Confirmar Liquidação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable PDF Financial Summary Report Modal */}
      {isPdfReportModalOpen && (
        <TripPdfReportModal
          trip={activeTrip}
          summary={summary}
          transactions={transactions}
          categories={categories}
          isOpen={isPdfReportModalOpen}
          onClose={() => setIsPdfReportModalOpen(false)}
        />
      )}
    </>
  );
}
