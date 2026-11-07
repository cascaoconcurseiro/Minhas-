import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { ReminderItem, ReminderSettings } from '../types/finance';
import { ReminderCenterModal } from './ReminderCenterModal';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;
const settings: ReminderSettings = {
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
};
const reminders: ReminderItem[] = [
  { id: 'invoice-1', type: 'invoice_due', title: 'Fatura sintética', description: 'Vence hoje', amount: 75, dueDate: '2026-11-07', urgency: 'due_today', daysRemaining: 0, cardId: 'card-synthetic' },
  { id: 'bill-1', type: 'pending_bill', title: 'Conta sintética', description: 'Em atraso', amount: 22, dueDate: '2026-11-06', urgency: 'overdue', daysRemaining: -1, transactionId: 'tx-bill' },
  { id: 'recurring-1', type: 'recurring_check', title: 'Recorrência sintética', description: 'Conferir valor', amount: 10, dueDate: '2026-11-10', urgency: 'due_soon', daysRemaining: 3 },
  { id: 'shared-1', type: 'shared_pending', title: 'Rateio sintético', description: 'A receber', amount: 5, dueDate: '2026-11-15', urgency: 'upcoming', daysRemaining: 8, transactionId: 'tx-shared', memberId: 'member-synthetic' },
];

function renderReminder(options: {
  reminderItems?: ReminderItem[];
  userEmail?: string;
  onClose?: () => void;
  onUpdate?: (patch: Partial<ReminderSettings>) => void;
  onPayInvoice?: (cardId: string) => void;
  onMarkPaid?: (id: string) => void;
  onEdit?: (id: string) => void;
  onOpenSettings?: (tab: string) => void;
  getAuthToken?: () => Promise<string>;
} = {}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(ReminderCenterModal, {
    isOpen: true,
    onClose: options.onClose ?? (() => {}),
    reminders: options.reminderItems ?? reminders,
    settings,
    userEmail: options.userEmail,
    userName: 'Usuário sintético',
    getAuthToken: options.getAuthToken ?? (async () => 'synthetic-token'),
    onUpdateReminderSettings: options.onUpdate ?? (() => {}),
    onPayCardInvoice: options.onPayInvoice,
    onMarkTransactionPaid: options.onMarkPaid,
    onEditTransaction: options.onEdit,
    onOpenSettingsTab: options.onOpenSettings,
  })));
  return container;
}

function clickButton(page: HTMLElement, label: string) {
  const button = Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find((item) => item.textContent?.includes(label));
  assert.ok(button, `button containing ${label} exists`);
  act(() => button.click());
}

function setInputValue(input: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = input instanceof HTMLSelectElement ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('ReminderCenterModal exercises summary filters for every reminder type', async () => {
  const page = renderReminder();
  assert.equal(page.querySelectorAll('[data-testid^="reminder-card-"]').length, 4);
  for (const [filter, expected] of [['Urgentes', 3], ['Faturas Cartão', 1], ['Contas & Boletos', 1], ['Recorrentes', 1], ['Rateios Compartilhados', 1], ['Todos', 4]] as const) {
    await act(async () => { clickButton(page, filter); });
    assert.equal(page.querySelectorAll('[data-testid^="reminder-card-"]').length, expected, `filter ${filter}`);
  }
});

test('ReminderCenterModal toggles channel/config panels and routes header/footer actions', async () => {
  let closes = 0;
  const settingsTabs: string[] = [];
  const page = renderReminder({ onClose: () => { closes += 1; }, onOpenSettings: (tab) => settingsTabs.push(tab) });
  assert.ok(page.querySelector('[data-testid="reminder-channels-config-panel"]'));
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="toggle-reminder-channels-btn"]')?.click(); });
  assert.equal(page.querySelector('[data-testid="reminder-channels-config-panel"]'), null);
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="toggle-reminder-channels-btn"]')?.click(); });
  assert.ok(page.querySelector('[data-testid="reminder-channels-config-panel"]'));
  await act(async () => { page.querySelector<HTMLButtonElement>('button[title="Configurações Avançadas de Lembretes"]')?.click(); });
  assert.deepEqual(settingsTabs, ['reminders']);
  assert.equal(closes, 1);
  await act(async () => { page.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.click(); });
  await act(async () => { clickButton(page, 'Fechar'); });
  assert.equal(closes, 3);
});

test('ReminderCenterModal routes each enabled reminder action through local callbacks', async () => {
  const paid: string[] = [];
  const edited: string[] = [];
  const invoiced: string[] = [];
  let closes = 0;
  const page = renderReminder({
    onPayInvoice: (id) => invoiced.push(id),
    onMarkPaid: (id) => paid.push(id),
    onEdit: (id) => edited.push(id),
    onClose: () => { closes += 1; },
  });
  await act(async () => { clickButton(page, 'Pagar Fatura Agora'); });
  await act(async () => { clickButton(page, 'Marcar como Pago'); });
  await act(async () => { clickButton(page, 'Ver Detalhes'); });
  assert.deepEqual(invoiced, ['card-synthetic']);
  assert.deepEqual(paid, ['tx-bill']);
  assert.deepEqual(edited, ['tx-bill']);
  assert.equal(closes, 2, 'payment and detail navigation close the modal');
});

