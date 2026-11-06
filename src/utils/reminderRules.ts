import {
  BankAccount,
  Category,
  CreditCard,
  FamilyMember,
  ReminderItem,
  ReminderRecurrence,
  ReminderSettings,
  ReminderUrgency,
  SmtpCredentials,
  Transaction,
} from '../types/finance';
import { calculateCreditCardSummary, formatBRL } from './financeRules';

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
  selectedMonth: string; // YYYY-MM
  referenceDate: string; // YYYY-MM-DD
  settings?: ReminderSettings;
}

/**
 * Calcula todos os lembretes do sistema integrando com o estado de pendentes e faturas.
 */
export function calculateDailyReminders({
  transactions,
  cards,
  categories = [],
  accounts = [],
  familyMembers = [],
  selectedMonth,
  referenceDate,
  settings = DEFAULT_REMINDER_SETTINGS,
}: CalculateRemindersParams): ReminderItem[] {
  const reminders: ReminderItem[] = [];
  const daysThreshold = settings.daysBeforeInvoiceDue ?? 3;

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const memberMap = new Map(familyMembers.map((m) => [m.id, m.name]));

  // 1. Faturas de Cartão de Crédito Próximas ou Vencidas
  if (settings.notifyInvoiceDue) {
    for (const card of cards) {
      const invoice = calculateCreditCardSummary(card, transactions, selectedMonth);
      if (invoice.invoicePendingAmount > 0) {
        const dueDayStr = String(card.dueDay).padStart(2, '0');
        const dueDate = `${selectedMonth}-${dueDayStr}`;
        const daysRemaining = getDaysDifference(referenceDate, dueDate);

        let urgency: ReminderUrgency;
        if (daysRemaining < 0) {
          urgency = 'overdue';
        } else if (daysRemaining === 0) {
          urgency = 'due_today';
        } else if (daysRemaining <= daysThreshold) {
          urgency = 'due_soon';
        } else {
          urgency = 'upcoming';
        }

        reminders.push({
          id: `card-due-${card.id}-${selectedMonth}`,
          type: 'invoice_due',
          title: `Fatura ${card.name}`,
          description:
            daysRemaining < 0
              ? `Fatura vencida há ${Math.abs(daysRemaining)} ${Math.abs(daysRemaining) === 1 ? 'dia' : 'dias'} (Venceu dia ${card.dueDay})`
              : daysRemaining === 0
              ? `Fatura vence hoje! (Dia ${card.dueDay})`
              : `Vencimento em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} (Dia ${card.dueDay})`,
          amount: invoice.invoicePendingAmount,
          dueDate,
          urgency,
          daysRemaining,
          cardId: card.id,
        });
      }
    }
  }

  // 2. Despesas e Boletos Pendentes no mês de competência (Contas bancárias/boletos/PIX - cartão de crédito é coberto pela fatura)
  if (settings.notifyPendingBills) {
    const pendingExpenses = transactions.filter(
      (tx) =>
        tx.competenceMonth === selectedMonth &&
        tx.status === 'pending' &&
        tx.type === 'expense' &&
        !tx.creditCardId &&
        !tx.isInvoicePayment &&
        !tx.isCompanionOnlyExpense
    );

    for (const tx of pendingExpenses) {
      const daysRemaining = getDaysDifference(referenceDate, tx.date);

      let urgency: ReminderUrgency;
      if (daysRemaining < 0) {
        urgency = 'overdue';
      } else if (daysRemaining === 0) {
        urgency = 'due_today';
      } else if (daysRemaining <= 3) {
        urgency = 'due_soon';
      } else {
        urgency = 'upcoming';
      }

      const isFixed = tx.recurrence === 'fixed';
      const catName = categoryMap.get(tx.categoryId);
      const accName = tx.accountId ? accountMap.get(tx.accountId) : undefined;

      reminders.push({
        id: `tx-pending-${tx.id}`,
        type: isFixed ? 'recurring_check' : 'pending_bill',
        title: tx.description,
        description:
          daysRemaining < 0
            ? `Pendente e atrasado há ${Math.abs(daysRemaining)} ${Math.abs(daysRemaining) === 1 ? 'dia' : 'dias'} (${tx.date.split('-').reverse().slice(0, 2).join('/')})`
            : daysRemaining === 0
            ? `Vencimento agendado para hoje!`
            : `Vencimento em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} (${tx.date.split('-').reverse().slice(0, 2).join('/')})`,
        amount: tx.amount,
        dueDate: tx.date,
        urgency,
        daysRemaining,
        transactionId: tx.id,
        categoryName: catName,
        accountName: accName,
        isFixedRecurring: isFixed,
      });
    }
  }

  // 3. Rateios Familiares Pendentes de Reembolso
  if (settings.notifySharedReimbursements) {
    const pendingShared = transactions.filter(
      (tx) =>
        tx.competenceMonth === selectedMonth &&
        tx.isShared &&
        tx.sharedStatus === 'pending' &&
        (tx.sharedAmount ?? 0) > 0
    );

    for (const tx of pendingShared) {
      const memberName = tx.sharedMemberId ? memberMap.get(tx.sharedMemberId) : 'Familiar';
      const daysRemaining = getDaysDifference(referenceDate, tx.date);

      reminders.push({
        id: `shared-pending-${tx.id}`,
        type: 'shared_pending',
        title: `Reembolso de ${memberName || 'Familiar'}`,
        description: `Rateio pendente de "${tx.description}"`,
        amount: tx.sharedAmount ?? 0,
        dueDate: tx.date,
        urgency: daysRemaining < 0 ? 'overdue' : daysRemaining === 0 ? 'due_today' : 'due_soon',
        daysRemaining,
        transactionId: tx.id,
        memberId: tx.sharedMemberId,
      });
    }
  }

  // Ordenação por urgência financeira:
  // 1. overdue (mais atrasados primeiro)
  // 2. due_today
  // 3. due_soon (mais próximos de vencer primeiro)
  // 4. upcoming
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
  const totalPendingAmount = reminders.reduce((sum, r) => sum + r.amount, 0);

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
export function getBrowserNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Wrapper seguro para Web Notification API do navegador.
 */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return 'denied';
  }
}

