/** Subtela Divisão: saldos do grupo e acerto em várias moedas. Parte de TripsTab (ver TripsTab.tsx). */
import { ArrowLeftRight, CheckCircle2, Eye, Mail } from 'lucide-react';
import { formatExchangeRateBR, formatForeignCurrency } from '../../../domain/trips/travelRules';
import { formatBRL, formatShortDateBR } from '../../../domain/finance/financeRules';
import type { TripPageContext } from './tripsTabContext';

export function TripGroupSplitView({ form }: { form: TripPageContext }) {
  const {
    activeSubView,
    activeTrip,
    guestPreviewParticipantId,
    handleOpenSettlementModal,
    setGuestPreviewParticipantId,
    setIsParticipantModalOpen,
    summary,
  } = form;
  return (
    <>
{/* SUB-VIEW 2: SPLITWISE GROUP BALANCES & MULTI-CURRENCY SETTLEMENT */}
      {activeSubView === 'group_split' && (
        <div className="space-y-5">
          {/* Currency Isolation Banner & Guest View Selector */}
          <div className="rounded-2xl border border-sky-200 dark:border-sky-800/80 bg-sky-50/70 dark:bg-sky-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">
                  Moeda Isolada: {activeTrip.currency}
                </span>
                <span className="text-xs font-bold text-sky-950 dark:text-sky-100">
                  Despesas Compartilhadas Exclusivas da Viagem ({activeTrip.name})
                </span>
              </div>
              <p className="text-[11px] text-sky-800 dark:text-sky-300">
                Todos os gastos divididos nesta viagem ficam 100% em <strong>{activeTrip.currency}</strong> e não se misturam com a fatura doméstica em Reais (R$). Quando um familiar convidado aceita o convite por e-mail, ele visualiza este espelho diretamente em {activeTrip.currency}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsParticipantModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-700 transition-colors shrink-0"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Convidar Familiar / Viajante por E-mail</span>
            </button>
          </div>

          {/* Simplified Debts ("Quem Deve a Quem") */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                  Encontro de Contas Compensado na Moeda da Viagem ({activeTrip.currency})
                </h3>
                <p className="text-xs text-slate-500">
                  O sistema compensa automaticamente o que você pagou vs. o que cada viajante pagou e mostra o saldo líquido final em {activeTrip.currency}
                </p>
              </div>
            </div>

            {summary.simplifiedDebts.length === 0 ? (
              <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 p-5 text-center">
                <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600 mb-1.5" />
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  Tudo quitado entre os viajantes!
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Não há saldos pendentes de reembolso nesta viagem.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {summary.simplifiedDebts.map((debt, i) => {
                  const isMeReceiving = debt.toParticipantId === 'me';
                  const isMePaying = debt.fromParticipantId === 'me';
                  return (
                    <div
                      key={`${debt.fromParticipantId}-${debt.toParticipantId}-${i}`}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                              isMeReceiving
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : isMePaying
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {isMeReceiving
                              ? 'Você Recebe (Após Compensação)'
                              : isMePaying
                              ? 'Você Paga (Após Compensação)'
                              : 'Acerto entre Viajantes'}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            Câmbio Médio: {formatExchangeRateBR(debt.impliedEffectiveRate)}
                          </span>
                        </div>

                        <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                          <span className="text-rose-600 dark:text-rose-400">
                            {debt.fromName}
                          </span>{' '}
                          deve para{' '}
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {debt.toName}
                          </span>
                        </p>

                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-lg font-extrabold font-mono text-slate-900 dark:text-white">
                            {formatForeignCurrency(
                              debt.amountForeign,
                              activeTrip.currency
                            )}
                          </span>
                          <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-400">
                            (≈ {formatBRL(debt.amountBrlEffective)} pela média)
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenSettlementModal(debt)}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                        <span>
                          Liquidar / Receber ({activeTrip.currency} ou PIX)
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Participant Balance Table / Cards + Guest Mirror Preview */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                  Balanço Individual & Visão do Convidado ({activeTrip.currency})
                </h3>
                <p className="text-xs text-slate-500">
                  Clique em &ldquo;Ver Visão do Convidado&rdquo; para simular exatamente o que a pessoa convidada enxerga na conta dela em {activeTrip.currency}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {summary.participantBalances.map((pb) => {
                const rawPart = activeTrip.participants.find(
                  (p) => p.id === pb.participantId
                );
                const isGuestPreviewActive = guestPreviewParticipantId === pb.participantId;
                return (
                  <div
                    key={pb.participantId}
                    className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${
                      isGuestPreviewActive
                        ? 'border-sky-500 bg-sky-50/40 dark:bg-sky-950/30 ring-1 ring-sky-500'
                        : 'border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: pb.color }}
                          />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {pb.participantName}
                          </span>
                        </div>
                        {rawPart?.email && (
                          <span className="inline-flex items-center gap-1 mt-1 rounded bg-emerald-50 dark:bg-emerald-950/70 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <Mail className="h-2.5 w-2.5" />
                            {rawPart.email} (Sincronizado)
                          </span>
                        )}
                      </div>
                      {!pb.isMe && (
                        <button
                          type="button"
                          onClick={() =>
                            setGuestPreviewParticipantId(
                              isGuestPreviewActive ? null : pb.participantId
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/60 px-2 py-1 text-[10px] font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-100"
                        >
                          <Eye className="h-3 w-3" />
                          {isGuestPreviewActive ? 'Fechar Visão' : 'Visão Convidado'}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                      <div>
                        <span className="text-slate-400 block">Pagou na Viagem</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {formatForeignCurrency(pb.paidForeign, activeTrip.currency)}
                        </span>
                        <span className="block text-[10px] font-mono text-slate-400">
                          {formatBRL(pb.paidBrl)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Consumiu (Sua Parte)</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {formatForeignCurrency(
                            pb.consumedForeign,
                            activeTrip.currency
                          )}
                        </span>
                        <span className="block text-[10px] font-mono text-slate-400">
                          {formatBRL(pb.consumedBrl)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-500">
                        Saldo Compensado ({activeTrip.currency}):
                      </span>
                      <div className="text-right font-mono">
                        <span
                          className={`font-extrabold block ${
                            pb.netBalanceForeign > 0.01
                              ? 'text-emerald-600'
                              : pb.netBalanceForeign < -0.01
                              ? 'text-rose-600'
                              : 'text-slate-600'
                          }`}
                        >
                          {pb.netBalanceForeign > 0 ? '+' : ''}
                          {formatForeignCurrency(
                            pb.netBalanceForeign,
                            activeTrip.currency
                          )}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          ({pb.netBalanceBrl > 0 ? '+' : ''}
                          {formatBRL(pb.netBalanceBrl)})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Guest Mirror Panel in Trip Currency */}
            {guestPreviewParticipantId && (() => {
              const guestBal = summary.participantBalances.find(
                (p) => p.participantId === guestPreviewParticipantId
              );
              const guestPart = activeTrip.participants.find(
                (p) => p.id === guestPreviewParticipantId
              );
              if (!guestBal || !guestPart) return null;
              return (
                <div
                  data-testid="trip-guest-mirror-view"
                  className="rounded-2xl border-2 border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 p-4 space-y-3 animate-fade-in"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-300 block">
                        Espelho da Conta Convidada ({guestPart.email || 'Convidado da Viagem'})
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        O que {guestPart.name} vê ao acessar a viagem &ldquo;{activeTrip.name}&rdquo; (em {activeTrip.currency})
                      </h4>
                    </div>
                    <span className="rounded-lg bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-extrabold font-mono text-sky-900 dark:text-sky-200 border border-sky-200 dark:border-sky-800">
                      Moeda: {activeTrip.currency} (Sem misturar com R$)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-sky-200/80 dark:border-sky-800">
                      <span className="text-slate-500 block">Pagou pelo Grupo ({activeTrip.currency})</span>
                      <strong className="text-base font-mono text-emerald-700 dark:text-emerald-400">
                        {formatForeignCurrency(guestBal.paidForeign, activeTrip.currency)}
                      </strong>
                    </div>
                    <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-sky-200/80 dark:border-sky-800">
                      <span className="text-slate-500 block">Parte Consumida ({activeTrip.currency})</span>
                      <strong className="text-base font-mono text-rose-700 dark:text-rose-400">
                        {formatForeignCurrency(guestBal.consumedForeign, activeTrip.currency)}
                      </strong>
                    </div>
                    <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-sky-200/80 dark:border-sky-800">
                      <span className="text-slate-500 block">Resultado Final Compensado</span>
                      <strong
                        className={`text-base font-mono ${
                          guestBal.netBalanceForeign >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {guestBal.netBalanceForeign > 0.01
                          ? `Tem a receber ${formatForeignCurrency(guestBal.netBalanceForeign, activeTrip.currency)}`
                          : guestBal.netBalanceForeign < -0.01
                          ? `Deve pagar ${formatForeignCurrency(Math.abs(guestBal.netBalanceForeign), activeTrip.currency)}`
                          : 'Quitado (0,00)'}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* History of Recorded Settlements */}
            {activeTrip.settlements.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Histórico de Reembolsos & Acertos Realizados ({activeTrip.settlements.length})
                </h4>
                <div className="space-y-2">
                  {activeTrip.settlements.map((st) => {
                    const fromName =
                      activeTrip.participants.find(
                        (p) => p.id === st.fromParticipantId
                      )?.name || st.fromParticipantId;
                    const toName =
                      activeTrip.participants.find(
                        (p) => p.id === st.toParticipantId
                      )?.name || st.toParticipantId;
                    return (
                      <div
                        key={st.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2.5 text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {fromName} pagou {toName}
                          </span>
                          <span className="text-slate-500 ml-2">
                            ({formatShortDateBR(st.date)} •{' '}
                            {st.method === 'pix_brl'
                              ? 'PIX em Reais'
                              : st.method === 'wise_foreign'
                              ? `Transferência ${activeTrip.currency}`
                              : 'Espécie'}
                            )
                          </span>
                          {st.notes && (
                            <p className="text-[11px] text-slate-400">{st.notes}</p>
                          )}
                        </div>
                        <div className="text-right font-mono">
                          <span className="font-bold text-emerald-600">
                            {formatForeignCurrency(
                              st.foreignAmountEquivalent,
                              activeTrip.currency
                            )}
                          </span>
                          <span className="text-slate-500 ml-1.5">
                            ({formatBRL(st.brlAmountSettled)} @{' '}
                            {formatExchangeRateBR(st.exchangeRateUsed)})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
