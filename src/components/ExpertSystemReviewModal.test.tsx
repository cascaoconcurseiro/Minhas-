import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { ExpertSystemReviewModal } from './ExpertSystemReviewModal';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;
let originalFetch: typeof fetch;

function renderExpert(options: {
  onClose?: () => void;
  onChangeClarityMode?: (mode: 'complete' | 'essential') => void;
  onNavigateTab?: (tab: string) => void;
  onRunDiagnosticAndRepair?: () => { repairedCount: number; repairedLog: string[] };
  cloudSyncStatus?: 'local' | 'syncing' | 'synced' | 'error';
}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(ExpertSystemReviewModal, {
    isOpen: true,
    onClose: options.onClose ?? (() => {}),
    viewClarityMode: 'complete',
    onChangeClarityMode: options.onChangeClarityMode ?? (() => {}),
    onNavigateTab: options.onNavigateTab ?? (() => {}),
    cloudSyncStatus: options.cloudSyncStatus ?? 'synced',
    onRunDiagnosticAndRepair: options.onRunDiagnosticAndRepair,
  })));
  return container;
}

beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: 'ok',
    services: { neon: 'not_checked', neonConfigured: true, firebaseAuthConfigured: true },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  globalThis.fetch = originalFetch;
});

test('ExpertSystemReviewModal switches all sections and toggles clarity mode', async () => {
  const modes: string[] = [];
  const page = renderExpert({ onChangeClarityMode: (mode) => modes.push(mode) });
  await act(async () => { await Promise.resolve(); });
  const flowTab = page.querySelector<HTMLButtonElement>('[data-testid="verifier-tab-guide-btn"]');
  const modulesTab = page.querySelector<HTMLButtonElement>('[data-testid="verifier-tab-modules-btn"]');
  const liveTab = page.querySelector<HTMLButtonElement>('[data-testid="verifier-tab-live-btn"]');
  assert.ok(flowTab && modulesTab && liveTab);
  await act(async () => { flowTab.click(); });
  assert.match(page.textContent ?? '', /Pagamento de Fatura & Cascata Reversa/);
  await act(async () => { modulesTab.click(); });
  assert.match(page.textContent ?? '', /Investimentos \+ Google Finance Sync/);
  await act(async () => { liveTab.click(); });
  const clarityButton = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Visão Completa Ativa'));
  assert.ok(clarityButton);
  await act(async () => { clarityButton.click(); });
  assert.deepEqual(modes, ['essential']);
});

test('ExpertSystemReviewModal runs local diagnosis even if health fails and labels the result as warning', async () => {
  globalThis.fetch = async () => { throw new Error('offline synthetic'); };
  let scanCalls = 0;
  const page = renderExpert({ onRunDiagnosticAndRepair: () => { scanCalls += 1; return { repairedCount: 1, repairedLog: ['ajuste sintético'] }; }, cloudSyncStatus: 'error' });
  const runButton = page.querySelector<HTMLButtonElement>('[data-testid="modal-run-verifier-btn"]');
  assert.ok(runButton);
  await act(async () => { runButton.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
  assert.equal(scanCalls, 1);
  assert.equal(page.querySelector('[role="alert"]')?.getAttribute('data-testid'), 'modal-verifier-result');
  assert.match(page.textContent ?? '', /dados locais foram preservados/);
});

test('ExpertSystemReviewModal navigates to a selected module, closes by button, overlay, and Escape', async () => {
  let closeCalls = 0;
  const navigations: string[] = [];
  const page = renderExpert({ onClose: () => { closeCalls += 1; }, onNavigateTab: (tab) => navigations.push(tab) });
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="verifier-tab-modules-btn"]')?.click(); });
  const target = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Ir para Conta, Nuvem & Auditoria SSOT'));
  assert.ok(target);
  await act(async () => { target.click(); });
  assert.deepEqual(navigations, ['cloud']);
  assert.equal(closeCalls, 1);

  const closeButton = page.querySelector<HTMLButtonElement>('[aria-label="Fechar diagnóstico"]');
  assert.ok(closeButton);
  await act(async () => { closeButton.click(); });
  const dialog = page.querySelector<HTMLElement>('[role="dialog"]');
  assert.ok(dialog);
  await act(async () => {
    dialog.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  });
  assert.equal(closeCalls, 4);
});

test('ExpertSystemReviewModal reports when local diagnostic callback is unavailable', async () => {
  const page = renderExpert({});
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="modal-run-verifier-btn"]')?.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
  assert.match(page.textContent ?? '', /diagnóstico não está disponível nesta tela/);
});
