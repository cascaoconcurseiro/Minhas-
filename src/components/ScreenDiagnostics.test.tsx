import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { ScreenDiagnostics } from './ScreenDiagnostics';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

test('mostra as medidas da tela do aparelho', () => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(ScreenDiagnostics)));
  const text = container.textContent ?? '';
  assert.match(text, /Medidas da tela/);
  assert.match(text, /Como está aberto/);
  assert.match(text, /Tela do aparelho/);
  assert.match(text, /Tela menos área do app/);
});
