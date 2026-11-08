import type { CurrencyCode } from '../types/finance';
import { CURRENCY_CATALOG } from './travelRules';

export interface CurrencyInputOptions {
  /** Keep incomplete decimal text (for example `1,`) while the input is focused. */
  focused: boolean;
  /** Previous displayed value, used to disambiguate a grouping dot during edits. */
  previousValue?: string;
}

interface ParsedCurrencyText {
  negative: boolean;
  integer: string;
  fraction: string;
  decimalWasTrailing: boolean;
  incompleteSign: boolean;
}

const GROUPING_PATTERN = /^\d{1,3}(?:[.,]\d{3})+$/;
const CURRENCY_PREFIX_PATTERN = /^(?:R\s*\$|US\s*\$|C\s*\$|ARS\s*\$|CLP\s*\$|USD|EUR|GBP|JPY|CAD|CHF|BRL)\s*/i;
const CURRENCY_SUFFIX_PATTERN = /\s*(?:USD|EUR|GBP|JPY|CAD|CHF|BRL)\s*$/i;

function stripCurrencyAffixes(raw: string): string {
  return raw
    .trim()
    .replace(/^\(\s*(.*)\s*\)$/, '-$1')
    .replace(CURRENCY_PREFIX_PATTERN, '')
    .replace(CURRENCY_SUFFIX_PATTERN, '')
    .replace(/\p{Sc}/gu, '')
    .replace(/[\s\u00a0\u202f]/g, '');
}

function hasGroupingDot(previousValue?: string): boolean {
  if (!previousValue) return false;
  const previous = stripCurrencyAffixes(previousValue).replace(/^[+-]/, '');
  if (!previous.includes('.')) return false;

  const commaIndex = previous.lastIndexOf(',');
  const dotIndex = previous.lastIndexOf('.');
  if (commaIndex > dotIndex) {
    const integerPart = previous.slice(0, commaIndex);
    return integerPart.includes('.') && GROUPING_PATTERN.test(integerPart);
  }

  return GROUPING_PATTERN.test(previous);
}

function normalizeNumberText(raw: string, decimals: number, previousValue?: string): ParsedCurrencyText | null {
  let cleaned = stripCurrencyAffixes(raw);
  const signMatch = cleaned.match(/^([+-])/);
  const negative = signMatch?.[1] === '-';
  cleaned = cleaned.replace(/^[+-]/, '');

  if (!cleaned) {
    if (negative && raw.trim() === '-') {
      return { negative: true, integer: '0', fraction: '', decimalWasTrailing: false, incompleteSign: true };
    }
    return null;
  }
  if (!/^[\d.,]*$/.test(cleaned)) return null;
  if (!/\d/.test(cleaned)) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const hasComma = lastComma >= 0;
  const hasDot = lastDot >= 0;
  let decimalSeparator: ',' | '.' | null = null;

  if (hasComma && hasDot) {
    decimalSeparator = lastComma > lastDot ? ',' : '.';
  } else if (hasComma) {
    const commas = cleaned.match(/,/g)?.length ?? 0;
    const zeroDecimalGrouping = decimals === 0 && GROUPING_PATTERN.test(cleaned);
    decimalSeparator = (commas > 1 && GROUPING_PATTERN.test(cleaned)) || zeroDecimalGrouping ? null : ',';
  } else if (hasDot) {
    const dots = cleaned.match(/\./g)?.length ?? 0;
    const previousDotWasGrouping = hasGroupingDot(previousValue);
    if (GROUPING_PATTERN.test(cleaned) || (previousDotWasGrouping && dots === 1)) {
      decimalSeparator = null;
    } else {
      decimalSeparator = '.';
    }
  }

  let integerPart = cleaned;
  let fractionPart = '';
  let decimalWasTrailing = false;
  if (decimalSeparator) {
    const decimalIndex = cleaned.lastIndexOf(decimalSeparator);
    integerPart = cleaned.slice(0, decimalIndex);
    fractionPart = cleaned.slice(decimalIndex + 1);
    decimalWasTrailing = fractionPart.length === 0;
    const groupingSeparator = decimalSeparator === ',' ? '.' : ',';
    if (integerPart.includes(groupingSeparator)) {
      if (!GROUPING_PATTERN.test(integerPart)) return null;
      integerPart = integerPart.replaceAll(groupingSeparator, '');
    }
    // Repeated occurrences of the decimal character are valid only as groups
    // of thousands, such as `1.234.567` or `1,234,567`.
    if (integerPart.includes(decimalSeparator)) {
      if (!GROUPING_PATTERN.test(integerPart)) return null;
      integerPart = integerPart.replaceAll(decimalSeparator, '');
    }
  } else {
    const separators = cleaned.match(/[.,]/g) ?? [];
    if (separators.length > 0) {
      const previousGroupingDot = !hasComma && hasDot && hasGroupingDot(previousValue) && separators.length === 1;
      if (!GROUPING_PATTERN.test(cleaned) && !previousGroupingDot) return null;
      integerPart = cleaned.replace(/[.,]/g, '');
    }
  }

  if (!/^\d*$/.test(integerPart) || !/^\d*$/.test(fractionPart)) return null;
  integerPart = integerPart.replace(/^0+(?=\d)/, '') || '0';
  if (decimals === 0) {
    fractionPart = '';
    decimalWasTrailing = false;
  }
  return {
    negative: negative && (integerPart !== '0' || /[1-9]/.test(fractionPart)),
    integer: integerPart,
    fraction: fractionPart,
    decimalWasTrailing,
    incompleteSign: false,
  };
}

