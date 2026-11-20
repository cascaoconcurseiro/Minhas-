import type {
  AccountBalanceSummary,
  CreditCardSummary,
  InvestmentAsset,
  Transaction,
} from '../../types/finance';
import { sortChronologically } from './transactionOrdering.ts';
import {
  getEffectiveExpenseAmountForUser,
} from './monthlyReports.ts';
import {
  getConsumptionMonth,
  isOutsidePersonalResult,
} from './transactionClassification.ts';
import {
  CurrentPosition,
  calculateNetWorth,
} from './wealthAndHealth.ts';

export function isInvestmentIncome(tx: Transaction): boolean {
  return tx.type === 'income' && tx.categoryId === 'cat-rendimentos' &&
    !tx.isInvoicePayment && !isOutsidePersonalResult(tx) && tx.sharedPaidBy !== 'member' &&
    !tx.id.startsWith('tx-reimb-') &&
    !tx.description.toLowerCase().includes('reembolso compartilhado') &&
    !tx.description.toLowerCase().includes('acerto compensado');
}

export function calculateInvestmentIncomeSummary(transactions: Transaction[], month: string) {
  const income = transactions.filter(isInvestmentIncome);
  const monthTransactions = sortChronologically(income.filter((tx) => tx.competenceMonth === month));
  const sum = (rows: Transaction[]) => rows.reduce((total, tx) => total + Math.round(tx.amount * 100), 0) / 100;
  return { monthTransactions, monthTotal: sum(monthTransactions), registeredTotal: sum(income) };
}

export function calculatePersonalDre(
  transactions: Transaction[],
  selectedMonth: string,
  accountBalances: AccountBalanceSummary[],
  investments: InvestmentAsset[],
  cardSummaries: CreditCardSummary[],
  currentPosition?: CurrentPosition,
  receivablesTotal = 0
) {
  const monthTxs = transactions.filter(
    (tx) =>
      getConsumptionMonth(tx) === selectedMonth &&
      !tx.isInvoicePayment &&
      !isOutsidePersonalResult(tx)
  );
  let operationalIncome = 0;
  let dividendIncome = 0;
  let consumptionExpenses = 0;
  let investmentContributions = 0;
  let investmentWithdrawals = 0;
  let realizedCapitalGainCents = 0;

  for (const tx of monthTxs) {
    if (tx.type === 'income') {
      if (tx.sharedPaidBy === 'member') continue;
      if (isInvestmentIncome(tx)) {
        dividendIncome = Math.round((dividendIncome + tx.amount) * 100) / 100;
      } else {
        operationalIncome += tx.amount;
      }
    } else if (tx.type === 'expense') {
      const effective = getEffectiveExpenseAmountForUser(tx);
      if (!effective) continue;
      if (tx.categoryId === 'cat-aportes' || tx.categoryId === 'cat-rendimentos') {
        investmentContributions += effective.amount;
      } else {
        consumptionExpenses += effective.amount;
      }
    } else if (tx.type === 'transfer' && tx.targetInvestmentAssetId && tx.accountId && !tx.destinationAccountId) {
      investmentContributions += tx.amount;
    } else if (tx.type === 'transfer' && tx.targetInvestmentAssetId && tx.destinationAccountId && !tx.accountId) {
      // Resgate/venda: o dinheiro volta para a conta. Não é receita (o principal já era seu), mas é caixa do mês.
      investmentWithdrawals = Math.round((investmentWithdrawals + tx.amount) * 100) / 100;
      if (typeof tx.realizedGain === 'number' && Number.isFinite(tx.realizedGain)) {
        realizedCapitalGainCents += Math.round(tx.realizedGain * 100);
      }
    }
  }

  const totalIncome = Math.round((operationalIncome + dividendIncome) * 100) / 100;
  const freeCashFlowBeforeInvestments = totalIncome - consumptionExpenses;
  const netSurplusAfterInvestments =
    Math.round((freeCashFlowBeforeInvestments - investmentContributions + investmentWithdrawals) * 100) / 100;

  const { liquidAccountsBalance, investedAssetsValue, creditCardDebt, receivablesTotal: receivablesAsset, totalNetWorth } = calculateNetWorth(
    currentPosition?.accountBalances ?? accountBalances,
    investments,
    currentPosition?.cardSummaries ?? cardSummaries,
    receivablesTotal
  );

  return {
    operationalIncome,
    dividendIncome,
    totalIncome,
    consumptionExpenses,
    investmentContributions,
    investmentWithdrawals,
    /** Lucro (ou prejuízo) das vendas do mês sobre o preço médio. Informativo: já está dentro dos resgates. */
    realizedCapitalGain: realizedCapitalGainCents / 100,
    freeCashFlowBeforeInvestments,
    netSurplusAfterInvestments,
    liquidAccountsBalance,
    investedAssetsValue,
    creditCardDebt,
    receivablesTotal: receivablesAsset,
    totalNetWorth,
  };
}
