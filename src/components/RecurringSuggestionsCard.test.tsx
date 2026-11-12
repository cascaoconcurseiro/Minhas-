import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { Category } from '../types/finance';
import type { RecurringCandidate } from '../utils/recurrenceDetection';
import { RecurringSuggestionsCard } from './RecurringSuggestionsCard';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;

const categories: Category[] = [
  { id: 'cat-assinaturas', name: 'Assinaturas e Streaming', type: 'expense', bucket: 'lifestyle', monthlyBudget: 0, color: '#6366f1', icon: 'tv' },
];
const candidate = (over: Partial<RecurringCandidate> = {}): RecurringCandidate => ({
  key: 'netflix', description: 'Netflix', categoryId: 'cat-assinaturas', paymentMethod: 'credit_card', creditCardId: 'card-1',
  lastAmount: 55.9, typicalAmount: 55.9, amountPattern: 'stable', dayOfMonth: 10, monthsInARow: 4, lastDate: '2026-10-10',
  nextExpectedDate: '2026-12-10', missingThisMonth: false, confidence: 0.9, transactionIds: ['a', 'b', 'c'], ...over,
});

function render(suggestions: RecurringCandidate[], onSchedule = (_: RecurringCandidate) => {}, onDismiss = (_: RecurringCandidate) => {}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(RecurringSuggestionsCard, { suggestions, categories, onSchedule, onDismiss })));
  return container;
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('shows nothing when there is no recurring expense to suggest', () => {
  const page = render([]);
  assert.equal(page.querySelector('[data-testid="recurring-suggestions"]'), null);
});

test('shows the subscription with its usual day, category and the next date', () => {
  const page = render([candidate()]);
  const text = page.textContent ?? '';
  assert.match(text, /Netflix/);
  assert.match(text, /55,90/);
  assert.match(text, /dia 10/);
  assert.match(text, /4 meses seguidos/);
  assert.match(text, /Assinaturas e Streaming/);
  assert.match(text, /a partir de 10\/12/);
});

test('warns about a price increase and about a missing charge this month', () => {
  const page = render([candidate({ priceChange: { from: 44.9, to: 55.9, percent: 24.5 }, missingThisMonth: true })]);
  assert.match(page.textContent ?? '', /Aumentou 24,5%/);
  assert.match(page.textContent ?? '', /Ainda não apareceu neste mês/);
});

test('schedule and dismiss route the chosen suggestion', async () => {
  const scheduled: string[] = [];
  const dismissed: string[] = [];
  const page = render([candidate(), candidate({ key: 'spotify', description: 'Spotify' })], (c) => scheduled.push(c.key), (c) => dismissed.push(c.key));
  const buttons = Array.from(page.querySelectorAll('button'));
  await act(async () => { buttons.find((b) => b.textContent?.includes('Prever próximos meses'))?.click(); });
  await act(async () => { page.querySelector<HTMLButtonElement>('[aria-label="Ignorar Spotify"]')?.click(); });
  assert.deepEqual(scheduled, ['netflix']);
  assert.deepEqual(dismissed, ['spotify']);
});

test('limits how many suggestions are shown at once', () => {
  const many = ['a', 'b', 'c', 'd', 'e'].map((key) => candidate({ key, description: `Item ${key}` }));
  const page = render(many);
  assert.equal(page.querySelectorAll('li').length, 3);
  assert.match(page.textContent ?? '', /\+2 outros/);
});
