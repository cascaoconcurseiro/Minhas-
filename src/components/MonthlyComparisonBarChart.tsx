import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  BankAccount,
  CreditCard,
  MonthlyComparisonRow,
  Transaction,
} from '../types/finance';
import {
  calculateSixMonthComparativeSeries,
  formatBRL,
  formatMonthYearPT,
} from '../utils/financeRules';

interface MonthlyComparisonBarChartProps {
  selectedMonth: string;
  accounts: BankAccount[];
  cards: CreditCard[];
  transactions: Transaction[];
  periodMonthlySeries?: MonthlyComparisonRow[];
}

const formatCompactAxisBRL = (value: number): string => {
  if (Math.abs(value) >= 1000) {
    const k = value / 1000;
    return `R$ ${k.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  }
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
    payload: MonthlyComparisonRow & {
      isSurplus?: boolean;
      healthStatus?: 'surplus' | 'balanced' | 'deficit';
    };
  }>;
  label?: string;
}

const CustomBarTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0].payload;
  const isPositive = row.netSavings >= 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 p-3.5 shadow-lg backdrop-blur-xs text-xs space-y-2 min-w-[220px]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
        <span className="font-bold text-slate-900 dark:text-white">{row.label}</span>
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
            row.income > row.expense
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
              : row.expense > row.income
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {row.income > row.expense
            ? 'Superávit'
            : row.expense > row.income
            ? 'Déficit'
            : 'Equilíbrio'}
        </span>
      </div>

      <div className="space-y-1.5 font-mono tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 font-sans text-slate-600 dark:text-slate-300">
            <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600 shrink-0" />
            Receitas:
          </span>
          <span className="font-bold text-emerald-700 dark:text-emerald-400">
            {formatBRL(row.income)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 font-sans text-slate-600 dark:text-slate-300">
            <span className="h-2.5 w-2.5 rounded-xs bg-rose-600 shrink-0" />
            Despesas:
          </span>
          <span className="font-bold text-rose-700 dark:text-rose-400">
            {formatBRL(row.expense)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800 pt-1.5">
          <span className="font-sans font-semibold text-slate-700 dark:text-slate-200">
            Saldo Líquido:
          </span>
          <span
            className={`font-extrabold ${
              isPositive
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {isPositive ? '+' : ''}
            {formatBRL(row.netSavings)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-sans">Taxa de Poupança:</span>
          <span className="font-semibold">{row.savingsRate}%</span>
        </div>
      </div>
    </div>
  );
};

export const MonthlyComparisonBarChart: React.FC<MonthlyComparisonBarChartProps> = ({
  selectedMonth,
  accounts,
  cards,
  transactions,
  periodMonthlySeries,
}) => {
  const [chartScope, setChartScope] = useState<'last_6_months' | 'selected_period'>(
    'last_6_months'
  );

  const sixMonthSummary = useMemo(
    () =>
      calculateSixMonthComparativeSeries(
        accounts,
        cards,
        transactions,
        selectedMonth
      ),
    [accounts, cards, transactions, selectedMonth]
  );

  const activeData = useMemo(() => {
    if (
      chartScope === 'selected_period' &&
      periodMonthlySeries &&
      periodMonthlySeries.length > 0
    ) {
      return periodMonthlySeries;
    }
    return sixMonthSummary.months;
  }, [chartScope, periodMonthlySeries, sixMonthSummary.months]);

  const showPeriodToggle =
    Boolean(periodMonthlySeries) &&
    periodMonthlySeries!.length > 0 &&
    (periodMonthlySeries!.length !== 6 ||
      periodMonthlySeries![0]?.month !== sixMonthSummary.startMonth ||
      periodMonthlySeries![periodMonthlySeries!.length - 1]?.month !==
        sixMonthSummary.endMonth);

  const healthBadgeStyle =
    sixMonthSummary.financialHealthStatus === 'strong'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
      : sixMonthSummary.financialHealthStatus === 'positive'
      ? 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300'
      : sixMonthSummary.financialHealthStatus === 'deficit'
      ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300'
      : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';

  return (
    <section
      data-testid="recharts-monthly-comparison-section"
      className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4 flex flex-col justify-between"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3.5">
        <div className="flex items-start gap-2.5">
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/60 p-2 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Evolução Comparativa Mensal — Receitas vs. Despesas (Últimos 6 Meses)
              </h3>
              <span
                data-testid="financial-health-badge"
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${healthBadgeStyle}`}
              >
                {sixMonthSummary.financialHealthStatus === 'deficit' ? (
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                )}
                {sixMonthSummary.financialHealthLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Visão semestral de {formatMonthYearPT(sixMonthSummary.startMonth)} até{' '}
              {formatMonthYearPT(sixMonthSummary.endMonth)} para acompanhamento da saúde financeira
            </p>
          </div>
        </div>

        {showPeriodToggle && (
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-[11px] font-semibold shrink-0 self-start">
            <button
              type="button"
              onClick={() => setChartScope('last_6_months')}
              className={`rounded-md px-2 py-1 transition-colors ${
                chartScope === 'last_6_months'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Últimos 6 Meses
            </button>
            <button
              type="button"
              onClick={() => setChartScope('selected_period')}
              className={`rounded-md px-2 py-1 transition-colors ${
                chartScope === 'selected_period'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Período Filtrado
            </button>
          </div>
        )}
      </div>

      {/* 6-Month Financial Health Highlights Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-2.5">
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <ArrowUpRight className="h-3 w-3 text-emerald-600 shrink-0" />
            Receitas (6m)
          </span>
          <p
            data-testid="six-month-total-income"
            className="mt-0.5 text-xs sm:text-sm font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400"
          >
            {formatBRL(sixMonthSummary.totalIncome6m)}
          </p>
          <span className="block text-[10px] font-mono tabular-nums text-slate-500">
            Média: {formatBRL(sixMonthSummary.averageIncome6m)}/mês
          </span>
        </div>

        <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-2.5">
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <ArrowDownRight className="h-3 w-3 text-rose-600 shrink-0" />
            Despesas (6m)
          </span>
          <p
            data-testid="six-month-total-expense"
            className="mt-0.5 text-xs sm:text-sm font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400"
          >
            {formatBRL(sixMonthSummary.totalExpense6m)}
          </p>
          <span className="block text-[10px] font-mono tabular-nums text-slate-500">
            Média: {formatBRL(sixMonthSummary.averageExpense6m)}/mês
          </span>
        </div>

        <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-2.5">
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Activity className="h-3 w-3 text-sky-600 shrink-0" />
            Saldo Semestral
          </span>
          <p
            data-testid="six-month-net-savings"
            className={`mt-0.5 text-xs sm:text-sm font-bold font-mono tabular-nums ${
              sixMonthSummary.netSavings6m >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {sixMonthSummary.netSavings6m >= 0 ? '+' : ''}
            {formatBRL(sixMonthSummary.netSavings6m)}
          </p>
          <span className="block text-[10px] font-mono tabular-nums text-slate-500">
            Poupança: {sixMonthSummary.overallSavingsRate6m}%
          </span>
        </div>

        <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            Consistência Mensal
          </span>
          <p className="mt-0.5 text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {sixMonthSummary.surplusMonthsCount} de 6 meses
          </p>
          <span className="block text-[10px] text-slate-500">
            {sixMonthSummary.deficitMonthsCount === 0
              ? 'Nenhum mês no vermelho'
              : `${sixMonthSummary.deficitMonthsCount} mês(es) com déficit`}
          </span>
        </div>
      </div>

      {/* Recharts BarChart */}
      <div
        className="h-64 w-full pt-2"
        role="img"
        aria-label="Gráfico de barras Recharts comparativo de receitas e despesas nos últimos 6 meses"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={activeData}
            margin={{ top: 10, right: 12, left: 4, bottom: 4 }}
            barGap={6}
            barCategoryGap="22%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
            />
            <XAxis
              dataKey="shortLabel"
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fill: '#475569', fontSize: 11, fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}
            />
            <YAxis
              tickFormatter={formatCompactAxisBRL}
              tickLine={false}
              axisLine={false}
              width={66}
              tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
            />
            <Tooltip
              content={<CustomBarTooltip />}
              cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '12px', paddingBottom: '8px' }}
            />
            {sixMonthSummary.averageExpense6m > 0 && (
              <ReferenceLine
                y={sixMonthSummary.averageExpense6m}
                stroke="#f43f5e"
                strokeDasharray="4 4"
                strokeOpacity={0.55}
              />
            )}
            <Bar
              dataKey="income"
              name="Receitas"
              fill="#059669"
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
            />
            <Bar
              dataKey="expense"
              name="Despesas"
              fill="#e11d48"
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
