import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { MobileBottomNav } from './MobileBottomNav';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderNav(options: {
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  onOpenNewTransaction?: (mode?: 'expense' | 'income' | 'credit_card' | 'transfer') => void;
  onOpenSettings?: () => void;
  onSignOut?: () => Promise<void>;
  userEmail?: string;
} = {}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(MobileBottomNav, {
    activeTab: options.activeTab ?? 'overview',
    onSelectTab: options.onSelectTab ?? (() => {}),
    onOpenNewTransaction: options.onOpenNewTransaction ?? (() => {}),
    onOpenSettings: options.onOpenSettings ?? (() => {}),
    onSignOut: options.onSignOut,
    userEmail: options.userEmail,
  })));
  return container;
}

function findButton(fragment: string, scope: ParentNode = container!) {
  const button = Array.from(scope.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.includes(fragment) || candidate.getAttribute('aria-label') === fragment
  );
  assert.ok(button, `expected button containing "${fragment}"`);
  return button as HTMLButtonElement;
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('MobileBottomNav dispatches each primary navigation and the quick expense action', async () => {
  const selected: string[] = [];
  const transactionModes: Array<string | undefined> = [];
  const page = renderNav({
    onSelectTab: (tab) => selected.push(tab),
    onOpenNewTransaction: (mode) => transactionModes.push(mode),
  });

  for (const [label, expected] of [['Início', 'overview'], ['Extrato', 'transactions'], ['Cartões', 'cards']] as const) {
    await act(async () => { findButton(label, page).click(); });
    assert.equal(selected.at(-1), expected, `the ${label} button selects ${expected}`);
  }
  await act(async () => { findButton('Novo lançamento', page).click(); });
  assert.deepEqual(transactionModes, ['expense']);
});

test('MobileBottomNav more menu navigates every complementary module and closes after selection', async () => {
  const selected: string[] = [];
  const page = renderNav({ onSelectTab: (tab) => selected.push(tab) });
  const modules = [
    ['Contas & Carteiras', 'accounts'],
    ['Investimentos', 'investments'],
    ['Metas & Reservas', 'goals'],
    ['Viagens & Câmbio', 'trips'],
    ['Orçamentos', 'budgets'],
    ['Compartilhado', 'shared'],
    ['Relatórios & DRE', 'reports'],
  ] as const;

  for (const [label, expected] of modules) {
    await act(async () => { findButton('Mais', page).click(); });
    const dialog = page.querySelector<HTMLElement>('[role="dialog"]');
    assert.ok(dialog, 'opening Mais displays its dialog');
    await act(async () => { findButton(label, dialog).click(); });
    assert.equal(selected.at(-1), expected, `${label} selects ${expected}`);
    assert.equal(page.querySelector('[role="dialog"]'), null, 'choosing a module closes Mais');
  }
});

test('MobileBottomNav closes More by close button or backdrop and invokes settings/sign-out', async () => {
  let settingsOpened = 0;
  let signedOut = 0;
  const page = renderNav({
    onOpenSettings: () => settingsOpened += 1,
    onSignOut: async () => { signedOut += 1; },
    userEmail: 'synthetic@example.test',
  });

  await act(async () => { findButton('Mais', page).click(); });
  const dialog = page.querySelector<HTMLElement>('[role="dialog"]');
  assert.ok(dialog);
  await act(async () => { findButton('Configurações, Tema & Privacidade', dialog).click(); });
  assert.equal(settingsOpened, 1);
  assert.equal(page.querySelector('[role="dialog"]'), null);

  await act(async () => { findButton('Mais', page).click(); });
  const signOut = findButton('Sair da Conta (synthetic@example.test)', page);
  await act(async () => { signOut.click(); });
  assert.equal(signedOut, 1);
  assert.equal(page.querySelector('[role="dialog"]'), null);

  await act(async () => { findButton('Mais', page).click(); });
  const backdrop = page.querySelector<HTMLElement>('[role="dialog"]');
  assert.ok(backdrop);
  await act(async () => { backdrop.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
  assert.equal(page.querySelector('[role="dialog"]'), null, 'backdrop click dismisses the menu');
});
