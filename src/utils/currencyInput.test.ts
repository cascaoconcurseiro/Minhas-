import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrencyInput, mapCurrencyInputCaret, parseCurrencyInput } from './currencyInput';

test('groups while editing and completes configured decimals on blur', () => {
  assert.equal(formatCurrencyInput('1000', 'BRL', { focused: true }), '1.000');
  assert.equal(formatCurrencyInput('1000', 'BRL', { focused: false }), '1.000,00');
  assert.equal(formatCurrencyInput('1,5', 'BRL', { focused: false }), '1,50');
  assert.equal(formatCurrencyInput('1,', 'BRL', { focused: true }), '1,');
});

test('normalizes pasted Brazilian and international currency formats without symbols', () => {
  assert.equal(formatCurrencyInput('R$ 1.234,56', 'BRL', { focused: true }), '1.234,56');
  assert.equal(formatCurrencyInput('€ 1.234,56', 'EUR', { focused: true }), '1.234,56');
  assert.equal(formatCurrencyInput('US$ 1,234.56', 'USD', { focused: true }), '1.234,56');
  assert.equal(formatCurrencyInput('USD 1,234.56', 'USD', { focused: false }), '1.234,56');
});

test('uses each selected currency precision, including zero-decimal JPY and CLP', () => {
  assert.equal(formatCurrencyInput('¥ 1,234', 'JPY', { focused: true }), '1.234');
  assert.equal(formatCurrencyInput('¥ 1,234', 'JPY', { focused: false }), '1.234');
  assert.equal(formatCurrencyInput('CLP$ 1234', 'CLP', { focused: false }), '1.234');
  assert.equal(formatCurrencyInput('1,5', 'EUR', { focused: false }), '1,50');
  assert.equal(formatCurrencyInput('1.5', 'USD', { focused: false }), '1,50');
});

test('roundtrips finalized amounts using the selected currency precision', () => {
  const brl = formatCurrencyInput('1234,56', 'BRL', { focused: false });
  const usd = formatCurrencyInput('US$ 1,234.56', 'USD', { focused: false });
  const eur = formatCurrencyInput('€ 1.234,56', 'EUR', { focused: false });
  const jpy = formatCurrencyInput('¥ 1,234', 'JPY', { focused: false });
  const clp = formatCurrencyInput('CLP$ 1234', 'CLP', { focused: false });

  assert.equal(parseCurrencyInput(brl, 'BRL'), 1234.56);
  assert.equal(parseCurrencyInput(usd, 'USD'), 1234.56);
  assert.equal(parseCurrencyInput(eur, 'EUR'), 1234.56);
  assert.equal(parseCurrencyInput(jpy, 'JPY'), 1234);
  assert.equal(parseCurrencyInput(clp, 'CLP'), 1234);
});

test('preserves negative amounts and rounds excess precision when finalizing', () => {
  assert.equal(formatCurrencyInput('-1234,5', 'BRL', { focused: true }), '-1.234,5');
  assert.equal(formatCurrencyInput('-1234,5', 'BRL', { focused: false }), '-1.234,50');
  assert.equal(formatCurrencyInput('1,239', 'BRL', { focused: false }), '1,24');
  assert.equal(formatCurrencyInput('1,999', 'BRL', { focused: false }), '2,00');
});

test('maps caret by digit count when grouping punctuation changes', () => {
  assert.equal(mapCurrencyInputCaret('1000', '1.000', 3), 4);
  assert.equal(mapCurrencyInputCaret('1234', '1.234', 2), 3);
  assert.equal(mapCurrencyInputCaret('1.234', '123', 5), 3);
});

test('keeps the caret stable when backspace changes a grouped integer', () => {
  const before = '1.234';
  const rawAfterBackspace = '1.23';
  const after = formatCurrencyInput(rawAfterBackspace, 'BRL', {
    focused: true,
    previousValue: before,
  });
  assert.equal(after, '123');
  assert.equal(mapCurrencyInputCaret(before, after, before.length), after.length);
});