export interface BrowserNotificationInitResult {
  permission: NotificationPermission | 'unsupported';
  browserNotificationsEnabled: boolean;
  shouldShowSetupPrompt: boolean;
}

/**
 * Configura e sincroniza as permissões de notificação do navegador no fluxo de inicialização,
 * permitindo que o usuário receba alertas financeiros agendados diretamente no sistema operacional.
 */
export async function initializeBrowserNotificationPermissions(
  settings: ReminderSettings = DEFAULT_REMINDER_SETTINGS,
  options?: { requestIfDefault?: boolean }
): Promise<BrowserNotificationInitResult> {
  let permission = getBrowserNotificationPermissionState();

  if (permission === 'unsupported') {
    return {
      permission: 'unsupported',
      browserNotificationsEnabled: false,
      shouldShowSetupPrompt: false,
    };
  }

  // Se solicitado ou se o usuário já havia habilitado nas preferências e o navegador permite solicitar
  if (
    permission === 'default' &&
    (options?.requestIfDefault || settings.browserNotificationsEnabled)
  ) {
    try {
      const requested = await Notification.requestPermission();
      if (requested === 'granted' || requested === 'denied' || requested === 'default') {
        permission = requested;
      }
    } catch {
      // Alguns navegadores exigem gesto explícito do usuário; mantém 'default' para exibir a faixa de ativação 1-clique
      permission = getBrowserNotificationPermissionState();
    }
  }

  if (permission === 'granted') {
    return {
      permission: 'granted',
      browserNotificationsEnabled: settings.enabled !== false,
      shouldShowSetupPrompt: false,
    };
  }

  if (permission === 'denied') {
    return {
      permission: 'denied',
      browserNotificationsEnabled: false,
      shouldShowSetupPrompt: false,
    };
  }

  return {
    permission: 'default',
    browserNotificationsEnabled: false,
    shouldShowSetupPrompt: settings.enabled !== false,
  };
}

export function sendBrowserNotification(
  title: string,
  body: string,
  onClick?: () => void
): boolean {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return false;
  }

  try {
    const notif = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'minhas-economias-daily-alert',
    });
    if (onClick) {
      notif.onclick = () => {
        window.focus();
        onClick();
      };
    }
    return true;
  } catch {
    // Fallback para Service Worker Notification em contextos mobile/PWA
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.showNotification(title, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'minhas-economias-daily-alert',
          });
        })
        .catch(() => {
          // Ignore fallback errors
        });
      return true;
    }
    return false;
  }
}
