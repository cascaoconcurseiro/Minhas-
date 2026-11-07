import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { ReportsAndDataTab } from './ReportsAndDataTab';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let originalAnchorClick: typeof HTMLAnchorElement.prototype.click;
let originalCreateObjectURL: PropertyDescriptor | undefined;
let originalRevokeObjectURL: PropertyDescriptor | undefined;

function renderReports(options: {
  onExportFullBackupJson?: () => void;
  onImportQuickCsvLines?: (lines: string, accountId: string) => number;
  onOpenReconciliation?: () => void;
  onResetWorkspaceData?: () => void;
} = {}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      React.createElement(ReportsAndDataTab, {
        selectedMonth: '2026-11',
        accounts: [{ id: 'acc-synthetic', name: 'Conta sintética', institution: 'Teste', type: 'checking', initialBalance: 0, color: '#059669', includeInTotal: true }],
        accountBalances: [],
        cards: [],
        categories: [],
        transactions: [],
        investments: [],
        onExportFullBackupJson: options.onExportFullBackupJson ?? (() => {}),
        onImportQuickCsvLines: options.onImportQuickCsvLines ?? (() => 0),
        onOpenReconciliation: options.onOpenReconciliation,
        onResetWorkspaceData: options.onResetWorkspaceData ?? (() => {}),
      })
    );
  });
  return container;
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  if (originalAnchorClick) HTMLAnchorElement.prototype.click = originalAnchorClick;
  if (originalCreateObjectURL) Object.defineProperty(window.URL, 'createObjectURL', originalCreateObjectURL);
  else delete (window.URL as unknown as { createObjectURL?: unknown }).createObjectURL;
  if (originalRevokeObjectURL) Object.defineProperty(window.URL, 'revokeObjectURL', originalRevokeObjectURL);
  else delete (window.URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
  originalAnchorClick = undefined as unknown as typeof HTMLAnchorElement.prototype.click;
  originalCreateObjectURL = undefined;
  originalRevokeObjectURL = undefined;
});

