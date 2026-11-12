import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { DataHealthCard } from './DataHealthCard';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function render(props: React.ComponentProps<typeof DataHealthCard>) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(DataHealthCard, props)));
  return container;
}

test('não aparece quando está tudo certo', () => {
  assert.equal(render({ issues: [] }).textContent, '');
});

test('lista cada problema com título e explicação', () => {
  const el = render({
    issues: [
      { id: 'uncategorized', severity: 'warn', title: 'Lançamentos sem categoria', detail: '2 lançamentos estão sem categoria válida.', count: 2 },
      { id: 'card_without_limit', severity: 'info', title: 'Cartão sem limite informado', detail: 'Visa: sem o limite…', count: 1 },
    ],
  });
  assert.match(el.querySelector('[data-testid="data-health-uncategorized"]')?.textContent ?? '', /Lançamentos sem categoria/);
  assert.ok(el.querySelector('[data-testid="data-health-card_without_limit"]'));
});
