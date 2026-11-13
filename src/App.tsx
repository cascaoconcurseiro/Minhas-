import { getAccountCurrency, resolveBankTransfer } from './utils/transferRules';
import { newEntityId } from './utils/ids';
import { settleSharedExpenses, reopenSharedSettlement, replaceIncomingSharedTransactions, applyRemoteSettlementReports, collectSharedSettlementReceipts, restoreSharedSettlementReceipts } from './utils/sharedFinanceRules';
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { hasUpdateBlockers, setUpdateBlocker } from './pwa/updateBlockers';
import { parseQuickCsvLines } from './utils/quickCsvImport';
import {
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Menu,
  Plus,
  RotateCcw,
  Search,
  Settings,
  X,
} from 'lucide-react';
import {
  auth,
  onAuthStateChanged,
  getOrCreateAutoCloudVaultId,
  getVaultIdForUid,
  registerWithEmail,
  signInWithEmail,
  signInWithPasskey,
  signOutUser,
  type User,
} from './lib/authClient';
import {
  createNeonWorkspace,
  createNeonFamilyInvitation,
  loadNeonFamilyInvitations,
  loadNeonSharedSnapshot,
  loadNeonWorkspace,
  loadNeonWorkspaceRevision,
  NeonWorkspaceError,
  type NeonWorkspaceSnapshot,
  revokeNeonFamilyInvitation,
  respondToNeonFamilyInvitation,
  saveNeonWorkspace,
  syncNeonSharedTransactions,
} from './lib/neonWorkspace';
import {
  AppSettings,
  BankAccount,
  Category,
  CreditCard,
  FamilyMember,
  InvestmentAsset,
  InvestmentTargetMap,
  SavingsGoal,
  Transaction,
  Trip,
  TripExchangeLot,
  TripSettlement,
} from './types/finance';
import {
  addMonthsToYearMonth,
  applyCascadeAccountDelete,
  applyCascadeTransactionDelete,
  applyCascadeTransactionEdit,
  calculateAccountBalances,
  duplicateFinancialTransaction,
  canSettleTransactionDirectly,
  getTransactionEditRestriction,
  isSharedTransactionCreatedByOther,
  calculateCategoryBreakdown,
  calculateCreditCardSummary,
  calculateMonthlySummary,
  applyReconciledBankTransactions,
  CascadeScope,
  CreateTransactionBatchInput,
  createTransactionBatch,
  formatBRL,
  getTransactionsLinkedToCreditCard,
  getTransactionsLinkedToCategory,
  getLocalDateISO,
  formatMonthYearPT,
  payCreditCardInvoice,
  toggleTransactionStatusWithCascade,
  calculateNetWorth,
  calculateCurrentPosition,
  calculateSharedAmount,
  resolveCreditCardInvoiceMonth,
} from './utils/financeRules';
import {
  DEFAULT_MONTH,
  INITIAL_ACCOUNTS,
  INITIAL_CATEGORIES,
  INITIAL_CREDIT_CARDS,
  INITIAL_FAMILY_MEMBERS,
  INITIAL_INVESTMENTS,
  INITIAL_SAVINGS_GOALS,
  INITIAL_TRANSACTIONS,
  INITIAL_TRIPS,
} from './utils/seedData';
import {
  applyAssetOperation,
  createInvestmentCashMovement,
  planAssetContribution,
  createGoalInvestmentContribution,
  getInvestmentDeletionRestriction,
  DEFAULT_INVESTMENT_TARGETS,
} from './utils/investmentRules';
import { parseWorkspaceArray, parseWorkspaceObject } from './utils/workspacePayload';
import {
  parsePersistedSettings,
  removeSmtpPasswordsFromSettings,
  sanitizeStoredWorkspaceSnapshot,
  serializeSettingsWithoutSmtpSecrets,
} from './utils/secureSettings';
import {
  isRetryableWorkspaceSaveError,
  updateWorkspaceConflictLocalPayload,
} from './utils/workspaceSyncRecovery';
import { applyHighConfidenceInstallmentTotals } from './utils/legacyFinancialAudit';
import {
  clearWorkspaceCacheForVault,
  isWorkspaceLoadedForUser,
  shouldResetWorkspaceForAuthChange,
} from './utils/workspaceSession';
const OverviewTab = lazy(() => import('./components/OverviewTab').then((m) => ({ default: m.OverviewTab })));
const AccountsTab = lazy(() => import('./components/AccountsTab').then((m) => ({ default: m.AccountsTab })));
const InvestmentsTab = lazy(() => import('./components/InvestmentsTab').then((m) => ({ default: m.InvestmentsTab })));
const TransactionsTab = lazy(() => import('./components/TransactionsTab').then((m) => ({ default: m.TransactionsTab })));
const CreditCardsTab = lazy(() => import('./components/CreditCardsTab').then((m) => ({ default: m.CreditCardsTab })));
const SharedExpensesTab = lazy(() => import('./components/SharedExpensesTab').then((m) => ({ default: m.SharedExpensesTab })));
const TripsTab = lazy(() => import('./components/TripsTab').then((m) => ({ default: m.TripsTab })));
const BudgetsTab = lazy(() => import('./components/BudgetsTab').then((m) => ({ default: m.BudgetsTab })));
const GoalsAndSimulatorTab = lazy(() => import('./components/GoalsAndSimulatorTab').then((m) => ({ default: m.GoalsAndSimulatorTab })));
const ReportsAndDataTab = lazy(() => import('./components/ReportsAndDataTab').then((m) => ({ default: m.ReportsAndDataTab })));
const AuthAndCloudTab = lazy(() => import('./components/AuthAndCloudTab').then((m) => ({ default: m.AuthAndCloudTab })));
import { FaceIdOfferBanner } from './components/FaceIdOfferBanner';
const LoginPage = lazy(() => import('./components/LoginPage').then((m) => ({ default: m.LoginPage })));
const TransactionModal = lazy(() => import('./components/TransactionModal').then((m) => ({ default: m.TransactionModal })));
const GlobalSearchPanel = lazy(() => import('./components/GlobalSearchPanel').then((m) => ({ default: m.GlobalSearchPanel })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal })));
const ReminderCenterModal = lazy(() => import('./components/ReminderCenterModal').then((m) => ({ default: m.ReminderCenterModal })));
const BankReconciliationModal = lazy(() => import('./components/BankReconciliationModal').then((m) => ({ default: m.BankReconciliationModal })));
const WorkspaceConflictModal = lazy(() => import('./components/WorkspaceConflictModal').then((m) => ({ default: m.WorkspaceConflictModal })));
import { MobileBottomNav } from './components/MobileBottomNav';
import { SidebarNav } from './components/SidebarNav';
import {
  BudgetsSkeleton,
  CreditCardsSkeleton,
  DashboardSkeleton,
  ReportsSkeleton,
  TransactionsSkeleton,
} from './components/SkeletonScreens';
import type { WorkspaceConflictState } from './components/WorkspaceConflictModal';
import { parseCachedWorkspace } from './utils/workspaceCache';
import { forecastCashBalance } from './utils/cashForecast';
import { assessDataHealth } from './utils/dataHealth';
import {
  calculateCardCommitmentByMonth,
  describeCommitmentAfterPurchase,
  getCommitmentAlerts,
} from './utils/cardCommitment';
import { workspaceContentSignature } from './utils/workspaceSyncRecovery';
import { buildAppNotices, countBellNotices, type AppNoticeAction } from './utils/appNotices';
import { detectRecurringExpenses, type RecurringCandidate } from './utils/recurrenceDetection';
import { learnSharingFromHistory } from './utils/learningRules';
import {
  mergeCategoryCatalog,
  stripLegacySubcategories,
  stripLegacyTransactionSubcategory,
} from './utils/categoryCatalog';
import {
  anticipateCardInstallments,
  reverseInstallmentAnticipation,
} from './utils/uxEnhancementRules';
import { compactTransactionListForStorage } from './utils/ofxParser';
import {
  getPortableBackupFamilyMembers,
  getPortableBackupTransactions,
  mergeRestoredFamilyMembersWithCurrentIncoming,
  mergeRestoredTransactionsWithCurrentMirrors,
  parseFullFinanceBackup,
  prepareRestoredBackupTransactions,
  resolveFullBackupOptionalState,
} from './utils/fullBackup';
import {
  calculateDailyReminders,
  DEFAULT_REMINDER_SETTINGS,
  dispatchEmailReminder,
  formatReminderNotificationMessage,
  getBrowserNotificationPermissionState,
  initializeBrowserNotificationPermissions,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
  shouldTriggerDailyNotification,
  shouldTriggerEmailNotification,
  summarizeReminders,
} from './utils/reminderRules';
import {
  stripLegacyMockRecords,
  sanitizeAndRepairFinancialState,
  runFinancialIntegrityAudit,
} from './utils/travelRules';

export type ActiveTab =
  | 'overview'
  | 'accounts'
  | 'investments'
  | 'transactions'
  | 'cards'
  | 'shared'
  | 'trips'
  | 'budgets'
  | 'goals'
  | 'reports'
  | 'cloud';

interface UndoHistoryEntry {
  label: string;
  timestamp: number;
  accounts: BankAccount[];
  cards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  goals: SavingsGoal[];
  familyMembers: FamilyMember[];
  investments: InvestmentAsset[];
  investmentTargets: InvestmentTargetMap;
  trips: Trip[];
}

const STORAGE_KEY = 'minhas_economias_br_state_v6';

function stripLegacyMockItems<T extends { id: string }>(items: T[]): T[] {
  return stripLegacyMockRecords(items);
}

function stripLegacyMockItemsFromWorkspace(
  workspace: Record<string, unknown>
): { payload: Record<string, unknown>; removedCount: number } {
  const payload = { ...workspace };
  let removedCount = 0;
  const fields = [
    'accountsJson',
    'cardsJson',
    'transactionsJson',
    'goalsJson',
    'familyMembersJson',
    'investmentsJson',
    'tripsJson',
  ];

  for (const field of fields) {
    const raw = payload[field];
    if (raw === undefined || raw === null) continue;
    const items = parseWorkspaceArray<Record<string, unknown>>(raw, [], field);

    const cleanItems = stripLegacyMockItems(items as Array<{ id: string }>);
    if (cleanItems.length === items.length) continue;

    removedCount += items.length - cleanItems.length;
    payload[field] = typeof raw === 'string' ? JSON.stringify(cleanItems) : cleanItems;
  }

  return { payload, removedCount };
}

function settingsUserNameFallback(email: string | null): string | null {
  if (!email) return null;
  const localPart = email.split('@')[0] || '';
  const firstToken = localPart.split(/[._-]/)[0] || localPart;
  if (!firstToken) return null;
  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1).toLowerCase();
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  density: 'comfortable',
  privacyMode: false,
  showOverviewAlerts: true,
  alertsExpandedByDefault: true,
  budgetWarningPercent: 80,
  userName: 'Você',
  userPixKey: '',
  defaultCascadeMode: 'this_and_future',
  autoConvertTripExpenses: true,
  viewClarityMode: 'complete',
  reminders: DEFAULT_REMINDER_SETTINGS,
};

/** Títulos curtos do cabeçalho em telas pequenas, para não empurrar os ícones para fora. */
const MOBILE_TAB_TITLES: Record<string, string> = {
  overview: 'Visão Geral',
  accounts: 'Contas',
  investments: 'Investimentos',
  transactions: 'Extrato',
  cards: 'Cartões',
  shared: 'Compartilhado',
  trips: 'Viagens',
  budgets: 'Orçamentos',
  goals: 'Metas',
  reports: 'Relatórios',
  cloud: 'Conta e Nuvem',
};

