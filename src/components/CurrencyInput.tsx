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

    // Valor que chega de fora só com dígitos ("100") é em reais inteiros, não em centavos: o que a pessoa digita
    // volta sempre formatado (com vírgula), então só os valores iniciais caem aqui.
    const seededValue =
      digitEntryAsMinorUnits && CURRENCY_CATALOG[currency].decimals > 0 && /^\d+$/.test(value.trim())
        ? `${value.trim()},${'0'.repeat(CURRENCY_CATALOG[currency].decimals)}`
        : value;

    const displayValue = formatCurrencyInput(seededValue, currency, {
      focused,
      previousValue: focused ? seededValue : undefined,
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
            let text = input.value;
            let start = input.selectionStart ?? text.length;
            let end = input.selectionEnd ?? start;

            // Máscara de centavos (como nos apps de banco): só contam os dígitos, "," e "." digitados são ignorados,
            // o valor sempre cresce pela direita, apagar tira o último dígito e o cursor fica no fim.
            if (
              digitEntryAsMinorUnits &&
              CURRENCY_CATALOG[currency].decimals > 0 &&
              (inputType === 'insertText' || inputType.startsWith('delete') || inputType === 'historyUndo' || inputType === 'historyRedo') &&
              !/[^\d.,\sR$€£¥()+-]/i.test(text)
            ) {
              const negative = text.trim().startsWith('-');
              const digits = text.replace(/\D/g, '');
              const masked = digits ? formatCurrencyInput(`${negative ? '-' : ''}${digits}`, currency, { focused: true, previousValue: displayValue, digitEntryAsMinorUnits: true }) : '';
              decimalEntryRef.current = false;
              pendingSelection.current = { start: masked.length, end: masked.length };
              requestAnimationFrame(() => {
                const el = inputRef.current;
                if (el && document.activeElement === el) el.setSelectionRange(el.value.length, el.value.length);
              });
              onValueChange(masked);
              return;
            }

            // Apagar um ponto de milhar não pode mudar o valor: apaga o dígito vizinho e mantém o ponto
            if (
              (inputType === 'deleteContentBackward' || inputType === 'deleteContentForward') &&
              displayValue.length === text.length + 1 &&
              start === end
            ) {
              const removed = displayValue[start];
              if (removed === '.') {
                if (inputType === 'deleteContentBackward' && start > 0) {
                  text = displayValue.slice(0, start - 1) + displayValue.slice(start);
                  start = end = start - 1;
                } else if (inputType === 'deleteContentForward' && start + 1 < displayValue.length) {
                  text = displayValue.slice(0, start + 1) + displayValue.slice(start + 2);
                  start = end = start + 1;
                }
              }
            }

            // Digitação e edição comuns: o ponto na tela é só separador de milhar (volta a ser colocado ao formatar).
            // Um "." digitado vira a vírgula decimal quando ainda não há vírgula.
            if (inputType && !inputType.includes('Paste') && !inputType.includes('Drop')) {
              if (inputType === 'insertText' && inputEvent.data === '.' && start > 0) {
                text = displayValue.includes(',')
                  ? text.slice(0, start - 1) + text.slice(start)
                  : text.slice(0, start - 1) + ',' + text.slice(start);
                if (displayValue.includes(',')) { start -= 1; end = start; }
              }
              if (text.includes('.')) {
                const dotsBeforeStart = (text.slice(0, start).match(/\./g) ?? []).length;
                const dotsBeforeEnd = (text.slice(0, end).match(/\./g) ?? []).length;
                text = text.replace(/\./g, '');
                start -= dotsBeforeStart;
                end -= dotsBeforeEnd;
              }
            }

            // Vírgula antes de qualquer dígito: começa em "0,"
            if (inputType === 'insertText' && text.trim() === ',') {
              text = '0,';
              start = end = 2;
            }

            if (inputType === 'insertText' && /^[.,]$/.test(inputEvent.data || '')) {
              decimalEntryRef.current = true;
            } else if (inputType.includes('Paste') || (!inputType && /[.,]/.test(text))) {
              decimalEntryRef.current = /[.,]/.test(text);
            }
            if (!text.trim()) decimalEntryRef.current = false;

            const hasUnexpectedCharacters = /[^\d.,\sR$€£¥()+-]/i.test(text);
            if (hasUnexpectedCharacters) {
              pendingSelection.current = { start, end };
              onValueChange(text);
              return;
            }
            const rawForFormatting = digitEntryAsMinorUnits && !decimalEntryRef.current
              ? `${text.trim().startsWith('-') ? '-' : ''}${text.replace(/\D/g, '')}`
              : text;
            const next = formatCurrencyInput(rawForFormatting, currency, {
              focused: true,
              previousValue: displayValue,
              digitEntryAsMinorUnits,
            });
            const appendedDigit =
              inputType === 'insertText' &&
              /^\d$/.test(inputEvent.data || '') &&
              start === text.length &&
              digitEntryAsMinorUnits &&
              !decimalEntryRef.current;
            pendingSelection.current = {
              start: appendedDigit ? next.length : mapCurrencyInputCaret(text, next, start),
              end: appendedDigit ? next.length : mapCurrencyInputCaret(text, next, end),
            };
            // Sempre reaplica o cursor, mesmo quando o texto formatado é igual ao anterior
            requestAnimationFrame(() => {
              const el = inputRef.current;
              const sel = pendingSelection.current;
              if (el && sel && document.activeElement === el) {
                el.setSelectionRange(sel.start, sel.end);
                pendingSelection.current = null;
              }
            });
            onValueChange(next || (text.trim() ? text : ''));
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
