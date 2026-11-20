/** Tipos, auxiliares e props de ReportsAndDataTab. */
import { formatBRL, type CurrentPosition } from '../../../domain/finance/financeRules';
import { AccountBalanceSummary, BankAccount, Category, CreditCard, InvestmentAsset, ReportDistributionSlice, Transaction } from '../../../types/finance';
import React from 'react';

export interface ReportsAndDataTabProps {
  selectedMonth: string;
  /** Posição de hoje (saldos e dívida de cartão), independente do mês navegado. */
  currentPosition?: CurrentPosition;
  /** Total a receber de outras pessoas, somado ao patrimônio. */
  receivablesTotal?: number;
  accounts: BankAccount[];
  /** Leva ao cadastro de conta quando falta uma conta em reais. */
  onRequestCreateAccount?: () => void;
  accountBalances: AccountBalanceSummary[];
  cards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  investments?: InvestmentAsset[];
  userName?: string;
  userEmail?: string;
  onExportFullBackupJson: () => void;
  onAddAccount?: (account: Omit<BankAccount, 'id'>) => void;
  onUpdateAccountInitialBalance?: (accountId: string, newInitial: number) => void;
  onImportQuickCsvLines: (linesText: string, targetAccountId: string) => number;
  onOpenReconciliation?: () => void;
  onApplyHistoricalInstallmentTotals?: () => void;
  onResetWorkspaceData: () => void;
}

export type PeriodPreset = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom';

export const SvgPieDonutChart: React.FC<{
  slices: ReportDistributionSlice[];
  totalAmount: number;
  centerLabel: string;
  emptyMessage: string;
}> = ({ slices, totalAmount, centerLabel, emptyMessage }) => {
  if (slices.length === 0 || totalAmount <= 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative h-48 w-48">
        <svg
          viewBox="0 0 180 180"
          className="h-full w-full -rotate-90 transform"
          role="img"
          aria-label={`Gráfico de pizza: ${centerLabel}`}
        >
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth="26"
          />
          {slices.map((slice) => {
            const pct = Math.max(0, slice.amount / totalAmount);
            const strokeDasharray = `${pct * circumference} ${circumference}`;
            const strokeDashoffset = -cumulativePercent * circumference;
            cumulativePercent += pct;
            return (
              <circle
                key={slice.id}
                cx="90"
                cy="90"
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth="26"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
              >
                <title>
                  {slice.name}: {formatBRL(slice.amount)} ({slice.percent}%)
                </title>
              </circle>
            );
          })}
        </svg>
        <div className=" inset-0 absolute flex flex-col items-center justify-center text-center px-4">
          <span className="text-[11px] font-medium text-slate-500">{centerLabel}</span>
          <span className="text-xs font-bold font-mono tabular-nums text-slate-900 mt-0.5">
            {formatBRL(totalAmount)}
          </span>
        </div>
      </div>
    </div>
  );
};

/** Aplica os valores padrão das props (mesmos de antes) e devolve tudo num objeto. */
export function resolveReportsAndDataTabProps({
  selectedMonth,
  currentPosition,
  receivablesTotal = 0,
  accounts,
  onRequestCreateAccount,
  accountBalances,
  cards,
  categories,
  transactions,
  investments = [],
  userName,
  userEmail,
  onExportFullBackupJson,
  onImportQuickCsvLines,
  onOpenReconciliation,
  onApplyHistoricalInstallmentTotals,
  onResetWorkspaceData,
}: ReportsAndDataTabProps) {
  return {
    selectedMonth,
    currentPosition,
    accounts,
    onRequestCreateAccount,
    accountBalances,
    cards,
    categories,
    transactions,
    userName,
    userEmail,
    onExportFullBackupJson,
    onImportQuickCsvLines,
    onOpenReconciliation,
    onApplyHistoricalInstallmentTotals,
    onResetWorkspaceData,
    receivablesTotal,
    investments,
  };
}

export type ReportsAndDataTabPropsApi = ReturnType<typeof resolveReportsAndDataTabProps>;
