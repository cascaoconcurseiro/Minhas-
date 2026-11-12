import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { InstantTooltip, computeTooltipPosition } from './InstantTooltip';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

function mount() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(
    React.createElement(React.Fragment, null,
      React.createElement('button', { id: 'alvo', title: 'Fatura de Dezembro em atraso' }, 'R$ 599,59'),
      React.createElement('button', { id: 'outro' }, 'sem dica'),
      React.createElement(InstantTooltip)
    )
  ));
  return container;
}

const tipEl = () => document.querySelector<HTMLElement>('[data-testid="instant-tooltip"]');
const fire = (el: Element, type: string, init: Record<string, unknown> = {}) =>
  act(() => { el.dispatchEvent(new window.MouseEvent(type, { bubbles: true, ...init })); });
const mouseOver = (el: Element) => {
  const event = new window.Event('pointerover', { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  act(() => { el.dispatchEvent(event); });
};

test('balão aparece na hora ao passar o mouse e devolve o title ao sair', () => {
  const page = mount();
  const alvo = page.querySelector<HTMLElement>('#alvo')!;
  assert.ok(tipEl()?.classList.contains('hidden'));
  mouseOver(alvo);
  assert.equal(tipEl()?.classList.contains('hidden'), false);
  assert.equal(tipEl()?.textContent, 'Fatura de Dezembro em atraso');
  assert.equal(alvo.hasAttribute('title'), false, 'title nativo some enquanto o balão está aberto');
  fire(alvo, 'pointerout');
  assert.ok(tipEl()?.classList.contains('hidden'));
  assert.equal(alvo.getAttribute('title'), 'Fatura de Dezembro em atraso', 'title volta ao sair');
});

test('elemento sem title não abre balão e clicar fecha', () => {
  const page = mount();
  mouseOver(page.querySelector('#outro')!);
  assert.ok(tipEl()?.classList.contains('hidden'));
  const alvo = page.querySelector<HTMLElement>('#alvo')!;
  mouseOver(alvo);
  fire(alvo, 'pointerdown');
  assert.ok(tipEl()?.classList.contains('hidden'));
  assert.ok(alvo.getAttribute('title'));
});

test('foco do teclado também mostra o balão', () => {
  const page = mount();
  const alvo = page.querySelector<HTMLElement>('#alvo')!;
  act(() => { alvo.focus(); });
  assert.equal(tipEl()?.classList.contains('hidden'), false);
});

test('posição: acima e centralizado, vira para baixo no topo e respeita as bordas', () => {
  const vp = { width: 1000, height: 800 };
  const tip = { width: 200, height: 40 };
  assert.deepEqual(computeTooltipPosition({ left: 400, top: 300, width: 100, height: 20 }, tip, vp), { left: 350, top: 252 });
  assert.equal(computeTooltipPosition({ left: 400, top: 10, width: 100, height: 20 }, tip, vp).top, 38, 'sem espaço em cima: vai para baixo');
  assert.equal(computeTooltipPosition({ left: 0, top: 300, width: 20, height: 20 }, tip, vp).left, 8, 'não sai pela esquerda');
  assert.equal(computeTooltipPosition({ left: 990, top: 300, width: 10, height: 20 }, tip, vp).left, 792, 'não sai pela direita');
});
