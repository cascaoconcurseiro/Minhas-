import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { AppSettings } from '../types/finance';
import { AuthAndCloudTab } from './AuthAndCloudTab';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;
const originalFetch = globalThis.fetch;

function renderAuthAndCloudTab(
  props: Partial<React.ComponentProps<typeof AuthAndCloudTab>> = {}
) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      React.createElement(AuthAndCloudTab, {
        userEmail: null,
        userDisplayName: null,
        isAnonymousUser: false,
        autoVaultId: 'vault_synthetic_test',
        cloudSyncStatus: 'local',
        lastSyncedAt: null,
        settings: { userName: '', userPixKey: '' } as AppSettings,
        accounts: [],
        cards: [],
        categories: [],
        transactions: [],
        investments: [],
        goals: [],
        trips: [],
        onSignInEmail: async () => {},
        onRegisterEmail: async () => {},
        onSignOut: async () => {},
        onForceCloudSync: async () => {},
        onUpdateSettings: () => {},
        ...props,
      })
    );
  });
  return container;
}

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('AuthAndCloudTab reports unavailable Neon and API when health is degraded', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: 'degraded',
    geminiConfigured: false,
    services: { neon: 'error', firebaseAuthConfigured: true },
  }), { status: 503, headers: { 'Content-Type': 'application/json' } });

  const page = renderAuthAndCloudTab();
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

  assert.match(page.textContent ?? '', /Firebase Auth, API ou Neon indisponível/);
  assert.match(page.textContent ?? '', /API indisponível/);
  assert.match(page.textContent ?? '', /Neon indisponível/);
  assert.doesNotMatch(page.textContent ?? '', /Dados sincronizados com Neon/);
});

test('AuthAndCloudTab labels login fields and registration name', async () => {
  const page = renderAuthAndCloudTab();
  for (const id of ['cloud-auth-email', 'cloud-auth-password']) {
    const field = page.querySelector<HTMLElement>(`#${id}`);
    assert.ok(field);
    assert.ok(Array.from(page.querySelectorAll('label')).some((label) => label.control === field));
  }
  const registerButton = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Criar Conta'));
  assert.ok(registerButton);
  await act(async () => { registerButton.click(); });
  const nameField = page.querySelector<HTMLElement>('#cloud-register-name');
  assert.ok(nameField);
  assert.ok(Array.from(page.querySelectorAll('label')).some((label) => label.control === nameField));
});

test('AuthAndCloudTab submits email and password to the Firebase sign-in callback', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: 'ok',
    geminiConfigured: false,
    services: { neon: 'ok', firebaseAuthConfigured: true },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  let signedIn: [string, string] | null = null;
  const page = renderAuthAndCloudTab({
    onSignInEmail: async (...args) => { signedIn = args; },
  });
  const inputs = page.querySelectorAll<HTMLInputElement>('input[type="email"], input[type="password"]');
  const form = page.querySelector('form');
  assert.equal(inputs.length, 2);
  assert.ok(form);

  await act(async () => {
    setInputValue(inputs[0]!, ' user@example.com ');
    setInputValue(inputs[1]!, 'synthetic-password');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });

  assert.deepEqual(signedIn, ['user@example.com', 'synthetic-password']);
  assert.match(page.textContent ?? '', /Sessão iniciada como user@example\.com/);
  assert.match(page.textContent ?? '', /workspace será carregado do Neon/);
});