test('ReminderCenterModal forwards switches, each schedule choice, email, and SMTP input changes', async () => {
  const changes: Array<Partial<ReminderSettings>> = [];
  const page = renderReminder({ onUpdate: (patch) => changes.push(patch) });
  for (const selector of ['#quick-reminder-toggle', '[data-testid="email-reminder-toggle"]']) {
    const control = page.querySelector<HTMLButtonElement>(selector);
    assert.ok(control, `${selector} is rendered`);
    await act(async () => { control.click(); });
  }

  const optionSelections: Array<[string, string, keyof ReminderSettings]> = [
    ['browser-reminder-time', '20:00', 'preferredTime'],
    ['browser-reminder-recurrence', 'urgent_only', 'recurrence'],
    ['email-reminder-time', '18:00', 'emailPreferredTime'],
    ['email-reminder-recurrence', 'weekdays', 'emailRecurrence'],
  ];
  for (const [id, value, key] of optionSelections) {
    const select = page.querySelector<HTMLSelectElement>(`#${id}`);
    assert.ok(select);
    await act(async () => { setInputValue(select, value); });
    assert.ok(changes.some((patch) => patch[key] === value), `${id} forwards ${value}`);
  }

  const fields: Array<[string, string, keyof ReminderSettings]> = [
    ['#reminder-email-address', 'owner@example.test', 'notificationEmail'],
    ['[data-testid="reminder-smtp-host-input"]', 'smtp.example.test', 'smtpHost'],
    ['[data-testid="reminder-smtp-port-input"]', '465', 'smtpPort'],
    ['[data-testid="reminder-smtp-user-input"]', 'user@example.test', 'smtpUser'],
    ['[data-testid="reminder-smtp-pass-input"]', 'synthetic-password', 'smtpPass'],
  ];
  for (const [selector, value, key] of fields) {
    const field = page.querySelector<HTMLInputElement>(selector);
    assert.ok(field);
    await act(async () => { setInputValue(field, value); });
    assert.ok(changes.some((patch) => key === 'smtpPort' ? patch[key] === 465 : patch[key] === value), `${selector} forwards its change`);
  }

  const passInput = page.querySelector<HTMLInputElement>('[data-testid="reminder-smtp-pass-input"]');
  assert.equal(passInput?.type, 'password');
  await act(async () => { page.querySelector<HTMLButtonElement>('[aria-label="Mostrar senha SMTP"]')?.click(); });
  assert.equal(passInput?.type, 'text');
  await act(async () => { page.querySelector<HTMLButtonElement>('[aria-label="Ocultar senha SMTP"]')?.click(); });
  assert.equal(passInput?.type, 'password');
});

test('ReminderCenterModal validates test email locally without sending or requesting a token', async () => {
  let tokenCalls = 0;
  let networkCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { networkCalls += 1; throw new Error('network must not be reached'); };
  try {
    const page = renderReminder({ userEmail: '', getAuthToken: async () => { tokenCalls += 1; return 'synthetic'; } });
    await act(async () => { clickButton(page, 'Testar E-mail Agora'); });
    assert.match(page.querySelector('[data-testid="email-reminder-feedback"]')?.textContent ?? '', /endereço de e-mail válido/);
    const email = page.querySelector<HTMLInputElement>('#reminder-email-address');
    assert.ok(email);
    await act(async () => { setInputValue(email, 'owner@example.test'); clickButton(page, 'Testar E-mail Agora'); });
    assert.match(page.querySelector('[data-testid="email-reminder-feedback"]')?.textContent ?? '', /credenciais SMTP/);
    assert.equal(tokenCalls, 0);
    assert.equal(networkCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ReminderCenterModal test email request uses synthetic token and shows API failure without real egress', async () => {
  let tokenCalls = 0;
  let networkCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    networkCalls += 1;
    assert.match(String(input), /\/api\/reminders\/send-email$/);
    return new Response(JSON.stringify({ error: 'Falha sintética de SMTP.' }), { status: 502, headers: { 'content-type': 'application/json' } });
  };
  try {
    const page = renderReminder({
      userEmail: 'owner@example.test',
      getAuthToken: async () => { tokenCalls += 1; return 'synthetic-token'; },
    });
    await act(async () => {
      setInputValue(page.querySelector<HTMLInputElement>('[data-testid="reminder-smtp-host-input"]')!, 'smtp.example.test');
      setInputValue(page.querySelector<HTMLInputElement>('[data-testid="reminder-smtp-user-input"]')!, 'synthetic-user');
      setInputValue(page.querySelector<HTMLInputElement>('[data-testid="reminder-smtp-pass-input"]')!, 'synthetic-pass');
      clickButton(page, 'Testar E-mail Agora');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.equal(tokenCalls, 1);
    assert.equal(networkCalls, 1);
    assert.match(page.querySelector('[data-testid="email-reminder-feedback"]')?.textContent ?? '', /Falha sintética de SMTP/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
