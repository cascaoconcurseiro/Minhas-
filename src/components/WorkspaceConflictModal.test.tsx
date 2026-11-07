import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { WorkspaceConflictModal, type WorkspaceConflictState } from './WorkspaceConflictModal';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;
let originalShowModal: typeof HTMLDialogElement.prototype.showModal | undefined;
let originalCreateObjectURL: typeof URL.createObjectURL | undefined;
let originalRevokeObjectURL: typeof URL.revokeObjectURL | undefined;
let originalAnchorClick: typeof HTMLAnchorElement.prototype.click;

const conflict: WorkspaceConflictState = {
  localPayload: { accountsJson: '[{"id":"local"}]', transactionsJson: '[{"id":"local-tx"}]' },
  remoteSnapshot: {
    revision: 7,
    updatedAt: '2026-11-07T00:00:00.000Z',
    payload: { accountsJson: '[{"id":"cloud"}]', transactionsJson: '[]' },
  },
};

function renderConflict(options: {
  isSaving?: boolean;
  errorMessage?: string;
  onDismiss?: () => void;
  onKeepLocal?: () => void;
  onUseCloud?: () => void;
}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(WorkspaceConflictModal, {
    conflict,
    isOpen: true,
    isSaving: options.isSaving ?? false,
    errorMessage: options.errorMessage,
    onDismiss: options.onDismiss ?? (() => {}),
    onKeepLocal: options.onKeepLocal ?? (() => {}),
    onUseCloud: options.onUseCloud ?? (() => {}),
  })));
  return container;
}

beforeEach(() => {
  originalShowModal = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  originalCreateObjectURL = URL.createObjectURL;
  originalRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = (() => 'blob:synthetic-conflict') as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL;
  originalAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function click() {};
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  HTMLDialogElement.prototype.showModal = originalShowModal!;
  URL.createObjectURL = originalCreateObjectURL!;
  URL.revokeObjectURL = originalRevokeObjectURL!;
  HTMLAnchorElement.prototype.click = originalAnchorClick;
});

test('WorkspaceConflictModal shows both version summaries and requires a downloaded backup before choosing', async () => {
  let keepCalls = 0;
  let cloudCalls = 0;
  const page = renderConflict({ onKeepLocal: () => { keepCalls += 1; }, onUseCloud: () => { cloudCalls += 1; } });
  const dialog = page.querySelector<HTMLDialogElement>('dialog');
  const keepButton = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Manter esta aba no Neon')) as HTMLButtonElement | undefined;
  const cloudButton = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Descartar alterações locais e carregar Neon')) as HTMLButtonElement | undefined;
  assert.ok(dialog?.open);
  assert.ok(keepButton?.disabled);
  assert.ok(cloudButton?.disabled);
  assert.match(page.querySelector('[aria-label="Resumo da versão Nesta aba"]')?.textContent ?? '', /Contas\s*1/);
  assert.match(page.querySelector('[aria-label="Resumo da versão No Neon"]')?.textContent ?? '', /Contas\s*1/);

  await act(async () => { Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Baixar cópia de segurança das duas versões'))?.click(); });
  assert.equal(keepButton?.disabled, false);
  assert.equal(cloudButton?.disabled, false);
  assert.match(page.textContent ?? '', /Baixar cópia das duas versões novamente/);
  await act(async () => { keepButton?.click(); cloudButton?.click(); });
  assert.equal(keepCalls, 1);
  assert.equal(cloudCalls, 1);
});

test('WorkspaceConflictModal keeps choices disabled while saving and exposes errors', () => {
  const page = renderConflict({ isSaving: true, errorMessage: 'Falha sintética ao salvar.' });
  const choices = Array.from(page.querySelectorAll<HTMLButtonElement>('button')).filter((button) =>
    button.textContent?.includes('Salvando sua versão') || button.textContent?.includes('Descartar alterações locais')
  );
  assert.equal(choices.length, 2);
  assert.ok(choices.every((button) => button.disabled));
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /Falha sintética/);
});

test('WorkspaceConflictModal routes Escape through dismiss and does not alter either payload', async () => {
  let dismissCalls = 0;
  let keepCalls = 0;
  const page = renderConflict({ onDismiss: () => { dismissCalls += 1; }, onKeepLocal: () => { keepCalls += 1; } });
  const dialog = page.querySelector<HTMLDialogElement>('dialog');
  assert.ok(dialog);
  await act(async () => { dialog.dispatchEvent(new window.Event('cancel', { bubbles: true, cancelable: true })); });
  assert.equal(dismissCalls, 1);
  assert.equal(keepCalls, 0);
  assert.equal(conflict.localPayload.accountsJson, '[{"id":"local"}]');
  assert.equal(conflict.remoteSnapshot.payload.accountsJson, '[{"id":"cloud"}]');
});
