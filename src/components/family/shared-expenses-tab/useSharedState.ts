/** Estado da tela: pessoa aberta, subaba e campos do cadastro. Parte de SharedExpensesTab (ver SharedExpensesTab.tsx). */
import React, { useEffect, useState } from 'react';
import { getAccountCurrency } from '../../../domain/finance/transferRules';
import { FamilyMember } from '../../../types/finance';
import { MEMBER_COLORS } from './sharedExpensesTabConfig';
import type { SharedExpensesTabPropsApi } from './sharedExpensesTabConfig';

export function useSharedState(ctx: SharedExpensesTabPropsApi) {
  const {
    accounts,
    familyMembers,
  } = ctx;
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

  // O acerto (Pix) é em reais: só contas em reais podem receber ou pagar.
  const brlAccounts = accounts.filter((account) => getAccountCurrency(account) === 'BRL');
  const [settleAccountId, setSettleAccountId] = useState(brlAccounts[0]?.id || '');
  const selectedSettlementAccount =
    brlAccounts.find((account) => account.id === settleAccountId) ?? brlAccounts[0] ?? null;
  useEffect(() => {
    const brl = accounts.filter((a) => getAccountCurrency(a) === 'BRL');
    if ((!settleAccountId || !brl.some((a) => a.id === settleAccountId)) && brl.length > 0) {
      setSettleAccountId(brl[0].id);
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

  return {
    activeSubTab,
    brlAccounts,
    copyFeedback,
    editingMember,
    isGuestMirrorView,
    isSavingMember,
    memberColor,
    memberEmail,
    memberInviteStatus,
    memberName,
    memberNotes,
    memberPixKey,
    memberRelation,
    memberSaveError,
    selectedMemberId,
    selectedSettlementAccount,
    setActiveSubTab,
    setCopyFeedback,
    setEditingMember,
    setIsGuestMirrorView,
    setIsSavingMember,
    setMemberColor,
    setMemberEmail,
    setMemberInviteStatus,
    setMemberName,
    setMemberNotes,
    setMemberPixKey,
    setMemberRelation,
    setMemberSaveError,
    setSelectedMemberId,
    setSettleAccountId,
    setSettleDate,
    setSettlementError,
    setSettlementTarget,
    setShowMemberModal,
    settleAccountId,
    settleDate,
    settlementError,
    settlementTarget,
    showMemberModal,
  };
}

export type SharedStateApi = ReturnType<typeof useSharedState>;
