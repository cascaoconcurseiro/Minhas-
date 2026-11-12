import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { Transaction } from '../types/finance';
import { CardCommitmentSection } from './CardCommitmentSection';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

let seq = 0;
const tx = (over: Partial<Transaction>): Transaction =>
  ({ id: `t${++seq}`, description: 'x', amount: 100, date: '2026-12-02', competenceMonth: '2026-12', type: 'expense',
    status: 'pending', categoryId: 'c', paymentMethod: 'credit_card', recurrence: 'single', ...over }) as Transaction;

function render(props: Partial<React.ComponentProps<typeof CardCommitmentSection>> = {}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const data = [
    tx({ type: 'income', amount: 5000, competenceMonth: '2026-12', paymentMethod: 'pix' }),
    tx({ creditCardId: 'c1', amount: 1000, description: 'Mercado' }),
    tx({ creditCardId: 'c1', amount: 700, description: 'Notebook', recurrence: 'installment', installmentNumber: 2, installmentTotal: 10 }),
    tx({ creditCardId: 'c1', amount: 300, competenceMonth: '2027-01', date: '2027-01-02', description: 'Janeiro sem renda' }),
  ];
  act(() => root?.render(React.createElement(CardCommitmentSection, { transactions: data, referenceMonth: '2026-11', ...props })));
  return container;
}

test('mostra 6 meses do mês atual para frente, sem meses passados, e expande os demais', () => {
  const el = render({ limitPercent: 30 });
  const ids = () => [...el.querySelectorAll('[data-testid^="card-commitment-20"]')].map((node) => node.getAttribute('data-testid'));
  assert.equal(ids().length, 6);
  assert.equal(ids()[0], 'card-commitment-2026-11');
  assert.equal(ids()[5], 'card-commitment-2027-04');
  assert.equal(el.querySelector('[data-testid="card-commitment-2026-10"]'), null, 'mês passado não aparece');
  const toggle = el.querySelector('[data-testid="card-commitment-toggle"]') as HTMLButtonElement;
  assert.match(toggle.textContent ?? '', /Ver os outros 6 meses/);
  act(() => toggle.click());
  assert.equal(ids().length, 12);
  assert.equal(ids()[11], 'card-commitment-2027-10');
  assert.match(toggle.textContent ?? '', /Mostrar só os próximos 6 meses/);
  act(() => toggle.click());
  assert.equal(ids().length, 6);
});

test('porcentagem e valor por mês; sem renda lançada mostra só o valor', () => {
  const el = render({ limitPercent: 30 });
  act(() => (el.querySelector('[data-testid="card-commitment-toggle"]') as HTMLButtonElement).click());
  const dec = el.querySelector('[data-testid="card-commitment-2026-12"]')!.textContent ?? '';
  assert.match(dec, /34%/); // 1.700 de 5.000
  assert.match(dec, /R\$\s?1\.700,00/);
  assert.match(dec, /Parcelas R\$\s?700,00 \(14%\)/);
  assert.match(dec, /acima do limite de 30%/);
  const jan = el.querySelector('[data-testid="card-commitment-2027-01"]')!.textContent ?? '';
  assert.match(jan, /sem renda lançada/);
  assert.doesNotMatch(jan, /%\s*$/);
});

test('tocar num mês mostra as compras e as parcelas que formam o total', () => {
  const el = render({ limitPercent: 30 });
  const button = el.querySelector('[data-testid="card-commitment-2026-12"] button') as HTMLButtonElement;
  act(() => button.click());
  const detail = el.querySelector('[data-testid="card-commitment-detail"]')!.textContent ?? '';
  assert.match(detail, /Mercado/);
  assert.match(detail, /Notebook/);
  assert.match(detail, /2\/10/);
});

test('sem limite definido pede para definir e não marca como acima do limite', () => {
  const el = render({ onOpenSettings: () => {} });
  assert.match(el.querySelector('[data-testid="card-commitment-settings-btn"]')!.textContent ?? '', /Definir limite/);
  assert.doesNotMatch(el.textContent ?? '', /acima do limite/);
});

test('o botão do limite abre as configurações', () => {
  let opened = 0;
  const el = render({ limitPercent: 30, onOpenSettings: () => { opened += 1; } });
  const btn = el.querySelector('[data-testid="card-commitment-settings-btn"]') as HTMLButtonElement;
  assert.match(btn.textContent ?? '', /Limite: 30% da renda/);
  act(() => btn.click());
  assert.equal(opened, 1);
});