test('ReportsAndDataTab recalculates the visible period when a preset changes', async () => {
  const page = renderReports();
  assert.ok(page.textContent?.includes('Receitas (6 meses)'));

  const quarterlyButton = Array.from(page.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Trimestral (3m)')
  );
  assert.ok(quarterlyButton);
  await act(async () => { quarterlyButton.click(); });
  assert.ok(page.textContent?.includes('Receitas (3 meses)'));

  const monthlyButton = Array.from(page.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Mensal (')
  );
  assert.ok(monthlyButton);
  await act(async () => { monthlyButton.click(); });
  assert.ok(page.textContent?.includes('Receitas (1 mês)'));
});

test('ReportsAndDataTab sends the workspace backup action to its callback', async () => {
  let exportCount = 0;
  const page = renderReports({ onExportFullBackupJson: () => { exportCount += 1; } });
  const exportButton = Array.from(page.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Baixar backup do workspace JSON')
  );
  assert.ok(exportButton);

  await act(async () => { exportButton.click(); });
  assert.equal(exportCount, 1);
});

test('ReportsAndDataTab applies custom month range and routes reconciliation action', async () => {
  let reconciliationCalls = 0;
  const page = renderReports({ onOpenReconciliation: () => { reconciliationCalls += 1; } });
  const custom = [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Personalizado');
  assert.ok(custom);
  await act(async () => { custom.click(); });
  const start = page.querySelector<HTMLInputElement>('[aria-label="Mês inicial do relatório"]');
  const end = page.querySelector<HTMLInputElement>('[aria-label="Mês final do relatório"]');
  assert.ok(start && end);
  assert.equal(start.value, '2026-06');
  assert.equal(end.value, '2026-11');
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(start, '2026-10');
    start.dispatchEvent(new window.Event('input', { bubbles: true }));
    start.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.ok(page.textContent?.includes('Receitas (2 meses)'), 'período customizado atualiza os agregados exibidos');
  const reconciliation = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Conciliação Inteligente'));
  assert.ok(reconciliation);
  await act(async () => { reconciliation.click(); });
  assert.equal(reconciliationCalls, 1);
});

test('ReportsAndDataTab forwards synthetic CSV text and target account, and reports import result', async () => {
  let importArgs: [string, string] | null = null;
  const page = renderReports({ onImportQuickCsvLines: (lines, accountId) => {
    importArgs = [lines, accountId]; return 2;
  } });
  const csv = page.querySelector<HTMLTextAreaElement>('#csv-paste-box');
  assert.ok(csv);
  const set = (value: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set?.call(csv, value);
    csv.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  await act(async () => {
    set('2026-11-01;Compra sintética;-12,50');
    const form = csv.closest('form');
    assert.ok(form);
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.deepEqual(importArgs, ['2026-11-01;Compra sintética;-12,50', 'acc-synthetic']);
  assert.match(page.textContent ?? '', /2 lançamento\(s\) importado\(s\)/);
  assert.equal(csv.value, '');
});

test('ReportsAndDataTab keeps empty or invalid CSV visible and never reports a zero import as success', async () => {
  let importCalls = 0;
  const page = renderReports({ onImportQuickCsvLines: () => { importCalls += 1; return 0; } });
  const csv = page.querySelector<HTMLTextAreaElement>('#csv-paste-box');
  assert.ok(csv);
  const form = csv.closest('form');
  assert.ok(form);
  await act(async () => { form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); });
  assert.equal(importCalls, 1);
  assert.match(page.textContent ?? '', /Use o formato: YYYY-MM-DD/);
  assert.doesNotMatch(page.textContent ?? '', /0 lançamento\(s\) importado\(s\) com sucesso/);

  const set = (value: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set?.call(csv, value);
    csv.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  await act(async () => {
    set('data inv\u00e1lida;Linha sem valor;abc');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.equal(importCalls, 2);
  assert.equal(csv.value, 'data inv\u00e1lida;Linha sem valor;abc', 'texto rejeitado permanece para corre\u00e7\u00e3o');
  assert.match(page.textContent ?? '', /Use o formato: YYYY-MM-DD/);
});

test('ReportsAndDataTab reset cancellation preserves data and confirmation invokes callback once', async () => {
  let resets = 0;
  const page = renderReports({ onResetWorkspaceData: () => { resets += 1; } });
  const open = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Limpar dados pessoais'));
  assert.ok(open);
  await act(async () => { open.click(); });
  const cancel = [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Cancelar');
  assert.ok(cancel);
  await act(async () => { cancel.click(); });
  assert.equal(resets, 0);
  const reopen = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Limpar dados pessoais'));
  assert.ok(reopen);
  await act(async () => { reopen.click(); });
  const confirm = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Confirmar limpeza pessoal'));
  assert.ok(confirm);
  await act(async () => { confirm.click(); });
  assert.equal(resets, 1);
});

test('ReportsAndDataTab downloads the CSV and invokes the PDF export action locally', async () => {
  const clicked: Array<{ filename: string; href: string }> = [];
  const blobs: Blob[] = [];
  originalAnchorClick = HTMLAnchorElement.prototype.click;
  originalCreateObjectURL = Object.getOwnPropertyDescriptor(window.URL, 'createObjectURL');
  originalRevokeObjectURL = Object.getOwnPropertyDescriptor(window.URL, 'revokeObjectURL');
  Object.defineProperty(window.URL, 'createObjectURL', {
    configurable: true, value: (blob: Blob) => { blobs.push(blob); return `blob:synthetic-${blobs.length}`; },
  });
  Object.defineProperty(window.URL, 'revokeObjectURL', { configurable: true, value: () => {} });
  HTMLAnchorElement.prototype.click = function click() {
    clicked.push({ filename: this.download, href: this.href });
  };
  const page = renderReports();
  const csv = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Exportar Planilha CSV'));
  assert.ok(csv);
  await act(async () => { csv.click(); });
  assert.ok(clicked.some((link) => link.filename === 'minhas-economias-extrato-2026-11.csv'));
  assert.ok(blobs.some((blob) => blob.type.includes('text/csv')));
  const pdf = page.querySelector<HTMLButtonElement>('[aria-label="Exportar relatório financeiro do mês em PDF formatado"]');
  assert.ok(pdf);
  await act(async () => { pdf.click(); });
  assert.equal(pdf.disabled, false, 'ação volta a ficar disponível ao concluir a geração');
  assert.match(pdf.textContent ?? '', /Exportar Relatório em PDF/);
});

test('CSV import textarea is explicitly named by its visible label', () => {
  const page = renderReports();
  const pasteBox = page.querySelector<HTMLTextAreaElement>('#csv-paste-box');
  assert.ok(pasteBox);
  const label = Array.from(page.querySelectorAll('label')).find((candidate) => candidate.control === pasteBox);
  assert.ok(label);
  pasteBox.focus();
  assert.equal(document.activeElement, pasteBox);
});
