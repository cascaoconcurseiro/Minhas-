import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { BankAccount, InvestmentAsset, InvestmentTargetMap } from '../types/finance';
import { InvestmentsTab } from './InvestmentsTab';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const existingAsset: InvestmentAsset = {
  id: 'asset-synthetic-1',
  ticker: 'SYN1',
  name: 'Ativo sintético',
  assetClass: 'renda_fixa_pos',
  institution: 'Corretora sintética',
  quantity: 2,
  averagePrice: 100,
  currentPrice: 105,
  indexerLabel: '100% CDI',
  liquidity: 'D+0 (Liquidez Diária)',
  monthlyYieldPercent: 0.8,
  isTaxExempt: false,
};

function renderInvestmentsTab(options: {
  assets?: InvestmentAsset[];
  onAddAsset?: (asset: Omit<InvestmentAsset, 'id'>) => void;
  onUpdateAsset?: (asset: InvestmentAsset) => void;
  onDeleteAsset?: (assetId: string) => void;
  onRecordDividendIncome?: (asset: InvestmentAsset, amount: number, accountId: string) => void;
  onOperateAsset?: (assetId: string, operationType: 'buy' | 'sell' | 'update_quote', quantity: number, price: number, accountId?: string) => void;
  accounts?: BankAccount[];
  onUpdateTargetMap?: (targets: InvestmentTargetMap) => void;
  onBatchUpdateAssets?: (assets: InvestmentAsset[]) => void;
}) {
  // Keep every DOM test synthetic: no auto-sync may issue a network request on mount.
  localStorage.setItem('minhas_economias_gfinance_autosync', '0');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      React.createElement(InvestmentsTab, {
        getAuthToken: async () => 'synthetic-token',
        selectedMonth: '2026-11',
        assets: options.assets ?? [],
        accounts: options.accounts ?? [],
        transactions: [],
        monthlyLivingExpense: 0,
        onAddAsset: options.onAddAsset ?? (() => {}),
        onUpdateAsset: options.onUpdateAsset ?? (() => {}),
        onBatchUpdateAssets: options.onBatchUpdateAssets,
        onDeleteAsset: options.onDeleteAsset ?? (() => {}),
        onOperateAsset: options.onOperateAsset ?? (() => {}),
        onRecordDividendIncome: options.onRecordDividendIncome ?? (() => {}),
        onUpdateTargetMap: options.onUpdateTargetMap,
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
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  localStorage.removeItem('minhas_economias_gfinance_autosync');
});

test('InvestmentsTab validates and creates a normalized synthetic asset', async () => {
  let createdAsset: Omit<InvestmentAsset, 'id'> | null = null;
  const page = renderInvestmentsTab({
    onAddAsset: (asset) => { createdAsset = asset; },
  });
  const openFormButton = page.querySelector<HTMLButtonElement>('[data-testid="open-new-investment-btn"]');
  assert.ok(openFormButton);

  await act(async () => { openFormButton.click(); });
  const form = page.querySelector<HTMLFormElement>('form');
  assert.ok(form);

  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.match(page.textContent ?? '', /Informe o código\/ticker e o nome do ativo/);
  assert.equal(createdAsset, null, 'missing ticker and name must not create an asset');

  const tickerInput = page.querySelector<HTMLInputElement>('input[placeholder^="Ex: PETR4"]');
  const nameInput = page.querySelector<HTMLInputElement>('input[placeholder^="Ex: CSHG"]');
  assert.ok(tickerInput && nameInput);

  await act(async () => {
    setInputValue(tickerInput, '  syn11  ');
    setInputValue(nameInput, '  Fundo sintético  ');
    const textInputs = form.querySelectorAll<HTMLInputElement>('input[type="text"]');
    setInputValue(textInputs[3]!, '2,5');
    setInputValue(textInputs[4]!, '100,00');
    setInputValue(textInputs[5]!, '105,50');
    setInputValue(textInputs[6]!, '0,75');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });

  assert.deepEqual(createdAsset, {
    ticker: 'SYN11',
    name: 'Fundo sintético',
    assetClass: 'acoes_br',
    institution: 'Corretora',
    quantity: 2.5,
    averagePrice: 100,
    currentPrice: 105.5,
    indexerLabel: 'Mercado',
    liquidity: 'D+2 (Bolsa B3)',
    monthlyYieldPercent: 0.75,
    isTaxExempt: false,
    notes: undefined,
  });
  assert.equal(page.querySelector('form'), null, 'successful creation closes the form');
});

test('asset entry form labels are associated with their controls', async () => {
  const page = renderInvestmentsTab({});
  const openFormButton = page.querySelector<HTMLButtonElement>('[data-testid="open-new-investment-btn"]');
  assert.ok(openFormButton);
  await act(async () => { openFormButton.click(); });
  const form = page.querySelector('form');
  assert.ok(form);
  for (const id of ['investment-form-ticker', 'investment-form-name', 'investment-form-class', 'investment-form-institution', 'investment-form-quantity', 'investment-form-average-price', 'investment-form-current-price', 'investment-form-yield', 'investment-form-indexer', 'investment-form-liquidity']) {
    const field: HTMLElement | null = form.querySelector<HTMLElement>(`#${id}`);
    assert.ok(field, `expected field #${id}`);
    assert.ok(Array.from(form.querySelectorAll('label')).some((label) => label.control === field), `expected an associated label for #${id}`);
    field.focus();
    assert.equal(document.activeElement, field, `#${id} should be keyboard-focusable`);
  }
});

test('InvestmentsTab preserves asset identity when editing and routes deletion by id', async () => {
  const updatedAssets: InvestmentAsset[] = [];
  const deletedAssetIds: string[] = [];
  const page = renderInvestmentsTab({
    assets: [existingAsset],
    onUpdateAsset: (asset) => { updatedAssets.push(asset); },
    onDeleteAsset: (assetId) => { deletedAssetIds.push(assetId); },
  });

  const editButton = page.querySelector<HTMLButtonElement>(`[aria-label="Editar ${existingAsset.ticker}"]`);
  assert.ok(editButton);
  await act(async () => { editButton.click(); });

  const nameInput = page.querySelector<HTMLInputElement>('input[placeholder^="Ex: CSHG"]');
  const saveButton = Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
    button.textContent?.trim() === 'Salvar Ativo'
  );
  assert.ok(nameInput && saveButton);
  await act(async () => {
    setInputValue(nameInput, 'Ativo sintético atualizado');
    saveButton.click();
  });

  assert.equal(updatedAssets.length, 1);
  assert.equal(updatedAssets[0]?.id, existingAsset.id);
  assert.equal(updatedAssets[0]?.name, 'Ativo sintético atualizado');
  assert.equal(updatedAssets[0]?.ticker, existingAsset.ticker);
  assert.equal(updatedAssets[0]?.currentPrice, existingAsset.currentPrice);

  const deleteButton = page.querySelector<HTMLButtonElement>(`[aria-label="Excluir ${existingAsset.ticker}"]`);
  assert.ok(deleteButton);
  await act(async () => { deleteButton.click(); });
  assert.deepEqual(deletedAssetIds, [existingAsset.id]);
});

