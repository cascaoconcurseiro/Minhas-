/** Ações de família: convites, membros e acertos de compartilhados. Parte do App (ver src/App.tsx). */
import { FamilyMember } from '../types/finance';
import { createNeonFamilyInvitation, NeonWorkspaceError, respondToNeonFamilyInvitation, revokeNeonFamilyInvitation } from '../lib/neonWorkspace';
import { getFamilyInviteCreatedNotice } from '../domain/family/familyInvite';
import { newEntityId } from '../utils/ids';
import { reopenSharedSettlement, settleSharedExpenses } from '../domain/family/sharedFinanceRules';
import { createSharedCardInvoice, deleteSharedCardInvoice, updateSharedCardInvoice } from '../domain/family/sharedCardInvoice';
import { formatBRL, formatMonthYearPT, getLocalDateISO } from '../domain/finance/financeRules';
import type { AppStateApi } from './useAppState';
import type { SharedSyncApi } from './useSharedSync';

export function useFamilyActions(app: AppStateApi & SharedSyncApi) {
  const {
    accounts,
    cards,
    effectiveUserDisplayName,
    effectiveUserEmail,
    familyMembers,
    requireWorkspaceWrite,
    setFamilyMembers,
    setInviteCodes,
    setInviteeHasAccount,
    setTransactions,
    settings,
    showNotice,
    transactions,
    triggerCrossAccountSharedTxSync,
  } = app;
  const triggerCrossAccountInviteSync = async (member: FamilyMember) => {
    if (!requireWorkspaceWrite()) return false;
    if (!member.email || !effectiveUserEmail) return false;
    try {
      const { invitation } = await createNeonFamilyInvitation({
        invitedEmail: member.email,
        ownerMemberId: member.id,
        ownerName:
          effectiveUserDisplayName ||
          settings.userName ||
          effectiveUserEmail.split('@')[0],
        ownerPixKey: settings.userPixKey,
        relationship: member.relationship,
        color: member.color,
      });
      const savedMember = { ...member, invitationId: invitation.invitation_id };
      const nextMembers = familyMembers.some((item) => item.id === member.id)
        ? familyMembers.map((item) => item.id === member.id ? savedMember : item)
        : [...familyMembers, savedMember];
      setFamilyMembers(nextMembers);
      const inviteeEmail = member.email.trim().toLowerCase();
      if (invitation.status === 'invited' && typeof invitation.invited_has_account === 'boolean') {
        const hasAccount = invitation.invited_has_account;
        setInviteeHasAccount((previous) => ({ ...previous, [inviteeEmail]: hasAccount }));
      }
      if (invitation.status === 'invited' && typeof invitation.invite_code === 'string') {
        const code = invitation.invite_code;
        setInviteCodes((previous) => ({ ...previous, [inviteeEmail]: code }));
      }
      showNotice(getFamilyInviteCreatedNotice(
        member.email,
        invitation.status === 'invited' ? invitation.invited_has_account : undefined
      ));
      triggerCrossAccountSharedTxSync(transactions, nextMembers);
      return true;
    } catch (error) {
      console.error(
        'Falha ao criar convite familiar no Neon.',
        error instanceof Error ? error.message : String(error)
      );
      showNotice('Não foi possível registrar o convite no Neon.');
      return false;
    }
  };

  const handleAddFamilyMember = (
    newMember: Omit<FamilyMember, 'id'>
  ): FamilyMember | undefined => {
    if (!requireWorkspaceWrite()) return;
    if (newMember.email?.trim()) {
      showNotice('Para vincular por e-mail, cadastre o familiar na aba Compartilhado.');
      return undefined;
    }
    const created: FamilyMember = {
      ...newMember,
      id: newEntityId('fam'),
      inviteStatus: 'none',
    };
    setFamilyMembers((prev) => [...prev, created]);
    showNotice(`"${created.name}" cadastrado(a) na família.`);
    return created;
  };

  const handleAddFamilyMemberWithInvite = async (
    newMember: Omit<FamilyMember, 'id'>
  ): Promise<boolean> => {
    if (!requireWorkspaceWrite()) return false;
    const created: FamilyMember = {
      ...newMember,
      id: newEntityId('fam'),
      inviteStatus: newMember.email ? 'invited' : 'none',
      direction: newMember.email ? 'outgoing' : undefined,
    };
    if (created.email) {
      return await triggerCrossAccountInviteSync(created);
    }
    setFamilyMembers((prev) => [...prev, created]);
    showNotice(`"${created.name}" cadastrado(a) na família.`);
    return true;
  };

  const handleUpdateFamilyMember = async (updated: FamilyMember): Promise<boolean> => {
    if (!requireWorkspaceWrite()) return false;
    const previousMember = familyMembers.find((member) => member.id === updated.id);
    const emailChanged =
      previousMember?.email?.trim().toLowerCase() !==
      updated.email?.trim().toLowerCase();
    if (emailChanged) {
      if (updated.direction === 'incoming') {
        showNotice('O e-mail de um convite recebido só pode ser alterado por quem o enviou.');
        return false;
      }
      let revokedOldInvitation = false;
      try {
        if (previousMember?.invitationId) {
          await revokeNeonFamilyInvitation(previousMember.invitationId);
          revokedOldInvitation = true;
        }
        let savedMember: FamilyMember = {
          ...updated,
          email: updated.email?.trim().toLowerCase() || undefined,
          invitationId: undefined,
          inviteStatus: 'none',
        };
        if (savedMember.email && savedMember.direction !== 'incoming') {
          if (!effectiveUserEmail) throw new Error('Usuário sem e-mail autenticado.');
          const { invitation } = await createNeonFamilyInvitation({
            invitedEmail: savedMember.email,
            ownerMemberId: savedMember.id,
            ownerName:
              effectiveUserDisplayName ||
              settings.userName ||
              effectiveUserEmail.split('@')[0],
            ownerPixKey: settings.userPixKey,
            relationship: savedMember.relationship,
            color: savedMember.color,
          });
          savedMember = {
            ...savedMember,
            invitationId: invitation.invitation_id,
            inviteStatus: invitation.status === 'accepted' ? 'accepted' : 'invited',
          };
        }
        const nextMembers = familyMembers.map((member) =>
          member.id === savedMember.id ? savedMember : member
        );
        setFamilyMembers(nextMembers);
        if (savedMember.email && savedMember.direction !== 'incoming') {
          showNotice(`Vínculo atualizado para ${savedMember.email}. O convite foi registrado no app; nenhum e-mail foi enviado. A pessoa precisa entrar com esse mesmo e-mail.`);
        } else {
          showNotice(`Dados de "${savedMember.name}" atualizados.`);
        }
        return true;
      } catch (error) {
        console.error('Falha ao atualizar o convite familiar no Neon:', error);
        if (revokedOldInvitation && previousMember) {
          const normalizedEmail = updated.email?.trim().toLowerCase() || undefined;
          setFamilyMembers((members) => members.map((member) =>
            member.id === previousMember.id
              ? {
                  ...member,
                  email: normalizedEmail,
                  invitationId: undefined,
                  inviteStatus: 'none',
                  direction: 'outgoing',
                }
              : member
          ));
        }
        showNotice('Não foi possível atualizar o vínculo familiar no Neon.');
        return false;
      }
    }
    const nextMembers = familyMembers.map((member) =>
      member.id === updated.id ? updated : member
    );
    if (updated.email && updated.direction !== 'incoming') {
      return await triggerCrossAccountInviteSync(updated);
    }
    setFamilyMembers(nextMembers);
    triggerCrossAccountSharedTxSync(transactions, nextMembers);
    showNotice(`Dados de "${updated.name}" atualizados.`);
    return true;
  };

  const handleAcceptFamilyInvite = (member: FamilyMember, code: string) => {
    if (!requireWorkspaceWrite()) return;
    if (!member.invitationId) {
      showNotice('Este convite ainda não foi migrado para a sincronização segura no Neon.');
      return;
    }
    void respondToNeonFamilyInvitation(member.invitationId, 'accepted', code)
      .then(() => {
        const nextMembers = familyMembers.map((item) =>
          item.id === member.id ? { ...item, inviteStatus: 'accepted' as const } : item
        );
        setFamilyMembers(nextMembers);
        triggerCrossAccountSharedTxSync(transactions, nextMembers);
        showNotice(`Convite familiar de ${member.invitedByName || member.name} aceito.`);
      })
      .catch((error) => {
        console.error('Falha ao aceitar convite familiar:', error);
        const status = error instanceof NeonWorkspaceError ? error.status : undefined;
        showNotice(
          status === 403
            ? 'Código do convite incorreto. Confira o código com quem convidou e tente de novo.'
            : status === 429
              ? 'Muitas tentativas com código errado. Aguarde uma hora e tente de novo.'
              : 'Não foi possível aceitar o convite. Nenhuma alteração foi confirmada.',
          undefined,
          true
        );
      });
  };

  const handleDeclineFamilyInvite = (member: FamilyMember) => {
    if (!requireWorkspaceWrite()) return;
    if (!member.invitationId) {
      showNotice('Este convite ainda não foi migrado para a sincronização segura no Neon.');
      return;
    }
    void respondToNeonFamilyInvitation(member.invitationId, 'declined')
      .then(() => {
        setFamilyMembers((prev) => prev.filter((item) => item.id !== member.id));
        showNotice(`Convite familiar de ${member.invitedByName || member.name} recusado.`);
      })
      .catch((error) => {
        console.error('Falha ao recusar convite familiar:', error);
        showNotice('Não foi possível recusar o convite. Nenhuma alteração foi confirmada.');
      });
  };

  const handleDeleteFamilyMember = (memberId: string) => {
    if (!requireWorkspaceWrite()) return;
    const target = familyMembers.find((m) => m.id === memberId);
    if (!target) return;
    const removeLocalLink = () => {
      setFamilyMembers((prev) => prev.filter((m) => m.id !== memberId));
      setTransactions((prev) =>
        target.direction === 'incoming'
          ? prev.filter((tx) => tx.sharedMemberId !== memberId)
          : prev.map((tx) =>
              tx.sharedMemberId === memberId
                ? {
                    ...tx,
                    isShared: false,
                    sharedMemberId: undefined,
                    sharedAmount: undefined,
                    sharedPaidBy: undefined,
                    sharedStatus: undefined,
                    sharedSyncId: undefined,
                  }
                : tx
            )
      );
      showNotice(`"${target.name || 'Pessoa'}" removida do controle compartilhado.`);
    };
    if (!target.invitationId) {
      removeLocalLink();
      return;
    }
    void revokeNeonFamilyInvitation(target.invitationId)
      .then(removeLocalLink)
      .catch((error) => {
        if (error instanceof NeonWorkspaceError && error.status === 404) {
          removeLocalLink();
          return;
        }
        console.error('Falha ao revogar vínculo familiar:', error);
        showNotice('Não foi possível remover o vínculo. Os dados permaneceram intactos.');
      });
  };

  const applySharedSettlement = (input: { txId?: string; memberId?: string; month?: string; accountId: string; date: string }) => {
    if (!requireWorkspaceWrite()) return;
    const tx = input.txId ? transactions.find((item) => item.id === input.txId) : undefined;
    const member = familyMembers.find((item) => item.id === (input.memberId || tx?.sharedMemberId));
    const result = settleSharedExpenses(transactions, accounts, { ...input, memberName: member?.name || 'Familiar',
      settlementId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
    if (result.error) { showNotice(result.error, undefined, true); return; }
    if (!result.affectedCount) return;
    setTransactions(result.transactions);
    triggerCrossAccountSharedTxSync(result.transactions);
    showNotice(result.netAmount === 0 ? 'Encontro de contas quitado com saldo R$ 0,00.'
      : `${result.netAmount > 0 ? 'Recebimento' : 'Pagamento'} de ${formatBRL(Math.abs(result.netAmount))} confirmado na conta.`);
  };

  const handleSettleSharedTransaction = (txId: string, accountId: string, date: string) => {
    applySharedSettlement({ txId, accountId, date });
  };

  const handleSettleAllMemberInvoices = (memberId: string, month: string, accountId: string, date: string) => {
    applySharedSettlement({ memberId, month, accountId, date });
  };

  const handleReopenSharedTransaction = (txId: string) => {
    if (!requireWorkspaceWrite()) return;
    const result = reopenSharedSettlement(transactions, txId);
    if (!result.affectedCount) return;
    setTransactions(result.transactions);
    triggerCrossAccountSharedTxSync(result.transactions);
    showNotice(`${result.affectedCount} despesa(s) compartilhada(s) reaberta(s) e acerto estornado.`);
  };

  // Fatura de cartão adicional cobrada de uma pessoa: vive em Compartilhado (ver domain/family/sharedCardInvoice.ts)
  const handleCreateSharedCardInvoice = (input: { memberId: string; cardId: string; invoiceMonth: string; amount: number }): string | null => {
    if (!requireWorkspaceWrite()) return 'O app está em leitura. Aguarde a sincronização e tente de novo.';
    const member = familyMembers.find((item) => item.id === input.memberId);
    const result = createSharedCardInvoice({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      memberId: input.memberId,
      memberName: member?.name || 'Familiar',
      card: cards.find((card) => card.id === input.cardId),
      invoiceMonth: input.invoiceMonth,
      amount: input.amount,
      date: getLocalDateISO(),
    });
    if (result.error !== undefined) return result.error;
    const next = [result.transaction, ...transactions];
    setTransactions(next);
    triggerCrossAccountSharedTxSync(next);
    showNotice(`Fatura de ${member?.name || 'Familiar'} (${formatMonthYearPT(input.invoiceMonth)}) registrada: entra na fatura do cartão e soma ao que ela te deve.`);
    return null;
  };

  const handleUpdateSharedCardInvoice = (txId: string, input: { amount: number; invoiceMonth: string }): string | null => {
    if (!requireWorkspaceWrite()) return 'O app está em leitura. Aguarde a sincronização e tente de novo.';
    const current = transactions.find((tx) => tx.id === txId);
    const member = familyMembers.find((item) => item.id === current?.sharedMemberId);
    const result = updateSharedCardInvoice(transactions, txId, {
      ...input,
      memberName: member?.name || 'Familiar',
      cardName: cards.find((card) => card.id === current?.creditCardId)?.name,
    });
    if (result.error) return result.error;
    setTransactions(result.transactions);
    triggerCrossAccountSharedTxSync(result.transactions);
    showNotice(`Fatura atualizada para ${formatBRL(input.amount)}.`);
    return null;
  };

  const handleDeleteSharedCardInvoice = (txId: string): string | null => {
    if (!requireWorkspaceWrite()) return 'O app está em leitura. Aguarde a sincronização e tente de novo.';
    const result = deleteSharedCardInvoice(transactions, txId);
    if (result.error) return result.error;
    setTransactions(result.transactions);
    triggerCrossAccountSharedTxSync(result.transactions, familyMembers, result.removedSharedSyncId ? [result.removedSharedSyncId] : undefined);
    showNotice('Fatura do cartão adicional apagada.');
    return null;
  };

  return {
    handleAcceptFamilyInvite,
    handleAddFamilyMember,
    handleAddFamilyMemberWithInvite,
    handleCreateSharedCardInvoice,
    handleDeclineFamilyInvite,
    handleDeleteSharedCardInvoice,
    handleDeleteFamilyMember,
    handleReopenSharedTransaction,
    handleSettleAllMemberInvoices,
    handleSettleSharedTransaction,
    handleUpdateFamilyMember,
    handleUpdateSharedCardInvoice,
    triggerCrossAccountInviteSync,
  };
}

export type FamilyActionsApi = ReturnType<typeof useFamilyActions>;
