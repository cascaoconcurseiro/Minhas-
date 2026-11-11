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

let authStateUser: SyntheticUser | null = syntheticUser;
let authStateListener: ((user: SyntheticUser | null) => void) | null = null;
const signInCalls: Array<[string, string]> = [];
const registerCalls: Array<[string, string, string]> = [];
const saveRevisionArgs: number[] = [];
const authMock = {
  get currentUser() { return authStateUser; },
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
let saveWorkspaceImpl: (expectedRevision: number) => Promise<{ revision: number; updatedAt: string }> = async () => ({
  revision: 8,
  updatedAt: '2026-11-07T12:00:01.000Z',
});
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

mock.module('../lib/authClient', () => ({
  auth: authMock,
  onAuthStateChanged: (_auth: unknown, callback: (user: SyntheticUser | null) => void) => {
    authStateListener = callback;
    callback(authStateUser);
    unsubscribeAuth = () => {};
    return unsubscribeAuth;
  },
  getAuthErrorMessage: () => 'Falha sintética de autenticação.',
  getOrCreateAutoCloudVaultId: () => 'vault_synthetic_app_test',
  getVaultIdForUid: (uid: string) => `vault_uid_${uid}`,
  registerWithEmail: async (name: string, email: string, pass: string) => {
    registerCalls.push([name, email, pass]);
    authStateUser = { ...syntheticUser, email, displayName: name };
    authStateListener?.(authStateUser);
    return authStateUser;
  },
  refreshAuthUser: async (user: SyntheticUser) => user,
  signInWithEmail: async (email: string, pass: string) => {
    signInCalls.push([email, pass]);
    authStateUser = { ...syntheticUser, email };
    authStateListener?.(authStateUser);
    return authStateUser;
  },
  signOutUser: async () => {},
}));

mock.module('../lib/neonWorkspace', () => ({
  createNeonWorkspace: async () => {
    createCalls += 1;
    return { revision: 1, updatedAt: '2026-11-07T12:00:00.000Z' };
  },
  createNeonFamilyInvitation: async () => ({ invitationId: 'qa-invite' }),
  loadNeonFamilyInvitations: async () => [],
  loadNeonSharedTransactions: async () => [],
  loadNeonSharedSnapshot: async () => ({ transactions: [], outgoingSettlements: [] }),
  loadNeonWorkspace: async () => {
    loadCalls += 1;
    return loadWorkspace();
  },
  NeonWorkspaceError: SyntheticNeonWorkspaceError,
  revokeNeonFamilyInvitation: async () => {},
  respondToNeonFamilyInvitation: async () => {},
  saveNeonWorkspace: async (_payload: Record<string, unknown>, expectedRevision: number) => {
    saveCalls += 1;
    saveRevisionArgs.push(expectedRevision);
    return saveWorkspaceImpl(expectedRevision);
  },
  syncNeonSharedTransactions: async () => {},
}));

mock.module('../components/OverviewTab', () => ({
  OverviewTab: ({ accounts, onToggleAccountInTotal }: {
    accounts: Array<{ id: string; name: string }>;
    onToggleAccountInTotal?: (id: string) => void;
  }) =>
    React.createElement('section', { 'data-testid': 'synthetic-overview' },
      `Contas carregadas do Neon: ${accounts.map((account) => account.name).join(', ')}`,
      React.createElement('button', {
        'data-testid': 'toggle-synthetic-account',
        onClick: () => onToggleAccountInTotal?.(accounts[0]?.id ?? 'qa-account-001'),
      }, 'Alterar conta sintética')),
}));

mock.module('../components/SidebarNav', () => ({
  SidebarNav: ({ cloudSyncStatus }: { cloudSyncStatus: string }) =>
    React.createElement('nav', { 'aria-label': 'Navegação sintética', 'data-cloud-sync-status': cloudSyncStatus },
      `Estado da nuvem: ${cloudSyncStatus}`),
}));
mock.module('../components/WorkspaceConflictModal', () => ({
  WorkspaceConflictModal: ({
    conflict,
    isOpen,
    onKeepLocal,
    onUseCloud,
  }: {
    conflict: { remoteSnapshot: SyntheticSnapshot };
    isOpen: boolean;
    onKeepLocal: () => void;
    onUseCloud: () => void;
  }) => isOpen
    ? React.createElement('section', { 'data-testid': 'workspace-conflict' },
      `Conflito remoto: ${conflict.remoteSnapshot.revision}`,
      React.createElement('button', { 'data-testid': 'keep-local-version', onClick: onKeepLocal }, 'Manter local'),
      React.createElement('button', { 'data-testid': 'use-cloud-version', onClick: onUseCloud }, 'Usar nuvem'))
    : null,
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
  saveWorkspaceImpl = async () => ({ revision: 8, updatedAt: '2026-11-07T12:00:01.000Z' });
  saveRevisionArgs.length = 0;
  unsubscribeAuth = null;
  authStateUser = syntheticUser;
  authStateListener = null;
  signInCalls.length = 0;
  registerCalls.length = 0;
  localStorage.clear();
  console.error = originalConsoleError;
});

function enterText(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}

async function submitCredentials(page: HTMLDivElement, fields: Array<[string, string]>) {
  const form = page.querySelector('form');
  assert.ok(form);
  await act(async () => {
    for (const [selector, value] of fields) {
      const input = page.querySelector<HTMLInputElement>(selector);
      assert.ok(input);
      enterText(input, value);
    }
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

test('email login through the app transitions from Firebase auth screen to Neon workspace', async () => {
  authStateUser = null;
  const page = renderApp();
  await waitFor(() => assert.match(page.textContent ?? '', /Acesse sua conta/));
  assert.ok(page.querySelector('[data-testid="login-email-input"]'));
  assert.equal(page.querySelector('[data-testid="synthetic-overview"]'), null);

  await submitCredentials(page, [
    ['[data-testid="login-email-input"]', 'SYNTHETIC@example.test'],
    ['[data-testid="login-password-input"]', 'senha-segura'],
  ]);

  await waitFor(() => assert.match(page.textContent ?? '', /Contas carregadas do Neon/));
  assert.deepEqual(signInCalls, [['synthetic@example.test', 'senha-segura']]);
  assert.equal(registerCalls.length, 0);
  assert.equal(loadCalls, 1);
  assert.equal(page.querySelector('[data-cloud-sync-status]')?.getAttribute('data-cloud-sync-status'), 'synced');
});

test('email registration through the app uses Firebase and then hydrates the Neon workspace', async () => {
  authStateUser = null;
  const page = renderApp();
  await waitFor(() => assert.match(page.textContent ?? '', /Acesse sua conta/));

  const createTab = Array.from(page.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Criar Nova Conta')
  );
  assert.ok(createTab);
  await act(async () => { createTab.click(); });
  await submitCredentials(page, [
    ['input[type="text"]', '  Conta QA  '],
    ['[data-testid="login-email-input"]', 'NEW@example.test'],
    ['[data-testid="login-password-input"]', 'senha-segura'],
  ]);

  await waitFor(() => assert.match(page.textContent ?? '', /Contas carregadas do Neon/));
  assert.deepEqual(registerCalls, [['Conta QA', 'new@example.test', 'senha-segura']]);
  assert.equal(signInCalls.length, 0);
  assert.equal(loadCalls, 1);
  assert.equal(page.querySelector('[data-cloud-sync-status]')?.getAttribute('data-cloud-sync-status'), 'synced');
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

test('a delayed save from a prior user cannot overwrite the new user workspace revision', async () => {
  let resolveFirstSave!: (result: { revision: number; updatedAt: string }) => void;
  saveWorkspaceImpl = () => new Promise((resolve) => { resolveFirstSave = resolve; });
  const page = renderApp();
  await waitFor(() => assert.ok(page.querySelector('[data-testid="toggle-synthetic-account"]')));

  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="toggle-synthetic-account"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
  await waitFor(() => assert.equal(saveCalls, 1));

  authStateUser = { ...syntheticUser, uid: 'qa-app-user-002', email: 'second@example.test' };
  await act(async () => {
    authStateListener?.(authStateUser);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => assert.match(page.textContent ?? '', /Conta Neon sintética/));
  await act(async () => {
    resolveFirstSave({ revision: 8, updatedAt: '2026-11-07T12:00:01.000Z' });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  saveWorkspaceImpl = async () => ({ revision: 9, updatedAt: '2026-11-07T12:00:02.000Z' });
  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="toggle-synthetic-account"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
  await waitFor(() => assert.equal(saveCalls, 2));
  assert.deepEqual(saveRevisionArgs, [7, 7]);
});

test('a same-email UID switch cancels the prior user workspace load', async () => {
  let resolvePriorLoad!: (snapshot: SyntheticSnapshot) => void;
  let workspaceReads = 0;
  loadWorkspace = () => {
    workspaceReads += 1;
    if (workspaceReads === 1) return new Promise((resolve) => { resolvePriorLoad = resolve; });
    return Promise.resolve(makeSnapshot('Workspace do novo UID'));
  };
  const page = renderApp();
  await waitFor(() => assert.equal(loadCalls, 1));

  authStateUser = { ...syntheticUser, uid: 'qa-app-user-recreated' };
  await act(async () => {
    authStateListener?.(authStateUser);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => {
    assert.equal(loadCalls, 2);
    assert.match(page.textContent ?? '', /Workspace do novo UID/);
  });

  await act(async () => {
    resolvePriorLoad(makeSnapshot('Workspace antigo do mesmo e-mail'));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.match(page.textContent ?? '', /Workspace do novo UID/);
  assert.doesNotMatch(page.textContent ?? '', /Workspace antigo do mesmo e-mail/);
});

test('a delayed 409 refresh from a prior user cannot open a conflict in the new account', async () => {
  let resolveConflictLoad!: (snapshot: SyntheticSnapshot) => void;
  let workspaceReads = 0;
  loadWorkspace = () => {
    workspaceReads += 1;
    if (workspaceReads === 2) return new Promise((resolve) => { resolveConflictLoad = resolve; });
    return Promise.resolve(makeSnapshot(workspaceReads === 1 ? 'Workspace antigo' : 'Workspace novo'));
  };
  saveWorkspaceImpl = async () => { throw new SyntheticNeonWorkspaceError('revisão antiga', 409); };
  const page = renderApp();
  await waitFor(() => assert.ok(page.querySelector('[data-testid="toggle-synthetic-account"]')));

  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="toggle-synthetic-account"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
  await waitFor(() => assert.equal(loadCalls, 2));

  authStateUser = { ...syntheticUser, uid: 'qa-app-user-new-owner', email: 'new-owner@example.test' };
  await act(async () => {
    authStateListener?.(authStateUser);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => {
    assert.equal(loadCalls, 3);
    assert.match(page.textContent ?? '', /Workspace novo/);
  });

  await act(async () => {
    resolveConflictLoad(makeSnapshot('Conflito antigo'));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(page.querySelector('[data-testid="workspace-conflict"]'), null);
  assert.match(page.textContent ?? '', /Workspace novo/);
});

test('a delayed keep-local resolution cannot replace the new user revision', async () => {
  let resolveKeepLocal!: (result: { revision: number; updatedAt: string }) => void;
  let saveAttempt = 0;
  let workspaceReads = 0;
  loadWorkspace = () => {
    workspaceReads += 1;
    return Promise.resolve(makeSnapshot(workspaceReads === 1 ? 'Workspace antigo' : 'Workspace novo'));
  };
  saveWorkspaceImpl = () => {
    saveAttempt += 1;
    if (saveAttempt === 1) return Promise.reject(new SyntheticNeonWorkspaceError('revisão antiga', 409));
    if (saveAttempt === 2) return new Promise((resolve) => { resolveKeepLocal = resolve; });
    return Promise.resolve({ revision: 12, updatedAt: '2026-11-07T12:00:12.000Z' });
  };
  const page = renderApp();
  await waitFor(() => assert.ok(page.querySelector('[data-testid="toggle-synthetic-account"]')));
  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="toggle-synthetic-account"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
  await waitFor(() => assert.ok(page.querySelector('[data-testid="workspace-conflict"]')));

  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="keep-local-version"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => assert.equal(saveCalls, 2));

  authStateUser = { ...syntheticUser, uid: 'qa-app-user-after-conflict', email: 'after-conflict@example.test' };
  await act(async () => {
    authStateListener?.(authStateUser);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => assert.match(page.textContent ?? '', /Workspace novo/));

  await act(async () => {
    resolveKeepLocal({ revision: 99, updatedAt: '2026-11-07T12:00:99.000Z' });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  saveWorkspaceImpl = async () => ({ revision: 13, updatedAt: '2026-11-07T12:00:13.000Z' });
  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="toggle-synthetic-account"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
  await waitFor(() => assert.equal(saveCalls, 3));
  assert.deepEqual(saveRevisionArgs, [7, 7, 7]);
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
