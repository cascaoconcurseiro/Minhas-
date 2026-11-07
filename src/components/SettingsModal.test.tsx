import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { AppSettings } from '../types/finance';
import { parseFullFinanceBackup } from '../utils/fullBackup';
import { SettingsModal } from './SettingsModal';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let originalConfirm: typeof window.confirm;
let originalFileReader: typeof globalThis.FileReader;

const settings: AppSettings = {
  theme: 'light',
  density: 'comfortable',
  privacyMode: false,
  showOverviewAlerts: true,
  alertsExpandedByDefault: false,
  budgetWarningPercent: 80,
  userName: 'Conta sintética',
  userPixKey: '',
};

function renderSettings(onExport: () => void, onImport: (jsonText: string) => boolean) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      React.createElement(SettingsModal, {
        isOpen: true,
        onClose: () => {},
        settings,
        initialTab: 'profile',
        isUserLoggedIn: true,
        userEmail: 'synthetic@example.test',
        onUpdateSettings: () => {},
        onExportFullBackupJson: onExport,
        onImportFullBackupJson: onImport,
        onResetWorkspaceData: () => {},
      })
    );
  });
  return container;
}

function uploadJsonFile(page: HTMLElement, contents: string) {
  const fileInput = page.querySelector<HTMLInputElement>('input[type="file"][accept*="application/json"]');
  assert.ok(fileInput, 'deve existir input de importação JSON');
  const file = new File([contents], 'backup-sintetico.json', { type: 'application/json' });
  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: [file],
  });
  fileInput.dispatchEvent(new window.Event('change', { bubbles: true }));
  return fileInput;
}

class SyntheticFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((event: ProgressEvent<FileReader>) => unknown) | null = null;

  readAsText(file: Blob) {
    void file.text().then((text) => {
      this.result = text;
      this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
    });
  }
}

beforeEach(() => {
  originalConfirm = window.confirm;
  originalFileReader = globalThis.FileReader;
  globalThis.FileReader = SyntheticFileReader as unknown as typeof FileReader;
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  window.confirm = originalConfirm;
  globalThis.FileReader = originalFileReader;
});

test('SettingsModal exports the workspace backup through its callback', async () => {
  let exportCount = 0;
  const page = renderSettings(() => { exportCount += 1; }, () => true);
  const exportButton = Array.from(page.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Baixar backup do workspace (.JSON)')
  );
  assert.ok(exportButton);

  await act(async () => { exportButton.click(); });
  assert.equal(exportCount, 1);
});

test('SettingsModal confirms restore, forwards synthetic JSON, and reports success', async () => {
  const syntheticBackup = JSON.stringify({
    version: 6,
    ownerUserId: 'synthetic-neon-user',
    exportedAt: '2026-11-07T00:00:00.000Z',
    accounts: [],
    cards: [],
    categories: [{
      id: 'synthetic-category',
      name: 'Alimentação',
      type: 'expense',
      bucket: 'essential',
      monthlyBudget: 100,
      color: '#059669',
      icon: 'shopping-cart',
      subcategories: [],
    }],
    transactions: [],
    goals: [],
    investments: [],
    trips: [],
    familyMembers: [],
    investmentTargets: {},
    settings: {},
  });
  let importedText = '';
  let importedOwnerId: string | undefined;
  let confirmationMessage = '';
  window.confirm = (message?: string) => {
    confirmationMessage = message ?? '';
    return true;
  };
  const page = renderSettings(() => {}, (jsonText) => {
    importedText = jsonText;
    importedOwnerId = parseFullFinanceBackup(jsonText)?.ownerUserId;
    return importedOwnerId === 'synthetic-neon-user';
  });

  await act(async () => {
    const fileInput = uploadJsonFile(page, syntheticBackup);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(fileInput.value, '', 'o input é limpo após ler o arquivo');
  });

  assert.match(confirmationMessage, /substituirá os dados atuais do workspace/);
  assert.equal(importedText, syntheticBackup);
  assert.equal(importedOwnerId, 'synthetic-neon-user');
  assert.match(page.textContent ?? '', /Backup carregado na sessão/);
});

test('SettingsModal reports rejected JSON and does not claim restoration succeeded', async () => {
  window.confirm = () => true;
  let importCount = 0;
  const page = renderSettings(() => {}, () => {
    importCount += 1;
    return false;
  });

  await act(async () => {
    uploadJsonFile(page, '{invalid-json');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.equal(importCount, 1);
  assert.match(page.textContent ?? '', /Arquivo JSON inválido ou fora do padrão/);
  assert.doesNotMatch(page.textContent ?? '', /Backup carregado na sessão/);
});

test('SettingsModal does not invoke restore when the user cancels confirmation', async () => {
  window.confirm = () => false;
  let importCount = 0;
  const page = renderSettings(() => {}, () => {
    importCount += 1;
    return true;
  });

  await act(async () => {
    uploadJsonFile(page, '{"synthetic":true}');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.equal(importCount, 0);
  assert.doesNotMatch(page.textContent ?? '', /Backup carregado na sessão/);
});
