/** Cálculo dos lembretes do dia (faturas, contas, compartilhados) e resumo. */
import type {
  BankAccount,
  Category,
  CreditCard,
  FamilyMember,
  ReminderItem,
  ReminderSettings,
  ReminderUrgency,
  Transaction,
} from '../../types/finance';
import {
  calculateCreditCardSummary,
  getClampedMonthDate,
  isPendingBankObligation,
} from '../finance/financeRules';
import {
  getSharedChargeDate,
} from '../family/sharedFinanceRules';
import {
  getNextBankBusinessDay,
} from '../finance/businessDays.ts';
import {
  DEFAULT_REMINDER_SETTINGS,
} from './reminderSettings.ts';

export function getDaysDifference(referenceDateStr: string, targetDateStr: string): number {
  if (!referenceDateStr || !targetDateStr) return 0;
  const [refY, refM, refD] = referenceDateStr.split('-').map(Number);
  const [tarY, tarM, tarD] = targetDateStr.split('-').map(Number);
  if (!refY || !tarY) return 0;

  const refUtc = Date.UTC(refY, refM - 1, refD);
  const tarUtc = Date.UTC(tarY, tarM - 1, tarD);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((tarUtc - refUtc) / msPerDay);
}

export interface CalculateRemindersParams {
  transactions: Transaction[];
  cards: CreditCard[];
  categories?: Category[];
  accounts?: BankAccount[];
  familyMembers?: FamilyMember[];
  /** Data de hoje (YYYY-MM-DD). Os avisos dependem só dela, nunca do mês que a pessoa está navegando. */
  referenceDate: string;
  settings?: ReminderSettings;
}

/** Antecedência, em dias, para avisar de contas a pagar (faturas usam a antecedência configurada). */
const BILL_WARNING_DAYS = 3;

function classifyUrgency(daysRemaining: number, warningDays: number): ReminderUrgency | null {
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining === 0) return 'due_today';
  if (daysRemaining <= warningDays) return 'due_soon';
  return null;
}

/**
 * Avisos que exigem atenção hoje: o que está atrasado, vence hoje ou vence nos próximos dias.
 * Não lista o que ainda está longe (isso fica em "Contas a pagar") e considera pendências de qualquer
 * mês, para que um atraso antigo nunca desapareça só porque o mês navegado mudou.
 */
