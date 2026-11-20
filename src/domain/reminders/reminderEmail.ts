/** Resumo por e-mail e envio pelo servidor. */
import type {
  ReminderItem,
  ReminderRecurrence,
  ReminderSettings,
  SmtpCredentials,
} from '../../types/finance';
import {
  formatBRL,
} from '../finance/financeRules';
import {
  summarizeReminders,
} from './reminderCalculation.ts';
import {
  DEFAULT_REMINDER_SETTINGS,
  getRecurrenceLabel,
  resolveSmtpCredentials,
} from './reminderSettings.ts';
import {
  filterRemindersByPersistedSettings,
  formatReminderNotificationMessage,
  shouldTriggerEmailNotification,
} from './reminderTriggers.ts';

export interface EmailReminderDigest {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  recurrence: ReminderRecurrence;
  preferredTime: string;
  summary: ReturnType<typeof summarizeReminders>;
}

/**
 * Formata o resumo executivo em texto e HTML para envio de lembretes por e-mail.
 */
export function formatEmailReminderDigest(
  reminders: ReminderItem[],
  recipientEmail: string,
  userName?: string,
  options?: {
    recurrence?: ReminderRecurrence;
    preferredTime?: string;
  }
): EmailReminderDigest {
  const cleanEmail = recipientEmail.trim().toLowerCase();
  const greetingName = userName?.trim() || cleanEmail.split('@')[0] || 'Investidor(a)';
  const recurrence: ReminderRecurrence = options?.recurrence || 'daily';
  const preferredTime = options?.preferredTime || '08:00';
  const recurrenceLabel = getRecurrenceLabel(recurrence);
  const summary = summarizeReminders(reminders);
  const { title } = formatReminderNotificationMessage(reminders);

  const subject =
    summary.totalCount > 0
      ? `[Minhas Economias BR] ${title} (${formatBRL(summary.totalPendingAmount)})`
      : `[Minhas Economias BR] Resumo Financeiro (${recurrenceLabel}) — Tudo em dia!`;

  const lines: string[] = [
    `Olá, ${greetingName}!`,
    ``,
    summary.totalCount > 0
      ? `Aqui está o seu resumo agendado (${recurrenceLabel} às ${preferredTime}) de vencimentos e compromissos financeiros:`
      : `Excelente notícia: todas as suas faturas e contas monitoradas estão em dia (${recurrenceLabel})!`,
    ``,
    `• Recorrência configurada: ${recurrenceLabel} (${preferredTime})`,
    `• Total Pendente: ${formatBRL(summary.totalPendingAmount)}`,
    `• Em Atraso: ${summary.overdueCount}`,
    `• Vencendo Hoje: ${summary.dueTodayCount}`,
    `• Próximos Dias: ${summary.dueSoonCount}`,
    ``,
  ];

  if (reminders.length > 0) {
    lines.push(`Detalhamento dos Lembretes:`);
    for (const item of reminders.slice(0, 15)) {
      const badge =
        item.urgency === 'overdue'
          ? '[ATRASADO]'
          : item.urgency === 'due_today'
          ? '[VENCE HOJE]'
          : item.urgency === 'due_soon'
          ? '[PRÓXIMO]'
          : '[AGENDADO]';
      lines.push(
        `- ${badge} ${item.title}: ${formatBRL(item.amount)} (${item.description})`
      );
    }
  }

  lines.push(
    ``,
    `Acesse o Minhas Economias BR para dar baixa ou conciliar seus lançamentos.`
  );

  const textBody = lines.join('\n');

  const itemsHtml =
    reminders.length > 0
      ? `<ul style="padding-left:18px;margin:12px 0;">${reminders
          .slice(0, 15)
          .map(
            (item) =>
              `<li style="margin-bottom:6px;font-family:sans-serif;font-size:13px;color:#1e293b;">
                <strong>${item.title}</strong> — <span style="font-family:monospace;font-weight:700;">${formatBRL(item.amount)}</span>
                <span style="color:#64748b;">(${item.description})</span>
              </li>`
          )
          .join('')}</ul>`
      : `<p style="color:#059669;font-weight:600;">Nenhuma pendência financeira encontrada para o período.</p>`;

  const htmlBody = `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:18px;">Minhas Economias BR — Lembrete Financeiro (${recurrenceLabel})</h2>
      <p style="margin:0 0 16px;color:#475569;font-size:14px;">Olá, <strong>${greetingName}</strong>!</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;">
        <div><strong>Recorrência:</strong> ${recurrenceLabel} • <strong>Horário:</strong> ${preferredTime}</div>
        <div><strong>Total Pendente:</strong> ${formatBRL(summary.totalPendingAmount)}</div>
        <div><strong>Vencidos:</strong> ${summary.overdueCount} | <strong>Vence Hoje:</strong> ${summary.dueTodayCount} | <strong>Próximos Dias:</strong> ${summary.dueSoonCount}</div>
      </div>
      ${itemsHtml}
    </div>
  `.trim();

  return {
    to: cleanEmail,
    subject,
    textBody,
    htmlBody,
    recurrence,
    preferredTime,
    summary,
  };
}

