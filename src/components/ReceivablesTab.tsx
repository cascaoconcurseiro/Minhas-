import React, { useMemo, useState } from 'react';
import { CheckCircle2, CreditCard as CreditCardIcon, HandCoins, Plus, Trash2, Undo2 } from 'lucide-react';
import type { BankAccount, CreditCard, FamilyMember, Receivable, Transaction } from '../types/finance';
import { formatBRL, formatMonthYearPT, formatShortDateBR, getLocalDateISO, parseBRLInput } from '../utils/financeRules';
import { getInvoiceMonthOptions, getReceivableBalance, getReceivablePaid, getReceivableStatus, summarizeReceivables } from '../utils/receivables';
import { getAccountLabelWithBank } from '../utils/accountLabels';
import { CurrencyInput } from './CurrencyInput';

export type ReceivablesIntent = { type: 'pay'; id: string } | { type: 'new'; kind: 'card_invoice' | 'loan' };

export interface ReceivableCreateInput {
  kind: 'card_invoice' | 'loan';
  personName: string;
  description?: string;
  amount: number;
  date: string;
  cardId?: string;
  invoiceMonth?: string;
  fromAccountId?: string;
  note?: string;
}

interface ReceivablesTabProps {
  receivables: Receivable[];
  cards: CreditCard[];
  accounts: BankAccount[];
  familyMembers: FamilyMember[];
  transactions: Transaction[];
  onCreate: (input: ReceivableCreateInput) => string | null;
  onRegisterPayment: (receivableId: string, input: { date: string; amount: number; accountId: string; note?: string }) => string | null;
  onRemovePayment: (receivableId: string, paymentId: string) => void;
  onDelete: (receivableId: string) => string | null;
  /** Atalho vindo da Visão Geral: já abre o formulário certo. */
  intent?: ReceivablesIntent | null;
  onIntentHandled?: () => void;
}

const inputClass = 'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-base sm:text-sm text-slate-900 dark:text-white';
const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1';

