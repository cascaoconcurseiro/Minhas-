import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { LoginPage } from './LoginPage';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderLoginPage(props: Partial<React.ComponentProps<typeof LoginPage>> = {}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      React.createElement(LoginPage, {
        onSignInEmail: async () => {},
        onRegisterEmail: async () => {},
        ...props,
      })
    );
  });
  return container;
}

function enterText(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('login renderiza acesso Neon por e-mail e não anuncia Firebase nem dados demo', () => {
  const page = renderLoginPage();

  assert.match(page.textContent ?? '', /Acesse sua conta/);
  assert.ok(page.querySelector('[data-testid="login-email-input"]'));
  assert.ok(page.querySelector('[data-testid="login-password-input"]'));
  assert.match(page.textContent ?? '', /Neon Auth protege o acesso/);
  assert.match(page.textContent ?? '', /Neon PostgreSQL/);
  assert.doesNotMatch(page.textContent ?? '', /Firebase Auth|Firestore|Guia Rápido|Quick Guide|dados fictícios/i);
  for (const label of Array.from(page.querySelectorAll('label'))) {
    assert.ok(label.htmlFor, `label "${label.textContent}" should identify its input`);
    assert.equal(document.getElementById(label.htmlFor)?.tagName, 'INPUT');
  }
});

test('alternar para cadastro mostra nome e encaminha os dados normalizados ao callback', async () => {
  let registered: [string, string, string] | null = null;
  const page = renderLoginPage({
    onRegisterEmail: async (...args) => { registered = args; },
  });

  const registerTab = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Criar Nova Conta'));
  assert.ok(registerTab);
  await act(async () => { registerTab.click(); });
  assert.match(page.textContent ?? '', /Crie sua conta gratuita/);
  assert.ok(Array.from(page.querySelectorAll('label')).some((label) => label.textContent?.includes('Seu Nome')));
  const nameLabel = Array.from(page.querySelectorAll('label')).find((label) => label.textContent?.includes('Seu Nome'));
  assert.ok(nameLabel?.htmlFor);
  assert.equal(document.getElementById(nameLabel.htmlFor)?.getAttribute('type'), 'text');

  const loginTab = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Entrar na Conta'));
  assert.ok(loginTab);
  await act(async () => { loginTab.click(); });
  assert.equal(page.querySelector('input[type="text"]'), null);
  await act(async () => { registerTab.click(); });
  assert.ok(page.querySelector('input[type="text"]'));

  const nameInput = page.querySelector<HTMLInputElement>('input[type="text"]');
  const emailInput = page.querySelector<HTMLInputElement>('[data-testid="login-email-input"]');
  const passwordInput = page.querySelector<HTMLInputElement>('[data-testid="login-password-input"]');
  assert.ok(nameInput && emailInput && passwordInput);

  await act(async () => {
    enterText(nameInput, '  Ana  ');
    enterText(emailInput, ' ANA@example.com ');
    enterText(passwordInput, 'senha-forte');
    page.querySelector('form')?.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });

  assert.deepEqual(registered, ['Ana', 'ANA@example.com', 'senha-forte']);
});

test('login submete somente e-mail e senha ao callback de entrada', async () => {
  let signedIn: [string, string] | null = null;
  const page = renderLoginPage({
    onSignInEmail: async (...args) => { signedIn = args; },
  });
  const emailInput = page.querySelector<HTMLInputElement>('[data-testid="login-email-input"]');
  const passwordInput = page.querySelector<HTMLInputElement>('[data-testid="login-password-input"]');
  assert.ok(emailInput && passwordInput);

  await act(async () => {
    enterText(emailInput, 'user@example.com');
    enterText(passwordInput, '123456');
    page.querySelector('form')?.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });

  assert.deepEqual(signedIn, ['user@example.com', '123456']);
  assert.equal(page.querySelector('input[type="text"]'), null);
});

test('validação impede callbacks com e-mail inválido ou senha curta', async () => {
  let callbackCount = 0;
  const page = renderLoginPage({
    onSignInEmail: async () => { callbackCount += 1; },
  });
  const emailInput = page.querySelector<HTMLInputElement>('[data-testid="login-email-input"]');
  const passwordInput = page.querySelector<HTMLInputElement>('[data-testid="login-password-input"]');
  const form = page.querySelector('form');
  assert.ok(emailInput && passwordInput && form);

  await act(async () => {
    enterText(emailInput, 'sem-arroba');
    enterText(passwordInput, '123456');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.match(page.textContent ?? '', /Informe um endereço de e-mail válido/);
  assert.equal(callbackCount, 0);

  await act(async () => {
    enterText(emailInput, 'user@example.com');
    enterText(passwordInput, '12345');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.match(page.textContent ?? '', /A senha deve ter pelo menos 6 caracteres/);
  assert.equal(callbackCount, 0);
});
