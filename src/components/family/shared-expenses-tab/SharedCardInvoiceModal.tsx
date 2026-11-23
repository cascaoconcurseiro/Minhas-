/** Janela para registrar ou corrigir a fatura de um cartão adicional cobrada de uma pessoa. Parte de SharedExpensesTab. */
import React, { useMemo, useState } from 'react';
import { CreditCard as CreditCardIcon, X } from 'lucide-react';
import type { CreditCard, Transaction } from '../../../types/finance';
import { formatMonthYearPT, getLocalDateISO, parseBRLInput } from '../../../domain/finance/financeRules';
import { getInvoiceMonthOptions } from '../../../domain/receivables/receivables';
import { CurrencyInput } from '../../ui/CurrencyInput';

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm font-medium text-slate-900 focus:border-emerald-600 focus:outline-none';
const labelClass = 'block text-xs font-semibold text-slate-700 mb-1';

interface SharedCardInvoiceModalProps {
  memberName: string;
  cards: CreditCard[];
  transactions: Transaction[];
  /** Na edição o cartão não muda (a fatura já está nele); no cadastro novo a pessoa escolhe. */
  lockedCardId?: string;
  initialAmount?: number;
  initialMonth?: string;
  /** Devolve a mensagem de erro, ou null quando salvou. */
  onSubmit: (values: { cardId: string; invoiceMonth: string; amount: number }) => string | null;
  onClose: () => void;
}

export function SharedCardInvoiceModal({
  memberName, cards, transactions, lockedCardId, initialAmount, initialMonth, onSubmit, onClose,
}: SharedCardInvoiceModalProps) {
  const editing = Boolean(lockedCardId);
  const [cardId, setCardId] = useState(lockedCardId ?? (cards.length === 1 ? cards[0].id : ''));
  const [invoiceMonth, setInvoiceMonth] = useState(initialMonth ?? getLocalDateISO().slice(0, 7));
  const [amountStr, setAmountStr] = useState(initialAmount !== undefined ? initialAmount.toFixed(2).replace('.', ',') : '');
  const [error, setError] = useState('');

  const monthOptions = useMemo(() => {
    const options = getInvoiceMonthOptions(transactions, cardId, getLocalDateISO());
    // Na edição o mês atual da fatura precisa continuar na lista, mesmo que já tenha ficado para trás.
    return editing && initialMonth && !options.includes(initialMonth) ? [initialMonth, ...options].sort() : options;
  }, [transactions, cardId, initialMonth, editing]);
  const effectiveMonth = monthOptions.includes(invoiceMonth) ? invoiceMonth : monthOptions[0];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const message = onSubmit({ cardId, invoiceMonth: effectiveMonth, amount: parseBRLInput(amountStr) });
    if (message) { setError(message); return; }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px] modal-shell"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shared-card-invoice-title"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <form
        onSubmit={submit}
        data-testid="shared-card-invoice-form"
        className="w-full max-w-md max-h-[90dvh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-modal-in"
      >
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2 text-emerald-700">
            <CreditCardIcon className="h-5 w-5 shrink-0" />
            <h3 id="shared-card-invoice-title" className="text-base font-bold text-slate-900 break-words">
              {editing ? 'Corrigir fatura do cartão adicional' : 'Fatura de cartão adicional'}
            </h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-xs text-slate-600">
            Informe o valor cheio da fatura de <strong className="text-slate-900">{memberName}</strong>. Ele entra na fatura e no limite do
            seu cartão e soma ao que {memberName.split(' ')[0]} te deve no mês da fatura. Você pode corrigir o valor depois.
          </p>
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}
          <div>
            <label className={labelClass} htmlFor="shared-card-invoice-card">Cartão</label>
            <select id="shared-card-invoice-card" data-testid="shared-card-invoice-card" value={cardId} disabled={editing} onChange={(e) => setCardId(e.target.value)} className={inputClass}>
              {!cardId && <option value="">Escolha o cartão…</option>}
              {cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="shared-card-invoice-month">Mês da fatura</label>
            <select id="shared-card-invoice-month" data-testid="shared-card-invoice-month" value={effectiveMonth ?? ''} disabled={!cardId} onChange={(e) => setInvoiceMonth(e.target.value)} className={inputClass}>
              {monthOptions.map((month) => <option key={month} value={month}>{formatMonthYearPT(month)}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">Do mês atual até o último mês com compras neste cartão.</p>
          </div>
          <div>
            <label className={labelClass} htmlFor="shared-card-invoice-amount">Valor cheio da fatura dela</label>
            <CurrencyInput id="shared-card-invoice-amount" data-testid="shared-card-invoice-amount" currency="BRL" value={amountStr} onValueChange={setAmountStr} placeholder="0,00" className={inputClass} />
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-5 py-3.5">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
          <button type="submit" data-testid="shared-card-invoice-submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
            {editing ? 'Salvar' : 'Registrar fatura'}
          </button>
        </div>
      </form>
    </div>
  );
}
