import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { CashForecast } from '../utils/cashForecast';
import { CashForecastCard } from './CashForecastCard';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;

const forecast = (over: Partial<CashForecast> = {}): CashForecast => ({
  points: [
    { date: '2026-11-13', balance: 3800, delta: -200 },
    { date: '2026-11-14', balance: 2600, delta: -1200 },
    { date: '2026-11-15', balance: 5600, delta: 3000 },
  ],
  startBalance: 4000, endBalance: 5600, lowPoint: { date: '2026-11-14', balance: 2600 },
  firstNegative: null, horizonDays: 45, ...over,
});

function render(value: CashForecast | null) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(CashForecastCard, { forecast: value })));
  return container;
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('shows nothing without a forecast (no account included in the total)', () => {
  assert.equal(render(null).querySelector('[data-testid="cash-forecast"]'), null);
});

test('shows today, the lowest point and the end balance, without a warning when it stays positive', () => {
  const page = render(forecast());
  const text = page.textContent ?? '';
  assert.match(text, /próximos 45 dias/);
  assert.match(text, /4\.000,00/);
  assert.match(text, /Mais baixo \(14\/11\)/);
  assert.match(text, /2\.600,00/);
  assert.match(text, /Em 15\/11/);
  assert.equal(page.querySelector('[data-testid="cash-forecast-warning"]'), null);
  assert.ok(page.querySelector('svg polyline'));
});

test('warns with the day and the amount when the balance turns negative', () => {
  const page = render(forecast({ firstNegative: { date: '2026-12-05', balance: -500 }, lowPoint: { date: '2026-12-05', balance: -500 } }));
  const warning = page.querySelector('[data-testid="cash-forecast-warning"]');
  assert.match(warning?.textContent ?? '', /fica negativo em 05\/12/);
  assert.match(warning?.textContent ?? '', /500,00/);
});
