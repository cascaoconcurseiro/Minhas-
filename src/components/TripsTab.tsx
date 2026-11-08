import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  Calculator,
  Calendar,
  CheckCircle2,
  Coins,
  CreditCard,
  Eye,
  FileDown,
  Globe,
  HelpCircle,
  Info,
  Mail,
  Plane,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Sparkles,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  BankAccount,
  Category,
  CurrencyCode,
  FamilyMember,
  Transaction,
  Trip,
  TripDebtTransfer,
  TripExchangeLot,
  TripParticipant,
  TripSettlement,
  TripSettlementMethod,
} from '../types/finance';
import { formatBRL, formatShortDateBR, parseBRLInput } from '../utils/financeRules';
import { parseCurrencyInput } from '../utils/currencyInput';
import { CurrencyInput } from './CurrencyInput';
import {
  calculateConvertedBrlAmount,
  calculateExchangeSavingsAnalysis,
  calculateTripDashboardSummary,
  convertSmartCurrency,
  CURRENCY_CATALOG,
  CURRENCY_REGIME_DEFAULTS,
  formatExchangeRateBR,
  formatForeignCurrency,
  getLatestExchangeRateInfo,
} from '../utils/travelRules';
import { TripSavingsChart } from './TripSavingsChart';
import { SmartCurrencyConverterCard } from './SmartCurrencyConverterCard';
import { TripPdfReportModal } from './TripPdfReportModal';
import { generateAndDownloadTripPdf } from '../utils/tripPdfGenerator';

interface TripsTabProps {
  getAuthToken: () => Promise<string>;
  trips: Trip[];
  transactions: Transaction[];
  categories: Category[];
  accounts: BankAccount[];
  familyMembers?: FamilyMember[];
  privacyMode?: boolean;
  onAddTrip: (trip: Trip) => void;
  onUpdateTrip: (trip: Trip) => void;
  onDeleteTrip: (tripId: string) => void;
  onAddExchangeLot: (
    tripId: string,
    lot: TripExchangeLot,
    debitFromAccountId?: string
  ) => void;
  onDeleteExchangeLot: (tripId: string, lotId: string) => void;
  onRecordSettlement: (
    tripId: string,
    settlement: TripSettlement,
    bankAccountEffect?: {
      accountId: string;
      type: 'income' | 'expense';
      brlAmount: number;
      description: string;
    }
  ) => void;
  onOpenNewTripExpense: (tripId: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (txId: string) => void;
  onAddAccount?: (account: Omit<BankAccount, 'id'>) => BankAccount | void;
}

const CURRENCY_OPTIONS: CurrencyCode[] = [
  'EUR',
  'USD',
  'GBP',
  'CAD',
  'CHF',
  'ARS',
  'CLP',
  'JPY',
  'BRL',
];

const PARTICIPANT_COLORS = [
  '#059669',
  '#ec4899',
  '#3b82f6',
  '#8b5cf6',
  '#d97706',
  '#0284c7',
  '#e11d48',
];

export const TripsTab: React.FC<TripsTabProps> = ({
  getAuthToken,
  trips,
  transactions,
  categories,
  accounts,
  familyMembers = [],
  privacyMode = false,
  onAddTrip,
  onUpdateTrip,
  onDeleteTrip,
  onAddExchangeLot,
  onDeleteExchangeLot,
  onRecordSettlement,
  onOpenNewTripExpense,
  onEditTransaction,
  onDeleteTransaction,
  onAddAccount,
}) => {
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

  const todayIso = new Date().toISOString().slice(0, 10);

  // New Trip Form State
  const [tripName, setTripName] = useState('');
  const [tripDestination, setTripDestination] = useState('');
  const [tripCurrency, setTripCurrency] = useState<CurrencyCode>('EUR');
  const [tripStartDate, setTripStartDate] = useState(todayIso);
  const [tripEndDate, setTripEndDate] = useState(todayIso);
  const [tripBudgetStr, setTripBudgetStr] = useState('');
  const [tripDefaultRateStr, setTripDefaultRateStr] = useState('6,22');
  const [tripCompanionsInput, setTripCompanionsInput] = useState('');

  // Exchange Lot Form State
  const [lotSourceLabel, setLotSourceLabel] = useState('');
  const [lotDate, setLotDate] = useState(todayIso);
  const [lotForeignAmountStr, setLotForeignAmountStr] = useState('');
  const [lotBaseRateStr, setLotBaseRateStr] = useState('6,18');
  const [lotIofPercentStr, setLotIofPercentStr] = useState('1,1');
  const [lotDebitAccountId, setLotDebitAccountId] = useState<string>('');

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
    accounts[0]?.id || ''
  );
  useEffect(() => {
    if (
      (!settlementBankAccountId ||
        !accounts.some((a) => a.id === settlementBankAccountId)) &&
      accounts.length > 0
    ) {
      setSettlementBankAccountId(accounts[0].id);
    }
  }, [accounts, settlementBankAccountId]);
  const [settlementRecordInBank, setSettlementRecordInBank] = useState<boolean>(true);
  const [settlementNotes, setSettlementNotes] = useState('');
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [isChartLoading, setIsChartLoading] = useState<boolean>(false);

  // Active vs. Archived Trips Filtering
  const activeTrips = useMemo(() => trips.filter((t) => !t.isArchived), [trips]);
  const archivedTrips = useMemo(() => trips.filter((t) => Boolean(t.isArchived)), [trips]);
  const displayedTrips = tripTabFilter === 'active' ? activeTrips : archivedTrips;

  const effectiveTripId = activeViewTripId || selectedTripId;

  const activeTrip = useMemo(() => {
    const foundById = trips.find((t) => t.id === effectiveTripId);
    if (foundById) return foundById;
    const foundInDisplayed = displayedTrips.find((t) => t.id === selectedTripId);
    if (foundInDisplayed) return foundInDisplayed;
    if (displayedTrips.length > 0) return displayedTrips[0];
    return trips[0] || null;
  }, [displayedTrips, trips, effectiveTripId, selectedTripId]);

  const handleSelectTrip = (tripId: string) => {
    setSelectedTripId(tripId);
    setActiveViewTripId(tripId);
    setIsConverterOpen(true);
    if (tripId !== activeTrip?.id) {
      setIsChartLoading(true);
      window.setTimeout(() => {
        setIsChartLoading(false);
      }, 260);
    }
  };

  const handleSetTripTabFilter = (filter: 'active' | 'archived') => {
    if (filter !== tripTabFilter) {
      setIsChartLoading(true);
      setTripTabFilter(filter);
      window.setTimeout(() => {
        setIsChartLoading(false);
      }, 260);
    }
  };

