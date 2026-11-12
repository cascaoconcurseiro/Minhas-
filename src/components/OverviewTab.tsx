import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard as CreditCardIcon,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  AccountBalanceSummary,
  BankAccount,
  Category,
  CategorySpendItem,
  CreditCard,
  CreditCardSummary,
  InvestmentAsset,
  MonthlyFinancialSummary,
  Transaction,
} from '../types/finance';
import {
  calculateFinancialHealthScore360,
  type CurrentPosition,
  formatBRL,
  formatMonthYearPT,
  formatShortDateBR,
  getLocalDateISO,
  getPendingBankMovements,
  getBudgetAlerts,
} from '../utils/financeRules';
import { calculateMonthBurnRateMarker } from '../utils/uxEnhancementRules';
import { CategoryIconBadge } from './CategoryIconBadge';
import { CardNetworkMark } from './CardNetworkMark';
import { InstitutionMark } from './InstitutionMark';
import { CreditCardFace } from './CreditCardFace';

interface OverviewTabProps {
  selectedMonth: string;
  /** Posição de hoje (saldos e dívida de cartão), independente do mês navegado. */
  currentPosition?: CurrentPosition;
  monthlySummary: MonthlyFinancialSummary;
  accounts: BankAccount[];
  accountBalances: AccountBalanceSummary[];
  cards: CreditCard[];
  cardSummaries: CreditCardSummary[];
  categories: Category[];
  categoryBreakdown: CategorySpendItem[];
  transactions: Transaction[];
  investments?: InvestmentAsset[];
  showOverviewAlerts?: boolean;
  alertsExpandedByDefault?: boolean;
  viewClarityMode?: 'complete' | 'essential';
  onChangeClarityMode?: (mode: 'complete' | 'essential') => void;
  onToggleStatus: (txId: string) => void;
  onToggleAccountInTotal: (accountId: string) => void;
  onOpenNewTransaction: (mode: 'expense' | 'income' | 'credit_card' | 'transfer') => void;
  userName?: string;
  onNavigateToAccount?: (accountId: string) => void;
  onNavigateToCard?: (cardId: string) => void;
  onNavigateTab: (
    tab:
      | 'overview'
      | 'accounts'
      | 'investments'
      | 'transactions'
      | 'cards'
      | 'budgets'
      | 'goals'
      | 'trips'
      | 'reports'
      | 'cloud'
  ) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  selectedMonth,
  currentPosition,
  monthlySummary,
  accounts,
  accountBalances,
  cards,
  cardSummaries,
  categories,
  categoryBreakdown,
  transactions,
  investments = [],
  showOverviewAlerts = true,
  alertsExpandedByDefault = true,
  viewClarityMode = 'complete',
  onChangeClarityMode,
  onToggleStatus,
  onToggleAccountInTotal,
  onOpenNewTransaction,
  userName,
  onNavigateToAccount,
  onNavigateToCard,
  onNavigateTab,
}) => {
  const [isAlertsExpanded, setIsAlertsExpanded] = useState<boolean>(alertsExpandedByDefault);
  const [isHealthDetailsOpen, setIsHealthDetailsOpen] = useState<boolean>(false);
  const [billsFilterMode, setBillsFilterMode] = useState<'pending' | 'paid'>('pending');

  const greetingPrefix = (() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  const firstName = userName?.trim().split(/\s+/)[0] || '';

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const accMap = new Map(accounts.map((a) => [a.id, a.name]));

  const todayDate = getLocalDateISO();
  const todayMonth = todayDate.slice(0, 7);
  const pendingBills = getPendingBankMovements(transactions, selectedMonth, todayDate);

  const paidBankBills = transactions
    .filter(
      (tx) =>
        tx.competenceMonth === selectedMonth &&
        tx.status === 'paid' &&
        !tx.creditCardId &&
        tx.type !== 'transfer' &&
        !tx.isCompanionOnlyExpense &&
        tx.sharedPaidBy !== 'member'
    )
    .sort((a, b) => b.date.localeCompare(a.date));


  const health360 = useMemo(
    () =>
      calculateFinancialHealthScore360({
        selectedMonth,
        monthlySummary,
        accounts,
        accountBalances,
        cards,
        cardSummaries,
        categoryBreakdown,
        investments,
        currentPosition,
      }),
    [
      selectedMonth,
      monthlySummary,
      accounts,
      accountBalances,
      cards,
      cardSummaries,
      categoryBreakdown,
      investments,
      currentPosition,
    ]
  );

  const budgetAlerts = getBudgetAlerts(categoryBreakdown);
  const overBudgetItems = budgetAlerts.filter((i) => i.status === 'over');
  const warningBudgetItems = budgetAlerts.filter((i) => i.status === 'warning');

  const topCategories = categoryBreakdown.filter((c) => c.spent > 0 || c.budget > 0).slice(0, 6);

  return (
    <div className="overview-dashboard space-y-6 min-w-0 max-w-full">
      {/* Clean Executive Greeting Header */}
      <header
        data-testid="user-welcome-greeting"
        className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pt-0.5"
      >
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight font-display">
          {greetingPrefix}{firstName ? `, ${firstName}` : ''}! 👋
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {pendingBills.length > 0
            ? `${pendingBills.length} lançamento(s) a pagar/receber em ${formatMonthYearPT(selectedMonth)}${selectedMonth === todayMonth && pendingBills.some((tx) => tx.competenceMonth < selectedMonth) ? ', incluindo atrasados' : ''}`
            : `Sem pendências bancárias em ${formatMonthYearPT(selectedMonth)}`}
        </p>
      </header>

      {/* Row 1: 4 Primary Cashflow KPI Metrics (2x2 on Mobile, 4 Columns on Desktop) */}
      <section aria-label="Indicadores financeiros do mês" className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 min-w-0">
        <div className="min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 transition-all hover:border-slate-300 dark:hover:border-slate-700 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 gap-1">
            <span className="truncate" title="Soma das contas marcadas como 'No giro mensal'">
              Saldo em Contas (Hoje)
            </span>
            <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white truncate">
            {formatBRL(monthlySummary.totalCurrentBalance)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
            <span>Patrimônio contas: {formatBRL(health360.liquidBalance)}</span>
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 transition-all hover:border-slate-300 dark:hover:border-slate-700 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 gap-1">
            <span className="truncate" title="Saldo Hoje + Receitas Pendentes - Despesas Pendentes - Faturas Abertas">
              Previsto Fim do Mês
            </span>
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
          </div>
          <p
            className={`mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums truncate ${
              monthlySummary.totalProjectedBalance >= 0
                ? 'text-slate-900 dark:text-white'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {formatBRL(monthlySummary.totalProjectedBalance)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
            <span>Após pendentes e faturas</span>
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 transition-all hover:border-slate-300 dark:hover:border-slate-700 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 gap-1">
            <span className="truncate">Receitas do Mês</span>
            <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 truncate">
            {formatBRL(monthlySummary.incomeTotal)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
            <span>Rec: {formatBRL(monthlySummary.incomeRealized)}</span>
            <span aria-hidden="true" className="hidden sm:inline"> · </span>
            <span className="hidden sm:inline">Falta: {formatBRL(monthlySummary.incomePending)}</span>
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 transition-all hover:border-slate-300 dark:hover:border-slate-700 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 gap-1">
            <span className="truncate">Despesas Totais</span>
            <ArrowDownRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-600 shrink-0" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400 truncate">
            {formatBRL(monthlySummary.expenseTotal)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
            <span>Pago: {formatBRL(monthlySummary.expenseRealized)}</span>
            <span aria-hidden="true" className="hidden sm:inline"> · </span>
            <span className="hidden sm:inline">Pend: {formatBRL(monthlySummary.expensePending)}</span>
          </p>
        </div>
      </section>

      {/* Row 1.5: Raio-X 360º — Score de Saúde Financeira, Patrimônio Consolidado & Livre p/ Gastar Hoje */}
      <section
        aria-label="Raio-X de Saúde Financeira e Patrimônio 360"
        data-testid="overview-financial-health-360"
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs"
      >
        <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Score Badge + Status */}
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div
              className={`flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 flex-col items-center justify-center rounded-xl border font-mono font-extrabold tabular-nums ${
                health360.grade === 'excellent'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : health360.grade === 'good' || health360.grade === 'onboarding'
                  ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                  : health360.grade === 'attention'
                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              }`}
            >
              <span className="text-sm sm:text-base leading-none">{health360.score}</span>
              <span className="text-[9px] font-semibold opacity-75 mt-0.5">/1000</span>
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Índice de Saúde Financeira 360º
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    health360.grade === 'excellent'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : health360.grade === 'good' || health360.grade === 'onboarding'
                      ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                      : health360.grade === 'attention'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  <ShieldCheck className="h-3 w-3" />
                  {health360.gradeLabel}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                {health360.recommendations[0]}
              </p>
            </div>
          </div>

          {/* Center/Right: 3 Executive Wealth & Safe-to-Spend Metrics + Expand Button */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 lg:shrink-0 items-center">
            <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                Patrimônio Líquido
              </p>
              <p
                className={`mt-0.5 text-xs sm:text-sm font-bold font-mono tabular-nums truncate ${
                  health360.netWorth >= 0
                    ? 'text-slate-900 dark:text-white'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {formatBRL(health360.netWorth)}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                Ativos: {formatBRL(health360.investmentsTotal)}
              </p>
            </div>

            <div className="rounded-lg border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 truncate">
                Livre p/ Gastar Hoje
              </p>
              <p className="mt-0.5 text-xs sm:text-sm font-bold font-mono tabular-nums text-emerald-800 dark:text-emerald-300 truncate">
                {formatBRL(health360.safeToSpendPerDay)}
                <span className="text-[10px] font-normal">/dia</span>
              </p>
              <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 truncate">
                Próx. {health360.daysRemainingInMonth} dia(s) do mês
              </p>
            </div>

            <div className="col-span-2 sm:col-span-1 flex items-center justify-between sm:block rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 px-3 py-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                  Autonomia (Reserva)
                </p>
                <p className="mt-0.5 text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white truncate">
                  {health360.runwayMonths} {health360.runwayMonths === 1 ? 'mês' : 'meses'}
                </p>
              </div>
              <button
                type="button"
                data-testid="toggle-health-360-details-btn"
                onClick={() => setIsHealthDetailsOpen((prev) => !prev)}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                <span>{isHealthDetailsOpen ? 'Ocultar pilares' : 'Ver 4 pilares'}</span>
                {isHealthDetailsOpen ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Expandable 4 Pillars & Actionable Coaching Details */}
        {isHealthDetailsOpen && (
          <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/80 p-4 sm:p-5 space-y-4 animate-expand-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>1. Taxa de Poupança</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    {health360.pillars.savingsScore} / 250
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Poupança projetada: <strong>{monthlySummary.savingsRateProjected}%</strong> da renda (meta ideal: ≥20%).
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>2. Reserva de Liquidez</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    {health360.pillars.liquidityScore} / 250
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Cobertura atual: <strong>{health360.runwayMonths} meses</strong> de despesas (meta ideal: 6 meses).
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>3. Uso do Limite (Cartões)</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    {health360.pillars.creditScore} / 250
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Limite tomado: <strong>{health360.creditUsagePercent}%</strong> ({formatBRL(health360.creditCardDebt)}).
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>4. Disciplina de Metas</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    {health360.pillars.budgetDisciplineScore} / 250
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {overBudgetItems.length === 0
                    ? '100% das categorias dentro do teto mensal.'
                    : `${overBudgetItems.length} categoria(s) acima do teto neste mês.`}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-xs">
              <div className="space-y-1 text-slate-600 dark:text-slate-300">
                {health360.recommendations.length > 1 ? (
                  health360.recommendations.slice(1).map((rec, idx) => (
                    <p key={idx} className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>{rec}</span>
                    </p>
                  ))
                ) : (
                  <p className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Metodologia 360º: Combina Poupança (250), Liquidez D+0 (250), Uso de Crédito ≤30% (250) e Orçamento 50/30/20 (250).
                    </span>
                  </p>
                )}
              </div>

            </div>
          </div>
        )}
      </section>

      {/* Structured Budget Alerts Center (Individual Scannable Cards) */}
      {showOverviewAlerts && budgetAlerts.length > 0 && (
        <section
          aria-label="Alertas de orçamento do mês"
          data-testid="overview-budget-alerts"
          className="min-w-0 max-w-full rounded-xl border border-slate-200 bg-white overflow-hidden"
        >
          {/* Alert Header Bar: Desktop Layout */}
          <div className="hidden sm:flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  overBudgetItems.length > 0
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">
                    Acompanhamento de Limites do Orçamento
                  </h2>
                  <span className="text-xs text-slate-500">
                    {overBudgetItems.length > 0 && (
                      <strong className="text-rose-700 font-semibold">
                        {overBudgetItems.length} acima do teto
                      </strong>
                    )}
                    {overBudgetItems.length > 0 && warningBudgetItems.length > 0 && (
                      <span aria-hidden="true"> · </span>
                    )}
                    {warningBudgetItems.length > 0 && (
                      <strong className="text-amber-700 font-semibold">
                        {warningBudgetItems.length} próxima(s) do limite
                      </strong>
                    )}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visualização detalhada por categoria para controle rápido do seu teto mensal
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsAlertsExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                <span>
                  {isAlertsExpanded
                    ? 'Recolher cartões'
                    : `Ver ${budgetAlerts.length} alertas`}
                </span>
                {isAlertsExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('budgets')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-600" />
                Revisar Orçamentos & Categorias
              </button>
            </div>
          </div>

          {/* Alert Header Bar: Mobile Streamlined Layout (No bulky fixed buttons) */}
          <div className="flex sm:hidden items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  overBudgetItems.length > 0
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-slate-900 truncate">Limites do Orçamento</h2>
                <p className="text-[11px] text-slate-500 truncate">
                  {overBudgetItems.length > 0 ? (
                    <span className="text-rose-700 font-semibold">{overBudgetItems.length} acima do teto</span>
                  ) : (
                    <span className="text-amber-700 font-semibold">{warningBudgetItems.length} em alerta</span>
                  )}
                  <span> · {budgetAlerts.length} metas</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('budgets')}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 transition-colors shrink-0"
            >
              <span>Ajustar</span>
              <SlidersHorizontal className="h-3 w-3 text-emerald-600" />
            </button>
          </div>

          {/* Mobile Lateral Swipe Hint Bar */}
          <div className="flex sm:hidden items-center justify-between px-4 py-1.5 bg-slate-100/70 text-[10px] text-slate-500 font-medium border-b border-slate-100">
            <span className="flex items-center gap-1 truncate">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              ← Deslize lateralmente para ver todas →
            </span>
            <span className="font-mono tabular-nums shrink-0">{budgetAlerts.length} alertas</span>
          </div>

          {/* Lateral Swipeable Strip on Mobile / Clean Grid on Desktop */}
          {isAlertsExpanded && (
            <div className="w-full p-3.5 sm:p-5 flex sm:grid overflow-x-auto sm:overflow-x-visible sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 snap-x snap-mandatory no-scrollbar touch-pan-x native-scroll animate-expand-in">
              {budgetAlerts.map((alert) => {
                const isOver = alert.status === 'over';
                const diffAmount = Math.abs(alert.budget - alert.spent);
                return (
                  <div
                    key={alert.categoryId}
                    onClick={() => onNavigateTab('budgets')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigateTab('budgets');
                      }
                    }}
                    className={`group cursor-pointer rounded-xl border p-3.5 transition-all hover:shadow-xs flex flex-col justify-between gap-2.5 w-[76vw] max-w-[280px] sm:w-auto shrink-0 snap-start ${
                      isOver
                        ? 'border-rose-200 bg-rose-50/60 hover:border-rose-300'
                        : 'border-amber-200 bg-amber-50/60 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CategoryIconBadge
                          icon={alert.categoryIcon}
                          color={alert.categoryColor}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {alert.categoryName}
                          </p>
                          <p
                            className={`text-[11px] font-semibold ${
                              isOver ? 'text-rose-700' : 'text-amber-800'
                            }`}
                          >
                            {isOver
                              ? `Excedido +${formatBRL(diffAmount)}`
                              : `Restam ${formatBRL(diffAmount)}`}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-bold font-mono tabular-nums shrink-0 ${
                          isOver ? 'text-rose-700' : 'text-amber-800'
                        }`}
                      >
                        {alert.percentOfBudget}%
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {(() => {
                        const burnRate = calculateMonthBurnRateMarker(
                          selectedMonth,
                          alert.percentOfBudget
                        );
                        return (
                          <>
                            <div className="relative h-1.5 w-full rounded-full bg-slate-200/80">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isOver ? 'bg-rose-600' : 'bg-amber-500'
                                }`}
                                style={{
                                  width: `${Math.min(100, alert.percentOfBudget)}%`,
                                }}
                              />
                              <div
                                data-testid="overview-burn-rate-marker"
                                title={`Ritmo do mês (${burnRate.monthProgressPercent}% decorrido)`}
                                className="pointer-events-none absolute -top-0.5 -bottom-0.5 w-0.5 bg-slate-900/75 rounded-full"
                                style={{ left: `${burnRate.monthProgressPercent}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600">
                              <span>
                                Gasto: <strong className="text-slate-900">{formatBRL(alert.spent)}</strong>
                              </span>
                              <span>Meta: {formatBRL(alert.budget)}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Row 2: Accounts & Pending Bills (2-Column Split) */}
      <div data-testid="overview-accounts-bills-row" className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-w-0">
        {/* Left: Contas & Carteiras */}
        <section data-testid="overview-account-balances" className="lg:col-span-6 min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 sm:px-6 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 truncate">Saldos por Conta e Carteira</h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Controle 100% manual sem vínculo bancário automático
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('accounts')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline whitespace-nowrap shrink-0"
              >
                Gerenciar contas
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {accounts.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <p className="text-xs text-slate-500">
                    Nenhuma conta bancária ou carteira global cadastrada ainda.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('accounts')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                  >
                    + Cadastrar Primeira Conta
                  </button>
                </div>
              ) : (
                accounts.map((acc) => {
                  const bal = accountBalances.find((b) => b.accountId === acc.id);
                  const current = bal?.currentBalance ?? acc.initialBalance;
                  const typeLabel =
                    acc.type === 'checking'
                      ? 'Conta Corrente'
                      : acc.type === 'cash'
                      ? 'Dinheiro'
                      : acc.type === 'investment'
                      ? 'Reserva / Investimento'
                      : acc.type === 'international'
                      ? `Conta Global (${acc.currency || 'EUR'})`
                      : 'Poupança';

                  return (
                    <div
                      key={acc.id}
                      onClick={() =>
                        onNavigateToAccount
                          ? onNavigateToAccount(acc.id)
                          : onNavigateTab('accounts')
                      }
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (onNavigateToAccount) {
                            onNavigateToAccount(acc.id);
                          } else {
                            onNavigateTab('accounts');
                          }
                        }
                      }}
                      className="group cursor-pointer flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 hover:bg-emerald-50/50 transition-colors"
                    >
                      <div className="flex min-w-0 items-center gap-3 pr-2">
                        <InstitutionMark institution={acc.institution} accountName={acc.name} color={acc.color} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                            {acc.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            <span>{acc.institution}</span>
                            <span aria-hidden="true"> · </span>
                            <span>{typeLabel}</span>
                            <span aria-hidden="true"> · </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleAccountInTotal(acc.id);
                              }}
                              className="text-slate-600 underline hover:text-slate-900"
                            >
                              {acc.includeInTotal ? 'No giro mensal' : 'Fora do giro'}
                            </button>
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm font-bold font-mono tabular-nums ${
                            current >= 0 ? 'text-slate-900' : 'text-rose-700'
                          }`}
                        >
                          {formatBRL(current)}
                        </p>
                        <p className="text-xs font-mono tabular-nums text-emerald-700 font-medium">
                          Ver extrato →
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 px-4 sm:px-6 py-3.5 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2 rounded-b-xl">
            <span className="text-xs font-medium text-slate-600">
              Resultado líquido projetado no mês
            </span>
            <span
              className={`text-sm font-bold font-mono tabular-nums ${
                monthlySummary.netResultProjected >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {monthlySummary.netResultProjected >= 0 ? '+' : ''}
              {formatBRL(monthlySummary.netResultProjected)} ({monthlySummary.savingsRateProjected}% da renda)
            </span>
          </div>
        </section>

        {/* Right: Contas a Pagar e a Receber Pendentes (Baixa Rápida & Reversão) */}
        <section data-testid="overview-pending-bills" className="lg:col-span-6 min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
          <div className="min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200 px-4 sm:px-6 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 truncate">
                  Contas a Pagar e a Receber
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {billsFilterMode === 'pending'
                    ? 'Clique em Efetivar ao pagar/receber — ou alterne para Efetivados se marcou errado'
                    : 'Marcou como pago por engano? Clique em Reverter p/ Pendente para voltar ao que era'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0">
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setBillsFilterMode('pending')}
                    className={`rounded-md px-2.5 py-1 transition-all ${
                      billsFilterMode === 'pending'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pendentes ({pendingBills.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillsFilterMode('paid')}
                    className={`rounded-md px-2.5 py-1 transition-all ${
                      billsFilterMode === 'paid'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Efetivados ({paidBankBills.length})
                  </button>
                </div>
              </div>
            </div>

            {billsFilterMode === 'pending' ? (
              pendingBills.length === 0 ? (
                <div className="px-4 sm:px-6 py-12 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-900">
                    Não há contas a pagar ou receber pendentes neste período.
                  </p>
                  {paidBankBills.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Se você efetivou alguma conta por engano, alterne para a aba &ldquo;Efetivados ({paidBankBills.length})&rdquo; acima.
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => onOpenNewTransaction('expense')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agendar Nova Conta
                    </button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto custom-scrollbar">
                  {pendingBills.map((tx) => {
                    const cat = catMap.get(tx.categoryId);
                    const catName = cat?.name || 'Geral';
                    const subName = cat?.subcategories?.find((s) => s.id === tx.subcategoryId)?.name;
                    const accName = accMap.get(tx.accountId || '') || 'Conta';
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <CategoryIconBadge
                            icon={cat?.icon}
                            color={cat?.color}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {tx.description}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                              <span className="font-mono tabular-nums">
                                Vence {formatShortDateBR(tx.date)}
                              </span>
                              {selectedMonth === todayMonth && tx.competenceMonth < selectedMonth && (
                                <span className="ml-1.5 rounded bg-rose-100 px-1 py-0.5 text-[10px] font-bold text-rose-700">
                                  Atrasada
                                </span>
                              )}
                              <span aria-hidden="true"> · </span>
                              <span>
                                {catName}
                                {subName ? ` › ${subName}` : ''}
                              </span>
                              <span aria-hidden="true"> · </span>
                              <span>{accName}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                          <span
                            className={`text-xs sm:text-sm font-bold font-mono tabular-nums ${
                              tx.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {tx.type === 'income' ? '+' : '-'}
                            {formatBRL(tx.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onToggleStatus(tx.id)}
                            aria-label={`Efetivar ${tx.description}`}
                            className="rounded-lg border border-emerald-600/30 bg-emerald-50 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-600 hover:text-white transition-colors whitespace-nowrap shrink-0"
                          >
                            Efetivar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : paidBankBills.length === 0 ? (
              <div className="px-4 sm:px-6 py-12 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  Nenhum lançamento bancário efetivado neste mês ainda.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto custom-scrollbar">
                {paidBankBills.map((tx) => {
                  const cat = catMap.get(tx.categoryId);
                  const catName = cat?.name || 'Geral';
                  const accName = accMap.get(tx.accountId || '') || 'Conta';
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CategoryIconBadge
                          icon={cat?.icon}
                          color={cat?.color}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {tx.description}
                            </p>
                            {tx.isInvoicePayment && (
                              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800 shrink-0">
                                Baixa de Fatura
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            <span className="font-mono tabular-nums">
                              Pago em {formatShortDateBR(tx.date)}
                            </span>
                            <span aria-hidden="true"> · </span>
                            <span>{catName}</span>
                            <span aria-hidden="true"> · </span>
                            <span>{accName}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <span
                          className={`text-xs sm:text-sm font-bold font-mono tabular-nums ${
                            tx.type === 'income' ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '-'}
                          {formatBRL(tx.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onToggleStatus(tx.id)}
                          aria-label={`Reverter ${tx.description} para pendente`}
                          className="rounded-lg border border-amber-500/40 bg-amber-50 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-500 hover:text-white transition-colors whitespace-nowrap shrink-0"
                        >
                          {tx.isInvoicePayment ? '↩ Estornar Fatura' : '↩ Voltar p/ Pendente'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 px-4 sm:px-6 py-3.5 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2 rounded-b-xl">
            <span className="text-xs text-slate-600">
              {pendingBills.length} lançamento(s) bancário(s) aguardando baixa
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('transactions')}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline whitespace-nowrap shrink-0"
            >
              Ver extrato completo
            </button>
          </div>
        </section>
      </div>

      {/* Row 3: Credit Cards & Budget Thermometer */}
      <div data-testid="overview-cards-budgets-row" className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-w-0">
        {/* Credit Cards Summary */}
        <section data-testid="overview-credit-card-summary" className="lg:col-span-6 min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 sm:px-6 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 truncate">Faturas de Cartão de Crédito</h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Controle de parcelamentos e limite comprometido
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('cards')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline whitespace-nowrap shrink-0"
              >
                Gerenciar faturas
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {cards.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <p className="text-xs text-slate-500">
                    Nenhum cartão de crédito cadastrado ainda.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('cards')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                  >
                    + Cadastrar Cartão de Crédito
                  </button>
                </div>
              ) : null}
              {cards.map((card) => {
                const summary = cardSummaries.find((s) => s.cardId === card.id);
                if (!summary) return null;
                return (
                  <div
                    key={card.id}
                    onClick={() =>
                      onNavigateToCard
                        ? onNavigateToCard(card.id)
                        : onNavigateTab('cards')
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (onNavigateToCard) {
                          onNavigateToCard(card.id);
                        } else {
                          onNavigateTab('cards');
                        }
                      }
                    }}
                    className="group cursor-pointer p-4 sm:p-6 space-y-3 hover:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <CreditCardFace card={card} size="compact" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <CreditCardIcon className="h-4 w-4 text-slate-700 group-hover:text-blue-700 shrink-0" />
                            <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                              {card.name}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            <CardNetworkMark brand={card.brand} />
                            <span aria-hidden="true"> · </span>
                            <span>Fecha dia {card.closingDay}</span>
                            <span aria-hidden="true"> · </span>
                            <span>Vence dia {card.dueDay}</span>
                            <span aria-hidden="true"> · </span>
                            <span className={summary.isInvoicePaid ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                              {summary.isInvoicePaid ? 'Fatura Paga' : 'Fatura Aberta'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-500">Fatura do mês</p>
                        <p className="text-base font-bold font-mono tabular-nums text-slate-900">
                          {formatBRL(summary.invoiceTotal)}
                        </p>
                        <p className="text-[11px] font-semibold text-blue-700">
                          Abrir fatura →
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-600 font-mono tabular-nums mb-1">
                        <span>Tomado: {formatBRL(summary.usedLimit)}</span>
                        <span>Disponível: {formatBRL(summary.availableLimit)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all ${
                            summary.usagePercent > 80 ? 'bg-rose-600' : 'bg-slate-800'
                          }`}
                          style={{ width: `${Math.min(100, summary.usagePercent)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-200 px-4 sm:px-6 py-3.5 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2 rounded-b-xl">
            <span className="text-xs text-slate-600 font-mono tabular-nums">
              Total em faturas neste mês: {formatBRL(monthlySummary.creditCardMonthTotal)}
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('cards')}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline whitespace-nowrap shrink-0"
            >
              Ver detalhes dos cartões
            </button>
          </div>
        </section>

        {/* Budget Thermometer */}
        <section data-testid="overview-category-budgets" className="lg:col-span-6 min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 sm:px-6 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 truncate">
                  Teto de Gastos por Categoria
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Progresso frente ao orçamento mensal com alertas de limite
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('budgets')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline whitespace-nowrap shrink-0"
              >
                Gerenciar metas
              </button>
            </div>

            {/* Mobile Lateral Swipeable Cards (< sm screens) */}
            <div className="block sm:hidden p-4 min-w-0 overflow-hidden">
              <div className="flex w-full overflow-x-auto gap-3 snap-x snap-mandatory no-scrollbar touch-pan-x native-scroll pb-1">
                {topCategories.map((item) => {
                  const barColor =
                    item.status === 'over'
                      ? 'bg-rose-600'
                      : item.status === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-emerald-600';
                  return (
                    <div
                      key={item.categoryId}
                      onClick={() => onNavigateTab('budgets')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onNavigateTab('budgets');
                      }}
                      className="w-[72vw] max-w-[260px] shrink-0 snap-start rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/60 dark:bg-slate-800/40 space-y-2 cursor-pointer active:scale-[0.99] transition-transform"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <CategoryIconBadge
                            icon={item.categoryIcon}
                            color={item.categoryColor}
                            size="sm"
                          />
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {item.categoryName}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-xs font-bold shrink-0 ${
                            item.status === 'over'
                              ? 'text-rose-700'
                              : item.status === 'warning'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {item.percentOfBudget}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${Math.min(100, item.percentOfBudget)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        <span>Gasto: <strong>{formatBRL(item.spent)}</strong></span>
                        <span>Teto: {formatBRL(item.budget)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-2 text-center">
                ← Deslize lateralmente para ver mais categorias →
              </p>
            </div>

            {/* Desktop Progress Bars (>= sm screens) */}
            <div className="hidden sm:block p-6 space-y-4">
              {topCategories.map((item) => {
                const barColor =
                  item.status === 'over'
                    ? 'bg-rose-600'
                    : item.status === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-emerald-600';
                const statusLabel =
                  item.status === 'over'
                    ? 'Orçamento Excedido!'
                    : item.status === 'warning'
                    ? 'Alerta: Próximo do Limite (>80%)'
                    : 'Dentro da meta';

                return (
                  <div key={item.categoryId} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 font-medium text-slate-900 min-w-0">
                        <CategoryIconBadge
                          icon={item.categoryIcon}
                          color={item.categoryColor}
                          size="sm"
                        />
                        <span className="truncate">{item.categoryName}</span>
                        <span className="text-slate-400 shrink-0" aria-hidden="true"> · </span>
                        <span
                          className={`truncate ${
                            item.status === 'over'
                              ? 'font-bold text-rose-700'
                              : item.status === 'warning'
                              ? 'font-semibold text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <div className="font-mono tabular-nums text-slate-700 shrink-0">
                        <span className="font-semibold">{formatBRL(item.spent)}</span>
                        <span className="text-slate-400"> / {formatBRL(item.budget)}</span>
                        <span className="ml-1.5 text-slate-500">({item.percentOfBudget}%)</span>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${Math.min(100, item.percentOfBudget)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-200 px-4 sm:px-6 py-3.5 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2 rounded-b-xl">
            <span className="text-xs text-slate-600">
              Inclui gastos à vista no PIX/Boleto e parcelas do cartão no mês
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('reports')}
              className="text-xs font-semibold text-slate-900 hover:underline whitespace-nowrap shrink-0"
            >
              Ver gráficos & relatórios
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
