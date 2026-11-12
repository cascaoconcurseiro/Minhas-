import type { BankAccount, Category, CreditCard, FamilyMember, Transaction } from '../types/finance';
import {
  addMonthsToYearMonth,
  calculateCategoryBreakdown,
  calculateMonthlySummary,
  formatBRL,
  formatMonthYearPT,
} from './financeRules';

/**
 * Resumo do mês em linguagem simples, gerado das próprias regras do sistema (sem enviar dados para
 * fora). Cada frase só aparece quando há dado para sustentá-la.
 */
export interface MonthlyInsight {
  id: string;
  tone: 'good' | 'warn' | 'info';
  text: string;
}

const MIN_CHANGE_PERCENT = 5;
const CATEGORY_MIN_INCREASE = 100;
const CATEGORY_MIN_PERCENT = 30;

function monthName(month: string): string {
  return formatMonthYearPT(month).split(' ')[0].toLowerCase();
}

function percentChange(current: number, previous: number): number {
  return Math.round(((current - previous) / previous) * 100);
}

export function buildMonthlyInsights(params: {
  accounts: BankAccount[];
  cards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  familyMembers: FamilyMember[];
  selectedMonth: string;
  /** Data de hoje (YYYY-MM-DD): define se o mês ainda está em andamento. */
  referenceDate: string;
}): MonthlyInsight[] {
  const { accounts, cards, categories, transactions, familyMembers, selectedMonth, referenceDate } = params;
  const insights: MonthlyInsight[] = [];
  const isCurrentMonth = referenceDate.slice(0, 7) === selectedMonth;
  const previousMonth = addMonthsToYearMonth(selectedMonth, -1);

  const summary = calculateMonthlySummary(accounts, cards, transactions, selectedMonth);
  const previous = calculateMonthlySummary(accounts, cards, transactions, previousMonth);
  const breakdown = calculateCategoryBreakdown(categories, transactions, selectedMonth);
  const previousBreakdown = calculateCategoryBreakdown(categories, transactions, previousMonth);
  const spent = summary.expenseTotal;

  // 1. Quanto gastou e como compara com o mês anterior
  if (spent > 0) {
    if (isCurrentMonth) {
      insights.push({
        id: 'spending',
        tone: 'info',
        text:
          previous.expenseTotal > 0
            ? `Até agora você gastou ${formatBRL(spent)} em ${monthName(selectedMonth)}. ${monthName(previousMonth)} fechou em ${formatBRL(previous.expenseTotal)}.`
            : `Até agora você gastou ${formatBRL(spent)} em ${monthName(selectedMonth)}.`,
      });
    } else if (previous.expenseTotal > 0) {
      const change = percentChange(spent, previous.expenseTotal);
      if (Math.abs(change) >= MIN_CHANGE_PERCENT) {
        insights.push({
          id: 'spending',
          tone: change > 0 ? 'warn' : 'good',
          text: `Você gastou ${formatBRL(spent)} em ${monthName(selectedMonth)}, ${Math.abs(change)}% ${change > 0 ? 'a mais' : 'a menos'} que em ${monthName(previousMonth)} (${formatBRL(previous.expenseTotal)}).`,
        });
      } else {
        insights.push({
          id: 'spending',
          tone: 'info',
          text: `Você gastou ${formatBRL(spent)} em ${monthName(selectedMonth)}, no mesmo nível de ${monthName(previousMonth)}.`,
        });
      }
    } else {
      insights.push({ id: 'spending', tone: 'info', text: `Você gastou ${formatBRL(spent)} em ${monthName(selectedMonth)}.` });
    }
  }

  // 2. Para onde foi a maior parte
  const top = [...breakdown]
    .filter((item) => item.bucket !== 'financial' && item.spent > 0)
    .sort((a, b) => b.spent - a.spent)[0];
  if (top && spent > 0) {
    insights.push({
      id: 'top-category',
      tone: 'info',
      text: `A maior parte foi para ${top.categoryName}: ${formatBRL(top.spent)} (${Math.round((top.spent / spent) * 100)}% dos gastos).`,
    });
  }

  // 3. O que mais subiu contra o mês anterior (só em mês fechado: mês em andamento engana)
  if (!isCurrentMonth) {
    const previousByCategory = new Map(previousBreakdown.map((item) => [item.categoryId, item.spent]));
    const jump = breakdown
      .filter((item) => item.bucket !== 'financial')
      .map((item) => ({ item, before: previousByCategory.get(item.categoryId) ?? 0 }))
      .filter(({ item, before }) => before > 0 && item.spent - before >= CATEGORY_MIN_INCREASE && percentChange(item.spent, before) >= CATEGORY_MIN_PERCENT)
      .sort((a, b) => b.item.spent - b.before - (a.item.spent - a.before))[0];
    if (jump) {
      insights.push({
        id: 'category-jump',
        tone: 'warn',
        text: `${jump.item.categoryName} subiu ${formatBRL(jump.item.spent - jump.before)} (+${percentChange(jump.item.spent, jump.before)}%) em relação a ${monthName(previousMonth)}.`,
      });
    }
  }

  // 4. Tetos estourados
  const over = breakdown.filter((item) => item.budget > 0 && item.spent > item.budget);
  if (over.length > 0) {
    insights.push({
      id: 'over-budget',
      tone: 'warn',
      text: `Passou do teto: ${over.map((item) => `${item.categoryName} (${formatBRL(item.spent)} de ${formatBRL(item.budget)})`).join(', ')}.`,
    });
  }

  // 5. Sobrou ou faltou (só quando o mês está fechado ou já houve entrada)
  if (summary.incomeTotal > 0 && spent > 0) {
    const left = summary.incomeTotal - spent;
    if (left < 0) {
      insights.push({
        id: 'balance',
        tone: 'warn',
        text: `Você ${isCurrentMonth ? 'está gastando' : 'gastou'} ${formatBRL(Math.abs(left))} a mais do que ${isCurrentMonth ? 'entrou' : 'recebeu'} em ${monthName(selectedMonth)}.`,
      });
    } else if (!isCurrentMonth) {
      const rate = Math.round((left / summary.incomeTotal) * 100);
      insights.push({
        id: 'balance',
        tone: rate >= 20 ? 'good' : 'info',
        text: `Sobrou ${formatBRL(left)} em ${monthName(selectedMonth)} (${rate}% do que você recebeu).`,
      });
    }
  }

  // 6. Divisão com família: quanto ainda falta receber (de qualquer mês)
  const owed = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.isShared || tx.sharedStatus !== 'pending' || tx.sharedPaidBy === 'member' || !tx.sharedMemberId || tx.type !== 'expense') continue;
    owed.set(tx.sharedMemberId, (owed.get(tx.sharedMemberId) ?? 0) + (tx.sharedAmount ?? 0));
  }
  const names = new Map(familyMembers.map((member) => [member.id, member.name]));
  for (const [memberId, amount] of [...owed].sort((a, b) => b[1] - a[1])) {
    if (amount < 0.01) continue;
    insights.push({
      id: `owed-${memberId}`,
      tone: 'info',
      text: `${names.get(memberId) ?? 'Um familiar'} ainda te deve ${formatBRL(Math.round(amount * 100) / 100)} de gastos divididos.`,
    });
  }

  // 7. Faturas de cartão do mês
  if (summary.creditCardMonthTotal > 0) {
    insights.push({
      id: 'cards',
      tone: 'info',
      text: `As faturas de cartão deste mês somam ${formatBRL(summary.creditCardMonthTotal)}.`,
    });
  }

  return insights;
}
