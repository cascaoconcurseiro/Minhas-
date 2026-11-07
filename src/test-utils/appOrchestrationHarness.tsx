import './domEnvironment';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';

// Bun module mocks must stay out of the parent suite's shared module registry.
// This harness is launched from App.test.tsx in its own Bun test process.
// @ts-ignore -- Bun provides this test-only runtime module.
import { mock } from 'bun:test';

type SyntheticUser = {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  isAnonymous: false;
};

type SyntheticSnapshot = {
  revision: number;
  updatedAt: string;
  payload: Record<string, unknown>;
};

class SyntheticNeonWorkspaceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const syntheticUser: SyntheticUser = {
  uid: 'qa-app-user-001',
  email: 'app.orchestration@example.test',
  displayName: 'Conta Sintética',
  emailVerified: true,
  isAnonymous: false,
};

const makeSnapshot = (accountName = 'Conta Neon sintética'): SyntheticSnapshot => ({
  revision: 7,
  updatedAt: '2026-11-07T12:00:00.000Z',
  payload: {
    uid: 'legacy-id-overridden-by-auth',
    updatedAt: '2026-11-07T12:00:00.000Z',
    accountsJson: JSON.stringify([{ id: 'qa-account-001', name: accountName, balance: 123.45 }]),
    cardsJson: '[]',
    categoriesJson: '[]',
    transactionsJson: '[]',
    goalsJson: '[]',
    familyMembersJson: '[]',
    investmentsJson: '[]',
    investmentTargetsJson: '{}',
    tripsJson: '[]',
    settingsJson: JSON.stringify({ userName: 'Conta Sintética' }),
  },
});

let loadWorkspace: () => Promise<SyntheticSnapshot> = async () => makeSnapshot();
let loadCalls = 0;
let createCalls = 0;
let saveCalls = 0;
let unsubscribeAuth: (() => void) | null = null;
const originalConsoleError = console.error;
let root: Root | null = null;
let container: HTMLDivElement | null = null;
const cases: Array<{ name: string; run: () => Promise<void> }> = [];
const cleanups: Array<() => void> = [];

function test(name: string, run: () => Promise<void>) {
  cases.push({ name, run });
}

function afterEach(cleanup: () => void) {
  cleanups.push(cleanup);
}

mock.module('../lib/firebase', () => ({
  auth: { currentUser: syntheticUser },
  onAuthStateChanged: (_auth: unknown, callback: (user: SyntheticUser) => void) => {
    callback(syntheticUser);
    unsubscribeAuth = () => {};
    return unsubscribeAuth;
  },
  getOrCreateAutoCloudVaultId: () => 'vault_synthetic_app_test',
  getVaultIdForUid: (uid: string) => `vault_uid_${uid}`,
  registerWithEmail: async () => syntheticUser,
  refreshFirebaseUser: async (user: SyntheticUser) => user,
  resendEmailVerification: async () => {},
  signInWithEmail: async () => syntheticUser,
  signOutFirebaseUser: async () => {},
}));

mock.module('../lib/neonWorkspace', () => ({
  createNeonWorkspace: async () => {
    createCalls += 1;
    return { revision: 1, updatedAt: '2026-11-07T12:00:00.000Z' };
  },
  createNeonFamilyInvitation: async () => ({ invitationId: 'qa-invite' }),
  loadNeonFamilyInvitations: async () => [],
  loadNeonSharedTransactions: async () => [],
  loadNeonWorkspace: async () => {
    loadCalls += 1;
    return loadWorkspace();
  },
  NeonWorkspaceError: SyntheticNeonWorkspaceError,
  revokeNeonFamilyInvitation: async () => {},
  respondToNeonFamilyInvitation: async () => {},
  saveNeonWorkspace: async () => {
    saveCalls += 1;
    return { revision: 8, updatedAt: '2026-11-07T12:00:01.000Z' };
  },
  syncNeonSharedTransactions: async () => {},
}));

mock.module('../components/OverviewTab', () => ({
  OverviewTab: ({ accounts }: { accounts: Array<{ name: string }> }) =>
    React.createElement('section', { 'data-testid': 'synthetic-overview' },
      `Contas carregadas do Neon: ${accounts.map((account) => account.name).join(', ')}`),
}));

