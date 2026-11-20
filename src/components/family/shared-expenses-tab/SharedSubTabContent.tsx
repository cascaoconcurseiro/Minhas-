/** Conteúdo da subaba: pessoas e convites, despesas divididas e acertos. Parte de SharedExpensesTab (ver SharedExpensesTab.tsx). */
import { Check, CheckCircle2, Clock, Copy, Edit3, Eye, Mail, Plus, Trash2, UserPlus } from 'lucide-react';
import { FamilyInvitePanel } from '../FamilyInvitePanel';
import { formatBRL, formatMonthYearPT, formatShortDateBR } from '../../../domain/finance/financeRules';
import { CategoryIconBadge } from '../../ui/CategoryIconBadge';
import type { SharedExpensesTabContext } from './sharedExpensesTabContext';

export function SharedSubTabContent({ form }: { form: SharedExpensesTabContext }) {
  const {
    accMap,
    activeSubTab,
    activeSummary,
    cardMap,
    catMap,
    familyMembers,
    handleCopyWhatsAppInvoice,
    handleOpenAddMemberModal,
    handleOpenEditMemberModal,
    handleOpenSettlement,
    inviteCodes,
    inviteeHasAccount,
    isGuestMirrorView,
    memberSummaries,
    onAcceptFamilyInvite,
    onDeleteFamilyMember,
    onOpenNewSharedTransaction,
    onReopenSharedTransaction,
    onResendFamilyInvite,
    selectedMemberId,
    selectedMonth,
    setCopyFeedback,
    setIsGuestMirrorView,
    setSelectedMemberId,
  } = form;
  return (
    <>
{activeSubTab === 'members' ? (
        /* Family Members & Invites Management Screen */
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Pessoas da Família & Convites de Conta Compartilhada
              </h3>
              <p className="text-xs text-slate-500">
                Adicione o e-mail do familiar para que ele veja o que deve a você, o que você deve a ele e o valor líquido compensado
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddMemberModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap"
            >
              <UserPlus className="h-4 w-4" />
              Convidar Pessoa
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {familyMembers.map((member) => {
              const summary = memberSummaries.find((s) => s.member.id === member.id);
              const netVal = summary?.netCompensatedMonthAmount || 0;
              return (
                <div
                  key={member.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-xs"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {member.name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize">
                            {member.relationship}
                          </span>
                          {member.email ? (
                            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Mail className="h-2.5 w-2.5" />
                              {member.inviteStatus === 'invited'
                                ? 'Convite registrado'
                                : member.inviteStatus === 'accepted'
                                  ? 'Conta Vinculada'
                                  : 'Sem convite'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] text-slate-400 bg-slate-50">
                              Sem e-mail vinculado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditMemberModal(member)}
                        className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                        title="Editar pessoa / cadastrar e-mail do familiar"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const confirmed = window.confirm(
                            `Remover "${member.name}" do controle compartilhado? O convite será revogado e os lançamentos dessa pessoa deixarão de aparecer como compartilhados.`
                          );
                          if (confirmed) onDeleteFamilyMember(member.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Remover pessoa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {member.email && (
                    <div className="rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 p-2.5 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2">
                      <span className="break-words sm:truncate">
                        <strong>E-mail:</strong> {member.email}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {member.direction === 'incoming' &&
                        member.inviteStatus === 'invited' &&
                        onAcceptFamilyInvite ? (
                          <span className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
                            Aceite no aviso do topo, com o código
                          </span>
                        ) : (
                          <>
                            <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                              {member.inviteStatus === 'accepted'
                                ? 'Convite Aceito'
                                : 'Aguardando Aceite'}
                            </span>
                            {onResendFamilyInvite && (
                              <button
                                type="button"
                                onClick={() => {
                                  void (async () => {
                                    try {
                                      const result = await onResendFamilyInvite(member);
                                      setCopyFeedback(
                                        result === false
                                          ? 'Não foi possível atualizar o convite no app. Nenhum e-mail foi enviado; tente novamente após conferir a conexão.'
                                          : `Convite registrado no app para ${member.email}. Nenhum e-mail foi enviado; peça à pessoa que entre no Minhas Economias com esse mesmo e-mail para ver e aceitar o convite.`
                                      );
                                    } catch {
                                      setCopyFeedback('Não foi possível atualizar o convite no app. Nenhum e-mail foi enviado; tente novamente após conferir a conexão.');
                                    }
                                    setTimeout(() => setCopyFeedback(null), 5000);
                                  })();
                                }}
                                className="rounded border border-emerald-300 bg-white px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100"
                              >
                                Atualizar convite
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {member.email &&
                    member.direction !== 'incoming' &&
                    member.inviteStatus === 'invited' && (
                      <FamilyInvitePanel
                        email={member.email}
                        hasAccount={inviteeHasAccount?.[member.email.trim().toLowerCase()]}
                        inviteCode={inviteCodes?.[member.email.trim().toLowerCase()]}
                        onFeedback={(message) => {
                          setCopyFeedback(message);
                          setTimeout(() => setCopyFeedback(null), 4000);
                        }}
                      />
                    )}

                  {member.pixKey && (
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-800 dark:text-white">Chave PIX:</span>{' '}
                      {member.pixKey}
                    </div>
                  )}

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Saldo líquido compensado:</span>
                    <span
                      className={`font-bold tabular-nums font-display ${
                        netVal > 0
                          ? 'text-emerald-700'
                          : netVal < 0
                          ? 'text-rose-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {netVal > 0
                        ? `Me deve ${formatBRL(netVal)}`
                        : netVal < 0
                        ? `Eu devo ${formatBRL(Math.abs(netVal))}`
                        : 'Quitado (R$ 0,00)'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        /* Invoices & Bilateral Compensation View */
        <div className="space-y-6">
          {/* Family Member Selector Pills */}
          <section className="flex flex-wrap items-center gap-2">
            {familyMembers.map((member) => {
              const summary = memberSummaries.find((s) => s.member.id === member.id);
              const isSelected = member.id === selectedMemberId;
              const netVal = summary?.netCompensatedMonthAmount || 0;

              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedMemberId(member.id)}
                  className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-left transition-all whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'border-slate-900 dark:border-emerald-500 bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-900 dark:ring-emerald-500'
                      : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:bg-white text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                    style={{ backgroundColor: member.color }}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{member.name}</span>
                      {member.email && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title={`Vinculado: ${member.email}`} />
                      )}
                    </div>
                    <div className="text-[11px] tabular-nums">
                      {netVal > 0 ? (
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          Me deve líquido: {formatBRL(netVal)}
                        </span>
                      ) : netVal < 0 ? (
                        <span className="font-semibold text-rose-600 dark:text-rose-400">
                          Eu devo líquido: {formatBRL(Math.abs(netVal))}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-medium">
                          Compensado / Quitado
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </section>

          {/* Statement / Encontro de Contas Card for Active Family Member */}
          {activeSummary && (
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
              {/* Invoice Header */}
              <div className="border-b border-slate-200 bg-slate-900 text-white p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-inner shrink-0"
                      style={{ backgroundColor: activeSummary.member.color }}
                    >
                      {activeSummary.member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Encontro de Contas & Compensação Automática
                        </span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 capitalize">
                          {activeSummary.member.relationship}
                        </span>
                        {activeSummary.member.email ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            <Mail className="h-3 w-3" />
                            {activeSummary.member.email} ({activeSummary.member.inviteStatus === 'accepted' ? 'Convite Aceito' : 'Convite Pendente'})
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenEditMemberModal(activeSummary.member)}
                            className="inline-flex items-center gap-1 rounded bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 text-[10px] font-bold text-indigo-300 hover:bg-indigo-500/30 max-sm:min-h-10"
                          >
                            <Mail className="h-3 w-3" />
                            + Adicionar E-mail p/ Convite
                          </button>
                        )}
                      </div>
                      <h2 className="text-xl font-bold font-display text-white mt-0.5">
                        {activeSummary.member.name} — {formatMonthYearPT(selectedMonth)}
                      </h2>
                    </div>
                  </div>

                  {/* Actions on Invoice */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid="toggle-guest-family-mirror-btn"
                      onClick={() => setIsGuestMirrorView(!isGuestMirrorView)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                        isGuestMirrorView
                          ? 'border-sky-400 bg-sky-500 text-slate-950 font-bold'
                          : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      <Eye className="h-3.5 w-3.5 text-sky-400" />
                      {isGuestMirrorView
                        ? 'Fechar Visão do Convidado'
                        : `Ver Visão de ${activeSummary.member.name.split(' ')[0]}`}
                    </button>

                    {activeSummary.hasOpenItems && (
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenSettlement(
                            'all',
                            activeSummary.member.id,
                            activeSummary.netCompensatedMonthAmount,
                            activeSummary.netCompensatedMonthAmount >= 0 ? 'receive' : 'pay',
                            `Acerto Compensado de ${formatMonthYearPT(selectedMonth)} — ${activeSummary.member.name}`
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Liquidar este mês ({formatBRL(Math.abs(activeSummary.netCompensatedMonthAmount))})
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopyWhatsAppInvoice(activeSummary)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap"
                    >
                      <Copy className="h-3.5 w-3.5 text-emerald-400" />
                      Copiar p/ WhatsApp
                    </button>
                  </div>
                </div>

                {/* 4-Column Bilateral Compensation Equation Bar */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4 border-t border-slate-800 pt-4">
                  <div>
                    <span className="text-xs text-slate-400">
                      1. Parte de {activeSummary.member.name.split(' ')[0]} neste mês
                    </span>
                    <div className="text-xl font-bold tabular-nums font-display text-emerald-400 mt-0.5">
                      +{formatBRL(activeSummary.owedToMeMonthAmount)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">
                      2. Minha parte neste mês (Ele/ela pagou)
                    </span>
                    <div className="text-xl font-bold tabular-nums font-display text-amber-400 mt-0.5">
                      −{formatBRL(activeSummary.iOweMemberMonthAmount)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-300 font-semibold">
                      3. Valor Real (Compensado)
                    </span>
                    <div className="text-2xl font-extrabold tabular-nums font-display text-white mt-0.5">
                      {activeSummary.netCompensatedMonthAmount > 0
                        ? `${activeSummary.member.name.split(' ')[0]} paga ${formatBRL(
                            activeSummary.netCompensatedMonthAmount
                          )}`
                        : activeSummary.netCompensatedMonthAmount < 0
                        ? `Você paga ${formatBRL(
                            Math.abs(activeSummary.netCompensatedMonthAmount)
                          )}`
                        : 'R$ 0,00 (Quitado)'}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Status no Mês</span>
                    <div className="mt-1">
                      {activeSummary.hasOpenItems ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-300 border border-amber-500/30">
                          <Clock className="h-3.5 w-3.5" />
                          Aguardando Compensação
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                          <Check className="h-3.5 w-3.5" />
                          100% Quitado
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Guest Mirror Preview (What the invited family member sees when logged into their account) */}
              {isGuestMirrorView && (
                <div
                  data-testid="family-guest-mirror-card"
                  className="border-b-2 border-sky-500 bg-sky-50/90 dark:bg-sky-950/50 p-5 space-y-3 animate-fade-in"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-300 block">
                        Simulação da Conta Convidada ({activeSummary.member.email || 'Familiar Convidado'})
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Visão Espelhada de {activeSummary.member.name} ao aceitar o convite por e-mail
                      </h4>
                    </div>
                    <span className="rounded-lg bg-white dark:bg-slate-900 px-3 py-1 text-xs font-bold text-sky-900 dark:text-sky-200 border border-sky-200 dark:border-sky-800">
                      Prévia calculada para a conta convidada (R$)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-xl bg-white dark:bg-slate-900 p-3.5 border border-sky-200 dark:border-sky-800">
                      <span className="text-slate-500 block">
                        O que {activeSummary.member.name.split(' ')[0]} deve a você:
                      </span>
                      <strong className="text-base font-mono text-rose-700 dark:text-rose-400">
                        {formatBRL(activeSummary.owedToMeMonthAmount)}
                      </strong>
                    </div>
                    <div className="rounded-xl bg-white dark:bg-slate-900 p-3.5 border border-sky-200 dark:border-sky-800">
                      <span className="text-slate-500 block">
                        O que você deve a {activeSummary.member.name.split(' ')[0]}:
                      </span>
                      <strong className="text-base font-mono text-emerald-700 dark:text-emerald-400">
                        {formatBRL(activeSummary.iOweMemberMonthAmount)}
                      </strong>
                    </div>
                    <div className="rounded-xl bg-white dark:bg-slate-900 p-3.5 border border-sky-200 dark:border-sky-800">
                      <span className="text-slate-500 block">
                        Resultado Final Compensado p/ {activeSummary.member.name.split(' ')[0]}:
                      </span>
                      <strong className="text-base font-mono text-slate-900 dark:text-white">
                        {activeSummary.netCompensatedMonthAmount > 0
                          ? `Pagar ${formatBRL(activeSummary.netCompensatedMonthAmount)} a você`
                          : activeSummary.netCompensatedMonthAmount < 0
                          ? `Receber ${formatBRL(
                              Math.abs(activeSummary.netCompensatedMonthAmount)
                            )} de você`
                          : 'Tudo quitado (R$ 0,00)'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Items List (Extrato da Fatura Compartilhada) */}
              <div className="p-6 space-y-4">
                {(activeSummary.futureInstallmentReceivable > 0 || activeSummary.futureInstallmentPayable > 0) && (
                  <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900" data-testid="future-shared-installments">
                    Parcelas futuras, fora do acerto deste mês: a receber {formatBRL(activeSummary.futureInstallmentReceivable)} · a pagar {formatBRL(activeSummary.futureInstallmentPayable)}.
                    Cada cota entra no acerto da sua competência; a compra parcelada não é cobrada inteira neste mês.
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Lançamentos Compartilhados Nacionais ({activeSummary.monthTxs.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => onOpenNewSharedTransaction(activeSummary.member.id)}
                    className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar Despesa Compartilhada
                  </button>
                </div>

                {activeSummary.monthTxs.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
                    Nenhuma despesa compartilhada registrada com {activeSummary.member.name} em{' '}
                    {formatMonthYearPT(selectedMonth)}.
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => onOpenNewSharedTransaction(activeSummary.member.id)}
                        className="text-emerald-700 font-semibold hover:underline"
                      >
                        Clique para lançar uma despesa dividida (paga por você ou pelo familiar).
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    {activeSummary.monthTxs.map((tx) => {
                      const cat = catMap.get(tx.categoryId);
                      const isPending = tx.sharedStatus !== 'received';
                      const paidByMember = tx.sharedPaidBy === 'member';
                      const splitLabel =
                        tx.sharedSplitMode === 'half'
                          ? 'Dividido 50%'
                          : tx.sharedSplitMode === 'full'
                          ? '100% da Pessoa'
                          : 'Personalizado';

                      return (
                        <div
                          key={tx.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <div className="flex items-start sm:items-center gap-3">
                            <CategoryIconBadge
                              icon={cat?.icon}
                              color={cat?.color}
                              size="md"
                            />
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                  {tx.description}
                                </span>

                                <span
                                  className={`rounded px-2 py-0.5 text-[10px] font-bold border ${
                                    paidByMember
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                  }`}
                                >
                                  {paidByMember
                                    ? `🤝 ${activeSummary.member.name.split(' ')[0]} pagou (Eu devo)`
                                    : `👤 Eu paguei (${activeSummary.member.name.split(' ')[0]} me deve)`}
                                </span>

                                <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {splitLabel}
                                </span>

                                {tx.installmentNumber && (
                                  <span className="rounded bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 border border-violet-200">
                                    Parcela {tx.installmentNumber}/{tx.installmentTotal}
                                  </span>
                                )}

                                {isPending ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                                    <Clock className="h-2.5 w-2.5" />
                                    Entra na Compensação
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                                    <Check className="h-2.5 w-2.5" />
                                    Liquidado{' '}
                                    {tx.sharedSettledDate
                                      ? `em ${formatShortDateBR(tx.sharedSettledDate)}`
                                      : ''}
                                  </span>
                                )}
                                {tx.sharedRemoteStatus === 'received' && isPending && (
                                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs text-sky-800">
                                    {activeSummary.member.name.split(' ')[0]} informou o acerto. Confira o recebimento ou pagamento antes de confirmar.
                                  </span>
                                )}
                                {tx.sharedRemoteStatus === 'pending' && !isPending && (
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">O acerto foi reaberto pela outra pessoa. Confira antes de estornar.</span>
                                )}

                                {(activeSummary.member.email ||
                                  activeSummary.member.invitedByEmail) && (
                                  <span
                                    data-testid="shared-tx-cloud-sync-badge"
                                    className="inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                                  >
                                    {activeSummary.member.inviteStatus === 'accepted' ? 'Compartilhamento vinculado a ' : 'Convite pendente para '}
                                    {activeSummary.member.email ||
                                      activeSummary.member.invitedByEmail}
                                  </span>
                                )}
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span>{formatShortDateBR(tx.date)}</span>
                                <span>•</span>
                                <span>
                                  {paidByMember
                                    ? `Pago diretamente por ${activeSummary.member.name}`
                                    : tx.creditCardId
                                    ? `Pago no seu cartão ${cardMap.get(tx.creditCardId)}`
                                    : tx.accountId
                                    ? `Pago via ${accMap.get(tx.accountId)}`
                                    : 'Pago no caixa'}
                                </span>
                                <span>•</span>
                                <span>{tx.installmentNumber ? `Compra ${formatBRL(tx.installmentPurchaseTotal ?? tx.amount)} em ${tx.installmentTotal}x · parcela ${formatBRL(tx.amount)}` : `Valor total da compra: ${formatBRL(tx.amount)}`}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                            <div className="text-right">
                              <div
                                className={`text-base font-bold tabular-nums font-display ${
                                  paidByMember
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : 'text-emerald-700 dark:text-emerald-400'
                                }`}
                              >
                                {paidByMember ? '−' : '+'}
                                {formatBRL(tx.sharedAmount || 0)}
                              </div>
                              <span className="text-[11px] text-slate-500">
                                {tx.installmentNumber
                                  ? `Cota da parcela ${tx.installmentNumber}/${tx.installmentTotal} · ${formatMonthYearPT(tx.competenceMonth)}`
                                  : paidByMember ? 'Eu devo esta parte' : 'Me deve esta parte'}
                              </span>
                            </div>

                            <div>
                              {isPending ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenSettlement(
                                      'single',
                                      activeSummary.member.id,
                                      tx.sharedAmount || 0,
                                      paidByMember ? 'pay' : 'receive',
                                      tx.description,
                                      tx.id
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Liquidar Item
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onReopenSharedTransaction(tx.id)}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 transition-colors whitespace-nowrap"
                                  title="Desfazer e reabrir pendência"
                                >
                                  Reabrir
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