export function calculateDailyReminders({
  transactions,
  cards,
  categories = [],
  accounts = [],
  familyMembers = [],
  referenceDate,
  settings = DEFAULT_REMINDER_SETTINGS,
}: CalculateRemindersParams): ReminderItem[] {
  const reminders: ReminderItem[] = [];
  const invoiceWarningDays = settings.daysBeforeInvoiceDue ?? 3;

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const memberMap = new Map(familyMembers.map((m) => [m.id, m.name]));

  // 1. Faturas de cartão em aberto, de qualquer competência, vencidas ou perto de vencer
  if (settings.notifyInvoiceDue) {
    for (const card of cards) {
      const invoiceMonths = new Set(
        transactions
          .filter((tx) => tx.creditCardId === card.id && tx.status === 'pending' && tx.competenceMonth)
          .map((tx) => tx.competenceMonth)
      );
      for (const invoiceMonth of invoiceMonths) {
        const invoice = calculateCreditCardSummary(card, transactions, invoiceMonth, referenceDate);
        if (invoice.invoicePendingAmount <= 0) continue;

        // Vencimento em fim de semana/feriado pode ser pago no próximo dia útil sem atraso.
        const officialDueDate = getClampedMonthDate(invoiceMonth, card.dueDay);
        const dueDate = getNextBankBusinessDay(officialDueDate);
        const daysRemaining = getDaysDifference(referenceDate, dueDate);
        const urgency = classifyUrgency(daysRemaining, invoiceWarningDays);
        if (!urgency) continue;

        const actualDueDay = dueDate !== officialDueDate
          ? dueDate.split('-').reverse().slice(0, 2).join('/')
          : String(Number(dueDate.slice(-2)));
        const postponedNote = dueDate !== officialDueDate
          ? `; o dia ${Number(officialDueDate.slice(-2))} cai em fim de semana ou feriado`
          : '';
        reminders.push({
          id: `card-due-${card.id}-${invoiceMonth}`,
          type: 'invoice_due',
          title: `Fatura ${card.name}`,
          description:
            daysRemaining < 0
              ? `Fatura vencida há ${Math.abs(daysRemaining)} ${Math.abs(daysRemaining) === 1 ? 'dia' : 'dias'} (Venceu dia ${actualDueDay}${postponedNote})`
              : daysRemaining === 0
              ? `Fatura vence hoje! (Dia ${actualDueDay}${postponedNote})`
              : `Vencimento em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} (Dia ${actualDueDay}${postponedNote})`,
          amount: invoice.invoicePendingAmount,
          dueDate,
          urgency,
          daysRemaining,
          cardId: card.id,
        });
      }
    }
  }

  // 2. Contas e boletos pendentes (cartão é coberto pela fatura), atrasados ou perto de vencer
  if (settings.notifyPendingBills) {
    const pendingExpenses = transactions.filter(
      (tx) => isPendingBankObligation(tx) && tx.type === 'expense' && !tx.isInvoicePayment
    );

    for (const tx of pendingExpenses) {
      const isFixed = tx.recurrence === 'fixed';
      if (isFixed && settings.notifyRecurringEntries === false) continue;

      // Boleto que vence em fim de semana/feriado pode ser pago no próximo dia útil.
      const billDueDate = tx.paymentMethod === 'boleto' ? getNextBankBusinessDay(tx.date) : tx.date;
      const daysRemaining = getDaysDifference(referenceDate, billDueDate);
      const urgency = classifyUrgency(daysRemaining, BILL_WARNING_DAYS);
      if (!urgency) continue;

      const catName = categoryMap.get(tx.categoryId);
      const accName = tx.accountId ? accountMap.get(tx.accountId) : undefined;

      reminders.push({
        id: `tx-pending-${tx.id}`,
        type: isFixed ? 'recurring_check' : 'pending_bill',
        title: tx.description,
        description:
          daysRemaining < 0
            ? `Pendente e atrasado há ${Math.abs(daysRemaining)} ${Math.abs(daysRemaining) === 1 ? 'dia' : 'dias'} (${billDueDate.split('-').reverse().slice(0, 2).join('/')})`
            : daysRemaining === 0
            ? `Vencimento agendado para hoje!`
            : `Vencimento em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} (${billDueDate.split('-').reverse().slice(0, 2).join('/')})`,
        amount: tx.amount,
        dueDate: billDueDate,
        urgency,
        daysRemaining,
        transactionId: tx.id,
        categoryName: catName,
        accountName: accName,
        isFixedRecurring: isFixed,
      });
    }
  }

  // 3. Reembolsos de familiares a cobrar. O momento da cobrança é o vencimento da fatura (compra no
  // cartão) ou a data do lançamento; nunca o dia em que a compra foi feita no cartão.
  if (settings.notifySharedReimbursements) {
    const pendingShared = transactions.filter(
      (tx) => tx.isShared && tx.sharedStatus === 'pending' && (tx.sharedAmount ?? 0) > 0
    );

    for (const tx of pendingShared) {
      const chargeDate = getSharedChargeDate(tx, cards);
      const daysRemaining = getDaysDifference(referenceDate, chargeDate);
      const urgency = classifyUrgency(daysRemaining, BILL_WARNING_DAYS);
      if (!urgency) continue;

      const memberName = tx.sharedMemberId ? memberMap.get(tx.sharedMemberId) : 'Familiar';
      // Outra pessoa pagou e eu devo a minha parte: é um pagamento meu, não um reembolso a receber.
      const iOwe = tx.sharedPaidBy === 'member';
      reminders.push({
        id: `shared-pending-${tx.id}`,
        type: 'shared_pending',
        title: iOwe ? `Pagar a ${memberName || 'Familiar'}` : `Reembolso de ${memberName || 'Familiar'}`,
        description: iOwe ? `Sua parte de "${tx.description}"` : `Rateio pendente de "${tx.description}"`,
        amount: tx.sharedAmount ?? 0,
        dueDate: chargeDate,
        urgency,
        daysRemaining,
        transactionId: tx.id,
        memberId: tx.sharedMemberId,
      });
    }
  }

  // Ordem: atrasados (mais antigos primeiro), vencem hoje, vencem em breve
  const urgencyWeight: Record<ReminderUrgency, number> = {
    overdue: 1,
    due_today: 2,
    due_soon: 3,
    upcoming: 4,
  };

  return reminders.sort((a, b) => {
    const weightDiff = urgencyWeight[a.urgency] - urgencyWeight[b.urgency];
    if (weightDiff !== 0) return weightDiff;
    return a.daysRemaining - b.daysRemaining;
  });
}

/**
 * Resumo numérico dos lembretes para badges, banners e alertas.
 */
export function summarizeReminders(reminders: ReminderItem[]) {
  const overdueCount = reminders.filter((r) => r.urgency === 'overdue').length;
  const dueTodayCount = reminders.filter((r) => r.urgency === 'due_today').length;
  const dueSoonCount = reminders.filter((r) => r.urgency === 'due_soon').length;
  const urgentCount = overdueCount + dueTodayCount + dueSoonCount;
  const totalPendingAmount = reminders.reduce((sum, r) => sum + Math.round(r.amount * 100), 0) / 100;

  return {
    totalCount: reminders.length,
    overdueCount,
    dueTodayCount,
    dueSoonCount,
    urgentCount,
    totalPendingAmount: Math.round(totalPendingAmount * 100) / 100,
  };
}

/**
 * Gera mensagem descritiva concisa para notificação diária (Web Notification ou banner).
 */
