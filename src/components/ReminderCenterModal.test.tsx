import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { FamilyMember, ReminderItem } from '../types/finance';
import { ReminderCenterModal } from './ReminderCenterModal';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;
const reminders: ReminderItem[] = [
  { id: 'invoice-1', type: 'invoice_due', title: 'Fatura sintética', description: 'Vence hoje', amount: 75, dueDate: '2026-11-07', urgency: 'due_today', daysRemaining: 0, cardId: 'card-synthetic' },
  { id: 'bill-1', type: 'pending_bill', title: 'Conta sintética', description: 'Em atraso', amount: 22, dueDate: '2026-11-06', urgency: 'overdue', daysRemaining: -1, transactionId: 'tx-bill' },
  { id: 'recurring-1', type: 'recurring_check', title: 'Recorrência sintética', description: 'Conferir valor', amount: 10, dueDate: '2026-11-10', urgency: 'due_soon', daysRemaining: 3, transactionId: 'tx-fixed' },
];
const invite: FamilyMember = { id: 'fam-1', name: 'Pessoa', color: '#000', direction: 'incoming', inviteStatus: 'invited', invitedByName: 'Ana' } as FamilyMember;

function renderReminder(options: {
  reminderItems?: ReminderItem[];
  onClose?: () => void;
  onPayInvoice?: (cardId: string) => void;
  onMarkPaid?: (id: string) => void;
  invites?: FamilyMember[];
  onAccept?: (member: FamilyMember) => void;
  onDecline?: (member: FamilyMember) => void;
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
    familyInvites: options.invites,
    onAcceptFamilyInvite: options.onAccept,
    onDeclineFamilyInvite: options.onDecline,
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

test('notification center lists only the given notices, with no filters or summaries', async () => {
  const page = renderReminder();
  assert.equal(page.querySelectorAll('[data-testid^="reminder-card-"]').length, 3);
  assert.match(page.textContent ?? '', /Atrasado há 1d/);
  assert.match(page.textContent ?? '', /Vence hoje/);
  assert.match(page.textContent ?? '', /Vence em 3 dias/);
  assert.doesNotMatch(page.textContent ?? '', /Todos|Urgentes|Faturas Cartão|Rateios|Ver Detalhes|Fechar$/);
});

test('empty notification center says nothing needs attention', async () => {
  const page = renderReminder({ reminderItems: [] });
  assert.equal(page.querySelectorAll('[data-testid^="reminder-card-"]').length, 0);
  assert.match(page.textContent ?? '', /Nada exige atenção hoje/);
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
  const invoiced: string[] = [];
  let closes = 0;
  const page = renderReminder({
    onPayInvoice: (id) => invoiced.push(id),
    onMarkPaid: (id) => paid.push(id),
    onClose: () => { closes += 1; },
  });
  await act(async () => { clickButton(page, 'Pagar fatura'); });
  await act(async () => { page.querySelector('[data-testid="reminder-card-bill-1"] button')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  assert.deepEqual(invoiced, ['card-synthetic']);
  assert.deepEqual(paid, ['tx-bill']);
  assert.equal(closes, 1, 'only paying the invoice closes the modal');
});

test('family invites live in the notification center and can be accepted or declined', async () => {
  const accepted: string[] = [];
  const declined: string[] = [];
  const page = renderReminder({
    reminderItems: [],
    invites: [invite],
    onAccept: (member) => accepted.push(member.id),
    onDecline: (member) => declined.push(member.id),
  });
  assert.match(page.textContent ?? '', /Convite de Ana/);
  await act(async () => { clickButton(page, 'Aceitar'); });
  await act(async () => { clickButton(page, 'Recusar'); });
  assert.deepEqual(accepted, ['fam-1']);
  assert.deepEqual(declined, ['fam-1']);
});

test('mostra no sino o aviso de cartão perto ou acima do limite e leva para os cartões', () => {
  let opened = 0;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(ReminderCenterModal, {
    isOpen: true, onClose: () => {}, reminders: [], commitmentLimitPercent: 30, onOpenCommitment: () => { opened += 1; },
    commitmentAlerts: [{ month: '2026-12', income: 5000, cardTotal: 1700, installmentTotal: 700, otherTotal: 1000,
      cardPercent: 34, installmentPercent: 14, status: 'over' }],
  })));
  const notice = document.querySelector('[data-testid="commitment-notice-2026-12"]');
  assert.ok(notice);
  assert.match(notice.textContent ?? '', /Cartão em 34% da renda/);
  assert.match(notice.textContent ?? '', /acima do limite de 30%/);
  assert.doesNotMatch(document.body.textContent ?? '', /Nada exige atenção/);
  const btn = [...notice.querySelectorAll('button')].find((b) => b.textContent === 'Ver mês a mês') as HTMLButtonElement;
  act(() => btn.click());
  assert.equal(opened, 1);
});
