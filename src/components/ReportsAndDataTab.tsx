import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  PieChart as PieChartIcon,
  Plus,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Upload,
} from 'lucide-react';
import {
  AccountBalanceSummary,
  BankAccount,
  Category,
  CreditCard,
  InvestmentAsset,
  ReportDistributionSlice,
  Transaction,
} from '../types/finance';
import {
  addMonthsToYearMonth,
  calculateDailyCashFlow,
  calculatePeriodReport,
  exportTransactionsToCSV,
  formatBRL,
  formatMonthYearPT,
  formatShortDateBR,
  parseBRLInput,
} from '../utils/financeRules';
import { generateMonthlyFinancialReportPdf } from '../utils/reportPdfGenerator';
import { CategoryIconBadge } from './CategoryIconBadge';
import { MonthlyComparisonBarChart } from './MonthlyComparisonBarChart';

interface ReportsAndDataTabProps {
  selectedMonth: string;
  accounts: BankAccount[];
  accountBalances: AccountBalanceSummary[];
  cards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  investments?: InvestmentAsset[];
  userName?: string;
  userEmail?: string;
  onAddAccount?: (account: Omit<BankAccount, 'id'>) => void;
  onUpdateAccountInitialBalance?: (accountId: string, newInitial: number) => void;
  onImportQuickCsvLines: (linesText: string, targetAccountId: string) => number;
  onOpenReconciliation?: () => void;
  onResetToDemoData: () => void;
}

type PeriodPreset = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom';

