/** DRE, relatório do período, fluxo diário e ponto mais baixo. Parte de ReportsAndDataTab (ver ReportsAndDataTab.tsx). */
import { useMemo, useState } from 'react';
import { auditLegacyFinancialRecords } from '../../../domain/budgets/legacyFinancialAudit';
import { addMonthsToYearMonth, calculateCreditCardSummary, calculateDailyCashFlow, calculatePeriodReport, calculatePersonalDre } from '../../../domain/finance/financeRules';
import type { ReportsAndDataTabPropsApi } from './reportsTabConfig';
import type { ReportsStateApi } from './useReportsState';

export function useReportsDerived(ctx: ReportsAndDataTabPropsApi & ReportsStateApi) {
  const {
    accountBalances,
    accounts,
    cards,
    categories,
    currentPosition,
    customEndMonth,
    customStartMonth,
    investments,
    periodPreset,
    receivablesTotal,
    selectedMonth,
    transactions,
  } = ctx;
  const historyAuditRows = useMemo(
    () => auditLegacyFinancialRecords(transactions, cards),
    [transactions, cards]
  );
  const highConfidenceHistoryGroups = useMemo(
    () =>
      historyAuditRows.filter(
        (row) =>
          row.issue === 'installment_total' &&
          row.confidence === 'high' &&
          row.suggestedPurchaseTotal !== null
      ),
    [historyAuditRows]
  );

  const personalDre = useMemo(
    () => calculatePersonalDre(transactions, selectedMonth, accountBalances, investments,
      cards.map((card) => calculateCreditCardSummary(card, transactions, selectedMonth)), currentPosition, receivablesTotal),
    [transactions, selectedMonth, accountBalances, investments, cards, currentPosition, receivablesTotal]
  );

  const { activeStartMonth, activeEndMonth } = useMemo(() => {
    if (periodPreset === 'monthly') {
      return { activeStartMonth: selectedMonth, activeEndMonth: selectedMonth };
    }
    if (periodPreset === 'quarterly') {
      return {
        activeStartMonth: addMonthsToYearMonth(selectedMonth, -2),
        activeEndMonth: selectedMonth,
      };
    }
    if (periodPreset === 'semiannual') {
      return {
        activeStartMonth: addMonthsToYearMonth(selectedMonth, -5),
        activeEndMonth: selectedMonth,
      };
    }
    if (periodPreset === 'annual') {
      const yr = selectedMonth.slice(0, 4);
      return {
        activeStartMonth: `${yr}-01`,
        activeEndMonth: `${yr}-12`,
      };
    }
    return {
      activeStartMonth: customStartMonth,
      activeEndMonth: customEndMonth,
    };
  }, [periodPreset, selectedMonth, customStartMonth, customEndMonth]);

  const periodReport = useMemo(
    () =>
      calculatePeriodReport(
        accounts,
        cards,
        categories,
        transactions,
        activeStartMonth,
        activeEndMonth
      ),
    [accounts, cards, categories, transactions, activeStartMonth, activeEndMonth]
  );

  const dailyFlow = useMemo(
    () => calculateDailyCashFlow(accounts, cards, transactions, selectedMonth),
    [accounts, cards, transactions, selectedMonth]
  );

  const activeFlowDays = useMemo(() => {
    return dailyFlow.filter(
      (pt, idx) =>
        pt.income > 0 ||
        pt.expense > 0 ||
        pt.day === 1 ||
        pt.day === 5 ||
        pt.day === 10 ||
        pt.day === 15 ||
        pt.day === 20 ||
        pt.day === 25 ||
        idx === dailyFlow.length - 1
    );
  }, [dailyFlow]);

  const [showAllFlowDays, setShowAllFlowDays] = useState(false);
  const visibleFlowDays = showAllFlowDays ? dailyFlow : activeFlowDays;

  const lowestProjectedPoint = useMemo(() => {
    if (dailyFlow.length === 0) return null;
    return dailyFlow.reduce(
      (min, pt) => (pt.projectedBalance < min.projectedBalance ? pt : min),
      dailyFlow[0]
    );
  }, [dailyFlow]);

  return {
    dailyFlow,
    highConfidenceHistoryGroups,
    historyAuditRows,
    lowestProjectedPoint,
    periodReport,
    personalDre,
    setShowAllFlowDays,
    showAllFlowDays,
    visibleFlowDays,
  };
}

export type ReportsDerivedApi = ReturnType<typeof useReportsDerived>;