function groupInteger(integer: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function roundAndPadFraction(integer: string, fraction: string, decimals: number): { integer: string; fraction: string } {
  if (decimals === 0) return { integer, fraction: '' };
  const scale = 10n ** BigInt(decimals);
  const whole = BigInt(integer || '0');
  const keptFraction = fraction.slice(0, decimals).padEnd(decimals, '0');
  let scaled = whole * scale + BigInt(keptFraction || '0');
  if (fraction.length > decimals && Number(fraction[decimals]) >= 5) scaled += 1n;
  return {
    integer: (scaled / scale).toString(),
    fraction: (scaled % scale).toString().padStart(decimals, '0'),
  };
}

/**
 * Formats an editable money string using Brazilian separators, without a
 * currency symbol. Currency symbols should remain in a separate visual prefix.
 */
export function formatCurrencyInput(
  raw: string,
  currency: CurrencyCode,
  options: CurrencyInputOptions
): string {
  const decimals = CURRENCY_CATALOG[currency].decimals;
  const parsed = normalizeNumberText(raw, decimals, options.previousValue);
  if (!parsed) return '';
  if (parsed.incompleteSign) return options.focused ? '-' : '';

  let integer = parsed.integer;
  let fraction = parsed.fraction;
  if (options.focused) {
    fraction = fraction.slice(0, decimals);
  } else {
    ({ integer, fraction } = roundAndPadFraction(integer, fraction, decimals));
  }

  const groupedInteger = groupInteger(integer);
  const sign = parsed.negative ? '-' : '';
  const decimalPart = decimals > 0 && (options.focused
    ? parsed.decimalWasTrailing || fraction.length > 0
    : true)
    ? `,${fraction}`
    : '';

  return `${sign}${groupedInteger}${decimalPart}`;
}

/** Parses a masked currency value without changing the shared BRL parser. */
export function parseCurrencyInput(raw: string, currency: CurrencyCode): number {
  const decimals = CURRENCY_CATALOG[currency].decimals;
  const parsed = normalizeNumberText(raw, decimals);
  if (!parsed || parsed.incompleteSign) return 0;
  const rounded = roundAndPadFraction(parsed.integer, parsed.fraction, decimals);
  const normalized = decimals > 0
    ? `${rounded.integer}.${rounded.fraction}`
    : rounded.integer;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return 0;
  return parsed.negative ? -amount : amount;
}

/** Maps a caret by counting digits before it, so inserted separators don't jump the cursor. */
export function mapCurrencyInputCaret(
  previousValue: string,
  nextValue: string,
  previousCaret: number
): number {
  const safeCaret = Math.max(0, Math.min(previousCaret, previousValue.length));
  const prefix = previousValue.slice(0, safeCaret);
  const digitsBeforeCaret = prefix.match(/\d/g)?.length ?? 0;
  const hadSignBeforeCaret = prefix.includes('-');

  if (digitsBeforeCaret === 0) {
    if (hadSignBeforeCaret) {
      const firstDigit = nextValue.search(/\d/);
      return firstDigit < 0 ? nextValue.length : firstDigit;
    }
    return 0;
  }

  let seenDigits = 0;
  for (let index = 0; index < nextValue.length; index += 1) {
    if (/\d/.test(nextValue[index])) {
      seenDigits += 1;
      if (seenDigits === digitsBeforeCaret) return index + 1;
    }
  }
  return nextValue.length;
}