export default function App() {
  const [selectedMonth, setSelectedMonth] = useState<string>(DEFAULT_MONTH);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState<boolean>(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [requestedLedgerViewMode, setRequestedLedgerViewMode] = useState<
    'calendar' | 'table' | null
  >(null);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState<boolean>(false);
  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState<boolean>(false);
  const [reconciliationTargetAccountId, setReconciliationTargetAccountId] = useState<
    string | undefined
  >(undefined);
  const [browserPermissionState, setBrowserPermissionState] = useState<
    NotificationPermission | 'unsupported'
  >(() => getBrowserNotificationPermissionState());
  const [showNotificationInitPrompt, setShowNotificationInitPrompt] = useState<boolean>(
    () => {
      try {
        return localStorage.getItem('minhas_economias_os_notif_dismissed_v1') !== '1';
      } catch {
        return true;
      }
    }
  );
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    'appearance' | 'categories' | 'rules' | 'reminders' | 'profile'
  >('appearance');
  const globalSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  // Own Neon login supplies identity; Neon PostgreSQL stores the workspace.
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const scheduledEmailAttemptRef = useRef<{ date: string; at: number } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<
    'local' | 'syncing' | 'synced' | 'error'
  >('syncing');
  const [workspaceLoadState, setWorkspaceLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [workspaceLoadAttempt, setWorkspaceLoadAttempt] = useState(0);
  // Última versão salva neste aparelho, exibida na hora enquanto o Neon responde (somente leitura).
  const [isShowingCachedWorkspace, setIsShowingCachedWorkspace] = useState(false);
  const [workspaceConflict, setWorkspaceConflict] = useState<WorkspaceConflictState | null>(null);
  const [isWorkspaceConflictOpen, setIsWorkspaceConflictOpen] = useState(false);
  const [isResolvingWorkspaceConflict, setIsResolvingWorkspaceConflict] = useState(false);
  const [workspaceConflictError, setWorkspaceConflictError] = useState<string | null>(null);
  // Atualização automática do sistema espera enquanto salva na nuvem ou há conflito para resolver.
  useEffect(() => {
    setUpdateBlocker('cloud-sync', cloudSyncStatus === 'syncing' || workspaceConflict !== null);
    return () => setUpdateBlocker('cloud-sync', false);
  }, [cloudSyncStatus, workspaceConflict]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const isApplyingRemoteSnapshotRef = useRef<boolean>(false);
  const hasLoadedRemoteOnceRef = useRef<boolean>(false);
  const authenticatedUidRef = useRef<string | null>(null);
  const loadedWorkspaceUidRef = useRef<string | null>(null);
  const neonWorkspaceRevisionRef = useRef<number | null>(null);
  // Assinaturas do conteúdo que esta aba já enviou ou recebeu do Neon. Se o Neon recusar a revisão mas
  // estiver com um conteúdo que esta aba já conhece, a cópia local é só mais nova: grava por cima sem perguntar.
  const knownRemoteSignaturesRef = useRef<string[]>([]);
  const lastConfirmedSignatureRef = useRef<string | null>(null);
  const rememberRemoteSignature = (payload: Record<string, unknown>) => {
    const signature = workspaceContentSignature(payload);
    knownRemoteSignaturesRef.current = [
      ...knownRemoteSignaturesRef.current.filter((item) => item !== signature),
      signature,
    ].slice(-30);
  };
  const neonSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const workspaceConflictRef = useRef<WorkspaceConflictState | null>(null);
  const latestNeonPayloadRef = useRef<Record<string, unknown> | null>(null);
  const saveRetryTimerRef = useRef<number | null>(null);
  const saveRetryCountRef = useRef(0);
  const saveRetryPendingRef = useRef(false);
  const saveRetryUidRef = useRef<string | null>(null);
  const scheduleSaveRetryRef = useRef<(delayMs?: number) => void>(() => {});

  // Own Neon login supplies identity; the workspace and all financial data persist in Neon PostgreSQL.
  const [authSession, setAuthSession] = useState<{
    isLoggedIn: boolean;
    email: string;
    displayName: string;
  }>(() => {
    try {
      const raw = localStorage.getItem('minhas_economias_auth_session_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.isLoggedIn === 'boolean') {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return {
      isLoggedIn: false,
      email: '',
      displayName: '',
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        'minhas_economias_auth_session_v2',
        JSON.stringify(authSession)
      );
    } catch {
      // Ignore
    }
  }, [authSession]);

  const effectiveUserEmail = useMemo(() => {
    if (currentUser && !currentUser.isAnonymous && currentUser.email) {
      return currentUser.email.trim().toLowerCase();
    }
    return null;
  }, [currentUser, authSession]);

  const effectiveUserDisplayName = useMemo(() => {
    if (currentUser && !currentUser.isAnonymous && currentUser.displayName) {
      return currentUser.displayName;
    }
    if (settingsUserNameFallback(effectiveUserEmail)) {
      return settingsUserNameFallback(effectiveUserEmail);
    }
    return null;
  }, [currentUser, authSession, effectiveUserEmail]);

  const autoVaultId = useMemo(() => {
    return currentUser && !currentUser.isAnonymous
      ? getVaultIdForUid(currentUser.uid)
      : getOrCreateAutoCloudVaultId();
  }, [currentUser]);

  const isUserAuthenticated = Boolean(
    currentUser && !currentUser.isAnonymous && currentUser.email
  );
  const scopedStorageKey = useMemo(
    () => `${STORAGE_KEY}_${autoVaultId}`,
    [autoVaultId]
  );

  const isWorkspaceReadyForCurrentUser =
    workspaceLoadState === 'ready' &&
    isWorkspaceLoadedForUser(loadedWorkspaceUidRef.current, currentUser?.uid ?? null);

  const [accounts, setAccounts] = useState<BankAccount[]>(INITIAL_ACCOUNTS);
  const [cards, setCards] = useState<CreditCard[]>(INITIAL_CREDIT_CARDS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [goals, setGoals] = useState<SavingsGoal[]>(INITIAL_SAVINGS_GOALS);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(INITIAL_FAMILY_MEMBERS);
  const [investments, setInvestments] = useState<InvestmentAsset[]>(INITIAL_INVESTMENTS);
  const [investmentTargets, setInvestmentTargets] = useState<InvestmentTargetMap>(
    DEFAULT_INVESTMENT_TARGETS
  );
  const [trips, setTrips] = useState<Trip[]>(INITIAL_TRIPS);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Garante que cópias locais antigas não guardem senha SMTP.
  useEffect(() => {
    try {
      const cacheKeys = Array.from({ length: localStorage.length }, (_, index) =>
        localStorage.key(index)
      ).filter((key): key is string => Boolean(key?.startsWith(STORAGE_KEY)));
      for (const key of cacheKeys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const sanitized = sanitizeStoredWorkspaceSnapshot(raw);
        if (sanitized && sanitized !== raw) localStorage.setItem(key, sanitized);
      }
    } catch {
      // Sem armazenamento local: o app segue só com o Neon.
    }
  }, []);

  const resetFinancialStateToCleanZero = () => {
    isApplyingRemoteSnapshotRef.current = true;
    setAccounts(INITIAL_ACCOUNTS);
    setCards(INITIAL_CREDIT_CARDS);
    setCategories(INITIAL_CATEGORIES);
    setTransactions(INITIAL_TRANSACTIONS);
    setGoals(INITIAL_SAVINGS_GOALS);
    setFamilyMembers(INITIAL_FAMILY_MEMBERS);
    setInvestments(INITIAL_INVESTMENTS);
    setInvestmentTargets(DEFAULT_INVESTMENT_TARGETS);
    setTrips(INITIAL_TRIPS);
    setUndoStack([]);
  };

  // Modal & Universal Undo Stack state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [modalDefaultMode, setModalDefaultMode] = useState<
    'expense' | 'income' | 'credit_card' | 'transfer'
  >('expense');
  const [modalInitialTripId, setModalInitialTripId] = useState<string | undefined>(
    undefined
  );
  const [modalInitialDate, setModalInitialDate] = useState<string | undefined>(
    undefined
  );
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<UndoHistoryEntry[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerDataLoadingTransition = (duration = 200) => {
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    setIsLoadingData(true);
    loadingTimerRef.current = setTimeout(() => {
      setIsLoadingData(false);
      loadingTimerRef.current = null;
    }, duration);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setIsLoadingData(false);
    }, 240);
    return () => clearTimeout(t);
  }, []);

  const [initialSelectedAccountId, setInitialSelectedAccountId] = useState<
    string | undefined
  >(undefined);
  const [initialSelectedCardId, setInitialSelectedCardId] = useState<
    string | undefined
  >(undefined);

  const handleSelectMonth = (newMonth: string) => {
    if (newMonth === selectedMonth) return;
    triggerDataLoadingTransition(180);
    setSelectedMonth(newMonth);
  };

  const handleSelectTab = (tab: ActiveTab) => {
    setInitialSelectedAccountId(undefined);
    setInitialSelectedCardId(undefined);
    if (tab === activeTab) return;
    triggerDataLoadingTransition(150);
    setActiveTab(tab);
  };

  // Cadastro pedido pelo formulário de lançamento (falta conta ou cartão): fecha o formulário e abre a tela certa já no cadastro.
  const [pendingCreateRequest, setPendingCreateRequest] = useState<'account' | 'card' | 'international_account' | null>(null);
  const handleRequestCreateFromTransaction = (kind: 'account' | 'card' | 'international_account') => {
    setIsModalOpen(false);
    setEditingTransaction(null);
    setModalInitialTripId(undefined);
    setModalInitialDate(undefined);
    setPendingCreateRequest(kind);
    setInitialSelectedAccountId(undefined);
    setInitialSelectedCardId(undefined);
    triggerDataLoadingTransition(120);
    setActiveTab(kind === 'card' ? 'cards' : 'accounts');
  };

  const handleNavigateToAccount = (accountId: string) => {
    setInitialSelectedAccountId(accountId);
    triggerDataLoadingTransition(120);
    setActiveTab('accounts');
  };

  const handleNavigateToCard = (cardId: string) => {
    setInitialSelectedCardId(cardId);
    triggerDataLoadingTransition(120);
    setActiveTab('cards');
  };

  const showNotice = (
    msg: string,
    withUndoSnapshot?: Transaction[],
    skipUndoRecording = false
  ) => {
    setToastMessage(msg);
    if (!skipUndoRecording) {
      const entry: UndoHistoryEntry = {
        label: msg,
        timestamp: Date.now(),
        accounts: [...accounts],
        cards: [...cards],
        categories: [...categories],
        transactions: withUndoSnapshot ? [...withUndoSnapshot] : [...transactions],
        goals: [...goals],
        familyMembers: [...familyMembers],
        investments: [...investments],
        investmentTargets: { ...investmentTargets },
        trips: [...trips],
      };
      setUndoStack((prev) => [entry, ...prev.slice(0, 29)]);
    }
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 6500);
  };

  const handleUndoLastTransactionChange = () => {
    if (undoStack.length === 0) return;
    const [latest, ...rest] = undoStack;
    setAccounts(latest.accounts);
    setCards(latest.cards);
    setCategories(latest.categories);
    setTransactions(latest.transactions);
    setGoals(latest.goals);
    setFamilyMembers(latest.familyMembers);
    setInvestments(latest.investments);
    setInvestmentTargets(latest.investmentTargets);
    setTrips(latest.trips);
    setUndoStack(rest);
    setToastMessage(
      `Ação desfeita com sucesso! Estado anterior restaurado (${latest.label.slice(0, 65)}).`
    );
  };

  // Auth session listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const previousUid = authenticatedUidRef.current;
      const nextUid = user && !user.isAnonymous && user.email ? user.uid : null;
      if (shouldResetWorkspaceForAuthChange(previousUid, nextUid)) {
        if (previousUid) {
          clearWorkspaceCacheForVault(localStorage, STORAGE_KEY, getVaultIdForUid(previousUid));
        }
        resetFinancialStateToCleanZero();
        setSettings(DEFAULT_SETTINGS);
        hasLoadedRemoteOnceRef.current = false;
        loadedWorkspaceUidRef.current = null;
        setWorkspaceLoadState(nextUid ? 'loading' : 'error');
        setIsShowingCachedWorkspace(false);
        setCloudSyncStatus(nextUid ? 'syncing' : 'local');
        setIsResolvingWorkspaceConflict(false);
      }
      authenticatedUidRef.current = nextUid;
      setCurrentUser(user);
      setIsAuthReady(true);
      neonWorkspaceRevisionRef.current = null;
      hasLoadedRemoteOnceRef.current = false;
      workspaceConflictRef.current = null;
      setWorkspaceConflict(null);
      setIsWorkspaceConflictOpen(false);
      setWorkspaceConflictError(null);
      setAuthSession(
        user && !user.isAnonymous && user.email
          ? {
              isLoggedIn: true,
              email: user.email.trim().toLowerCase(),
              displayName: user.displayName || settingsUserNameFallback(user.email) || user.email,
            }
          : { isLoggedIn: false, email: '', displayName: '' }
      );
    });
    return () => unsubscribe();
  }, []);

  // Build the authenticated workspace payload persisted by the Neon API.
  const buildCloudPayload = (targetId: string) => ({
    uid: targetId,
    ...(effectiveUserEmail ? { email: effectiveUserEmail } : {}),
    ...(effectiveUserDisplayName ? { displayName: effectiveUserDisplayName } : {}),
    updatedAt: new Date().toISOString(),
    accountsJson: JSON.stringify(accounts),
    cardsJson: JSON.stringify(cards),
    categoriesJson: JSON.stringify(categories),
    transactionsJson: JSON.stringify(
      compactTransactionListForStorage(
        transactions.filter((transaction) => !transaction.id.startsWith('tx-mirror-'))
      )
    ),
    sharedSettlementReceiptsJson: JSON.stringify(collectSharedSettlementReceipts(transactions)),
    goalsJson: JSON.stringify(goals),
    familyMembersJson: JSON.stringify(familyMembers),
    investmentsJson: JSON.stringify(investments),
    investmentTargetsJson: JSON.stringify(investmentTargets),
    tripsJson: JSON.stringify(trips),
    settingsJson: serializeSettingsWithoutSmtpSecrets(settings),
  });

  const queueNeonWorkspaceSave = (payload: Record<string, unknown>) => {
    const authenticatedUser = currentUser;
    if (!authenticatedUser?.email) {
      return Promise.reject(new Error('Entre na sua conta para sincronizar com o Neon.'));
    }

    const queuedSave = neonSaveQueueRef.current.then(async () => {
      if (currentUser?.uid !== authenticatedUser.uid) {
        throw new Error('A conta ativa mudou antes de salvar o workspace.');
      }
      if (workspaceConflictRef.current) {
        throw new NeonWorkspaceError(
          'Resolva o conflito entre esta aba e o Neon antes de sincronizar novamente.',
          409
        );
      }

      let revision = neonWorkspaceRevisionRef.current;
      if (revision === null) {
        try {
          const existing = await loadNeonWorkspace();
          if (authenticatedUidRef.current !== authenticatedUser.uid) {
            throw new Error('A conta ativa mudou durante a leitura do workspace.');
          }
          revision = existing.revision;
          neonWorkspaceRevisionRef.current = revision;
        } catch (error) {
          if (!(error instanceof NeonWorkspaceError) || error.status !== 404) {
            throw error;
          }
          try {
            const created = await createNeonWorkspace(payload);
            if (authenticatedUidRef.current !== authenticatedUser.uid) {
              throw new Error('A conta ativa mudou durante a criação do workspace.');
            }
            neonWorkspaceRevisionRef.current = created.revision;
            lastConfirmedSignatureRef.current = workspaceContentSignature(payload);
            return;
          } catch (importError) {
            if (
              !(importError instanceof NeonWorkspaceError) ||
              importError.status !== 409
            ) {
              throw importError;
            }
            const existing = await loadNeonWorkspace();
            if (authenticatedUidRef.current !== authenticatedUser.uid) {
              throw new Error('A conta ativa mudou durante a leitura do workspace.');
            }
            // O que chegou primeiro ao Neon prevalece: adota a versão da nuvem sem perguntar.
            neonWorkspaceRevisionRef.current = existing.revision;
            try { localStorage.removeItem(scopedStorageKey); } catch { /* sem armazenamento local */ }
            setWorkspaceLoadAttempt((attempt) => attempt + 1);
            throw new NeonWorkspaceError(
              'O workspace Neon foi criado em outra aba durante a inicialização.',
              409
            );
          }
        }
      }

      try {
        rememberRemoteSignature(payload);
        const saved = await saveNeonWorkspace(payload, revision);
        if (authenticatedUidRef.current !== authenticatedUser.uid) {
          throw new Error('A conta ativa mudou durante a gravação do workspace.');
        }
        neonWorkspaceRevisionRef.current = saved.revision;
        lastConfirmedSignatureRef.current = workspaceContentSignature(payload);
      } catch (error) {
        if (error instanceof NeonWorkspaceError && error.status === 409) {
          try {
            const remoteSnapshot = await loadNeonWorkspace();
            if (authenticatedUidRef.current !== authenticatedUser.uid) throw error;
            if (knownRemoteSignaturesRef.current.includes(workspaceContentSignature(remoteSnapshot.payload))) {
              // O Neon tem um conteúdo que esta aba já conhecia (ex.: resposta de um salvamento anterior se perdeu).
              const resaved = await saveNeonWorkspace(payload, remoteSnapshot.revision);
              if (authenticatedUidRef.current !== authenticatedUser.uid) throw error;
              neonWorkspaceRevisionRef.current = resaved.revision;
              lastConfirmedSignatureRef.current = workspaceContentSignature(payload);
              return;
            }
            // Como em um app em tempo real: o que chegou primeiro ao Neon prevalece. Esta aba adota a versão
            // da nuvem; a cópia descartada fica guardada neste aparelho para recuperação.
            try {
              localStorage.setItem(
                `minhas-economias:descartado:${authenticatedUser.uid}`,
                JSON.stringify({ at: new Date().toISOString(), payload })
              );
              localStorage.removeItem(scopedStorageKey);
            } catch {
              // Sem armazenamento local: segue só com a versão da nuvem.
            }
            neonWorkspaceRevisionRef.current = remoteSnapshot.revision;
            setWorkspaceLoadAttempt((attempt) => attempt + 1);
            return;
          } catch (refreshError) {
            if (authenticatedUidRef.current !== authenticatedUser.uid) throw error;
            console.error(
              'Não foi possível carregar a versão atual do Neon para resolver o conflito.',
              refreshError instanceof Error ? refreshError.message : String(refreshError)
            );
            setWorkspaceConflictError(
              'O Neon recusou a revisão, mas não foi possível carregar a versão mais recente. Suas alterações locais foram mantidas; tente sincronizar novamente quando a conexão voltar.'
            );

          }
          if (authenticatedUidRef.current !== authenticatedUser.uid) throw error;
          setCloudSyncStatus('error');
        }
        throw error;
      }
    });

    neonSaveQueueRef.current = queuedSave.then(
      () => undefined,
      () => undefined
    );
    return queuedSave;
  };

  const cancelSaveRetry = (resetAttempts = false) => {
    if (saveRetryTimerRef.current !== null) {
      window.clearTimeout(saveRetryTimerRef.current);
      saveRetryTimerRef.current = null;
    }
    saveRetryPendingRef.current = false;
    saveRetryUidRef.current = null;
    if (resetAttempts) saveRetryCountRef.current = 0;
  };

  const persistNeonWorkspacePayload = async (
    payload: Record<string, unknown>,
    showResultNotice = false
  ) => {
    latestNeonPayloadRef.current = payload;
    // Nada mudou desde a última versão confirmada no Neon (ex.: acabou de carregar a versão de outro aparelho):
    // não grava de novo, senão dois aparelhos ficariam trocando revisões sem fim.
    if (
      !showResultNotice &&
      lastConfirmedSignatureRef.current !== null &&
      neonWorkspaceRevisionRef.current !== null &&
      lastConfirmedSignatureRef.current === workspaceContentSignature(payload)
    ) {
      setCloudSyncStatus('synced');
      return;
    }
    const activeConflict = workspaceConflictRef.current;
    if (activeConflict) {
      const updatedConflict = updateWorkspaceConflictLocalPayload(activeConflict, payload);
      workspaceConflictRef.current = updatedConflict;
      setWorkspaceConflict(updatedConflict);
    }
    const authenticatedUid = currentUser?.uid;
    setCloudSyncStatus('syncing');
    try {
      await queueNeonWorkspaceSave(payload);
      if (authenticatedUidRef.current !== authenticatedUid) return;
      cancelSaveRetry(true);
      setCloudSyncStatus('synced');
      setLastSyncedAt(
        typeof payload.updatedAt === 'string' ? payload.updatedAt : new Date().toISOString()
      );
      if (showResultNotice) {
        showNotice('Sincronização em nuvem concluída agora!', undefined, true);
      }
    } catch (error) {
      if (authenticatedUidRef.current !== authenticatedUid) return;
      setCloudSyncStatus('error');
      console.error(
        'Falha ao salvar workspace no Neon; alterações locais foram mantidas.',
        error instanceof Error ? error.message : String(error)
      );

      const canRetry =
        isRetryableWorkspaceSaveError(error) &&
        authenticatedUid &&
        !workspaceConflictRef.current;
      if (canRetry) {
        saveRetryPendingRef.current = true;
        saveRetryUidRef.current = authenticatedUid;
        if (saveRetryCountRef.current < 8) {
          const attempt = saveRetryCountRef.current++;
          const delayMs = Math.min(1000 * 2 ** attempt, 30_000);
          scheduleSaveRetryRef.current(delayMs);
        }
      } else {
        cancelSaveRetry();
      }

      if (showResultNotice) {
        showNotice(
          'Não foi possível concluir a sincronização. Seus dados locais foram preservados; tente novamente.',
          undefined,
          true
        );
      }
    }
  };

  scheduleSaveRetryRef.current = (delayMs = 0) => {
    if (saveRetryTimerRef.current !== null) {
      window.clearTimeout(saveRetryTimerRef.current);
    }
    saveRetryTimerRef.current = window.setTimeout(() => {
      saveRetryTimerRef.current = null;
      const latestPayload = latestNeonPayloadRef.current;
      const currentUid = currentUser?.uid;
      if (
        !saveRetryPendingRef.current ||
        !navigator.onLine ||
        !latestPayload ||
        !hasLoadedRemoteOnceRef.current ||
        workspaceConflictRef.current ||
        !currentUid ||
        currentUid !== saveRetryUidRef.current
      ) {
        return;
      }
      saveRetryPendingRef.current = false;
      void persistNeonWorkspacePayload(latestPayload);
    }, delayMs);
  };

  const handleKeepLocalWorkspaceVersion = async () => {
    const conflict = workspaceConflictRef.current;
    const ownerUid = authenticatedUidRef.current;
    if (!conflict || !ownerUid || isResolvingWorkspaceConflict) return;

    setIsResolvingWorkspaceConflict(true);
    setWorkspaceConflictError(null);
    setCloudSyncStatus('syncing');
    const save = neonSaveQueueRef.current.then(async () => {
      if (authenticatedUidRef.current !== ownerUid) {
        throw new Error('A conta ativa mudou durante a resolução do conflito.');
      }
      const latestConflict = workspaceConflictRef.current;
      if (!latestConflict) return null;
      const saved = await saveNeonWorkspace(
        latestConflict.localPayload,
        latestConflict.remoteSnapshot.revision
      );
      if (authenticatedUidRef.current !== ownerUid) {
        throw new Error('A conta ativa mudou durante a gravação do conflito.');
      }
      neonWorkspaceRevisionRef.current = saved.revision;
      return latestConflict;
    });
    neonSaveQueueRef.current = save.then(
      () => undefined,
      () => undefined
    );

    try {
      const resolvedConflict = await save;
      if (authenticatedUidRef.current !== ownerUid) return;
      if (!resolvedConflict) return;

      setCloudSyncStatus('synced');
      setLastSyncedAt(
        typeof resolvedConflict.localPayload.updatedAt === 'string'
          ? resolvedConflict.localPayload.updatedAt
          : new Date().toISOString()
      );
      workspaceConflictRef.current = null;
      setWorkspaceConflict(null);
      setIsWorkspaceConflictOpen(false);
    } catch (error) {
      if (authenticatedUidRef.current !== ownerUid) return;
      if (error instanceof NeonWorkspaceError && error.status === 409) {
        try {
          const latest = await loadNeonWorkspace();
          if (authenticatedUidRef.current !== ownerUid) return;
          const updatedConflict = {
            ...conflict,
            remoteSnapshot: latest,
          };
          workspaceConflictRef.current = updatedConflict;
          setWorkspaceConflict(updatedConflict);
          setWorkspaceConflictError(
            'O Neon mudou novamente antes de salvar. Baixe uma nova cópia das duas versões e escolha novamente.'
          );
        } catch {
          if (authenticatedUidRef.current !== ownerUid) return;
          setWorkspaceConflictError(
            'O Neon mudou novamente e a versão mais recente não pôde ser carregada. Suas duas versões continuam preservadas; verifique a conexão e tente outra vez.'
          );
        }
      } else {
        setWorkspaceConflictError(
          error instanceof Error
            ? error.message
            : 'Não foi possível salvar sua versão. As alterações locais foram mantidas.'
        );
      }
      setCloudSyncStatus('error');
    } finally {
      if (authenticatedUidRef.current === ownerUid) setIsResolvingWorkspaceConflict(false);
    }
  };

  const handleUseCloudWorkspaceVersion = () => {
    if (!workspaceConflictRef.current || isResolvingWorkspaceConflict) return;
    workspaceConflictRef.current = null;
    setWorkspaceConflict(null);
    setIsWorkspaceConflictOpen(false);
    setCloudSyncStatus('syncing');
    window.location.reload();
  };

  // Neon is the sole financial data store; the own Neon login supplies identity only.
  useEffect(() => {
    if (!isAuthReady || !isUserAuthenticated || !effectiveUserEmail) return;

    const loadUid = currentUser?.uid;
    if (!loadUid) return;

    hasLoadedRemoteOnceRef.current = false;
    loadedWorkspaceUidRef.current = null;
    isApplyingRemoteSnapshotRef.current = true;
    setWorkspaceLoadState('loading');

    // Abre na hora com a última versão salva neste aparelho; o Neon a substitui em silêncio.
    try {
      const cached = parseCachedWorkspace(localStorage.getItem(scopedStorageKey));
      if (cached) {
        setAccounts(cached.accounts);
        setCards(cached.cards);
        setCategories(stripLegacySubcategories(cached.categories));
        setTransactions(stripLegacyTransactionSubcategory(cached.transactions));
        setGoals(cached.goals);
        setFamilyMembers(cached.familyMembers);
        setInvestments(cached.investments);
        setTrips(cached.trips);
        if (cached.investmentTargets) {
          setInvestmentTargets(cached.investmentTargets as InvestmentTargetMap);
        }
        setSettings(parsePersistedSettings(JSON.stringify(cached.settings), DEFAULT_SETTINGS));
        setIsShowingCachedWorkspace(true);
      }
    } catch {
      // Cópia local inválida ou indisponível: segue só com o Neon.
    }

    setCloudSyncStatus('syncing');

    let active = true;
    // Convites e compartilhados não dependem do workspace: busca tudo ao mesmo tempo.
    const extraLoads = Promise.all([
      loadNeonFamilyInvitations().catch(() => []),
      loadNeonSharedSnapshot(),
    ]);
    extraLoads.catch(() => undefined);
    const initialNeonLoad = (async () => {
      try {
        return await loadNeonWorkspace();
      } catch (error) {
        if (!(error instanceof NeonWorkspaceError) || error.status !== 404) {
          throw error;
        }

        if (!active || authenticatedUidRef.current !== loadUid) {
          throw new Error('A conta ativa mudou antes de inicializar o workspace.');
        }

        try {
          await createNeonWorkspace(buildCloudPayload(autoVaultId));
        } catch (createError) {
          if (
            !(createError instanceof NeonWorkspaceError) ||
            createError.status !== 409
          ) {
            throw createError;
          }
        }
        if (!active || authenticatedUidRef.current !== loadUid) {
          throw new Error('A conta ativa mudou durante a inicialização do workspace.');
        }
        return loadNeonWorkspace();
      }
    })();

    void initialNeonLoad
      .then(async (snapshot) => {
        if (!active || authenticatedUidRef.current !== loadUid) return;
        const cleaned = stripLegacyMockItemsFromWorkspace(snapshot.payload);
        const data = cleaned.payload;
        const [familyInvitations, sharedSnapshot] = await extraLoads;
        if (!active || authenticatedUidRef.current !== loadUid) return;

        neonWorkspaceRevisionRef.current = snapshot.revision;
        rememberRemoteSignature(snapshot.payload);
        lastConfirmedSignatureRef.current = workspaceContentSignature(snapshot.payload);
        const rawAccounts = parseWorkspaceArray<BankAccount>(data.accountsJson, INITIAL_ACCOUNTS, 'accountsJson');
        const rawCards = parseWorkspaceArray<CreditCard>(data.cardsJson, INITIAL_CREDIT_CARDS, 'cardsJson');
        const parsedCategories = parseWorkspaceArray<Category>(data.categoriesJson, INITIAL_CATEGORIES, 'categoriesJson');
        const nextCategories = parsedCategories.length > 0
          ? [...parsedCategories]
          : [...INITIAL_CATEGORIES];
        for (const coreCategory of INITIAL_CATEGORIES) {
          if (
            (coreCategory.id === 'cat-outros' || coreCategory.id === 'cat-aportes' || coreCategory.id === 'cat-fatura') &&
            !nextCategories.some((category) => category.id === coreCategory.id)
          ) {
            nextCategories.push(coreCategory);
          }
        }

        const rawTransactions = parseWorkspaceArray<Transaction>(data.transactionsJson, INITIAL_TRANSACTIONS, 'transactionsJson');
        const sharedById = new Map<string, Transaction>();
        for (const sharedPayload of sharedSnapshot.transactions) {
          const sharedTransaction = sharedPayload as unknown as Transaction;
          const sharedId = sharedTransaction.sharedSyncId ||
            sharedTransaction.id?.replace(/^tx-mirror-/, '');
          if (sharedId) sharedById.set(sharedId, sharedTransaction);
        }
        const localTransactions = stripLegacyMockItems(rawTransactions)
          .filter((transaction) => !transaction.id.startsWith('tx-mirror-'));

        const familyMembers = stripLegacyMockItems(
          parseWorkspaceArray<FamilyMember>(data.familyMembersJson, INITIAL_FAMILY_MEMBERS, 'familyMembersJson')
        );
        for (const invitation of familyInvitations) {
          const ownerEmail = invitation.owner_email.trim().toLowerCase();
          const invitedEmail = invitation.invited_email.trim().toLowerCase();
          const incoming = invitedEmail === effectiveUserEmail;
          const memberId = incoming
            ? `fam-inv-${ownerEmail.replace(/[^a-z0-9]/g, '_')}`
            : invitation.owner_member_id;
          const index = familyMembers.findIndex((member) =>
            incoming
              ? member.id === memberId ||
                (member.direction === 'incoming' && member.email?.trim().toLowerCase() === ownerEmail)
              : member.id === memberId ||
                (member.direction !== 'incoming' && member.email?.trim().toLowerCase() === invitedEmail)
          );
          if (invitation.status === 'declined' || invitation.status === 'revoked') {
            if (!incoming) {
              const ownerMember = familyMembers.find(
                (member) => member.email?.trim().toLowerCase() === invitedEmail
              );
              if (ownerMember) {
                ownerMember.inviteStatus = 'none';
                ownerMember.invitationId = invitation.invitation_id;
              }
            }
            continue;
          }
          const member: FamilyMember = incoming
            ? {
                id: memberId,
                name: invitation.owner_name || ownerEmail.split('@')[0],
                relationship: (invitation.relationship as FamilyMember['relationship']) || 'outro',
                color: invitation.color || '#6366f1',
                email: ownerEmail,
                inviteStatus: invitation.status === 'accepted' ? 'accepted' : 'invited',
                invitedByEmail: ownerEmail,
                invitedByName: invitation.owner_name,
                direction: 'incoming',
                pixKey: invitation.owner_pix_key || undefined,
                invitationId: invitation.invitation_id,
              }
            : {
                id: memberId,
                name: invitation.owner_name || invitedEmail.split('@')[0],
                relationship: (invitation.relationship as FamilyMember['relationship']) || 'outro',
                color: invitation.color || '#6366f1',
                email: invitedEmail,
                inviteStatus: invitation.status === 'accepted' ? 'accepted' : 'invited',
                direction: 'outgoing',
                invitationId: invitation.invitation_id,
              };
          if (index >= 0) {
            familyMembers[index] = {
              ...familyMembers[index],
              ...member,
              name: familyMembers[index].name || member.name,
            };
          }
          else familyMembers.push(member);
        }

        setAccounts(stripLegacyMockItems(rawAccounts));
        setCards(stripLegacyMockItems(rawCards));
        const loadedSettings = parsePersistedSettings(data.settingsJson, DEFAULT_SETTINGS);
        const catalog = mergeCategoryCatalog(nextCategories, loadedSettings.categoryCatalogVersion);
        setCategories(catalog.categories);
        setTransactions(stripLegacyTransactionSubcategory([...applyRemoteSettlementReports(localTransactions, sharedSnapshot.outgoingSettlements),
          ...restoreSharedSettlementReceipts([...sharedById.values()], data.sharedSettlementReceiptsJson, localTransactions)]));
        setGoals(stripLegacyMockItems(parseWorkspaceArray<SavingsGoal>(data.goalsJson, INITIAL_SAVINGS_GOALS, 'goalsJson')));
        setFamilyMembers(familyMembers);
        setInvestments(stripLegacyMockItems(parseWorkspaceArray<InvestmentAsset>(data.investmentsJson, INITIAL_INVESTMENTS, 'investmentsJson')));
        setTrips(stripLegacyMockItems(parseWorkspaceArray<Trip>(data.tripsJson, INITIAL_TRIPS, 'tripsJson')));
        setInvestmentTargets(parseWorkspaceObject(data.investmentTargetsJson, DEFAULT_INVESTMENT_TARGETS, 'investmentTargetsJson'));
        setSettings({ ...loadedSettings, categoryCatalogVersion: catalog.version });
        hasLoadedRemoteOnceRef.current = true;
        loadedWorkspaceUidRef.current = loadUid;
        isApplyingRemoteSnapshotRef.current = false;
        setIsShowingCachedWorkspace(false);
        setWorkspaceLoadState('ready');
        setCloudSyncStatus('synced');
        setLastSyncedAt(
          typeof data.updatedAt === 'string'
            ? data.updatedAt
            : new Date().toISOString()
        );
      })
      .catch((error) => {
        if (!active || authenticatedUidRef.current !== loadUid) return;
        isApplyingRemoteSnapshotRef.current = false;
        setWorkspaceLoadState('error');
        setCloudSyncStatus('error');
        console.error(
          'Falha ao carregar o workspace principal do Neon.',
          error instanceof Error ? error.message : String(error)
        );
        showNotice(
          'Não foi possível carregar os dados do Neon. Seus dados remotos foram preservados; confira a conexão e o status da nuvem antes de continuar.',
          undefined,
          true
        );
      });
    return () => {
      active = false;
    };
  }, [isAuthReady, isUserAuthenticated, effectiveUserEmail, currentUser?.uid, autoVaultId, workspaceLoadAttempt]);

  useEffect(() => {
    if (workspaceLoadState !== 'error') return;
    const retryWhenOnline = () => setWorkspaceLoadAttempt((attempt) => attempt + 1);
    window.addEventListener('online', retryWhenOnline);
    return () => window.removeEventListener('online', retryWhenOnline);
  }, [workspaceLoadState]);

  useEffect(() => {
    cancelSaveRetry(true);
    latestNeonPayloadRef.current = null;
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!isAuthReady || !isUserAuthenticated) return;
    const retryAfterReconnect = () => {
      if (saveRetryPendingRef.current && !workspaceConflictRef.current) {
        scheduleSaveRetryRef.current(0);
      }
    };
    window.addEventListener('online', retryAfterReconnect);
    return () => window.removeEventListener('online', retryAfterReconnect);
  }, [isAuthReady, isUserAuthenticated]);

  // Tempo real: a cada poucos segundos (e ao voltar ao app) confere a revisão no Neon e, se outro aparelho
  // gravou, recarrega os dados no lugar, sem recarregar a página. Também reenvia o que ficou sem salvar.
  const cloudSyncStatusRef = useRef(cloudSyncStatus);
  cloudSyncStatusRef.current = cloudSyncStatus;
  useEffect(() => {
    if (!isAuthReady || !isUserAuthenticated) return;
    let checking = false;
    const check = async () => {
      if (document.hidden || checking || !navigator.onLine || !hasLoadedRemoteOnceRef.current) return;
      if (workspaceConflictRef.current) return;
      checking = true;
      const uid = authenticatedUidRef.current;
      try {
        if (cloudSyncStatusRef.current === 'error' && latestNeonPayloadRef.current) {
          void persistNeonWorkspacePayload(latestNeonPayloadRef.current);
          return;
        }
        if (cloudSyncStatusRef.current !== 'synced') return;
        await neonSaveQueueRef.current;
        if (cloudSyncStatusRef.current !== 'synced' || saveRetryPendingRef.current) return;
        const remoteRevision = await loadNeonWorkspaceRevision();
        if (authenticatedUidRef.current !== uid || workspaceConflictRef.current) return;
        const known = neonWorkspaceRevisionRef.current;
        if (remoteRevision === null || known === null || remoteRevision <= known) return;
        if (cloudSyncStatusRef.current !== 'synced' || saveRetryPendingRef.current) return;
        setWorkspaceLoadAttempt((attempt) => attempt + 1);
      } catch {
        // Sem rede ou sessão expirada: tenta de novo no próximo ciclo.
      } finally {
        checking = false;
      }
    };
    const onVisible = () => void check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const poll = window.setInterval(onVisible, 4_000);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [isAuthReady, isUserAuthenticated]);

  // Poll Neon for family invitations and incoming shared expenses while the app is open.
  useEffect(() => {
    if (!isAuthReady || !isUserAuthenticated || !effectiveUserEmail) return;
    let active = true;
    const refreshFamilyData = async () => {
      if (!hasLoadedRemoteOnceRef.current || !navigator.onLine) return;
      try {
        const [invitations, sharedSnapshot] = await Promise.all([
          loadNeonFamilyInvitations(),
          loadNeonSharedSnapshot(),
        ]);
        if (!active) return;
        setFamilyMembers((previous) => {
          const next = [...previous];
          for (const invitation of invitations) {
            const ownerEmail = invitation.owner_email.trim().toLowerCase();
            const invitedEmail = invitation.invited_email.trim().toLowerCase();
            const incoming = invitedEmail === effectiveUserEmail;
            const memberId = incoming
              ? `fam-inv-${ownerEmail.replace(/[^a-z0-9]/g, '_')}`
              : invitation.owner_member_id;
            const declined = invitation.status === 'declined' || invitation.status === 'revoked';
            const index = next.findIndex((member) =>
              incoming
                ? member.direction === 'incoming' &&
                  (member.id === memberId || member.email?.trim().toLowerCase() === ownerEmail)
                : member.direction !== 'incoming' &&
                  (member.id === memberId || member.email?.trim().toLowerCase() === invitedEmail)
            );
            if (declined) {
              if (incoming && index >= 0) next.splice(index, 1);
              else if (index >= 0) next[index] = { ...next[index], inviteStatus: 'none' };
              continue;
            }
            const member: FamilyMember = incoming
              ? {
                  id: memberId,
                  name: invitation.owner_name || ownerEmail.split('@')[0],
                  relationship: (invitation.relationship as FamilyMember['relationship']) || 'outro',
                  color: invitation.color || '#6366f1',
                  email: ownerEmail,
                  inviteStatus: invitation.status === 'accepted' ? 'accepted' : 'invited',
                  invitedByEmail: ownerEmail,
                  invitedByName: invitation.owner_name,
                  direction: 'incoming',
                  pixKey: invitation.owner_pix_key || undefined,
                  invitationId: invitation.invitation_id,
                }
              : {
                  id: memberId,
                  name: invitation.invited_email.split('@')[0],
                  relationship: (invitation.relationship as FamilyMember['relationship']) || 'outro',
                  color: invitation.color || '#6366f1',
                  email: invitedEmail,
                  inviteStatus: invitation.status === 'accepted' ? 'accepted' : 'invited',
                  direction: 'outgoing',
                  invitationId: invitation.invitation_id,
                };
            if (index >= 0) {
              next[index] = { ...next[index], ...member, name: next[index].name || member.name };
            } else {
              next.push(member);
            }
          }
          return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
        });
        setTransactions((previous) => {
          const next = replaceIncomingSharedTransactions(applyRemoteSettlementReports(previous, sharedSnapshot.outgoingSettlements), sharedSnapshot.transactions as unknown as Transaction[]);
          return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
        });
      } catch (error) {
        if (active) {
          console.warn(
            'A atualização periódica dos dados familiares falhou.',
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    };
    const timer = window.setInterval(() => void refreshFamilyData(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isAuthReady, isUserAuthenticated, effectiveUserEmail]);

  // Guarda a última versão neste aparelho (só depois de ler o Neon) e persiste o workspace no Neon.
  useEffect(() => {
    if (!effectiveUserEmail) return;
    if (hasLoadedRemoteOnceRef.current) {
      try {
        localStorage.setItem(
          scopedStorageKey,
          JSON.stringify({
            accounts,
            cards,
            categories,
            transactions,
            goals,
            familyMembers,
            investments,
            investmentTargets,
            trips,
            settings: removeSmtpPasswordsFromSettings(settings),
          })
        );
      } catch {
        // Sem espaço ou sem armazenamento local: o Neon continua sendo a fonte.
      }
    }

    if (
      isAuthReady &&
      hasLoadedRemoteOnceRef.current &&
      !isApplyingRemoteSnapshotRef.current
    ) {
      const docId = autoVaultId;
      cancelSaveRetry(true);
      const timer = setTimeout(() => {
        const payload = buildCloudPayload(docId);
        void persistNeonWorkspacePayload(payload);
      }, 420);
      return () => clearTimeout(timer);
    }
  }, [
    isAuthReady,
    effectiveUserEmail,
    autoVaultId,
    scopedStorageKey,
    accounts,
    cards,
    categories,
    transactions,
    goals,
    familyMembers,
    investments,
    investmentTargets,
    trips,
    settings,
  ]);

  const handleForceCloudSync = async () => {
    const docId = autoVaultId;
    await persistNeonWorkspacePayload(buildCloudPayload(docId), true);
  };

  const completeSignIn = (user: Awaited<ReturnType<typeof signInWithEmail>>, cleanEmail: string) => {
    if (cleanEmail !== effectiveUserEmail) {
      resetFinancialStateToCleanZero();
      hasLoadedRemoteOnceRef.current = false;
    }
    const displayName = user.displayName || settingsUserNameFallback(cleanEmail) || cleanEmail.split('@')[0];
    setSettings((prev) => ({ ...prev, userName: displayName }));
    setAuthSession({
      isLoggedIn: true,
      email: cleanEmail,
      displayName,
    });
    showNotice(
      `Bem-vindo de volta, ${displayName}!`,
      undefined,
      true
    );
  };

  const handleSignInEmail = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const user = await signInWithEmail(cleanEmail, pass);
    completeSignIn(user, cleanEmail);
  };

  const handleSignInPasskey = async () => {
    const user = await signInWithPasskey();
    completeSignIn(user, user.email.trim().toLowerCase());
  };

  const handleRegisterEmail = async (name: string, email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || settingsUserNameFallback(cleanEmail) || cleanEmail.split('@')[0];
    await registerWithEmail(cleanName, cleanEmail, pass);
    resetFinancialStateToCleanZero();
    hasLoadedRemoteOnceRef.current = false;
    setSettings((prev) => ({ ...prev, userName: cleanName }));
    setAuthSession({
      isLoggedIn: true,
      email: cleanEmail,
      displayName: cleanName,
    });
    showNotice(`Conta criada para ${cleanEmail}.`, undefined, true);
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch {
      // Ignore
    }
    hasLoadedRemoteOnceRef.current = false;
    loadedWorkspaceUidRef.current = null;
    resetFinancialStateToCleanZero();
    setSettings(DEFAULT_SETTINGS);
    setAuthSession({
      isLoggedIn: false,
      email: '',
      displayName: '',
    });
    showNotice(
      'Você saiu da sua conta. Faça login novamente quando desejar.',
      undefined,
      true
    );
  };

  const handleUpdateSettings = (partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  // Derived financial calculations (Single Source of Truth)
  const accountBalances = useMemo(
    () => calculateAccountBalances(accounts, transactions, selectedMonth),
    [accounts, transactions, selectedMonth]
  );

  const cardSummaries = useMemo(
    () =>
      cards.map((card) =>
        calculateCreditCardSummary(card, transactions, selectedMonth)
      ),
    [cards, transactions, selectedMonth]
  );

  const monthlySummary = useMemo(
    () => calculateMonthlySummary(accounts, cards, transactions, selectedMonth),
    [accounts, cards, transactions, selectedMonth]
  );

  const categoryBreakdown = useMemo(
    () =>
      calculateCategoryBreakdown(
        categories,
        transactions,
        selectedMonth,
        settings.budgetWarningPercent
      ),
    [categories, transactions, selectedMonth, settings.budgetWarningPercent]
  );

  // Handlers
  const handleOpenNewTransaction = (
    mode: 'expense' | 'income' | 'credit_card' | 'transfer' = 'expense',
    tripIdOrDate?: string,
    explicitDate?: string
  ) => {
    setEditingTransaction(null);
    setModalDefaultMode(mode);
    if (tripIdOrDate && /^\d{4}-\d{2}-\d{2}$/.test(tripIdOrDate)) {
      setModalInitialDate(tripIdOrDate);
      setModalInitialTripId(undefined);
    } else {
      setModalInitialTripId(tripIdOrDate);
      setModalInitialDate(explicitDate);
    }
    setIsModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    const restriction = isSharedTransactionCreatedByOther(tx, effectiveUserEmail)
      ? 'Este lançamento compartilhado foi criado por outra pessoa. Só quem criou pode editá-lo por completo.'
      : getTransactionEditRestriction(tx);
    if (restriction) {
      showNotice(
        restriction,
        undefined,
        true
      );
      return;
    }
    setEditingTransaction(tx);
    setModalDefaultMode(
      tx.creditCardId ? 'credit_card' :
        tx.type === 'income' ? 'income' :
          tx.type === 'transfer' ? 'transfer' : 'expense'
    );
    setIsModalOpen(true);
  };

  const handleDuplicateTransaction = (tx: Transaction) => {
    const cloned = duplicateFinancialTransaction(tx, `tx-dup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    if (!cloned) { showNotice('Este lançamento é vinculado a outra operação. Crie um novo lançamento para registrar outra movimentação.', undefined, true); return; }
    const next = [cloned, ...transactions];
    setTransactions(next);
    if (cloned.isShared) triggerCrossAccountSharedTxSync(next);
    showNotice(`Lançamento "${tx.description}" duplicado na competência.`, transactions);
  };

  const sharedSyncVersionRef = useRef<Record<string, number>>({});
  const triggerCrossAccountSharedTxSync = (
    nextTransactions: Transaction[],
    nextMembers: FamilyMember[] = familyMembers,
    deletedSharedSyncIds?: string[],
    /** Quando informado, os ids apagados valem só para esta pessoa (ex.: o lançamento mudou de parceiro). */
    deletedOnlyForMemberId?: string
  ) => {
    if (!effectiveUserEmail) return;
    const sharedList = nextTransactions.filter((t) => t.isShared && !t.tripId);
    if (
      sharedList.length === 0 &&
      (!deletedSharedSyncIds || deletedSharedSyncIds.length === 0)
    ) {
      return;
    }
    for (const member of nextMembers) {
      const partnerEmail = String(member.email || member.invitedByEmail || '')
        .trim()
        .toLowerCase();
      if (
        !partnerEmail ||
        partnerEmail === effectiveUserEmail ||
        member.inviteStatus !== 'accepted'
      ) {
        continue;
      }
      const memberTransactions = sharedList.filter(
        (tx) => String(tx.sharedMemberId || '') === member.id
      );
      const deletedForThisMember =
        deletedOnlyForMemberId && deletedOnlyForMemberId !== member.id ? undefined : deletedSharedSyncIds;
      if (memberTransactions.length === 0 && !deletedForThisMember?.length) continue;
      const syncVersion = (sharedSyncVersionRef.current[partnerEmail] ?? 0) + 1;
      sharedSyncVersionRef.current[partnerEmail] = syncVersion;
      const sendToPartner = (attempt: number) => {
        void syncNeonSharedTransactions({
          partnerEmail,
          transactions: memberTransactions as unknown as Array<Record<string, unknown>>,
          deletedSharedIds: deletedForThisMember,
        }).catch((error) => {
          console.error(
            `Falha ao sincronizar despesas compartilhadas com ${partnerEmail}.`,
            error instanceof Error ? error.message : String(error)
          );
          // Tenta de novo (até 6 vezes) enquanto não houver uma sincronização mais nova para a mesma pessoa.
          if (attempt >= 6) return;
          window.setTimeout(() => {
            if (sharedSyncVersionRef.current[partnerEmail] === syncVersion) sendToPartner(attempt + 1);
          }, Math.min(2_000 * 2 ** attempt, 60_000));
        });
      };
      sendToPartner(0);
    }
  };

  const handleSaveTransactionBatch = (
    input: CreateTransactionBatchInput,
    editingId?: string,
    cascadeScope: CascadeScope = 'single'
  ) => {
    const prevSnapshot = [...transactions];

    if (input.type === 'transfer' && input.destinationAccountId) {
      const resolvedTransfer = resolveBankTransfer({
        source: accounts.find((account) => account.id === input.accountId),
        destination: accounts.find((account) => account.id === input.destinationAccountId),
        amountBrl: input.amount,
        foreignAmount: input.transferFromAmount ?? input.transferToAmount,
      });
      if (resolvedTransfer.error) {
        showNotice(resolvedTransfer.error, undefined, true);
        return;
      }
    }

    if (editingId) {
      const targetTx = transactions.find((t) => t.id === editingId);
      if (targetTx) {
        const updatedSingleTx: Transaction = {
          ...targetTx,
          description: input.description,
          amount: input.amount,
          installmentPurchaseTotal:
            input.installmentPurchaseTotal ?? targetTx.installmentPurchaseTotal,
          date: input.date,
          competenceMonth: input.competenceMonth || input.date.slice(0, 7),
          type: input.type,
          status: input.status,
          categoryId: input.categoryId,
          accountId: input.accountId,
          destinationAccountId: input.destinationAccountId,
          targetInvestmentAssetId: input.targetInvestmentAssetId,
          transferFromAmount: input.transferFromAmount,
          transferToAmount: input.transferToAmount,
          transferExchangeRate: input.transferExchangeRate,
          creditCardId: input.creditCardId,
          paymentMethod: input.paymentMethod,
          notes: input.notes,
          tags: input.tags && input.tags.length > 0 ? input.tags : undefined,
          isShared: input.isShared,
          sharedMemberId: input.sharedMemberId,
          sharedAmount: input.sharedAmount,
          sharedSplitMode: input.sharedSplitMode,
          sharedPaidBy: input.sharedPaidBy,
          sharedStatus: input.sharedStatus || targetTx.sharedStatus || 'pending',
          originalCurrency: input.originalCurrency,
          originalAmount: input.originalAmount,
          exchangeRate: input.exchangeRate,
          effectiveExchangeRate: input.effectiveExchangeRate,
          iofPercent: input.iofPercent,
          currencyRegime: input.currencyRegime,
          tripId: input.tripId,
          paidByParticipantId: input.paidByParticipantId,
          tripSplitMethod: input.tripSplitMethod,
          tripShares: input.tripShares,
          myPersonalShareBrl: input.myPersonalShareBrl,
          myPersonalShareForeign: input.myPersonalShareForeign,
          isCompanionOnlyExpense: input.isCompanionOnlyExpense,
        };

        if (
          targetTx.installmentGroupId &&
          (cascadeScope !== 'single' || updatedSingleTx.installmentPurchaseTotal !== undefined)
        ) {
          const res = applyCascadeTransactionEdit(
            transactions,
            updatedSingleTx,
            cascadeScope
          );
          if (res.error) {
            showNotice(res.error, undefined, true);
            return;
          }
          setTransactions(res.updatedTransactions);
          if (updatedSingleTx.isShared || targetTx.isShared) {
            triggerCrossAccountSharedTxSync(res.updatedTransactions);
          }
          showNotice(
            `Efeito Cascata aplicado: ${res.affectedCount} lançamento(s) da série atualizados!`,
            prevSnapshot
          );
          return;
        }

        const nextList = transactions.map((tx) =>
          tx.id === editingId ? updatedSingleTx : tx
        );
        setTransactions(nextList);
        if (updatedSingleTx.isShared || targetTx.isShared) {
          const memberChanged =
            Boolean(targetTx.isShared && updatedSingleTx.isShared) &&
            Boolean(targetTx.sharedMemberId) &&
            targetTx.sharedMemberId !== updatedSingleTx.sharedMemberId;
          const deletedIds =
            (targetTx.isShared && !updatedSingleTx.isShared) || memberChanged
              ? [targetTx.sharedSyncId || targetTx.id]
              : undefined;
          triggerCrossAccountSharedTxSync(
            nextList,
            familyMembers,
            deletedIds,
            memberChanged ? targetTx.sharedMemberId : undefined
          );
        }
        showNotice('Lançamento atualizado com sucesso.', prevSnapshot);
        return;
      }
    }

    // If user submitted a credit card bill payment from the unified TransactionModal, execute the full invoice cascade
    if (input.isInvoicePayment && input.settledCardId && input.accountId) {
      const targetCard = cards.find((c) => c.id === input.settledCardId);
      if (targetCard) {
        const targetMonth = input.competenceMonth || input.date.slice(0, 7);
        const updated = payCreditCardInvoice(
          targetCard,
          transactions,
          targetMonth,
          input.accountId,
          input.date,
          input.amount
        );
        if (updated === transactions) {
          showNotice('Valor de pagamento inválido para o saldo pendente desta fatura.', undefined, true);
          return;
        }
        setTransactions(updated);
        showNotice(
          `Pagamento da fatura de ${targetCard.name} (${formatBRL(
            input.amount
          )}) registrado com baixa em cascata!`,
          prevSnapshot
        );
        return;
      }
    }

    // Aporte direto em ativo: confirma ativo, cotação e valor ANTES de tirar o dinheiro da conta.
    if (input.type === 'transfer' && input.targetInvestmentAssetId && input.amount > 0) {
      const contributionPlan = planAssetContribution(
        investments.find((asset) => asset.id === input.targetInvestmentAssetId),
        input.amount
      );
      if (contributionPlan.error) {
        showNotice(contributionPlan.error, undefined, true);
        return;
      }
    }

    const createdBatch = createTransactionBatch(input);
    const nextAllTransactions = [...createdBatch, ...transactions];
    setTransactions(nextAllTransactions);
    if (input.isShared) {
      triggerCrossAccountSharedTxSync(nextAllTransactions);
    }

    if (input.type === 'transfer' && input.targetInvestmentAssetId && input.amount > 0) {
      const targetAsset = investments.find((a) => a.id === input.targetInvestmentAssetId);
      if (targetAsset && targetAsset.currentPrice > 0) {
        const qtyDelta =
          Math.round((input.amount / targetAsset.currentPrice) * 10000) / 10000;
        const updatedAsset = applyAssetOperation(
          targetAsset,
          'buy',
          qtyDelta,
          targetAsset.currentPrice
        );
        setInvestments((prev) =>
          prev.map((a) => (a.id === targetAsset.id ? updatedAsset : a))
        );
        showNotice(
          `Aporte de ${formatBRL(input.amount)} debitado da conta e somado ao ativo ${targetAsset.ticker}!`,
          prevSnapshot
        );
        return;
      }
    }

    const commitmentNote = describeCommitmentAfterPurchase({
      transactions: nextAllTransactions,
      created: createdBatch,
      limitPercent: settings.cardCommitmentLimitPercent,
      warnPercent: settings.cardCommitmentWarnPercent,
    });
    if (createdBatch.length > 1) {
      showNotice(
        `${createdBatch.length} lançamentos gerados na série (${formatBRL(
          createdBatch[0].amount
        )} por mês).${commitmentNote ? ` ${commitmentNote}` : ''}`,
        prevSnapshot
      );
    } else {
      showNotice(`Lançamento registrado no controle.${commitmentNote ? ` ${commitmentNote}` : ''}`, prevSnapshot);
    }
  };

  // Toggle status (Pago ⇄ Pendente) with automatic cascade invoice reversal and 1-click Undo
  const handleToggleTransactionStatus = (
    txId: string,
    cascadeScope: CascadeScope = 'single'
  ) => {
    const target = transactions.find((t) => t.id === txId);
    if (!target) return;
    const prevSnapshot = [...transactions];
    const res = toggleTransactionStatusWithCascade(
      transactions,
      txId,
      cards,
      cascadeScope
    );
    if (res.blocked) {
      showNotice(res.actionDescription, undefined, true);
      return;
    }
    setTransactions(res.updatedTransactions);
    showNotice(res.actionDescription, prevSnapshot);
  };

  const handleBatchSettleTransactions = (txIds: string[]) => {
    if (txIds.length === 0) return;
    const prevSnapshot = [...transactions];
    // Só movimentos bancários pendentes: compra de cartão se quita pela fatura e o que já está pago não muda.
    const eligible = new Set(
      transactions
        .filter((tx) => txIds.includes(tx.id) && tx.status === 'pending' && canSettleTransactionDirectly(tx))
        .map((tx) => tx.id)
    );
    const skipped = txIds.length - eligible.size;
    if (eligible.size === 0) {
      showNotice('Nada a efetivar: compras de cartão se quitam pagando a fatura, e o restante já está pago.', undefined, true);
      return;
    }
    setTransactions((prev) =>
      prev.map((tx) => (eligible.has(tx.id) ? { ...tx, status: 'paid' } : tx))
    );
    showNotice(
      `${eligible.size} lançamento(s) efetivado(s) em lote${skipped > 0 ? ` (${skipped} ignorado(s): compra de cartão ou já pago)` : ''}.`,
      prevSnapshot
    );
  };

  const handleAnticipateInstallments = (
    installmentGroupId: string,
    discountAmount: number,
    maxCountToAdvance?: number
  ) => {
    const prevSnapshot = [...transactions];
    const res = anticipateCardInstallments(
      transactions,
      installmentGroupId,
      selectedMonth,
      discountAmount,
      maxCountToAdvance
    );
    if (res.anticipatedCount === 0) return;
    const discountApplied = Math.round((res.originalSum - res.finalSum) * 100) / 100;
    setTransactions(res.updatedTransactions);
    showNotice(
      `${res.anticipatedCount} parcela(s) futura(s) antecipada(s) para ${formatMonthYearPT(
        selectedMonth
      )} (${formatBRL(res.finalSum)}${
        discountApplied > 0
          ? ` com desconto de ${formatBRL(discountApplied)}`
          : ''
      }).`,
      prevSnapshot
    );
  };

  const handleReverseAnticipation = (targetIdOrGroupId: string) => {
    const prevSnapshot = [...transactions];
    const res = reverseInstallmentAnticipation(transactions, targetIdOrGroupId);
    if (res.restoredCount === 0) return;
    setTransactions(res.updatedTransactions);
    showNotice(
      `Antecipação desfeita: ${res.restoredCount} parcela(s) devolvida(s) aos meses de vencimento originais!`,
      prevSnapshot
    );
  };

  const handleDeleteTransaction = (txId: string, deleteGroup = false) => {
    const prevSnapshot = [...transactions];
    const scope: CascadeScope = deleteGroup ? 'all_series' : 'single';
    const res = applyCascadeTransactionDelete(transactions, txId, scope, cards);
    if (res.deletedCount === 0 && res.actionDescription) {
      showNotice(res.actionDescription, undefined, true);
      return;
    }
    const updatedIds = new Set(res.updatedTransactions.map((t) => t.id));
    const deletedSharedIds = prevSnapshot
      .filter((t) => !updatedIds.has(t.id) && t.isShared)
      .map((t) => t.sharedSyncId || t.id);

    setTransactions(res.updatedTransactions);
    if (deletedSharedIds.length > 0) {
      triggerCrossAccountSharedTxSync(
        res.updatedTransactions,
        familyMembers,
        deletedSharedIds
      );
    }
    showNotice(
      res.actionDescription ||
        (res.deletedCount > 1
          ? `${res.deletedCount} lançamentos da série removidos.`
          : 'Lançamento removido.'),
      prevSnapshot
    );
  };

  const handleToggleAccountInTotal = (accountId: string) => {
    const targetAcc = accounts.find((a) => a.id === accountId);
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === accountId ? { ...acc, includeInTotal: !acc.includeInTotal } : acc
      )
    );
    if (targetAcc) {
      showNotice(
        `Conta "${targetAcc.name}" ${
          targetAcc.includeInTotal ? 'removida do giro mensal' : 'incluída no giro mensal'
        }.`
      );
    }
  };

  const handlePayCardInvoice = (
    cardId: string,
    paymentAccountId: string,
    customAmount?: number
  ) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const effectiveAccountId =
      paymentAccountId ||
      card.defaultAccountId ||
      accounts.find((account) => getAccountCurrency(account) === 'BRL')?.id ||
      '';
    const paymentAccount = accounts.find((account) => account.id === effectiveAccountId);
    if (!paymentAccount) {
      showNotice('Não há conta cadastrada para pagar a fatura. Cadastre uma conta em reais primeiro.', undefined, true);
      return;
    }
    if (getAccountCurrency(paymentAccount) !== 'BRL') {
      showNotice('A fatura é em reais: pague por uma conta em reais.', undefined, true);
      return;
    }
    const prevSnapshot = [...transactions];
    const paymentDate = getLocalDateISO();
    const updated = payCreditCardInvoice(
      card,
      transactions,
      selectedMonth,
      effectiveAccountId,
      paymentDate,
      customAmount
    );
    if (updated === transactions) {
      showNotice('Informe um valor positivo que não ultrapasse o saldo pendente.', undefined, true);
      return;
    }
    setTransactions(updated);
    if (customAmount && customAmount > 0) {
      showNotice(
        `Pagamento parcial de ${formatBRL(customAmount)} na fatura de ${card.name} registrado.`,
        prevSnapshot
      );
    } else {
      showNotice(
        `Fatura de ${card.name} paga e debitada da conta selecionada.`,
        prevSnapshot
      );
    }
  };

  const handleAddCard = (newCard: Omit<CreditCard, 'id'>) => {
    const created: CreditCard = {
      ...newCard,
      id: newEntityId('card'),
    };
    setCards((prev) => [...prev, created]);
    showNotice(`Cartão ${created.name} adicionado.`);
  };

  const handleUpdateCard = (updatedCard: CreditCard) => {
    setCards((prev) =>
      prev.map((c) => (c.id === updatedCard.id ? updatedCard : c))
    );
    showNotice(`Cartão ${updatedCard.name} atualizado.`);
  };

  const handleDeleteCard = (cardId: string): boolean => {
    const target = cards.find((c) => c.id === cardId);
    if (!target) return false;
    const linkedTransactions = getTransactionsLinkedToCreditCard(target, transactions);
    if (linkedTransactions.length > 0) {
      showNotice(
        `Este cartão tem ${linkedTransactions.length} lançamento(s) no histórico. Para preservar compras e pagamentos já registrados, mantenha o cartão no histórico.`,
        undefined,
        true
      );
      return false;
    }
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    showNotice(`Cartão ${target.name} removido.`);
    return true;
  };

  // Trips & Multi-Currency Handlers
  const handleAddTrip = (newTrip: Trip) => {
    setTrips((prev) => [newTrip, ...prev]);
    showNotice(`Viagem "${newTrip.name}" criada com sucesso!`);
  };

  const handleUpdateTrip = (updatedTrip: Trip) => {
    setTrips((prev) =>
      prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t))
    );
    showNotice(`Viagem "${updatedTrip.name}" atualizada.`);
  };

  const handleDeleteTrip = (tripId: string) => {
    const target = trips.find((t) => t.id === tripId);
    const lotIds = new Set((target?.exchangeLots || []).map((l) => `tx-fxlot-${l.id}`));
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
    setTransactions((prev) =>
      prev
        .filter((tx) => !lotIds.has(tx.id))
        .map((tx) =>
          tx.tripId === tripId
            ? {
                ...tx,
                tripId: undefined,
                paidByParticipantId: undefined,
                splitBetweenParticipantIds: undefined,
                customParticipantSplits: undefined,
              }
            : tx
        )
    );
    showNotice(`Viagem "${target?.name || ''}" removida.`);
  };

  const handleAddExchangeLot = (
    tripId: string,
    lot: TripExchangeLot,
    debitFromAccountId?: string
  ) => {
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? { ...t, exchangeLots: [lot, ...t.exchangeLots] }
          : t
      )
    );
    if (debitFromAccountId && lot.totalBrlPaid > 0) {
      const targetTrip = trips.find((t) => t.id === tripId);
      const debitAccount = accounts.find((account) => account.id === debitFromAccountId);
      if (debitAccount && getAccountCurrency(debitAccount) !== 'BRL') {
        showNotice('Os reais da compra de câmbio precisam sair de uma conta em reais.', undefined, true);
        return;
      }
      // A compra de câmbio é uma TRANSFERÊNCIA (reais -> conta internacional), não um gasto: se fosse despesa,
      // contaria duas vezes (na compra da moeda e depois nos gastos da viagem). Sem conta internacional vinculada,
      // continua como saída de reais.
      const creditAccount = accounts.find(
        (account) =>
          account.id === lot.accountId &&
          account.type === 'international' &&
          account.currency === lot.currency
      );
      const fxTx: Transaction = {
        id: `tx-fxlot-${lot.id}`,
        description: `Compra de Câmbio (${lot.currency} ${lot.foreignAmount.toFixed(2)}) — ${
          lot.sourceLabel
        }`,
        amount: lot.totalBrlPaid,
        date: lot.date,
        competenceMonth: lot.date.slice(0, 7),
        type: creditAccount ? 'transfer' : 'expense',
        status: 'paid',
        categoryId: 'cat-viagens',
        accountId: debitFromAccountId,
        destinationAccountId: creditAccount?.id,
        paymentMethod: creditAccount ? 'transfer' : 'pix',
        recurrence: 'single',
        notes: `Lote de câmbio para ${targetTrip?.name || 'Viagem'} (VET R$ ${lot.effectiveRateBrl.toFixed(4)}) [lot:${lot.id}]`,
      };
      setTransactions((prev) => [fxTx, ...prev]);
    }
    showNotice('Lote de câmbio registrado e câmbio médio ponderado atualizado!');
  };

  const handleDeleteExchangeLot = (tripId: string, lotId: string) => {
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? { ...t, exchangeLots: t.exchangeLots.filter((l) => l.id !== lotId) }
          : t
      )
    );
    setTransactions((prev) =>
      prev.filter(
        (tx) =>
          tx.id !== `tx-fxlot-${lotId}` && !tx.notes?.includes(`[lot:${lotId}]`)
      )
    );
    showNotice('Lote de câmbio removido.');
  };

  const handleRecordTripSettlement = (
    tripId: string,
    settlement: TripSettlement,
    bankAccountEffect?: {
      accountId: string;
      type: 'income' | 'expense';
      brlAmount: number;
      description: string;
    }
  ) => {
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? { ...t, settlements: [settlement, ...t.settlements] }
          : t
      )
    );

    if (bankAccountEffect && bankAccountEffect.brlAmount > 0) {
      const settleTx: Transaction = {
        id: newEntityId('tx-tripsettle'),
        description: bankAccountEffect.description,
        amount: bankAccountEffect.brlAmount,
        date: settlement.date,
        competenceMonth: settlement.date.slice(0, 7),
        type: bankAccountEffect.type,
        status: 'paid',
        categoryId:
          bankAccountEffect.type === 'income' ? 'cat-rendimentos' : 'cat-lazer',
        accountId: bankAccountEffect.accountId,
        paymentMethod: 'pix',
        recurrence: 'single',
        notes: settlement.notes || 'Acerto de contas de viagem internacional',
      };
      setTransactions((prev) => [settleTx, ...prev]);
    }

    showNotice('Acerto de viagem liquidado e saldos do grupo atualizados!');
  };

  const handleUpdateCategoryBudget = (categoryId: string, newBudget: number) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId ? { ...cat, monthlyBudget: newBudget } : cat
      )
    );
    showNotice('Teto de gastos da categoria atualizado.');
  };

  const handleAddCategory = (newCat: Omit<Category, 'id'>) => {
    const created: Category = {
      ...newCat,
      id: newEntityId('cat'),
    };
    setCategories((prev) => [...prev, created]);
    showNotice(`Categoria "${created.name}" criada.`);
  };

  const handleUpdateCategory = (updatedCat: Category) => {
    setCategories((prev) =>
      prev.map((cat) => (cat.id === updatedCat.id ? updatedCat : cat))
    );
    showNotice(`Categoria "${updatedCat.name}" atualizada.`);
  };

  const handleDeleteCategory = (categoryId: string) => {
    const target = categories.find((c) => c.id === categoryId);
    if (!target) return;
    const linkedTransactions = getTransactionsLinkedToCategory(categoryId, transactions);
    if (linkedTransactions.length > 0) {
      showNotice(
        `A categoria "${target.name}" está em ${linkedTransactions.length} lançamento(s). Reclassifique esses lançamentos antes de excluir para preservar os relatórios.`,
        undefined,
        true
      );
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    showNotice(`Categoria "${target.name}" removida.`);
  };

  const handleApplyHistoricalInstallmentTotals = () => {
    const previousTransactions = [...transactions];
    const result = applyHighConfidenceInstallmentTotals(transactions, cards);
    if (result.updatedRows === 0) {
      showNotice('Nenhum total de parcelamento de alta confiança precisa ser preenchido.', undefined, true);
      return;
    }
    setTransactions(result.updatedTransactions);
    showNotice(
      `Total original preenchido em ${result.updatedRows} parcela(s) de ${result.updatedGroups} série(s). Valores das parcelas e competências preservados. Use Desfazer no aviso se precisar reverter.`,
      previousTransactions
    );
  };

  const handleContributeGoal = (
    goalId: string,
    amount: number,
    debitAccountId?: string,
    contributionDate: string = getLocalDateISO()
  ) => {
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal || !Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 100)) || Math.round(amount * 100) <= 0) return;
    const parsedDate = new Date(`${contributionDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(contributionDate) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== contributionDate) { showNotice('Informe uma data válida para o aporte.', undefined, true); return; }
    if (debitAccountId && !accounts.some(account => account.id === debitAccountId && getAccountCurrency(account) === 'BRL')) { showNotice('Selecione uma conta em reais para debitar o aporte.', undefined, true); return; }
    if (targetGoal?.linkedAssetId) {
      const linkedAsset = investments.find((a) => a.id === targetGoal.linkedAssetId);
      if (!linkedAsset) { showNotice('O investimento vinculado à meta não foi encontrado.', undefined, true); return; }
      try {
        const result = createGoalInvestmentContribution(targetGoal, linkedAsset, amount, contributionDate, debitAccountId, newEntityId('tx-goal'));
        setInvestments(prev => prev.map(asset => asset.id === linkedAsset.id ? result.asset : asset));
        setGoals(prev => prev.map(goal => goal.id === targetGoal.id ? result.goal : goal));
        if (result.transaction) { const movement = result.transaction; setTransactions(prev => [movement, ...prev]); }
        showNotice(`Aporte de ${formatBRL(amount)} registrado na meta${debitAccountId ? ' e debitado da conta' : ''}.`);
      } catch (error) { showNotice(error instanceof Error ? error.message : 'Não foi possível registrar o aporte.', undefined, true); }
      return;
    }
    const nextGoalCents = Math.round(targetGoal.currentAmount * 100) + Math.round(amount * 100);
    if (!Number.isSafeInteger(nextGoalCents) || nextGoalCents < 0) { showNotice('O saldo da meta excede o limite de valores permitido.', undefined, true); return; }
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? { ...g, currentAmount: nextGoalCents / 100 }
          : g
      )
    );
    showNotice(`Reserva de ${formatBRL(amount)} registrada na meta.`);
  };

  const handleAddGoal = (newGoal: Omit<SavingsGoal, 'id'>) => {
    const created: SavingsGoal = {
      ...newGoal,
      id: newEntityId('goal'),
    };
    setGoals((prev) => [...prev, created]);
    showNotice(`Meta "${created.name}" criada.`);
  };

  const handleUpdateGoal = (updatedGoal: SavingsGoal) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === updatedGoal.id ? updatedGoal : g))
    );
    showNotice(`Meta "${updatedGoal.name}" atualizada.`);
  };

  const handleDeleteGoal = (goalId: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
    showNotice('Meta de economia removida.');
  };

  const triggerCrossAccountInviteSync = async (member: FamilyMember) => {
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
      showNotice(`Convite registrado no app para ${member.email}. Nenhum e-mail foi enviado; peça à pessoa que entre no Minhas Economias com esse mesmo e-mail para ver e aceitar o convite.`);
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

  const handleAcceptFamilyInvite = (member: FamilyMember) => {
    if (!member.invitationId) {
      showNotice('Este convite ainda não foi migrado para a sincronização segura no Neon.');
      return;
    }
    void respondToNeonFamilyInvitation(member.invitationId, 'accepted')
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
        showNotice('Não foi possível aceitar o convite. Nenhuma alteração foi confirmada.');
      });
  };

  const handleDeclineFamilyInvite = (member: FamilyMember) => {
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
    const result = reopenSharedSettlement(transactions, txId);
    if (!result.affectedCount) return;
    setTransactions(result.transactions);
    triggerCrossAccountSharedTxSync(result.transactions);
    showNotice(`${result.affectedCount} despesa(s) compartilhada(s) reaberta(s) e acerto estornado.`);
  };

  const handleAddAccount = (newAcc: Omit<BankAccount, 'id'>): BankAccount => {
    const created: BankAccount = {
      ...newAcc,
      id: newEntityId('acc'),
    };
    setAccounts((prev) => [...prev, created]);
    showNotice(`Conta ${created.name} cadastrada.`);
    return created;
  };

  const handleUpdateAccount = (updatedAcc: BankAccount) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === updatedAcc.id ? updatedAcc : acc))
    );
    showNotice(`Conta ${updatedAcc.name} atualizada.`);
  };

  const handleDeleteAccount = (accountId: string) => {
    const tripsUsingAccount = trips.filter((trip) =>
      trip.linkedAccountId === accountId ||
      trip.exchangeLots.some((lot) => lot.accountId === accountId || lot.debitAccountId === accountId)
    );
    if (tripsUsingAccount.length > 0) {
      showNotice(
        `Conta não removida: está vinculada às viagens ${[...new Set(tripsUsingAccount.map((trip) => trip.name))].join(', ')}. Remova ou troque esses vínculos primeiro.`
      );
      return;
    }

    const result = applyCascadeAccountDelete(accounts, cards, transactions, accountId);
    if (result.error) {
      showNotice(result.error, undefined, true);
      return;
    }
    if (!result.deletedAccount) return;

    setAccounts(result.updatedAccounts);
    setCards(result.updatedCards);
    setTransactions(result.updatedTransactions);
    const cleanupMessage = result.deletedTransactionCount > 0
      ? ` ${result.deletedTransactionCount} transferência(s) incompatível(is) foram removidas.`
      : '';
    showNotice(`Conta ${result.deletedAccount.name} removida.${cleanupMessage}`);
  };

  const handleUpdateAccountInitialBalance = (accountId: string, newInitial: number) => {
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === accountId ? { ...acc, initialBalance: newInitial } : acc
      )
    );
    showNotice('Saldo inicial da conta atualizado.');
  };

  const handleAddInvestmentAsset = (newAsset: Omit<InvestmentAsset, 'id'>) => {
    const created: InvestmentAsset = {
      ...newAsset,
      id: newEntityId('inv'),
    };
    setInvestments((prev) => [...prev, created]);
    showNotice(`Ativo ${created.ticker} cadastrado na carteira.`);
  };

  const handleUpdateInvestmentAsset = (updatedAsset: InvestmentAsset) => {
    setInvestments((prev) =>
      prev.map((a) => (a.id === updatedAsset.id ? updatedAsset : a))
    );
    showNotice(`Ativo ${updatedAsset.ticker} atualizado.`);
  };

  const handleBatchUpdateInvestmentAssets = (updatedAssets: InvestmentAsset[]) => {
    setInvestments(updatedAssets);
    showNotice(
      'Cotações sincronizadas automaticamente com o Google Finance!',
      undefined,
      true
    );
  };

  const handleDeleteInvestmentAsset = (assetId: string) => {
    const target = investments.find((a) => a.id === assetId);
    if (!target) return;
    const restriction = getInvestmentDeletionRestriction(target, transactions, goals);
    if (restriction) { showNotice(restriction, undefined, true); return; }
    setInvestments((prev) => prev.filter((a) => a.id !== assetId));
    showNotice(`Ativo ${target?.ticker || ''} removido da carteira.`);
  };

  const handleOperateInvestmentAsset = (
    assetId: string,
    operationType: 'buy' | 'sell' | 'update_quote',
    quantityDelta: number,
    unitPrice: number,
    settlementAccountId?: string,
    operationDate: string = getLocalDateISO()
  ) => {
    const targetAsset = investments.find((a) => a.id === assetId);
    if (!targetAsset) return;

    let ledgerTx: Transaction | undefined;
    try {
      if (operationType !== 'update_quote' && settlementAccountId) {
        if (!accounts.some((account) => account.id === settlementAccountId && getAccountCurrency(account) === 'BRL')) throw new Error('Selecione uma conta em reais: compra e venda de ativo movimentam reais.');
        ledgerTx = createInvestmentCashMovement(targetAsset, operationType, quantityDelta, unitPrice, settlementAccountId, operationDate, newEntityId('tx-inv'));
      }
      if (!Number.isFinite(unitPrice) || unitPrice <= 0 || (operationType !== 'update_quote' && (!Number.isFinite(quantityDelta) || quantityDelta <= 0)) || (operationType === 'sell' && quantityDelta > targetAsset.quantity)) throw new Error('Confira a quantidade e o preço da operação.');
    } catch (error) { showNotice(error instanceof Error ? error.message : 'Operação inválida.', undefined, true); return; }
    const updatedAsset = applyAssetOperation(
      targetAsset,
      operationType,
      quantityDelta,
      unitPrice
    );

    setInvestments((prev) =>
      prev.map((a) => (a.id === assetId ? updatedAsset : a))
    );

    const financialTotal = Math.round(quantityDelta * unitPrice * 100) / 100;

    if (ledgerTx) {
      const movement = ledgerTx;
      setTransactions((prev) => [movement, ...prev]);
    }

    if (operationType === 'buy') {
      showNotice(
        `Aporte em ${targetAsset.ticker} registrado! Novo Preço Médio: ${formatBRL(
          updatedAsset.averagePrice
        )}.`
      );
    } else if (operationType === 'sell') {
      showNotice(
        `Resgate / Venda de ${targetAsset.ticker} registrado (${formatBRL(
          financialTotal
        )}).`
      );
    } else {
      showNotice(
        `Cotação de ${targetAsset.ticker} atualizada para ${formatBRL(unitPrice)}.`
      );
    }
  };

  const handleRecordDividendIncome = (
    asset: InvestmentAsset,
    dividendAmount: number,
    receivingAccountId: string,
    dividendDate: string = getLocalDateISO()
  ) => {
    const parsedDate = new Date(`${dividendDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dividendDate) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dividendDate || !Number.isFinite(dividendAmount) || Math.round(dividendAmount * 100) <= 0 || !Number.isSafeInteger(Math.round(dividendAmount * 100)) || !accounts.some(account => account.id === receivingAccountId && getAccountCurrency(account) === 'BRL')) return;
    const dividendTx: Transaction = {
      id: newEntityId('tx-div'),
      description: `Proventos / Dividendos — ${asset.ticker} (${asset.name})`,
      amount: Math.round(dividendAmount * 100) / 100,
      date: dividendDate,
      competenceMonth: dividendDate.slice(0, 7),
      type: 'income',
      status: 'paid',
      categoryId: 'cat-rendimentos',
      accountId: receivingAccountId,
      paymentMethod: 'pix',
      recurrence: 'single',
      notes: `Rendimento / dividendo creditado por ${asset.institution}`,
    };
    setTransactions((prev) => [dividendTx, ...prev]);
    showNotice(
      `Provento de ${formatBRL(dividendAmount)} (${asset.ticker}) creditado no extrato bancário!`
    );
  };

  const handleImportQuickCsvLines = (linesText: string, targetAccountId: string): number => {
    const importAccount = accounts.find((account) => account.id === targetAccountId);
    if (!importAccount) {
      showNotice('Escolha uma conta cadastrada para importar os lançamentos.', undefined, true);
      return 0;
    }
    if (getAccountCurrency(importAccount) !== 'BRL') {
      showNotice('A importação por lote é em reais. Escolha uma conta em reais (conta internacional: lance pelo formulário, com o câmbio).', undefined, true);
      return 0;
    }
    const imported: Transaction[] = parseQuickCsvLines(linesText).valid.map((row, idx) => ({
      id: `tx-imp-${Date.now()}-${idx}`,
      description: row.description,
      amount: row.amount,
      date: row.date,
      competenceMonth: row.date.slice(0, 7),
      type: row.isNegative ? 'expense' : 'income',
      status: 'paid',
      categoryId: row.isNegative ? 'cat-mercado' : 'cat-freela',
      accountId: targetAccountId,
      paymentMethod: 'pix',
      recurrence: 'single',
      notes: 'Importado manualmente via lote CSV',
    }));

    if (imported.length > 0) {
      showNotice(`${imported.length} lançamento(s) importado(s) via lote CSV.`);
      setTransactions((prev) => [...imported, ...prev]);
      triggerDataLoadingTransition(240);
    }
    return imported.length;
  };

  const handleOpenReconciliation = (accountId?: string) => {
    setReconciliationTargetAccountId(accountId || accounts[0]?.id);
    setIsReconciliationModalOpen(true);
  };

  const handleCommitReconciliationBatch = (
    newTxs: Transaction[],
    accountId: string
  ) => {
    if (newTxs.length === 0) return;
    const result = applyReconciledBankTransactions(transactions, newTxs, cards);
    if (result.importedCount === 0) {
      showNotice('Nenhum lançamento válido foi importado. Revise os vínculos de cartão e fatura.', undefined, true);
      return 0;
    }
    setTransactions(result.updatedTransactions);
    const acc = accounts.find((a) => a.id === accountId);
    showNotice(
      `${result.importedCount} lançamento(s) conciliado(s) com sucesso na conta ${
        acc?.name || 'selecionada'
      }!${result.rejectedInvoicePayments > 0 ? ` ${result.rejectedInvoicePayments} pagamento(s) de fatura não puderam ser vinculados e foram ignorados.` : ''}`,
      undefined,
      result.rejectedInvoicePayments > 0
    );
    triggerDataLoadingTransition(220);
    return result.importedCount;
  };

  const handleExportFullBackupJson = () => {
    if (!currentUser?.uid) {
      showNotice('Entre na sua conta para exportar o backup do workspace.');
      return;
    }
    const payload = {
      version: 6,
      ownerUserId: currentUser?.uid,
      exportedAt: new Date().toISOString(),
      accounts,
      cards,
      categories,
      transactions: getPortableBackupTransactions(transactions),
      sharedSettlementReceiptsJson: JSON.stringify(collectSharedSettlementReceipts(transactions)),
      goals,
      familyMembers: getPortableBackupFamilyMembers(familyMembers),
      investments,
      investmentTargets,
      trips,
      settings: removeSmtpPasswordsFromSettings(settings),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minhas-economias-backup-${selectedMonth}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotice('Backup do workspace (.JSON) exportado com sucesso.', undefined, true);
  };

  const handleImportFullBackupJson = (jsonText: string): boolean => {
    try {
      const parsed = parseFullFinanceBackup(jsonText);
      if (!parsed) return false;
      const sameOwner = Boolean(currentUser?.uid && parsed.ownerUserId === currentUser.uid);
      const optionalState = resolveFullBackupOptionalState(parsed, {
        familyMembers: INITIAL_FAMILY_MEMBERS,
        investmentTargets: DEFAULT_INVESTMENT_TARGETS,
        settings: DEFAULT_SETTINGS,
      });

      const repaired = sanitizeAndRepairFinancialState({
        accounts: parsed.accounts,
        cards: parsed.cards,
        categories: parsed.categories,
        transactions: prepareRestoredBackupTransactions(
          parsed.transactions,
          sameOwner
        ),
        goals: parsed.goals,
        investments: parsed.investments,
        trips: parsed.trips,
      });
      setAccounts(repaired.accounts);
      setCards(repaired.cards);
      setCategories(parsed.categories as Category[]);
      setGoals(repaired.goals);
      const restoredFamilyMembers = stripLegacyMockItems(
        mergeRestoredFamilyMembersWithCurrentIncoming(
          familyMembers,
          optionalState.familyMembers
        )
      );
      const restoredTransactions = mergeRestoredTransactionsWithCurrentMirrors(
        transactions,
        repaired.transactions
      );
      const restoredWithReceipts = sameOwner && parsed.sharedSettlementReceiptsJson
        ? [...restoredTransactions.filter((tx) => !tx.id.startsWith('tx-mirror-')),
          ...restoreSharedSettlementReceipts(restoredTransactions.filter((tx) => tx.id.startsWith('tx-mirror-')), parsed.sharedSettlementReceiptsJson, restoredTransactions)]
        : restoredTransactions;
      setTransactions(restoredWithReceipts);
      setFamilyMembers(restoredFamilyMembers);
      setInvestments(repaired.investments);
      setTrips(repaired.trips);
      setInvestmentTargets(optionalState.investmentTargets);
      setSettings(optionalState.settings);
      if (sameOwner) {
        triggerCrossAccountSharedTxSync(restoredTransactions, restoredFamilyMembers);
      }
      showNotice(
        'Backup carregado nesta sessão. Confira o status da nuvem para confirmar o salvamento no Neon.'
      );
      triggerDataLoadingTransition(260);
      return true;
    } catch {
      return false;
    }
  };

  const handleResetWorkspaceData = () => {
    showNotice('Dados do workspace pessoal removidos. Convites e lançamentos compartilhados não foram alterados.');
    setAccounts(INITIAL_ACCOUNTS);
    setCards(INITIAL_CREDIT_CARDS);
    setCategories(INITIAL_CATEGORIES);
    setTransactions(INITIAL_TRANSACTIONS);
    setGoals(INITIAL_SAVINGS_GOALS);
    setFamilyMembers(INITIAL_FAMILY_MEMBERS);
    setInvestments(INITIAL_INVESTMENTS);
    setInvestmentTargets(DEFAULT_INVESTMENT_TARGETS);
    setTrips(INITIAL_TRIPS);
    setSelectedMonth(DEFAULT_MONTH);
    localStorage.removeItem(STORAGE_KEY);
    triggerDataLoadingTransition(240);
  };

  const financialIntegrity = useMemo(() => {
    if (!isWorkspaceReadyForCurrentUser) return null;
    return runFinancialIntegrityAudit({ accountsCount: accounts.length, cardsCount: cards.length,
      accounts, cards, categories, transactions, goals, investments, trips });
  }, [isWorkspaceReadyForCurrentUser, accounts, cards, categories, transactions, goals, investments, trips]);

  const handleJumpToTransactionInLedger = (tx: Transaction) => {
    setSelectedMonth(tx.date.slice(0, 7));
    setActiveTab('transactions');
    setRequestedLedgerViewMode('table');
    showNotice(
      `Exibindo "${tx.description}" no extrato de ${formatMonthYearPT(
        tx.competenceMonth
      )}.`,
      undefined,
      true
    );
  };

  const activeTabMeta = useMemo(() => {
    switch (activeTab) {
      case 'overview':
        return { title: 'Visão Geral', subtitle: 'Painel executivo, contas a pagar e alertas de orçamento' };
      case 'accounts':
        return { title: 'Contas & Carteiras', subtitle: 'Extrato bancário real com saldo progressivo linha a linha' };
      case 'investments':
        return {
          title: 'Carteira de Investimentos',
          subtitle: 'Alocação patrimonial, renda fixa, FIIs, ações, dividendos e rebalanceamento',
        };
      case 'transactions':
        return { title: 'Lançamentos & Extrato', subtitle: 'Calendário financeiro, recorrências e extrato diário' };
      case 'cards':
        return { title: 'Cartões de Crédito', subtitle: 'Faturas abertas, limites e parcelamentos' };
      case 'shared':
        return { title: 'Despesas Compartilhadas', subtitle: 'Acerto de contas e rateio familiar' };
      case 'trips':
        return {
          title: 'Viagens & Câmbio (TravelSpend)',
          subtitle: 'Controle multi-moeda, lotes de câmbio ponderado e divisão de grupo',
        };
      case 'budgets':
        return { title: 'Orçamentos Mensais', subtitle: 'Tetos de gastos por categoria' };
      case 'goals':
        return { title: 'Metas & Reservas', subtitle: 'Objetivos financeiros e simulador de juros compostos' };
      case 'reports':
        return { title: 'Relatórios & Backup', subtitle: 'Gestão de contas, exportação CSV e backup JSON' };
      case 'cloud':
        return {
          title: 'Conta, Login & Nuvem',
          subtitle: 'Login e sincronização Neon e auditoria dos dados carregados',
        };
    }
  }, [activeTab]);

  const pendingTransactionsCount = useMemo(
    () =>
      transactions.filter(
        (tx) =>
          tx.competenceMonth === selectedMonth &&
          tx.status === 'pending' &&
          tx.type === 'expense' &&
          !tx.isInvoicePayment
      ).length,
    [transactions, selectedMonth]
  );

  const budgetAlertsCount = useMemo(
    () =>
      categoryBreakdown.filter(
        (item) => item.status === 'over' || item.status === 'warning'
      ).length,
    [categoryBreakdown]
  );

  const pendingSharedCount = useMemo(
    () =>
      transactions.filter(
        (tx) =>
          tx.competenceMonth === selectedMonth &&
          tx.isShared &&
          tx.sharedStatus !== 'received'
      ).length,
    [transactions, selectedMonth]
  );

  const activeTripsCount = useMemo(
    () => trips.filter((t) => t.status !== 'completed').length,
    [trips]
  );

  const todayDateStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Posição de hoje (independe do mês navegado): fonte única do saldo total, dos investimentos e do patrimônio.
  const currentPosition = useMemo(
    () => calculateCurrentPosition(accounts, cards, transactions, todayDateStr),
    [accounts, cards, transactions, todayDateStr]
  );
  const netWorthSnapshot = useMemo(
    () => calculateNetWorth(currentPosition.accountBalances, investments, currentPosition.cardSummaries),
    [currentPosition, investments]
  );
  const accountsTotalBalance = netWorthSnapshot.liquidAccountsBalance;
  const investmentsTotalValue = netWorthSnapshot.investedAssetsValue;

  // Previsão do saldo dos próximos 45 dias (contas incluídas no total).
  const cashForecast = useMemo(
    () => forecastCashBalance(accounts, cards, transactions, todayDateStr),
    [accounts, cards, transactions, todayDateStr]
  );

  // Cadastros incompletos ou inconsistentes.
  const dataHealthIssues = useMemo(
    () => assessDataHealth({ accounts, cards, categories, transactions, familyMembers }),
    [accounts, cards, categories, transactions, familyMembers]
  );

  // Gastos que se repetem todo mês (assinaturas, mensalidades): sugere prever os próximos meses.
  const recurringSuggestions = useMemo(
    () => detectRecurringExpenses(transactions, todayDateStr, settings.dismissedRecurringKeys ?? []),
    [transactions, todayDateStr, settings.dismissedRecurringKeys]
  );

  const handleScheduleRecurring = (candidate: RecurringCandidate) => {
    const card = candidate.creditCardId ? cards.find((item) => item.id === candidate.creditCardId) : undefined;
    const learned = learnSharingFromHistory(candidate.description, transactions, familyMembers);
    const sharing = learned
      ? {
          isShared: true,
          sharedMemberId: learned.memberId,
          sharedPaidBy: learned.paidBy,
          sharedSplitMode: learned.splitMode === 'half' ? ('half' as const) : ('custom' as const),
          sharedAmount: calculateSharedAmount(candidate.lastAmount, learned.splitMode, learned.percentage),
        }
      : {};
    handleSaveTransactionBatch({
      description: candidate.description,
      amount: candidate.lastAmount,
      date: candidate.nextExpectedDate,
      competenceMonth: card ? resolveCreditCardInvoiceMonth(candidate.nextExpectedDate, card) : undefined,
      type: 'expense',
      status: 'pending',
      categoryId: candidate.categoryId,
      accountId: candidate.creditCardId ? undefined : candidate.accountId,
      creditCardId: candidate.creditCardId,
      paymentMethod: candidate.paymentMethod,
      recurrence: 'fixed',
      fixedMonthsCount: 12,
      ...sharing,
    });
  };

  const handleDismissRecurring = (candidate: RecurringCandidate) => {
    setSettings((prev) => ({
      ...prev,
      dismissedRecurringKeys: [...new Set([...(prev.dismissedRecurringKeys ?? []), candidate.key])],
    }));
  };

  const dailyReminders = useMemo(() => {
    return calculateDailyReminders({
      transactions,
      cards,
      categories,
      accounts,
      familyMembers,
      referenceDate: todayDateStr,
      settings: settings.reminders || DEFAULT_REMINDER_SETTINGS,
    });
  }, [
    transactions,
    cards,
    categories,
    accounts,
    familyMembers,
    todayDateStr,
    settings.reminders,
  ]);

  const remindersSummary = useMemo(
    () => summarizeReminders(dailyReminders),
    [dailyReminders]
  );

  // Convites de família recebidos e ainda sem resposta aparecem na central de notificações.
  const incomingFamilyInvites = useMemo(
    () => familyMembers.filter((m) => m.direction === 'incoming' && m.inviteStatus === 'invited'),
    [familyMembers]
  );
  // Cartão comprometendo a renda: só avisa com limite definido, do mês atual até os próximos 2 meses.
  const commitmentAlerts = useMemo(() => {
    const referenceMonth = todayDateStr.slice(0, 7);
    return getCommitmentAlerts(
      calculateCardCommitmentByMonth({
        transactions,
        referenceMonth,
        limitPercent: settings.cardCommitmentLimitPercent,
        warnPercent: settings.cardCommitmentWarnPercent,
      }),
      referenceMonth
    );
  }, [transactions, todayDateStr, settings.cardCommitmentLimitPercent, settings.cardCommitmentWarnPercent]);
  // Tudo que avisa fica no sininho: previsão de saldo negativo, cartão acima do limite e dados para revisar.
  const [dismissedNotices, setDismissedNotices] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('minhas-economias:dismissed-notices');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  });
  const noticeKey = (notice: { id: string; title: string }) => `${notice.id}|${notice.title}`;
  const appNotices = useMemo(
    () =>
      buildAppNotices({
        forecast: cashForecast,
        dataHealthIssues,
        commitmentAlerts,
        commitmentLimitPercent: settings.cardCommitmentLimitPercent,
      }).filter((notice) => !dismissedNotices.includes(noticeKey(notice))),
    [cashForecast, dataHealthIssues, commitmentAlerts, settings.cardCommitmentLimitPercent, dismissedNotices]
  );
  const handleDismissNotice = (notice: { id: string; title: string }) => {
    setDismissedNotices((current) => {
      const next = [...current, noticeKey(notice)].slice(-200);
      try { localStorage.setItem('minhas-economias:dismissed-notices', JSON.stringify(next)); } catch { /* sem armazenamento */ }
      return next;
    });
  };
  const noticeCount = remindersSummary.urgentCount + incomingFamilyInvites.length + countBellNotices(appNotices);

  const handleNoticeAction = (action: AppNoticeAction) => {
    if (action === 'commitment') {
      handleSelectTab('cards');
      return;
    }
    handleSelectTab('overview');
    // A previsão fica na Visão Geral: espera a tela abrir e rola até o gráfico.
    window.setTimeout(() => {
      document.getElementById('overview-cash-forecast')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);
  };

  // Fluxo de Inicialização de Permissões de Notificação do Sistema Operacional
  useEffect(() => {
    let isMounted = true;
    const remSettings = settings.reminders || DEFAULT_REMINDER_SETTINGS;

    initializeBrowserNotificationPermissions(remSettings, {
      requestIfDefault: false,
    }).then((initResult) => {
      if (!isMounted) return;
      setBrowserPermissionState(initResult.permission);

      if (
        initResult.permission === 'granted' &&
        remSettings.enabled !== false &&
        !remSettings.browserNotificationsEnabled
      ) {
        setSettings((prev) => ({
          ...prev,
          reminders: {
            ...(prev.reminders || DEFAULT_REMINDER_SETTINGS),
            browserNotificationsEnabled: true,
          },
        }));
      } else if (
        (initResult.permission === 'denied' || initResult.permission === 'unsupported') &&
        remSettings.browserNotificationsEnabled
      ) {
        setSettings((prev) => ({
          ...prev,
          reminders: {
            ...(prev.reminders || DEFAULT_REMINDER_SETTINGS),
            browserNotificationsEnabled: false,
          },
        }));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [settings.reminders?.enabled]);

  const handleActivateOsNotificationsFromInit = async () => {
    const perm = await requestBrowserNotificationPermission();
    setBrowserPermissionState(perm);
    if (perm === 'granted') {
      const nextReminders = {
        ...(settings.reminders || DEFAULT_REMINDER_SETTINGS),
        enabled: true,
        browserNotificationsEnabled: true,
      };
      handleUpdateSettings({ reminders: nextReminders });
      const { title, body } = formatReminderNotificationMessage(dailyReminders);
      sendBrowserNotification(title, body, () => {
        setIsReminderModalOpen(true);
      });
      showNotice(
        'Alertas financeiros do sistema operacional ativados com sucesso!',
        undefined,
        true
      );
    } else if (perm === 'denied') {
      handleUpdateSettings({
        reminders: {
          ...(settings.reminders || DEFAULT_REMINDER_SETTINGS),
          browserNotificationsEnabled: false,
        },
      });
      showNotice(
        'Permissão bloqueada pelo navegador. Você pode liberar no ícone de cadeado da barra de endereço.',
        undefined,
        true
      );
    }
  };

  const handleDismissNotificationInitPrompt = () => {
    setShowNotificationInitPrompt(false);
    try {
      localStorage.setItem('minhas_economias_os_notif_dismissed_v1', '1');
    } catch {
      // Ignore storage errors
    }
  };

  // Background daily scheduled reminder checker
  useEffect(() => {
    const checkDailySchedule = () => {
      if (!isWorkspaceLoadedForUser(loadedWorkspaceUidRef.current, currentUser?.uid ?? null)) return;

      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      const remSettings = settings.reminders || DEFAULT_REMINDER_SETTINGS;
      if (
        shouldTriggerDailyNotification(
          remSettings,
          todayDateStr,
          currentTimeStr,
          dailyReminders
        )
      ) {
        if (
          (remSettings.browserNotificationsEnabled ||
            getBrowserNotificationPermissionState() === 'granted') &&
          dailyReminders.length > 0
        ) {
          const { title, body } = formatReminderNotificationMessage(dailyReminders);
          sendBrowserNotification(title, body, () => {
            setIsReminderModalOpen(true);
          });
        }
        setSettings((prev) => ({
          ...prev,
          reminders: {
            ...(prev.reminders || DEFAULT_REMINDER_SETTINGS),
            lastNotifiedDate: todayDateStr,
          },
        }));
      }

      if (
        shouldTriggerEmailNotification(
          remSettings,
          todayDateStr,
          currentTimeStr,
          dailyReminders
        )
      ) {
        const targetEmail = (
          remSettings.notificationEmail ||
          effectiveUserEmail ||
          ''
        ).trim();
        if (
          targetEmail && dailyReminders.length > 0 && currentUser &&
          !currentUser.isAnonymous &&
          (!scheduledEmailAttemptRef.current ||
            scheduledEmailAttemptRef.current.date !== todayDateStr ||
            Date.now() - scheduledEmailAttemptRef.current.at >= 15 * 60 * 1000)
        ) {
          scheduledEmailAttemptRef.current = { date: todayDateStr, at: Date.now() };
          void (async () => {
            try {
              const authToken = await currentUser.getIdToken();
              const result = await dispatchEmailReminder({
                reminders: dailyReminders,
                recipientEmail: targetEmail,
                userName: effectiveUserDisplayName || settings.userName,
                settings: remSettings,
                recurrence: remSettings.emailRecurrence || remSettings.recurrence || 'daily',
                preferredTime: remSettings.emailPreferredTime || remSettings.preferredTime || '08:00',
                currentDateStr: todayDateStr,
                currentTimeStr,
                authToken,
              });
              if (result.ok) {
                setSettings((prev) => ({
                  ...prev,
                  reminders: {
                    ...(prev.reminders || DEFAULT_REMINDER_SETTINGS),
                    lastEmailNotifiedDate: todayDateStr,
                  },
                }));
              }
            } catch (error) {
              console.error('Não foi possível enviar o lembrete agendado:', error);
            }
          })();
        }
      }
    };

    checkDailySchedule();
    const timer = setInterval(checkDailySchedule, 60000);
    return () => clearInterval(timer);
  }, [settings.reminders, todayDateStr, dailyReminders, currentUser, effectiveUserEmail, effectiveUserDisplayName, settings.userName]);

  const handleMarkTransactionPaid = (txId: string) => {
    const target = transactions.find((t) => t.id === txId);
    if (!target) return;
    if (target.status === 'paid') return;
    handleToggleTransactionStatus(txId, 'single');
  };

  if (!isAuthReady || !isUserAuthenticated) {
    return (
      <div
        className={`min-h-screen w-full max-w-full overflow-x-hidden flex flex-col bg-[var(--app-canvas)] text-slate-900 transition-colors duration-200 ${
          settings.theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : ''
        }`}
      >
        <Suspense fallback={<div role="status" className="grid min-h-screen place-items-center">Carregando acesso...</div>}>
          <LoginPage
            defaultEmail=""
            defaultName=""
            onSignInEmail={handleSignInEmail}
            onRegisterEmail={handleRegisterEmail}
            onSignInPasskey={handleSignInPasskey}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen w-full max-w-full overflow-x-clip flex bg-[var(--app-canvas)] text-slate-900 transition-colors duration-200 ${
        settings.theme === 'dark' ? 'dark' : ''
      } ${settings.privacyMode ? 'privacy-mode' : ''} ${
        settings.density === 'compact' ? 'density-compact' : ''
      }`}
    >
      {isAuthReady && isUserAuthenticated && effectiveUserEmail && !isWorkspaceReadyForCurrentUser &&
        workspaceLoadState === 'loading' && !isShowingCachedWorkspace && (
        // Primeira abertura neste aparelho: indicador discreto, sem mensagem técnica.
        <div
          role="status"
          aria-label="Abrindo"
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-50 dark:bg-slate-950"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-600 border-r-transparent" />
        </div>
      )}
      {isAuthReady && isUserAuthenticated && effectiveUserEmail && !isWorkspaceReadyForCurrentUser &&
        workspaceLoadState === 'error' && isShowingCachedWorkspace && (
        // Já há uma versão salva na tela: avisa sem bloquear, só porque não dá para gravar até o Neon voltar.
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-3 z-[100] w-[min(92vw,34rem)] -translate-x-1/2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 shadow-lg dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Sem conexão com a nuvem. Você está vendo a última versão salva.</span>
            <button
              type="button"
              onClick={() => setWorkspaceLoadAttempt((attempt) => attempt + 1)}
              className="min-h-10 rounded-lg bg-amber-800 px-3 py-1.5 font-semibold text-white hover:bg-amber-900"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}
      {isAuthReady && isUserAuthenticated && effectiveUserEmail && !isWorkspaceReadyForCurrentUser &&
        workspaceLoadState === 'error' && !isShowingCachedWorkspace && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="workspace-load-title"
          aria-describedby="workspace-load-description"
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-4"
        >
          <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div aria-hidden="true" className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full bg-rose-100 text-xl font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">!</div>
            <h1 id="workspace-load-title" className="text-lg font-bold text-slate-900 dark:text-white">
              Não foi possível carregar seus dados
            </h1>
            <p id="workspace-load-description" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Não vamos abrir um workspace vazio nem gravar dados antes de carregar o Neon. Verifique a conexão e tente novamente.
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => setWorkspaceLoadAttempt((attempt) => attempt + 1)}
              className="mt-5 min-h-11 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Tentar novamente
            </button>
          </section>
        </div>
      )}
      <div
        className="contents"
        inert={Boolean(
          isAuthReady && isUserAuthenticated && effectiveUserEmail && !isWorkspaceReadyForCurrentUser
        )}
      >
      {financialIntegrity && !financialIntegrity.isAllHealthy && (
        <div role="status" className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
          <span>Alguns lançamentos precisam de revisão. Confira os dados antes de continuar.</span>
          <button type="button" className="font-semibold underline" onClick={() => handleSelectTab('transactions')}>Conferir lançamentos</button>
        </div>
      )}
      {workspaceConflict && !isWorkspaceConflictOpen && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-3 z-[70] w-[min(92vw,40rem)] -translate-x-1/2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 shadow-lg dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Há duas versões diferentes dos seus dados financeiros aguardando decisão.</span>
            <button
              type="button"
              onClick={() => setIsWorkspaceConflictOpen(true)}
              className="min-h-10 rounded-lg bg-amber-800 px-3 py-1.5 font-semibold text-white hover:bg-amber-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            >
              Resolver conflito
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Left Sidebar Navigation */}
      <SidebarNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileDrawerOpen={isMobileDrawerOpen}
        onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
        onOpenNewTransaction={handleOpenNewTransaction}
        onOpenSettings={() => {
          setSettingsInitialTab('appearance');
          setIsSettingsOpen(true);
        }}
        onOpenReminders={() => setIsReminderModalOpen(true)}
        urgentRemindersCount={noticeCount}
        pendingTransactionsCount={pendingTransactionsCount}
        budgetAlertsCount={budgetAlertsCount}
        pendingSharedCount={pendingSharedCount}
        activeTripsCount={activeTripsCount}
        accountsTotalBalance={accountsTotalBalance}
        investmentsTotalValue={investmentsTotalValue}
        cloudUserEmail={effectiveUserEmail}
        cloudSyncStatus={cloudSyncStatus}
        onSignOut={handleSignOut}
      />

      {/* Right Workspace Column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Single Unified, Clean Top Header Bar */}
        <header className="sticky top-0 z-30 w-full max-w-full bg-[color:var(--app-canvas)]/90 dark:bg-slate-950/90 backdrop-blur-md px-3.5 sm:px-6 py-2.5 pt-[max(env(safe-area-inset-top),0.625rem)]">
          <div className="mx-auto w-full max-w-7xl flex items-center justify-between gap-2 sm:gap-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-3 sm:px-4 py-2 shadow-sm">
            {/* Zone 1 (Left): Mobile Menu Trigger + Active Page Title */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1 md:flex-none md:shrink-0">
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(true)}
                aria-label="Abrir menu lateral"
                title="Abrir menu de navegação"
                className="lg:hidden inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors shrink-0"
              >
                <Menu className="h-4 w-4" />
              </button>

              <h1
                title={activeTabMeta.title}
                className="min-w-0 text-sm sm:text-base font-bold leading-tight tracking-tight text-slate-900 dark:text-white font-display truncate"
              >
                <span className="sm:hidden">{MOBILE_TAB_TITLES[activeTab] ?? activeTabMeta.title}</span>
                <span className="hidden sm:inline">{activeTabMeta.title}</span>
              </h1>
            </div>

            {/* Zone 2 (Center): Integrated Month Navigator (shown on competence-based tabs) */}
            {['overview', 'transactions', 'accounts', 'cards', 'budgets', 'shared', 'reports'].includes(
              activeTab
            ) && (
              <div className="hidden md:flex items-center justify-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    handleSelectMonth(addMonthsToYearMonth(selectedMonth, -1))
                  }
                  aria-label="Mês anterior"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="min-w-[150px] text-center px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-display tracking-tight">
                    {formatMonthYearPT(selectedMonth)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleSelectMonth(addMonthsToYearMonth(selectedMonth, 1))
                  }
                  aria-label="Próximo mês"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                {selectedMonth !== DEFAULT_MONTH && (
                  <button
                    type="button"
                    onClick={() => handleSelectMonth(DEFAULT_MONTH)}
                    title={`Voltar para o mês atual (${formatMonthYearPT(DEFAULT_MONTH)})`}
                    className="ml-1 inline-flex items-center rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 text-[11px] font-semibold text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors shrink-0"
                  >
                    Mês atual
                  </button>
                )}
              </div>
            )}

            {/* Zone 3 (Right): Compact Search + Essential Utilities + Primary CTA */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
              {/* Compact Expandable Search on Desktop */}
              <div
                data-testid="centered-global-search"
                className="hidden xl:block relative w-44 xl:w-56 focus-within:w-64 transition-all duration-200"
              >
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  ref={globalSearchInputRef}
                  type="text"
                  role="searchbox"
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  aria-label="Busca global por descrição, categoria ou nota"
                  placeholder="Buscar... (/)"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/80 pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-colors"
                />
                {globalSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setGlobalSearchQuery('')}
                    aria-label="Limpar busca global"
                    className="absolute right-2 top-1.5 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Mobile/Tablet Search Trigger */}
              <button
                type="button"
                data-testid="mobile-search-toggle-btn"
                onClick={() => {
                  setIsMobileSearchOpen((prev) => {
                    const next = !prev;
                    if (next) {
                      window.setTimeout(() => mobileSearchInputRef.current?.focus(), 60);
                    }
                    return next;
                  });
                }}
                aria-label="Buscar lançamentos"
                title="Buscar lançamentos"
                className={`xl:hidden rounded-lg border p-1.5 transition-colors ${
                  isMobileSearchOpen || globalSearchQuery
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Search className="h-4 w-4" />
              </button>

              {/* Essential Utilities Only (Privacy, Reminders, Settings, Logout) */}
              <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateSettings({ privacyMode: !settings.privacyMode })
                  }
                  aria-label={
                    settings.privacyMode
                      ? 'Mostrar saldos e valores monetários'
                      : 'Ocultar saldos e valores monetários (Modo Discreto)'
                  }
                  title={
                    settings.privacyMode
                      ? 'Mostrar valores (Modo Discreto ativo)'
                      : 'Ocultar valores R$ (Modo Discreto)'
                  }
                  className={`rounded-md p-1.5 transition-colors ${
                    settings.privacyMode
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {settings.privacyMode ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>

                <button
                  type="button"
                  data-testid="header-reminders-btn"
                  onClick={() => setIsReminderModalOpen(true)}
                  aria-label="Abrir notificações"
                  title={`Notificações: ${noticeCount} ${noticeCount === 1 ? 'aviso' : 'avisos'}`}
                  className={`relative rounded-md p-1.5 transition-colors ${
                    noticeCount > 0
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Bell className="h-4 w-4" />
                  {noticeCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-extrabold text-white shadow-2xs">
                      {noticeCount}
                    </span>
                  )}
                </button>



                <button
                  type="button"
                  onClick={() => {
                    setSettingsInitialTab('appearance');
                    setIsSettingsOpen(true);
                  }}
                  aria-label="Abrir configurações do aplicativo"
                  title="Configurações & Preferências"
                  className="rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>

              {/* Primary Action CTA */}
              <button
                type="button"
                data-testid="new-transaction-btn"
                onClick={() => handleOpenNewTransaction('expense')}
                aria-label="Novo lançamento"
                title="Criar novo lançamento"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 shadow-2xs"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden xl:inline">Novo Lançamento</span>
              </button>
            </div>
          </div>

          {/* Mobile Month Selector Strip (Only visible on small screens < md for competence tabs) */}
          {['overview', 'transactions', 'accounts', 'cards', 'budgets', 'shared', 'reports'].includes(
            activeTab
          ) && (
            <div className="flex md:hidden items-center justify-between gap-2 pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() =>
                  handleSelectMonth(addMonthsToYearMonth(selectedMonth, -1))
                }
                aria-label="Mês anterior"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1.5 text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white font-display">
                  {formatMonthYearPT(selectedMonth)}
                </span>
                {selectedMonth !== DEFAULT_MONTH && (
                  <button
                    type="button"
                    onClick={() => handleSelectMonth(DEFAULT_MONTH)}
                    className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                  >
                    Hoje
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  handleSelectMonth(addMonthsToYearMonth(selectedMonth, 1))
                }
                aria-label="Próximo mês"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1.5 text-slate-600 dark:text-slate-300"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Expandable Mobile/Tablet Search Input */}
          {(isMobileSearchOpen || globalSearchQuery.trim().length > 0) && (
            <div className="lg:hidden pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  ref={mobileSearchInputRef}
                  type="text"
                  role="searchbox"
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  aria-label="Busca global no celular"
                  placeholder="Buscar por descrição, categoria ou valor..."
                  className="w-full rounded-lg border border-emerald-500 bg-slate-50 pl-9 pr-8 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setGlobalSearchQuery('');
                    setIsMobileSearchOpen(false);
                  }}
                  aria-label="Fechar busca"
                  className="absolute right-2.5 top-2 rounded p-0.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Feedback Banner with 1-Click Undo ("↩ Desfazer Agora") */}
        {toastMessage && (
          <div className="mx-auto max-w-7xl w-full px-3.5 sm:px-6 pt-3 sm:pt-4 animate-expand-in">
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900 shadow-xs"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                {toastMessage}
              </span>
              <div className="flex items-center gap-2 ml-auto">
                {undoStack.length > 0 && (
                  <button
                    type="button"
                    data-testid="toast-undo-btn"
                    onClick={handleUndoLastTransactionChange}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-800 transition-colors shadow-2xs"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Desfazer Agora
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setToastMessage(null);
                  }}
                  className="text-emerald-700 hover:underline ml-2"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Startup OS Notification Permission Initialization Strip */}
        {browserPermissionState === 'default' &&
          showNotificationInitPrompt &&
          (settings.reminders?.enabled ?? true) && (
            <div
              data-testid="os-notification-init-banner"
              className="mx-auto max-w-7xl w-full px-3.5 sm:px-6 pt-3 animate-expand-in"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-2xs">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Alertas Financeiros no Sistema Operacional
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Receba avisos automáticos às{' '}
                      <span className="font-mono font-bold tabular-nums text-slate-800 dark:text-slate-200">
                        {settings.reminders?.preferredTime || '09:00'}
                      </span>{' '}
                      sobre faturas de cartão, boletos vencendo hoje e reembolsos pendentes.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <select
                    aria-label="Horário do alerta diário"
                    data-testid="os-notification-init-time-select"
                    value={settings.reminders?.preferredTime || '09:00'}
                    onChange={(e) =>
                      handleUpdateSettings({
                        reminders: {
                          ...(settings.reminders || DEFAULT_REMINDER_SETTINGS),
                          preferredTime: e.target.value,
                        },
                      })
                    }
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-200 focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="08:00">08:00</option>
                    <option value="09:00">09:00</option>
                    <option value="12:00">12:00</option>
                    <option value="18:00">18:00</option>
                    <option value="20:00">20:00</option>
                  </select>

                  <button
                    type="button"
                    data-testid="os-notification-init-activate-btn"
                    onClick={handleActivateOsNotificationsFromInit}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-2xs whitespace-nowrap"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    Ativar Alertas no Sistema
                  </button>

                  <button
                    type="button"
                    data-testid="os-notification-init-dismiss-btn"
                    onClick={handleDismissNotificationInitPrompt}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    Agora não
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Global Search Instant Results Panel */}
        {(isMobileSearchOpen || globalSearchQuery.trim().length > 0) && (
          <Suspense fallback={null}>
            <GlobalSearchPanel
              query={globalSearchQuery}
              onChangeQuery={setGlobalSearchQuery}
              onClearSearch={() => setGlobalSearchQuery('')}
              selectedMonth={selectedMonth}
              transactions={transactions}
              categories={categories}
              accounts={accounts}
              cards={cards}
              familyMembers={familyMembers}
              onToggleStatus={(id) => handleToggleTransactionStatus(id, 'single')}
              onEditTransaction={handleEditTransaction}
              onJumpToTransactionInLedger={handleJumpToTransactionInLedger}
            />
          </Suspense>
        )}

        {/* Main Content Container */}
        <main className="mx-auto w-full max-w-7xl min-w-0 overflow-x-hidden flex-1 px-3.5 sm:px-6 py-4 sm:py-6 pb-28 lg:pb-8">
          <FaceIdOfferBanner />
          {isLoadingData ? (
            activeTab === 'overview' ? (
              <DashboardSkeleton />
            ) : activeTab === 'transactions' ? (
              <TransactionsSkeleton />
            ) : activeTab === 'cards' ? (
              <CreditCardsSkeleton />
            ) : activeTab === 'budgets' ? (
              <BudgetsSkeleton />
            ) : activeTab === 'reports' ? (
              <ReportsSkeleton />
            ) : (
              <DashboardSkeleton />
            )
          ) : (
            <Suspense
              fallback={
                activeTab === 'transactions' ? (
                  <TransactionsSkeleton />
                ) : activeTab === 'cards' ? (
                  <CreditCardsSkeleton />
                ) : activeTab === 'budgets' ? (
                  <BudgetsSkeleton />
                ) : activeTab === 'reports' ? (
                  <ReportsSkeleton />
                ) : (
                  <DashboardSkeleton />
                )
              }
            >
              <>
              {activeTab === 'overview' && (
                <OverviewTab
                  selectedMonth={selectedMonth}
                  currentPosition={currentPosition}
                  recurringSuggestions={recurringSuggestions}
                  cashForecast={cashForecast}
                  onScheduleRecurring={handleScheduleRecurring}
                  onDismissRecurring={handleDismissRecurring}
                  userName={
                    settings.userName &&
                    settings.userName !== 'Você' &&
                    settings.userName !== 'Minha Conta'
                      ? settings.userName
                      : effectiveUserDisplayName || undefined
                  }
                  monthlySummary={monthlySummary}
                  accounts={accounts}
                  accountBalances={accountBalances}
                  cards={cards}
                  cardSummaries={cardSummaries}
                  categories={categories}
                  categoryBreakdown={categoryBreakdown}
                  transactions={transactions}
                  investments={investments}
                  showOverviewAlerts={settings.showOverviewAlerts}
                  alertsExpandedByDefault={settings.alertsExpandedByDefault}
                  viewClarityMode={settings.viewClarityMode || 'complete'}
                  onChangeClarityMode={(mode) =>
                    handleUpdateSettings({ viewClarityMode: mode })
                  }
                  onToggleStatus={(id) => handleToggleTransactionStatus(id, 'single')}
                  onToggleAccountInTotal={handleToggleAccountInTotal}
                  onOpenNewTransaction={(mode) => handleOpenNewTransaction(mode)}
                  onNavigateTab={handleSelectTab}
                  onNavigateToAccount={handleNavigateToAccount}
                  onNavigateToCard={handleNavigateToCard}
                />
              )}

              {activeTab === 'accounts' && (
                <AccountsTab
                  selectedMonth={selectedMonth}
                  accounts={accounts}
                  accountBalances={accountBalances}
                  categories={categories}
                  transactions={transactions}
                  trips={trips}
                  initialSelectedAccountId={initialSelectedAccountId}
                  autoOpenCreate={pendingCreateRequest === 'account' || pendingCreateRequest === 'international_account'}
                  autoOpenCreateType={pendingCreateRequest === 'international_account' ? 'international' : 'checking'}
                  onAutoOpenHandled={() => setPendingCreateRequest(null)}
                  onToggleAccountInTotal={handleToggleAccountInTotal}
                  onAddAccount={handleAddAccount}
                  onUpdateAccount={handleUpdateAccount}
                  onDeleteAccount={handleDeleteAccount}
                  onUpdateAccountInitialBalance={handleUpdateAccountInitialBalance}
                  onUpdateTrip={handleUpdateTrip}
                  onToggleTransactionStatus={(id) =>
                    handleToggleTransactionStatus(id, 'single')
                  }
                  onEditTransaction={handleEditTransaction}
                  onDuplicateTransaction={handleDuplicateTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onOpenNewTransaction={(mode) => handleOpenNewTransaction(mode)}
                  onOpenReconciliation={handleOpenReconciliation}
                />
              )}

              {activeTab === 'investments' && (
                <InvestmentsTab
                  getAuthToken={() => currentUser?.getIdToken() ?? Promise.resolve('')}
                  selectedMonth={selectedMonth}
                  assets={investments}
                  targetMap={investmentTargets}
                  accounts={accounts}
                  onRequestCreateAccount={() => handleRequestCreateFromTransaction('account')}
                  transactions={transactions}
                  monthlyLivingExpense={monthlySummary.expenseTotal}
                  onAddAsset={handleAddInvestmentAsset}
                  onUpdateAsset={handleUpdateInvestmentAsset}
                  onBatchUpdateAssets={handleBatchUpdateInvestmentAssets}
                  onDeleteAsset={handleDeleteInvestmentAsset}
                  onOperateAsset={handleOperateInvestmentAsset}
                  onRecordDividendIncome={handleRecordDividendIncome}
                  onUpdateTargetMap={(nextMap) => {
                    setInvestmentTargets(nextMap);
                    showNotice('Metas estratégicas de alocação salvas.');
                  }}
                />
              )}

              {activeTab === 'transactions' && (
                <TransactionsTab
                  selectedMonth={selectedMonth}
                  transactions={transactions}
                  accounts={accounts}
                  cards={cards}
                  categories={categories}
                  globalSearchQuery={globalSearchQuery}
                  onChangeGlobalSearchQuery={setGlobalSearchQuery}
                  requestedViewMode={requestedLedgerViewMode}
                  onConsumeRequestedViewMode={() => setRequestedLedgerViewMode(null)}
                  onToggleStatus={(id) => handleToggleTransactionStatus(id, 'single')}
                  onBatchSettleTransactions={handleBatchSettleTransactions}
                  onAnticipateInstallments={handleAnticipateInstallments}
                  onReverseAnticipation={handleReverseAnticipation}
                  onEditTransaction={handleEditTransaction}
                  onDuplicateTransaction={handleDuplicateTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onOpenNewTransaction={(mode) => handleOpenNewTransaction(mode)}
                  onOpenReconciliation={handleOpenReconciliation}
                />
              )}

              {activeTab === 'cards' && (
                <CreditCardsTab
                  selectedMonth={selectedMonth}
                  cards={cards}
                  cardSummaries={cardSummaries}
                  accounts={accounts}
                  categories={categories}
                  transactions={transactions}
                  initialSelectedCardId={initialSelectedCardId}
                  autoOpenCreate={pendingCreateRequest === 'card'}
                  onAutoOpenHandled={() => setPendingCreateRequest(null)}
                  onRequestCreateAccount={() => handleRequestCreateFromTransaction('account')}
                  onPayInvoice={handlePayCardInvoice}
                  onAnticipateInstallments={handleAnticipateInstallments}
                  onReverseAnticipation={handleReverseAnticipation}
                  onAddCard={handleAddCard}
                  onUpdateCard={handleUpdateCard}
                  onDeleteCard={handleDeleteCard}
                  onDeleteTransaction={handleDeleteTransaction}
                  onOpenNewCardExpense={() => handleOpenNewTransaction('credit_card')}
                  commitmentLimitPercent={settings.cardCommitmentLimitPercent}
                  commitmentWarnPercent={settings.cardCommitmentWarnPercent}
                  onOpenCommitmentSettings={() => {
                    setSettingsInitialTab('rules');
                    setIsSettingsOpen(true);
                  }}
                />
              )}

              {activeTab === 'shared' && (
                <SharedExpensesTab
                  selectedMonth={selectedMonth}
                  transactions={transactions}
                  familyMembers={familyMembers}
                  accounts={accounts}
                  onRequestCreateAccount={() => handleRequestCreateFromTransaction('account')}
                  cards={cards}
                  categories={categories}
                  userPixKey={settings.userPixKey}
                  onAddFamilyMember={handleAddFamilyMemberWithInvite}
                  onUpdateFamilyMember={handleUpdateFamilyMember}
                  onDeleteFamilyMember={handleDeleteFamilyMember}
                  onAcceptFamilyInvite={handleAcceptFamilyInvite}
                  onDeclineFamilyInvite={handleDeclineFamilyInvite}
                  onResendFamilyInvite={triggerCrossAccountInviteSync}
                  onSettleSharedTransaction={handleSettleSharedTransaction}
                  onSettleAllMemberInvoices={handleSettleAllMemberInvoices}
                  onReopenSharedTransaction={handleReopenSharedTransaction}
                  onOpenNewSharedTransaction={() => {
                    handleOpenNewTransaction('expense');
                  }}
                />
              )}

              {activeTab === 'trips' && (
                <TripsTab
                  getAuthToken={() => currentUser?.getIdToken() ?? Promise.resolve('')}
                  trips={trips}
                  transactions={transactions}
                  categories={categories}
                  accounts={accounts}
                  onRequestCreateAccount={handleRequestCreateFromTransaction}
                  familyMembers={familyMembers}
                  privacyMode={settings.privacyMode}
                  onAddTrip={handleAddTrip}
                  onUpdateTrip={handleUpdateTrip}
                  onDeleteTrip={handleDeleteTrip}
                  onAddExchangeLot={handleAddExchangeLot}
                  onDeleteExchangeLot={handleDeleteExchangeLot}
                  onRecordSettlement={handleRecordTripSettlement}
                  onOpenNewTripExpense={(tripId) =>
                    handleOpenNewTransaction('expense', tripId)
                  }
                  onEditTransaction={handleEditTransaction}
                  onDeleteTransaction={(id) => handleDeleteTransaction(id, false)}
                  onAddAccount={handleAddAccount}
                />
              )}

              {activeTab === 'budgets' && (
                <BudgetsTab
                  selectedMonth={selectedMonth}
                  categories={categories}
                  categoryBreakdown={categoryBreakdown}
                  transactions={transactions}
                  onUpdateCategoryBudget={handleUpdateCategoryBudget}
                  onAddCategory={handleAddCategory}
                  onUpdateCategory={handleUpdateCategory}
                  onDeleteCategory={handleDeleteCategory}
                />
              )}

              {activeTab === 'goals' && (
                <GoalsAndSimulatorTab
                  goals={goals}
                  investments={investments}
                  accounts={accounts}
                  onRequestCreateAccount={() => handleRequestCreateFromTransaction('account')}
                  onContributeGoal={handleContributeGoal}
                  onAddGoal={handleAddGoal}
                  onUpdateGoal={handleUpdateGoal}
                  onDeleteGoal={handleDeleteGoal}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsAndDataTab
                  selectedMonth={selectedMonth}
                  currentPosition={currentPosition}
                  accounts={accounts}
                  onRequestCreateAccount={() => handleRequestCreateFromTransaction('account')}
                  accountBalances={accountBalances}
                  cards={cards}
                  categories={categories}
                  transactions={transactions}
                  investments={investments}
                  userName={effectiveUserDisplayName || undefined}
                  userEmail={effectiveUserEmail || undefined}
                  onExportFullBackupJson={handleExportFullBackupJson}
                  onAddAccount={handleAddAccount}
                  onUpdateAccountInitialBalance={handleUpdateAccountInitialBalance}
                  onImportQuickCsvLines={handleImportQuickCsvLines}
                  onOpenReconciliation={handleOpenReconciliation}
                  onApplyHistoricalInstallmentTotals={handleApplyHistoricalInstallmentTotals}
                  onResetWorkspaceData={handleResetWorkspaceData}
                />
              )}

              {activeTab === 'cloud' && (
                <AuthAndCloudTab
                  userEmail={effectiveUserEmail}
                  userDisplayName={effectiveUserDisplayName}
                  isAnonymousUser={!isUserAuthenticated}
                  autoVaultId={autoVaultId}
                  cloudSyncStatus={cloudSyncStatus}
                  lastSyncedAt={lastSyncedAt}
                  settings={settings}
                  accounts={accounts}
                  cards={cards}
                  categories={categories}
                  transactions={transactions}
                  investments={investments}
                  goals={goals}
                  trips={trips}
                  onSignInEmail={handleSignInEmail}
                  onRegisterEmail={handleRegisterEmail}
                  onSignOut={handleSignOut}
                  onForceCloudSync={handleForceCloudSync}
                  onUpdateSettings={handleUpdateSettings}
                />
              )}
              </>
            </Suspense>
          )}
        </main>

        {/* Quiet Footer */}
        <footer className="hidden sm:block border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 mt-12">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Minhas Economias BR — Controle Financeiro Pessoal & Segurança na Nuvem
            </span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => handleSelectTab('reports')}
                className="hover:text-slate-900 dark:hover:text-white hover:underline transition-colors"
              >
                Backup & Exportação CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsInitialTab('profile');
                  setIsSettingsOpen(true);
                }}
                className="hover:text-slate-900 dark:hover:text-white hover:underline transition-colors"
              >
                Preferências & Perfil
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Native Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenNewTransaction={(mode) => handleOpenNewTransaction(mode)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        userEmail={effectiveUserEmail}
        onSignOut={handleSignOut}
      />

      <Suspense fallback={null}>
        {/* New / Edit Transaction Modal */}
        {isModalOpen && <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
          setModalInitialTripId(undefined);
          setModalInitialDate(undefined);
        }}
        onSaveBatch={handleSaveTransactionBatch}
        accounts={accounts}
        cards={cards}
        categories={categories}
        transactions={transactions}
        familyMembers={familyMembers}
        onAddFamilyMember={handleAddFamilyMember}
        investments={investments}
        trips={trips}
        selectedMonth={selectedMonth}
        editingTransaction={editingTransaction}
        defaultMode={modalDefaultMode}
        initialDate={modalInitialDate}
        initialTripId={modalInitialTripId}
        onRequestCreate={handleRequestCreateFromTransaction}
        budgetWarningPercent={settings.budgetWarningPercent}
        />}

        {/* Settings & Preferences Modal */}
        {isSettingsOpen && <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={settingsInitialTab}
        settings={settings}
        categories={categories}
        userEmail={effectiveUserEmail}
        isUserLoggedIn={isUserAuthenticated}
        onUpdateSettings={handleUpdateSettings}
        onAddCategory={handleAddCategory}
        onUpdateCategoryBudget={handleUpdateCategoryBudget}
        onDeleteCategory={handleDeleteCategory}
        onOpenCloudTab={() => handleSelectTab('cloud')}
        onSignOut={handleSignOut}
        onExportFullBackupJson={handleExportFullBackupJson}
        onImportFullBackupJson={handleImportFullBackupJson}
        onResetWorkspaceData={handleResetWorkspaceData}
        />}

        {/* Daily Reminders & Scheduled Notifications Modal */}
        {isReminderModalOpen && <ReminderCenterModal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        reminders={dailyReminders}
        familyInvites={incomingFamilyInvites}
        notices={appNotices}
        onNoticeAction={handleNoticeAction}
        onDismissNotice={handleDismissNotice}
        onAcceptFamilyInvite={handleAcceptFamilyInvite}
        onDeclineFamilyInvite={handleDeclineFamilyInvite}
        onPayCardInvoice={(cardId) => {
          handleNavigateToCard(cardId);
        }}
        onMarkTransactionPaid={handleMarkTransactionPaid}
        onOpenSettingsTab={(tab) => {
          setSettingsInitialTab(tab as any);
          setIsSettingsOpen(true);
        }}
        />}

        {/* Bank Reconciliation & Smart OFX/CSV Import Modal */}
        {isReconciliationModalOpen && <BankReconciliationModal
        isOpen={isReconciliationModalOpen}
        onClose={() => setIsReconciliationModalOpen(false)}
        accounts={accounts}
        cards={cards}
        categories={categories}
        existingTransactions={transactions}
        familyMembers={familyMembers}
        defaultAccountId={reconciliationTargetAccountId}
        onCommitImport={handleCommitReconciliationBatch}
        onAddAccount={handleAddAccount}
        />}

        {workspaceConflict && (
        <WorkspaceConflictModal
          conflict={workspaceConflict}
          isOpen={isWorkspaceConflictOpen}
          isSaving={isResolvingWorkspaceConflict}
          errorMessage={workspaceConflictError}
          onDismiss={() => {
            if (!isResolvingWorkspaceConflict) setIsWorkspaceConflictOpen(false);
          }}
          onKeepLocal={handleKeepLocalWorkspaceVersion}
          onUseCloud={handleUseCloudWorkspaceVersion}
        />
        )}
      </Suspense>
      </div>
    </div>
  );
}