test('failed quote lookup with no matching quote reports an error and does not keep the stale value silently', async () => {
  const previousFetch = globalThis.fetch;
  localStorage.setItem('minhas_economias_gfinance_autosync', '0');
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({ quotes: [], sources: [] }),
  })) as unknown as typeof fetch;
  try {
    const page = renderInvestmentsTab({ assets: [{ ...existingAsset, assetClass: 'acoes_br' }] });
    const updateQuoteButton = page.querySelector<HTMLButtonElement>('[title="Clique para editar cotação manualmente"]');
    assert.ok(updateQuoteButton);
    await act(async () => { updateQuoteButton.click(); });
    const lookupButton = Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('Buscar Cotação'));
    assert.ok(lookupButton);
    await act(async () => { lookupButton.click(); });

    assert.match(page.querySelector('[data-testid="google-finance-error"]')?.textContent ?? '', /nenhuma cotação válida/i);
    assert.ok(page.querySelector('[data-testid="investment-operation-panel"]'), 'operation stays open with previous price available for manual correction');
  } finally {
    globalThis.fetch = previousFetch;
    localStorage.removeItem('minhas_economias_gfinance_autosync');
  }
});

test('zero dividend is rejected instead of being recorded as R$ 0,01', async () => {
  let recorded: { amount: number; accountId: string } | null = null;
  const page = renderInvestmentsTab({
    assets: [existingAsset],
    onRecordDividendIncome: (_asset, amount, accountId) => { recorded = { amount, accountId }; },
  });
  const dividendButton = page.querySelector<HTMLButtonElement>('[title="Lançar dividendo/provento recebido na conta corrente"]');
  assert.ok(dividendButton);
  await act(async () => { dividendButton.click(); });
  const panel = page.querySelector<HTMLFormElement>('[data-testid="investment-operation-panel"]');
  assert.ok(panel);
  const amountInput = panel.querySelector<HTMLInputElement>('input[type="text"]');
  assert.ok(amountInput);
  const confirmButton = Array.from(panel.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('Confirmar Operação'));
  assert.ok(confirmButton);

  await act(async () => {
    setInputValue(amountInput, '0');
    confirmButton.click();
  });

  assert.equal(recorded, null);
  assert.ok(page.querySelector('[role="alert"]'));
});

