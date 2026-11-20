/** Quando disparar notificação ou e-mail e o texto da mensagem. */
import type {
  ReminderItem,
  ReminderRecurrence,
  ReminderSettings,
} from '../../types/finance';
import {
  formatBRL,
} from '../finance/financeRules';
import {
  getDaysDifference,
  summarizeReminders,
} from './reminderCalculation.ts';
import {
  matchesRecurrenceSchedule,
} from './reminderSettings.ts';

export function formatReminderNotificationMessage(reminders: ReminderItem[]): {
  title: string;
  body: string;
} {
  const summary = summarizeReminders(reminders);
  if (summary.totalCount === 0) {
    return {
      title: 'Tudo em dia! ✨',
      body: 'Você não tem faturas ou contas pendentes próximas de vencer.',
    };
  }

  const parts: string[] = [];
  if (summary.overdueCount > 0) {
    parts.push(`${summary.overdueCount} em atraso`);
  }
  if (summary.dueTodayCount > 0) {
    parts.push(`${summary.dueTodayCount} vencendo hoje`);
  }
  if (summary.dueSoonCount > 0) {
    parts.push(`${summary.dueSoonCount} nos próximos dias`);
  }

  const title =
    summary.overdueCount > 0
      ? `Atenção: ${summary.overdueCount} ${summary.overdueCount === 1 ? 'conta atrasada' : 'contas atrasadas'}`
      : summary.dueTodayCount > 0
      ? `${summary.dueTodayCount} ${summary.dueTodayCount === 1 ? 'vencimento hoje' : 'vencimentos hoje'}`
      : `${summary.dueSoonCount} ${summary.dueSoonCount === 1 ? 'vencimento próximo' : 'vencimentos próximos'}`;

  const body = `Pendências: ${parts.join(', ')} • Total de ${formatBRL(summary.totalPendingAmount)}`;

  return { title, body };
}

/**
 * Verifica se o lembrete do navegador deve disparar hoje com base no horário, recorrência e última notificação.
 */
export function shouldTriggerDailyNotification(
  settings: ReminderSettings | undefined,
  currentDateStr: string,
  currentTimeStr: string,
  reminders?: ReminderItem[]
): boolean {
  if (!settings || !settings.enabled) return false;
  if (settings.lastNotifiedDate === currentDateStr) return false;

  const targetTime = settings.preferredTime || '09:00';
  if (currentTimeStr < targetTime) return false;

  return matchesRecurrenceSchedule(
    settings.recurrence || 'daily',
    currentDateStr,
    reminders
  );
}

/**
 * Filtra os itens de lembrete respeitando as preferências persistidas no estado de configurações.
 */
export function filterRemindersByPersistedSettings(
  reminders: ReminderItem[],
  settings?: ReminderSettings,
  recurrenceOverride?: ReminderRecurrence
): ReminderItem[] {
  if (!settings) return reminders;

  const notifyInvoice = settings.notifyInvoiceDue ?? true;
  const notifyBills = settings.notifyPendingBills ?? true;
  const notifyRecurring = settings.notifyRecurringEntries ?? true;
  const notifyShared = settings.notifySharedReimbursements ?? true;
  const effectiveRecurrence =
    recurrenceOverride ||
    settings.emailRecurrence ||
    settings.recurrence ||
    'daily';

  return reminders.filter((item) => {
    if (item.type === 'invoice_due' && !notifyInvoice) return false;
    if (item.type === 'pending_bill' && !notifyBills) return false;
    if (item.type === 'recurring_check' && !notifyRecurring) return false;
    if (item.type === 'shared_pending' && !notifyShared) return false;
    if (
      effectiveRecurrence === 'urgent_only' &&
      item.urgency !== 'overdue' &&
      item.urgency !== 'due_today'
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Verifica se a notificação agendada por e-mail deve ser disparada hoje.
 */
export function shouldTriggerEmailNotification(
  settings: ReminderSettings | undefined,
  currentDateStr: string,
  currentTimeStr: string,
  reminders?: ReminderItem[]
): boolean {
  if (!settings || !settings.enabled || !settings.emailNotificationsEnabled) {
    return false;
  }
  if (
    settings.notificationEmail !== undefined &&
    (!settings.notificationEmail.trim() ||
      !settings.notificationEmail.includes('@'))
  ) {
    return false;
  }

  const effectiveRecurrence: ReminderRecurrence =
    settings.emailRecurrence || settings.recurrence || 'daily';

  if (settings.lastEmailNotifiedDate) {
    if (settings.lastEmailNotifiedDate === currentDateStr) {
      return false;
    }
    if (
      effectiveRecurrence === 'monthly' &&
      settings.lastEmailNotifiedDate.slice(0, 7) === currentDateStr.slice(0, 7)
    ) {
      return false;
    }
    if (
      effectiveRecurrence === 'weekly' &&
      Math.abs(getDaysDifference(settings.lastEmailNotifiedDate, currentDateStr)) < 7
    ) {
      return false;
    }
  }

  const targetTime =
    settings.emailPreferredTime || settings.preferredTime || '08:00';
  if (currentTimeStr < targetTime) return false;

  const filteredReminders = reminders
    ? filterRemindersByPersistedSettings(reminders, settings, effectiveRecurrence)
    : undefined;

  return matchesRecurrenceSchedule(
    effectiveRecurrence,
    currentDateStr,
    filteredReminders
  );
}
