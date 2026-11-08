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
}

/** Controlled currency field. The symbol is rendered separately from its editable value. */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput({ value, currency, onValueChange, onFocus, onBlur, ...inputProps }, forwardedRef) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const pendingSelection = useRef<{ start: number; end: number } | null>(null);
    const [focused, setFocused] = useState(false);

    const setRef = useCallback((node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    }, [forwardedRef]);

    const displayValue = formatCurrencyInput(value, currency, {
      focused,
      previousValue: focused ? value : undefined,
    });

    useLayoutEffect(() => {
      const input = inputRef.current;
      const selection = pendingSelection.current;
      if (!input || !selection || document.activeElement !== input) return;
      input.setSelectionRange(selection.start, selection.end);
      pendingSelection.current = null;
    }, [displayValue]);

    return (
      <span className="inline-flex items-center">
        <span aria-hidden="true" className="mr-1 select-none">{CURRENCY_CATALOG[currency].symbol}</span>
        <input
          {...inputProps}
          ref={setRef}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onChange={(event) => {
            const input = event.currentTarget;
            const previous = displayValue;
            const next = formatCurrencyInput(input.value, currency, {
              focused: true,
              previousValue: previous,
            });
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? start;
            pendingSelection.current = {
              start: mapCurrencyInputCaret(input.value, next, start),
              end: mapCurrencyInputCaret(input.value, next, end),
            };
            onValueChange(next);
          }}
          onBlur={(event) => {
            setFocused(false);
            const finalized = formatCurrencyInput(value, currency, { focused: false, previousValue: displayValue });
            onValueChange(finalized);
            onBlur?.(event);
          }}
        />
      </span>
    );
  },
);

CurrencyInput.displayName = 'CurrencyInput';