export interface DispatchEmailReminderResponse {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  sentTo: string;
  subject: string;
  sentAt: string;
  recurrence?: ReminderRecurrence;
  preferredTime?: string;
  deliveryMode: 'custom_smtp' | 'smtp_webhook' | 'resend' | 'cloud_queue';
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  message: string;
}

/**
 * Envia o resumo de lembretes por e-mail através da rota de backend `/api/reminders/send-email`,
 * utilizando as credenciais SMTP próprias configuradas pelo usuário (`smtpHost`, `smtpPort`, `smtpUser`, `smtpPass`)
 * em vez do serviço padrão, e respeitando as preferências persistidas no estado de configurações (`settings`).
 */
export async function dispatchEmailReminder(params: {
  reminders: ReminderItem[];
  recipientEmail?: string;
  userName?: string;
  settings?: ReminderSettings;
  smtp?: Partial<SmtpCredentials>;
  recurrence?: ReminderRecurrence;
  preferredTime?: string;
  currentDateStr?: string;
  currentTimeStr?: string;
  isTest?: boolean;
  authToken?: string;
}): Promise<DispatchEmailReminderResponse> {
  const persisted = params.settings;
  const effectiveRecurrence: ReminderRecurrence =
    params.recurrence ||
    persisted?.emailRecurrence ||
    persisted?.recurrence ||
    DEFAULT_REMINDER_SETTINGS.emailRecurrence ||
    'daily';
  const effectivePreferredTime: string =
    params.preferredTime ||
    persisted?.emailPreferredTime ||
    persisted?.preferredTime ||
    DEFAULT_REMINDER_SETTINGS.emailPreferredTime ||
    '08:00';
  const effectiveEmail = (
    params.recipientEmail ||
    persisted?.notificationEmail ||
    ''
  ).trim();

  if (!effectiveEmail || !effectiveEmail.includes('@')) {
    throw new Error('Informe um endereço de e-mail válido nas configurações de lembretes.');
  }

  // Se não for um disparo de teste manual, valida rigorosamente o estado persistido nas configurações
  if (!params.isTest && persisted) {
    if (!persisted.enabled || !persisted.emailNotificationsEnabled) {
      return {
        ok: false,
        skipped: true,
        reason: 'disabled_in_settings',
        sentTo: effectiveEmail,
        subject: '',
        sentAt: new Date().toISOString(),
        recurrence: effectiveRecurrence,
        preferredTime: effectivePreferredTime,
        deliveryMode: 'custom_smtp',
        message: 'Envio por e-mail desativado nas configurações de lembretes.',
      };
    }

    if (params.currentDateStr && params.currentTimeStr) {
      const shouldSend = shouldTriggerEmailNotification(
        {
          ...persisted,
          notificationEmail: effectiveEmail,
          emailRecurrence: effectiveRecurrence,
          emailPreferredTime: effectivePreferredTime,
        },
        params.currentDateStr,
        params.currentTimeStr,
        params.reminders
      );
      if (!shouldSend) {
        return {
          ok: false,
          skipped: true,
          reason: 'recurrence_or_schedule_not_due',
          sentTo: effectiveEmail,
          subject: '',
          sentAt: new Date().toISOString(),
          recurrence: effectiveRecurrence,
          preferredTime: effectivePreferredTime,
          deliveryMode: 'custom_smtp',
          message: `Envio aguardando janela da recorrência configurada (${getRecurrenceLabel(effectiveRecurrence)} às ${effectivePreferredTime}).`,
        };
      }
    }
  }

  const smtpCredentials = resolveSmtpCredentials(persisted, params.smtp);
  if (!smtpCredentials) {
    throw new Error(
      'Configure suas credenciais SMTP (Host, Porta, Usuário e Senha) nas configurações de e-mail dos lembretes.'
    );
  }
  const authToken = params.authToken?.trim();
  if (!authToken) {
    throw new Error('Entre na sua conta para enviar lembretes por e-mail.');
  }

  const filteredReminders = filterRemindersByPersistedSettings(
    params.reminders,
    persisted,
    effectiveRecurrence
  );

  const digest = formatEmailReminderDigest(
    filteredReminders,
    effectiveEmail,
    params.userName,
    {
      recurrence: effectiveRecurrence,
      preferredTime: effectivePreferredTime,
    }
  );

  const response = await fetch('/api/reminders/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      to: digest.to,
      subject: params.isTest ? `[TESTE] ${digest.subject}` : digest.subject,
      textBody: digest.textBody,
      htmlBody: digest.htmlBody,
      summary: digest.summary,
      recurrence: effectiveRecurrence,
      preferredTime: effectivePreferredTime,
      smtp: smtpCredentials,
      deliveryMode: 'custom_smtp',
      isTest: Boolean(params.isTest),
    }),
  });

  if (!response.ok) {
    let errMsg = 'Falha ao disparar lembrete por e-mail via SMTP.';
    try {
      const errData = await response.json();
      if (errData?.error) errMsg = errData.error;
    } catch {
      // Ignore parse error
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  return {
    ...data,
    deliveryMode: 'custom_smtp',
    smtpHost: smtpCredentials.host,
    smtpPort: smtpCredentials.port,
    smtpUser: smtpCredentials.user,
    recurrence: effectiveRecurrence,
    preferredTime: effectivePreferredTime,
  };
}

/**
 * Consulta o estado atual da permissão de notificações do navegador / sistema operacional.
 */
