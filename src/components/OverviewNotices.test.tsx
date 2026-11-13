import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { CardCommitmentMonth } from '../utils/cardCommitment';
import type { CashForecast } from '../utils/cashForecast';
import type { DataHealthIssue } from '../utils/dataHealth';
import { OverviewNotices, buildOverviewNotices } from './OverviewNotices';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const forecast = (negative: boolean): CashForecast => ({
  points: [{ date: '2026-12-05', balance: -649.59, delta: -649.59 }], startBalance: 0, endBalance: -649.59,
  lowPoint: { date: '2026-12-05', balance: -649.59 },
  firstNegative: negative ? { date: '2026-12-05', balance: -649.59 } : null, horizonDays: 45,
});
const health: DataHealthIssue[] = [
  { id: 'account_without_balance', severity: 'info', title: 'Contas sem saldo e sem movimento', detail: 'Conta corrente: informe o saldo inicial.', count: 1 },
  { id: 'uncategorized', severity: 'warn', title: 'Lançamentos sem categoria', detail: '2 lançamentos estão sem categoria válida.', count: 2 },
];
const commitment = (month: string, status: 'warning' | 'over'): CardCommitmentMonth => ({
  month, income: 5000, cardTotal: 2000, installmentTotal: 800, otherTotal: 1200, cardPercent: 40, installmentPercent: 16, status,
});

test('sem nada a avisar não mostra nada', () => {
  assert.deepEqual(buildOverviewNotices({ forecast: forecast(false), dataHealthIssues: [], commitmentAlerts: [] }), []);
});

test('junta previsão, cartão e dados para revisar numa lista só, do mais grave para o menos grave', () => {
  const notices = buildOverviewNotices({
    forecast: forecast(true), dataHealthIssues: health,
    commitmentAlerts: [commitment('2026-12', 'over'), commitment('2027-01', 'warning')], commitmentLimitPercent: 30,
  });
  assert.deepEqual(notices.map((n) => n.id), [
    'forecast-negative', 'commitment-2026-12', 'commitment-2027-01', 'health-uncategorized', 'health-account_without_balance',
  ]);
  assert.deepEqual(notices.map((n) => n.tone), ['danger', 'danger', 'warn', 'warn', 'info']);
  assert.match(notices[0].title, /negativo em 05\/12/);
  assert.match(notices[1].title, /Cartão em 40% da renda em dezembro de 2026/i);
  assert.match(notices[1].detail ?? '', /acima do seu limite de 30%/);
  assert.match(notices[2].detail ?? '', /perto do seu limite de 30%/);
});

function render(props: React.ComponentProps<typeof OverviewNotices>) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(OverviewNotices, props)));
  return container;
}

test('mostra 3 avisos e expande os demais; o botão leva ao cartão', () => {
  let opened = 0;
  const notices = buildOverviewNotices({
    forecast: forecast(true), dataHealthIssues: health,
    commitmentAlerts: [commitment('2026-12', 'over')], commitmentLimitPercent: 30,
  });
  const el = render({ notices, onOpenCommitment: () => { opened += 1; } });
  const rows = () => el.querySelectorAll('[data-testid^="overview-notice-"]').length;
  assert.equal(rows(), 3);
  assert.match(el.querySelector('[data-testid="overview-notices"]')?.textContent ?? '', /Avisos\s*4/);
  const toggle = el.querySelector('[data-testid="overview-notices-toggle"]') as HTMLButtonElement;
  assert.match(toggle.textContent ?? '', /Ver todos os 4 avisos/);
  act(() => toggle.click());
  assert.equal(rows(), 4);
  const btn = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Ver mês a mês') as HTMLButtonElement;
  act(() => btn.click());
  assert.equal(opened, 1);
});

test('é um bloco só e compacto, sem cartões coloridos soltos', () => {
  const el = render({ notices: buildOverviewNotices({ dataHealthIssues: health }) });
  assert.equal(el.querySelectorAll('section').length, 1);
  assert.ok(el.querySelector('[data-testid="overview-notices"]'));
});
