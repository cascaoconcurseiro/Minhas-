/** Indicadores do menu, posição de hoje, previsão, lembretes e avisos do sino. Parte do App (ver src/App.tsx). */
import { useEffect, useMemo, useState } from 'react';
import { runFinancialIntegrityAudit } from '../domain/trips/travelRules';
import { Transaction } from '../types/finance';
import { calculateCurrentPosition, calculateNetWorth, calculateSharedAmount, formatMonthYearPT, getLocalDateISO, isSharedOnlyExpense, resolveCreditCardInvoiceMonth } from '../domain/finance/financeRules';
import { summarizeReceivables } from '../domain/receivables/receivables';
import { listOpenSharedReceivables } from '../domain/family/sharedFinanceRules';
import { forecastCashBalance } from '../domain/budgets/cashForecast';
import { assessDataHealth } from '../domain/budgets/dataHealth';
import { detectRecurringExpenses, type RecurringCandidate } from '../domain/budgets/recurrenceDetection';
import { learnSharingFromHistory } from '../domain/budgets/learningRules';
import { calculateDailyReminders, DEFAULT_REMINDER_SETTINGS, summarizeReminders } from '../domain/reminders/reminderRules';
import { calculateCardCommitmentByMonth, getCommitmentAlerts } from '../domain/cards/cardCommitment';
import { type AppNoticeAction, buildAppNotices, countBellNotices } from '../domain/reminders/appNotices';
import type { AppStateApi } from './useAppState';
import type { FinancialSnapshotApi } from './useFinancialSnapshot';
import type { TransactionActionsApi } from './useTransactionActions';

export function useNoticesAndInsights(app: AppStateApi & FinancialSnapshotApi & TransactionActionsApi) {
  const {
    accounts,
    activeTab,
    cards,
    categories,
    categoryBreakdown,
    familyMembers,
    goals,
    handleSaveTransactionBatch,
    handleSelectTab,
    investments,
    isWorkspaceReadyForCurrentUser,
    receivables,
    requireWorkspaceWrite,
    selectedMonth,
    setActiveTab,
    setRequestedLedgerViewMode,
    setSelectedMonth,
    setSettings,
    setTodayDateStr,
    settings,
    showNotice,
    todayDateStr,
    transactions,
    trips,
  } = app;
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
      case 'receivables':
        return { title: 'A Receber', subtitle: 'Faturas de cartão adicional e dívidas de outras pessoas' };
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
          !tx.isInvoicePayment &&
          !isSharedOnlyExpense(tx)
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
  useEffect(() => {
    const syncToday = () => {
      const now = getLocalDateISO();
      setTodayDateStr((previous) => {
        if (previous === now) return previous;
        if (previous.slice(0, 7) !== now.slice(0, 7)) {
          setSelectedMonth((viewing) => (viewing === previous.slice(0, 7) ? now.slice(0, 7) : viewing));
        }
        return now;
      });
    };
    const timer = window.setInterval(syncToday, 30_000);
    document.addEventListener('visibilitychange', syncToday);
    window.addEventListener('focus', syncToday);
    window.addEventListener('pageshow', syncToday);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', syncToday);
      window.removeEventListener('focus', syncToday);
      window.removeEventListener('pageshow', syncToday);
    };
  }, []);

  // Posição de hoje (independe do mês navegado): fonte única do saldo total, dos investimentos e do patrimônio.
  const currentPosition = useMemo(
    () => calculateCurrentPosition(accounts, cards, transactions, todayDateStr),
    [accounts, cards, transactions, todayDateStr]
  );
  const currentReceivables = useMemo(
    () => summarizeReceivables(receivables, todayDateStr, listOpenSharedReceivables(transactions, familyMembers, todayDateStr)),
    [receivables, todayDateStr, transactions, familyMembers]
  );
  const netWorthSnapshot = useMemo(
    () => calculateNetWorth(currentPosition.accountBalances, investments, currentPosition.cardSummaries, currentReceivables.totalOpen),
    [currentPosition, investments, currentReceivables.totalOpen]
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
    if (!requireWorkspaceWrite()) return;
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
    if (!requireWorkspaceWrite()) return;
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

  return {
    accountsTotalBalance,
    activeTabMeta,
    activeTripsCount,
    appNotices,
    budgetAlertsCount,
    cashForecast,
    currentPosition,
    currentReceivables,
    dailyReminders,
    financialIntegrity,
    handleDismissNotice,
    handleDismissRecurring,
    handleJumpToTransactionInLedger,
    handleNoticeAction,
    handleScheduleRecurring,
    incomingFamilyInvites,
    investmentsTotalValue,
    noticeCount,
    pendingSharedCount,
    pendingTransactionsCount,
    recurringSuggestions,
  };
}

export type NoticesAndInsightsApi = ReturnType<typeof useNoticesAndInsights>;
