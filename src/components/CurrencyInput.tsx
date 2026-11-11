import React, {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { InputHTMLAttributes } from 'react';
import type { CurrencyCode } from '../types/finance';
import { CURRENCY_CATALOG } from '../utils/travelRules';
import { formatCurrencyInput, mapCurrencyInputCaret } from '../utils/currencyInput';

export interface CurrencyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string;
  currency: CurrencyCode;
  onValueChange: (value: string) => void;
  showCurrencySymbol?: boolean;
  digitEntryAsMinorUnits?: boolean;
}

/** Controlled currency field. The symbol is rendered separately from its editable value. */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput({ value, currency, onValueChange, showCurrencySymbol = false, digitEntryAsMinorUnits = true, onFocus, onBlur, ...inputProps }, forwardedRef) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const pendingSelection = useRef<{ start: number; end: number } | null>(null);
    const decimalEntryRef = useRef(false);
    const [focused, setFocused] = useState(false);

    const setRef = useCallback((node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    }, [forwardedRef]);

    const displayValue = formatCurrencyInput(value, currency, {
      focused,
      previousValue: focused ? value : undefined,
      digitEntryAsMinorUnits,
    });

    useLayoutEffect(() => {
      const input = inputRef.current;
      const selection = pendingSelection.current;
      if (!input || !selection || document.activeElement !== input) return;
      input.setSelectionRange(selection.start, selection.end);
      pendingSelection.current = null;
    }, [displayValue]);

    const input = (
        <input
          {...inputProps}
          ref={setRef}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onFocus={(event) => {
            decimalEntryRef.current = false;
            setFocused(true);
            onFocus?.(event);
          }}
          onChange={(event) => {
            const input = event.currentTarget;
            const inputEvent = event.nativeEvent as InputEvent;
            const inputType = inputEvent.inputType || '';
            if (inputType === 'insertText' && /^[.,]$/.test(inputEvent.data || '')) {
              decimalEntryRef.current = true;
            } else if (inputType.includes('Paste') || (!inputType && /[.,]/.test(input.value))) {
              decimalEntryRef.current = /[.,]/.test(input.value);
            }
            if (!input.value.trim()) decimalEntryRef.current = false;

            const hasUnexpectedCharacters = /[^\d.,\sR$€£¥()+-]/i.test(input.value);
            if (hasUnexpectedCharacters) {
              pendingSelection.current = {
                start: input.selectionStart ?? input.value.length,
                end: input.selectionEnd ?? input.value.length,
              };
              onValueChange(input.value);
              return;
            }
            const rawForFormatting = digitEntryAsMinorUnits && !decimalEntryRef.current && !hasUnexpectedCharacters
              ? `${input.value.trim().startsWith('-') ? '-' : ''}${input.value.replace(/\D/g, '')}`
              : input.value;
            const next = formatCurrencyInput(rawForFormatting, currency, {
              focused: true,
              previousValue: displayValue,
              digitEntryAsMinorUnits,
            });
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? start;
            const appendedDigit =
              inputType === 'insertText' &&
              /^\d$/.test(inputEvent.data || '') &&
              start === input.value.length &&
              digitEntryAsMinorUnits &&
              !decimalEntryRef.current;
            pendingSelection.current = {
              start: appendedDigit ? next.length : mapCurrencyInputCaret(input.value, next, start),
              end: appendedDigit ? next.length : mapCurrencyInputCaret(input.value, next, end),
            };
            onValueChange(next || (input.value.trim() ? input.value : ''));
          }}
          onBlur={(event) => {
            setFocused(false);
            const finalized = formatCurrencyInput(value, currency, { focused: false, previousValue: displayValue });
            onValueChange(finalized || (value.trim() ? value : ''));
            onBlur?.(event);
          }}
        />
    );
    return showCurrencySymbol ? (
      <span className="inline-flex items-center">
        <span aria-hidden="true" className="mr-1 select-none">{CURRENCY_CATALOG[currency].symbol}</span>
        {input}
      </span>
    ) : input;
  },
);

CurrencyInput.displayName = 'CurrencyInput';