  const summary = useMemo(() => {
    if (!activeTrip) return null;
    return calculateTripDashboardSummary(activeTrip, transactions, categories);
  }, [activeTrip, transactions, categories]);

  const tripTransactions = useMemo(() => {
    if (!activeTrip) return [];
    return transactions
      .filter(
        (tx) =>
          tx.tripId === activeTrip.id &&
          tx.type === 'expense' &&
          !tx.isInvoicePayment
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [activeTrip, transactions]);

  const maskValue = (formatted: string) => (privacyMode ? '••••••' : formatted);

  const handleToggleArchiveTrip = (trip: Trip) => {
    const nextArchived = !trip.isArchived;
    onUpdateTrip({
      ...trip,
      isArchived: nextArchived,
    });
  };

  const handleOpenNewTripModal = () => {
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
    setEditingTripId(trip.id);
    setTripName(trip.name);
    setTripDestination(trip.destination);
    setTripCurrency(trip.currency);
    setTripStartDate(trip.startDate);
    setTripEndDate(trip.endDate);
    setTripBudgetStr(trip.budgetForeign.toFixed(CURRENCY_CATALOG[trip.currency].decimals).replace('.', ','));
    setTripDefaultRateStr(
      trip.defaultExchangeRate.toFixed(2).replace('.', ',')
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

    const companionNames = tripCompanionsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const defaultRate =
      parseBRLInput(tripDefaultRateStr) ||
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
            id: `part-${Date.now()}-${idx}`,
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
        budgetForeign: Math.max(100, parseCurrencyInput(tripBudgetStr, tripCurrency) || 1000),
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
        id: `part-${Date.now()}-${idx}`,
        name,
        color: PARTICIPANT_COLORS[(idx + 1) % PARTICIPANT_COLORS.length],
      })),
    ];

    const newTrip: Trip = {
      id: `trip-${Date.now()}`,
      name: tripName.trim(),
      destination: tripDestination.trim() || tripName.trim(),
      startDate: tripStartDate,
      endDate: tripEndDate >= tripStartDate ? tripEndDate : tripStartDate,
      status: 'active',
      currency: tripCurrency,
      defaultExchangeRate: defaultRate,
      budgetForeign: Math.max(100, parseCurrencyInput(tripBudgetStr, tripCurrency) || 1000),
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
    setLotDate(activeTrip.startDate);
    setLotForeignAmountStr('');
    setLotBaseRateStr(
      catMeta.defaultCommercialRateBrl.toFixed(2).replace('.', ',')
    );
    setLotIofPercentStr('1,1');
    setLotDebitAccountId('');
    setIsLotModalOpen(true);
  };

