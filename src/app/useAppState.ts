/** Estado da tela e dos dados financeiros, navegação, avisos (toast) e desfazer. Parte do App (ver src/App.tsx). */
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_MONTH, INITIAL_ACCOUNTS, INITIAL_CATEGORIES, INITIAL_CREDIT_CARDS, INITIAL_FAMILY_MEMBERS, INITIAL_INVESTMENTS, INITIAL_SAVINGS_GOALS, INITIAL_TRANSACTIONS, INITIAL_TRIPS } from '../domain/finance/seedData';
import { getBrowserNotificationPermissionState } from '../domain/reminders/reminderRules';
import { getOrCreateAutoCloudVaultId, getVaultIdForUid, type User } from '../lib/authClient';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import { type WorkspaceConflictState, workspaceContentSignature } from '../services/workspace/workspaceSyncRecovery';
import { setUpdateBlocker } from '../pwa/updateBlockers';
import { isWorkspaceLoadedForUser } from '../services/workspace/workspaceSession';
import { AppSettings, BankAccount, Category, CreditCard, FamilyMember, InvestmentAsset, InvestmentTargetMap, Receivable, SavingsGoal, Transaction, Trip } from '../types/finance';
import { DEFAULT_INVESTMENT_TARGETS } from '../domain/investments/investmentRules';
import { sanitizeStoredWorkspaceSnapshot } from '../utils/secureSettings';
import { getLocalDateISO } from '../domain/finance/financeRules';
import { ActiveTab, DEFAULT_SETTINGS, STORAGE_KEY, UndoHistoryEntry, settingsUserNameFallback } from './appConfig';

