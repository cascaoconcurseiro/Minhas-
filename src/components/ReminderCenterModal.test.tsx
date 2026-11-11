import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { ReminderItem } from '../types/finance';
import { ReminderCenterModal } from './ReminderCenterModal';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;
const reminders: ReminderItem[] = [
  { id: 'invoice-1', type: 'invoice_due', title: 'Fatura sintética', description: 'Vence hoje', amount: 75, dueDate: '2026-11-07', urgency: 'due_today', daysRemaining: 0, cardId: 'card-synthetic' },
  { id: 'bill-1', type: 'pending_bill', title: 'Conta sintética', description: 'Em atraso', amount: 22, dueDate: '2026-11-06', urgency: 'overdue', daysRemaining: -1, transactionId: 'tx-bill' },
  { id: 'recurring-1', type: 'recurring_check', title: 'Recorrência sintética', description: 'Conferir valor', amount: 10, dueDate: '2026-11-10', urgency: 'due_soon', daysRemaining: 3 },
  { id: 'shared-1', type: 'shared_pending', title: 'Rateio sintético', description: 'A receber', amount: 5, dueDate: '2026-11-15', urgency: 'upcoming', daysRemaining: 8, transactionId: 'tx-shared', memberId: 'member-synthetic' },
];

function renderReminder(options: {
  reminderItems?: ReminderItem[];
  onClose?: () => void;
  onPayInvoice?: (cardId: string) => void;
  onMarkPaid?: (id: string) => void;
  onEdit?: (id: string) => void;
  onOpenSettings?: (tab: string) => void;
} = {}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(ReminderCenterModal, {
    isOpen: true,
    onClose: options.onClose ?? (() => {}),
    reminders: options.reminderItems ?? reminders,
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

test('notification center contains alerts only and opens preferences in Settings', async () => {
  let closes = 0;
  const tabs: string[] = [];
  const page = renderReminder({ onClose: () => { closes++; }, onOpenSettings: tab => tabs.push(tab) });
  assert.equal(page.querySelector('[data-testid="reminder-channels-config-panel"]'), null);
  assert.equal(page.querySelector('input, select'), null);
  assert.doesNotMatch(page.textContent ?? '', /SMTP|Canais & Horários|Configuração de Envio|Total Pendente/);
  await act(async () => { page.querySelector<HTMLButtonElement>('button[aria-label="Configurações de notificações"]')?.click(); });
  assert.deepEqual(tabs, ['reminders']);
  assert.equal(closes, 1);
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
