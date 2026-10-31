/**
 * Utilities for loading states and skeleton screen heuristics.
 */

export interface LoadingStateOptions {
  isInitialLoading?: boolean;
  isMonthChanging?: boolean;
  isTabChanging?: boolean;
  isImportingBackup?: boolean;
  isTripChanging?: boolean;
  isChartProcessing?: boolean;
}

export function shouldDisplaySkeleton(state: LoadingStateOptions): boolean {
  return Boolean(
    state.isInitialLoading ||
    state.isMonthChanging ||
    state.isTabChanging ||
    state.isImportingBackup ||
    state.isTripChanging ||
    state.isChartProcessing
  );
}

export function getSkeletonItemCount(
  type: 'transactions' | 'cards' | 'budgets' | 'kpis' | 'chartBars',
  isMobile = false
): number {
  switch (type) {
    case 'transactions':
      return isMobile ? 5 : 7;
    case 'cards':
      return 2;
    case 'budgets':
      return isMobile ? 3 : 5;
    case 'kpis':
      return 4;
    case 'chartBars':
      return isMobile ? 4 : 7;
    default:
      return 4;
  }
}
