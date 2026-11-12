import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { MonthlyInsight } from '../utils/monthlyNarrative';
import { MonthlyInsightsCard } from './MonthlyInsightsCard';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(insights: MonthlyInsight[]) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(MonthlyInsightsCard, { insights, monthLabel: 'outubro' })));
  return container;
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('shows nothing without insights', () => {
  assert.equal(render([]).querySelector('[data-testid="monthly-insights"]'), null);
});

test('lists every sentence under the month title', () => {
  const page = render([
    { id: 'spending', tone: 'warn', text: 'Você gastou R$ 1.900,00 em outubro, 73% a mais que em setembro.' },
    { id: 'balance', tone: 'good', text: 'Sobrou R$ 3.100,00 em outubro.' },
  ]);
  assert.match(page.textContent ?? '', /Resumo de outubro/);
  assert.equal(page.querySelectorAll('li').length, 2);
  assert.match(page.textContent ?? '', /73% a mais que em setembro/);
  assert.match(page.textContent ?? '', /Sobrou R\$ 3\.100,00/);
});
