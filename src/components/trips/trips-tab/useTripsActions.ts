/** Ações: criar/editar/arquivar viagem, lote de câmbio, participantes, acerto e PDF. Parte de TripsTab (ver TripsTab.tsx). */
import { Trip, TripDebtTransfer, TripExchangeLot, TripParticipant, TripSettlement } from '../../../types/finance';
import { CURRENCY_CATALOG, calculateConvertedBrlAmount, formatForeignCurrency } from '../../../domain/trips/travelRules';
import React from 'react';
import { isCurrencyInputValid, isExchangeRateInputValid, parseCurrencyInput, parseExchangeRateInput } from '../../../utils/currencyInput';
import { newEntityId } from '../../../utils/ids';
import { getLocalDateISO, parseBRLInput } from '../../../domain/finance/financeRules';
import { PARTICIPANT_COLORS } from './tripsTabConfig';
import type { TripsTabPropsApi } from './tripsTabConfig';
import type { TripsStateApi } from './useTripsState';
import type { TripsDerivedApi } from './useTripsDerived';

export function useTripsActions(ctx: TripsTabPropsApi & TripsStateApi & TripsDerivedApi) {
  const {
    accounts,
    activeSettlementDebt,
    activeTrip,
    brlAccounts,
    categories,
    editingTripId,
    lotBaseRateStr,
    lotCreditAccountId,
    lotDate,
    lotDebitAccountId,
    lotForeignAmountStr,
    lotIofPercentStr,
    lotSourceLabel,
    newParticipantEmail,
    newParticipantFamilyId,
    newParticipantName,
    newParticipantPix,
    onAddExchangeLot,
    onAddTrip,
    onRecordSettlement,
    onUpdateTrip,
    setActiveSettlementDebt,
    setActiveSubView,
    setActiveViewTripId,
    setEditingTripId,
    setIsLotModalOpen,
    setIsNewTripModalOpen,
    setIsParticipantModalOpen,
    setIsPdfReportModalOpen,
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
    setSelectedTripId,
    setSettlementBankAccountId,
    setSettlementCustomRateStr,
    setSettlementError,
    setSettlementForeignAmountStr,
    setSettlementMethod,
    setSettlementNotes,
    setSettlementRateMode,
    setSettlementRecordInBank,
    setTripBudgetStr,
    setTripCompanionsInput,
    setTripCurrency,
    setTripDefaultRateStr,
    setTripDestination,
    setTripEndDate,
    setTripFormError,
    setTripIsArchivedCheckbox,
    setTripName,
    setTripStartDate,
    setTripTabFilter,
    settlementBankAccountId,
    settlementCustomRateStr,
    settlementForeignAmountStr,
    settlementMethod,
    settlementNotes,
    settlementRateMode,
    settlementRecordInBank,
    summary,
    todayIso,
    transactions,
    tripBudgetStr,
    tripCompanionsInput,
    tripCurrency,
    tripDefaultRateStr,
    tripDestination,
    tripEndDate,
    tripIsArchivedCheckbox,
    tripName,
    tripStartDate,
  } = ctx;
  const handleToggleArchiveTrip = (trip: Trip) => {
    const nextArchived = !trip.isArchived;
    onUpdateTrip({
      ...trip,
      isArchived: nextArchived,
    });
  };

  const handleOpenNewTripModal = () => {
    setTripFormError(null);
    setEditingTripId(null);
    setTripName('');
    setTripDestination('');
    setTripCurrency('EUR');
    setTripStartDate(todayIso);
    setTripEndDate(todayIso);
    setTripBudgetStr('');
    setTripDefaultRateStr('6,22');
    setTripCompanionsInput('');
    setTripIsArchivedCheckbox(false);
    setIsNewTripModalOpen(true);
  };

  const handleOpenEditTripModal = (trip: Trip) => {
    setTripFormError(null);
    setEditingTripId(trip.id);
    setTripName(trip.name);
    setTripDestination(trip.destination);
    setTripCurrency(trip.currency);
    setTripStartDate(trip.startDate);
    setTripEndDate(trip.endDate);
    setTripBudgetStr(trip.budgetForeign.toFixed(CURRENCY_CATALOG[trip.currency].decimals).replace('.', ','));
    setTripDefaultRateStr(
      trip.defaultExchangeRate.toFixed(4).replace('.', ',')
    );
    const companions = trip.participants
      .filter((p) => !p.isMe && p.id !== 'me')
      .map((p) => p.name)
      .join(', ');
    setTripCompanionsInput(companions);
    setTripIsArchivedCheckbox(Boolean(trip.isArchived));
    setIsNewTripModalOpen(true);
  };

  const handleCreateTrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripName.trim()) return;
    if (tripBudgetStr.trim() && !isCurrencyInputValid(tripBudgetStr, tripCurrency)) {
      setTripFormError(`Informe o orçamento com até ${CURRENCY_CATALOG[tripCurrency].decimals} casa(s) decimal(is).`);
      return;
    }
    if (tripDefaultRateStr.trim() && !isExchangeRateInputValid(tripDefaultRateStr)) {
      setTripFormError('Informe uma cotação de referência válida maior que zero.');
      return;
    }
    setTripFormError(null);
    const budgetForeign = tripBudgetStr.trim()
      ? parseCurrencyInput(tripBudgetStr, tripCurrency)
      : 1000;

    const companionNames = tripCompanionsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const defaultRate =
      parseExchangeRateInput(tripDefaultRateStr) ||
      CURRENCY_CATALOG[tripCurrency].defaultCommercialRateBrl;

    if (editingTripId && activeTrip && activeTrip.id === editingTripId) {
      const existingNonMe = activeTrip.participants.filter(
        (p) => !p.isMe && p.id !== 'me'
      );
      const updatedParticipants: TripParticipant[] = [
        activeTrip.participants.find((p) => p.isMe || p.id === 'me') || {
          id: 'me',
          name: 'Você',
          isMe: true,
          color: '#059669',
        },
        ...companionNames.map((name, idx) => {
          const match = existingNonMe.find(
            (p) => p.name.toLowerCase() === name.toLowerCase()
          );
          if (match) return match;
          return {
            id: `${newEntityId('part')}-${idx}`,
            name,
            color: PARTICIPANT_COLORS[(idx + 1) % PARTICIPANT_COLORS.length],
          };
        }),
      ];

      const updatedTrip: Trip = {
        ...activeTrip,
        name: tripName.trim(),
        destination: tripDestination.trim() || tripName.trim(),
        startDate: tripStartDate,
        endDate: tripEndDate >= tripStartDate ? tripEndDate : tripStartDate,
        currency: tripCurrency,
        defaultExchangeRate: defaultRate,
        budgetForeign: Math.max(100, budgetForeign),
        participants: updatedParticipants,
        isArchived: tripIsArchivedCheckbox,
      };
      onUpdateTrip(updatedTrip);
      setIsNewTripModalOpen(false);
      setEditingTripId(null);
      return;
    }

    const participants: TripParticipant[] = [
      {
        id: 'me',
        name: 'Você',
        isMe: true,
        color: '#059669',
      },
      ...companionNames.map((name, idx) => ({
        id: `${newEntityId('part')}-${idx}`,
        name,
        color: PARTICIPANT_COLORS[(idx + 1) % PARTICIPANT_COLORS.length],
      })),
    ];

    const newTrip: Trip = {
      id: newEntityId('trip'),
      name: tripName.trim(),
      destination: tripDestination.trim() || tripName.trim(),
      startDate: tripStartDate,
      endDate: tripEndDate >= tripStartDate ? tripEndDate : tripStartDate,
      status: 'active',
      currency: tripCurrency,
      defaultExchangeRate: defaultRate,
      budgetForeign: Math.max(100, budgetForeign),
      participants,
      exchangeLots: [],
      settlements: [],
      coverColor: '#0284c7',
      isArchived: false,
    };

    onAddTrip(newTrip);
    setSelectedTripId(newTrip.id);
    setActiveViewTripId(newTrip.id);
    setTripTabFilter('active');
    setActiveSubView('overview_spend');
    setIsNewTripModalOpen(false);
  };

  const handleOpenLotModal = () => {
    if (!activeTrip) return;
    const catMeta = CURRENCY_CATALOG[activeTrip.currency];
    setLotSourceLabel('');
    setLotError(null);
    setLotDate(activeTrip.startDate);
    setLotForeignAmountStr('');
    setLotBaseRateStr(
      catMeta.defaultCommercialRateBrl.toFixed(4).replace('.', ',')
    );
    setLotIofPercentStr('1,1');
    setLotDebitAccountId('');
    const creditCandidates = accounts.filter(
      (account) => account.type === 'international' && account.currency === activeTrip.currency
    );
    setLotCreditAccountId(
      creditCandidates.find((account) => account.id === activeTrip.linkedAccountId)?.id ??
        creditCandidates[0]?.id ??
        ''
    );
    setIsLotModalOpen(true);
  };

  const handleSaveExchangeLot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip) return;

    const foreignAmount = parseCurrencyInput(lotForeignAmountStr, activeTrip.currency);
    const rateBase = parseExchangeRateInput(lotBaseRateStr);
    const iofPercent = parseBRLInput(lotIofPercentStr);
    if (!isCurrencyInputValid(lotForeignAmountStr, activeTrip.currency) || foreignAmount <= 0) {
      setLotError(`Informe um valor comprado válido com até ${CURRENCY_CATALOG[activeTrip.currency].decimals} casa(s) decimal(is).`);
      return;
    }
    if (rateBase <= 0) {
      setLotError('Informe uma cotação base válida maior que zero.');
      return;
    }
    if (!isCurrencyInputValid(lotIofPercentStr, 'BRL') || iofPercent < 0 || iofPercent > 100) {
      setLotError('Informe um IOF válido entre 0% e 100%, com até duas casas decimais.');
      return;
    }
    setLotError(null);

    const conv = calculateConvertedBrlAmount(foreignAmount, rateBase, iofPercent);
    if (!conv.isValid) {
      setLotError('O valor convertido excede o limite de cálculo seguro. Reduza o valor ou a cotação.');
      return;
    }

    const newLot: TripExchangeLot = {
      id: newEntityId('lot'),
      date: lotDate,
      currency: activeTrip.currency,
      foreignAmount,
      rateBase,
      iofPercent,
      effectiveRateBrl: conv.effectiveRate,
      totalBrlPaid: conv.totalBrl,
      sourceLabel: lotSourceLabel.trim() || 'Compra de Câmbio',
      accountId: lotCreditAccountId || undefined,
      debitAccountId: lotDebitAccountId || undefined,
    };

    onAddExchangeLot(
      activeTrip.id,
      newLot,
      lotDebitAccountId ? lotDebitAccountId : undefined
    );
    setIsLotModalOpen(false);
  };

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || !newParticipantName.trim()) return;
    const nextColor =
      PARTICIPANT_COLORS[
        activeTrip.participants.length % PARTICIPANT_COLORS.length
      ];
    const cleanEmail = newParticipantEmail.trim().toLowerCase();
    const updated: Trip = {
      ...activeTrip,
      participants: [
        ...activeTrip.participants,
        {
          id: newEntityId('part'),
          name: newParticipantName.trim(),
          color: nextColor,
          email: cleanEmail || undefined,
          familyMemberId: newParticipantFamilyId || undefined,
          inviteStatus: cleanEmail ? 'accepted' : 'none',
          pixKey: newParticipantPix.trim() || undefined,
        },
      ],
    };
    onUpdateTrip(updated);
    setNewParticipantName('');
    setNewParticipantEmail('');
    setNewParticipantPix('');
    setNewParticipantFamilyId('');
    setIsParticipantModalOpen(false);
  };

  const handleOpenSettlementModal = (debt: TripDebtTransfer) => {
    setActiveSettlementDebt(debt);
    setSettlementError(null);
    setSettlementMethod('pix_brl');
    setSettlementForeignAmountStr(debt.amountForeign.toFixed(2).replace('.', ','));
    setSettlementRateMode('effective_vet');
    setSettlementCustomRateStr(
      debt.impliedEffectiveRate.toFixed(4).replace('.', ',')
    );
    setSettlementBankAccountId(brlAccounts[0]?.id || '');
    setSettlementRecordInBank(
      brlAccounts.length > 0 &&
      (debt.fromParticipantId === 'me' || debt.toParticipantId === 'me')
    );
    setSettlementNotes('');
  };

  const handleConfirmSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || !activeSettlementDebt) return;

    const foreignEq = parseCurrencyInput(settlementForeignAmountStr, activeTrip.currency);
    if (!Number.isFinite(foreignEq) || foreignEq <= 0 || foreignEq > activeSettlementDebt.amountForeign + 0.009) {
      setSettlementError(
        `Informe um valor maior que zero e até ${formatForeignCurrency(activeSettlementDebt.amountForeign, activeTrip.currency)}.`
      );
      return;
    }
    const rateUsed =
      settlementRateMode === 'effective_vet'
        ? activeSettlementDebt.impliedEffectiveRate
        : parseExchangeRateInput(settlementCustomRateStr);
    if (!Number.isFinite(rateUsed) || rateUsed <= 0) {
      setSettlementError('Informe uma cotação válida maior que zero.');
      return;
    }
    const involvesMe =
      activeSettlementDebt.fromParticipantId === 'me' ||
      activeSettlementDebt.toParticipantId === 'me';
    if (settlementMethod === 'pix_brl' && settlementRecordInBank && involvesMe && !settlementBankAccountId) {
      setSettlementError('Selecione uma conta bancária ou desative o registro automático no extrato.');
      return;
    }
    setSettlementError(null);

    const brlSettled = Math.round(foreignEq * rateUsed * 100) / 100;
    const isSettledInBrl = settlementMethod === 'pix_brl';

    const newSettlement: TripSettlement = {
      id: newEntityId('st'),
      date: getLocalDateISO(),
      fromParticipantId: activeSettlementDebt.fromParticipantId,
      toParticipantId: activeSettlementDebt.toParticipantId,
      currencySettled: isSettledInBrl ? 'BRL' : activeTrip.currency,
      foreignAmountEquivalent: foreignEq,
      brlAmountSettled: brlSettled,
      exchangeRateUsed: rateUsed,
      method: settlementMethod,
      notes:
        settlementNotes.trim() ||
        `Acerto ${activeSettlementDebt.fromName} → ${activeSettlementDebt.toName}`,
    };

    const bankEffect =
      isSettledInBrl &&
      settlementRecordInBank &&
      involvesMe &&
      settlementBankAccountId
        ? {
            accountId: settlementBankAccountId,
            type:
              activeSettlementDebt.toParticipantId === 'me'
                ? ('income' as const)
                : ('expense' as const),
            brlAmount: brlSettled,
            description:
              activeSettlementDebt.toParticipantId === 'me'
                ? `Reembolso Viagem (${activeTrip.name}) — Recebido de ${activeSettlementDebt.fromName}`
                : `Acerto Viagem (${activeTrip.name}) — Pago para ${activeSettlementDebt.toName}`,
          }
        : undefined;

    onRecordSettlement(activeTrip.id, newSettlement, bankEffect);
    setActiveSettlementDebt(null);
  };

  const handleExportPdfReport = async () => {
    if (!activeTrip || !summary) return;
    try {
      const { generateAndDownloadTripPdf } = await import('../../../services/import-export/tripPdfGenerator');
      generateAndDownloadTripPdf({
        trip: activeTrip,
        summary,
        transactions,
        categories,
      });
    } catch (err) {
      console.error('Erro ao gerar arquivo PDF direto:', err);
    }
    setIsPdfReportModalOpen(true);
  };

  return {
    handleAddParticipant,
    handleConfirmSettlement,
    handleCreateTrip,
    handleExportPdfReport,
    handleOpenEditTripModal,
    handleOpenLotModal,
    handleOpenNewTripModal,
    handleOpenSettlementModal,
    handleSaveExchangeLot,
    handleToggleArchiveTrip,
  };
}

export type TripsActionsApi = ReturnType<typeof useTripsActions>;
