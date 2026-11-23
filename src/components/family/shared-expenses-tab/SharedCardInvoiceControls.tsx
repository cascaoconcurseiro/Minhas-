/** Botões da fatura de cartão adicional em Compartilhado: registrar (no topo da pessoa) e corrigir/apagar (em cada fatura). */
import { useState } from 'react';
import { CreditCard as CreditCardIcon, Edit3, Trash2 } from 'lucide-react';
import type { CreditCard, Transaction } from '../../../types/finance';
import { SharedCardInvoiceModal } from './SharedCardInvoiceModal';

export function NewSharedCardInvoiceButton({ memberId, memberName, cards, transactions, onCreate }: {
  memberId: string;
  memberName: string;
  cards: CreditCard[];
  transactions: Transaction[];
  onCreate: (input: { memberId: string; cardId: string; invoiceMonth: string; amount: number }) => string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-testid="shared-new-card-invoice"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
      >
        <CreditCardIcon className="h-3.5 w-3.5" />
        Fatura de cartão adicional
      </button>
      {open && (
        <SharedCardInvoiceModal
          memberName={memberName}
          cards={cards}
          transactions={transactions}
          onSubmit={(values) => onCreate({ memberId, ...values })}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function SharedCardInvoiceRowActions({ tx, memberName, cards, transactions, onUpdate, onDelete }: {
  tx: Transaction;
  memberName: string;
  cards: CreditCard[];
  transactions: Transaction[];
  onUpdate: (txId: string, input: { amount: number; invoiceMonth: string }) => string | null;
  onDelete: (txId: string) => string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-testid={`shared-card-invoice-edit-${tx.id}`}
          onClick={() => { setError(''); setEditing(true); }}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 underline"
          aria-label={`Corrigir ${tx.description}`}
        >
          <Edit3 className="h-3 w-3" /> Corrigir valor
        </button>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm('Apagar esta fatura do cartão adicional? Ela sai da fatura do seu cartão e do que a pessoa te deve.')) return;
            setError(onDelete(tx.id) ?? '');
          }}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 underline"
          aria-label={`Apagar ${tx.description}`}
        >
          <Trash2 className="h-3 w-3" /> Apagar
        </button>
      </div>
      {error && <p role="alert" className="max-w-[16rem] text-right text-[11px] font-semibold text-rose-700">{error}</p>}
      {editing && (
        <SharedCardInvoiceModal
          memberName={memberName}
          cards={cards}
          transactions={transactions}
          lockedCardId={tx.creditCardId}
          initialAmount={tx.amount}
          initialMonth={tx.competenceMonth}
          onSubmit={(values) => onUpdate(tx.id, { amount: values.amount, invoiceMonth: values.invoiceMonth })}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
