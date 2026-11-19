import type {
  AccountBalanceSummary,
  BankAccount,
  CategorySpendItem,
  CreditCard,
  CreditCardSummary,
  InvestmentAsset,
  MonthlyFinancialSummary,
  Transaction,
} from '../../types/finance';
import {
  formatBRL,
  getLocalDateISO,
  formatMonthYearPT,
} from './formatting.ts';
import {
  calculateAccountBalances,
} from './accountBalances.ts';
import {
  calculateCreditCardSummary,
} from './creditCardInvoices.ts';

export interface FinancialHealthScore360 {
  score: number; // 0 to 1000 (FEBRABAN / Planejamento Pessoal index)
  grade: 'excellent' | 'good' | 'attention' | 'critical' | 'onboarding';
  gradeLabel: string;
  pillars: {
    savingsScore: number; // 0-250
    liquidityScore: number; // 0-250
    creditScore: number; // 0-250
    budgetDisciplineScore: number; // 0-250
  };
  netWorth: number; // Contas + Investimentos - Passivo de Cartões
  liquidBalance: number; // Saldo total em contas bancárias
  investmentsTotal: number; // Valor de mercado da carteira de ativos
  creditCardDebt: number; // Limite total tomado em cartões
  creditUsagePercent: number; // % de uso do limite total de cartões
  runwayMonths: number; // Meses de custo de vida cobertos pela reserva líquida
  safeToSpendPerDay: number; // Orçamento livre por dia até o fim do mês
  daysRemainingInMonth: number;
  isCleanStart: boolean;
  recommendations: string[];
}

/**
 * Calcula o Score de Saúde Financeira 360º (0 a 1000 pontos), Patrimônio Líquido Consolidado,
 * Autonomia de Reserva de Emergência (Runway em meses) e o indicador "Livre para Gastar por Dia"
 * (Safe-to-Spend).
 */
/**
 * Posição de hoje: saldos das contas e faturas em aberto na data de referência, sem depender do mês
 * que a pessoa está navegando. Patrimônio e saldo total devem sempre partir daqui.
 */
export interface CurrentPosition {
  accountBalances: AccountBalanceSummary[];
  cardSummaries: CreditCardSummary[];
}

export function calculateCurrentPosition(
  accounts: BankAccount[],
  cards: CreditCard[],
  transactions: Transaction[],
  referenceDate: string = getLocalDateISO()
): CurrentPosition {
  const currentMonth = referenceDate.slice(0, 7);
  const futureInvoicePaymentIds = new Set(transactions
    .filter((tx) => tx.isInvoicePayment && tx.date > referenceDate)
    .map((tx) => tx.id));
  const cardTransactions = futureInvoicePaymentIds.size === 0 ? transactions : transactions.map((tx) =>
    tx.invoicePaymentId && futureInvoicePaymentIds.has(tx.invoicePaymentId)
      ? { ...tx, status: 'pending' as const }
      : tx);
  return {
    accountBalances: calculateAccountBalances(accounts, transactions, currentMonth, referenceDate),
    cardSummaries: cards.map((card) =>
      calculateCreditCardSummary(card, cardTransactions, currentMonth, referenceDate)
    ),
  };
}

export function calculateNetWorth(
  accountBalances: AccountBalanceSummary[],
  investments: InvestmentAsset[],
  cardSummaries: CreditCardSummary[],
  /** Valores a receber de outras pessoas (fatura de cartão adicional, empréstimos). Contam como ativo. */
  receivablesTotal = 0
) {
  const receivables = Math.round(Math.max(0, receivablesTotal) * 100) / 100;
  const liquidAccountsBalance = Math.round(accountBalances.reduce((sum, item) => sum + item.currentBalance, 0) * 100) / 100;
  const investedAssetsValue = investments.reduce((sum, asset) => sum + Math.round(Math.max(0, asset.quantity) * Math.max(0, asset.currentPrice) * 100), 0) / 100;
  const creditCardDebt = Math.round(cardSummaries.reduce((sum, card) => sum + Math.max(0, card.usedLimit), 0) * 100) / 100;
  return { liquidAccountsBalance, investedAssetsValue, creditCardDebt, receivablesTotal: receivables,
    totalNetWorth: Math.round((liquidAccountsBalance + investedAssetsValue + receivables - creditCardDebt) * 100) / 100 };
}