export const ReceivablesTab: React.FC<ReceivablesTabProps> = ({
  receivables, cards, accounts, familyMembers, transactions, onCreate, onRegisterPayment, onRemovePayment, onDelete, intent, onIntentHandled,
}) => {
  const [formKind, setFormKind] = useState<'card_invoice' | 'loan' | null>(null);
  const [person, setPerson] = useState('');
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(getLocalDateISO());
  const [cardId, setCardId] = useState('');
  const [invoiceMonth, setInvoiceMonth] = useState(getLocalDateISO().slice(0, 7));
  const [fromAccountId, setFromAccountId] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmountStr, setPayAmountStr] = useState('');
  const [payDate, setPayDate] = useState(getLocalDateISO());
  const [payAccountId, setPayAccountId] = useState('');
  const [payError, setPayError] = useState('');
  const [showPaid, setShowPaid] = useState(false);
  const [listError, setListError] = useState('');

  const summary = useMemo(() => summarizeReceivables(receivables), [receivables]);
  const knownPeople = useMemo(
    () => [...new Set([...familyMembers.map((member) => member.name), ...receivables.map((item) => item.personName)])].filter(Boolean),
    [familyMembers, receivables]
  );
  const monthOptions = useMemo(() => getInvoiceMonthOptions(transactions, cardId, getLocalDateISO()), [transactions, cardId]);
  const effectiveInvoiceMonth = monthOptions.includes(invoiceMonth) ? invoiceMonth : monthOptions[0];
  const cardName = (id?: string) => cards.find((card) => card.id === id)?.name ?? 'Cartão';
  const open = receivables.filter((item) => getReceivableBalance(item) > 0);
  const paid = receivables.filter((item) => getReceivableBalance(item) <= 0);

  const openForm = (kind: 'card_invoice' | 'loan') => {
    setFormKind(kind);
    setFormError('');
    // Fatura de cartão adicional: já vem com a pessoa da família (cônjuge, ou a única cadastrada).
    const people = familyMembers.filter((member) => member.name);
    const spouses = people.filter((member) => member.relationship === 'cônjuge');
    const suggested = kind === 'card_invoice' ? (spouses.length === 1 ? spouses[0] : people.length === 1 ? people[0] : null) : null;
    setPerson(suggested?.name ?? '');
    setDescription('');
    setAmountStr('');
    setDate(getLocalDateISO());
    setInvoiceMonth(getLocalDateISO().slice(0, 7));
    setCardId(cards.length === 1 ? cards[0].id : '');
    setFromAccountId('');
    setNote('');
  };

  React.useEffect(() => {
    if (!intent) return;
    if (intent.type === 'new') {
      openForm(intent.kind);
    } else {
      const target = receivables.find((item) => item.id === intent.id);
      if (target) startPayment(target);
    }
    onIntentHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent]);

  const submitForm = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formKind) return;
    const error = onCreate({
      kind: formKind,
      personName: person,
      description,
      amount: parseBRLInput(amountStr),
      date,
      cardId: formKind === 'card_invoice' ? cardId : undefined,
      invoiceMonth: formKind === 'card_invoice' ? effectiveInvoiceMonth : undefined,
      fromAccountId: formKind === 'loan' && fromAccountId ? fromAccountId : undefined,
      note,
    });
    if (error) { setFormError(error); return; }
    setFormKind(null);
  };

  const startPayment = (item: Receivable) => {
    setPayingId(item.id);
    setPayError('');
    setPayAmountStr(getReceivableBalance(item).toFixed(2).replace('.', ','));
    setPayDate(getLocalDateISO());
    setPayAccountId(accounts.length === 1 ? accounts[0].id : '');
  };

  const submitPayment = (event: React.FormEvent, item: Receivable) => {
    event.preventDefault();
    const error = onRegisterPayment(item.id, { date: payDate, amount: parseBRLInput(payAmountStr), accountId: payAccountId });
    if (error) { setPayError(error); return; }
    setPayingId(null);
  };

  const renderItem = (item: Receivable) => {
    const balance = getReceivableBalance(item);
    const received = getReceivablePaid(item);
    const status = getReceivableStatus(item);
    const percent = item.amount > 0 ? Math.min(100, Math.round((received / item.amount) * 100)) : 0;
    const isPaying = payingId === item.id;
    return (
      <li key={item.id} data-testid={`receivable-${item.id}`} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white break-words">{item.personName}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 break-words">{item.description}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-500">
              {item.kind === 'card_invoice' ? `Fatura ${formatMonthYearPT(item.invoiceMonth || '')} · ${cardName(item.cardId)}` : 'Empréstimo'} · desde {formatShortDateBR(item.createdDate)}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status === 'paid' ? 'bg-emerald-100 text-emerald-800' : status === 'partial' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>
            {status === 'paid' ? 'Recebido' : status === 'partial' ? 'Parcial' : 'Em aberto'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Total</p><p className="text-sm font-mono font-bold">{formatBRL(item.amount)}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Recebido</p><p className="text-sm font-mono font-bold text-emerald-700">{formatBRL(received)}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Falta</p><p className="text-sm font-mono font-bold text-rose-700">{formatBRL(balance)}</p></div>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Recebido: ${percent}%`}>
          <div className="h-full bg-emerald-500" style={{ width: `${percent}%` }} />
        </div>

        {item.payments.length > 0 && (
          <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
            {item.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-2">
                <span>{formatShortDateBR(payment.date)} · {formatBRL(payment.amount)} · {getAccountLabelWithBank(accounts.find((a) => a.id === payment.accountId) ?? { id: '', name: 'Conta', institution: '', type: 'checking' }, accounts)}</span>
                <button type="button" onClick={() => onRemovePayment(item.id, payment.id)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 underline" aria-label={`Desfazer recebimento de ${formatBRL(payment.amount)}`}>
                  <Undo2 className="h-3 w-3" /> Desfazer
                </button>
              </li>
            ))}
          </ul>
        )}

        {isPaying ? (
          <form onSubmit={(event) => submitPayment(event, item)} className="space-y-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3" data-testid="receivable-payment-form">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className={labelClass} htmlFor={`pay-amount-${item.id}`}>Valor recebido</label>
                <CurrencyInput id={`pay-amount-${item.id}`} data-testid="receivable-payment-amount" currency="BRL" value={payAmountStr} onValueChange={setPayAmountStr} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor={`pay-date-${item.id}`}>Data</label>
                <input id={`pay-date-${item.id}`} type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor={`pay-account-${item.id}`}>Entrou em qual conta?</label>
                <select id={`pay-account-${item.id}`} data-testid="receivable-payment-account" value={payAccountId} onChange={(e) => setPayAccountId(e.target.value)} className={inputClass}>
                  {!payAccountId && <option value="">Escolha a conta…</option>}
                  {accounts.map((account) => <option key={account.id} value={account.id}>{getAccountLabelWithBank(account, accounts)}</option>)}
                </select>
              </div>
            </div>
            {payError && <p role="alert" className="text-xs font-semibold text-rose-700">{payError}</p>}
            <div className="flex gap-2">
              <button type="submit" data-testid="receivable-payment-submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white">Registrar recebimento</button>
              <button type="button" onClick={() => setPayingId(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Cancelar</button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {balance > 0 ? (
              <button type="button" data-testid={`receivable-pay-${item.id}`} onClick={() => startPayment(item)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">
                <CheckCircle2 className="h-3.5 w-3.5" /> Registrar recebimento
              </button>
            ) : <span />}
            <button type="button" onClick={() => { if (window.confirm('Apagar este valor a receber e o que ele criou (linha na fatura e recebimentos)?')) setListError(onDelete(item.id) ?? ''); }} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 underline" aria-label={`Apagar valor a receber de ${item.personName}`}>
              <Trash2 className="h-3 w-3" /> Apagar
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="module-page space-y-5" data-testid="receivables-tab">
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total a receber</p>
            <p className="text-2xl font-mono font-extrabold text-slate-900 dark:text-white" data-testid="receivables-total">{formatBRL(summary.totalOpen)}</p>
            <p className="text-xs text-slate-500">Dinheiro que outras pessoas te devem. Não entra nas suas despesas nem nas suas receitas.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" data-testid="receivable-new-invoice" onClick={() => openForm('card_invoice')} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-white px-3 py-2 text-xs font-bold text-white dark:text-slate-900">
              <CreditCardIcon className="h-3.5 w-3.5" /> Cobrar fatura de cartão adicional
            </button>
            <button type="button" data-testid="receivable-new-loan" onClick={() => openForm('loan')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100">
              <Plus className="h-3.5 w-3.5" /> Empréstimo / dívida
            </button>
          </div>
        </div>
        {summary.byPerson.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {summary.byPerson.map((entry) => (
              <span key={entry.personName} className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                {entry.personName}: {formatBRL(entry.balance)}
              </span>
            ))}
          </div>
        )}
      </section>

      {formKind && (
        <form onSubmit={submitForm} data-testid="receivable-form" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {formKind === 'card_invoice' ? 'Cobrar a fatura do cartão adicional' : 'Novo empréstimo / dívida a receber'}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {formKind === 'card_invoice'
              ? 'Informe o valor cheio da fatura dela. Ele entra na fatura e no limite do seu cartão, mas não é gasto seu.'
              : 'Sem prazo: você registra cada pagamento quando a pessoa pagar, e o saldo vai baixando.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="receivable-person">Quem vai pagar</label>
              <input id="receivable-person" data-testid="receivable-person" list="receivable-people" value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Ex.: Esposa, Irmã" className={inputClass} />
              {familyMembers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Pessoas da família">
                  {familyMembers.filter((member) => member.name).map((member) => (
                    <button key={member.id} type="button" data-testid={`receivable-person-${member.id}`} aria-pressed={person === member.name} onClick={() => setPerson(member.name)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${person === member.name ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200'}`}>
                      {member.name}
                    </button>
                  ))}
                </div>
              )}
              <datalist id="receivable-people">{knownPeople.map((name) => <option key={name} value={name} />)}</datalist>
            </div>
            <div>
              <label className={labelClass} htmlFor="receivable-amount">{formKind === 'card_invoice' ? 'Valor cheio da fatura dela' : 'Valor'}</label>
              <CurrencyInput id="receivable-amount" data-testid="receivable-amount" currency="BRL" value={amountStr} onValueChange={setAmountStr} placeholder="0,00" className={inputClass} />
            </div>
            {formKind === 'card_invoice' ? (
              <>
                <div>
                  <label className={labelClass} htmlFor="receivable-card">Cartão</label>
                  <select id="receivable-card" data-testid="receivable-card" value={cardId} onChange={(e) => setCardId(e.target.value)} className={inputClass}>
                    {!cardId && <option value="">Escolha o cartão…</option>}
                    {cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="receivable-month">Mês da fatura</label>
                  <select id="receivable-month" data-testid="receivable-month" value={effectiveInvoiceMonth} onChange={(e) => setInvoiceMonth(e.target.value)} className={inputClass}>
                    {monthOptions.map((month) => <option key={month} value={month}>{formatMonthYearPT(month)}</option>)}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">Do mês atual até o último mês com compras neste cartão.</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={labelClass} htmlFor="receivable-description">Descrição (opcional)</label>
                  <input id="receivable-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Empréstimo para reforma" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="receivable-from">Saiu de qual conta? (opcional)</label>
                  <select id="receivable-from" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)} className={inputClass}>
                    <option value="">Não descontar de nenhuma conta (só registrar)</option>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{getAccountLabelWithBank(account, accounts)}</option>)}
                  </select>
                </div>
              </>
            )}
            <div>
              <label className={labelClass} htmlFor="receivable-date">Data</label>
              <input id="receivable-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="receivable-note">Observação (opcional)</label>
              <input id="receivable-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
            </div>
          </div>
          {formError && <p role="alert" className="text-xs font-semibold text-rose-700">{formError}</p>}
          <div className="flex gap-2">
            <button type="submit" data-testid="receivable-submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white">Registrar</button>
            <button type="button" onClick={() => setFormKind(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Cancelar</button>
          </div>
        </form>
      )}

      {listError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">{listError}</p>}

      {receivables.length === 0 && !formKind ? (
        <section className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-2">
          <HandCoins className="mx-auto h-8 w-8 text-slate-400" />
          <p className="text-sm font-bold text-slate-900 dark:text-white">Nada a receber por enquanto</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Use "Cobrar fatura de cartão adicional" quando o cartão de outra pessoa fechar, ou "Empréstimo / dívida" para dinheiro que você emprestou e vai receber aos poucos.
          </p>
        </section>
      ) : (
        <>
          {open.length > 0 && <ul className="space-y-3" data-testid="receivables-open">{open.map(renderItem)}</ul>}
          {paid.length > 0 && (
            <div className="space-y-2">
              <button type="button" onClick={() => setShowPaid((value) => !value)} className="text-xs font-bold text-slate-600 dark:text-slate-300 underline">
                {showPaid ? 'Ocultar' : 'Mostrar'} já recebidos ({paid.length})
              </button>
              {showPaid && <ul className="space-y-3">{paid.map(renderItem)}</ul>}
            </div>
          )}
        </>
      )}
    </div>
  );
};
