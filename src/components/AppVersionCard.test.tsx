import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { resetPwaControlForTests } from '../pwa/pwaControl';
import { AppVersionCard } from './AppVersionCard';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  resetPwaControlForTests();
});

test('mostra a versão e avisa quando o navegador não suporta atualização automática', async () => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(AppVersionCard)));
  assert.ok(container.querySelector('[data-testid="app-version-sha"]')?.textContent);
  const button = container.querySelector('[data-testid="app-version-check-btn"]') as HTMLButtonElement;
  await act(async () => { button.click(); await new Promise((resolve) => setTimeout(resolve, 20)); });
  assert.match(container.querySelector('[data-testid="app-version-result"]')?.textContent ?? '', /não atualiza sozinho|mais recente|Sem conexão/);
});
