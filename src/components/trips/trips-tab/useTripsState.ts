/** Estado da tela: viagem aberta, abas, filtros e campos dos formulários de viagem, câmbio e acerto. Parte de TripsTab (ver TripsTab.tsx). */
import { useEffect, useState } from 'react';
import { CurrencyCode, TripDebtTransfer, TripSettlementMethod } from '../../../types/finance';
import { getLocalDateISO } from '../../../domain/finance/financeRules';
import { getAccountCurrency } from '../../../domain/finance/transferRules';
import type { TripsTabPropsApi } from './tripsTabConfig';

export function useTripsState(ctx: TripsTabPropsApi) {
  const {
    accounts,
    trips,
  } = ctx;
  // Drill-down state: null = Overview Grid of All Trips; string = Dedicated Page of a Single Trip
  const [activeViewTripId, setActiveViewTripId] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string>(
    trips[0]?.id || ''
  );
  const [activeSubView, setActiveSubView] = useState<
    'overview_spend' | 'group_split' | 'fx_wallet' | 'how_it_works'
  >('overview_spend');
  const [guestPreviewParticipantId, setGuestPreviewParticipantId] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<'my_share' | 'group_total'>('my_share');
  const [chartPeriodMode, setChartPeriodMode] = useState<'lot' | 'month'>('lot');

  // Archival and Utility modal states
  const [tripTabFilter, setTripTabFilter] = useState<'active' | 'archived'>('active');
  const [isConverterOpen, setIsConverterOpen] = useState(true);
  const [isPdfReportModalOpen, setIsPdfReportModalOpen] = useState(false);
  const [tripIsArchivedCheckbox, setTripIsArchivedCheckbox] = useState(false);

  // Modals state
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [isLotModalOpen, setIsLotModalOpen] = useState(false);
  const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false);
  const [activeSettlementDebt, setActiveSettlementDebt] =
    useState<TripDebtTransfer | null>(null);

  const todayIso = getLocalDateISO();

  // New Trip Form State
  const [tripName, setTripName] = useState('');
  const [tripDestination, setTripDestination] = useState('');
  const [tripCurrency, setTripCurrency] = useState<CurrencyCode>('EUR');
  const [tripStartDate, setTripStartDate] = useState(todayIso);
  const [tripEndDate, setTripEndDate] = useState(todayIso);
  const [tripBudgetStr, setTripBudgetStr] = useState('');
  const [tripFormError, setTripFormError] = useState<string | null>(null);
  const [tripDefaultRateStr, setTripDefaultRateStr] = useState('6,22');
  const [tripCompanionsInput, setTripCompanionsInput] = useState('');

  // Exchange Lot Form State
  const [lotSourceLabel, setLotSourceLabel] = useState('');
  const [lotDate, setLotDate] = useState(todayIso);
  const [lotForeignAmountStr, setLotForeignAmountStr] = useState('');
  const [lotError, setLotError] = useState<string | null>(null);
  const [lotBaseRateStr, setLotBaseRateStr] = useState('6,18');
  const [lotIofPercentStr, setLotIofPercentStr] = useState('1,1');
  const [lotDebitAccountId, setLotDebitAccountId] = useState<string>('');
  const [lotCreditAccountId, setLotCreditAccountId] = useState<string>('');
  // Câmbio: os reais saem de uma conta em reais e a moeda entra numa conta internacional da mesma moeda.
  const brlAccounts = accounts.filter((account) => getAccountCurrency(account) === 'BRL');
  const selectedLotDebitAccount =
    brlAccounts.find((account) => account.id === lotDebitAccountId) ?? null;

  // Add Participant Form State
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantEmail, setNewParticipantEmail] = useState('');
  const [newParticipantPix, setNewParticipantPix] = useState('');
  const [newParticipantFamilyId, setNewParticipantFamilyId] = useState('');

  // Settlement Modal State
  const [settlementMethod, setSettlementMethod] =
    useState<TripSettlementMethod>('pix_brl');
  const [settlementForeignAmountStr, setSettlementForeignAmountStr] = useState('');
  const [settlementRateMode, setSettlementRateMode] = useState<
    'effective_vet' | 'custom_ptax'
  >('effective_vet');
  const [settlementCustomRateStr, setSettlementCustomRateStr] = useState('');
  const [settlementBankAccountId, setSettlementBankAccountId] = useState<string>(
    brlAccounts[0]?.id || ''
  );
  useEffect(() => {
    const brl = accounts.filter((a) => getAccountCurrency(a) === 'BRL');
    if ((!settlementBankAccountId || !brl.some((a) => a.id === settlementBankAccountId)) && brl.length > 0) {
      setSettlementBankAccountId(brl[0].id);
    }
  }, [accounts, settlementBankAccountId]);
  const selectedSettlementBankAccount =
    brlAccounts.find((account) => account.id === settlementBankAccountId) ?? brlAccounts[0] ?? null;
  const [settlementRecordInBank, setSettlementRecordInBank] = useState<boolean>(true);
  const [settlementNotes, setSettlementNotes] = useState('');
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [isChartLoading, setIsChartLoading] = useState<boolean>(false);

  return {
    activeSettlementDebt,
    activeSubView,
    activeViewTripId,
    brlAccounts,
    chartMode,
    chartPeriodMode,
    editingTripId,
    guestPreviewParticipantId,
    isChartLoading,
    isConverterOpen,
    isLotModalOpen,
    isNewTripModalOpen,
    isParticipantModalOpen,
    isPdfReportModalOpen,
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
    selectedLotDebitAccount,
    selectedSettlementBankAccount,
    selectedTripId,
    setActiveSettlementDebt,
    setActiveSubView,
    setActiveViewTripId,
    setChartMode,
    setChartPeriodMode,
    setEditingTripId,
    setGuestPreviewParticipantId,
    setIsChartLoading,
    setIsConverterOpen,
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
    settlementError,
    settlementForeignAmountStr,
    settlementMethod,
    settlementNotes,
    settlementRateMode,
    settlementRecordInBank,
    todayIso,
    tripBudgetStr,
    tripCompanionsInput,
    tripCurrency,
    tripDefaultRateStr,
    tripDestination,
    tripEndDate,
    tripFormError,
    tripIsArchivedCheckbox,
    tripName,
    tripStartDate,
    tripTabFilter,
  };
}

export type TripsStateApi = ReturnType<typeof useTripsState>;
