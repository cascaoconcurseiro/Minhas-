import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { markUpdatePending, registerPwaControl, resetPwaControlForTests } from './pwaControl';
import { UpdateAvailableBanner } from './UpdateAvailableBanner';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  resetPwaControlForTests();
});

function mount(delayMs: number) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(UpdateAvailableBanner, { delayMs })));
  return container;
}

test('não aparece enquanto não há versão nova', async () => {
  const el = mount(10);
  await act(async () => { await wait(40); });
  assert.equal(el.querySelector('[data-testid="update-available-banner"]'), null);
});

test('aparece quando a versão nova fica esperando e o botão aplica a atualização', async () => {
  let applied = 0;
  registerPwaControl({
    registration: { waiting: {}, installing: null, update: async () => {} } as unknown as ServiceWorkerRegistration,
    applyUpdate: async () => { applied += 1; },
  });
  const el = mount(10);
  await act(async () => { markUpdatePending(); await wait(40); });
  const banner = el.querySelector('[data-testid="update-available-banner"]');
  assert.ok(banner, 'aviso visível depois do tempo de espera');
  assert.match(banner.textContent ?? '', /Nova versão do app disponível/);
  const apply = el.querySelector('[data-testid="update-available-apply"]') as HTMLButtonElement;
  await act(async () => { apply.click(); await wait(20); });
  assert.equal(applied, 1);
});

test('versão que já estava pendente antes do aviso montar também aparece', async () => {
  markUpdatePending();
  const el = mount(10);
  await act(async () => { await wait(40); });
  assert.ok(el.querySelector('[data-testid="update-available-banner"]'));
});
