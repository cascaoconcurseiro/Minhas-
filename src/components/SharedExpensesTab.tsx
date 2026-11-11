import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Edit3,
  Eye,
  Mail,
  Plus,
  Receipt,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  BankAccount,
  Category,
  CreditCard as CreditCardType,
  FamilyMember,
  Transaction,
} from '../types/finance';
import {
  formatBRL,
  formatMonthYearPT,
  formatShortDateBR,
} from '../utils/financeRules';
import { CategoryIconBadge } from './CategoryIconBadge';
import { InstitutionMark } from './InstitutionMark';

interface SharedExpensesTabProps {
  selectedMonth: string;
  transactions: Transaction[];
  familyMembers: FamilyMember[];
  accounts: BankAccount[];
  cards: CreditCardType[];
  categories: Category[];
  onAddFamilyMember: (member: Omit<FamilyMember, 'id'>) => void | boolean | Promise<void | boolean>;
  onUpdateFamilyMember: (member: FamilyMember) => void | boolean | Promise<void | boolean>;
  onDeleteFamilyMember: (memberId: string) => void;
  onSettleSharedTransaction: (
    txId: string,
    receivingAccountId: string,
    settledDate: string
  ) => void;
  onSettleAllMemberInvoices: (
    memberId: string,
    month: string,
    receivingAccountId: string,
    settledDate: string
  ) => void;
  onReopenSharedTransaction: (txId: string) => void;
  onOpenNewSharedTransaction: (memberId?: string) => void;
  onAcceptFamilyInvite?: (member: FamilyMember) => void;
  onDeclineFamilyInvite?: (member: FamilyMember) => void;
  onResendFamilyInvite?: (member: FamilyMember) => void | boolean | Promise<void | boolean>;
  userPixKey?: string;
}

const MEMBER_COLORS = [
  '#ec4899', // pink
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#6366f1', // indigo
];

