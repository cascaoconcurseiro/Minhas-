/** Cartão Vincular a uma viagem: moeda, câmbio, quem pagou e divisão. Parte de TransactionExtrasSection (ver TransactionExtrasSection.tsx). */
import { CheckCircle2, Globe, Plane } from 'lucide-react';
import { CURRENCY_CATALOG, formatExchangeRateBR, formatForeignCurrency } from '../../../domain/trips/travelRules';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import { getAccountLabel } from '../../../domain/finance/accountLabels';
import { CreditCardFace } from '../../cards/CreditCardFace';
import { formatBRL } from '../../../domain/finance/financeRules';
import { TripSplitMethod } from '../../../types/finance';
import { CurrencyInput } from '../../ui/CurrencyInput';
import type { TransactionFormContext } from './transactionFormContext';

export function TransactionTripCard({ form }: { form: TransactionFormContext }) {
  const {
    accountId,
    accounts,
    cards,
    creditCardId,
    currencyRegime,
    fxConversionPreview,
    handleRegimeChange,
    handleToggleTrip,
    handleTripSelect,
    isPaidByCompanion,
    isTripLinked,
    originalCurrency,
    parsedExchangeRate,
    parsedForeignAmount,
    selectedCreditCard,
    selectedPaymentAccount,
    selectedTrip,
    selectedTripParticipantIds,
    setAccountId,
    setCreditCardId,
    setTripCustomInputs,
    setTripPayerParticipantId,
    setTripSplitMethod,
    toggleTripParticipant,
    tripCustomInputs,
    tripId,
    tripPayerParticipantId,
    tripSharesPreview,
    tripSplitMethod,
    tripSplitValidationError,
    trips,
  } = form;
  return (
    <>
{/* Switch Card 1: Vincular a uma Viagem */}
                <div
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isTripLinked
                      ? 'border-sky-300 dark:border-sky-700 bg-sky-50/60 dark:bg-sky-950/30 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between p-3 sm:p-3.5 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          isTripLinked
                            ? 'bg-sky-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Plane className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            Vincular a uma Viagem
                          </span>
                          {isTripLinked && (
                            <span className="inline-flex items-center rounded-full bg-sky-100 dark:bg-sky-900/80 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:text-sky-200">
                              {tripId && selectedTrip
                                ? selectedTrip.name.split('—')[0].trim()
                                : originalCurrency !== 'BRL'
                                ? originalCurrency
                                : 'Ativo'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Organizar no roteiro, moedas internacionais (USD/EUR) e rateio
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isTripLinked}
                      data-testid="toggle-trip-switch"
                      onClick={handleToggleTrip}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                        isTripLinked
                          ? 'bg-sky-600'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      <span className="sr-only">Vincular a uma Viagem</span>
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isTripLinked ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Expanded Travel Panel */}
                  {isTripLinked && (
                    <div
                      data-testid="multicurrency-travel-panel"
                      className="border-t border-sky-200/80 dark:border-sky-800/60 p-3.5 sm:p-4 pt-3.5 space-y-3.5 animate-expand-in bg-white/40 dark:bg-slate-900/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-sky-950 dark:text-sky-200 flex items-center gap-1.5">
                          <Globe className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                          Roteiro & Câmbio Médio da Viagem
                        </span>
                        {selectedTrip && (
                          <span className="rounded-md bg-sky-100 dark:bg-sky-900/60 border border-sky-300 dark:border-sky-700 px-2.5 py-0.5 font-mono text-[11px] font-bold text-sky-900 dark:text-sky-200">
                            Média: 1 {selectedTrip.currency} ={' '}
                            {formatExchangeRateBR(parsedExchangeRate)}
                          </span>
                        )}
                      </div>

                      {trips.length === 0 ? (
                        <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/80 dark:bg-sky-950/60 p-3.5 text-xs text-sky-900 dark:text-sky-200 space-y-1">
                          <p className="font-bold">
                            Nenhuma viagem cadastrada no momento
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                            Cadastre sua viagem e suas compras de moeda na aba <strong>Viagens & Câmbio</strong>. Ao vincular um gasto aqui, o sistema utiliza automaticamente a moeda e a média ponderada do câmbio comprado na viagem (sem necessidade de informar cotação ou IOF manualmente).
                          </p>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Viagem Vinculada (Moeda Exclusiva da Viagem)
                            </label>
                            <select
                              data-testid="tx-trip-select"
                              value={selectedTrip?.id || tripId}
                              onChange={(e) => handleTripSelect(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:border-sky-600 focus:outline-none"
                            >
                              {trips.map((t) => (
                                <option key={t.id} value={t.id}>
                                  ✈️ {t.name} — Somente {t.currency} ({CURRENCY_CATALOG[t.currency]?.symbol})
                                </option>
                              ))}
                            </select>
                          </div>

                          {selectedTrip && (
                            <div className="space-y-2.5">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                  Meio de Pagamento Internacional ({selectedTrip.currency})
                                </label>
                                <div
                                  data-testid="trip-intl-payment-regime-selector"
                                  className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                                >
                                  <button
                                    type="button"
                                    data-testid="regime-global-account-btn"
                                    onClick={() => handleRegimeChange('global_account')}
                                    className={`rounded-xl border p-2.5 text-left transition-all ${
                                      currencyRegime === 'global_account'
                                        ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/70 text-sky-950 dark:text-sky-100 ring-1 ring-sky-600'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="text-xs font-bold flex items-center justify-between">
                                      <span>Cartão Global (Wise / Nomad)</span>
                                      {currencyRegime === 'global_account' && (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                      Wise, Nomad, Avenue, C6 Global em {selectedTrip.currency}
                                    </p>
                                  </button>

                                  <button
                                    type="button"
                                    data-testid="regime-credit-card-intl-btn"
                                    onClick={() => handleRegimeChange('credit_card_intl')}
                                    className={`rounded-xl border p-2.5 text-left transition-all ${
                                      currencyRegime === 'credit_card_intl'
                                        ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/70 text-sky-950 dark:text-sky-100 ring-1 ring-sky-600'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="text-xs font-bold flex items-center justify-between">
                                      <span>Cartão Internacional</span>
                                      {currencyRegime === 'credit_card_intl' && (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                      Compra no crédito internacional em {selectedTrip.currency}
                                    </p>
                                  </button>

                                  <button
                                    type="button"
                                    data-testid="regime-cash-fx-btn"
                                    onClick={() => handleRegimeChange('cash_fx')}
                                    className={`rounded-xl border p-2.5 text-left transition-all ${
                                      currencyRegime === 'cash_fx'
                                        ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/70 text-sky-950 dark:text-sky-100 ring-1 ring-sky-600'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="text-xs font-bold flex items-center justify-between">
                                      <span>Espécie ({selectedTrip.currency})</span>
                                      {currencyRegime === 'cash_fx' && (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                      Papel-moeda vivo comprado para a viagem
                                    </p>
                                  </button>
                                </div>
                              </div>

                              {currencyRegime === 'global_account' && (
                                <div
                                  data-testid="trip-linked-intl-account-selector"
                                  className="rounded-xl border border-sky-200 dark:border-sky-800/80 bg-sky-50/70 dark:bg-sky-950/40 p-3 space-y-1.5"
                                >
                                  <label className="block text-[11px] font-bold text-sky-950 dark:text-sky-200">
                                    🌎 Debitar de qual Conta Internacional ({selectedTrip.currency} — Wise, Nomad, Avenue, C6 Global)?
                                  </label>
                                  {(() => {
                                    const matchingIntl = accounts.filter(
                                      (a) =>
                                        a.type === 'international' &&
                                        a.currency === selectedTrip.currency
                                    );
                                    return matchingIntl.length > 0 ? (
                                      <>
                                        <select
                                          data-testid="tx-trip-intl-account-select"
                                          value={accountId}
                                          onChange={(e) => setAccountId(e.target.value)}
                                          className="w-full rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-sky-950 dark:text-white"
                                        >
                                          <option value="">
                                            — Abater apenas da carteira de câmbio da viagem —
                                          </option>
                                          {matchingIntl.map((acc) => (
                                            <option key={acc.id} value={acc.id}>
                                              {CURRENCY_CATALOG[selectedTrip.currency]?.flag}{' '}
                                              {acc.name} ({acc.institution ? `${acc.institution} · ` : ''}{selectedTrip.currency})
                                            </option>
                                          ))}
                                        </select>
                                        {selectedPaymentAccount?.type === 'international' && (
                                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                            <InstitutionMark
                                              institution={selectedPaymentAccount.institution}
                                              accountName={selectedPaymentAccount.name}
                                              color={selectedPaymentAccount.color}
                                              size="xs"
                                            />
                                            <span>Conta selecionada: {getAccountLabel(selectedPaymentAccount, accounts)}</span>
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <p className="text-[11px] text-sky-800 dark:text-sky-300">
                                        Debitando do saldo de câmbio da viagem em{' '}
                                        <strong>{selectedTrip.currency}</strong>. Suas contas internacionais (Wise, Nomad, etc.) e cartões são independentes e podem ser cadastrados na aba Contas & Cartões.
                                      </p>
                                    );
                                  })()}
                                </div>
                              )}

                              {currencyRegime === 'credit_card_intl' && cards.length > 0 && (
                                <div className="rounded-xl border border-sky-200 dark:border-sky-800/80 bg-sky-50/70 dark:bg-sky-950/40 p-3 space-y-1.5">
                                  <label className="block text-[11px] font-bold text-sky-950 dark:text-sky-200">
                                    💳 Qual Cartão de Crédito foi utilizado nesta compra internacional?
                                  </label>
                                  <select
                                    data-testid="tx-trip-intl-card-select"
                                    value={creditCardId}
                                    onChange={(e) => setCreditCardId(e.target.value)}
                                    className="w-full rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-sky-950 dark:text-white"
                                  >
                                    <option value="">— Registrar apenas no roteiro da viagem —</option>
                                    {cards.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        💳 {c.name} ({c.brand})
                                      </option>
                                    ))}
                                  </select>
                                  {selectedCreditCard && (
                                    <div className="flex items-center gap-3">
                                      <CreditCardFace card={selectedCreditCard} size="compact" />
                                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Bandeira {selectedCreditCard.brand}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div
                                data-testid="trip-auto-weighted-rate-summary"
                                className="rounded-xl border border-sky-200 dark:border-sky-800/80 bg-white dark:bg-slate-900 p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                              >
                                <div className="space-y-0.5">
                                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                    Moeda Oficial da Viagem ({selectedTrip.currency}) • Câmbio Médio Automático
                                  </span>
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                                    {selectedTrip.exchangeLots.length > 0
                                      ? `Média ponderada de ${selectedTrip.exchangeLots.length} compra(s) de câmbio na viagem (sem misturar com R$)`
                                      : 'Cotação média de referência configurada na viagem'}
                                  </span>
                                </div>
                                <div className="text-right font-mono">
                                  <span className="text-xs font-extrabold text-sky-800 dark:text-sky-300 block">
                                    1 {selectedTrip.currency} = {formatExchangeRateBR(parsedExchangeRate)}
                                  </span>
                                  {fxConversionPreview && parsedForeignAmount > 0 && (
                                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">
                                      Equivalente: {formatBRL(fxConversionPreview.totalBrl)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Trip Group Splitting */}
                      {selectedTrip && selectedTrip.participants.length > 1 && (
                        <div className="pt-3 border-t border-sky-200/80 dark:border-sky-800/60 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Quem pagou esta despesa na viagem?
                              </label>
                              <select
                                value={tripPayerParticipantId}
                                onChange={(e) =>
                                  setTripPayerParticipantId(e.target.value)
                                }
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                              >
                                {selectedTrip.participants.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.isMe || p.id === 'me'
                                      ? `👤 ${p.name} (Sai da minha conta/cartão)`
                                      : `🤝 ${p.name} pagou (Apenas rateio na viagem)`}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Regra de Divisão entre Viajantes
                              </label>
                              <select
                                value={tripSplitMethod}
                                onChange={(e) =>
                                  setTripSplitMethod(
                                    e.target.value as TripSplitMethod
                                  )
                                }
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                              >
                                <option value="equal">
                                  Divisão Igualitária (Partes Iguais)
                                </option>
                                <option value="exact">
                                  Valor Exato por Pessoa
                                </option>
                                <option value="percentage">
                                  Porcentagem (%)
                                </option>
                                <option value="shares">
                                  Por Cotas / Pesos (ex: 2x, 1x)
                                </option>
                                <option value="individual">
                                  100% Individual (Apenas quem consumiu)
                                </option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                              Participantes deste gasto:
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {selectedTrip.participants.map((p) => {
                                const isChecked =
                                  selectedTripParticipantIds.length === 0 ||
                                  selectedTripParticipantIds.includes(p.id);
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => toggleTripParticipant(p.id)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${
                                      isChecked
                                        ? 'border-sky-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                                        : 'border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{ backgroundColor: p.color }}
                                    />
                                    <span>{p.name}</span>
                                    {isChecked && (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-sky-600" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {isPaidByCompanion && (
                            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200">
                              <strong>Regra Contábil:</strong> Como quem pagou foi{' '}
                              <strong>
                                {
                                  selectedTrip.participants.find(
                                    (p) => p.id === tripPayerParticipantId
                                  )?.name
                                }
                              </strong>
                              , este gasto não descontará do seu saldo bancário agora — apenas registrará a sua parte no acerto da viagem.
                            </div>
                          )}

                          {(tripSplitMethod === 'exact' ||
                            tripSplitMethod === 'percentage' ||
                            tripSplitMethod === 'shares') && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                              {selectedTrip.participants
                                .filter(
                                  (p) =>
                                    selectedTripParticipantIds.length === 0 ||
                                    selectedTripParticipantIds.includes(p.id)
                                )
                                .map((p) => (
                                  <div
                                    key={p.id}
                                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2"
                                  >
                                    <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate mb-1">
                                      {p.name}{' '}
                                      {tripSplitMethod === 'percentage'
                                        ? '(%)'
                                        : tripSplitMethod === 'shares'
                                        ? '(Cotas)'
                                        : `(${originalCurrency})`}
                                    </label>
                                    {tripSplitMethod === 'exact' ? <CurrencyInput
                                      currency={originalCurrency}
                                      value={tripCustomInputs[p.id] || ''}
                                      onValueChange={(value) =>
                                        setTripCustomInputs((prev) => ({ ...prev, [p.id]: value }))
                                      }
                                      placeholder="0,00"
                                      className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono text-slate-900 dark:text-white"
                                    /> : <input
                                      type="text"
                                      inputMode="decimal"
                                      value={tripCustomInputs[p.id] || ''}
                                      onChange={(e) =>
                                        setTripCustomInputs((prev) => ({
                                          ...prev,
                                          [p.id]: e.target.value,
                                        }))
                                      }
                                      placeholder={
                                        tripSplitMethod === 'percentage'
                                          ? '50'
                                          : tripSplitMethod === 'shares'
                                          ? '1'
                                          : '0,00'
                                      }
                                      className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono text-slate-900 dark:text-white"
                                    />}
                                  </div>
                                ))}
                            </div>
                          )}

                          {tripSharesPreview.length > 0 && (
                            <div className="rounded-lg bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 p-2.5 space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                Resumo do Rateio por Viajante
                              </span>
                              <div className="flex flex-wrap items-center gap-2">
                                {tripSharesPreview.map((s) => {
                                  const part = selectedTrip.participants.find(
                                    (p) => p.id === s.participantId
                                  );
                                  return (
                                    <span
                                      key={s.participantId}
                                      className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-800 dark:text-slate-200"
                                    >
                                      <strong>{part?.name}:</strong>{' '}
                                      <span className="font-mono font-bold">
                                        {originalCurrency !== 'BRL'
                                          ? `${formatForeignCurrency(
                                              s.foreignShare,
                                              originalCurrency
                                            )} (${formatBRL(s.brlShare)})`
                                          : formatBRL(s.brlShare)}
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {tripSplitValidationError && (
                            <p role="alert" className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                              {tripSplitValidationError}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
    </>
  );
}