// Helper to build SVG donut/pie chart segments using stroke-dasharray on a circle
const SvgPieDonutChart: React.FC<{
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

export const ReportsAndDataTab: React.FC<ReportsAndDataTabProps> = ({
  selectedMonth,
  accounts,
  accountBalances,
  cards,
  categories,
  transactions,
  investments = [],
  userName,
  userEmail,
  onImportQuickCsvLines,
  onOpenReconciliation,
  onResetToDemoData,
}) => {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('semiannual');
  const [customStartMonth, setCustomStartMonth] = useState(() =>
    addMonthsToYearMonth(selectedMonth, -5)
  );
  const [customEndMonth, setCustomEndMonth] = useState(selectedMonth);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Quick CSV paste import state
  const [csvPasteText, setCsvPasteText] = useState('');
  const [importTargetAccId, setImportTargetAccId] = useState(accounts[0]?.id || '');
  const [importFeedback, setImportFeedback] = useState('');

  // Personal DRE & Consolidated Wealth calculation for selectedMonth
  const personalDre = useMemo(() => {
    const monthTxs = transactions.filter(
      (tx) =>
        tx.competenceMonth === selectedMonth &&
        !tx.isInvoicePayment &&
        !tx.isCompanionOnlyExpense
    );
    let operationalIncome = 0;
    let dividendIncome = 0;
    let consumptionExpenses = 0;
    let investmentContributions = 0;

    for (const tx of monthTxs) {
      if (tx.type === 'income') {
        const isFamilyReimbursement =
          tx.id.startsWith('tx-reimb-') ||
          tx.description.toLowerCase().includes('reembolso compartilhado') ||
          tx.description.toLowerCase().includes('acerto compensado');
        if (tx.categoryId === 'cat-rendimentos' && !isFamilyReimbursement) {
          dividendIncome += tx.amount;
        } else {
          operationalIncome += tx.amount;
        }
      } else if (tx.type === 'expense') {
        // Respect shared expenses paid by family members (skip if already settled via tx-reimb-, or count only user share if pending)
        if (tx.isShared && tx.sharedPaidBy === 'member') {
          if (tx.sharedStatus === 'received') continue;
          const userShare =
            typeof tx.sharedAmount === 'number' && tx.sharedAmount > 0
              ? tx.sharedAmount
              : Math.round((tx.amount / 2) * 100) / 100;
          consumptionExpenses += userShare;
          continue;
        }
        if (
          tx.categoryId === 'cat-aportes' ||
          tx.categoryId === 'cat-rendimentos' ||
          tx.description.toLowerCase().includes('aporte')
        ) {
          investmentContributions += tx.amount;
        } else {
          consumptionExpenses += tx.amount;
        }
      } else if (tx.type === 'transfer' && tx.targetInvestmentAssetId) {
        investmentContributions += tx.amount;
      }
    }

    const totalIncome = operationalIncome + dividendIncome;
    const freeCashFlowBeforeInvestments = totalIncome - consumptionExpenses;
    const netSurplusAfterInvestments =
      freeCashFlowBeforeInvestments - investmentContributions;

    const liquidAccountsBalance = accountBalances.reduce(
      (sum, b) => sum + b.currentBalance,
      0
    );
    const investedAssetsValue = investments.reduce(
      (sum, a) => sum + Math.round(a.quantity * a.currentPrice * 100) / 100,
      0
    );
    const totalNetWorth = liquidAccountsBalance + investedAssetsValue;

    return {
      operationalIncome,
      dividendIncome,
      totalIncome,
      consumptionExpenses,
      investmentContributions,
      freeCashFlowBeforeInvestments,
      netSurplusAfterInvestments,
      liquidAccountsBalance,
      investedAssetsValue,
      totalNetWorth,
    };
  }, [transactions, selectedMonth, accountBalances, investments]);

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
        activeStartMonth: `${yr}-06`,
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
    () => calculateDailyCashFlow(accounts, transactions, selectedMonth),
    [accounts, transactions, selectedMonth]
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

  const lowestProjectedPoint = useMemo(() => {
    if (dailyFlow.length === 0) return null;
    return dailyFlow.reduce(
      (min, pt) => (pt.projectedBalance < min.projectedBalance ? pt : min),
      dailyFlow[0]
    );
  }, [dailyFlow]);

  const handleDownloadCSV = () => {
    const csvContent = exportTransactionsToCSV(transactions, categories, accounts, cards);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minhas-economias-extrato-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSONBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'Minhas Economias BR',
      accounts,
      cards,
      categories,
      transactions,
      investments,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minhas-economias-backup-${selectedMonth}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    try {
      setIsExportingPdf(true);
      generateMonthlyFinancialReportPdf({
        selectedMonth,
        accounts,
        accountBalances,
        cards,
        categories,
        transactions,
        investments,
        userName,
        userEmail,
      });
    } catch (err) {
      console.error('Erro ao gerar relatório em PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleRunImport = (e: React.FormEvent) => {
    e.preventDefault();
    const count = onImportQuickCsvLines(
      csvPasteText,
      importTargetAccId || accounts[0]?.id || ''
    );
    if (count > 0) {
      setImportFeedback(`${count} lançamento(s) importado(s) com sucesso para o extrato!`);
      setCsvPasteText('');
    } else {
      setImportFeedback(
        'Use o formato: YYYY-MM-DD;Descrição;Valor (ex: 2026-10-22;Padaria Real;-34,90)'
      );
    }
  };

  // Max value for Bar chart scaling
  const maxBarValue = useMemo(() => {
    let maxVal = 1000;
    for (const row of periodReport.monthlySeries) {
      if (row.income > maxVal) maxVal = row.income;
      if (row.expense > maxVal) maxVal = row.expense;
    }
    return maxVal * 1.1;
  }, [periodReport.monthlySeries]);

  // Min and Max for Line Chart scaling (General Balance & Net Result)
  const lineChartGeometry = useMemo(() => {
    const series = periodReport.monthlySeries;
    if (series.length === 0) return null;

    const values = series.flatMap((s) => [s.cumulativeBalance, s.netSavings]);
    const minVal = Math.min(0, ...values);
    const maxVal = Math.max(1000, ...values);
    const span = Math.max(1, maxVal - minVal);

    const width = 620;
    const height = 200;
    const padX = 44;
    const padY = 24;
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;

    const getX = (idx: number) =>
      series.length === 1 ? width / 2 : padX + (idx / (series.length - 1)) * plotW;
    const getY = (val: number) =>
      padY + plotH - ((val - minVal) / span) * plotH;

    const balancePoints = series.map((s, i) => ({
      x: getX(i),
      y: getY(s.cumulativeBalance),
      label: s.shortLabel,
      balance: s.cumulativeBalance,
      net: s.netSavings,
    }));

    const netPoints = series.map((s, i) => ({
      x: getX(i),
      y: getY(s.netSavings),
    }));

    const balancePolyline = balancePoints.map((p) => `${p.x},${p.y}`).join(' ');
    const netPolyline = netPoints.map((p) => `${p.x},${p.y}`).join(' ');

    return {
      width,
      height,
      balancePoints,
      netPoints,
      balancePolyline,
      netPolyline,
      zeroY: getY(0),
    };
  }, [periodReport.monthlySeries]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Period Selector & Summary KPIs */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Relatórios Visuais e Análise Comparativa de Períodos
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Gráficos de pizza, barras e linhas detalhando gastos por categoria, receitas por fonte e evolução do saldo geral
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              aria-label="Exportar relatório financeiro do mês em PDF imprimível"
              title="Gerar e baixar relatório executivo em PDF com saldos e gráfico de categorias"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors shrink-0"
            >
              <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{isExportingPdf ? 'Gerando...' : `Exportar PDF (${formatMonthYearPT(selectedMonth).split(' ')[0]})`}</span>
            </button>

            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 shrink-0 max-w-full">
            <button
              type="button"
              onClick={() => setPeriodPreset('monthly')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                periodPreset === 'monthly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mensal ({formatMonthYearPT(selectedMonth).split(' ')[0]})
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('quarterly')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                periodPreset === 'quarterly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Trimestral (3m)
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('semiannual')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                periodPreset === 'semiannual'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semestral (6m)
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('annual')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                periodPreset === 'annual'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Anual (2026)
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('custom')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                periodPreset === 'custom'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Personalizado
            </button>
          </div>
        </div>
      </div>

        {periodPreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-slate-50 p-3.5 text-xs">
            <span className="font-semibold text-slate-700">Intervalo Personalizado:</span>
            <label className="flex items-center gap-2">
              <span className="text-slate-600">De:</span>
              <input
                type="month"
                aria-label="Mês inicial do relatório"
                value={customStartMonth}
                onChange={(e) => setCustomStartMonth(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 font-mono tabular-nums text-slate-900"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-slate-600">Até:</span>
              <input
                type="month"
                aria-label="Mês final do relatório"
                value={customEndMonth}
                onChange={(e) => setCustomEndMonth(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 font-mono tabular-nums text-slate-900"
              />
            </label>
          </div>
        )}

        {/* 4 Summary Metrics for Selected Period (2x2 on Mobile) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 pt-1">
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:border-0 sm:bg-transparent sm:p-0">
            <p className="text-[11px] sm:text-xs font-medium text-slate-500">
              Receitas ({periodReport.monthsCount}{' '}
              {periodReport.monthsCount === 1 ? 'mês' : 'meses'})
            </p>
            <p className="mt-1 text-base sm:text-xl font-bold font-mono tabular-nums text-emerald-700">
              {formatBRL(periodReport.totalIncome)}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums mt-0.5">
              Média: {formatBRL(periodReport.averageMonthlyIncome)}
            </p>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:border-0 sm:bg-transparent sm:p-0">
            <p className="text-[11px] sm:text-xs font-medium text-slate-500">Despesas no Período</p>
            <p className="mt-1 text-base sm:text-xl font-bold font-mono tabular-nums text-rose-700">
              {formatBRL(periodReport.totalExpense)}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums mt-0.5">
              Média: {formatBRL(periodReport.averageMonthlyExpense)}
            </p>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:border-0 sm:bg-transparent sm:p-0">
            <p className="text-[11px] sm:text-xs font-medium text-slate-500">Economia Líquida</p>
            <p
              className={`mt-1 text-base sm:text-xl font-bold font-mono tabular-nums ${
                periodReport.netSavings >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {periodReport.netSavings >= 0 ? '+' : ''}
              {formatBRL(periodReport.netSavings)}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums mt-0.5">
              Poupança: {periodReport.savingsRate}%
            </p>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:border-0 sm:bg-transparent sm:p-0">
            <p className="text-[11px] sm:text-xs font-medium text-slate-500">Saldo Final</p>
            <p className="mt-1 text-base sm:text-xl font-bold font-mono tabular-nums text-slate-900">
              {formatBRL(periodReport.endingBalance)}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate">
              {formatMonthYearPT(periodReport.startMonth).split(' ')[0]}–
              {formatMonthYearPT(periodReport.endMonth)}
            </p>
          </div>
        </div>
      </section>

      {/* Visual Pie Charts Row: Expenses by Category & Incomes by Source */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Pie Chart 1: Expenses by Category */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-rose-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Gráfico de Pizza — Gastos por Categoria
                </h3>
                <p className="text-xs text-slate-500">
                  Participação de cada categoria e subcategoria nas despesas do período
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
            <div className="sm:col-span-5">
              <SvgPieDonutChart
                slices={periodReport.expensesByCategory}
                totalAmount={periodReport.totalExpense}
                centerLabel="Total Gastos"
                emptyMessage="Nenhuma despesa registrada no período."
              />
            </div>

            <div className="sm:col-span-7 space-y-3 max-h-72 overflow-y-auto pr-1">
              {periodReport.expensesByCategory.map((slice) => (
                <div key={slice.id} className="space-y-1 border-b border-slate-100 pb-2.5 last:border-b-0">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <CategoryIconBadge icon={slice.icon} color={slice.color} size="sm" />
                      <span className="font-semibold text-slate-900 truncate">
                        {slice.name}
                      </span>
                    </div>
                    <div className="font-mono tabular-nums text-right shrink-0">
                      <span className="font-bold text-slate-900">{formatBRL(slice.amount)}</span>
                      <span className="ml-1.5 text-slate-500">({slice.percent}%)</span>
                    </div>
                  </div>
                  {slice.subcategories.length > 0 && (
                    <p className="pl-9 text-[11px] text-slate-500 font-mono tabular-nums">
                      {slice.subcategories.map((sub, i) => (
                        <React.Fragment key={sub.id}>
                          {i > 0 && <span aria-hidden="true"> · </span>}
                          <span>
                            {sub.name}: {formatBRL(sub.amount)}
                          </span>
                        </React.Fragment>
                      ))}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pie Chart 2: Incomes by Source */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Gráfico de Pizza — Receitas por Fonte
                </h3>
                <p className="text-xs text-slate-500">
                  Detalhamento das entradas por fonte de renda e subcategorias
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
            <div className="sm:col-span-5">
              <SvgPieDonutChart
                slices={periodReport.incomesBySource}
                totalAmount={periodReport.totalIncome}
                centerLabel="Total Receitas"
                emptyMessage="Nenhuma receita registrada no período."
              />
            </div>

            <div className="sm:col-span-7 space-y-3 max-h-72 overflow-y-auto pr-1">
              {periodReport.incomesBySource.map((slice) => (
                <div key={slice.id} className="space-y-1 border-b border-slate-100 pb-2.5 last:border-b-0">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <CategoryIconBadge icon={slice.icon} color={slice.color} size="sm" />
                      <span className="font-semibold text-slate-900 truncate">
                        {slice.name}
                      </span>
                    </div>
                    <div className="font-mono tabular-nums text-right shrink-0">
                      <span className="font-bold text-emerald-700">{formatBRL(slice.amount)}</span>
                      <span className="ml-1.5 text-slate-500">({slice.percent}%)</span>
                    </div>
                  </div>
                  {slice.subcategories.length > 0 && (
                    <p className="pl-9 text-[11px] text-slate-500 font-mono tabular-nums">
                      {slice.subcategories.map((sub, i) => (
                        <React.Fragment key={sub.id}>
                          {i > 0 && <span aria-hidden="true"> · </span>}
                          <span>
                            {sub.name}: {formatBRL(sub.amount)}
                          </span>
                        </React.Fragment>
                      ))}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Bar Chart & Line Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Grouped Bar Chart (Recharts): Monthly Comparison (Income vs Expense in Last 6 Months) */}
        <MonthlyComparisonBarChart
          selectedMonth={selectedMonth}
          accounts={accounts}
          cards={cards}
          transactions={transactions}
          periodMonthlySeries={periodReport.monthlySeries}
        />

        {/* Line Chart: Evolution of General Balance & Net Result */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sky-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Gráfico de Linhas — Evolução do Saldo Geral e Economia
                </h3>
                <p className="text-xs text-slate-500">
                  Trajetória do saldo acumulado nas contas e resultado mensal
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-900" /> Saldo Geral
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Economia Mês
              </span>
            </div>
          </div>

          {lineChartGeometry && (
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${lineChartGeometry.width} ${lineChartGeometry.height}`}
                className="w-full h-52"
                role="img"
                aria-label="Gráfico de linhas da evolução do saldo geral"
              >
                {/* Horizontal grid lines */}
                <line
                  x1="36"
                  y1="30"
                  x2={lineChartGeometry.width - 36}
                  y2="30"
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <line
                  x1="36"
                  y1="100"
                  x2={lineChartGeometry.width - 36}
                  y2="100"
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <line
                  x1="36"
                  y1={lineChartGeometry.zeroY}
                  x2={lineChartGeometry.width - 36}
                  y2={lineChartGeometry.zeroY}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />

                {/* Net Monthly Savings Line */}
                <polyline
                  fill="none"
                  stroke="#059669"
                  strokeWidth="2.5"
                  points={lineChartGeometry.netPolyline}
                />

                {/* Cumulative Balance Line */}
                <polyline
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth="3"
                  points={lineChartGeometry.balancePolyline}
                />

                {lineChartGeometry.balancePoints.map((pt, i) => (
                  <g key={pt.label}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="4.5"
                      fill="#0f172a"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    >
                      <title>
                        {pt.label} — Saldo Geral: {formatBRL(pt.balance)}
                      </title>
                    </circle>
                    <circle
                      cx={lineChartGeometry.netPoints[i].x}
                      cy={lineChartGeometry.netPoints[i].y}
                      r="4"
                      fill="#059669"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    >
                      <title>
                        {pt.label} — Economia Mensal: {formatBRL(pt.net)}
                      </title>
                    </circle>
                    <text
                      x={pt.x}
                      y={lineChartGeometry.height - 4}
                      textAnchor="middle"
                      className="fill-slate-600 text-[10px] font-mono"
                    >
                      {pt.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          )}
        </section>
      </div>

      {/* Month-over-Month Comparative Summary Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-4 sm:px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">
            Resumo Comparativo Entre Meses
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Evolução comparativa de receitas, despesas, variação percentual mensal e saldo acumulado
          </p>
        </div>

        {/* Mobile Comparative Cards (< sm) */}
        <div className="block sm:hidden divide-y divide-slate-100">
          {periodReport.monthlySeries.map((row) => (
            <div key={row.month} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">{row.label}</span>
                <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  Poupança: {row.savingsRate}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                <div>
                  <span className="block text-[10px] font-sans text-slate-400">Receitas</span>
                  <span className="font-semibold text-emerald-700">{formatBRL(row.income)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-sans text-slate-400">Despesas</span>
                  <span className="font-semibold text-rose-700">{formatBRL(row.expense)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-sans text-slate-400">Resultado Mês</span>
                  <span
                    className={`font-bold ${
                      row.netSavings >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {row.netSavings >= 0 ? '+' : ''}
                    {formatBRL(row.netSavings)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-sans text-slate-400">Saldo Acumulado</span>
                  <span className="font-bold text-slate-900">
                    {formatBRL(row.cumulativeBalance)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Comparative Table (>= sm) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/40 text-xs font-semibold text-slate-500">
                <th className="py-3 pl-6 pr-3">Mês / Competência</th>
                <th className="py-3 px-3 text-right">Receitas</th>
                <th className="py-3 px-3 text-right">Despesas</th>
                <th className="py-3 px-3 text-right">Variação Gastos (Mês Ant.)</th>
                <th className="py-3 px-3 text-right">Resultado Líquido</th>
                <th className="py-3 px-3 text-right">Taxa Poupança</th>
                <th className="py-3 pl-3 pr-6 text-right">Saldo Geral Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-mono tabular-nums">
              {periodReport.monthlySeries.map((row) => (
                <tr key={row.month} className="hover:bg-slate-50/80">
                  <td className="py-3 pl-6 pr-3 font-sans font-semibold text-slate-900">
                    {row.label}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-700 font-semibold">
                    {formatBRL(row.income)}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-700 font-semibold">
                    {formatBRL(row.expense)}
                  </td>
                  <td className="py-3 px-3 text-right text-xs">
                    {row.expenseDeltaPercent === null ? (
                      <span className="text-slate-400">Base inicial</span>
                    ) : (
                      <span
                        className={
                          row.expenseDeltaPercent <= 0
                            ? 'text-emerald-700 font-semibold'
                            : 'text-rose-700 font-semibold'
                        }
                      >
                        {row.expenseDeltaPercent > 0 ? '+' : ''}
                        {row.expenseDeltaPercent}%
                      </span>
                    )}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-bold ${
                      row.netSavings >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {row.netSavings >= 0 ? '+' : ''}
                    {formatBRL(row.netSavings)}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700">
                    {row.savingsRate}%
                  </td>
                  <td className="py-3 pl-3 pr-6 text-right font-bold text-slate-900">
                    {formatBRL(row.cumulativeBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Daily Cash Flow Section */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-4 sm:px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Fluxo de Caixa Diário Acumulado — {formatMonthYearPT(selectedMonth)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Evolução dia a dia do saldo nas contas de giro para evitar descoberto ou cheque especial
            </p>
          </div>
          {lowestProjectedPoint && (
            <div className="text-left sm:text-right font-mono tabular-nums text-xs">
              <span className="text-slate-500">Menor saldo projetado no mês: </span>
              <strong
                className={
                  lowestProjectedPoint.projectedBalance >= 0
                    ? 'text-emerald-700'
                    : 'text-rose-700'
                }
              >
                {formatBRL(lowestProjectedPoint.projectedBalance)} (dia{' '}
                {String(lowestProjectedPoint.day).padStart(2, '0')})
              </strong>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/40 text-xs font-semibold text-slate-500">
                <th className="py-3 pl-4 sm:pl-6 pr-3">Data</th>
                <th className="py-3 px-3 text-right">Entradas do Dia</th>
                <th className="py-3 px-3 text-right">Saídas do Dia</th>
                <th className="py-3 px-3 text-right">Saldo Caixa Efetivado</th>
                <th className="py-3 pl-3 pr-4 sm:pr-6 text-right">Saldo Previsto Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-mono tabular-nums">
              {activeFlowDays.map((pt) => (
                <tr key={pt.date} className="hover:bg-slate-50/80">
                  <td className="py-2.5 pl-4 sm:pl-6 pr-3 text-xs text-slate-700">
                    {formatShortDateBR(pt.date)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-700">
                    {pt.income > 0 ? `+${formatBRL(pt.income)}` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right text-rose-700">
                    {pt.expense > 0 ? `-${formatBRL(pt.expense)}` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                    {formatBRL(pt.cumulativeBalance)}
                  </td>
                  <td
                    className={`py-2.5 pl-3 pr-4 sm:pr-6 text-right font-bold ${
                      pt.projectedBalance >= 0 ? 'text-slate-900' : 'text-rose-700'
                    }`}
                  >
                    {formatBRL(pt.projectedBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Personal DRE + Privacy / Offline Export Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Demonstrativo de Resultado Pessoal (DRE) & Composição Patrimonial */}
        <section
          data-testid="personal-dre-section"
          className="lg:col-span-6 rounded-xl border border-slate-200 bg-white flex flex-col justify-between"
        >
          <div className="p-4 sm:p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  DRE Pessoal & Evolução Patrimonial — {formatMonthYearPT(selectedMonth)}
                </h2>
                <span className="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800 shrink-0">
                  Regime de Competência
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Separação clara entre geração operacional de caixa, consumo e aportes em investimentos
              </p>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              <div className="flex items-center justify-between py-2.5">
                <span className="font-semibold text-slate-700">
                  (+) Receitas Operacionais (Salário, Projetos, Extras)
                </span>
                <span className="font-mono tabular-nums font-bold text-emerald-700">
                  +{formatBRL(personalDre.operationalIncome)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="font-semibold text-slate-700">
                  (+) Renda Passiva (Dividendos, FIIs e Rendimentos)
                </span>
                <span className="font-mono tabular-nums font-bold text-emerald-700">
                  +{formatBRL(personalDre.dividendIncome)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="font-semibold text-slate-700">
                  (−) Despesas de Consumo & Estilo de Vida
                </span>
                <span className="font-mono tabular-nums font-bold text-rose-700">
                  -{formatBRL(personalDre.consumptionExpenses)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5 bg-slate-50/80 px-2.5 rounded-lg">
                <span className="font-bold text-slate-900">
                  (=) Geração Livre de Caixa (Antes de Aportes)
                </span>
                <span
                  className={`font-mono tabular-nums font-bold ${
                    personalDre.freeCashFlowBeforeInvestments >= 0
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {personalDre.freeCashFlowBeforeInvestments >= 0 ? '+' : ''}
                  {formatBRL(personalDre.freeCashFlowBeforeInvestments)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="font-semibold text-indigo-800">
                  (−) Aportes em Investimentos & Construção de Patrimônio
                </span>
                <span className="font-mono tabular-nums font-bold text-indigo-700">
                  {formatBRL(personalDre.investmentContributions)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5 border-t border-slate-200">
                <span className="font-bold text-slate-900">
                  (=) Superávit / Caixa Retido no Giro do Mês
                </span>
                <span
                  className={`font-mono tabular-nums text-sm font-extrabold ${
                    personalDre.netSurplusAfterInvestments >= 0
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {personalDre.netSurplusAfterInvestments >= 0 ? '+' : ''}
                  {formatBRL(personalDre.netSurplusAfterInvestments)}
                </span>
              </div>
            </div>

            {/* Consolidated Wealth Strip inside DRE */}
            <div className="rounded-xl border border-slate-200 bg-slate-900 text-white p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Patrimônio Consolidado Total</span>
                <span className="font-mono tabular-nums text-sm font-bold text-emerald-400">
                  {formatBRL(personalDre.totalNetWorth)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-800 text-[11px] font-mono tabular-nums">
                <div>
                  <span className="block font-sans text-slate-400">Liquidez em Contas</span>
                  <span className="font-semibold text-white">
                    {formatBRL(personalDre.liquidAccountsBalance)}
                  </span>
                </div>
                <div>
                  <span className="block font-sans text-slate-400">Ativos Investidos</span>
                  <span className="font-semibold text-emerald-300">
                    {formatBRL(personalDre.investedAssetsValue)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 px-4 sm:px-6 py-3 bg-slate-50/60 rounded-b-xl text-xs text-slate-600">
            Para gerenciar contas bancárias e saldos iniciais, acesse a aba dedicada{' '}
            <strong>Contas & Carteiras</strong>.
          </div>
        </section>

        <section className="lg:col-span-6 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
          <div className="p-4 sm:p-6 space-y-5">
            <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Privacidade & Portabilidade de Dados
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Seus dados financeiros nunca passam por integrações Open Finance de terceiros. Exporte planilhas CSV ou importe lançamentos em lote quando quiser.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              {onOpenReconciliation && (
                <button
                  type="button"
                  onClick={onOpenReconciliation}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                >
                  <FileCheck2 className="h-4 w-4" />
                  Conciliação Inteligente (OFX / CSV)
                </button>
              )}

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                aria-label="Exportar relatório financeiro do mês em PDF formatado"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <FileText className="h-4 w-4" />
                {isExportingPdf ? 'Gerando PDF...' : 'Exportar Relatório em PDF'}
              </button>

              <button
                type="button"
                onClick={handleDownloadCSV}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Planilha CSV (Excel)
              </button>

              <button
                type="button"
                onClick={handleDownloadJSONBackup}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Download className="h-4 w-4" />
                Baixar Backup JSON
              </button>

              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Zerar base
                </button>
              ) : (
                <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2">
                  <span className="text-xs font-medium text-rose-800">
                    Isso apaga os dados financeiros deste workspace. Exporte um backup antes.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onResetToDemoData();
                      setConfirmReset(false);
                    }}
                    className="rounded-md bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                  >
                    Confirmar limpeza
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handleRunImport} className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="csv-paste-box" className="text-xs font-bold text-slate-800">
                  Importação Rápida de Extrato Manual (Texto / CSV)
                </label>
                <select
                  aria-label="Conta destino da importação em lote"
                  value={importTargetAccId}
                  onChange={(e) => setImportTargetAccId(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-800"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      Importar em: {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                id="csv-paste-box"
                rows={3}
                value={csvPasteText}
                onChange={(e) => setCsvPasteText(e.target.value)}
                placeholder={'Cole linhas no formato Data;Descrição;Valor\n2026-10-21;Padaria Real;-28,50\n2026-10-22;Reembolso PIX;150,00'}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs font-mono text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
              {importFeedback && (
                <p className="text-xs font-medium text-emerald-700">{importFeedback}</p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Processar e Importar Linhas
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};
