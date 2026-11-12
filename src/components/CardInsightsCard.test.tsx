import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { CardInsight } from '../utils/cardIntelligence';
import { CardInsightsCard } from './CardInsightsCard';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;

const insight: CardInsight = {
  cardId: 'c1', cardName: 'Nubank', bestPurchaseDay: 21, daysToPayIfBoughtToday: 16,
  dueDateIfBoughtToday: '2026-11-28', openInvoiceMonth: '2026-11', openInvoiceTotal: 500,
  projectedInvoiceTotal: 2000, historyMonths: 3, availableLimit: 4500, limit: 5000,
};

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function render(props: React.ComponentProps<typeof CardInsightsCard>) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(CardInsightsCard, props)));
  return container;
}

test('não mostra nada sem cartões', () => {
  assert.equal(render({ insights: [], recommendation: null }).textContent, '');
});

test('mostra fatura, projeção e melhor dia de compra', () => {
  const text = render({ insights: [insight], recommendation: null }).textContent ?? '';
  assert.match(text, /Nubank/);
  assert.match(text, /vencimento em 28\/11/);
  assert.match(text, /deve fechar perto de/);
  assert.match(text, /Melhor dia de compra: dia 21/);
});

test('mostra a recomendação de cartão quando existe', () => {
  const el = render({
    insights: [insight],
    recommendation: { cardId: 'c1', cardName: 'Nubank', daysToPay: 16, dueDate: '2026-11-28', availableLimit: 4500 },
  });
  assert.match(el.querySelector('[data-testid="card-recommendation"]')?.textContent ?? '', /use o Nubank.*28\/11 \(16 dias\)/);
});
