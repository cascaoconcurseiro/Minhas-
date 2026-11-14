import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act, useState } from 'react';
import type { Root } from 'react-dom/client';
import { CurrencyInput } from './CurrencyInput';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;
let latestValue = '';

function renderInput(initial = '', showCurrencySymbol = false): HTMLInputElement {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  function Harness() {
    const [value, setValue] = useState(initial);
    latestValue = value;
    return <CurrencyInput aria-label="Valor" className="money-field" value={value} currency="BRL" showCurrencySymbol={showCurrencySymbol} onValueChange={setValue} />;
  }
  act(() => root?.render(<Harness />));
  return container.querySelector('input')!;
}

function changeValue(input: HTMLInputElement, value: string, start: number, end = start) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.setSelectionRange(start, end);
    input.dispatchEvent(new window.InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: value }));
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
}

function typeDigits(input: HTMLInputElement, digits: string) {
  for (const digit of digits) {
    act(() => {
      const value = `${input.value}${digit}`;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, value);
      input.setSelectionRange(value.length, value.length);
      input.dispatchEvent(new window.InputEvent('input', { bubbles: true, inputType: 'insertText', data: digit }));
    });
  }
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  latestValue = '';
});

test('shows the symbol outside the input and digits are typed as written (not as cents)', () => {
  const input = renderInput('', true);
  assert.equal(input.getAttribute('aria-label'), 'Valor');
  assert.equal(input.className, 'money-field');
  assert.equal(input.previousElementSibling?.textContent, 'R$');
  act(() => input.focus());
  typeDigits(input, '1255');
  assert.equal(input.value, '1.255');
  assert.equal(latestValue, '1.255');
});

test('accepts pasted explicit currency formats and preserves the caret mapping', () => {
  const input = renderInput('');
  act(() => input.focus());
  changeValue(input, '1.234,56', 8);
  assert.equal(input.value, '1.234,56');
  assert.equal(latestValue, '1.234,56');
});

test('keeps a selected range when replacing text and accepts pasted formatted values', () => {
  const input = renderInput('1.234,00');
  act(() => input.focus());
  changeValue(input, '1.987,00', 8);
  assert.equal(input.value, '1.987,00');
  assert.equal(latestValue, '1.987,00');
});

test('pads decimals on blur after digit entry', () => {
  const input = renderInput('');
  act(() => input.focus());
  changeValue(input, '1255', 4);
  assert.equal(input.value, '1.255');
  act(() => input.blur());
  assert.equal(input.value, '1.255,00');
  assert.equal(latestValue, '1.255,00');
});