test('selling more units than owned is blocked without sending an operation', async () => {
  let operationCount = 0;
  const page = renderInvestmentsTab({
    assets: [{ ...existingAsset, quantity: 0.5 }],
    onOperateAsset: () => { operationCount += 1; },
  });
  const sellButton = Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === 'Resgatar');
  assert.ok(sellButton);
  await act(async () => { sellButton.click(); });
  const confirmButton = Array.from(page.querySelectorAll<HTMLButtonElement>('[data-testid="investment-operation-panel"] button')).find((button) => button.textContent?.includes('Confirmar Operação'));
  assert.ok(confirmButton);

  await act(async () => { confirmButton.click(); });

  assert.equal(operationCount, 0);
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /não pode superar o saldo/);
});

test('valid buy and sell operations route exact values through their callbacks', async () => {
  const calls: Array<[string, 'buy' | 'sell' | 'update_quote', number, number, string?]> = [];
  const page = renderInvestmentsTab({ assets: [existingAsset], onOperateAsset: (...args) => calls.push(args) });
  const buy = [...page.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === '+ Aportar');
  assert.ok(buy);
  await act(async () => { buy.click(); });
  await act(async () => { page.querySelector<HTMLFormElement>('[data-testid="investment-operation-panel"]')!.requestSubmit(); });
  assert.deepEqual(calls.pop(), [existingAsset.id, 'buy', 1, 105, undefined]);

  const sell = [...page.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === 'Resgatar');
  assert.ok(sell);
  await act(async () => { sell.click(); });
  const panel = page.querySelector<HTMLFormElement>('[data-testid="investment-operation-panel"]')!;
  const inputs = panel.querySelectorAll<HTMLInputElement>('input[type="text"]');
  await act(async () => {
    setInputValue(inputs[0]!, '0,5');
    setInputValue(inputs[1]!, '110,00');
    panel.requestSubmit();
  });
  assert.deepEqual(calls.pop(), [existingAsset.id, 'sell', 0.5, 110, undefined]);
});

test('buy operation honors the selected settlement account', async () => {
  const first: BankAccount = { id: 'first', name: 'Conta 1', institution: 'Teste', type: 'checking', initialBalance: 0, color: '#000', includeInTotal: true };
  const second: BankAccount = { ...first, id: 'second', name: 'Conta 2' };
  const calls: Array<[string, 'buy' | 'sell' | 'update_quote', number, number, string?]> = [];
  const page = renderInvestmentsTab({ assets: [existingAsset], accounts: [first, second], onOperateAsset: (...args) => calls.push(args) });
  await act(async () => { [...page.querySelectorAll('button')].find((b) => b.textContent?.trim() === '+ Aportar')!.click(); });
  const panel = page.querySelector<HTMLFormElement>('[data-testid="investment-operation-panel"]')!;
  const accountSelect = panel.querySelector<HTMLSelectElement>('select')!;
  await act(async () => {
    accountSelect.value = second.id;
    accountSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    panel.requestSubmit();
  });
  assert.deepEqual(calls, [[existingAsset.id, 'buy', 1, 105, second.id]]);
});