mock.module('../components/SidebarNav', () => ({
  SidebarNav: ({ cloudSyncStatus }: { cloudSyncStatus: string }) =>
    React.createElement('nav', { 'aria-label': 'Navegação sintética', 'data-cloud-sync-status': cloudSyncStatus },
      `Estado da nuvem: ${cloudSyncStatus}`),
}));
mock.module('../components/MobileBottomNav', () => ({
  MobileBottomNav: () => React.createElement('nav', { 'aria-label': 'Navegação móvel sintética' }),
}));
mock.module('../components/PWAInstallButton', () => ({
  PWAInstallButton: () => null,
}));

const { default: App } = await import('../App');
const { createRoot } = await import('react-dom/client');

function renderApp() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(App)));
  return container;
}

async function flushReact() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function waitFor(assertion: () => void, timeoutMs = 1_000) {
  const startedAt = Date.now();
  let lastError: unknown;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await flushReact();
    }
  }
  throw lastError;
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  loadWorkspace = async () => makeSnapshot();
  loadCalls = 0;
  createCalls = 0;
  saveCalls = 0;
  unsubscribeAuth = null;
  localStorage.clear();
  console.error = originalConsoleError;
});

test('auth loads the synthetic Neon snapshot before exposing synchronized workspace state', async () => {
  let resolveLoad!: (snapshot: SyntheticSnapshot) => void;
  loadWorkspace = () => new Promise((resolve) => { resolveLoad = resolve; });
  const page = renderApp();

  await waitFor(() => assert.match(page.textContent ?? '', /Conectando ao Neon/));
  assert.match(page.querySelector('[role="alertdialog"]')?.textContent ?? '', /Carregando seus dados/);
  assert.equal(createCalls, 0, 'a pending load must not initialize or overwrite a workspace');
  assert.equal(saveCalls, 0, 'a pending load must not persist initial local state');

  await act(async () => {
    resolveLoad(makeSnapshot());
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  await waitFor(() => {
    assert.match(page.textContent ?? '', /Contas carregadas do Neon: Conta Neon sintética/);
    assert.equal(page.querySelector('[data-cloud-sync-status]')?.getAttribute('data-cloud-sync-status'), 'synced');
  });
  assert.equal(loadCalls, 1);
  assert.equal(createCalls, 0);
  assert.equal(unsubscribeAuth instanceof Function, true);
});

test('failed Neon load keeps the workspace blocked and the retry loads the next snapshot', async () => {
  let attempts = 0;
  loadWorkspace = async () => {
    attempts += 1;
    if (attempts === 1) throw new SyntheticNeonWorkspaceError('Neon indisponível', 503);
    return makeSnapshot('Conta recuperada após retry');
  };
  console.error = () => {};
  const page = renderApp();

  await waitFor(() => assert.match(page.textContent ?? '', /Não foi possível carregar seus dados/));
  assert.match(page.textContent ?? '', /Verifique a conexão e tente novamente/);
  assert.equal(page.querySelector('[role="alertdialog"]') !== null, true);
  assert.equal(createCalls, 0, 'a 503 não pode ser convertida em workspace vazio');
  assert.equal(saveCalls, 0, 'a 503 não pode persistir o fallback local');

  const retry = Array.from(page.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Tentar novamente')
  );
  assert.ok(retry);
  await act(async () => {
    retry.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  await waitFor(() => {
    assert.match(page.textContent ?? '', /Contas carregadas do Neon: Conta recuperada após retry/);
    assert.equal(page.querySelector('[data-cloud-sync-status]')?.getAttribute('data-cloud-sync-status'), 'synced');
  });
  assert.equal(attempts, 2);
  assert.equal(createCalls, 0);
});

for (const currentCase of cases) {
  try {
    await currentCase.run();
    console.log(`PASS ${currentCase.name}`);
  } finally {
    for (const cleanup of cleanups) cleanup();
  }
}
console.log(`${cases.length} pass`);
process.exit(0);
