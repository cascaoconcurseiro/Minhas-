import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { ErrorBoundary } from './ErrorBoundary';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); container?.remove(); root = null; container = null; });

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error('falha de teste');
  return React.createElement('p', null, 'tela ok');
}

test('uma tela que quebra mostra aviso com saída e volta ao trocar de tela', () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(React.createElement(ErrorBoundary, { scope: 'tela', resetKey: 'a', children: React.createElement(Bomb, { explode: true }) })));
    assert.match(container.textContent ?? '', /Não foi possível abrir esta tela/);
    assert.match(container.textContent ?? '', /Seus dados estão seguros/);
    act(() => root?.render(React.createElement(ErrorBoundary, { scope: 'tela', resetKey: 'b', children: React.createElement(Bomb, { explode: false }) })));
    assert.match(container.textContent ?? '', /tela ok/);
  } finally {
    console.error = originalError;
  }
});

test('janela que quebra some e avisa o app para fechá-la', () => {
  const originalError = console.error;
  console.error = () => {};
  let notified = 0;
  try {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(React.createElement(ErrorBoundary, { scope: 'janela', onError: () => { notified += 1; }, children: React.createElement(Bomb, { explode: true }) })));
    assert.equal(container.textContent, '');
    assert.equal(notified, 1);
  } finally {
    console.error = originalError;
  }
});
