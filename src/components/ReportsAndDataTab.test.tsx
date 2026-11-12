import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { BankAccount, CreditCard, Transaction } from '../types/finance';
import { ReportsAndDataTab } from './ReportsAndDataTab';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let originalAnchorClick: typeof HTMLAnchorElement.prototype.click;
let originalCreateObjectURL: PropertyDescriptor | undefined;
let originalRevokeObjectURL: PropertyDescriptor | undefined;
let originalConsoleError: PropertyDescriptor | undefined;

function renderReports(options: {
  onExportFullBackupJson?: () => void;
  onImportQuickCsvLines?: (lines: string, accountId: string) => number;
  onOpenReconciliation?: () => void;
  onApplyHistoricalInstallmentTotals?: () => void;
  onResetWorkspaceData?: () => void;
  accounts?: BankAccount[];
  cards?: CreditCard[];
  transactions?: Transaction[];
} = {}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      React.createElement(ReportsAndDataTab, {
        selectedMonth: '2026-11',
        accounts: options.accounts ?? [{ id: 'acc-synthetic', name: 'Conta sintética', institution: 'Teste', type: 'checking', initialBalance: 0, color: '#059669', includeInTotal: true }],
        accountBalances: [],
        cards: options.cards ?? [],
        categories: [],
        transactions: options.transactions ?? [],
        investments: [],
        onExportFullBackupJson: options.onExportFullBackupJson ?? (() => {}),
        onImportQuickCsvLines: options.onImportQuickCsvLines ?? (() => 0),
        onOpenReconciliation: options.onOpenReconciliation,
        onApplyHistoricalInstallmentTotals: options.onApplyHistoricalInstallmentTotals,
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
  if (originalConsoleError) Object.defineProperty(console, 'error', originalConsoleError);
  originalAnchorClick = undefined as unknown as typeof HTMLAnchorElement.prototype.click;
  originalCreateObjectURL = undefined;
  originalRevokeObjectURL = undefined;
  originalConsoleError = undefined;
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

test('ReportsAndDataTab supports annual and custom ranges, updating the visible month count', async () => {
  const page = renderReports();
  const annual = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Anual (2026)'));
  assert.ok(annual);
  await act(async () => { annual.click(); });
  assert.ok(page.textContent?.includes('Receitas (7 meses)'), 'annual 2026 preset covers June through December');

  const custom = [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Personalizado');
  assert.ok(custom);
  await act(async () => { custom.click(); });
  const start = page.querySelector<HTMLInputElement>('[aria-label="Mês inicial do relatório"]');
  const end = page.querySelector<HTMLInputElement>('[aria-label="Mês final do relatório"]');
  assert.ok(start && end);
  const setMonth = (input: HTMLInputElement, value: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  await act(async () => {
    setMonth(start, '2026-10');
    setMonth(end, '2026-10');
  });
  assert.ok(page.textContent?.includes('Receitas (1 mês)'), 'matching custom endpoints produce a one-month report');
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

test('ReportsAndDataTab exports a read-only financial history audit for review', async () => {
  const blobs: Blob[] = [];
  const clicked: string[] = [];
  originalCreateObjectURL = Object.getOwnPropertyDescriptor(window.URL, 'createObjectURL');
  originalRevokeObjectURL = Object.getOwnPropertyDescriptor(window.URL, 'revokeObjectURL');
  originalAnchorClick = HTMLAnchorElement.prototype.click;
  Object.defineProperty(window.URL, 'createObjectURL', {
    configurable: true,
    value: (blob: Blob) => {
      blobs.push(blob);
      return 'blob:history-audit';
    },
  });
  Object.defineProperty(window.URL, 'revokeObjectURL', { configurable: true, value: () => {} });
  HTMLAnchorElement.prototype.click = function click() { clicked.push(this.download); };

  const card: CreditCard = {
    id: 'card-audit-ui',
    name: 'Cartão QA',
    brand: 'Visa',
    limit: 5000,
    closingDay: 20,
    dueDay: 5,
    defaultAccountId: 'acc-synthetic',
    color: '#123456',
  };
  const transaction: Transaction = {
    id: 'purchase-audit-ui',
    description: 'Compra histórica',
    amount: 125.5,
    date: '2026-11-21',
    competenceMonth: '2026-12',
    type: 'expense',
    status: 'pending',
    categoryId: 'cat-synthetic',
    creditCardId: card.id,
    paymentMethod: 'credit_card',
    recurrence: 'single',
  };
  const page = renderReports({ cards: [card], transactions: [transaction] });
  assert.match(page.textContent || '', /1 apontamento\(s\) para revisar/);
  const button = page.querySelector<HTMLButtonElement>('[data-testid="download-financial-history-audit"]');
  assert.ok(button);
  await act(async () => { button.click(); });

  assert.deepEqual(clicked, ['minhas-auditoria-historica-2026-11.csv']);
  assert.equal(blobs.length, 1);
  const csv = await blobs[0].text();
  assert.match(csv, /Competência da fatura/);
  assert.match(csv, /2027-01/);
  assert.match(csv, /Não corrigir automaticamente/);
  assert.match(page.textContent || '', /O relatório não altera lançamentos/);
});

test('ReportsAndDataTab requires confirmation before applying historical totals', async () => {
  let applyCalls = 0;
  let backupCalls = 0;
  const card: CreditCard = {
    id: 'card-audit-confirm',
    name: 'Cartão QA',
    brand: 'Visa',
    limit: 5000,
    closingDay: 20,
    dueDay: 28,
    defaultAccountId: 'acc-synthetic',
    color: '#123456',
  };
  const transactions: Transaction[] = [1, 2, 3].map((number) => ({
    id: `audit-parcel-${number}`,
    description: 'Compra histórica',
    amount: 10,
    date: `2026-0${number}-05`,
    competenceMonth: `2026-0${number}`,
    type: 'expense',
    status: 'pending',
    categoryId: 'cat-synthetic',
    creditCardId: card.id,
    paymentMethod: 'credit_card',
    recurrence: 'installment',
    installmentGroupId: 'audit-group-confirm',
    installmentNumber: number,
    installmentTotal: 3,
  }));
  const page = renderReports({
    cards: [card],
    transactions,
    onExportFullBackupJson: () => { backupCalls += 1; },
    onApplyHistoricalInstallmentTotals: () => { applyCalls += 1; },
  });

  const open = page.querySelector<HTMLButtonElement>('[data-testid="apply-high-confidence-history-totals"]');
  assert.ok(open);
  await act(async () => { open.click(); });
  assert.equal(applyCalls, 0);
  assert.match(page.textContent || '', /o histórico não será alterado nesta etapa/);
  const cancel = [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Cancelar');
  assert.ok(cancel);
  await act(async () => { cancel.click(); });
  assert.equal(applyCalls, 0);

  const reopen = page.querySelector<HTMLButtonElement>('[data-testid="apply-high-confidence-history-totals"]');
  assert.ok(reopen);
  await act(async () => { reopen.click(); });
  const downloadBackup = page.querySelector<HTMLButtonElement>('[data-testid="download-history-backup-before-apply"]');
  assert.ok(downloadBackup);
  await act(async () => { downloadBackup.click(); });
  assert.equal(backupCalls, 1);
  assert.equal(applyCalls, 0, 'o histórico não muda até a pessoa conferir o arquivo salvo');
  const confirm = page.querySelector<HTMLButtonElement>('[data-testid="confirm-apply-history-totals"]');
  assert.ok(confirm);
  await act(async () => { confirm.click(); });
  assert.equal(applyCalls, 1);
  assert.equal(backupCalls, 1);
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

test('ReportsAndDataTab imports pasted CSV into the account selected by the user', async () => {
  let targetAccountId = '';
  const accounts: BankAccount[] = [
    { id: 'acc-synthetic', name: 'Conta sintética', institution: 'Teste', type: 'checking', initialBalance: 0, color: '#059669', includeInTotal: true },
    { id: 'acc-secondary', name: 'Carteira de QA', institution: 'Teste', type: 'cash', initialBalance: 0, color: '#2563eb', includeInTotal: false },
  ];
  const page = renderReports({ accounts, onImportQuickCsvLines: (_lines, accountId) => { targetAccountId = accountId; return 1; } });
  const accountSelect = page.querySelector<HTMLSelectElement>('[aria-label="Conta destino da importação em lote"]');
  const csv = page.querySelector<HTMLTextAreaElement>('#csv-paste-box');
  assert.ok(accountSelect && csv);
  await act(async () => {
    accountSelect.value = 'acc-secondary';
    accountSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  const set = (value: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set?.call(csv, value);
    csv.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  await act(async () => {
    set('2026-11-03;Compra sintética secundária;-4,25');
    const form = csv.closest('form');
    assert.ok(form);
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.equal(targetAccountId, 'acc-secondary');
  assert.match(page.textContent ?? '', /1 lançamento\(s\) importado\(s\) com sucesso/);
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

test('ReportsAndDataTab blocks CSV import until a destination account exists', async () => {
  let importCalls = 0;
  const page = renderReports({ accounts: [], onImportQuickCsvLines: () => { importCalls += 1; return 1; } });
  const submit = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Processar e Importar Linhas')) as HTMLButtonElement | undefined;
  const form = page.querySelector<HTMLTextAreaElement>('#csv-paste-box')?.closest('form');
  assert.ok(submit && form);
  assert.equal(submit.disabled, true);
  assert.match(page.textContent ?? '', /Cadastre uma conta antes de importar lançamentos/);

  await act(async () => { form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); });
  assert.equal(importCalls, 0, 'submitting without an account never forwards an empty account ID');
  assert.doesNotMatch(page.textContent ?? '', /lançamento\(s\) importado\(s\) com sucesso/);
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

test('ReportsAndDataTab downloads sanitized CSV data and runs PDF export without errors', async () => {
  const clicked: Array<{ filename: string; href: string }> = [];
  const blobs: Blob[] = [];
  const errors: unknown[][] = [];
  originalConsoleError = Object.getOwnPropertyDescriptor(console, 'error');
  console.error = (...args: unknown[]) => { errors.push(args); };
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
  const transaction: Transaction = {
    id: 'tx-synthetic-export',
    description: '=2+2',
    amount: 8.5,
    date: '2026-11-07',
    competenceMonth: '2026-11',
    type: 'expense',
    status: 'paid',
    categoryId: 'cat-synthetic',
    accountId: 'acc-synthetic',
    paymentMethod: 'pix',
    recurrence: 'single',
  };
  const page = renderReports({ transactions: [transaction] });
  const csv = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Exportar Planilha CSV'));
  assert.ok(csv);
  await act(async () => { csv.click(); });
  assert.ok(clicked.some((link) => link.filename === 'minhas-economias-extrato-2026-11.csv'));
  const csvBlob = blobs.find((blob) => blob.type.includes('text/csv'));
  assert.ok(csvBlob);
  const csvContents = await csvBlob.text();
  assert.match(csvContents, /Data;Competencia;Descricao;Tipo;Status/);
  assert.ok(csvContents.includes(`"'=2+2"`), 'formula-like descriptions are neutralized in the exported CSV');
  assert.match(csvContents, /"-8,50"/);
  const pdf = page.querySelector<HTMLButtonElement>('[aria-label="Exportar relatório financeiro do mês em PDF formatado"]');
  assert.ok(pdf);
  await act(async () => { pdf.click(); });
  // O gerador de PDF é carregado sob demanda: espera a ação terminar.
  for (let i = 0; i < 100 && pdf.disabled; i++) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
  }
  assert.deepEqual(errors, [], 'PDF action reaches the PDF generator without reporting a generation error');
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

test('fluxo de caixa diário mostra só dias com movimento e expande para todos os dias do mês', async () => {
  const page = renderReports({ transactions: [] });
  const rows = () => page.querySelectorAll('[data-testid="daily-flow-row"]').length;
  const toggle = page.querySelector<HTMLButtonElement>('[data-testid="daily-flow-toggle"]');
  assert.ok(toggle);
  const collapsed = rows();
  assert.ok(collapsed > 0 && collapsed < 28, 'por padrão mostra só dias de referência e com movimento');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  await act(async () => { toggle.click(); });
  assert.ok(rows() >= 28 && rows() <= 31, 'expandido mostra todos os dias do mês');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.match(toggle.textContent ?? '', /Ver só dias com movimento/);
  await act(async () => { toggle.click(); });
  assert.equal(rows(), collapsed);
});

test('fluxo de caixa diário explica ao passar o mouse a saída de fatura em atraso', () => {
  const page = renderReports({
    cards: [{ id: 'card-tip', name: 'Nubank', brand: 'Visa', limit: 5000, closingDay: 20, dueDay: 5, defaultAccountId: 'acc-synthetic', color: '#000000' }],
    transactions: [{
      id: 'fatura-antiga', description: 'Compra antiga', amount: 599.59, date: '2026-10-02', competenceMonth: '2026-10',
      type: 'expense', status: 'pending', categoryId: 'cat-outros', creditCardId: 'card-tip', paymentMethod: 'credit_card', recurrence: 'single',
    }],
  });
  const note = page.querySelector<HTMLElement>('[data-testid="daily-flow-expense-note"]');
  assert.ok(note, 'valor da fatura tem aviso');
  assert.match(note.getAttribute('title') ?? '', /Fatura de Outubro de 2026 do Nubank, ainda não paga \(em atraso\)/);
  assert.match(note.textContent ?? '', /599,59/);
});
