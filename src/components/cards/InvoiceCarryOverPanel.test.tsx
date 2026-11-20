import '../../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { InvoiceCarryOverPanel } from './InvoiceCarryOverPanel';
import type { CreditCard } from '../../types/finance';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;
const card = { id: 'c1', name: 'Nubank', brand: 'Visa', limit: 5000, closingDay: 28, dueDay: 5, defaultAccountId: 'a', color: '#000' } as CreditCard;

function render(props: Partial<React.ComponentProps<typeof InvoiceCarryOverPanel>>) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const all = { card, invoiceMonth: '2026-12', state: { canCarry: false, canCarryCredit: false, creditAmount: 0, pendingAmount: 0, canUndo: false, carriedAmount: 0 }, onCarryOver: () => undefined, onUndo: () => undefined, ...props };
  act(() => root?.render(React.createElement(InvoiceCarryOverPanel, all)));
  return container;
}
function type(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('não aparece quando não há o que levar nem o que desfazer', () => {
  assert.equal(render({}).querySelector('[data-testid="invoice-carry-over-panel"]'), null);
});

test('mostra o valor e a fatura de destino e leva com encargos digitados', async () => {
  const calls: Array<number | undefined> = [];
  const page = render({ state: { canCarry: true, canCarryCredit: false, creditAmount: 0, pendingAmount: 300, canUndo: false, carriedAmount: 0 }, onCarryOver: (fee) => calls.push(fee) });
  const text = page.textContent ?? '';
  assert.match(text, /300,00/);
  assert.match(text, /janeiro de 2027/i);
  const fee = page.querySelector<HTMLInputElement>('#carry-over-fee');
  const confirm = page.querySelector<HTMLButtonElement>('[data-testid="carry-over-confirm"]');
  assert.ok(fee && confirm);
  await act(async () => { confirm.click(); });
  assert.deepEqual(calls, [undefined], 'sem encargos informados leva só o saldo');
  await act(async () => { type(fee, '2590'); });
  await act(async () => { confirm.click(); });
  assert.deepEqual(calls, [undefined, 25.9]);
});

test('quando já foi levado, mostra quanto e permite desfazer', async () => {
  let undone = 0;
  const page = render({ state: { canCarry: false, canCarryCredit: false, creditAmount: 0, pendingAmount: 0, canUndo: true, carriedAmount: 310.5 }, onUndo: () => { undone += 1; } });
  assert.match(page.textContent ?? '', /310,50/);
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="carry-over-undo"]')?.click(); });
  assert.equal(undone, 1);
});

test('fatura com crédito explica o saldo a favor e leva o crédito sem pedir encargos', async () => {
  const calls: Array<number | undefined> = [];
  const page = render({ state: { canCarry: false, canCarryCredit: true, creditAmount: 100, pendingAmount: -100, canUndo: false, carriedAmount: 0 }, onCarryOver: (fee) => calls.push(fee) });
  assert.match(page.textContent ?? '', /100,00 a seu favor/);
  assert.equal(page.querySelector('#carry-over-fee'), null, 'crédito não tem campo de encargos');
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="carry-over-credit-confirm"]')?.click(); });
  assert.deepEqual(calls, [undefined]);
});

test('crédito já levado é descrito como crédito e pode ser desfeito', () => {
  const page = render({ state: { canCarry: false, canCarryCredit: false, creditAmount: 0, pendingAmount: 0, canUndo: true, carriedAmount: -100 } });
  assert.match(page.textContent ?? '', /Crédito de R\$\s*100,00 desta fatura foi levado/);
});
