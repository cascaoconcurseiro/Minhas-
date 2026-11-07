import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { Transaction } from '../types/finance';
import { TransactionActionSheet } from './TransactionActionSheet';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;
const baseTransaction: Transaction = {
  id: 'tx-actions-1', description: 'Conta de luz', amount: 82.5, date: '2026-11-05',
  competenceMonth: '2026-11', type: 'expense', status: 'pending', categoryId: 'utilities',
  paymentMethod: 'pix', recurrence: 'single',
};

function renderSheet(options: {
  transaction?: Transaction | null;
  hasFutureInstallments?: boolean;
  onClose?: () => void;
  onEdit?: (tx: Transaction) => void;
  onToggleStatus?: (id: string) => void;
  onDuplicate?: (tx: Transaction) => void;
  onDelete?: (id: string, deleteGroup?: boolean) => void;
  onAnticipateInstallments?: (id: string) => void;
  onReverseAnticipation?: (id: string) => void;
}) {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(TransactionActionSheet, {
    isOpen: true,
    transaction: options.transaction === undefined ? baseTransaction : options.transaction,
    originLabel: 'Contas',
    hasFutureInstallments: options.hasFutureInstallments,
    onClose: options.onClose ?? (() => {}),
    onEdit: options.onEdit ?? (() => {}),
    onToggleStatus: options.onToggleStatus ?? (() => {}),
    onDuplicate: options.onDuplicate ?? (() => {}),
    onDelete: options.onDelete ?? (() => {}),
    onAnticipateInstallments: options.onAnticipateInstallments,
    onReverseAnticipation: options.onReverseAnticipation,
  })));
  return container;
}

function button(fragment: string, page = container!) {
  const found = Array.from(page.querySelectorAll('button')).find((item) => item.textContent?.includes(fragment));
  assert.ok(found, `expected action button containing "${fragment}"`);
  return found as HTMLButtonElement;
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('TransactionActionSheet maps toggle, edit, duplicate, delete and cancel buttons to their callbacks', async () => {
  const calls: string[] = [];
  const page = renderSheet({
    onClose: () => calls.push('close'),
    onToggleStatus: (id) => calls.push(`status:${id}`),
    onEdit: (tx) => calls.push(`edit:${tx.id}`),
    onDuplicate: (tx) => calls.push(`duplicate:${tx.id}`),
    onDelete: (id, group) => calls.push(`delete:${id}:${group}`),
  });
  assert.equal(page.querySelector('[role="dialog"]')?.getAttribute('aria-label'), 'Ações rápidas para Conta de luz');

  await act(async () => { button('Marcar como Efetivado', page).click(); });
  assert.deepEqual(calls.splice(0), ['status:tx-actions-1', 'close']);
  await act(async () => { button('Editar Lançamento', page).click(); });
  assert.deepEqual(calls.splice(0), ['edit:tx-actions-1', 'close']);
  await act(async () => { button('Duplicar Lançamento', page).click(); });
  assert.deepEqual(calls.splice(0), ['duplicate:tx-actions-1', 'close']);
  await act(async () => { button('Excluir Lançamento', page).click(); });
  assert.deepEqual(calls.splice(0), ['delete:tx-actions-1:false', 'close']);
  await act(async () => { button('Cancelar', page).click(); });
  assert.deepEqual(calls, ['close']);
});

test('TransactionActionSheet exposes installment anticipation and reversal only when applicable', async () => {
  const tx: Transaction = {
    ...baseTransaction, installmentGroupId: 'installment-synthetic', isAnticipated: true,
    originalCompetenceMonth: '2027-03',
  };
  const calls: string[] = [];
  const page = renderSheet({
    transaction: tx,
    hasFutureInstallments: true,
    onAnticipateInstallments: (id) => calls.push(`anticipate:${id}`),
    onReverseAnticipation: (id) => calls.push(`reverse:${id}`),
    onClose: () => calls.push('close'),
  });
  assert.ok(button('Adiantar Parcelas Futuras', page));
  assert.ok(button('Desfazer Antecipação', page));
  await act(async () => { button('Adiantar Parcelas Futuras', page).click(); });
  assert.deepEqual(calls.splice(0), ['anticipate:installment-synthetic', 'close']);
  await act(async () => { button('Desfazer Antecipação', page).click(); });
  assert.deepEqual(calls.splice(0), ['reverse:tx-actions-1', 'close']);

  const hidden = renderSheet({ transaction: baseTransaction });
  assert.equal(Array.from(hidden.querySelectorAll('button')).some((item) => item.textContent?.includes('Adiantar Parcelas Futuras')), false);
  assert.equal(Array.from(hidden.querySelectorAll('button')).some((item) => item.textContent?.includes('Desfazer Antecipação')), false);
});

test('TransactionActionSheet closes on Escape, backdrop, and does not render closed or without a transaction', async () => {
  let closes = 0;
  const page = renderSheet({ onClose: () => closes += 1 });
  await act(async () => { window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' })); });
  assert.equal(closes, 1);
  const dialog = page.querySelector<HTMLElement>('[role="dialog"]');
  assert.ok(dialog);
  await act(async () => { dialog.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
  assert.equal(closes, 2);

  act(() => root?.render(React.createElement(TransactionActionSheet, {
    isOpen: false, transaction: baseTransaction, originLabel: 'Contas',
    onClose: () => {}, onEdit: () => {}, onToggleStatus: () => {}, onDuplicate: () => {}, onDelete: () => {},
  })));
  assert.equal(page.querySelector('[role="dialog"]'), null);
  act(() => root?.render(React.createElement(TransactionActionSheet, {
    isOpen: true, transaction: null, originLabel: 'Contas',
    onClose: () => {}, onEdit: () => {}, onToggleStatus: () => {}, onDuplicate: () => {}, onDelete: () => {},
  })));
  assert.equal(page.querySelector('[role="dialog"]'), null);
});
