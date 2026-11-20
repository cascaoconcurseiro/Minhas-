/** Configuração padrão dos lembretes, credenciais SMTP e recorrência. */
import type {
  ReminderItem,
  ReminderRecurrence,
  ReminderSettings,
  SmtpCredentials,
} from '../../types/finance';

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  preferredTime: '09:00',
  recurrence: 'daily',
  daysBeforeInvoiceDue: 3,
  notifyPendingBills: true,
  notifyInvoiceDue: true,
  notifyRecurringEntries: true,
  notifySharedReimbursements: true,
  browserNotificationsEnabled: false,
  emailNotificationsEnabled: false,
  notificationEmail: '',
  emailPreferredTime: '08:00',
  emailRecurrence: 'daily',
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPass: '',
  smtpSecure: false,
};

/**
 * Extrai e normaliza as credenciais SMTP configuradas pelo usuário nas preferências de lembretes.
 */
export function resolveSmtpCredentials(
  settings?: ReminderSettings,
  overrideSmtp?: Partial<SmtpCredentials>
): SmtpCredentials | null {
  const host = (
    overrideSmtp?.host ??
    settings?.smtpHost ??
    settings?.smtpConfig?.host ??
    ''
  ).trim();
  const rawPort =
    overrideSmtp?.port ??
    settings?.smtpPort ??
    settings?.smtpConfig?.port ??
    587;
  const port = Number(rawPort);
  const user = (
    overrideSmtp?.user ??
    settings?.smtpUser ??
    settings?.smtpConfig?.user ??
    ''
  ).trim();
  const pass = (
    overrideSmtp?.pass ??
    settings?.smtpPass ??
    settings?.smtpConfig?.pass ??
    ''
  ).trim();
  const secure =
    port === 465 ||
    Boolean(
      overrideSmtp?.secure ??
        settings?.smtpSecure ??
        settings?.smtpConfig?.secure
    );

  if (!host || !Number.isFinite(port) || port <= 0 || port > 65535 || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    user,
    pass,
    secure: Boolean(secure),
  };
}

export function getRecurrenceLabel(recurrence?: ReminderRecurrence): string {
  switch (recurrence) {
    case 'weekly':
      return 'Semanal (Segundas-feiras)';
    case 'monthly':
      return 'Mensal (Dia 1º do mês)';
    case 'weekdays':
      return 'Dias Úteis (Seg a Sex)';
    case 'urgent_only':
      return 'Apenas Urgentes / Vencendo Hoje';
    case 'daily':
    default:
      return 'Diário (Todos os dias)';
  }
}

/**
 * Avalia se a data de referência (YYYY-MM-DD) e a lista de pendências satisfazem a recorrência escolhida.
 */
export function matchesRecurrenceSchedule(
  recurrence: ReminderRecurrence | undefined,
  currentDateStr: string,
  reminders?: ReminderItem[]
): boolean {
  const mode = recurrence || 'daily';
  if (mode === 'daily') return true;

  if (mode === 'urgent_only') {
    if (!reminders) return true;
    return reminders.some(
      (r) => r.urgency === 'overdue' || r.urgency === 'due_today'
    );
  }

  const [y, m, d] = currentDateStr.split('-').map(Number);
  if (!y || !m || !d) return true;
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  if (mode === 'weekdays') {
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  if (mode === 'weekly') {
    // Dispara às segundas-feiras
    return dayOfWeek === 1;
  }

  if (mode === 'monthly') {
    // Dispara no dia 1º de cada mês
    return d === 1;
  }

  return true;
}

/**
 * Retorna a diferença de dias entre duas datas no formato YYYY-MM-DD (target - reference).
 * Se target for hoje, retorna 0.
 * Se target for ontem, retorna -1 (vencido há 1 dia).
 * Se target for amanhã, retorna 1.
 */
