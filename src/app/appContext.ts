/** Tudo o que os hooks do App devolvem, junto: é o que as partes da tela (AppHeader, AppTabContent…) recebem. */
import type { AccountAndInvestmentActionsApi } from './useAccountAndInvestmentActions';
import type { AppStateApi } from './useAppState';
import type { CardActionsApi } from './useCardActions';
import type { CategoryAndGoalActionsApi } from './useCategoryAndGoalActions';
import type { FamilyActionsApi } from './useFamilyActions';
import type { FinancialSnapshotApi } from './useFinancialSnapshot';
import type { ImportAndBackupActionsApi } from './useImportAndBackupActions';
import type { NoticesAndInsightsApi } from './useNoticesAndInsights';
import type { OsNotificationsApi } from './useOsNotifications';
import type { ReceivablesApi } from './useReceivables';
import type { SharedSyncApi } from './useSharedSync';
import type { TransactionActionsApi } from './useTransactionActions';
import type { TripActionsApi } from './useTripActions';
import type { WorkspaceSyncApi } from './useWorkspaceSync';

export type AppContext = AppStateApi &
  WorkspaceSyncApi &
  ReceivablesApi &
  FinancialSnapshotApi &
  SharedSyncApi &
  TransactionActionsApi &
  CardActionsApi &
  TripActionsApi &
  CategoryAndGoalActionsApi &
  FamilyActionsApi &
  AccountAndInvestmentActionsApi &
  ImportAndBackupActionsApi &
  NoticesAndInsightsApi &
  OsNotificationsApi;
