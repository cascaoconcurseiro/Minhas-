/** Telas e janelas carregadas sob demanda (cada uma vira um arquivo separado no build). */
import { lazy } from 'react';

export const OverviewTab = lazy(() => import('../components/overview/OverviewTab').then((m) => ({ default: m.OverviewTab })));

export const AccountsTab = lazy(() => import('../components/accounts/AccountsTab').then((m) => ({ default: m.AccountsTab })));

export const InvestmentsTab = lazy(() => import('../components/investments/InvestmentsTab').then((m) => ({ default: m.InvestmentsTab })));

export const TransactionsTab = lazy(() => import('../components/transactions/TransactionsTab').then((m) => ({ default: m.TransactionsTab })));

export const CreditCardsTab = lazy(() => import('../components/cards/CreditCardsTab').then((m) => ({ default: m.CreditCardsTab })));

export const ReceivablesTab = lazy(() => import('../components/receivables/ReceivablesTab').then((m) => ({ default: m.ReceivablesTab })));

export const SharedExpensesTab = lazy(() => import('../components/family/SharedExpensesTab').then((m) => ({ default: m.SharedExpensesTab })));

export const TripsTab = lazy(() => import('../components/trips/TripsTab').then((m) => ({ default: m.TripsTab })));

export const BudgetsTab = lazy(() => import('../components/budgets/BudgetsTab').then((m) => ({ default: m.BudgetsTab })));

export const GoalsAndSimulatorTab = lazy(() => import('../components/budgets/GoalsAndSimulatorTab').then((m) => ({ default: m.GoalsAndSimulatorTab })));

export const ReportsAndDataTab = lazy(() => import('../components/reports/ReportsAndDataTab').then((m) => ({ default: m.ReportsAndDataTab })));

export const AuthAndCloudTab = lazy(() => import('../components/auth/AuthAndCloudTab').then((m) => ({ default: m.AuthAndCloudTab })));

export const LoginPage = lazy(() => import('../components/auth/LoginPage').then((m) => ({ default: m.LoginPage })));

export const TransactionModal = lazy(() => import('../components/transactions/TransactionModal').then((m) => ({ default: m.TransactionModal })));

export const GlobalSearchPanel = lazy(() => import('../components/layout/GlobalSearchPanel').then((m) => ({ default: m.GlobalSearchPanel })));

export const SettingsModal = lazy(() => import('../components/settings/SettingsModal').then((m) => ({ default: m.SettingsModal })));

export const ReminderCenterModal = lazy(() => import('../components/overview/ReminderCenterModal').then((m) => ({ default: m.ReminderCenterModal })));

export const BankReconciliationModal = lazy(() => import('../components/transactions/BankReconciliationModal').then((m) => ({ default: m.BankReconciliationModal })));

export const WorkspaceConflictModal = lazy(() => import('../components/settings/WorkspaceConflictModal').then((m) => ({ default: m.WorkspaceConflictModal })));
