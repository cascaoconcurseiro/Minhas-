/** Janelas de nova viagem, comprar câmbio e adicionar viajante. Parte de TripsTab (ver TripsTab.tsx). */
import { X } from 'lucide-react';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { MissingSetupNotice } from '../../layout/MissingSetupNotice';
import { getAccountLabelWithBank } from '../../../domain/finance/accountLabels';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import { calculateConvertedBrlAmount, formatExchangeRateBR } from '../../../domain/trips/travelRules';
import { parseCurrencyInput, parseExchangeRateInput } from '../../../utils/currencyInput';
import { formatBRL, parseBRLInput } from '../../../domain/finance/financeRules';
import type { TripPageContext } from './tripsTabContext';

export function TripLotAndParticipantModals({ form }: { form: TripPageContext }) {
  const {
    accounts,
    activeTrip,
    brlAccounts,
    familyMembers,
    handleAddParticipant,
    handleSaveExchangeLot,
    isLotModalOpen,
    isParticipantModalOpen,
    lotBaseRateStr,
    lotCreditAccountId,
    lotDate,
    lotDebitAccountId,
    lotError,
    lotForeignAmountStr,
    lotIofPercentStr,
    lotSourceLabel,
    newParticipantEmail,
    newParticipantFamilyId,
    newParticipantName,
    newParticipantPix,
    newTripModalNode,
    onRequestCreateAccount,
    selectedLotDebitAccount,
    setIsLotModalOpen,
    setIsParticipantModalOpen,
    setLotBaseRateStr,
    setLotCreditAccountId,
    setLotDate,
    setLotDebitAccountId,
    setLotError,
    setLotForeignAmountStr,
    setLotIofPercentStr,
    setLotSourceLabel,
    setNewParticipantEmail,
    setNewParticipantFamilyId,
    setNewParticipantName,
    setNewParticipantPix,
  } = form;
  return (
    <>
{/* MODAL 1: NOVA OU EDITAR VIAGEM */}
      {newTripModalNode}

      {/* MODAL 2: COMPRAR CÂMBIO (WISE / NOMAD / ESPÉCIE) */}
      {isLotModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 p-0 sm:p-4 overflow-hidden modal-shell"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-sheet-up sm:animate-modal-in">
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                Comprar Câmbio ({activeTrip.currency}) — Preço Médio
              </h3>
              <button
                type="button"
                onClick={() => setIsLotModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExchangeLot} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs modal-form-scroll custom-scrollbar">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Corretora / Bolso (Origem)
                  </label>
                  <input
                    type="text"
                    required
                    value={lotSourceLabel}
                    onChange={(e) => setLotSourceLabel(e.target.value)}
                    placeholder="Ex: Wise Remessa, Nomad Global, Espécie Casa de Câmbio"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>

                {lotError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">{lotError}</p>}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Valor Comprado ({activeTrip.currency})
                    </label>
                    <CurrencyInput
                      required
                      value={lotForeignAmountStr}
                      currency={activeTrip.currency}
                      onValueChange={setLotForeignAmountStr}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Data da Compra
                    </label>
                    <input
                      type="date"
                      value={lotDate}
                      onChange={(e) => setLotDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Cotação Base (R$)
                    </label>
                    <input
                      type="text"
                      required
                      value={lotBaseRateStr}
                      onChange={(e) => { setLotBaseRateStr(e.target.value); setLotError(null); }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      IOF (%)
                    </label>
                    <input
                      type="text"
                      value={lotIofPercentStr}
                      onChange={(e) => { setLotIofPercentStr(e.target.value); setLotError(null); }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  {(() => {
                    const creditCandidates = accounts.filter(
                      (account) => account.type === 'international' && account.currency === activeTrip?.currency
                    );
                    return (
                      <div className="mb-3 space-y-2">
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Em qual conta a moeda ({activeTrip?.currency}) entra? (Opcional)
                        </label>
                        {creditCandidates.length === 0 ? (
                          <MissingSetupNotice
                            testId="missing-international-account-for-lot"
                            message={`Não há conta internacional em ${activeTrip?.currency} cadastrada. Sem ela a moeda comprada não entra no saldo de nenhuma conta (se for espécie, pode deixar assim).`}
                            actionLabel="Cadastrar conta internacional"
                            onAction={onRequestCreateAccount ? () => onRequestCreateAccount('international_account') : undefined}
                          />
                        ) : (
                          <select
                            value={lotCreditAccountId}
                            onChange={(e) => setLotCreditAccountId(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                          >
                            <option value="">Espécie / não vinculada a uma conta</option>
                            {creditCandidates.map((account) => (
                              <option key={account.id} value={account.id}>
                                Entra em: {account.name} ({account.currency})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })()}
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Descontar Reais (R$) de alguma conta bancária? (Opcional)
                  </label>
                  <select
                    value={lotDebitAccountId}
                    onChange={(e) => setLotDebitAccountId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  >
                    <option value="">Não gerar débito no extrato bancário</option>
                    {brlAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        Debitar de: {getAccountLabelWithBank(acc, accounts)}
                      </option>
                    ))}
                  </select>
                  {selectedLotDebitAccount && (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <InstitutionMark
                        institution={selectedLotDebitAccount.institution}
                        accountName={selectedLotDebitAccount.name}
                        color={selectedLotDebitAccount.color}
                        size="xs"
                      />
                      <span>Débito vinculado a {selectedLotDebitAccount.name}</span>
                    </div>
                  )}
                </div>

                {/* Live Preview */}
                {(() => {
                  const preview = calculateConvertedBrlAmount(
                    parseCurrencyInput(lotForeignAmountStr, activeTrip.currency),
                    parseExchangeRateInput(lotBaseRateStr),
                    parseBRLInput(lotIofPercentStr)
                  );
                  return (
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 p-3 flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                          VET (Valor Efetivo Total)
                        </span>
                        <span className="font-mono font-bold text-emerald-900 dark:text-white">
                          {formatExchangeRateBR(preview.effectiveRate)} / {activeTrip.currency}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                          Total Pago em R$
                        </span>
                        <span className="text-sm font-mono font-extrabold text-emerald-900 dark:text-white">
                          {formatBRL(preview.totalBrl)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 shrink-0 bg-slate-50/70 dark:bg-slate-800/40 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
                <button
                  type="button"
                  onClick={() => setIsLotModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                >
                  Salvar Câmbio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADICIONAR VIAJANTE / CONVIDAR FAMILIAR POR E-MAIL */}
      {isParticipantModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 p-0 sm:p-4 overflow-hidden modal-shell"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-sheet-up sm:animate-modal-in">
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                  Convidar Familiar ou Viajante para a Viagem
                </h3>
                <p className="text-[11px] text-slate-500">
                  As despesas compartilhadas aparecerão para o convidado exclusivamente em {activeTrip.currency}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsParticipantModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddParticipant} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3 modal-form-scroll custom-scrollbar text-xs">
                {familyMembers.length > 0 && (
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Selecionar Familiar já Cadastrado (1 clique):
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {familyMembers.map((fm) => (
                        <button
                          key={fm.id}
                          type="button"
                          onClick={() => {
                            setNewParticipantFamilyId(fm.id);
                            setNewParticipantName(fm.name);
                            setNewParticipantEmail(fm.email || '');
                            setNewParticipantPix(fm.pixKey || '');
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all ${
                            newParticipantFamilyId === fm.id
                              ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: fm.color }}
                          />
                          <span>{fm.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nome do Viajante / Familiar
                  </label>
                  <input
                    type="text"
                    required
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    placeholder="Ex: Mariana (Esposa), Fernanda..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    E-mail da Pessoa (Para Convite & Sincronização na Moeda {activeTrip.currency})
                  </label>
                  <input
                    type="email"
                    value={newParticipantEmail}
                    onChange={(e) => setNewParticipantEmail(e.target.value)}
                    placeholder="Ex: mariana@email.com"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Chave PIX (Opcional, caso acertem em R$ no fim)
                  </label>
                  <input
                    type="text"
                    value={newParticipantPix}
                    onChange={(e) => setNewParticipantPix(e.target.value)}
                    placeholder="Opcional: e-mail, CPF ou celular"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 shrink-0 bg-slate-50/70 dark:bg-slate-800/40 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
                <button
                  type="button"
                  onClick={() => setIsParticipantModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                >
                  Convidar e Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
