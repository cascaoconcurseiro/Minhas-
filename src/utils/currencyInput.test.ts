import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrencyInput, isCurrencyInputValid, isExchangeRateInputValid, mapCurrencyInputCaret, parseCurrencyInput, parseExchangeRateInput } from './currencyInput';

test('groups while editing and completes configured decimals on blur', () => {
  assert.equal(formatCurrencyInput('1000', 'BRL', { focused: true }), '1.000');
  assert.equal(formatCurrencyInput('1000', 'BRL', { focused: false }), '1.000,00');
  assert.equal(formatCurrencyInput('1,5', 'BRL', { focused: false }), '1,50');
  assert.equal(formatCurrencyInput('1,', 'BRL', { focused: true }), '1,');
});

test('interprets unseparated digit entry as cents for currencies with minor units', () => {
  assert.equal(formatCurrencyInput('1255', 'BRL', { focused: true, digitEntryAsMinorUnits: true }), '12,55');
  assert.equal(formatCurrencyInput('1000', 'BRL', { focused: false, digitEntryAsMinorUnits: true }), '10,00');
  assert.equal(formatCurrencyInput('1255', 'USD', { focused: false, digitEntryAsMinorUnits: true }), '12,55');
  assert.equal(formatCurrencyInput('1255', 'JPY', { focused: false, digitEntryAsMinorUnits: true }), '1.255');
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

test('preserves negative amounts and keeps excess precision visible for form validation', () => {
  assert.equal(formatCurrencyInput('-1234,5', 'BRL', { focused: true }), '-1.234,5');
  assert.equal(formatCurrencyInput('-1234,5', 'BRL', { focused: false }), '-1.234,50');
  assert.equal(formatCurrencyInput('1,239', 'BRL', { focused: false }), '1,239');
  assert.equal(formatCurrencyInput('1,999', 'BRL', { focused: false }), '1,999');
});

test('rejects fractional amounts beyond the selected currency precision instead of rounding or dropping them', () => {
  assert.equal(formatCurrencyInput('1,5', 'JPY', { focused: false }), '1,5');
  assert.equal(formatCurrencyInput('1,5', 'CLP', { focused: false }), '1,5');
  assert.equal(parseCurrencyInput('1,5', 'JPY'), 0);
  assert.equal(parseCurrencyInput('1,5', 'CLP'), 0);
  assert.equal(parseCurrencyInput('1,239', 'BRL'), 0);
  assert.equal(isCurrencyInputValid('1,5', 'JPY'), false);
  assert.equal(isCurrencyInputValid('1,5', 'CLP'), false);
  assert.equal(isCurrencyInputValid('1,239', 'BRL'), false);
  assert.equal(isCurrencyInputValid('1.234', 'JPY'), true);
  assert.equal(parseCurrencyInput('1.234', 'JPY'), 1234);
  assert.equal(parseCurrencyInput(null as unknown as string, 'JPY'), 0);
  assert.equal(isCurrencyInputValid(null as unknown as string, 'JPY'), false);
  assert.equal(parseCurrencyInput('9007199254740992', 'JPY'), 0);
  assert.equal(isCurrencyInputValid('9007199254740992', 'JPY'), false);
  assert.equal(parseCurrencyInput('0,29', 'BRL'), 0.29);
  assert.equal(isCurrencyInputValid('0,29', 'BRL'), true);
});

test('parses exchange rates with four or more decimals without using money precision', () => {
  assert.equal(parseExchangeRateInput('0,0052'), 0.0052);
  assert.equal(parseExchangeRateInput('6,1845'), 6.1845);
  assert.equal(parseExchangeRateInput('1.234,5678'), 1234.5678);
  assert.equal(parseExchangeRateInput('1,234.5678'), 1234.5678);
  assert.equal(isExchangeRateInputValid('0,0052'), true);
  assert.equal(isExchangeRateInputValid('0'), false);
  assert.equal(isExchangeRateInputValid('taxa inválida'), false);
  assert.equal(parseExchangeRateInput('6,123456789'), 0);
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