export function useAppState() {
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
  useModalAccessibility();
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<
    'local' | 'syncing' | 'synced' | 'error'
  >('syncing');
  const [workspaceLoadState, setWorkspaceLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [workspaceLoadAttempt, setWorkspaceLoadAttempt] = useState(0);
  // Atualização em segundo plano (outro aparelho gravou): troca os dados sem tela de carregamento nem piscar
  const silentWorkspaceRefreshRef = useRef(false);
  const requestSilentWorkspaceRefresh = () => {
    silentWorkspaceRefreshRef.current = true;
    setWorkspaceLoadAttempt((attempt) => attempt + 1);
  };
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
  const cachedWorkspaceIsReadOnly = isShowingCachedWorkspace && !isWorkspaceReadyForCurrentUser;
  const workspaceReadOnlyMessage = 'Os dados salvos neste aparelho estão em modo de leitura. Aguarde a nuvem carregar para alterar.';
  const requireWorkspaceWrite = () => {
    if (!cachedWorkspaceIsReadOnly) return true;
    showNotice(workspaceReadOnlyMessage, undefined, true);
    return false;
  };

  const [accounts, setAccounts] = useState<BankAccount[]>(INITIAL_ACCOUNTS);
  const [cards, setCards] = useState<CreditCard[]>(INITIAL_CREDIT_CARDS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [goals, setGoals] = useState<SavingsGoal[]>(INITIAL_SAVINGS_GOALS);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(INITIAL_FAMILY_MEMBERS);
  // E-mail (minúsculo) → a pessoa convidada já tem conta? Só convites pendentes que eu enviei; vem do servidor.
  const [inviteeHasAccount, setInviteeHasAccount] = useState<Record<string, boolean>>({});
  // E-mail (minúsculo) → código do convite que eu enviei; a pessoa convidada digita para aceitar.
  const [inviteCodes, setInviteCodes] = useState<Record<string, string>>({});
  // Ids dos compartilhados que o servidor já tem desta conta (null = ainda não lido ou servidor antigo).
  const [serverSentSharedIds, setServerSentSharedIds] = useState<ReadonlySet<string> | null>(null);
  const sharedWorkspaceProjectionRef = useRef(false);
  const sharedProjectedRevisionsRef = useRef(new Map<string, { revision: number; attemptedAt: number }>());
  const sharedPendingHideRef = useRef(new Map<string, Set<string>>());
  const acceptedSharedPartnersRef = useRef(new Map<string, string[]>());
  // Dos já enviados, os de cartão que o servidor tem sem o vencimento da fatura (enviados por app antigo).
  const [serverStaleSharedIds, setServerStaleSharedIds] = useState<ReadonlySet<string>>(new Set());
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
    setReceivables([]);
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
    if (!requireWorkspaceWrite()) return;
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
        receivables: [...receivables],
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
    if (!requireWorkspaceWrite()) return;
    if (undoStack.length === 0) return;
    const [latest, ...rest] = undoStack;
    setAccounts(latest.accounts);
    setCards(latest.cards);
    setCategories(latest.categories);
    setTransactions(latest.transactions);
    setGoals(latest.goals);
    if (latest.receivables) setReceivables(latest.receivables);
    setFamilyMembers(latest.familyMembers);
    setInvestments(latest.investments);
    setInvestmentTargets(latest.investmentTargets);
    setTrips(latest.trips);
    setUndoStack(rest);
    setToastMessage(
      `Ação desfeita com sucesso! Estado anterior restaurado (${latest.label.slice(0, 65)}).`
    );
  };

  // "Hoje" acompanha o relógio: um app deixado aberto (ou retomado do segundo plano) depois da meia-noite
  // passa para o dia novo e, se estava no mês atual, acompanha a virada do mês.
  const [todayDateStr, setTodayDateStr] = useState(() => getLocalDateISO());
  const currentMonth = todayDateStr.slice(0, 7);

  return {
    acceptedSharedPartnersRef,
    accounts,
    activeTab,
    authenticatedUidRef,
    autoVaultId,
    browserPermissionState,
    cards,
    categories,
    cloudSyncStatus,
    currentMonth,
    currentUser,
    editingTransaction,
    effectiveUserDisplayName,
    effectiveUserEmail,
    familyMembers,
    globalSearchInputRef,
    globalSearchQuery,
    goals,
    handleNavigateToAccount,
    handleNavigateToCard,
    handleRequestCreateFromTransaction,
    handleSelectMonth,
    handleSelectTab,
    handleUndoLastTransactionChange,
    hasLoadedRemoteOnceRef,
    initialSelectedAccountId,
    initialSelectedCardId,
    investmentTargets,
    investments,
    inviteCodes,
    inviteeHasAccount,
    isApplyingRemoteSnapshotRef,
    isAuthReady,
    isLoadingData,
    isMobileDrawerOpen,
    isMobileSearchOpen,
    isModalOpen,
    isReconciliationModalOpen,
    isReminderModalOpen,
    isResolvingWorkspaceConflict,
    isSettingsOpen,
    isShowingCachedWorkspace,
    isSidebarCollapsed,
    isUserAuthenticated,
    isWorkspaceConflictOpen,
    isWorkspaceReadyForCurrentUser,
    knownRemoteSignaturesRef,
    lastConfirmedSignatureRef,
    lastSyncedAt,
    latestNeonPayloadRef,
    loadedWorkspaceUidRef,
    mobileSearchInputRef,
    modalDefaultMode,
    modalInitialDate,
    modalInitialTripId,
    neonSaveQueueRef,
    neonWorkspaceRevisionRef,
    pendingCreateRequest,
    receivables,
    reconciliationTargetAccountId,
    rememberRemoteSignature,
    requestSilentWorkspaceRefresh,
    requestedLedgerViewMode,
    requireWorkspaceWrite,
    resetFinancialStateToCleanZero,
    saveRetryCountRef,
    saveRetryPendingRef,
    saveRetryTimerRef,
    saveRetryUidRef,
    scheduleSaveRetryRef,
    scheduledEmailAttemptRef,
    scopedStorageKey,
    selectedMonth,
    serverSentSharedIds,
    serverStaleSharedIds,
    setAccounts,
    setActiveTab,
    setAuthSession,
    setBrowserPermissionState,
    setCards,
    setCategories,
    setCloudSyncStatus,
    setCurrentUser,
    setEditingTransaction,
    setFamilyMembers,
    setGlobalSearchQuery,
    setGoals,
    setInvestmentTargets,
    setInvestments,
    setInviteCodes,
    setInviteeHasAccount,
    setIsAuthReady,
    setIsMobileDrawerOpen,
    setIsMobileSearchOpen,
    setIsModalOpen,
    setIsReconciliationModalOpen,
    setIsReminderModalOpen,
    setIsResolvingWorkspaceConflict,
    setIsSettingsOpen,
    setIsShowingCachedWorkspace,
    setIsSidebarCollapsed,
    setIsWorkspaceConflictOpen,
    setLastSyncedAt,
    setModalDefaultMode,
    setModalInitialDate,
    setModalInitialTripId,
    setPendingCreateRequest,
    setReceivables,
    setReconciliationTargetAccountId,
    setRequestedLedgerViewMode,
    setSelectedMonth,
    setServerSentSharedIds,
    setServerStaleSharedIds,
    setSettings,
    setSettingsInitialTab,
    setShowNotificationInitPrompt,
    setToastMessage,
    setTodayDateStr,
    setTransactions,
    setTrips,
    setWorkspaceConflict,
    setWorkspaceConflictError,
    setWorkspaceLoadAttempt,
    setWorkspaceLoadState,
    settings,
    settingsInitialTab,
    sharedPendingHideRef,
    sharedProjectedRevisionsRef,
    sharedWorkspaceProjectionRef,
    showNotice,
    showNotificationInitPrompt,
    silentWorkspaceRefreshRef,
    toastMessage,
    todayDateStr,
    transactions,
    triggerDataLoadingTransition,
    trips,
    undoStack,
    workspaceConflict,
    workspaceConflictError,
    workspaceConflictRef,
    workspaceLoadAttempt,
    workspaceLoadState,
    workspaceReadOnlyMessage,
  };
}

export type AppStateApi = ReturnType<typeof useAppState>;
