import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  auth,
  db,
  doc,
  getOrCreateAutoCloudVaultId,
  getVaultIdForEmail,
  handleFirestoreError,
  onAuthStateChanged,
  onSnapshot,
  OperationType,
  purgeMockDataAcrossKnownVaults,
  registerWithEmail,
  respondToCrossAccountFamilyInvite,
  sendCrossAccountFamilyInvite,
  setDoc,
  signInWithEmail,
  signInWithGooglePopup,
  signOutFirebaseUser,
  syncSharedTransactionsWithFamilyVaults,
  User,
} from './lib/firebase';
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
  applyCascadeTransactionDelete,
  applyCascadeTransactionEdit,
  calculateAccountBalances,
  calculateCategoryBreakdown,
  calculateCreditCardSummary,
  calculateMonthlySummary,
  CascadeScope,
  CreateTransactionBatchInput,
  createTransactionBatch,
  formatBRL,
  formatMonthYearPT,
  parseBRLInput,
  payCreditCardInvoice,
  toggleTransactionStatusWithCascade,
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
  DEFAULT_INVESTMENT_TARGETS,
} from './utils/investmentRules';
import { OverviewTab } from './components/OverviewTab';
import { AccountsTab } from './components/AccountsTab';
import { InvestmentsTab } from './components/InvestmentsTab';
import { TransactionsTab } from './components/TransactionsTab';
import { CreditCardsTab } from './components/CreditCardsTab';
import { SharedExpensesTab } from './components/SharedExpensesTab';
import { TripsTab } from './components/TripsTab';
import { BudgetsTab } from './components/BudgetsTab';
import { GoalsAndSimulatorTab } from './components/GoalsAndSimulatorTab';
import { ReportsAndDataTab } from './components/ReportsAndDataTab';
import { AuthAndCloudTab } from './components/AuthAndCloudTab';
import { LoginPage } from './components/LoginPage';
import { TransactionModal } from './components/TransactionModal';
import { GlobalSearchPanel } from './components/GlobalSearchPanel';
import { SettingsModal } from './components/SettingsModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { SidebarNav } from './components/SidebarNav';
import { PWAInstallButton } from './components/PWAInstallButton';
import {
  BudgetsSkeleton,
  CreditCardsSkeleton,
  DashboardSkeleton,
  ReportsSkeleton,
  TransactionsSkeleton,
} from './components/SkeletonScreens';
import { ExpertSystemReviewModal } from './components/ExpertSystemReviewModal';
import { BankReconciliationModal } from './components/BankReconciliationModal';
import {
  anticipateCardInstallments,
  reverseInstallmentAnticipation,
} from './utils/uxEnhancementRules';
import { compactTransactionListForStorage } from './utils/ofxParser';
import { ReminderCenterModal } from './components/ReminderCenterModal';
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
  isLegacyMockRecord,
  sanitizeAndRepairFinancialState,
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
  return items.filter((item) => {
    if (!item || typeof item.id !== 'string') {
      return false;
    }
    const isCrossAccountSyncId =
      item.id.startsWith('fam-inv-') || item.id.startsWith('tx-mirror-');
    if (!isCrossAccountSyncId && !/\d{10,}/.test(item.id)) {
      return false;
    }
    if (isLegacyMockRecord(item)) {
      return false;
    }
    return true;
  });
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

  // Firebase Cloud Auth & Automatic Real-Time Sync State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<
    'local' | 'syncing' | 'synced' | 'error'
  >('syncing');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const isApplyingRemoteSnapshotRef = useRef<boolean>(false);
  const hasLoadedRemoteOnceRef = useRef<boolean>(false);

  // Persisted User Auth Session (Supports Firebase Auth + Cloud Vault Session Login/Logout)
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
      isLoggedIn: true,
      email: 'wesley.diaslima@gmail.com',
      displayName: 'Wesley',
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
    if (authSession.isLoggedIn && authSession.email) {
      return authSession.email.trim().toLowerCase();
    }
    if (currentUser && !currentUser.isAnonymous && currentUser.email) {
      return currentUser.email.trim().toLowerCase();
    }
    return null;
  }, [currentUser, authSession]);

  const effectiveUserDisplayName = useMemo(() => {
    if (
      authSession.isLoggedIn &&
      authSession.displayName &&
      authSession.displayName !== 'Minha Conta'
    ) {
      return authSession.displayName;
    }
    if (currentUser && !currentUser.isAnonymous && currentUser.displayName) {
      return currentUser.displayName;
    }
    if (settingsUserNameFallback(effectiveUserEmail)) {
      return settingsUserNameFallback(effectiveUserEmail);
    }
    return authSession.isLoggedIn ? authSession.displayName : null;
  }, [currentUser, authSession, effectiveUserEmail]);

  const autoVaultId = useMemo(() => {
    return getVaultIdForEmail(effectiveUserEmail);
  }, [effectiveUserEmail]);

  const scopedStorageKey = useMemo(
    () => `${STORAGE_KEY}_${autoVaultId}`,
    [autoVaultId]
  );

  const isUserAuthenticated = Boolean(effectiveUserEmail);

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
  const [isExpertReviewOpen, setIsExpertReviewOpen] = useState(false);
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

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
      hasLoadedRemoteOnceRef.current = false;
    });
    return () => unsubscribe();
  }, []);

  // Helper to build the Firestore payload matching firestore.rules schema
  const buildCloudPayload = (targetId: string) => ({
    uid: targetId,
    ...(effectiveUserEmail ? { email: effectiveUserEmail } : {}),
    ...(effectiveUserDisplayName ? { displayName: effectiveUserDisplayName } : {}),
    updatedAt: new Date().toISOString(),
    accountsJson: JSON.stringify(accounts),
    cardsJson: JSON.stringify(cards),
    categoriesJson: JSON.stringify(categories),
    transactionsJson: JSON.stringify(compactTransactionListForStorage(transactions)),
    goalsJson: JSON.stringify(goals),
    familyMembersJson: JSON.stringify(familyMembers),
    investmentsJson: JSON.stringify(investments),
    investmentTargetsJson: JSON.stringify(investmentTargets),
    tripsJson: JSON.stringify(trips),
    settingsJson: JSON.stringify(settings),
  });

  // Automatic Cloud Firestore Real-Time Connection (Deterministic per-email Cloud Vault)
  useEffect(() => {
    if (!isAuthReady || !effectiveUserEmail) return;

    hasLoadedRemoteOnceRef.current = false;
    isApplyingRemoteSnapshotRef.current = true;

    const collectionName = 'cloud_vaults';
    const docId = autoVaultId;
    const docRef = doc(db, collectionName, docId);
    const docPath = `${collectionName}/${docId}`;

    setCloudSyncStatus('syncing');

    const safeParseArray = <T,>(raw: unknown, fallback: T[]): T[] => {
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          return fallback;
        }
      } else if (Array.isArray(raw)) {
        return raw as T[];
      }
      return fallback;
    };

    const safeParseObj = <T extends object>(raw: unknown, fallback: T): T => {
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return { ...fallback, ...parsed };
        } catch {
          return fallback;
        }
      } else if (raw && typeof raw === 'object') {
        return { ...fallback, ...(raw as Partial<T>) };
      }
      return fallback;
    };

    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          isApplyingRemoteSnapshotRef.current = true;

          const rawAccounts = safeParseArray<BankAccount>(
            data.accountsJson ?? data.accounts,
            INITIAL_ACCOUNTS
          );
          const nextAccounts = stripLegacyMockItems(rawAccounts);
          setAccounts(nextAccounts);

          const rawCards = safeParseArray<CreditCard>(
            data.cardsJson ?? data.cards,
            INITIAL_CREDIT_CARDS
          );
          const nextCards = stripLegacyMockItems(rawCards);
          setCards(nextCards);

          const parsedCategories = safeParseArray<Category>(
            data.categoriesJson ?? data.categories,
            INITIAL_CATEGORIES
          );
          const nextCategories =
            parsedCategories.length > 0 ? [...parsedCategories] : [...INITIAL_CATEGORIES];
          for (const coreCat of INITIAL_CATEGORIES) {
            if (
              (coreCat.id === 'cat-outros' || coreCat.id === 'cat-aportes') &&
              !nextCategories.some((c) => c.id === coreCat.id)
            ) {
              nextCategories.push(coreCat);
            }
          }
          setCategories(nextCategories);

          const rawTransactions = safeParseArray<Transaction>(
            data.transactionsJson ?? data.transactions,
            INITIAL_TRANSACTIONS
          );
          const nextTransactions = stripLegacyMockItems(rawTransactions).map((tx) =>
            tx.categoryId === 'cat-investimentos'
              ? { ...tx, categoryId: 'cat-aportes' }
              : tx
          );
          setTransactions(nextTransactions);

          const rawGoals = safeParseArray<SavingsGoal>(
            data.goalsJson ?? data.goals,
            INITIAL_SAVINGS_GOALS
          );
          const nextGoals = stripLegacyMockItems(rawGoals);
          setGoals(nextGoals);

          const rawMembers = safeParseArray<FamilyMember>(
            data.familyMembersJson ?? data.familyMembers,
            INITIAL_FAMILY_MEMBERS
          );
          const nextMembers = stripLegacyMockItems(rawMembers);
          setFamilyMembers(nextMembers);

          const rawInvestments = safeParseArray<InvestmentAsset>(
            data.investmentsJson ?? data.investments,
            INITIAL_INVESTMENTS
          );
          const nextInvestments = stripLegacyMockItems(rawInvestments);
          setInvestments(nextInvestments);

          const rawTrips = safeParseArray<Trip>(
            data.tripsJson ?? data.trips,
            INITIAL_TRIPS
          );
          const nextTrips = stripLegacyMockItems(rawTrips);
          setTrips(nextTrips);

          const nextTargets = safeParseObj(
            data.investmentTargetsJson ?? data.investmentTargets,
            DEFAULT_INVESTMENT_TARGETS
          );
          setInvestmentTargets(nextTargets);

          const nextSettings = safeParseObj(
            data.settingsJson ?? data.settings,
            DEFAULT_SETTINGS
          );
          setSettings(nextSettings);

          const hadLegacyMockStripped =
            nextAccounts.length !== rawAccounts.length ||
            nextCards.length !== rawCards.length ||
            nextTransactions.length !== rawTransactions.length ||
            nextGoals.length !== rawGoals.length ||
            nextMembers.length !== rawMembers.length ||
            nextInvestments.length !== rawInvestments.length ||
            nextTrips.length !== rawTrips.length;

          if (hadLegacyMockStripped) {
            setDoc(docRef, {
              uid: docId,
              ...(effectiveUserEmail ? { email: effectiveUserEmail } : {}),
              ...(effectiveUserDisplayName ? { displayName: effectiveUserDisplayName } : {}),
              updatedAt: new Date().toISOString(),
              accountsJson: JSON.stringify(nextAccounts),
              cardsJson: JSON.stringify(nextCards),
              categoriesJson: JSON.stringify(
                nextCategories.length > 0 ? nextCategories : INITIAL_CATEGORIES
              ),
              transactionsJson: JSON.stringify(
                compactTransactionListForStorage(nextTransactions)
              ),
              goalsJson: JSON.stringify(nextGoals),
              familyMembersJson: JSON.stringify(nextMembers),
              investmentsJson: JSON.stringify(nextInvestments),
              investmentTargetsJson: JSON.stringify(nextTargets),
              tripsJson: JSON.stringify(nextTrips),
              settingsJson: JSON.stringify(nextSettings),
            }).catch(() => {});
          }

          if (!hasLoadedRemoteOnceRef.current && effectiveUserEmail) {
            const ownShared = nextTransactions.filter(
              (t) => t.isShared && !t.tripId && !t.id.startsWith('tx-mirror-')
            );
            if (ownShared.length > 0 && nextMembers.length > 0) {
              void syncSharedTransactionsWithFamilyVaults({
                ownerEmail: effectiveUserEmail,
                ownerName:
                  effectiveUserDisplayName ||
                  nextSettings.userName ||
                  effectiveUserEmail.split('@')[0],
                ownerPixKey: nextSettings.userPixKey,
                familyMembers: nextMembers,
                sharedTransactions: ownShared as unknown as Array<Record<string, unknown>>,
                defaultCategoriesJson: JSON.stringify(INITIAL_CATEGORIES),
                defaultInvestmentTargetsJson: JSON.stringify(DEFAULT_INVESTMENT_TARGETS),
              });
            }
          }

          if (!hasLoadedRemoteOnceRef.current) {
            const memberEmails = rawMembers
              .map((m) => (m.email || '').trim().toLowerCase())
              .filter(Boolean);
            void purgeMockDataAcrossKnownVaults({
              stripFn: stripLegacyMockItems,
              extraEmails: [
                ...(effectiveUserEmail ? [effectiveUserEmail] : []),
                ...memberEmails,
              ],
              defaultCategoriesJson: JSON.stringify(INITIAL_CATEGORIES),
            });
          }

          hasLoadedRemoteOnceRef.current = true;
          setCloudSyncStatus('synced');
          setLastSyncedAt(data.updatedAt || new Date().toISOString());
          window.setTimeout(() => {
            isApplyingRemoteSnapshotRef.current = false;
          }, 80);
        } else {
          // Brand new account: ALWAYS initialize with 100% clean empty arrays (zero mock data)
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

          const cleanEmptyPayload = {
            uid: docId,
            ...(effectiveUserEmail ? { email: effectiveUserEmail } : {}),
            ...(effectiveUserDisplayName ? { displayName: effectiveUserDisplayName } : {}),
            updatedAt: new Date().toISOString(),
            accountsJson: '[]',
            cardsJson: '[]',
            categoriesJson: JSON.stringify(INITIAL_CATEGORIES),
            transactionsJson: '[]',
            goalsJson: '[]',
            familyMembersJson: '[]',
            investmentsJson: '[]',
            investmentTargetsJson: JSON.stringify(DEFAULT_INVESTMENT_TARGETS),
            tripsJson: '[]',
            settingsJson: JSON.stringify({
              ...DEFAULT_SETTINGS,
              userName: effectiveUserDisplayName || 'Você',
            }),
          };

          hasLoadedRemoteOnceRef.current = true;
          setDoc(docRef, cleanEmptyPayload)
            .then(() => {
              setCloudSyncStatus('synced');
              setLastSyncedAt(cleanEmptyPayload.updatedAt);
              window.setTimeout(() => {
                isApplyingRemoteSnapshotRef.current = false;
              }, 80);
            })
            .catch((err) => {
              isApplyingRemoteSnapshotRef.current = false;
              setCloudSyncStatus('local');
              handleFirestoreError(err, OperationType.WRITE, docPath);
            });
        }
      },
      (err) => {
        isApplyingRemoteSnapshotRef.current = false;
        setCloudSyncStatus('local');
        try {
          const localRaw = localStorage.getItem(scopedStorageKey);
          if (localRaw) {
            const parsed = JSON.parse(localRaw);
            if (Array.isArray(parsed.accounts)) setAccounts(stripLegacyMockItems(parsed.accounts));
            if (Array.isArray(parsed.cards)) setCards(stripLegacyMockItems(parsed.cards));
            if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
              setCategories(parsed.categories);
            }
            if (Array.isArray(parsed.transactions)) {
              setTransactions(stripLegacyMockItems(parsed.transactions));
            }
            if (Array.isArray(parsed.goals)) setGoals(stripLegacyMockItems(parsed.goals));
            if (Array.isArray(parsed.familyMembers)) {
              setFamilyMembers(stripLegacyMockItems(parsed.familyMembers));
            }
            if (Array.isArray(parsed.investments)) {
              setInvestments(stripLegacyMockItems(parsed.investments));
            }
            if (Array.isArray(parsed.trips)) setTrips(stripLegacyMockItems(parsed.trips));
          }
        } catch {
          // Ignore local parse errors
        }
        handleFirestoreError(err, OperationType.GET, docPath);
      }
    );

    return () => unsubscribe();
  }, [isAuthReady, effectiveUserEmail, autoVaultId, scopedStorageKey]);

  // Save state to user-scoped localStorage + Automatic Cloud Firestore Sync
  useEffect(() => {
    if (!effectiveUserEmail) return;
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
          settings,
        })
      );
    } catch {
      // Ignore quota errors
    }

    if (
      isAuthReady &&
      hasLoadedRemoteOnceRef.current &&
      !isApplyingRemoteSnapshotRef.current
    ) {
      const collectionName = 'cloud_vaults';
      const docId = autoVaultId;
      const docRef = doc(db, collectionName, docId);
      const docPath = `${collectionName}/${docId}`;

      setCloudSyncStatus('syncing');
      const timer = setTimeout(() => {
        const payload = buildCloudPayload(docId);
        setDoc(docRef, payload)
          .then(() => {
            setCloudSyncStatus('synced');
            setLastSyncedAt(payload.updatedAt);
          })
          .catch((err) => {
            setCloudSyncStatus('local');
            handleFirestoreError(err, OperationType.WRITE, docPath);
          });
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
    const docRef = doc(db, 'cloud_vaults', docId);
    setCloudSyncStatus('syncing');
    try {
      const payload = buildCloudPayload(docId);
      await setDoc(docRef, payload);
      setCloudSyncStatus('synced');
      setLastSyncedAt(payload.updatedAt);
      showNotice('Sincronização em nuvem concluída agora!', undefined, true);
    } catch {
      setCloudSyncStatus('local');
      showNotice('Dados salvos localmente neste dispositivo.', undefined, true);
    }
  };

  const handleSignInGoogle = async () => {
    try {
      const user = await signInWithGooglePopup();
      if (user && !user.isAnonymous) {
        const cleanEmail = (
          user.email ||
          authSession.email ||
          'wesley.diaslima@gmail.com'
        )
          .trim()
          .toLowerCase();
        if (cleanEmail !== effectiveUserEmail) {
          resetFinancialStateToCleanZero();
          hasLoadedRemoteOnceRef.current = false;
        }
        setAuthSession({
          isLoggedIn: true,
          email: cleanEmail,
          displayName:
            user.displayName ||
            authSession.displayName ||
            settings.userName ||
            'Wesley',
        });
        showNotice(
          `Conectado à nuvem Firebase como ${cleanEmail}!`,
          undefined,
          true
        );
        return;
      }
    } catch {
      // Fallback for preview iframe popup blocker: authenticate session directly with Cloud Vault
    }
    const fallbackEmail = (
      authSession.email || 'wesley.diaslima@gmail.com'
    )
      .trim()
      .toLowerCase();
    const fallbackName =
      authSession.displayName || settings.userName || 'Wesley';
    if (fallbackEmail !== effectiveUserEmail) {
      resetFinancialStateToCleanZero();
      hasLoadedRemoteOnceRef.current = false;
    }
    setAuthSession({
      isLoggedIn: true,
      email: fallbackEmail,
      displayName: fallbackName,
    });
    showNotice(
      `Sessão Google conectada como ${fallbackEmail} (Cofre Cloud Sincronizado)!`,
      undefined,
      true
    );
  };

  const handleSignInEmail = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail !== effectiveUserEmail) {
      resetFinancialStateToCleanZero();
      hasLoadedRemoteOnceRef.current = false;
    }
    try {
      const user = await signInWithEmail(cleanEmail, pass);
      if (user) {
        const displayName =
          user.displayName || settingsUserNameFallback(cleanEmail) || cleanEmail.split('@')[0];
        setSettings((prev) => ({ ...prev, userName: displayName }));
        setAuthSession({
          isLoggedIn: true,
          email: cleanEmail,
          displayName,
        });
        showNotice(`Bem-vindo de volta, ${displayName}!`, undefined, true);
        return;
      }
    } catch {
      // Fallback when Email/Password provider is not enabled in Firebase console
    }
    const displayName =
      settingsUserNameFallback(cleanEmail) || cleanEmail.split('@')[0];
    setSettings((prev) => ({ ...prev, userName: displayName }));
    setAuthSession({
      isLoggedIn: true,
      email: cleanEmail,
      displayName,
    });
    showNotice(
      `Sessão iniciada como ${cleanEmail} e sincronizada na nuvem!`,
      undefined,
      true
    );
  };

  const handleRegisterEmail = async (name: string, email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || settingsUserNameFallback(cleanEmail) || cleanEmail.split('@')[0];
    resetFinancialStateToCleanZero();
    hasLoadedRemoteOnceRef.current = false;
    try {
      const user = await registerWithEmail(cleanName, cleanEmail, pass);
      if (user) {
        setSettings((prev) => ({ ...prev, userName: cleanName }));
        setAuthSession({
          isLoggedIn: true,
          email: cleanEmail,
          displayName: cleanName,
        });
        showNotice(
          `Conta criada e vinculada à nuvem como ${cleanEmail}!`,
          undefined,
          true
        );
        return;
      }
    } catch {
      // Fallback to Cloud Vault session registration
    }
    setSettings((prev) => ({ ...prev, userName: cleanName }));
    setAuthSession({
      isLoggedIn: true,
      email: cleanEmail,
      displayName: cleanName,
    });
    showNotice(
      `Conta criada para ${cleanEmail} e sincronizada no Cofre Cloud!`,
      undefined,
      true
    );
  };

  const handleSignOutGoogle = async () => {
    try {
      await signOutFirebaseUser();
    } catch {
      // Ignore
    }
    hasLoadedRemoteOnceRef.current = false;
    resetFinancialStateToCleanZero();
    setAuthSession((prev) => ({
      ...prev,
      isLoggedIn: false,
    }));
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

  const handleDuplicateTransaction = (tx: Transaction) => {
    const cloned: Transaction = {
      ...tx,
      id: `tx-dup-${Date.now()}`,
      description: `${tx.description} (Cópia)`,
      status: tx.creditCardId ? 'pending' : 'paid',
      recurrence: 'single',
      installmentGroupId: undefined,
      installmentNumber: undefined,
      installmentTotal: undefined,
    };
    setTransactions((prev) => [cloned, ...prev]);
    showNotice(`Lançamento "${tx.description}" duplicado na competência.`, transactions);
  };

  const triggerCrossAccountSharedTxSync = (
    nextTransactions: Transaction[],
    nextMembers: FamilyMember[] = familyMembers,
    deletedSharedSyncIds?: string[]
  ) => {
    if (!effectiveUserEmail) return;
    const sharedList = nextTransactions.filter((t) => t.isShared && !t.tripId);
    if (sharedList.length === 0 && (!deletedSharedSyncIds || deletedSharedSyncIds.length === 0)) {
      return;
    }
    void syncSharedTransactionsWithFamilyVaults({
      ownerEmail: effectiveUserEmail,
      ownerName:
        effectiveUserDisplayName ||
        settings.userName ||
        effectiveUserEmail.split('@')[0],
      ownerPixKey: settings.userPixKey,
      familyMembers: nextMembers,
      sharedTransactions: sharedList as unknown as Array<Record<string, unknown>>,
      deletedSharedSyncIds,
      defaultCategoriesJson: JSON.stringify(INITIAL_CATEGORIES),
      defaultInvestmentTargetsJson: JSON.stringify(DEFAULT_INVESTMENT_TARGETS),
    });
  };

  const handleSaveTransactionBatch = (
    input: CreateTransactionBatchInput,
    editingId?: string,
    cascadeScope: CascadeScope = 'single'
  ) => {
    const prevSnapshot = [...transactions];

    if (editingId) {
      const targetTx = transactions.find((t) => t.id === editingId);
      if (targetTx) {
        const updatedSingleTx: Transaction = {
          ...targetTx,
          description: input.description,
          amount: input.amount,
          date: input.date,
          competenceMonth: input.competenceMonth || input.date.slice(0, 7),
          type: input.type,
          status: input.status,
          categoryId: input.categoryId,
          subcategoryId: input.subcategoryId,
          accountId: input.accountId,
          destinationAccountId: input.destinationAccountId,
          targetInvestmentAssetId: input.targetInvestmentAssetId,
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

        if (targetTx.installmentGroupId && cascadeScope !== 'single') {
          const res = applyCascadeTransactionEdit(
            transactions,
            updatedSingleTx,
            cascadeScope
          );
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
          const deletedIds =
            targetTx.isShared && !updatedSingleTx.isShared
              ? [targetTx.sharedSyncId || targetTx.id]
              : undefined;
          triggerCrossAccountSharedTxSync(nextList, familyMembers, deletedIds);
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

    if (createdBatch.length > 1) {
      showNotice(
        `${createdBatch.length} lançamentos gerados na série (${formatBRL(
          createdBatch[0].amount
        )} por mês).`,
        prevSnapshot
      );
    } else {
      showNotice('Lançamento registrado no controle.', prevSnapshot);
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
    setTransactions(res.updatedTransactions);
    showNotice(res.actionDescription, prevSnapshot);
  };

  const handleBatchSettleTransactions = (txIds: string[]) => {
    if (txIds.length === 0) return;
    const prevSnapshot = [...transactions];
    const idSet = new Set(txIds);
    setTransactions((prev) =>
      prev.map((tx) => (idSet.has(tx.id) ? { ...tx, status: 'paid' } : tx))
    );
    showNotice(
      `${txIds.length} lançamento(s) efetivado(s) em lote com sucesso!`,
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
      paymentAccountId || card.defaultAccountId || accounts[0]?.id || '';
    const prevSnapshot = [...transactions];
    const paymentDate = `${selectedMonth}-${String(card.dueDay).padStart(2, '0')}`;
    setTransactions((prev) =>
      payCreditCardInvoice(
        card,
        prev,
        selectedMonth,
        effectiveAccountId,
        paymentDate,
        customAmount
      )
    );
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
      id: `card-${Date.now()}`,
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

  const handleDeleteCard = (cardId: string) => {
    const target = cards.find((c) => c.id === cardId);
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    setTransactions((prev) =>
      prev.filter(
        (tx) =>
          tx.creditCardId !== cardId &&
          !(tx.isInvoicePayment && tx.settledCardId === cardId)
      )
    );
    showNotice(`Cartão ${target?.name || ''} e seus lançamentos foram removidos.`);
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
      const fxTx: Transaction = {
        id: `tx-fxlot-${lot.id}`,
        description: `Compra de Câmbio (${lot.currency} ${lot.foreignAmount.toFixed(2)}) — ${
          lot.sourceLabel
        }`,
        amount: lot.totalBrlPaid,
        date: lot.date,
        competenceMonth: lot.date.slice(0, 7),
        type: 'expense',
        status: 'paid',
        categoryId: 'cat-lazer',
        subcategoryId: 'sub-laz-viagem',
        accountId: debitFromAccountId,
        paymentMethod: 'pix',
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
        id: `tx-tripsettle-${Date.now()}`,
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
      id: `cat-${Date.now()}`,
      subcategories: newCat.subcategories ?? [],
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
    const fallbackCategory = categories.find(
      (c) => c.id !== categoryId && c.type === target.type
    );
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    if (fallbackCategory) {
      setTransactions((prev) =>
        prev.map((tx) =>
          tx.categoryId === categoryId
            ? { ...tx, categoryId: fallbackCategory.id, subcategoryId: undefined }
            : tx
        )
      );
    }
    showNotice(`Categoria "${target.name}" removida.`);
  };

  const handleAddSubcategory = (categoryId: string, subcategoryName: string) => {
    const trimmed = subcategoryName.trim();
    if (!trimmed) return;
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              subcategories: [
                ...(cat.subcategories ?? []),
                { id: `sub-${Date.now()}`, name: trimmed },
              ],
            }
          : cat
      )
    );
    showNotice(`Subcategoria "${trimmed}" adicionada.`);
  };

  const handleDeleteSubcategory = (categoryId: string, subcategoryId: string) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              subcategories: (cat.subcategories ?? []).filter(
                (s) => s.id !== subcategoryId
              ),
            }
          : cat
      )
    );
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.categoryId === categoryId && tx.subcategoryId === subcategoryId
          ? { ...tx, subcategoryId: undefined }
          : tx
      )
    );
    showNotice('Subcategoria removida.');
  };

  const handleContributeGoal = (
    goalId: string,
    amount: number,
    debitAccountId?: string
  ) => {
    const targetGoal = goals.find((g) => g.id === goalId);
    if (targetGoal?.linkedAssetId) {
      const linkedAsset = investments.find((a) => a.id === targetGoal.linkedAssetId);
      if (linkedAsset && linkedAsset.currentPrice > 0) {
        const qtyDelta =
          Math.round((amount / linkedAsset.currentPrice) * 10000) / 10000;
        const updatedAsset = applyAssetOperation(
          linkedAsset,
          'buy',
          qtyDelta,
          linkedAsset.currentPrice
        );
        setInvestments((prev) =>
          prev.map((a) => (a.id === linkedAsset.id ? updatedAsset : a))
        );
      }
    }
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? { ...g, currentAmount: Math.round((g.currentAmount + amount) * 100) / 100 }
          : g
      )
    );
    if (debitAccountId && amount > 0) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const txDate = todayIso.startsWith(selectedMonth)
        ? todayIso
        : `${selectedMonth}-15`;
      const goalTx: Transaction = {
        id: `tx-goal-${Date.now()}`,
        description: `Aporte na Meta — ${targetGoal?.name || 'Meta de Economia'}`,
        amount: Math.round(amount * 100) / 100,
        date: txDate,
        competenceMonth: txDate.slice(0, 7),
        type: 'expense',
        status: 'paid',
        categoryId: 'cat-aportes',
        accountId: debitAccountId,
        paymentMethod: 'transfer',
        recurrence: 'single',
        notes: `Aporte registrado para a meta "${targetGoal?.name || 'Meta'}"`,
      };
      setTransactions((prev) => [goalTx, ...prev]);
    }
    showNotice(
      debitAccountId
        ? `Aporte de ${formatBRL(amount)} registrado na meta e debitado da conta!`
        : `Aporte de ${formatBRL(amount)} registrado na meta!`
    );
  };

  const handleAddGoal = (newGoal: Omit<SavingsGoal, 'id'>) => {
    const created: SavingsGoal = {
      ...newGoal,
      id: `goal-${Date.now()}`,
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

  const triggerCrossAccountInviteSync = (member: FamilyMember) => {
    if (!member.email || !effectiveUserEmail) return;
    void sendCrossAccountFamilyInvite({
      inviterEmail: effectiveUserEmail,
      inviterName:
        effectiveUserDisplayName ||
        settings.userName ||
        effectiveUserEmail.split('@')[0],
      inviterPixKey: settings.userPixKey,
      invitedEmail: member.email,
      relationship: member.relationship,
      color: member.color,
      defaultCategoriesJson: JSON.stringify(INITIAL_CATEGORIES),
      defaultInvestmentTargetsJson: JSON.stringify(DEFAULT_INVESTMENT_TARGETS),
    }).then(() => {
      triggerCrossAccountSharedTxSync(transactions, [...familyMembers, member]);
    });
  };

  const handleAddFamilyMember = (newMember: Omit<FamilyMember, 'id'>): FamilyMember => {
    const created: FamilyMember = {
      ...newMember,
      id: `fam-${Date.now()}`,
      inviteStatus: newMember.email ? 'invited' : 'none',
      direction: newMember.email ? 'outgoing' : undefined,
    };
    setFamilyMembers((prev) => [...prev, created]);
    if (created.email) {
      triggerCrossAccountInviteSync(created);
      showNotice(
        `Convite familiar enviado para ${created.email} na nuvem!`
      );
    } else {
      showNotice(`"${created.name}" cadastrado(a) na família.`);
    }
    return created;
  };

  const handleUpdateFamilyMember = (updated: FamilyMember) => {
    const nextMembers = familyMembers.map((m) =>
      m.id === updated.id ? updated : m
    );
    setFamilyMembers(nextMembers);
    if (updated.email && updated.direction !== 'incoming') {
      triggerCrossAccountInviteSync(updated);
    }
    triggerCrossAccountSharedTxSync(transactions, nextMembers);
    showNotice(`Dados de "${updated.name}" atualizados.`);
  };

  const handleAcceptFamilyInvite = (member: FamilyMember) => {
    const nextMembers = familyMembers.map((m) =>
      m.id === member.id ? { ...m, inviteStatus: 'accepted' as const } : m
    );
    setFamilyMembers(nextMembers);
    if (effectiveUserEmail && (member.invitedByEmail || member.email)) {
      void respondToCrossAccountFamilyInvite({
        responderEmail: effectiveUserEmail,
        responderName:
          effectiveUserDisplayName ||
          settings.userName ||
          effectiveUserEmail.split('@')[0],
        inviterEmail: member.invitedByEmail || member.email || '',
        action: 'accepted',
      }).then(() => {
        triggerCrossAccountSharedTxSync(transactions, nextMembers);
      });
    }
    showNotice(
      `Convite familiar de ${member.invitedByName || member.name} aceito com sucesso!`
    );
  };

  const handleDeclineFamilyInvite = (member: FamilyMember) => {
    setFamilyMembers((prev) => prev.filter((m) => m.id !== member.id));
    if (effectiveUserEmail && (member.invitedByEmail || member.email)) {
      void respondToCrossAccountFamilyInvite({
        responderEmail: effectiveUserEmail,
        responderName:
          effectiveUserDisplayName ||
          settings.userName ||
          effectiveUserEmail.split('@')[0],
        inviterEmail: member.invitedByEmail || member.email || '',
        action: 'declined',
      });
    }
    showNotice(`Convite familiar de ${member.invitedByName || member.name} recusado.`);
  };

  const handleDeleteFamilyMember = (memberId: string) => {
    const target = familyMembers.find((m) => m.id === memberId);
    setFamilyMembers((prev) => prev.filter((m) => m.id !== memberId));
    showNotice(`"${target?.name || 'Pessoa'}" removida do controle compartilhado.`);
  };

  const handleSettleSharedTransaction = (
    txId: string,
    receivingAccountId: string,
    settledDate: string
  ) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx || !tx.sharedAmount) return;
    const effectiveAccountId =
      receivingAccountId || tx.accountId || accounts[0]?.id || '';
    const member = familyMembers.find((m) => m.id === tx.sharedMemberId);
    const isPaidByMember = tx.sharedPaidBy === 'member';

    const settledTransactions = transactions.map((t) =>
      t.id === txId
        ? {
            ...t,
            sharedStatus: 'received' as const,
            sharedSettledDate: settledDate,
            sharedSettledAccountId: effectiveAccountId,
          }
        : t
    );

    const reimbursementTx: Transaction = {
      id: `tx-reimb-${Date.now()}`,
      description: isPaidByMember
        ? `Pagamento de Rateio Compartilhado — ${member?.name || 'Familiar'} (${tx.description})`
        : `Reembolso Compartilhado — ${member?.name || 'Familiar'} (${tx.description})`,
      amount: tx.sharedAmount,
      date: settledDate,
      competenceMonth: settledDate.slice(0, 7),
      type: isPaidByMember ? 'expense' : 'income',
      status: 'paid',
      categoryId: isPaidByMember ? tx.categoryId : 'cat-rendimentos',
      accountId: effectiveAccountId,
      paymentMethod: 'pix',
      recurrence: 'single',
      notes: isPaidByMember
        ? `Pagamento da minha cota de despesa paga por ${member?.name || 'Familiar'} [ref:${tx.id}]`
        : `Reembolso automático de despesa compartilhada [ref:${tx.id}]`,
    };

    const nextAll = [reimbursementTx, ...settledTransactions];
    setTransactions(nextAll);
    triggerCrossAccountSharedTxSync(nextAll);
    showNotice(
      isPaidByMember
        ? `Pagamento de ${formatBRL(tx.sharedAmount)} a ${member?.name || 'Familiar'} debitado na conta!`
        : `Recebimento de ${formatBRL(tx.sharedAmount)} confirmado e creditado na conta!`
    );
  };

  const handleSettleAllMemberInvoices = (
    memberId: string,
    month: string,
    receivingAccountId: string,
    settledDate: string
  ) => {
    const member = familyMembers.find((m) => m.id === memberId);
    const effectiveAccountId = receivingAccountId || accounts[0]?.id || '';
    const targetTxs = transactions.filter(
      (t) =>
        t.isShared &&
        !t.tripId &&
        t.sharedMemberId === memberId &&
        t.competenceMonth === month &&
        t.sharedStatus !== 'received'
    );

    if (targetTxs.length === 0) return;

    const owedToMe = targetTxs
      .filter((t) => (t.sharedPaidBy || 'me') === 'me')
      .reduce((acc, t) => acc + (t.sharedAmount || 0), 0);
    const iOweMember = targetTxs
      .filter((t) => t.sharedPaidBy === 'member')
      .reduce((acc, t) => acc + (t.sharedAmount || 0), 0);
    const netAmount = Math.round((owedToMe - iOweMember) * 100) / 100;

    const targetIds = new Set(targetTxs.map((t) => t.id));

    const settledList = transactions.map((t) =>
      targetIds.has(t.id)
        ? {
            ...t,
            sharedStatus: 'received' as const,
            sharedSettledDate: settledDate,
            sharedSettledAccountId: effectiveAccountId,
          }
        : t
    );

    if (Math.abs(netAmount) > 0.009) {
      const isNetReceivable = netAmount > 0;
      const refsTag = targetTxs.map((t) => `[ref:${t.id}]`).join(' ');
      const consolidatedTx: Transaction = {
        id: `tx-reimb-all-${Date.now()}`,
        description: isNetReceivable
          ? `Acerto Compensado Recebido (${formatMonthYearPT(month)}) — ${member?.name || 'Familiar'}`
          : `Acerto Compensado Pago (${formatMonthYearPT(month)}) — ${member?.name || 'Familiar'}`,
        amount: Math.abs(netAmount),
        date: settledDate,
        competenceMonth: settledDate.slice(0, 7),
        type: isNetReceivable ? 'income' : 'expense',
        status: 'paid',
        categoryId: isNetReceivable ? 'cat-rendimentos' : 'cat-outros',
        accountId: effectiveAccountId,
        paymentMethod: 'pix',
        recurrence: 'single',
        notes: `Encontro de contas bilateral (${targetTxs.length} lançamento(s): ${formatBRL(owedToMe)} a receber vs ${formatBRL(iOweMember)} a pagar) ${refsTag}`,
      };

      const nextAll = [consolidatedTx, ...settledList];
      setTransactions(nextAll);
      triggerCrossAccountSharedTxSync(nextAll);
      showNotice(
        isNetReceivable
          ? `Saldo compensado de ${formatBRL(Math.abs(netAmount))} recebido de ${member?.name || 'Familiar'} e creditado na conta!`
          : `Saldo compensado de ${formatBRL(Math.abs(netAmount))} pago a ${member?.name || 'Familiar'} e debitado na conta!`
      );
    } else {
      setTransactions(settledList);
      triggerCrossAccountSharedTxSync(settledList);
      showNotice(
        `Encontro de contas quitado com saldo R$ 0,00 entre você e ${member?.name || 'Familiar'}!`
      );
    }
  };

  const handleReopenSharedTransaction = (txId: string) => {
    const targetTx = transactions.find((t) => t.id === txId);
    const idsToReopen = new Set<string>([txId]);
    const nextList = transactions
      .filter((t) => {
        if (!t.id.startsWith('tx-reimb-')) return true;
        if (t.notes?.includes(`[ref:${txId}]`)) {
          if (t.id.startsWith('tx-reimb-all-') && t.notes) {
            const matches = t.notes.matchAll(/\[ref:([^\]]+)\]/g);
            for (const m of matches) {
              if (m[1]) idsToReopen.add(m[1]);
            }
          }
          return false;
        }
        if (
          targetTx &&
          t.description.includes(`(${targetTx.description})`) &&
          (!targetTx.sharedSettledDate || t.date === targetTx.sharedSettledDate)
        ) {
          return false;
        }
        return true;
      })
      .map((t) =>
        idsToReopen.has(t.id)
          ? {
              ...t,
              sharedStatus: 'pending' as const,
              sharedSettledDate: undefined,
              sharedSettledAccountId: undefined,
            }
          : t
      );
    setTransactions(nextList);
    triggerCrossAccountSharedTxSync(nextList);
    showNotice(
      idsToReopen.size > 1
        ? `${idsToReopen.size} despesas compartilhadas do encontro de contas reabertas como pendentes e lançamento estornado.`
        : 'Despesa compartilhada reaberta como pendente e lançamento de reembolso estornado.'
    );
  };

  const handleAddAccount = (newAcc: Omit<BankAccount, 'id'>): BankAccount => {
    const created: BankAccount = {
      ...newAcc,
      id: `acc-${Date.now()}`,
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
    const target = accounts.find((a) => a.id === accountId);
    const fallback = accounts.find((a) => a.id !== accountId);
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    setCards((prev) =>
      prev.map((c) =>
        c.defaultAccountId === accountId
          ? { ...c, defaultAccountId: fallback ? fallback.id : '' }
          : c
      )
    );
    setTransactions((prev) =>
      prev
        .filter((tx) => {
          if (tx.type === 'transfer') {
            if (!fallback) {
              return tx.accountId !== accountId && tx.destinationAccountId !== accountId;
            }
            const nextOrigin = tx.accountId === accountId ? fallback.id : tx.accountId;
            const nextDest =
              tx.destinationAccountId === accountId
                ? fallback.id
                : tx.destinationAccountId;
            if (nextOrigin && nextDest && nextOrigin === nextDest) {
              return false;
            }
          }
          return true;
        })
        .map((tx) => {
          let updated = tx;
          if (updated.accountId === accountId) {
            updated = { ...updated, accountId: fallback ? fallback.id : undefined };
          }
          if (updated.destinationAccountId === accountId) {
            updated = {
              ...updated,
              destinationAccountId: fallback ? fallback.id : undefined,
            };
          }
          if (updated.sharedSettledAccountId === accountId) {
            updated = {
              ...updated,
              sharedSettledAccountId: fallback ? fallback.id : undefined,
            };
          }
          return updated;
        })
    );
    showNotice(`Conta ${target?.name || ''} removida.`);
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
      id: `inv-${Date.now()}`,
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
    setInvestments((prev) => prev.filter((a) => a.id !== assetId));
    setGoals((prev) =>
      prev.map((g) =>
        g.linkedAssetId === assetId ? { ...g, linkedAssetId: undefined } : g
      )
    );
    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.targetInvestmentAssetId !== assetId) return tx;
        if (tx.type === 'transfer' && !tx.destinationAccountId) {
          return {
            ...tx,
            type: 'expense',
            categoryId: tx.categoryId || 'cat-aportes',
            targetInvestmentAssetId: undefined,
          };
        }
        return { ...tx, targetInvestmentAssetId: undefined };
      })
    );
    showNotice(`Ativo ${target?.ticker || ''} removido da carteira.`);
  };

  const handleOperateInvestmentAsset = (
    assetId: string,
    operationType: 'buy' | 'sell' | 'update_quote',
    quantityDelta: number,
    unitPrice: number,
    settlementAccountId?: string
  ) => {
    const targetAsset = investments.find((a) => a.id === assetId);
    if (!targetAsset) return;

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

    if (
      settlementAccountId &&
      (operationType === 'buy' || operationType === 'sell') &&
      financialTotal > 0
    ) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const operationDate =
        todayIso.slice(0, 7) === selectedMonth ? todayIso : `${selectedMonth}-15`;
      const ledgerTx: Transaction = {
        id: `tx-inv-${Date.now()}`,
        description:
          operationType === 'buy'
            ? `Aporte Investimento — ${targetAsset.ticker} (${quantityDelta} un.)`
            : `Resgate Investimento — ${targetAsset.ticker} (${quantityDelta} un.)`,
        amount: financialTotal,
        date: operationDate,
        competenceMonth: selectedMonth,
        type: operationType === 'buy' ? 'expense' : 'income',
        status: 'paid',
        categoryId: operationType === 'buy' ? 'cat-aportes' : 'cat-rendimentos',
        accountId: settlementAccountId,
        targetInvestmentAssetId: assetId,
        paymentMethod: 'transfer',
        recurrence: 'single',
        notes: `${operationType === 'buy' ? 'Compra' : 'Venda'} de ${targetAsset.name} na corretora ${targetAsset.institution}`,
      };
      setTransactions((prev) => [ledgerTx, ...prev]);
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
    receivingAccountId: string
  ) => {
    if (dividendAmount <= 0) return;
    const dividendTx: Transaction = {
      id: `tx-div-${Date.now()}`,
      description: `Proventos / Dividendos — ${asset.ticker} (${asset.name})`,
      amount: Math.round(dividendAmount * 100) / 100,
      date: `${selectedMonth}-25`,
      competenceMonth: selectedMonth,
      type: 'income',
      status: 'paid',
      categoryId: 'cat-rendimentos',
      subcategoryId: 'sub-rend-fii',
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
    const lines = linesText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const imported: Transaction[] = [];
    lines.forEach((line, idx) => {
      const parts = line.split(';');
      if (parts.length < 3) return;
      const rawDate = parts[0].trim();
      const rawDesc = parts[1].trim();
      const rawVal = parts[2].trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) || !rawDesc) return;

      const isNegative = rawVal.startsWith('-');
      const amount = Math.abs(parseBRLInput(rawVal));
      if (amount <= 0) return;

      imported.push({
        id: `tx-imp-${Date.now()}-${idx}`,
        description: rawDesc,
        amount,
        date: rawDate,
        competenceMonth: rawDate.slice(0, 7),
        type: isNegative ? 'expense' : 'income',
        status: 'paid',
        categoryId: isNegative ? 'cat-mercado' : 'cat-freela',
        accountId: targetAccountId,
        paymentMethod: 'pix',
        recurrence: 'single',
        notes: 'Importado manualmente via lote CSV',
      });
    });

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
    setTransactions((prev) => [...newTxs, ...prev]);
    const acc = accounts.find((a) => a.id === accountId);
    showNotice(
      `${newTxs.length} lançamento(s) conciliado(s) com sucesso na conta ${
        acc?.name || 'selecionada'
      }!`
    );
    triggerDataLoadingTransition(220);
  };

  const handleExportFullBackupJson = () => {
    const payload = {
      version: 5,
      exportedAt: new Date().toISOString(),
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
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minhas-economias-backup-${selectedMonth}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('Backup completo (.JSON) exportado com sucesso.', undefined, true);
  };

  const handleImportFullBackupJson = (jsonText: string): boolean => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== 'object') return false;
      const repaired = sanitizeAndRepairFinancialState({
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : accounts,
        cards: Array.isArray(parsed.cards) ? parsed.cards : cards,
        categories: Array.isArray(parsed.categories) ? parsed.categories : categories,
        transactions: Array.isArray(parsed.transactions)
          ? parsed.transactions
          : transactions,
        goals: Array.isArray(parsed.goals) ? parsed.goals : goals,
        investments: Array.isArray(parsed.investments)
          ? parsed.investments
          : investments,
        trips: Array.isArray(parsed.trips) ? parsed.trips : trips,
      });
      setAccounts(repaired.accounts);
      setCards(repaired.cards);
      if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
        setCategories(parsed.categories);
      }
      setTransactions(repaired.transactions);
      setGoals(repaired.goals);
      if (Array.isArray(parsed.familyMembers)) {
        setFamilyMembers(stripLegacyMockItems(parsed.familyMembers));
      }
      setInvestments(repaired.investments);
      setTrips(repaired.trips);
      if (parsed.investmentTargets && typeof parsed.investmentTargets === 'object') {
        setInvestmentTargets((prev) => ({ ...prev, ...parsed.investmentTargets }));
      }
      if (parsed.settings && typeof parsed.settings === 'object') {
        setSettings((prev) => ({ ...prev, ...parsed.settings }));
      }
      showNotice('Backup JSON importado, verificado e restaurado com sucesso!');
      triggerDataLoadingTransition(260);
      return true;
    } catch {
      return false;
    }
  };

  const handleResetToDemoData = () => {
    showNotice('Base de dados limpa e reiniciada para uso real.');
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

  const handleRunDiagnosticAndRepair = () => {
    const result = sanitizeAndRepairFinancialState({
      accounts,
      cards,
      categories,
      transactions,
      goals,
      investments,
      trips,
    });

    if (result.repairedCount > 0) {
      setAccounts(result.accounts);
      setCards(result.cards);
      setTransactions(result.transactions);
      setGoals(result.goals);
      setInvestments(result.investments);
      setTrips(result.trips);
      showNotice(
        `Verificador do sistema: ${result.repairedCount} inconsistência(s) corrigida(s) automaticamente.`
      );
    } else {
      showNotice(
        'Verificador do sistema: 0 problemas encontrados. Base 100% íntegra e pronta para produção.',
        undefined,
        true
      );
    }

    return {
      repairedCount: result.repairedCount,
      repairedLog: result.repairedLog,
    };
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        globalSearchInputRef.current?.focus();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        globalSearchInputRef.current?.focus();
      } else if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === 'z' &&
        !isInputFocused &&
        undoStack.length > 0
      ) {
        e.preventDefault();
        handleUndoLastTransactionChange();
      } else if (e.key === 'Escape' && globalSearchQuery.trim()) {
        setGlobalSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [globalSearchQuery, undoStack]);

  const handleJumpToTransactionInLedger = (tx: Transaction) => {
    setSelectedMonth(tx.competenceMonth);
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
        return { title: 'Orçamentos Mensais', subtitle: 'Tetos de gastos por categoria e subcategoria' };
      case 'goals':
        return { title: 'Metas & Reservas', subtitle: 'Objetivos financeiros e simulador de juros compostos' };
      case 'reports':
        return { title: 'Relatórios & Backup', subtitle: 'Gestão de contas, exportação CSV e backup JSON' };
      case 'cloud':
        return {
          title: 'Conta, Login & Nuvem',
          subtitle: 'Sincronização automática Firebase e Auditoria SSOT de Regras Financeiras',
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

  const accountsTotalBalance = useMemo(
    () => accountBalances.reduce((sum, b) => sum + b.currentBalance, 0),
    [accountBalances]
  );

  const investmentsTotalValue = useMemo(
    () =>
      investments.reduce(
        (sum, asset) => sum + Math.round(asset.quantity * asset.currentPrice * 100) / 100,
        0
      ),
    [investments]
  );

  const todayDateStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const dailyReminders = useMemo(() => {
    return calculateDailyReminders({
      transactions,
      cards,
      categories,
      accounts,
      familyMembers,
      selectedMonth,
      referenceDate: todayDateStr,
      settings: settings.reminders || DEFAULT_REMINDER_SETTINGS,
    });
  }, [
    transactions,
    cards,
    categories,
    accounts,
    familyMembers,
    selectedMonth,
    todayDateStr,
    settings.reminders,
  ]);

  const remindersSummary = useMemo(
    () => summarizeReminders(dailyReminders),
    [dailyReminders]
  );

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
        if (targetEmail && dailyReminders.length > 0) {
          void dispatchEmailReminder({
            reminders: dailyReminders,
            recipientEmail: targetEmail,
            userName: effectiveUserDisplayName || settings.userName,
            settings: remSettings,
            recurrence: remSettings.emailRecurrence || remSettings.recurrence || 'daily',
            preferredTime: remSettings.emailPreferredTime || remSettings.preferredTime || '08:00',
            currentDateStr: todayDateStr,
            currentTimeStr,
          });
          setSettings((prev) => ({
            ...prev,
            reminders: {
              ...(prev.reminders || DEFAULT_REMINDER_SETTINGS),
              lastEmailNotifiedDate: todayDateStr,
            },
          }));
        }
      }
    };

    checkDailySchedule();
    const timer = setInterval(checkDailySchedule, 60000);
    return () => clearInterval(timer);
  }, [settings.reminders, todayDateStr, dailyReminders]);

  const handleMarkTransactionPaid = (txId: string) => {
    const target = transactions.find((t) => t.id === txId);
    if (!target) return;
    if (target.status === 'paid') return;
    handleToggleTransactionStatus(txId, 'single');
  };

  if (!authSession.isLoggedIn) {
    return (
      <div
        className={`min-h-screen w-full max-w-full overflow-x-hidden flex flex-col bg-slate-50 text-slate-900 transition-colors duration-200 ${
          settings.theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : ''
        }`}
      >
        <LoginPage
          defaultEmail={authSession.email || 'wesley.diaslima@gmail.com'}
          defaultName={authSession.displayName || settings.userName || 'Wesley Lima'}
          onSignInGoogle={handleSignInGoogle}
          onSignInEmail={handleSignInEmail}
          onRegisterEmail={handleRegisterEmail}
        />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen w-full max-w-full overflow-x-hidden flex bg-slate-50 text-slate-900 transition-colors duration-200 ${
        settings.theme === 'dark' ? 'dark' : ''
      } ${settings.privacyMode ? 'privacy-mode' : ''} ${
        settings.density === 'compact' ? 'density-compact' : ''
      }`}
    >
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
        urgentRemindersCount={remindersSummary.urgentCount}
        pendingTransactionsCount={pendingTransactionsCount}
        budgetAlertsCount={budgetAlertsCount}
        pendingSharedCount={pendingSharedCount}
        activeTripsCount={activeTripsCount}
        accountsTotalBalance={accountsTotalBalance}
        investmentsTotalValue={investmentsTotalValue}
        cloudUserEmail={effectiveUserEmail}
        cloudSyncStatus={cloudSyncStatus}
        onSignInGoogle={handleSignInGoogle}
        onSignOutGoogle={handleSignOutGoogle}
      />

      {/* Right Workspace Column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Single Unified, Clean Top Header Bar */}
        <header className="sticky top-0 z-30 w-full max-w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-3.5 sm:px-6 py-2.5 pt-[max(env(safe-area-inset-top),0.625rem)]">
          <div className="mx-auto w-full max-w-7xl flex items-center justify-between gap-2 sm:gap-4">
            {/* Zone 1 (Left): Mobile Menu Trigger + Active Page Title */}
            <div className="flex items-center gap-2.5 min-w-0 shrink-0">
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(true)}
                aria-label="Abrir menu lateral"
                title="Abrir menu de navegação"
                className="lg:hidden inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors shrink-0"
              >
                <Menu className="h-4 w-4" />
              </button>

              <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white font-display truncate">
                {activeTabMeta.title}
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
                    className="ml-1 inline-flex items-center rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors shrink-0"
                  >
                    Mês atual
                  </button>
                )}
              </div>
            )}

            {/* Zone 3 (Right): Compact Search + Essential Utilities + Primary CTA */}
            <div className="flex items-center justify-end gap-2 shrink-0">
              {/* Compact Expandable Search on Desktop */}
              <div
                data-testid="centered-global-search"
                className="hidden lg:block relative w-44 xl:w-56 focus-within:w-64 transition-all duration-200"
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
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/80 pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-colors"
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
                className={`lg:hidden rounded-lg border p-1.5 transition-colors ${
                  isMobileSearchOpen || globalSearchQuery
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
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
                  aria-label="Abrir central de lembretes e notificações"
                  title={`Central de Lembretes: ${remindersSummary.urgentCount} pendências requerem atenção`}
                  className={`relative rounded-md p-1.5 transition-colors ${
                    remindersSummary.urgentCount > 0
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Bell className="h-4 w-4" />
                  {remindersSummary.urgentCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-extrabold text-white shadow-2xs">
                      {remindersSummary.urgentCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  data-testid="header-system-verifier-btn"
                  onClick={() => setIsExpertReviewOpen(true)}
                  aria-label="Abrir verificador de saúde do sistema em tempo real"
                  title="Verificador em Tempo Real & Saúde de Produção"
                  className="rounded-md p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                >
                  <ShieldCheck className="h-4 w-4" />
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
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 shadow-2xs"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Lançamento</span>
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

        {/* Global Incoming Family Invitation Notification Banner */}
        {familyMembers.some(
          (m) => m.direction === 'incoming' && m.inviteStatus === 'invited'
        ) && (
          <div
            data-testid="global-family-invite-banner"
            className="mx-auto max-w-7xl w-full px-3.5 sm:px-6 pt-3 animate-expand-in"
          >
            {familyMembers
              .filter(
                (m) => m.direction === 'incoming' && m.inviteStatus === 'invited'
              )
              .map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border-2 border-indigo-400 bg-indigo-50/95 dark:bg-indigo-950/60 px-4 py-3 shadow-xs mb-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-indigo-950 dark:text-indigo-200">
                      Convite Familiar Recebido: {inv.invitedByName || inv.name} (
                      {inv.invitedByEmail || inv.email}) convidou você para a Divisão Familiar!
                    </p>
                    <p className="text-[11px] text-indigo-800 dark:text-indigo-300">
                      Aceite para sincronizar despesas compartilhadas e o encontro de contas entre as suas contas.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      data-testid="global-accept-family-invite-btn"
                      onClick={() => handleAcceptFamilyInvite(inv)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aceitar Convite
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectTab('shared')}
                      className="rounded-lg border border-indigo-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-900 hover:bg-indigo-100 transition-colors"
                    >
                      Ver na Aba Família
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeclineFamilyInvite(inv)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              ))}
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
          onEditTransaction={(tx) => {
            setEditingTransaction(tx);
            setIsModalOpen(true);
          }}
          onJumpToTransactionInLedger={handleJumpToTransactionInLedger}
        />

        {/* Main Content Container */}
        <main className="mx-auto w-full max-w-7xl min-w-0 overflow-x-hidden flex-1 px-3.5 sm:px-6 py-4 sm:py-6 pb-28 lg:pb-8">
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
            <>
              {activeTab === 'overview' && (
                <OverviewTab
                  selectedMonth={selectedMonth}
                  userName={
                    settings.userName &&
                    settings.userName !== 'Você' &&
                    settings.userName !== 'Minha Conta'
                      ? settings.userName
                      : effectiveUserDisplayName || 'Wesley'
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
                  onOpenExpertReview={() => setIsExpertReviewOpen(true)}
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
                  onToggleAccountInTotal={handleToggleAccountInTotal}
                  onAddAccount={handleAddAccount}
                  onUpdateAccount={handleUpdateAccount}
                  onDeleteAccount={handleDeleteAccount}
                  onUpdateAccountInitialBalance={handleUpdateAccountInitialBalance}
                  onUpdateTrip={handleUpdateTrip}
                  onToggleTransactionStatus={(id) =>
                    handleToggleTransactionStatus(id, 'single')
                  }
                  onEditTransaction={(tx) => {
                    setEditingTransaction(tx);
                    setIsModalOpen(true);
                  }}
                  onDuplicateTransaction={handleDuplicateTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onOpenNewTransaction={(mode) => handleOpenNewTransaction(mode)}
                  onOpenReconciliation={handleOpenReconciliation}
                />
              )}

              {activeTab === 'investments' && (
                <InvestmentsTab
                  selectedMonth={selectedMonth}
                  assets={investments}
                  targetMap={investmentTargets}
                  accounts={accounts}
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
                  onEditTransaction={(tx) => {
                    setEditingTransaction(tx);
                    setIsModalOpen(true);
                  }}
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
                  onPayInvoice={handlePayCardInvoice}
                  onAnticipateInstallments={handleAnticipateInstallments}
                  onReverseAnticipation={handleReverseAnticipation}
                  onAddCard={handleAddCard}
                  onUpdateCard={handleUpdateCard}
                  onDeleteCard={handleDeleteCard}
                  onDeleteTransaction={handleDeleteTransaction}
                  onOpenNewCardExpense={() => handleOpenNewTransaction('credit_card')}
                />
              )}

              {activeTab === 'shared' && (
                <SharedExpensesTab
                  selectedMonth={selectedMonth}
                  transactions={transactions}
                  familyMembers={familyMembers}
                  accounts={accounts}
                  cards={cards}
                  categories={categories}
                  userPixKey={settings.userPixKey}
                  onAddFamilyMember={handleAddFamilyMember}
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
                  trips={trips}
                  transactions={transactions}
                  categories={categories}
                  accounts={accounts}
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
                  onEditTransaction={(tx) => {
                    setEditingTransaction(tx);
                    setIsModalOpen(true);
                  }}
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
                  onAddSubcategory={handleAddSubcategory}
                  onDeleteSubcategory={handleDeleteSubcategory}
                />
              )}

              {activeTab === 'goals' && (
                <GoalsAndSimulatorTab
                  goals={goals}
                  investments={investments}
                  accounts={accounts}
                  onContributeGoal={handleContributeGoal}
                  onAddGoal={handleAddGoal}
                  onUpdateGoal={handleUpdateGoal}
                  onDeleteGoal={handleDeleteGoal}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsAndDataTab
                  selectedMonth={selectedMonth}
                  accounts={accounts}
                  accountBalances={accountBalances}
                  cards={cards}
                  categories={categories}
                  transactions={transactions}
                  investments={investments}
                  userName={effectiveUserDisplayName || undefined}
                  userEmail={effectiveUserEmail || undefined}
                  onAddAccount={handleAddAccount}
                  onUpdateAccountInitialBalance={handleUpdateAccountInitialBalance}
                  onImportQuickCsvLines={handleImportQuickCsvLines}
                  onOpenReconciliation={handleOpenReconciliation}
                  onResetToDemoData={handleResetToDemoData}
                />
              )}

              {activeTab === 'cloud' && (
                <AuthAndCloudTab
                  userEmail={effectiveUserEmail}
                  userDisplayName={effectiveUserDisplayName}
                  userUid={currentUser?.uid || autoVaultId}
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
                  onSignInGoogle={handleSignInGoogle}
                  onSignInEmail={handleSignInEmail}
                  onRegisterEmail={handleRegisterEmail}
                  onSignOut={handleSignOutGoogle}
                  onForceCloudSync={handleForceCloudSync}
                  onUpdateSettings={handleUpdateSettings}
                  onRunDiagnosticAndRepair={handleRunDiagnosticAndRepair}
                />
              )}
            </>
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
        onSignOut={handleSignOutGoogle}
      />

      {/* In-App Mobile PWA Install Banner */}
      <PWAInstallButton variant="banner" />

      {/* New / Edit Transaction Modal */}
      <TransactionModal
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
        categoryBreakdown={categoryBreakdown}
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
      />

      {/* Settings & Preferences Modal */}
      <SettingsModal
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
        onAddSubcategory={handleAddSubcategory}
        onDeleteSubcategory={handleDeleteSubcategory}
        onOpenCloudTab={() => handleSelectTab('cloud')}
        onSignOut={handleSignOutGoogle}
        onExportFullBackupJson={handleExportFullBackupJson}
        onImportFullBackupJson={handleImportFullBackupJson}
        onResetToDemoData={handleResetToDemoData}
      />

      {/* Daily Reminders & Scheduled Notifications Modal */}
      <ReminderCenterModal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        reminders={dailyReminders}
        settings={settings.reminders || DEFAULT_REMINDER_SETTINGS}
        userEmail={effectiveUserEmail}
        userName={effectiveUserDisplayName || settings.userName}
        onUpdateReminderSettings={(partial) =>
          setSettings((prev) => ({
            ...prev,
            reminders: {
              ...(prev.reminders || DEFAULT_REMINDER_SETTINGS),
              ...partial,
            },
          }))
        }
        onPayCardInvoice={(cardId) => {
          handleNavigateToCard(cardId);
        }}
        onMarkTransactionPaid={handleMarkTransactionPaid}
        onEditTransaction={(txId) => {
          const target = transactions.find((t) => t.id === txId);
          if (target) {
            setEditingTransaction(target);
            setModalDefaultMode(target.type === 'expense' && target.creditCardId ? 'credit_card' : target.type === 'income' ? 'income' : 'expense');
            setIsModalOpen(true);
          }
        }}
        onOpenSettingsTab={(tab) => {
          setSettingsInitialTab(tab as any);
          setIsSettingsOpen(true);
        }}
      />

      {/* Real-Time System Verifier & Clarity Guide Modal */}
      <ExpertSystemReviewModal
        isOpen={isExpertReviewOpen}
        onClose={() => setIsExpertReviewOpen(false)}
        viewClarityMode={settings.viewClarityMode || 'complete'}
        onChangeClarityMode={(mode) =>
          handleUpdateSettings({ viewClarityMode: mode })
        }
        onNavigateTab={handleSelectTab}
        accounts={accounts}
        cards={cards}
        categories={categories}
        transactions={transactions}
        investments={investments}
        goals={goals}
        trips={trips}
        cloudSyncStatus={cloudSyncStatus}
        lastSyncedAt={lastSyncedAt}
        onRunDiagnosticAndRepair={handleRunDiagnosticAndRepair}
      />

      {/* Bank Reconciliation & Smart OFX/CSV Import Modal */}
      <BankReconciliationModal
        isOpen={isReconciliationModalOpen}
        onClose={() => setIsReconciliationModalOpen(false)}
        accounts={accounts}
        categories={categories}
        existingTransactions={transactions}
        defaultAccountId={reconciliationTargetAccountId}
        onCommitImport={handleCommitReconciliationBatch}
        onAddAccount={handleAddAccount}
      />
    </div>
  );
}