test('valid dividend requires an account and forwards amount and account', async () => {
  const account: BankAccount = { id: 'invest-account', name: 'Conta de investimentos', institution: 'Sintético', type: 'checking', initialBalance: 0, color: '#000', includeInTotal: true };
  let recorded: { asset: InvestmentAsset; amount: number; accountId: string } | null = null;
  const page = renderInvestmentsTab({ assets: [existingAsset], accounts: [account], onRecordDividendIncome: (asset, amount, accountId) => { recorded = { asset, amount, accountId }; } });
  await act(async () => { page.querySelector<HTMLButtonElement>('[title="Lançar dividendo/provento recebido na conta corrente"]')!.click(); });
  const panel = page.querySelector<HTMLFormElement>('[data-testid="investment-operation-panel"]')!;
  const amountInput = panel.querySelector<HTMLInputElement>('input[type="text"]')!;
  await act(async () => { setInputValue(amountInput, '42,35'); panel.requestSubmit(); });
  assert.deepEqual(recorded, { asset: existingAsset, amount: 42.35, accountId: account.id });
});

test('manual quote update submits a positive price without quantity or account', async () => {
  const calls: Array<[string, 'buy' | 'sell' | 'update_quote', number, number, string?]> = [];
  const page = renderInvestmentsTab({ assets: [existingAsset], onOperateAsset: (...args) => calls.push(args) });
  await act(async () => { page.querySelector<HTMLButtonElement>('[title="Clique para editar cotação manualmente"]')!.click(); });
  const panel = page.querySelector<HTMLFormElement>('[data-testid="investment-operation-panel"]')!;
  await act(async () => { setInputValue(panel.querySelector<HTMLInputElement>('input[type="text"]')!, '123,45'); panel.requestSubmit(); });
  assert.deepEqual(calls, [[existingAsset.id, 'update_quote', 1, 123.45, undefined]]);
});

test('targets save, contribution presets, class filter and search respond to controls', async () => {
  const saved: InvestmentTargetMap[] = [];
  const page = renderInvestmentsTab({ assets: [existingAsset, { ...existingAsset, id: 'asset-two', ticker: 'OTH2', name: 'Outro ativo', assetClass: 'fiis' }], onUpdateTargetMap: (map) => saved.push(map) });
  await act(async () => { [...page.querySelectorAll('button')].find((b) => b.textContent?.includes('Definir % Ideal'))!.click(); });
  const targetInput = page.querySelector<HTMLInputElement>('input[type="number"]');
  assert.ok(targetInput);
  await act(async () => {
    setInputValue(targetInput, '30');
    [...page.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Salvar Metas')!.click();
  });
  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.[existingAsset.assetClass], 30);

  const preset = [...page.querySelectorAll('button')].find((b) => b.textContent?.trim() === '2.5k');
  assert.ok(preset);
  await act(async () => { preset.click(); });
  assert.equal(page.querySelector<HTMLInputElement>('#smart-contribution-input')?.value, '2500,00');

  await act(async () => { [...page.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'FIIs')!.click(); });
  assert.match(page.textContent ?? '', /OTH2/);
  assert.doesNotMatch(page.textContent ?? '', /SYN1/);
  await act(async () => {
    const search = page.querySelector<HTMLInputElement>('input[placeholder^="Buscar ticker"]')!;
    setInputValue(search, 'inexistente');
  });
  assert.doesNotMatch(page.textContent ?? '', /OTH2/);
});

test('manual portfolio sync uses mocked quote response and updates matching assets', async () => {
  const previousFetch = globalThis.fetch;
  localStorage.setItem('minhas_economias_gfinance_autosync', '0');
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({ quotes: [{ ticker: 'SYN1', priceBrl: 111, name: 'Ativo sintético' }], sources: [] }) })) as unknown as typeof fetch;
  try {
    const updates: InvestmentAsset[][] = [];
    const page = renderInvestmentsTab({ assets: [{ ...existingAsset, assetClass: 'acoes_br' }], onBatchUpdateAssets: (assets) => updates.push(assets) });
    await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="sync-google-finance-btn"]')!.click(); });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(updates.length, 1);
    assert.equal(updates[0]?.[0]?.currentPrice, 111);
    assert.match(page.querySelector('[data-testid="google-finance-sync-banner"]')?.textContent ?? '', /1 ativo\(s\) com cotação atualizada/);
  } finally {
    globalThis.fetch = previousFetch;
    localStorage.removeItem('minhas_economias_gfinance_autosync');
  }
});
