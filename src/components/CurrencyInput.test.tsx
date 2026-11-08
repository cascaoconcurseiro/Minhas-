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
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  latestValue = '';
});

test('shows the symbol outside the input and groups while typing', () => {
  const input = renderInput('', true);
  assert.equal(input.getAttribute('aria-label'), 'Valor');
  assert.equal(input.className, 'money-field');
  assert.equal(input.previousElementSibling?.textContent, 'R$');
  act(() => input.focus());
  changeValue(input, '1234', 4);
  assert.equal(input.value, '1.234');
  assert.equal(latestValue, '1.234');
});

test('preserves caret position after inserting a digit before grouped thousands', () => {
  const input = renderInput('1234');
  act(() => input.focus());
  assert.equal(input.value, '1.234');
  changeValue(input, '12.934', 3);
  assert.equal(input.value, '12.934');
  assert.equal(input.selectionStart, 2);
});

test('keeps a selected range when replacing text and accepts pasted formatted values', () => {
  const input = renderInput('1234');
  act(() => input.focus());
  changeValue(input, '1.234', 1, 4);
  changeValue(input, '1.987', 5);
  assert.equal(input.value, '1.987');
  assert.equal(latestValue, '1.987');
});

test('handles backspace beside a grouping separator and pads decimals on blur', () => {
  const input = renderInput('1234');
  act(() => input.focus());
  changeValue(input, '123', 2);
  assert.equal(input.value, '123');
  assert.equal(input.selectionStart, 2);
  act(() => input.blur());
  assert.equal(input.value, '123,00');
  assert.equal(latestValue, '123,00');
});