export function calculateFinancialHealthScore360(params: {
  selectedMonth: string;
  monthlySummary: MonthlyFinancialSummary;
  accounts: BankAccount[];
  accountBalances: AccountBalanceSummary[];
  cards: CreditCard[];
  cardSummaries: CreditCardSummary[];
  categoryBreakdown: CategorySpendItem[];
  investments?: InvestmentAsset[];
  referenceDateIso?: string;
  /** Posição de hoje para patrimônio e dívida de cartão; sem isso usa o mês selecionado. */
  currentPosition?: CurrentPosition;
  receivablesTotal?: number;
}): FinancialHealthScore360 {
  const {
    selectedMonth,
    monthlySummary,
    accounts,
    accountBalances,
    cards,
    cardSummaries,
    categoryBreakdown,
    investments = [],
    referenceDateIso,
    currentPosition,
    receivablesTotal = 0,
  } = params;

  const wealth = calculateNetWorth(
    currentPosition?.accountBalances ?? accountBalances,
    investments,
    currentPosition?.cardSummaries ?? cardSummaries,
    receivablesTotal
  );
  const liquidBalance = wealth.liquidAccountsBalance;
  const investmentsTotal = wealth.investedAssetsValue;

  const liquidInvestmentsTotal =
    Math.round(
      investments
        .filter((inv) => inv.liquidity !== 'No Vencimento')
        .reduce(
          (sum, inv) => sum + Math.max(0, inv.quantity) * Math.max(0, inv.currentPrice),
          0
        ) * 100
    ) / 100;

  const creditCardDebt = wealth.creditCardDebt;

  const totalCreditLimit = cards.reduce((sum, c) => sum + Math.max(0, c.limit), 0);
  const creditUsagePercent =
    totalCreditLimit > 0
      ? Math.round((creditCardDebt / totalCreditLimit) * 1000) / 10
      : 0;

  const netWorth = wealth.totalNetWorth;

  // Days remaining in selectedMonth
  const [yStr, mStr] = selectedMonth.split('-');
  const year = Number(yStr) || 2026;
  const monthIdx = (Number(mStr) || 1) - 1;
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  const todayIso = referenceDateIso || getLocalDateISO();
  const currentYearMonth = todayIso.slice(0, 7);

  let daysRemainingInMonth = daysInMonth;
  if (selectedMonth === currentYearMonth) {
    const todayDay = Number(todayIso.slice(8, 10)) || 1;
    daysRemainingInMonth = Math.max(1, daysInMonth - todayDay + 1);
  } else if (selectedMonth < currentYearMonth) {
    daysRemainingInMonth = 1;
  }

  // Safe to spend per day based on projected monthly surplus or remaining budget
  const totalCategoryBudget = categoryBreakdown.reduce((s, c) => s + c.budget, 0);
  const totalCategorySpent = categoryBreakdown.reduce((s, c) => s + c.spent, 0);
  const remainingCategoryRoom =
    totalCategoryBudget > 0 ? Math.max(0, totalCategoryBudget - totalCategorySpent) : 0;

  const positiveSurplusRoom = Math.max(0, monthlySummary.netResultProjected);
  const effectiveDisposableRoom =
    monthlySummary.incomeTotal > 0
      ? positiveSurplusRoom
      : remainingCategoryRoom > 0
      ? remainingCategoryRoom
      : Math.max(0, monthlySummary.totalProjectedBalance);

  const safeToSpendPerDay =
    daysRemainingInMonth > 0
      ? Math.round((effectiveDisposableRoom / daysRemainingInMonth) * 100) / 100
      : 0;

  // Runway in months (Emergency reserve coverage)
  const monthlyBaselineExpense =
    monthlySummary.expenseTotal > 0
      ? monthlySummary.expenseTotal
      : totalCategoryBudget > 0
      ? totalCategoryBudget
      : 0;

  const totalEmergencyLiquidity = Math.max(0, liquidBalance + liquidInvestmentsTotal);
  const runwayMonths =
    monthlyBaselineExpense > 0
      ? Math.round((totalEmergencyLiquidity / monthlyBaselineExpense) * 10) / 10
      : totalEmergencyLiquidity > 0
      ? 12
      : 0;

  const isCleanStart =
    creditCardDebt === 0 &&
    accounts.length === 0 &&
    investments.length === 0 &&
    monthlySummary.incomeTotal === 0 &&
    monthlySummary.expenseTotal === 0;

  if (isCleanStart) {
    return {
      score: 750,
      grade: 'onboarding',
      gradeLabel: 'Base Pronta p/ Ativação',
      pillars: {
        savingsScore: 200,
        liquidityScore: 180,
        creditScore: 250,
        budgetDisciplineScore: 120,
      },
      netWorth: 0,
      liquidBalance: 0,
      investmentsTotal: 0,
      creditCardDebt: 0,
      creditUsagePercent: 0,
      runwayMonths: 0,
      safeToSpendPerDay: 0,
      daysRemainingInMonth,
      isCleanStart: true,
      recommendations: [
        'Cadastre sua primeira conta bancária ou carteira digital para acompanhar seu saldo líquido.',
        'Registre suas receitas e despesas do mês para ativar o cálculo automático de Livre p/ Gastar Hoje.',
        'Defina metas de orçamento na Regra 50/30/20 para monitorar seu índice de saúde financeira.',
      ],
    };
  }

  // 1. Savings Score (0-250)
  let savingsScore = 0;
  if (monthlySummary.incomeTotal > 0) {
    if (monthlySummary.savingsRateProjected >= 20) {
      savingsScore = 250;
    } else if (monthlySummary.savingsRateProjected >= 0) {
      savingsScore = Math.round(125 + (monthlySummary.savingsRateProjected / 20) * 125);
    } else {
      const deficitRatio = Math.min(
        1,
        Math.abs(monthlySummary.netResultProjected) / monthlySummary.incomeTotal
      );
      savingsScore = Math.max(0, Math.round(100 * (1 - deficitRatio)));
    }
  } else if (monthlySummary.expenseTotal === 0) {
    savingsScore = 180;
  } else {
    savingsScore = 60;
  }

  // 2. Liquidity & Emergency Runway Score (0-250)
  let liquidityScore = 0;
  if (runwayMonths >= 6) {
    liquidityScore = 250;
  } else if (runwayMonths > 0) {
    liquidityScore = Math.round((runwayMonths / 6) * 250);
  } else if (liquidBalance > 0) {
    liquidityScore = 150;
  }

  // 3. Credit Card Limit Utilization Score (0-250)
  let creditScore = 250;
  if (cards.length > 0 && totalCreditLimit > 0) {
    if (creditUsagePercent <= 30) {
      creditScore = 250;
    } else if (creditUsagePercent <= 70) {
      creditScore = Math.round(250 - ((creditUsagePercent - 30) / 40) * 130);
    } else {
      creditScore = Math.max(
        0,
        Math.round(120 - ((Math.min(100, creditUsagePercent) - 70) / 30) * 120)
      );
    }
  }

  // 4. Budget Discipline Score (0-250)
  const overCount = categoryBreakdown.filter((c) => c.status === 'over').length;
  const warningCount = categoryBreakdown.filter((c) => c.status === 'warning').length;
  const budgetDisciplineScore = Math.max(
    0,
    250 - overCount * 55 - warningCount * 20
  );

  const score = Math.min(
    1000,
    Math.max(0, savingsScore + liquidityScore + creditScore + budgetDisciplineScore)
  );

  let grade: FinancialHealthScore360['grade'] = 'good';
  let gradeLabel = 'Saudável';
  if (score >= 800) {
    grade = 'excellent';
    gradeLabel = 'Excelente (Referência)';
  } else if (score >= 650) {
    grade = 'good';
    gradeLabel = 'Saudável';
  } else if (score >= 450) {
    grade = 'attention';
    gradeLabel = 'Atenção Moderada';
  } else {
    grade = 'critical';
    gradeLabel = 'Crítico · Requer Ajuste';
  }

  const recommendations: string[] = [];
  if (
    monthlySummary.incomeTotal === 0 &&
    monthlySummary.expenseTotal === 0 &&
    liquidBalance > 0
  ) {
    recommendations.push(
      `Ciclo de ${formatMonthYearPT(
        selectedMonth
      )} iniciado com saldo acumulado de ${formatBRL(
        liquidBalance
      )}. Registre as receitas e despesas previstas do mês para calibrar sua meta de poupança.`
    );
  } else if (monthlySummary.netResultProjected < 0) {
    recommendations.push(
      `Suas despesas superam as receitas em ${formatBRL(
        Math.abs(monthlySummary.netResultProjected)
      )} neste mês. Priorize renegociar ou adiar gastos variáveis.`
    );
  } else if (
    monthlySummary.incomeTotal > 0 &&
    monthlySummary.savingsRateProjected < 20
  ) {
    const missingTo20 = Math.max(
      0,
      monthlySummary.incomeTotal * 0.2 - monthlySummary.netResultProjected
    );
    recommendations.push(
      `Você está poupando ${monthlySummary.savingsRateProjected}% da renda. Economize mais ${formatBRL(
        missingTo20
      )} para atingir o padrão ouro de 20%.`
    );
  }

  if (overCount > 0) {
    recommendations.push(
      `${overCount} categoria(s) ultrapassaram o teto mensal. Revise os alertas de orçamento para reequilibrar o mês.`
    );
  }

  if (runwayMonths < 6 && monthlyBaselineExpense > 0) {
    recommendations.push(
      `Sua reserva de liquidez cobre ${runwayMonths} mês(es) do seu custo mensal (meta ideal: 6 meses em Tesouro Selic / CDB D+0).`
    );
  }

  if (creditUsagePercent > 50) {
    recommendations.push(
      `Você está utilizando ${creditUsagePercent}% do limite total dos cartões. Manter abaixo de 30% preserva sua saúde de crédito.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      'Parabéns! Seu fluxo de caixa, reserva de liquidez e limites de cartão estão no padrão máximo de excelência.'
    );
  }

  return {
    score,
    grade,
    gradeLabel,
    pillars: {
      savingsScore,
      liquidityScore,
      creditScore,
      budgetDisciplineScore,
    },
    netWorth,
    liquidBalance,
    investmentsTotal,
    creditCardDebt,
    creditUsagePercent,
    runwayMonths,
    safeToSpendPerDay,
    daysRemainingInMonth,
    isCleanStart: false,
    recommendations: recommendations.slice(0, 3),
  };
}
