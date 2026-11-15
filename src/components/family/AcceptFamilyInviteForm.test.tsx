import '../../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { AcceptFamilyInviteForm } from './AcceptFamilyInviteForm';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(onAccept: (code: string) => void) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(AcceptFamilyInviteForm, { inviteId: 'inv-1', onAccept })));
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

test('aceitar só habilita com o código completo e o campo formata o que a pessoa digita', async () => {
  const accepted: string[] = [];
  const page = render((code) => accepted.push(code));
  const input = page.querySelector<HTMLInputElement>('[data-testid="family-invite-code-inv-1"]');
  const button = page.querySelector<HTMLButtonElement>('[data-testid="accept-family-invite-inv-1"]');
  assert.ok(input && button);
  assert.equal(button.disabled, true, 'sem código não dá para aceitar');
  await act(async () => { type(input, 'ab3d'); });
  assert.equal(input.value, 'AB3D');
  assert.equal(button.disabled, true);
  await act(async () => { type(input, 'ab3def4h'); });
  assert.equal(input.value, 'AB3D-EF4H');
  assert.equal(button.disabled, false);
  await act(async () => { button.click(); });
  assert.deepEqual(accepted, ['AB3D-EF4H']);
});

test('o campo explica de onde vem o código e tem rótulo para leitor de tela', () => {
  const page = render(() => {});
  assert.match(page.textContent ?? '', /código que quem convidou enviou/i);
  const input = page.querySelector<HTMLInputElement>('[data-testid="family-invite-code-inv-1"]');
  assert.equal(input?.getAttribute('aria-label'), 'Código do convite');
  assert.equal(input?.getAttribute('autocomplete'), 'off');
});

test('Enter no campo envia o código completo e não envia incompleto', async () => {
  const accepted: string[] = [];
  const page = render((code) => accepted.push(code));
  const input = page.querySelector<HTMLInputElement>('[data-testid="family-invite-code-inv-1"]')!;
  const form = page.querySelector('form')!;
  await act(async () => { type(input, 'ab3d'); form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); });
  assert.deepEqual(accepted, []);
  await act(async () => { type(input, 'ab3def4h'); form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); });
  assert.deepEqual(accepted, ['AB3D-EF4H']);
});
