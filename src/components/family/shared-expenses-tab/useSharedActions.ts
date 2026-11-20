/** Ações: cadastrar pessoa, salvar, acertar, copiar cobrança e convites. Parte de SharedExpensesTab (ver SharedExpensesTab.tsx). */
import { FamilyMember } from '../../../types/finance';
import React, { useMemo } from 'react';
import { formatBRL, formatMonthYearPT, formatShortDateBR, getLocalDateISO } from '../../../domain/finance/financeRules';
import { isValidISODate } from '../../../domain/finance/formatting';
import { MEMBER_COLORS } from './sharedExpensesTabConfig';
import type { SharedExpensesTabPropsApi } from './sharedExpensesTabConfig';
import type { SharedStateApi } from './useSharedState';
import type { SharedDerivedApi } from './useSharedDerived';

export function useSharedActions(ctx: SharedExpensesTabPropsApi & SharedStateApi & SharedDerivedApi) {
  const {
    activeSummary,
    brlAccounts,
    editingMember,
    familyMembers,
    isSavingMember,
    memberColor,
    memberEmail,
    memberInviteStatus,
    memberName,
    memberNotes,
    memberPixKey,
    memberRelation,
    onAddFamilyMember,
    onSettleAllMemberInvoices,
    onSettleSharedTransaction,
    onUpdateFamilyMember,
    selectedMonth,
    setCopyFeedback,
    setEditingMember,
    setIsSavingMember,
    setMemberColor,
    setMemberEmail,
    setMemberInviteStatus,
    setMemberName,
    setMemberNotes,
    setMemberPixKey,
    setMemberRelation,
    setMemberSaveError,
    setSettlementError,
    setSettlementTarget,
    setShowMemberModal,
    settleAccountId,
    settleDate,
    settlementTarget,
    userPixKey,
  } = ctx;
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
            ? getLocalDateISO()
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
        invitedAt: cleanEmail ? getLocalDateISO() : undefined,
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
    if (!settleAccountId || !brlAccounts.some((account) => account.id === settleAccountId)) {
      setSettlementError('Cadastre ou selecione uma conta bancária em reais antes de liquidar.');
      return;
    }
    if (!isValidISODate(settleDate)) {
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
          `• ${tx.description}${tx.installmentNumber ? ` — parcela ${tx.installmentNumber}/${tx.installmentTotal}` : ''} (${formatShortDateBR(tx.date)} — ${
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

  return {
    handleConfirmSettlement,
    handleCopyWhatsAppInvoice,
    handleOpenAddMemberModal,
    handleOpenEditMemberModal,
    handleOpenSettlement,
    handleSaveMember,
    pendingIncomingInvites,
  };
}

export type SharedActionsApi = ReturnType<typeof useSharedActions>;