  const handleSaveExchangeLot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip) return;

    const foreignAmount = parseCurrencyInput(lotForeignAmountStr, activeTrip.currency);
    const rateBase = parseBRLInput(lotBaseRateStr);
    const iofPercent = parseBRLInput(lotIofPercentStr);
    if (foreignAmount <= 0 || rateBase <= 0) return;

    const conv = calculateConvertedBrlAmount(foreignAmount, rateBase, iofPercent);

    const newLot: TripExchangeLot = {
      id: `lot-${Date.now()}`,
      date: lotDate,
      currency: activeTrip.currency,
      foreignAmount,
      rateBase,
      iofPercent,
      effectiveRateBrl: conv.effectiveRate,
      totalBrlPaid: conv.totalBrl,
      sourceLabel: lotSourceLabel.trim() || 'Compra de Câmbio',
      accountId: lotDebitAccountId || undefined,
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
          id: `part-${Date.now()}`,
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
    setSettlementBankAccountId(accounts[0]?.id || '');
    setSettlementRecordInBank(
      accounts.length > 0 &&
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
        : parseBRLInput(settlementCustomRateStr);
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
      id: `st-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
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

  const handleExportPdfReport = () => {
    if (!activeTrip || !summary) return;
    try {
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

  const newTripModalNode = isNewTripModalOpen ? (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 p-0 sm:p-4 overflow-hidden modal-shell"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-sheet-up sm:animate-modal-in">
        <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
            {editingTripId
              ? 'Editar Roteiro & Orçamento da Viagem'
              : 'Criar Nova Viagem (TravelSpend + Splitwise)'}
          </h3>
          <button
            type="button"
            onClick={() => {
              setIsNewTripModalOpen(false);
              setEditingTripId(null);
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleCreateTrip} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs modal-form-scroll custom-scrollbar">
            <div>
              <label htmlFor="trip-form-name" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nome da Viagem
              </label>
              <input
                type="text"
                id="trip-form-name"
                required
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder="Ex: Roteiro Internacional, Férias..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="trip-form-destination" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Destino / Países
                </label>
                <input
                  type="text"
                  id="trip-form-destination"
                  value={tripDestination}
                  onChange={(e) => setTripDestination(e.target.value)}
                  placeholder="Ex: Lisboa, Madri, Santiago..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="trip-form-currency" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Moeda Principal da Viagem
                </label>
                <select
                  id="trip-form-currency"
                  value={tripCurrency}
                  onChange={(e) => {
                    const code = e.target.value as CurrencyCode;
                    setTripCurrency(code);
                    setTripDefaultRateStr(
                      CURRENCY_CATALOG[code].defaultCommercialRateBrl
                        .toFixed(2)
                        .replace('.', ',')
                    );
                  }}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-semibold"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {CURRENCY_CATALOG[c].flag} {c} — {CURRENCY_CATALOG[c].name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="trip-form-start-date" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Data de Ida
                </label>
                <input
                  type="date"
                  id="trip-form-start-date"
                  value={tripStartDate}
                  onChange={(e) => setTripStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="trip-form-end-date" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Data de Volta
                </label>
                <input
                  type="date"
                  id="trip-form-end-date"
                  value={tripEndDate}
                  onChange={(e) => setTripEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="trip-form-budget" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Meu Orçamento Pessoal ({tripCurrency})
                </label>
                <CurrencyInput
                  id="trip-form-budget"
                  value={tripBudgetStr}
                  currency={tripCurrency}
                  onValueChange={setTripBudgetStr}
                  placeholder="Ex: 1500"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="trip-form-exchange-rate" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Câmbio Referência (R$ / {tripCurrency})
                </label>
                <input
                  type="text"
                  id="trip-form-exchange-rate"
                  value={tripDefaultRateStr}
                  onChange={(e) => setTripDefaultRateStr(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="trip-form-companions" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Acompanhantes da Viagem (separados por vírgula)
              </label>
              <input
                type="text"
                id="trip-form-companions"
                value={tripCompanionsInput}
                onChange={(e) => setTripCompanionsInput(e.target.value)}
                placeholder="Opcional: nomes separados por vírgula"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              />
              <span className="block text-[10px] text-slate-400 mt-1">
                &ldquo;Você&rdquo; já é incluído automaticamente como participante principal.
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3 text-[11px] text-slate-600 dark:text-slate-300">
              Suas contas internacionais (Wise, Nomad, Avenue, C6 Global) e cartões de crédito são independentes e não ficam presos a uma viagem — você escolhe como pagou cada despesa no momento do lançamento.
            </div>

            {editingTripId && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tripIsArchivedCheckbox}
                    onChange={(e) => setTripIsArchivedCheckbox(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                      Arquivar Viagem (Mover para Histórico de Concluídas)
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Remove o roteiro da lista e contagem de viagens ativas, mantendo o histórico de câmbio e gastos intacto.
                    </span>
                  </div>
                </label>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 shrink-0 bg-slate-50/70 dark:bg-slate-800/40 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <button
              type="button"
              onClick={() => {
                setIsNewTripModalOpen(false);
                setEditingTripId(null);
              }}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
            >
              {editingTripId ? 'Salvar Alterações' : 'Criar Viagem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  if (!activeTrip || !summary) {
    return (
      <div id="trips-container" className="space-y-5">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800">
                <Plane className="h-3.5 w-3.5" />
                TravelSpend + Splitwise Multi-Moeda
              </span>
            </div>

            {/* Right-Aligned Toolbar: Segmented Control Period Selector + Export Button */}
            <div
              data-testid="trips-right-toolbar"
              className="flex flex-wrap items-center justify-end gap-2.5 sm:gap-3 ml-auto"
            >
              <div
                role="group"
                aria-label="Seletor de período"
                className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/90 p-1 border border-slate-200/80 dark:border-slate-700 gap-1"
              >
                <button
                  type="button"
                  data-testid="toolbar-period-lot-btn"
                  aria-pressed={chartPeriodMode === 'lot'}
                  onClick={() => setChartPeriodMode('lot')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    chartPeriodMode === 'lot'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Por Lote
                </button>
                <button
                  type="button"
                  data-testid="toolbar-period-month-btn"
                  aria-pressed={chartPeriodMode === 'month'}
                  onClick={() => setChartPeriodMode('month')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    chartPeriodMode === 'month'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Por Mês
                </button>
              </div>

              <button
                type="button"
                data-testid="export-pdf-report-btn"
                disabled
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-2xs"
                title="Cadastre uma viagem para exportar o relatório PDF"
              >
                <FileDown className="h-3.5 w-3.5 text-slate-400" />
                <span>Exportar Relatório PDF</span>
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-xs">
          <Plane className="mx-auto h-10 w-10 text-emerald-600 mb-3" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">
            Nenhuma viagem cadastrada
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Crie um roteiro internacional ou nacional para acompanhar gastos por dia (estilo TravelSpend), câmbio médio ponderado e divisão de despesas em grupo.
          </p>
          <button
            type="button"
            data-testid="create-first-trip-btn"
            onClick={handleOpenNewTripModal}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Criar Primeira Viagem
          </button>
        </div>

        {newTripModalNode}
      </div>
    );
  }

  const currencyMeta = CURRENCY_CATALOG[activeTrip.currency];

  // OVERVIEW GRID VIEW (When no specific trip is open in dedicated page mode)
  if (!activeViewTripId) {
    return (
      <div id="trips-container" className="space-y-5">
        {/* Executive Header of Trips Overview */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800">
                <Plane className="h-3.5 w-3.5" />
                Minhas Viagens & Roteiros Internacionais
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-display mt-1.5">
              Escolha uma Viagem para Abrir sua Página Exclusiva
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cada viagem possui seu próprio extrato na moeda oficial (EUR, USD, GBP...), câmbio médio ponderado (Wise/Nomad) e divisão de despesas isolada do Real.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label="Filtro de status das viagens"
              className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/90 p-1 border border-slate-200/80 dark:border-slate-700 gap-1"
            >
              <button
                type="button"
                data-testid="filter-active-trips-btn"
                aria-pressed={tripTabFilter === 'active'}
                onClick={() => handleSetTripTabFilter('active')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  tripTabFilter === 'active'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/30'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <span>Ativas ({activeTrips.length})</span>
              </button>
              <button
                type="button"
                data-testid="filter-archived-trips-btn"
                aria-pressed={tripTabFilter === 'archived'}
                onClick={() => handleSetTripTabFilter('archived')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  tripTabFilter === 'archived'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/30'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Archive className="h-3 w-3" />
                <span>Arquivadas ({archivedTrips.length})</span>
              </button>
            </div>

            <button
              type="button"
              data-testid="new-trip-btn"
              onClick={handleOpenNewTripModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>+ Criar Nova Viagem</span>
            </button>
          </div>
        </div>

        {/* Grid of Trip Cards (Same Pattern as Accounts and Credit Cards) */}
        <div
          data-testid="trips-overview-grid"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {displayedTrips.map((t) => {
            const tSummary = calculateTripDashboardSummary(t, transactions, categories);
            const tMeta = CURRENCY_CATALOG[t.currency];
            const tTxCount = transactions.filter(
              (tx) => tx.tripId === t.id && tx.type === 'expense' && !tx.isInvoicePayment
            ).length;

            return (
              <div
                key={t.id}
                data-testid={`trip-card-${t.id}`}
                onClick={() => handleSelectTrip(t.id)}
                className="group cursor-pointer rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-sky-500 dark:hover:border-sky-500 hover:shadow-md transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-xl shrink-0">
                        {tMeta?.flag || '✈️'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          {t.name}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {t.destination}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-lg bg-sky-100 dark:bg-sky-900/70 px-2 py-0.5 text-[11px] font-extrabold font-mono text-sky-900 dark:text-sky-200 shrink-0">
                      {t.currency} ({tMeta?.symbol})
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Minha Parte ({t.currency})
                      </span>
                      <span className="text-sm font-extrabold font-mono text-slate-900 dark:text-white">
                        {maskValue(
                          formatForeignCurrency(tSummary.myPersonalSpendForeign, t.currency)
                        )}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 block">
                        ≈ {maskValue(formatBRL(tSummary.myPersonalSpendBrl))}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Câmbio Médio (VET)
                      </span>
                      <span className="text-sm font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
                        {formatExchangeRateBR(tSummary.weightedAverageRate)}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {t.exchangeLots.length} compra(s) de câmbio
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {formatShortDateBR(t.startDate)} a {formatShortDateBR(t.endDate)}
                    </span>
                    <span className="font-semibold">
                      {t.participants.length} viajante(s) • {tTxCount} gasto(s)
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-sky-700 dark:text-sky-400 group-hover:underline">
                    Abrir Página da Viagem →
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenNewTripExpense(t.id);
                      }}
                      className="rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                    >
                      + Gasto ({t.currency})
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTrip(t.id);
                      }}
                      aria-label={`Excluir viagem ${t.name}`}
                      title="Excluir viagem"
                      className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40 p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {newTripModalNode}
      </div>
    );
  }

  return (
    <div id="trips-container" data-testid="trip-dedicated-page" className="space-y-5">
      {/* Top Navigation Bar: Back to All Trips + Quick Trip Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          data-testid="back-to-trips-list-btn"
          onClick={() => setActiveViewTripId(null)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-2xs"
        >
          <ArrowLeft className="h-4 w-4 text-sky-600" />
          <span>Voltar para Todas as Viagens ({trips.length})</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {displayedTrips.map((t) => {
            const isSelected = t.id === activeTrip.id;
            const flag = CURRENCY_CATALOG[t.currency]?.flag || '🌍';
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTrip(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all border ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-emerald-600 dark:border-emerald-500 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                <span>{flag}</span>
                <span className="truncate max-w-[160px]">{t.name}</span>
                <span className="text-[10px] opacity-80">({t.currency})</span>
              </button>
            );
          })}
          <button
            type="button"
            data-testid="new-trip-btn"
            onClick={handleOpenNewTripModal}
            className="inline-flex items-center gap-1 rounded-xl border border-dashed border-emerald-400 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nova Viagem</span>
          </button>
        </div>
      </div>

      {/* Dedicated Trip Header Card */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Row 1: Badges & Right-Aligned Toolbar (Segmented Control Period Selector + Export Button) */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800">
              <Plane className="h-3.5 w-3.5" />
              Página Exclusiva: {activeTrip.name}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <span>{currencyMeta.flag}</span>
              <span>Moeda Exclusiva: {activeTrip.currency} ({currencyMeta.symbol})</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
              Câmbio VET Médio: {formatExchangeRateBR(summary.weightedAverageRate)}
            </span>
            {activeTrip.isArchived && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <Archive className="h-3 w-3" />
                Viagem Arquivada / Concluída
              </span>
            )}
          </div>

          {/* Right-Aligned Toolbar: Period Segmented Control + Export Button + Action Buttons */}
          <div
            data-testid="trips-right-toolbar"
            className="flex flex-wrap items-center justify-end gap-2.5 sm:gap-3 ml-auto"
          >
            {/* Segmented Control: Period Selector */}
            <div
              role="group"
              aria-label="Seletor de período"
              className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/90 p-1 border border-slate-200/80 dark:border-slate-700 gap-1"
            >
              <button
                type="button"
                data-testid="toolbar-period-lot-btn"
                aria-pressed={chartPeriodMode === 'lot'}
                onClick={() => setChartPeriodMode('lot')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  chartPeriodMode === 'lot'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Por Lote
              </button>
              <button
                type="button"
                data-testid="toolbar-period-month-btn"
                aria-pressed={chartPeriodMode === 'month'}
                onClick={() => setChartPeriodMode('month')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  chartPeriodMode === 'month'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Por Mês
              </button>
            </div>

            {/* PDF Report Export Button */}
            <button
              type="button"
              data-testid="export-pdf-report-btn"
              onClick={handleExportPdfReport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-2xs"
              title="Exportar Resumo PDF com Lotes de Câmbio, Economia e Despesas (Download Direto)"
            >
              <FileDown className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Exportar Relatório PDF</span>
            </button>

            {/* Smart Currency Converter Toggle */}
            <button
              type="button"
              data-testid="toggle-smart-converter-btn"
              onClick={() => setIsConverterOpen(!isConverterOpen)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
                isConverterOpen
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
              }`}
              title="Abrir utilitário de conversão inteligente com o último câmbio"
            >
              <Calculator className="h-3.5 w-3.5 text-emerald-600" />
              <span>Conversor Inteligente</span>
            </button>

            <button
              type="button"
              onClick={handleOpenLotModal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
            >
              <Coins className="h-3.5 w-3.5 text-amber-600" />
              <span>+ Câmbio</span>
            </button>

            <button
              type="button"
              data-testid="add-trip-participant-btn"
              onClick={() => setIsParticipantModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5 text-sky-600" />
              <span>+ Convidar Viajante</span>
            </button>

            <button
              type="button"
              data-testid="launch-trip-expense-btn"
              onClick={() => onOpenNewTripExpense(activeTrip.id)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Lançar Gasto ({activeTrip.currency})</span>
            </button>
          </div>
        </div>

        {/* Trip Subtitle, Dates, Archival Action & Participants Info */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
              <Globe className="h-3.5 w-3.5 text-sky-600" />
              {activeTrip.destination}
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              {formatShortDateBR(activeTrip.startDate)} até{' '}
              {formatShortDateBR(activeTrip.endDate)} ({summary.totalDays} dias)
            </span>

            {/* Archive / Unarchive Button */}
            <button
              type="button"
              data-testid="toggle-archive-trip-btn"
              onClick={() => handleToggleArchiveTrip(activeTrip)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors inline-flex items-center gap-1 ${
                activeTrip.isArchived
                  ? 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 hover:bg-sky-100'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
              title={
                activeTrip.isArchived
                  ? 'Desarquivar e retornar aos roteiros ativos'
                  : 'Arquivar viagem (mover para histórico e remover das ativas)'
              }
            >
              {activeTrip.isArchived ? (
                <>
                  <ArchiveRestore className="h-3 w-3 text-sky-600" />
                  <span>Restaurar para Ativas</span>
                </>
              ) : (
                <>
                  <Archive className="h-3 w-3 text-amber-600" />
                  <span>Arquivar Viagem</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleOpenEditTripModal(activeTrip)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
            >
              Editar Roteiro
            </button>

            <button
              type="button"
              data-testid="delete-active-trip-btn"
              onClick={() => {
                onDeleteTrip(activeTrip.id);
                setActiveViewTripId(null);
              }}
              className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40 px-2.5 py-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors inline-flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
              <span>Excluir Viagem</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400">
              Participantes ({activeTrip.participants.length}):
            </span>
            {activeTrip.participants.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Smart Currency Converter Inside the Trip (Trip Local Currency ⇄ BRL with Google Search Live Rate & Trip VET) */}
      {isConverterOpen && (
        <div className="animate-fade-in-up" data-testid="trip-inside-quick-converter">
          <SmartCurrencyConverterCard
            exchangeLots={activeTrip.exchangeLots}
            getAuthToken={getAuthToken}
            currency={activeTrip.currency}
            defaultExchangeRate={activeTrip.defaultExchangeRate}
            remainingForeignBalance={summary.remainingForeignWalletBalance}
            privacyMode={privacyMode}
            allowCurrencyChange={false}
            onUseConvertedValue={() => onOpenNewTripExpense(activeTrip.id)}
            onApplyLiveRateToTrip={(liveRate) =>
              onUpdateTrip({
                ...activeTrip,
                defaultExchangeRate: liveRate,
              })
            }
          />
        </div>
      )}

      {/* 4 KPI Cards (2x2 on Mobile, 4 Columns on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Minha Parte Pessoal */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Minha Parte Real
            </span>
            <Wallet className="h-4 w-4 text-emerald-600 shrink-0" />
          </div>
          <p className="mt-1.5 text-base sm:text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums truncate">
            {maskValue(
              formatForeignCurrency(summary.myPersonalSpendForeign, activeTrip.currency)
            )}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            ≈ {maskValue(formatBRL(summary.myPersonalSpendBrl))}
          </p>
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mb-1">
              <span>Meta: {formatForeignCurrency(summary.budgetForeign, activeTrip.currency)}</span>
              <span>{summary.budgetUsedPercent}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  summary.budgetUsedPercent > 100
                    ? 'bg-rose-500'
                    : summary.budgetUsedPercent >= 80
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, summary.budgetUsedPercent)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Ritmo Diário TravelSpend */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Ritmo Diário (Média)
            </span>
            <TrendingUp className="h-4 w-4 text-sky-600 shrink-0" />
          </div>
          <p className="mt-1.5 text-base sm:text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums truncate">
            {maskValue(
              `${formatForeignCurrency(summary.myDailyAverageForeign, activeTrip.currency)}/dia`
            )}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            ≈ {maskValue(`${formatBRL(summary.myDailyAverageBrl)}/dia`)}
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold leading-tight">
            Pode gastar{' '}
            <span className="font-bold font-mono">
              {formatForeignCurrency(
                summary.safeRemainingDailyForeign,
                activeTrip.currency
              )}
              /dia
            </span>{' '}
            dentro da meta
          </div>
        </div>

        {/* Card 3: Bolso de Câmbio & VET Médio */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Saldo Wise / Espécie
            </span>
            <Coins className="h-4 w-4 text-amber-600 shrink-0" />
          </div>
          <p className="mt-1.5 text-base sm:text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums truncate">
            {maskValue(
              formatForeignCurrency(
                summary.remainingForeignWalletBalance,
                activeTrip.currency
              )
            )}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
            Comprado: {formatForeignCurrency(summary.totalForeignPurchased, activeTrip.currency)}
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-semibold truncate">
            VET Médio:{' '}
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {formatExchangeRateBR(summary.weightedAverageRate)}
            </span>{' '}
            por 1 {activeTrip.currency}
          </div>
        </div>

        {/* Card 4: Acerto em Grupo (Splitwise) */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Meu Saldo no Grupo
            </span>
            <Users className="h-4 w-4 text-violet-600 shrink-0" />
          </div>
          <p
            className={`mt-1.5 text-base sm:text-xl font-extrabold font-mono tabular-nums truncate ${
              summary.myNetSettlementForeign > 0.01
                ? 'text-emerald-600 dark:text-emerald-400'
                : summary.myNetSettlementForeign < -0.01
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {summary.myNetSettlementForeign > 0.01
              ? `+${maskValue(
                  formatForeignCurrency(
                    summary.myNetSettlementForeign,
                    activeTrip.currency
                  )
                )}`
              : summary.myNetSettlementForeign < -0.01
              ? maskValue(
                  formatForeignCurrency(
                    summary.myNetSettlementForeign,
                    activeTrip.currency
                  )
                )
              : 'Quitado (0,00)'}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {summary.myNetSettlementBrl > 0.01
              ? `A receber: ${maskValue(formatBRL(summary.myNetSettlementBrl))}`
              : summary.myNetSettlementBrl < -0.01
              ? `A pagar: ${maskValue(formatBRL(Math.abs(summary.myNetSettlementBrl)))}`
              : 'Sem pendências no grupo'}
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 truncate">
            Gasto Total Grupo:{' '}
            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
              {formatForeignCurrency(summary.groupTotalSpendForeign, activeTrip.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* 4-Column Sub-navigation Grid (100% Visible without Horizontal Scrollbar) */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-2xs">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setActiveSubView('overview_spend')}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
              activeSubView === 'overview_spend'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <Receipt className="h-4 w-4 shrink-0" />
            <span className="truncate">
              1. Diário & Extrato ({tripTransactions.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('group_split')}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
              activeSubView === 'group_split'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <Users className="h-4 w-4 shrink-0" />
            <span className="truncate">2. Divisão & Quem Deve</span>
            {summary.simplifiedDebts.length > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold shrink-0 ${
                  activeSubView === 'group_split'
                    ? 'bg-white/25 text-white'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {summary.simplifiedDebts.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('fx_wallet')}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
              activeSubView === 'fx_wallet'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <Coins className="h-4 w-4 shrink-0" />
            <span className="truncate">
              3. Carteira Câmbio ({activeTrip.exchangeLots.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('how_it_works')}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
              activeSubView === 'how_it_works'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            <span className="truncate">4. Guia: Como Funciona</span>
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: TRAVELSPEND DAILY PACE, CATEGORIES & EXPENSE LIST */}
      {activeSubView === 'overview_spend' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Daily Spend Bar Chart */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                    Gastos Dia a Dia na Viagem ({activeTrip.currency})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Acompanhe picos diários em moeda estrangeira e equivalência em Reais
                  </p>
                </div>
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 self-start">
                  <button
                    type="button"
                    onClick={() => setChartMode('my_share')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      chartMode === 'my_share'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    Minha Parte
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode('group_total')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      chartMode === 'group_total'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    Total do Grupo
                  </button>
                </div>
              </div>

              <div className="flex items-end gap-2 h-44 pt-6 pb-2 overflow-x-auto custom-scrollbar">
                {summary.dailySeries.map((pt) => {
                  const valForeign =
                    chartMode === 'my_share'
                      ? pt.mySpendForeign
                      : pt.groupSpendForeign;
                  const valBrl =
                    chartMode === 'my_share' ? pt.mySpendBrl : pt.groupSpendBrl;
                  const maxVal = Math.max(
                    1,
                    ...summary.dailySeries.map((d) =>
                      chartMode === 'my_share'
                        ? d.mySpendForeign
                        : d.groupSpendForeign
                    )
                  );
                  const heightPct =
                    valForeign > 0
                      ? Math.max(12, Math.round((valForeign / maxVal) * 100))
                      : 4;

                  return (
                    <div
                      key={pt.date}
                      className="flex flex-col items-center justify-end h-full min-w-[46px] flex-1 group"
                    >
                      <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {valForeign > 0
                          ? `${currencyMeta.symbol}${Math.round(valForeign)}`
                          : '—'}
                      </span>
                      <div className="w-full max-w-[34px] bg-slate-100 dark:bg-slate-800 rounded-t-lg h-28 flex items-end overflow-hidden">
                        <div
                          className={`w-full rounded-t-lg transition-all ${
                            valForeign > 0
                              ? chartMode === 'my_share'
                                ? 'bg-emerald-500 group-hover:bg-emerald-600'
                                : 'bg-sky-500 group-hover:bg-sky-600'
                              : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                          style={{ height: `${heightPct}%` }}
                          title={`${pt.dayLabel}: ${formatForeignCurrency(
                            valForeign,
                            activeTrip.currency
                          )} (${formatBRL(valBrl)})`}
                        />
                      </div>
                      <span className="mt-1.5 text-[10px] font-semibold text-slate-500">
                        {pt.dayLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category Breakdown in Trip */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                Gastos por Categoria
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Sua parte acumulada por tipo de despesa
              </p>

              {summary.categoryBreakdown.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">
                  Nenhuma despesa registrada nesta viagem ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {summary.categoryBreakdown.map((cat) => (
                    <div key={cat.categoryId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {cat.categoryName}
                        </span>
                        <div className="text-right font-mono tabular-nums">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formatForeignCurrency(
                              cat.mySpendForeign,
                              activeTrip.currency
                            )}
                          </span>
                          <span className="text-[11px] text-slate-400 ml-1.5">
                            ({formatBRL(cat.mySpendBrl)})
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(6, cat.percentOfMySpend))}%`,
                            backgroundColor: cat.categoryColor,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Exchange Savings Bar Chart with Zoom, Period Selector and Tooltips */}
          <TripSavingsChart
            exchangeLots={activeTrip.exchangeLots}
            currency={activeTrip.currency}
            fallbackBenchmarkRate={activeTrip.defaultExchangeRate}
            privacyMode={privacyMode}
            isLoading={isChartLoading}
            periodMode={chartPeriodMode}
            onPeriodModeChange={setChartPeriodMode}
            onExportPdfReport={handleExportPdfReport}
          />

          {/* Multi-Currency Trip Expenses Feed */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                  Extrato Multi-Moeda da Viagem ({tripTransactions.length} lançamentos)
                </h3>
                <p className="text-xs text-slate-500">
                  Mostra o valor em moeda estrangeira e a conversão efetiva em Reais (BRL), regime cambial e a sua parte real
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenNewTripExpense(activeTrip.id)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors self-start"
              >
                <Plus className="h-3.5 w-3.5" />
                Nova Despesa na Viagem
              </button>
            </div>

            {tripTransactions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center">
                <p className="text-xs text-slate-500">
                  Nenhum gasto vinculado a esta viagem. Clique em &ldquo;Nova Despesa na Viagem&rdquo; para lançar em {activeTrip.currency} ou R$.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {tripTransactions.map((tx) => {
                  const payer =
                    activeTrip.participants.find(
                      (p) => p.id === (tx.paidByParticipantId || 'me')
                    ) || activeTrip.participants[0];
                  const txCurr = tx.originalCurrency || activeTrip.currency;
                  const txForeign = tx.originalAmount || tx.amount;
                  const myShareForeign =
                    tx.myPersonalShareForeign ??
                    tx.tripShares?.find((s) => s.participantId === 'me')
                      ?.foreignShare ??
                    txForeign;
                  const myShareBrl =
                    tx.myPersonalShareBrl ??
                    tx.tripShares?.find((s) => s.participantId === 'me')
                      ?.brlShare ??
                    tx.amount;
                  const regimeInfo = tx.currencyRegime
                    ? CURRENCY_REGIME_DEFAULTS[tx.currencyRegime]
                    : null;

                  return (
                    <div
                      key={tx.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 hover:border-slate-300 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {tx.description}
                          </span>
                          <span className="rounded-md bg-slate-200/80 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                            {formatShortDateBR(tx.date)}
                          </span>
                          {regimeInfo && (
                            <span className="rounded-md bg-sky-50 dark:bg-sky-950/60 border border-sky-200/60 dark:border-sky-800 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                              {regimeInfo.shortLabel}
                            </span>
                          )}
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              payer?.isMe
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            Pago por: {payer?.name || 'Você'}
                          </span>
                        </div>

                        {/* Dual-Currency Explicit Display Badges */}
                        <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 font-mono font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] text-slate-500 font-sans font-semibold">Valor Original:</span>
                            {formatForeignCurrency(txForeign, txCurr)}
                          </span>
                          <span className="text-slate-400 font-bold">⇄</span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 font-mono font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-semibold">Convertido em R$:</span>
                            {formatBRL(tx.amount)}
                          </span>
                          {tx.effectiveExchangeRate && txCurr !== 'BRL' && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                              VET: {formatExchangeRateBR(tx.effectiveExchangeRate)}
                            </span>
                          )}
                          {tx.tripShares && tx.tripShares.length > 1 && (
                            <span className="text-[11px] text-slate-500">
                              • Dividido entre {tx.tripShares.length} pessoas
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/60 dark:border-slate-800 shrink-0">
                        <div className="text-left sm:text-right">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            Sua Parte Real
                          </span>
                          <div className="font-mono">
                            <span className="block text-sm font-extrabold text-slate-900 dark:text-white">
                              {maskValue(formatForeignCurrency(myShareForeign, txCurr))}
                            </span>
                            <span className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                              ≈ {maskValue(formatBRL(myShareBrl))}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditTransaction(tx)}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTransaction(tx.id)}
                            aria-label="Excluir despesa de viagem"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* SUB-VIEW 3: FX WALLET & WEIGHTED AVERAGE RATE LOTS */}
      {activeSubView === 'fx_wallet' && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                Bolsos de Câmbio & Preço Médio Ponderado ({activeTrip.currency})
              </h3>
              <p className="text-xs text-slate-500">
                Cadastre suas remessas Wise, Nomad ou compras em espécie para o app calcular automaticamente seu Câmbio Médio Real (VET)
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenLotModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors self-start"
            >
              <Plus className="h-3.5 w-3.5" />
              Registrar Compra de {activeTrip.currency}
            </button>
          </div>

          {/* Smart Currency Converter Utility in FX Wallet */}
          <SmartCurrencyConverterCard
            exchangeLots={activeTrip.exchangeLots}
            getAuthToken={getAuthToken}
            currency={activeTrip.currency}
            defaultExchangeRate={activeTrip.defaultExchangeRate}
            remainingForeignBalance={summary.remainingForeignWalletBalance}
            privacyMode={privacyMode}
            onUseConvertedValue={() => onOpenNewTripExpense(activeTrip.id)}
          />

          {/* Exchange Savings Bar Chart in FX Wallet */}
          <TripSavingsChart
            exchangeLots={activeTrip.exchangeLots}
            currency={activeTrip.currency}
            fallbackBenchmarkRate={activeTrip.defaultExchangeRate}
            privacyMode={privacyMode}
            isLoading={isChartLoading}
            periodMode={chartPeriodMode}
            onPeriodModeChange={setChartPeriodMode}
            onExportPdfReport={handleExportPdfReport}
          />

          {activeTrip.exchangeLots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center">
              <p className="text-xs text-slate-500">
                Nenhum lote de câmbio registrado. O sistema está usando a cotação referência padrão ({formatExchangeRateBR(activeTrip.defaultExchangeRate)}).
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeTrip.exchangeLots.map((lot) => (
                <div
                  key={lot.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {lot.sourceLabel}
                      </span>
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                        {formatShortDateBR(lot.date)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Cotação Base: {formatExchangeRateBR(lot.rateBase)} + IOF{' '}
                      {lot.iofPercent}% →{' '}
                      <strong className="text-emerald-700 dark:text-emerald-400 font-mono">
                        VET {formatExchangeRateBR(lot.effectiveRateBrl)}
                      </strong>
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="text-right font-mono">
                      <span className="block text-sm font-extrabold text-slate-900 dark:text-white">
                        +{formatForeignCurrency(lot.foreignAmount, lot.currency)}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        Custo: {formatBRL(lot.totalBrlPaid)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteExchangeLot(activeTrip.id, lot.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Remover lote de câmbio"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 4: COMPLETE EXPLANATION OF ALL MULTI-CURRENCY & GROUP SCENARIOS */}
      {activeSubView === 'how_it_works' && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
              Guia de Arquitetura Financeira: Viagens, Multi-Moeda & Rateio em Grupo
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Como o Minhas Economias BR resolve todas as possibilidades reais de compras internacionais, IOF e reembolsos entre amigos ou casal:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-800/30">
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                <Coins className="h-4 w-4" />
                1. Lançamento em Outra Moeda (4 Regimes de Conversão)
              </span>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                No formulário de <strong>Novo Lançamento</strong>, ao escolher USD, EUR, GBP, ARS, CLP etc., o app calcula o valor exato em Reais conforme o meio usado:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                <li>
                  <strong>Conta Global (Wise / Nomad / C6 / Inter):</strong> Usa automaticamente o seu <em>Câmbio Médio Ponderado</em> dos lotes comprados (ou câmbio comercial + 1,1% IOF).
                </li>
                <li>
                  <strong>Cartão de Crédito Brasileiro no Exterior:</strong> Aplica a cotação do cartão + <strong>3,38% de IOF</strong> e lança o valor exato em R$ direto na fatura do cartão.
                </li>
                <li>
                  <strong>Papel Moeda (Espécie):</strong> Converte pela taxa efetiva paga na casa de câmbio.
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-800/30">
              <span className="inline-flex items-center gap-1.5 font-bold text-sky-700 dark:text-sky-400">
                <Users className="h-4 w-4" />
                2. Quando Você Paga vs. Quando um Amigo Paga
              </span>
              <ul className="list-disc pl-4 space-y-1.5 text-slate-600 dark:text-slate-300">
                <li>
                  <strong>Se VOCÊ pagou a conta do restaurante (€ 90 para 3 pessoas):</strong> O seu banco/cartão registra a saída real de € 90 (R$ 579,68), mas o seu orçamento pessoal da viagem registra apenas a <strong>Sua Parte Real (€ 30 / R$ 193,23)</strong> e lança € 60 a receber dos amigos.
                </li>
                <li>
                  <strong>Se um AMIGO pagou no cartão dele (€ 150 para 3 pessoas):</strong> O sistema <strong>NÃO desconta do seu banco brasileiro</strong> (isolamento contábil), soma € 50 na sua meta pessoal de gastos da viagem e registra que você deve € 50 a ele.
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-800/30">
              <span className="inline-flex items-center gap-1.5 font-bold text-violet-700 dark:text-violet-400">
                <ArrowLeftRight className="h-4 w-4" />
                3. Como Receber ou Pagar (Em R$ no PIX ou na Moeda da Viagem)
              </span>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Na aba <strong>Divisão do Grupo & Acerto</strong>, ao clicar em <em>Liquidar / Receber</em>, você escolhe como o dinheiro foi transferido:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                <li>
                  <strong>Receber/Pagar em R$ via PIX:</strong> Você pode usar o <strong>VET Efetivo (com IOF incluso)</strong> para não sair no prejuízo dos impostos que pagou no cartão, ou definir uma cotação combinada. O app ainda cria automaticamente a entrada/saída em R$ no seu extrato bancário!
                </li>
                <li>
                  <strong>Receber/Pagar em EUR ou USD (Wise-to-Wise ou Notas):</strong> Quita a dívida diretamente na moeda estrangeira sem mexer no saldo em Reais do seu banco no Brasil.
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-800/30">
              <span className="inline-flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                <Sparkles className="h-4 w-4" />
                4. 5 Modos de Rateio sem Erro de Centavos
              </span>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Cada despesa da viagem pode ser dividida de 5 formas: <strong>Igualitária (1/N)</strong>, <strong>Valores Exatos</strong> (quando cada pessoa pede um prato diferente), <strong>Porcentagem (%)</strong>, <strong>Cotas/Pesos</strong> (ex: casal paga 2 cotas, solteiro paga 1) ou <strong>100% Individual</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: NOVA OU EDITAR VIAGEM */}
      {newTripModalNode}

      {/* MODAL 2: COMPRAR CÂMBIO (WISE / NOMAD / ESPÉCIE) */}
      {isLotModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 p-0 sm:p-4 overflow-hidden modal-shell"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-sheet-up sm:animate-modal-in">
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
                      onChange={(e) => setLotBaseRateStr(e.target.value)}
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
                      onChange={(e) => setLotIofPercentStr(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Descontar Reais (R$) de alguma conta bancária? (Opcional)
                  </label>
                  <select
                    value={lotDebitAccountId}
                    onChange={(e) => setLotDebitAccountId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  >
                    <option value="">Não gerar débito no extrato bancário</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        Debitar de: {acc.name} ({acc.institution})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Live Preview */}
                {(() => {
                  const preview = calculateConvertedBrlAmount(
                    parseCurrencyInput(lotForeignAmountStr, activeTrip.currency),
                    parseBRLInput(lotBaseRateStr),
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
          <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-sheet-up sm:animate-modal-in">
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

      {/* MODAL 4: LIQUIDAR / RECEBER REEMBOLSO MULTI-MOEDA */}
      {activeSettlementDebt && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 p-0 sm:p-4 overflow-hidden modal-shell"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-sheet-up sm:animate-modal-in">
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                  Acerto de Contas Multi-Moeda ({activeSettlementDebt.fromName} →{' '}
                  {activeSettlementDebt.toName})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Escolha se o reembolso será feito em Reais (PIX) ou na moeda da viagem ({activeTrip.currency})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSettlementDebt(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSettlement} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 modal-form-scroll custom-scrollbar text-xs">
                {settlementError && (
                  <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                    {settlementError}
                  </p>
                )}
                {/* Method Selection */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Como esse pagamento está sendo realizado?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSettlementMethod('pix_brl')}
                      className={`rounded-xl border p-2.5 text-left transition-all ${
                        settlementMethod === 'pix_brl'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-bold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <span className="block text-xs">🇧🇷 PIX em Reais (R$)</span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">
                        Converte para R$ e pode cair na sua conta bancária
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettlementMethod('wise_foreign')}
                      className={`rounded-xl border p-2.5 text-left transition-all ${
                        settlementMethod === 'wise_foreign'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-bold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <span className="block text-xs">
                        {currencyMeta.flag} Wise / Nomad ({activeTrip.currency})
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">
                        Transferência direta em {activeTrip.currency} entre contas globais
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettlementMethod('cash_foreign')}
                      className={`rounded-xl border p-2.5 text-left transition-all ${
                        settlementMethod === 'cash_foreign'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-bold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <span className="block text-xs">
                        💵 Notas em Espécie ({activeTrip.currency})
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">
                        Pago em mãos com papel moeda durante a viagem
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Valor Abatido da Dívida ({activeTrip.currency})
                    </label>
                    <CurrencyInput
                      required
                      value={settlementForeignAmountStr}
                      currency={activeTrip.currency}
                      onValueChange={(value) => {
                        setSettlementForeignAmountStr(value);
                        setSettlementError(null);
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Qual câmbio usar para converter em R$?
                    </label>
                    <select
                      value={settlementRateMode}
                      onChange={(e) =>
                        setSettlementRateMode(
                          e.target.value as 'effective_vet' | 'custom_ptax'
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-semibold"
                    >
                      <option value="effective_vet">
                        VET Efetivo c/ IOF ({formatExchangeRateBR(activeSettlementDebt.impliedEffectiveRate)})
                      </option>
                      <option value="custom_ptax">
                        Cotação Combinada / PTAX Manual
                      </option>
                    </select>
                  </div>
                </div>

                {settlementRateMode === 'custom_ptax' && (
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Cotação Combinada (R$ por 1 {activeTrip.currency})
                    </label>
                    <input
                      type="text"
                      value={settlementCustomRateStr}
                      onChange={(e) => {
                        setSettlementCustomRateStr(e.target.value);
                        setSettlementError(null);
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                )}

                {/* Bank Account Reconciliation Option when settling in BRL */}
                {settlementMethod === 'pix_brl' &&
                  (activeSettlementDebt.fromParticipantId === 'me' ||
                    activeSettlementDebt.toParticipantId === 'me') && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-2.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settlementRecordInBank}
                          onChange={(e) => setSettlementRecordInBank(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {activeSettlementDebt.toParticipantId === 'me'
                            ? 'Creditar automaticamente este PIX recebido no meu saldo bancário'
                            : 'Debitar automaticamente este PIX pago do meu saldo bancário'}
                        </span>
                      </label>

                      {settlementRecordInBank && (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                            Conta Bancária do PIX:
                          </label>
                          <select
                            value={settlementBankAccountId}
                            onChange={(e) => setSettlementBankAccountId(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white font-semibold"
                          >
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name} ({acc.institution})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                {/* Summary Preview Box */}
                {(() => {
                  const fAmt =
                    parseCurrencyInput(settlementForeignAmountStr, activeTrip.currency) ||
                    activeSettlementDebt.amountForeign;
                  const rUsed =
                    settlementRateMode === 'effective_vet'
                      ? activeSettlementDebt.impliedEffectiveRate
                      : Math.max(0.0001, parseBRLInput(settlementCustomRateStr));
                  const totalBrl = Math.round(fAmt * rUsed * 100) / 100;

                  return (
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5 flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                          Dívida Abatida na Viagem
                        </span>
                        <span className="text-sm font-mono font-extrabold text-emerald-900 dark:text-white">
                          {formatForeignCurrency(fAmt, activeTrip.currency)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                          Valor Equivalente em Reais
                        </span>
                        <span className="text-base font-mono font-extrabold text-emerald-900 dark:text-white">
                          {formatBRL(totalBrl)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 shrink-0 bg-slate-50/70 dark:bg-slate-800/40 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
                <button
                  type="button"
                  onClick={() => setActiveSettlementDebt(null)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                >
                  Confirmar Liquidação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable PDF Financial Summary Report Modal */}
      {isPdfReportModalOpen && (
        <TripPdfReportModal
          trip={activeTrip}
          summary={summary}
          transactions={transactions}
          categories={categories}
          isOpen={isPdfReportModalOpen}
          onClose={() => setIsPdfReportModalOpen(false)}
        />
      )}
    </div>
  );
};