export const SharedExpensesTab: React.FC<SharedExpensesTabProps> = ({
  selectedMonth,
  transactions,
  familyMembers,
  accounts,
  cards,
  categories,
  onAddFamilyMember,
  onUpdateFamilyMember,
  onDeleteFamilyMember,
  onSettleSharedTransaction,
  onSettleAllMemberInvoices,
  onReopenSharedTransaction,
  onOpenNewSharedTransaction,
  onAcceptFamilyInvite,
  onDeclineFamilyInvite,
  onResendFamilyInvite,
  userPixKey,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    familyMembers[0]?.id || ''
  );
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'members'>('invoices');
  const [isGuestMirrorView, setIsGuestMirrorView] = useState<boolean>(false);

  React.useEffect(() => {
    if (
      familyMembers.length > 0 &&
      (!selectedMemberId || !familyMembers.some((m) => m.id === selectedMemberId))
    ) {
      setSelectedMemberId(familyMembers[0].id);
    }
  }, [familyMembers, selectedMemberId]);

  // Settlement modal state
  const [settlementTarget, setSettlementTarget] = useState<{
    type: 'single' | 'all';
    txId?: string;
    memberId: string;
    amount: number;
    netDirection: 'receive' | 'pay';
    description: string;
  } | null>(null);

  const [settleAccountId, setSettleAccountId] = useState(accounts[0]?.id || '');
  const selectedSettlementAccount =
    accounts.find((account) => account.id === settleAccountId) ?? accounts[0] ?? null;
  useEffect(() => {
    if (
      (!settleAccountId || !accounts.some((a) => a.id === settleAccountId)) &&
      accounts.length > 0
    ) {
      setSettleAccountId(accounts[0].id);
    }
  }, [accounts, settleAccountId]);
  const [settleDate, setSettleDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;
  });
  const [settlementError, setSettlementError] = useState<string | null>(null);

  // Family Member form state (Add/Edit + Email Invite)
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberInviteStatus, setMemberInviteStatus] =
    useState<'none' | 'invited' | 'accepted'>('invited');
  const [memberRelation, setMemberRelation] = useState<FamilyMember['relationship']>('cônjuge');
  const [memberColor, setMemberColor] = useState(MEMBER_COLORS[0]);
  const [memberPixKey, setMemberPixKey] = useState('');
  const [memberNotes, setMemberNotes] = useState('');
  const [memberSaveError, setMemberSaveError] = useState<string | null>(null);
  const [isSavingMember, setIsSavingMember] = useState(false);

  // WhatsApp / Invite feedback toast
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c.name])), [cards]);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  // Filter domestic shared transactions ONLY (exclude international trip expenses so currencies never mix)
  const allSharedTxs = useMemo(() => {
    return transactions.filter((tx) => tx.isShared && tx.sharedMemberId && !tx.tripId);
  }, [transactions]);

  // Group shared transactions by member with bilateral compensation ("O que me deve" - "O que eu devo")
  const memberSummaries = useMemo(() => {
    return familyMembers.map((member) => {
      const monthTxs = allSharedTxs.filter(
        (tx) => tx.sharedMemberId === member.id && tx.competenceMonth === selectedMonth
      );
      const allTimeTxs = allSharedTxs.filter((tx) => tx.sharedMemberId === member.id);

      const pendingMonthTxs = monthTxs.filter((tx) => tx.sharedStatus !== 'received');

      // What the member owes me (I paid the bill)
      const owedToMeMonthAmount = pendingMonthTxs
        .filter((tx) => tx.sharedPaidBy !== 'member')
        .reduce((acc, tx) => acc + (tx.sharedAmount || 0), 0);

      // What I owe the member (Member paid the bill)
      const iOweMemberMonthAmount = pendingMonthTxs
        .filter((tx) => tx.sharedPaidBy === 'member')
        .reduce((acc, tx) => acc + (tx.sharedAmount || 0), 0);

      // Compensated Net Balance: positive = member owes me; negative = I owe member
      const netCompensatedMonthAmount =
        Math.round((owedToMeMonthAmount - iOweMemberMonthAmount) * 100) / 100;

      const receivedMonthAmount = monthTxs
        .filter((tx) => tx.sharedStatus === 'received')
        .reduce((acc, tx) => acc + (tx.sharedAmount || 0), 0);

      const allTimePendingAmount = allTimeTxs
        .filter((tx) => tx.sharedStatus !== 'received')
        .reduce(
          (acc, tx) =>
            acc +
            (tx.sharedPaidBy === 'member'
              ? -(tx.sharedAmount || 0)
              : tx.sharedAmount || 0),
          0
        );

      return {
        member,
        monthTxs,
        owedToMeMonthAmount: Math.round(owedToMeMonthAmount * 100) / 100,
        iOweMemberMonthAmount: Math.round(iOweMemberMonthAmount * 100) / 100,
        netCompensatedMonthAmount,
        pendingMonthAmount: Math.abs(netCompensatedMonthAmount),
        receivedMonthAmount: Math.round(receivedMonthAmount * 100) / 100,
        allTimePendingAmount: Math.round(allTimePendingAmount * 100) / 100,
        totalMonthItems: monthTxs.length,
        hasOpenItems: pendingMonthTxs.length > 0,
      };
    });
  }, [familyMembers, allSharedTxs, selectedMonth]);

  // Overall totals across all family members
  const overallOwedToMeThisMonth = useMemo(() => {
    return memberSummaries.reduce((acc, s) => acc + s.owedToMeMonthAmount, 0);
  }, [memberSummaries]);

  const overallIOweMembersThisMonth = useMemo(() => {
    return memberSummaries.reduce((acc, s) => acc + s.iOweMemberMonthAmount, 0);
  }, [memberSummaries]);

  const overallNetCompensatedThisMonth = useMemo(() => {
    return Math.round((overallOwedToMeThisMonth - overallIOweMembersThisMonth) * 100) / 100;
  }, [overallOwedToMeThisMonth, overallIOweMembersThisMonth]);

  const overallReceivedThisMonth = useMemo(() => {
    return memberSummaries.reduce((acc, s) => acc + s.receivedMonthAmount, 0);
  }, [memberSummaries]);

  // Current active member
  const activeSummary = useMemo(() => {
    return (
      memberSummaries.find((s) => s.member.id === selectedMemberId) ||
      memberSummaries[0]
    );
  }, [memberSummaries, selectedMemberId]);

  // Actions
  const handleOpenAddMemberModal = () => {
    setMemberSaveError(null);
    setEditingMember(null);
    setMemberName('');
    setMemberEmail('');
    setMemberInviteStatus('invited');
    setMemberRelation('cônjuge');
    setMemberColor(MEMBER_COLORS[familyMembers.length % MEMBER_COLORS.length]);
    setMemberPixKey('');
    setMemberNotes('');
    setShowMemberModal(true);
  };

  const handleOpenEditMemberModal = (member: FamilyMember) => {
    setMemberSaveError(null);
    setEditingMember(member);
    setMemberName(member.name);
    setMemberEmail(member.email || '');
    setMemberInviteStatus(member.inviteStatus || (member.email ? 'accepted' : 'none'));
    setMemberRelation(member.relationship);
    setMemberColor(member.color);
    setMemberPixKey(member.pixKey || '');
    setMemberNotes(member.notes || '');
    setShowMemberModal(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim() || isSavingMember) return;
    const cleanEmail = memberEmail.trim().toLowerCase();
    setMemberSaveError(null);

    if (editingMember) {
      const updatedMember: FamilyMember = {
        ...editingMember,
        name: memberName.trim(),
        email: cleanEmail || undefined,
        inviteStatus: cleanEmail ? memberInviteStatus : 'none',
        invitedAt:
          cleanEmail && !editingMember.invitedAt
            ? new Date().toISOString().slice(0, 10)
            : editingMember.invitedAt,
        relationship: memberRelation,
        color: memberColor,
        pixKey: memberPixKey.trim() || undefined,
        notes: memberNotes.trim() || undefined,
      };
      setIsSavingMember(true);
      try {
        const result = await onUpdateFamilyMember(updatedMember);
        if (result === false) {
          setMemberSaveError('Não foi possível atualizar o vínculo familiar. Verifique a conexão e tente novamente.');
          return;
        }
      } catch {
        setMemberSaveError('Não foi possível atualizar o vínculo familiar. Verifique a conexão e tente novamente.');
        return;
      } finally {
        setIsSavingMember(false);
      }
    } else {
      const newMember: Omit<FamilyMember, 'id'> = {
        name: memberName.trim(),
        email: cleanEmail || undefined,
        inviteStatus: cleanEmail ? 'invited' : 'none',
        direction: cleanEmail ? 'outgoing' : undefined,
        invitedAt: cleanEmail ? new Date().toISOString().slice(0, 10) : undefined,
        relationship: memberRelation,
        color: memberColor,
        pixKey: memberPixKey.trim() || undefined,
        notes: memberNotes.trim() || undefined,
      };
      if (cleanEmail) {
        setIsSavingMember(true);
        try {
          const result = await onAddFamilyMember(newMember);
          if (result === false) {
            setMemberSaveError('Não foi possível registrar o convite. Verifique a conexão e tente novamente. Nenhum e-mail foi enviado.');
            return;
          }
        } catch {
          setMemberSaveError('Não foi possível registrar o convite. Verifique a conexão e tente novamente. Nenhum e-mail foi enviado.');
          return;
        } finally {
          setIsSavingMember(false);
        }
      } else {
        await onAddFamilyMember(newMember);
      }
    }
    if (cleanEmail && !editingMember) {
      setCopyFeedback(
        `Convite registrado no app para ${cleanEmail}. Nenhum e-mail foi enviado; peça à pessoa que entre no Minhas Economias com esse mesmo e-mail para ver e aceitar o convite.`
      );
      setTimeout(() => setCopyFeedback(null), 5000);
    }
    setShowMemberModal(false);
  };

  const handleOpenSettlement = (
    type: 'single' | 'all',
    memberId: string,
    amount: number,
    netDirection: 'receive' | 'pay',
    description: string,
    txId?: string
  ) => {
    setSettlementError(null);
    setSettlementTarget({
      type,
      memberId,
      amount: Math.abs(amount),
      netDirection,
      description,
      txId,
    });
  };

  const handleConfirmSettlement = () => {
    if (!settlementTarget) return;
    if (!settleAccountId || !accounts.some((account) => account.id === settleAccountId)) {
      setSettlementError('Cadastre ou selecione uma conta bancária válida antes de liquidar.');
      return;
    }
    const parsedDate = new Date(`${settleDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(settleDate) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== settleDate) {
      setSettlementError('Informe uma data válida para o acerto.');
      return;
    }

    if (settlementTarget.type === 'single' && settlementTarget.txId) {
      onSettleSharedTransaction(settlementTarget.txId, settleAccountId, settleDate);
    } else if (settlementTarget.type === 'all') {
      onSettleAllMemberInvoices(
        settlementTarget.memberId,
        selectedMonth,
        settleAccountId,
        settleDate
      );
    }
    setSettlementError(null);
    setSettlementTarget(null);
  };

  const handleCopyWhatsAppInvoice = (summary: typeof activeSummary) => {
    if (!summary) return;
    const member = summary.member;
    const pendingTxs = summary.monthTxs.filter((tx) => tx.sharedStatus !== 'received');

    if (pendingTxs.length === 0) {
      setCopyFeedback('Não há despesas em aberto para este mês.');
      setTimeout(() => setCopyFeedback(null), 3000);
      return;
    }

    const itemsText = pendingTxs
      .map(
        (tx) =>
          `• ${tx.description} (${formatShortDateBR(tx.date)} — ${
            tx.sharedPaidBy === 'member' ? `${member.name} pagou` : 'Eu paguei'
          }): ${formatBRL(tx.sharedAmount || 0)}`
      )
      .join('\n');

    const netLine =
      summary.netCompensatedMonthAmount >= 0
        ? `*Saldo Líquido a me pagar (após compensação): ${formatBRL(
            summary.netCompensatedMonthAmount
          )}*`
        : `*Saldo Líquido que eu te devo (após compensação): ${formatBRL(
            Math.abs(summary.netCompensatedMonthAmount)
          )}*`;

    const pixLine = userPixKey?.trim()
      ? `Chave PIX: ${userPixKey.trim()}`
      : member.pixKey
      ? `Chave PIX cadastrada: ${member.pixKey}`
      : 'Combinamos o acerto pelo PIX!';

    const message = `Olá, ${member.name.split(' ')[0]}!\n\nSegue o encontro de contas das nossas despesas compartilhadas de *${formatMonthYearPT(
      selectedMonth
    )}*:\n\n${itemsText}\n\n• O que você me deve: ${formatBRL(
      summary.owedToMeMonthAmount
    )}\n• O que eu te devo: ${formatBRL(
      summary.iOweMemberMonthAmount
    )}\n${netLine}\n\n${pixLine}`;

    navigator.clipboard.writeText(message);
    setCopyFeedback('Resumo compensado copiado para enviar no WhatsApp!');
    setTimeout(() => setCopyFeedback(null), 3500);
  };

  const pendingIncomingInvites = useMemo(
    () =>
      familyMembers.filter(
        (m) => m.direction === 'incoming' && m.inviteStatus === 'invited'
      ),
    [familyMembers]
  );

  return (
    <div className="module-page space-y-6">
      {/* Incoming Family Invitations Banner */}
      {pendingIncomingInvites.length > 0 && (
        <div
          data-testid="incoming-family-invites-card"
          className="rounded-2xl border-2 border-indigo-400 bg-indigo-50/90 dark:bg-indigo-950/50 p-4 sm:p-5 space-y-3 shadow-xs"
        >
          {pendingIncomingInvites.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                  <Mail className="h-3 w-3" />
                  Convite Familiar Recebido
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  {inv.invitedByName || inv.name} ({inv.invitedByEmail || inv.email}) convidou você para a Divisão Familiar
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Ao aceitar, suas despesas compartilhadas e o encontro de contas ficam sincronizados entre as contas.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  data-testid={`accept-family-invite-${inv.id}`}
                  onClick={() => onAcceptFamilyInvite && onAcceptFamilyInvite(inv)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Aceitar Convite
                </button>
                <button
                  type="button"
                  data-testid={`decline-family-invite-${inv.id}`}
                  onClick={() => onDeclineFamilyInvite && onDeclineFamilyInvite(inv)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top Banner & Bilateral Compensation KPI Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
        {/* KPI 1: Me Devem vs. Eu Devo */}
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              Me Devem vs. Eu Devo ({formatMonthYearPT(selectedMonth)})
            </span>
            <ArrowLeftRight className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">
                Me Devem
              </span>
              <span className="text-base font-bold tabular-nums text-emerald-800 dark:text-emerald-300 font-display">
                {formatBRL(overallOwedToMeThisMonth)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 block">
                Eu Devo
              </span>
              <span className="text-base font-bold tabular-nums text-amber-800 dark:text-amber-300 font-display">
                {formatBRL(overallIOweMembersThisMonth)}
              </span>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-indigo-800 dark:text-indigo-300">
            Apenas despesas nacionais em R$ (viagens ficam na moeda da viagem)
          </p>
        </div>

        {/* KPI 2: Saldo Líquido Compensado (Encontro de Contas) */}
        <div
          data-testid="shared-net-compensation-kpi"
          className={`rounded-xl border p-4 ${
            overallNetCompensatedThisMonth >= 0
              ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30'
              : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Valor Real Após Compensação
            </span>
            <Receipt className="h-4 w-4 text-emerald-600" />
          </div>
          <div
            className={`mt-2 text-xl font-bold tabular-nums font-display ${
              overallNetCompensatedThisMonth > 0
                ? 'text-emerald-900 dark:text-emerald-300'
                : overallNetCompensatedThisMonth < 0
                ? 'text-rose-900 dark:text-rose-300'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {overallNetCompensatedThisMonth > 0
              ? `Receber ${formatBRL(overallNetCompensatedThisMonth)}`
              : overallNetCompensatedThisMonth < 0
              ? `Pagar ${formatBRL(Math.abs(overallNetCompensatedThisMonth))}`
              : 'R$ 0,00 (Quitado)'}
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Diferença líquida automática (Me devem − Eu devo) • Quitado no mês: {formatBRL(overallReceivedThisMonth)}
          </p>
        </div>

        {/* KPI 3: Família & Contas Vinculadas por E-mail */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Família & Convites por E-mail
            </span>
            <Users className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-2 text-xl font-bold tabular-nums text-slate-900 dark:text-white font-display">
            {familyMembers.length} pessoa(s)
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {familyMembers.filter((m) => Boolean(m.email)).length} vinculada(s) a um e-mail
          </p>
        </div>

        {/* KPI 4: Botões de Ação Rápida */}
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex flex-col justify-center gap-2">
          <button
            type="button"
            data-testid="new-shared-expense-btn"
            onClick={() => onOpenNewSharedTransaction(selectedMemberId)}
            className="w-full min-w-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold leading-tight text-center text-white hover:bg-emerald-700 transition-colors whitespace-normal"
          >
            <Plus className="h-4 w-4" />
            + Nova Despesa Compartilhada
          </button>
          <button
            type="button"
            data-testid="invite-family-member-btn"
            onClick={handleOpenAddMemberModal}
            className="w-full min-w-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold leading-tight text-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors whitespace-normal"
          >
            <Mail className="h-3.5 w-3.5 text-indigo-600" />
            + Cadastrar convite familiar
          </button>
        </div>
      </section>

      {/* Module Navigation: Encontro de Contas vs. Gerenciar Pessoas & Convites */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('invoices')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeSubTab === 'invoices'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            Encontro de Contas & Compensação ({familyMembers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('members')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeSubTab === 'members'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Pessoas & Convites por E-mail
          </button>
        </div>

        {copyFeedback && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 animate-fade-in">
            {copyFeedback}
          </div>
        )}
      </div>

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
                      <span className="truncate">
                        <strong>E-mail:</strong> {member.email}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {member.direction === 'incoming' &&
                        member.inviteStatus === 'invited' &&
                        onAcceptFamilyInvite ? (
                          <button
                            type="button"
                            onClick={() => onAcceptFamilyInvite(member)}
                            className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-700"
                          >
                            Aceitar Convite
                          </button>
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
                            {activeSummary.member.email} (Convite Aceito)
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenEditMemberModal(activeSummary.member)}
                            className="inline-flex items-center gap-1 rounded bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 text-[10px] font-bold text-indigo-300 hover:bg-indigo-500/30"
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
                        Liquidar Saldo Compensado ({formatBRL(Math.abs(activeSummary.netCompensatedMonthAmount))})
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
                      1. {activeSummary.member.name.split(' ')[0]} me deve (Eu paguei)
                    </span>
                    <div className="text-xl font-bold tabular-nums font-display text-emerald-400 mt-0.5">
                      +{formatBRL(activeSummary.owedToMeMonthAmount)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">
                      2. Eu devo a {activeSummary.member.name.split(' ')[0]} (Ele/ela pagou)
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

                                {(activeSummary.member.email ||
                                  activeSummary.member.invitedByEmail) && (
                                  <span
                                    data-testid="shared-tx-cloud-sync-badge"
                                    className="inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                                  >
                                    ☁️ Sincronizado com{' '}
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
                                <span>Valor total da compra: {formatBRL(tx.amount)}</span>
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
                                {paidByMember ? 'Eu devo esta parte' : 'Me deve esta parte'}
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
          <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-modal-in">
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
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.institution})
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

      {/* Add / Edit Family Member + Email Invite Modal */}
      {showMemberModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px] modal-shell"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowMemberModal(false);
          }}
        >
          <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-modal-in">
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingMember
                    ? 'Editar familiar / vínculo por e-mail'
                    : 'Cadastrar familiar na conta compartilhada'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  O convite fica registrado no app; nenhum e-mail é enviado. A pessoa precisa entrar no Minhas Economias com o mesmo e-mail para ver e aceitar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMemberModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveMember}
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                {memberSaveError && (
                  <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                    {memberSaveError}
                  </p>
                )}
                <div>
                  <label htmlFor="shared-member-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome Completo ou Apelido:
                  </label>
                  <input
                    type="text"
                    id="shared-member-name"
                    required
                    placeholder="ex: Mariana (Esposa), Lucas (Irmão)"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="shared-member-email" className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail da pessoa (para vincular a conta):
                  </label>
                  <input
                    type="email"
                    id="shared-member-email"
                    data-testid="family-member-email-input"
                    placeholder="colega@exemplo.com"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                  <span className="block text-[11px] text-slate-500 mt-1">
                    Ao aceitar, a pessoa visualiza em tempo real o que deve a você, o que você deve a ela e o saldo compensado.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="shared-member-relationship" className="block text-xs font-semibold text-slate-700 mb-1">
                      Parentesco:
                    </label>
                    <select
                      id="shared-member-relationship"
                      value={memberRelation}
                      onChange={(e) =>
                        setMemberRelation(e.target.value as FamilyMember['relationship'])
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="cônjuge">Cônjuge / Esposo(a)</option>
                      <option value="filho(a)">Filho(a)</option>
                      <option value="pai/mãe">Pai / Mãe</option>
                      <option value="irmão/irmã">Irmão / Irmã</option>
                      <option value="amigo(a)">Amigo(a) / Colega</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>

                  <div>
                    <span className="block text-xs font-semibold text-slate-700 mb-1">
                      Cor de Destaque:
                    </span>
                    <div className="flex items-center gap-1.5 pt-1">
                      {MEMBER_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Cor ${c}`}
                          aria-pressed={memberColor === c}
                          onClick={() => setMemberColor(c)}
                          className={`h-6 w-6 rounded-full transition-transform ${
                            memberColor === c ? 'scale-110 ring-2 ring-slate-900 ring-offset-1' : ''
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="shared-member-pix" className="block text-xs font-semibold text-slate-700 mb-1">
                    Chave PIX da Pessoa (Opcional):
                  </label>
                  <input
                    type="text"
                    id="shared-member-pix"
                    placeholder="ex: CPF, e-mail ou celular"
                    value={memberPixKey}
                    onChange={(e) => setMemberPixKey(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="shared-member-notes" className="block text-xs font-semibold text-slate-700 mb-1">
                    Anotações ou Regra de Divisão:
                  </label>
                  <input
                    type="text"
                    id="shared-member-notes"
                    placeholder="ex: Dividimos compras do mercado 50/50"
                    value={memberNotes}
                    onChange={(e) => setMemberNotes(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="shrink-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-6 py-3.5">
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingMember}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:cursor-wait disabled:opacity-70"
                >
                  {isSavingMember
                    ? editingMember ? 'Atualizando vínculo...' : 'Registrando convite...'
                    : memberEmail.trim()
                      ? 'Salvar e registrar convite'
                      : 'Salvar pessoa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
