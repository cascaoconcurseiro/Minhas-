import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { CreditCard, ReminderSettings, Transaction } from '../types/finance';
import {
  calculateDailyReminders,
  DEFAULT_REMINDER_SETTINGS,
  dispatchEmailReminder,
  filterRemindersByPersistedSettings,
  formatEmailReminderDigest,
  formatReminderNotificationMessage,
  getBrowserNotificationPermissionState,
  getDaysDifference,
  getRecurrenceLabel,
  initializeBrowserNotificationPermissions,
  matchesRecurrenceSchedule,
  resolveSmtpCredentials,
  shouldTriggerDailyNotification,
  shouldTriggerEmailNotification,
  summarizeReminders,
} from './reminderRules';

describe('reminderRules — Daily Reminders & Scheduled Notifications', () => {
  test('getDaysDifference calculates relative day offsets accurately', () => {
    assert.strictEqual(getDaysDifference('2026-10-29', '2026-10-29'), 0);
    assert.strictEqual(getDaysDifference('2026-10-29', '2026-10-30'), 1);
    assert.strictEqual(getDaysDifference('2026-10-29', '2026-10-28'), -1);
    assert.strictEqual(getDaysDifference('2026-10-29', '2026-11-05'), 7);
  });

  test('calculateDailyReminders detects overdue, due today and upcoming credit card invoices', () => {
    const card: CreditCard = {
      id: 'card-nubank',
      name: 'Nubank Ultravioleta',
      brand: 'Mastercard',
      limit: 10000,
      closingDay: 20,
      dueDay: 29, // Due today when referenceDate is 2026-10-29
      defaultAccountId: 'acc-main',
      color: '#820ad1',
    };

    const cardOverdue: CreditCard = {
      id: 'card-itau',
      name: 'Itaú Personalité',
      brand: 'Visa',
      limit: 15000,
      closingDay: 15,
      dueDay: 25, // Due 4 days ago (overdue)
      defaultAccountId: 'acc-main',
      color: '#ec7000',
    };

    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        description: 'Supermercado',
        amount: 350.5,
        date: '2026-10-18',
        competenceMonth: '2026-10',
        type: 'expense',
        status: 'pending',
        categoryId: 'cat-mercado',
        creditCardId: 'card-nubank',
        paymentMethod: 'credit_card',
        recurrence: 'single',
      },
      {
        id: 'tx-2',
        description: 'Restaurante',
        amount: 200.0,
        date: '2026-10-10',
        competenceMonth: '2026-10',
        type: 'expense',
        status: 'pending',
        categoryId: 'cat-lazer',
        creditCardId: 'card-itau',
        paymentMethod: 'credit_card',
        recurrence: 'single',
      },
    ];

    const reminders = calculateDailyReminders({
      transactions,
      cards: [card, cardOverdue],
      selectedMonth: '2026-10',
      referenceDate: '2026-10-29',
    });

    assert.strictEqual(reminders.length, 2);
    // Overdue should be first
    assert.strictEqual(reminders[0].cardId, 'card-itau');
    assert.strictEqual(reminders[0].urgency, 'overdue');
    assert.strictEqual(reminders[0].daysRemaining, -4);
    assert.strictEqual(reminders[0].amount, 200.0);

    // Due today should be second
    assert.strictEqual(reminders[1].cardId, 'card-nubank');
    assert.strictEqual(reminders[1].urgency, 'due_today');
    assert.strictEqual(reminders[1].daysRemaining, 0);
    assert.strictEqual(reminders[1].amount, 350.5);
  });

  test('calculateDailyReminders identifies pending bills and recurring fixed entries', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-condo',
        description: 'Condomínio Residencial',
        amount: 750.0,
        date: '2026-10-29', // Today
        competenceMonth: '2026-10',
        type: 'expense',
        status: 'pending',
        categoryId: 'cat-moradia',
        paymentMethod: 'boleto',
        recurrence: 'fixed',
      },
      {
        id: 'tx-net',
        description: 'Internet Fibra Óptica',
        amount: 150.0,
        date: '2026-10-31', // In 2 days
        competenceMonth: '2026-10',
        type: 'expense',
        status: 'pending',
        categoryId: 'cat-moradia',
        paymentMethod: 'pix',
        recurrence: 'fixed',
      },
      {
        id: 'tx-paid',
        description: 'Conta de Luz',
        amount: 220.0,
        date: '2026-10-15',
        competenceMonth: '2026-10',
        type: 'expense',
        status: 'paid', // Already paid, should NOT be in reminders
        categoryId: 'cat-moradia',
        paymentMethod: 'pix',
        recurrence: 'fixed',
      },
    ];

    const reminders = calculateDailyReminders({
      transactions,
      cards: [],
      selectedMonth: '2026-10',
      referenceDate: '2026-10-29',
    });

    assert.strictEqual(reminders.length, 2);

    const condo = reminders.find((r) => r.transactionId === 'tx-condo');
    assert.ok(condo);
    assert.strictEqual(condo.urgency, 'due_today');
    assert.strictEqual(condo.type, 'recurring_check');
    assert.strictEqual(condo.amount, 750.0);

    const net = reminders.find((r) => r.transactionId === 'tx-net');
    assert.ok(net);
    assert.strictEqual(net.urgency, 'due_soon');
    assert.strictEqual(net.daysRemaining, 2);
    assert.strictEqual(net.amount, 150.0);
  });

  test('summarizeReminders computes aggregate counts and urgent counts correctly', () => {
    const reminders = [
      {
        id: '1',
        type: 'invoice_due' as const,
        title: 'Fatura 1',
        description: '',
        amount: 100,
        dueDate: '2026-10-28',
        urgency: 'overdue' as const,
        daysRemaining: -1,
      },
      {
        id: '2',
        type: 'pending_bill' as const,
        title: 'Boleto 1',
        description: '',
        amount: 250,
        dueDate: '2026-10-29',
        urgency: 'due_today' as const,
        daysRemaining: 0,
      },
      {
        id: '3',
        type: 'pending_bill' as const,
        title: 'Boleto 2',
        description: '',
        amount: 50,
        dueDate: '2026-10-31',
        urgency: 'due_soon' as const,
        daysRemaining: 2,
      },
      {
        id: '4',
        type: 'pending_bill' as const,
        title: 'Boleto 3',
        description: '',
        amount: 80,
        dueDate: '2026-11-15',
        urgency: 'upcoming' as const,
        daysRemaining: 17,
      },
    ];

    const summary = summarizeReminders(reminders);
    assert.strictEqual(summary.totalCount, 4);
    assert.strictEqual(summary.overdueCount, 1);
    assert.strictEqual(summary.dueTodayCount, 1);
    assert.strictEqual(summary.dueSoonCount, 1);
    assert.strictEqual(summary.urgentCount, 3);
    assert.strictEqual(summary.totalPendingAmount, 480);
  });

  test('shouldTriggerDailyNotification evaluates notification timing and deduplicates per day', () => {
    const settings: ReminderSettings = {
      enabled: true,
      preferredTime: '09:00',
      daysBeforeInvoiceDue: 3,
      notifyPendingBills: true,
      notifyInvoiceDue: true,
      notifyRecurringEntries: true,
      notifySharedReimbursements: true,
      browserNotificationsEnabled: true,
    };

    // Before preferred time (08:30 < 09:00) -> should not trigger
    assert.strictEqual(
      shouldTriggerDailyNotification(settings, '2026-10-29', '08:30'),
      false
    );

    // At preferred time (09:00 == 09:00) -> should trigger
    assert.strictEqual(
      shouldTriggerDailyNotification(settings, '2026-10-29', '09:00'),
      true
    );

    // After preferred time (14:15 > 09:00) -> should trigger
    assert.strictEqual(
      shouldTriggerDailyNotification(settings, '2026-10-29', '14:15'),
      true
    );

    // Already notified today -> should NOT trigger again
    const settingsAlreadyNotified: ReminderSettings = {
      ...settings,
      lastNotifiedDate: '2026-10-29',
    };
    assert.strictEqual(
      shouldTriggerDailyNotification(settingsAlreadyNotified, '2026-10-29', '14:15'),
      false
    );

    // Disabled reminders -> should NOT trigger
    const settingsDisabled: ReminderSettings = {
      ...settings,
      enabled: false,
    };
    assert.strictEqual(
      shouldTriggerDailyNotification(settingsDisabled, '2026-10-29', '14:15'),
      false
    );
  });

  test('formatReminderNotificationMessage provides clear scannable Portuguese summaries', () => {
    const emptyMsg = formatReminderNotificationMessage([]);
    assert.strictEqual(emptyMsg.title, 'Tudo em dia! ✨');

    const urgentMsg = formatReminderNotificationMessage([
      {
        id: '1',
        type: 'pending_bill',
        title: 'Luz',
        description: '',
        amount: 200,
        dueDate: '2026-10-29',
        urgency: 'due_today',
        daysRemaining: 0,
      },
    ]);
    assert.match(urgentMsg.title, /1 vencimento hoje/);
    assert.match(urgentMsg.body, /R\$\s*200,00/);
  });

  test('initializeBrowserNotificationPermissions handles unsupported, default, and granted states cleanly', async () => {
    const originalWindow = (globalThis as any).window;
    const originalNotification = (globalThis as any).Notification;

    try {
      // 1. Unsupported environment (Node / SSR)
      delete (globalThis as any).window;
      assert.strictEqual(getBrowserNotificationPermissionState(), 'unsupported');
      const resUnsupported = await initializeBrowserNotificationPermissions(
        DEFAULT_REMINDER_SETTINGS
      );
      assert.strictEqual(resUnsupported.permission, 'unsupported');
      assert.strictEqual(resUnsupported.browserNotificationsEnabled, false);
      assert.strictEqual(resUnsupported.shouldShowSetupPrompt, false);

      // 2. Default state without auto-request -> prompts user setup bar
      const mockNotification: any = {
        permission: 'default',
        requestPermission: async () => {
          mockNotification.permission = 'granted';
          return 'granted';
        },
      };
      (globalThis as any).window = { Notification: mockNotification };
      (globalThis as any).Notification = mockNotification;

      const resDefault = await initializeBrowserNotificationPermissions({
        ...DEFAULT_REMINDER_SETTINGS,
        browserNotificationsEnabled: false,
      });
      assert.strictEqual(resDefault.permission, 'default');
      assert.strictEqual(resDefault.shouldShowSetupPrompt, true);

      // 3. Auto-request on initialization when requestIfDefault is true -> grants & enables
      const resGranted = await initializeBrowserNotificationPermissions(
        DEFAULT_REMINDER_SETTINGS,
        { requestIfDefault: true }
      );
      assert.strictEqual(resGranted.permission, 'granted');
      assert.strictEqual(resGranted.browserNotificationsEnabled, true);
      assert.strictEqual(resGranted.shouldShowSetupPrompt, false);
    } finally {
      if (originalWindow !== undefined) {
        (globalThis as any).window = originalWindow;
      } else {
        delete (globalThis as any).window;
      }
      if (originalNotification !== undefined) {
        (globalThis as any).Notification = originalNotification;
      } else {
        delete (globalThis as any).Notification;
      }
    }
  });

  test('matchesRecurrenceSchedule evaluates daily, weekly, monthly, weekdays, and urgent_only rules accurately', () => {
    // 2026-10-01 is 1st of month, 2026-10-26 is Monday, 2026-10-29 is Thursday, 2026-10-31 is Saturday
    assert.strictEqual(matchesRecurrenceSchedule('daily', '2026-10-31'), true);
    assert.strictEqual(matchesRecurrenceSchedule('weekdays', '2026-10-29'), true);
    assert.strictEqual(matchesRecurrenceSchedule('weekdays', '2026-10-31'), false);
    assert.strictEqual(matchesRecurrenceSchedule('weekly', '2026-10-26'), true);
    assert.strictEqual(matchesRecurrenceSchedule('weekly', '2026-10-29'), false);
    assert.strictEqual(matchesRecurrenceSchedule('monthly', '2026-10-01'), true);
    assert.strictEqual(matchesRecurrenceSchedule('monthly', '2026-10-15'), false);

    // urgent_only requires at least one non-upcoming reminder
    const upcomingOnly = [
      {
        id: '1',
        type: 'pending_bill' as const,
        title: 'IPTU',
        description: '',
        amount: 400,
        dueDate: '2026-11-20',
        urgency: 'upcoming' as const,
        daysRemaining: 20,
      },
    ];
    const withUrgent = [
      ...upcomingOnly,
      {
        id: '2',
        type: 'invoice_due' as const,
        title: 'Fatura Nubank',
        description: '',
        amount: 1200,
        dueDate: '2026-10-29',
        urgency: 'due_today' as const,
        daysRemaining: 0,
      },
    ];

    assert.strictEqual(
      matchesRecurrenceSchedule('urgent_only', '2026-10-29', upcomingOnly),
      false
    );
    assert.strictEqual(
      matchesRecurrenceSchedule('urgent_only', '2026-10-29', withUrgent),
      true
    );
    assert.match(getRecurrenceLabel('weekdays'), /Dias Úteis/);
    assert.match(getRecurrenceLabel('monthly'), /Mensal/);
  });

  test('shouldTriggerEmailNotification validates email, time, recurrence (daily, weekly, monthly), and deduplication', () => {
    const emailSettings: ReminderSettings = {
      ...DEFAULT_REMINDER_SETTINGS,
      enabled: true,
      emailNotificationsEnabled: true,
      notificationEmail: 'wesley.diaslima@gmail.com',
      emailPreferredTime: '08:00',
      emailRecurrence: 'weekdays',
    };

    // Before 08:00 on a Thursday -> false
    assert.strictEqual(
      shouldTriggerEmailNotification(emailSettings, '2026-10-29', '07:45'),
      false
    );

    // At 08:00 on a Thursday -> true
    assert.strictEqual(
      shouldTriggerEmailNotification(emailSettings, '2026-10-29', '08:00'),
      true
    );

    // At 09:00 on a Saturday (weekend when recurrence is weekdays) -> false
    assert.strictEqual(
      shouldTriggerEmailNotification(emailSettings, '2026-10-31', '09:00'),
      false
    );

    // Monthly recurrence: triggers on 1st of month (2026-11-01), false on 2026-11-05
    const monthlySettings: ReminderSettings = {
      ...emailSettings,
      emailRecurrence: 'monthly',
    };
    assert.strictEqual(
      shouldTriggerEmailNotification(monthlySettings, '2026-11-01', '09:00'),
      true
    );
    assert.strictEqual(
      shouldTriggerEmailNotification(monthlySettings, '2026-11-05', '09:00'),
      false
    );

    // Already notified today -> false
    assert.strictEqual(
      shouldTriggerEmailNotification(
        { ...emailSettings, lastEmailNotifiedDate: '2026-10-29' },
        '2026-10-29',
        '10:00'
      ),
      false
    );

    // Missing valid email -> false
    assert.strictEqual(
      shouldTriggerEmailNotification(
        { ...emailSettings, notificationEmail: 'invalido' },
        '2026-10-29',
        '10:00'
      ),
      false
    );
  });

  test('formatEmailReminderDigest builds subject, textBody, and htmlBody with pending items', () => {
    const digest = formatEmailReminderDigest(
      [
        {
          id: 'r1',
          type: 'invoice_due',
          title: 'Fatura Cartão Itaú',
          description: 'Vence hoje',
          amount: 1450.75,
          dueDate: '2026-10-29',
          urgency: 'due_today',
          daysRemaining: 0,
        },
      ],
      'wesley.diaslima@gmail.com',
      'Wesley',
      { recurrence: 'monthly', preferredTime: '08:00' }
    );

    assert.strictEqual(digest.to, 'wesley.diaslima@gmail.com');
    assert.strictEqual(digest.recurrence, 'monthly');
    assert.match(digest.subject, /Minhas Economias BR/);
    assert.match(digest.textBody, /Olá, Wesley!/);
    assert.match(digest.textBody, /Mensal/);
    assert.match(digest.textBody, /Fatura Cartão Itaú/);
    assert.match(digest.htmlBody, /Fatura Cartão Itaú/);
  });

  test('dispatchEmailReminder respects persisted settings (recurrence, time, enabled state, and category filters)', async () => {
    const originalFetch = globalThis.fetch;
    const capturedPayloads: any[] = [];
    const capturedAuthorizationHeaders: string[] = [];

    try {
      globalThis.fetch = (async (_url: any, init: any) => {
        const parsedBody = JSON.parse(init.body);
        capturedPayloads.push(parsedBody);
        capturedAuthorizationHeaders.push(new Headers(init.headers).get('Authorization') || '');
        return {
          ok: true,
          json: async () => ({
            ok: true,
            sentTo: parsedBody.to,
            subject: parsedBody.subject,
            sentAt: '2026-11-01T08:00:00.000Z',
            deliveryMode: 'cloud_queue',
            message: 'Enviado com sucesso.',
          }),
        } as any;
      }) as any;

      const sampleReminders = [
        {
          id: 'inv-1',
          type: 'invoice_due' as const,
          title: 'Fatura Nubank',
          description: 'Vence hoje',
          amount: 950,
          dueDate: '2026-11-01',
          urgency: 'due_today' as const,
          daysRemaining: 0,
        },
        {
          id: 'bill-1',
          type: 'pending_bill' as const,
          title: 'Boleto Condomínio',
          description: 'Vence amanhã',
          amount: 600,
          dueDate: '2026-11-02',
          urgency: 'due_soon' as const,
          daysRemaining: 1,
        },
      ];

      // 1) Skips when emailNotificationsEnabled is false in persisted settings (non-test)
      const skippedDisabled = await dispatchEmailReminder({
        reminders: sampleReminders,
        settings: {
          ...DEFAULT_REMINDER_SETTINGS,
          enabled: true,
          emailNotificationsEnabled: false,
          notificationEmail: 'wesley.diaslima@gmail.com',
          emailRecurrence: 'monthly',
          emailPreferredTime: '08:00',
        },
        currentDateStr: '2026-11-01',
        currentTimeStr: '08:30',
      });
      assert.strictEqual(skippedDisabled.ok, false);
      assert.strictEqual(skippedDisabled.skipped, true);
      assert.strictEqual(capturedPayloads.length, 0);

      // 2) Skips when recurrence is monthly and currentDateStr is not the 1st of the month
      const skippedRecurrence = await dispatchEmailReminder({
        reminders: sampleReminders,
        settings: {
          ...DEFAULT_REMINDER_SETTINGS,
          enabled: true,
          emailNotificationsEnabled: true,
          notificationEmail: 'wesley.diaslima@gmail.com',
          emailRecurrence: 'monthly',
          emailPreferredTime: '08:00',
        },
        currentDateStr: '2026-11-12',
        currentTimeStr: '08:30',
      });
      assert.strictEqual(skippedRecurrence.ok, false);
      assert.strictEqual(skippedRecurrence.skipped, true);
      assert.strictEqual(capturedPayloads.length, 0);

      // 3) Dispatches when monthly schedule matches (2026-11-01 at 08:30) and respects notifyPendingBills: false + custom SMTP credentials
      const dispatched = await dispatchEmailReminder({
        reminders: sampleReminders,
        userName: 'Wesley',
        settings: {
          ...DEFAULT_REMINDER_SETTINGS,
          enabled: true,
          emailNotificationsEnabled: true,
          notificationEmail: 'wesley.diaslima@gmail.com',
          emailRecurrence: 'monthly',
          emailPreferredTime: '08:00',
          notifyInvoiceDue: true,
          notifyPendingBills: false, // Excludes Boleto Condomínio
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpUser: 'wesley.diaslima@gmail.com',
          smtpPass: 'app-password-16chars',
        },
        currentDateStr: '2026-11-01',
        currentTimeStr: '08:30',
        firebaseIdToken: 'test-firebase-id-token',
      });

      assert.strictEqual(dispatched.ok, true);
      assert.strictEqual(dispatched.recurrence, 'monthly');
      assert.strictEqual(dispatched.deliveryMode, 'custom_smtp');
      assert.strictEqual(dispatched.smtpHost, 'smtp.gmail.com');
      assert.strictEqual(dispatched.smtpPort, 587);
      assert.strictEqual(dispatched.smtpUser, 'wesley.diaslima@gmail.com');
      assert.strictEqual(capturedPayloads.length, 1);
      assert.strictEqual(capturedAuthorizationHeaders[0], 'Bearer test-firebase-id-token');
      assert.strictEqual(capturedPayloads[0].to, 'wesley.diaslima@gmail.com');
      assert.strictEqual(capturedPayloads[0].recurrence, 'monthly');
      assert.strictEqual(capturedPayloads[0].preferredTime, '08:00');
      assert.strictEqual(capturedPayloads[0].deliveryMode, 'custom_smtp');
      assert.deepStrictEqual(capturedPayloads[0].smtp, {
        host: 'smtp.gmail.com',
        port: 587,
        user: 'wesley.diaslima@gmail.com',
        pass: 'app-password-16chars',
        secure: false,
      });
      await assert.rejects(
        () => dispatchEmailReminder({
          reminders: sampleReminders,
          recipientEmail: 'cliente@example.com',
          settings: {
            ...DEFAULT_REMINDER_SETTINGS,
            smtpHost: 'smtp.example.com',
            smtpUser: 'sender@example.com',
            smtpPass: 'example-password',
          },
          isTest: true,
        }),
        /Entre na sua conta/
      );
      assert.strictEqual(capturedPayloads.length, 1);
      assert.strictEqual(capturedPayloads[0].summary.totalCount, 1);
      assert.strictEqual(capturedPayloads[0].summary.totalPendingAmount, 950);

      globalThis.fetch = (async () => ({
        ok: false,
        json: async () => ({ error: 'Servidor SMTP indisponível.' }),
      })) as unknown as typeof fetch;
      await assert.rejects(
        () => dispatchEmailReminder({
          reminders: sampleReminders,
          recipientEmail: 'cliente@example.com',
          settings: {
            ...DEFAULT_REMINDER_SETTINGS,
            smtpHost: 'smtp.example.com',
            smtpUser: 'sender@example.com',
            smtpPass: 'example-password',
          },
          firebaseIdToken: 'test-firebase-id-token',
          isTest: true,
        }),
        /Servidor SMTP indisponível/
      );

      // 4) Rejects dispatch if custom SMTP credentials (host, port, user, pass) are missing
      await assert.rejects(
        async () => {
          await dispatchEmailReminder({
            reminders: sampleReminders,
            recipientEmail: 'wesley.diaslima@gmail.com',
            settings: {
              ...DEFAULT_REMINDER_SETTINGS,
              enabled: true,
              emailNotificationsEnabled: true,
              notificationEmail: 'wesley.diaslima@gmail.com',
              smtpHost: '',
              smtpUser: '',
              smtpPass: '',
            },
            isTest: true,
          });
        },
        /Configure suas credenciais SMTP/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('resolveSmtpCredentials normalizes SMTP host, port, user, password, and TLS secure flag', () => {
    assert.strictEqual(resolveSmtpCredentials(DEFAULT_REMINDER_SETTINGS), null);

    const resolved587 = resolveSmtpCredentials({
      ...DEFAULT_REMINDER_SETTINGS,
      smtpHost: ' smtp.office365.com ',
      smtpPort: 587,
      smtpUser: ' usuario@empresa.com.br ',
      smtpPass: 'senha-secreta',
    });
    assert.deepStrictEqual(resolved587, {
      host: 'smtp.office365.com',
      port: 587,
      user: 'usuario@empresa.com.br',
      pass: 'senha-secreta',
      secure: false,
    });

    const resolved465 = resolveSmtpCredentials({
      ...DEFAULT_REMINDER_SETTINGS,
      smtpHost: 'smtp.zoho.com',
      smtpPort: 465,
      smtpUser: 'contato@dominio.com',
      smtpPass: 'zoho-app-key',
    });
    assert.deepStrictEqual(resolved465, {
      host: 'smtp.zoho.com',
      port: 465,
      user: 'contato@dominio.com',
      pass: 'zoho-app-key',
      secure: true,
    });
  });
});

