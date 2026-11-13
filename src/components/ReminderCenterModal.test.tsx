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

test('mostra no sino os avisos de previsão, cartão e dados para revisar; informativo não conta na bolinha', () => {
  const actions: string[] = [];
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(ReminderCenterModal, {
    isOpen: true, onClose: () => {}, reminders: [], onNoticeAction: (action: string) => actions.push(action),
    notices: [
      { id: 'forecast-negative', tone: 'danger', title: 'Saldo previsto fica negativo em 05/12 (-R$ 649,59)', detail: 'Veja o que vence até lá.', action: 'forecast', actionLabel: 'Ver previsão' },
      { id: 'commitment-2026-12', tone: 'danger', title: 'Cartão em 34% da renda em dezembro de 2026', detail: 'R$ 1.700,00 no cartão, acima do seu limite de 30%.', action: 'commitment', actionLabel: 'Ver mês a mês' },
      { id: 'health-account_without_balance', tone: 'info', title: 'Contas sem saldo e sem movimento', detail: 'Conta corrente: informe o saldo inicial.' },
    ],
  })));
  const text = document.body.textContent ?? '';
  assert.match(text, /Saldo previsto fica negativo em 05\/12/);
  assert.match(text, /Cartão em 34% da renda/);
  assert.match(text, /Contas sem saldo e sem movimento/);
  assert.doesNotMatch(text, /Nada exige atenção/);
  assert.equal(document.querySelector('#reminder-modal-title span')?.textContent, '2', 'só os 2 que pedem atenção contam');
  const forecastBtn = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Ver previsão') as HTMLButtonElement;
  const commitBtn = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Ver mês a mês') as HTMLButtonElement;
  act(() => forecastBtn.click());
  act(() => commitBtn.click());
  assert.deepEqual(actions, ['forecast', 'commitment']);
});

test('aviso do sino tem botão "Marcar como lido"', () => {
  const dismissed: string[] = [];
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(ReminderCenterModal, {
    isOpen: true, onClose: () => {}, reminders: [], onDismissNotice: (n: { id: string }) => dismissed.push(n.id),
    notices: [{ id: 'health-x', tone: 'info', title: 'Contas sem saldo' }],
  })));
  const btn = document.querySelector('[data-testid="notice-dismiss-health-x"]') as HTMLButtonElement;
  assert.ok(btn);
  act(() => btn.click());
  assert.deepEqual(dismissed, ['health-x']);
});
