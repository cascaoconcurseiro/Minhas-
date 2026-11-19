import React, { useState } from 'react';
import type { CreditCard } from '../../types/finance';
import type { InvoiceCarryOverState } from '../../domain/finance/invoiceCarryOver.ts';
import { addMonthsToYearMonth, formatBRL, formatMonthYearPT, parseBRLInput } from '../../domain/finance/financeRules';
import { CurrencyInput } from '../ui/CurrencyInput';

interface InvoiceCarryOverPanelProps {
  card: CreditCard;
  invoiceMonth: string;
  state: InvoiceCarryOverState;
  onCarryOver: (feeAmount?: number) => void;
  onUndo: () => void;
}

/**
 * Depois de um pagamento parcial: leva o que sobrou para a fatura seguinte (como o banco faz), com os encargos
 * cobrados, ou desfaz isso enquanto nada do que foi levado tiver sido pago.
 */
export const InvoiceCarryOverPanel: React.FC<InvoiceCarryOverPanelProps> = ({ card, invoiceMonth, state, onCarryOver, onUndo }) => {
  const [feeStr, setFeeStr] = useState('');
  const [error, setError] = useState('');
  if (!state.canCarry && !state.canUndo) return null;
  const nextMonthLabel = formatMonthYearPT(addMonthsToYearMonth(invoiceMonth, 1));

  return (
    <div data-testid="invoice-carry-over-panel" className="border-b border-amber-200 bg-amber-50/70 px-4 sm:px-6 py-3.5 space-y-3">
      {state.canCarry && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold text-amber-950">Levar o restante para a próxima fatura — {card.name}</h3>
            <p className="text-[11px] text-amber-900 mt-0.5">
              Sobraram {formatBRL(state.pendingAmount)} em aberto. Eles passam para a fatura de {nextMonthLabel}, sem mudar o mês em que você gastou. Se o banco cobrou juros ou encargos, informe abaixo (opcional).
            </p>
            {error && <p role="alert" className="text-[11px] font-semibold text-rose-700 mt-1">{error}</p>}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <label htmlFor="carry-over-fee" className="text-[11px] font-semibold text-amber-900">Encargos R$</label>
            <CurrencyInput
              id="carry-over-fee"
              value={feeStr}
              currency="BRL"
              onValueChange={(value) => { setFeeStr(value); setError(''); }}
              placeholder="0,00"
              className="w-24 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900"
            />
            <button
              type="button"
              data-testid="carry-over-confirm"
              onClick={() => {
                const fee = feeStr.trim() ? parseBRLInput(feeStr) : undefined;
                if (fee !== undefined && !(fee >= 0)) { setError('Informe um valor de encargos válido.'); return; }
                onCarryOver(fee && fee > 0 ? fee : undefined);
                setFeeStr('');
              }}
              className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 whitespace-nowrap"
            >
              Levar para a próxima
            </button>
          </div>
        </div>
      )}
      {state.canUndo && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-amber-900">
            {formatBRL(state.carriedAmount)} desta fatura foram levados para a fatura de {nextMonthLabel}.
          </p>
          <button
            type="button"
            data-testid="carry-over-undo"
            onClick={onUndo}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap"
          >
            Desfazer
          </button>
        </div>
      )}
    </div>
  );
};
