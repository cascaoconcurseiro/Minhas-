import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CreditCard as CreditCardIcon,
  Edit3,
  FastForward,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  BankAccount,
  Category,
  CreditCard,
  CreditCardSummary,
  Transaction,
} from '../types/finance';
import {
  addMonthsToYearMonth,
  calculateCreditCardSummary,
  formatBRL,
  formatMonthYearPT,
  formatShortDateBR,
  parseBRLInput,
} from '../utils/financeRules';
import {
  getActiveInstallmentGroupsForCard,
  getFutureUnpaidInstallments,
} from '../utils/uxEnhancementRules';

interface CreditCardsTabProps {
  selectedMonth: string;
  cards: CreditCard[];
  cardSummaries: CreditCardSummary[];
  accounts: BankAccount[];
  categories: Category[];
  transactions: Transaction[];
  initialSelectedCardId?: string;
  onPayInvoice: (cardId: string, accountId: string, customAmount?: number) => void;
  onAnticipateInstallments?: (
    installmentGroupId: string,
    discountAmount: number,
    maxCountToAdvance?: number
  ) => void;
  onReverseAnticipation?: (targetIdOrGroupId: string) => void;
  onAddCard: (card: Omit<CreditCard, 'id'>) => void;
  onUpdateCard?: (card: CreditCard) => void;
  onDeleteCard?: (cardId: string) => void;
  onDeleteTransaction: (txId: string, deleteGroup?: boolean) => void;
  onOpenNewCardExpense: () => void;
}

export const CreditCardsTab: React.FC<CreditCardsTabProps> = ({
  selectedMonth,
  cards,
  cardSummaries,
  accounts,
  categories,
  transactions,
  initialSelectedCardId,
  onPayInvoice,
  onAnticipateInstallments,
  onReverseAnticipation,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onDeleteTransaction,
  onOpenNewCardExpense,
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string>(
    initialSelectedCardId || cards[0]?.id || ''
  );
  // Drill-down page state: null = Credit Cards Overview List, string = Dedicated Card Page
  const [activeViewCardId, setActiveViewCardId] = useState<string | null>(
    initialSelectedCardId || null
  );

  useEffect(() => {
    if (initialSelectedCardId) {
      setSelectedCardId(initialSelectedCardId);
      setActiveViewCardId(initialSelectedCardId);
    }
  }, [initialSelectedCardId]);

  const [paymentAccountId, setPaymentAccountId] = useState<string>(
    cards[0]?.defaultAccountId || accounts[0]?.id || ''
  );
  const [showNewCardForm, setShowNewCardForm] = useState(false);

  // Partial / Custom Invoice Payment State
  const [showPartialPayPanel, setShowPartialPayPanel] = useState(false);
  const [partialPayAmountStr, setPartialPayAmountStr] = useState('');
  const [partialPayError, setPartialPayError] = useState('');

  // Installment anticipation panel state
  const [anticipatingGroupId, setAnticipatingGroupId] = useState<string | null>(null);
  const [anticipationDiscountStr, setAnticipationDiscountStr] = useState('0,00');
  const [anticipationCountToAdvance, setAnticipationCountToAdvance] = useState<number>(0); // 0 = all

  // New card form state
  const [newCardName, setNewCardName] = useState('');
  const [newCardBrand, setNewCardBrand] = useState<'Mastercard' | 'Visa' | 'Elo'>('Mastercard');
  const [newCardLimit, setNewCardLimit] = useState('');
  const [newCardClosing, setNewCardClosing] = useState(20);
  const [newCardDue, setNewCardDue] = useState(28);
  const [newCardAccount, setNewCardAccount] = useState(accounts[0]?.id || '');
  const [formError, setFormError] = useState('');

  // Edit active card state
  const [isEditingActiveCard, setIsEditingActiveCard] = useState(false);
  const [editCardName, setEditCardName] = useState('');
  const [editCardBrand, setEditCardBrand] = useState<'Mastercard' | 'Visa' | 'Elo'>('Mastercard');
  const [editCardLimit, setEditCardLimit] = useState('');
  const [editCardClosing, setEditCardClosing] = useState(20);
  const [editCardDue, setEditCardDue] = useState(28);
  const [editCardAccount, setEditCardAccount] = useState('');
  const [confirmDeleteCardId, setConfirmDeleteCardId] = useState<string | null>(null);

  const activeCard = cards.find((c) => c.id === selectedCardId) || cards[0];
  const activeSummary = cardSummaries.find((s) => s.cardId === activeCard?.id);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  useEffect(() => {
    setPaymentAccountId((currentAccountId) => {
      if (
        activeCard?.defaultAccountId &&
        accounts.some((a) => a.id === activeCard.defaultAccountId)
      ) {
        return activeCard.defaultAccountId;
      }
      return accounts.some((a) => a.id === currentAccountId)
        ? currentAccountId
        : accounts[0]?.id || '';
    });
  }, [activeCard?.id, activeCard?.defaultAccountId, accounts]);

  useEffect(() => {
    if (
      (!newCardAccount || !accounts.some((a) => a.id === newCardAccount)) &&
      accounts.length > 0
    ) {
      setNewCardAccount(accounts[0].id);
    }
  }, [accounts, newCardAccount]);

  // Active installment groups with future unpaid parcels on this card
  const activeInstallmentGroups = useMemo(() => {
    if (!activeCard) return [];
    return getActiveInstallmentGroupsForCard(
      transactions,
      activeCard.id,
      selectedMonth
    );
  }, [activeCard, transactions, selectedMonth]);

  const groupsWithFutureParcels = useMemo(
    () => activeInstallmentGroups.filter((g) => g.futureInstallmentsCount > 0),
    [activeInstallmentGroups]
  );

  // Invoice payment transactions recorded for this card in selectedMonth
  const cardInvoicePaymentsInMonth = useMemo(() => {
    if (!activeCard) return [];
    return transactions.filter(
      (tx) =>
        tx.isInvoicePayment &&
        tx.competenceMonth === selectedMonth &&
        (tx.settledCardId === activeCard.id ||
          tx.description.toLowerCase().includes(activeCard.name.toLowerCase()) ||
          tx.id.includes(activeCard.id))
    );
  }, [activeCard, transactions, selectedMonth]);

  // 6-Month Future Invoice Projection for the active card
  const futureProjections = useMemo(() => {
    if (!activeCard) return [];
    return [0, 1, 2, 3, 4, 5].map((offset) => {
      const m = addMonthsToYearMonth(selectedMonth, offset);
      const sum = calculateCreditCardSummary(activeCard, transactions, m);
      return {
        month: m,
        label: formatMonthYearPT(m),
        total: sum.invoiceTotal,
        count: sum.transactions.length,
        isPaid: sum.isInvoicePaid,
      };
    });
  }, [activeCard, transactions, selectedMonth]);

  const globalCardsTotals = useMemo(() => {
    let totalInvoicesMonth = 0;
    let totalLimit = 0;
    let totalUsed = 0;
    let totalAvailable = 0;
    for (const c of cards) {
      const sum = cardSummaries.find((s) => s.cardId === c.id);
      totalLimit += c.limit;
      totalInvoicesMonth += sum?.invoiceTotal ?? 0;
      totalUsed += sum?.usedLimit ?? 0;
      totalAvailable += sum?.availableLimit ?? c.limit;
    }
    return { totalInvoicesMonth, totalLimit, totalUsed, totalAvailable };
  }, [cards, cardSummaries]);

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    const limitVal = parseBRLInput(newCardLimit);
    if (!newCardName.trim()) {
      setFormError('Informe o nome do cartão (ex: Inter Black, Santander SX).');
      return;
    }
    if (limitVal <= 0) {
      setFormError('Informe um limite total válido.');
      return;
    }
    onAddCard({
      name: newCardName.trim(),
      brand: newCardBrand,
      limit: limitVal,
      closingDay: newCardClosing,
      dueDay: newCardDue,
      defaultAccountId: newCardAccount || accounts[0]?.id || '',
      color: '#0f172a',
    });
    setNewCardName('');
    setFormError('');
    setShowNewCardForm(false);
  };

  if (!activeCard || !activeSummary) {
    return (
      <div className="space-y-6 min-w-0 max-w-full">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <CreditCardIcon className="mx-auto h-10 w-10 text-emerald-600 mb-3" />
          <h2 className="text-lg font-bold text-slate-900 font-display">
            Nenhum cartão de crédito cadastrado
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Cadastre seus cartões para acompanhar faturas mensais, parcelamentos, limites disponíveis e antecipação de parcelas.
          </p>
          <button
            type="button"
            onClick={() => setShowNewCardForm((prev) => !prev)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{showNewCardForm ? 'Fechar Cadastro' : 'Cadastrar Primeiro Cartão'}</span>
          </button>
        </div>

        {showNewCardForm && (
          <form
            onSubmit={handleCreateCard}
            className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Cadastrar Novo Cartão de Crédito</h3>
              <span className="text-xs text-slate-500 hidden sm:inline">Controle manual de faturas e parcelamentos</span>
            </div>

            {formError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2">
                <label htmlFor="card-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do Cartão
                </label>
                <input
                  id="card-name-input"
                  type="text"
                  value={newCardName}
                  onChange={(e) => setNewCardName(e.target.value)}
                  placeholder="Ex: Banco Inter Black, C6 Carbon, Ourocard"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="card-brand-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  Bandeira
                </label>
                <select
                  id="card-brand-select"
                  value={newCardBrand}
                  onChange={(e) => setNewCardBrand(e.target.value as 'Mastercard' | 'Visa' | 'Elo')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                >
                  <option value="Mastercard">Mastercard</option>
                  <option value="Visa">Visa</option>
                  <option value="Elo">Elo</option>
                </select>
              </div>

              <div>
                <label htmlFor="card-limit-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Limite Total (R$)
                </label>
                <input
                  id="card-limit-input"
                  type="text"
                  value={newCardLimit}
                  onChange={(e) => setNewCardLimit(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="card-closing-input" className="block text-xs font-semibold text-slate-700 mb-1">
                    Dia Fecha
                  </label>
                  <input
                    id="card-closing-input"
                    type="number"
                    min={1}
                    max={31}
                    value={newCardClosing}
                    onChange={(e) => setNewCardClosing(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="card-due-input" className="block text-xs font-semibold text-slate-700 mb-1">
                    Dia Vence
                  </label>
                  <input
                    id="card-due-input"
                    type="number"
                    min={1}
                    max={31}
                    value={newCardDue}
                    onChange={(e) => setNewCardDue(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <label htmlFor="card-default-acc">Conta padrão:</label>
                <select
                  id="card-default-acc"
                  value={newCardAccount}
                  onChange={(e) => setNewCardAccount(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-900"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Salvar Cartão
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  const isCardDetailOpen = Boolean(
    activeViewCardId && cards.some((c) => c.id === activeViewCardId)
  );

  return (
    <div className="space-y-6 min-w-0 max-w-full" data-testid="cards-tab-view">
      {/* VIEW 1: CREDIT CARDS OVERVIEW LIST (Shown when no specific card page is opened) */}
      {!isCardDetailOpen && (
        <>
          {/* Consolidated KPIs Across All Credit Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">
                Faturas em {formatMonthYearPT(selectedMonth)}
              </p>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 truncate">
                {formatBRL(globalCardsTotals.totalInvoicesMonth)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 truncate">
                Soma de {cards.length} cartão(ões)
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">
                Limite Total Consolidado
              </p>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 truncate">
                {formatBRL(globalCardsTotals.totalLimit)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 truncate">
                Crédito total aprovado
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">
                Limite Tomado (Parcelas)
              </p>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-rose-700 truncate">
                {formatBRL(globalCardsTotals.totalUsed)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 truncate">
                Faturas atuais + futuras
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">
                Limite Disponível Total
              </p>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 truncate">
                {formatBRL(globalCardsTotals.totalAvailable)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 truncate">
                Livre para novas compras
              </p>
            </div>
          </div>

          {/* Interactive Credit Card Gallery Section */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Seus Cartões de Crédito
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clique em qualquer cartão abaixo para entrar na página exclusiva do cartão, pagar a fatura ou ver todos os lançamentos
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewCardForm((prev) => !prev)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {showNewCardForm ? 'Fechar Cadastro' : '+ Novo Cartão'}
                </button>
                <button
                  type="button"
                  onClick={onOpenNewCardExpense}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Compra no Cartão</span>
                </button>
              </div>
            </div>

            {/* Inline New Card Form */}
            {showNewCardForm && (
              <form
                onSubmit={handleCreateCard}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-6 space-y-4 animate-expand-in"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">Cadastrar Novo Cartão de Crédito</h3>
                  <span className="text-xs text-slate-500 hidden sm:inline">Controle manual de faturas e parcelamentos</span>
                </div>

                {formError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-2">
                    <label htmlFor="card-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome do Cartão
                    </label>
                    <input
                      id="card-name-input"
                      type="text"
                      value={newCardName}
                      onChange={(e) => setNewCardName(e.target.value)}
                      placeholder="Ex: Banco Inter Black, C6 Carbon, Ourocard"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label htmlFor="card-brand-select" className="block text-xs font-semibold text-slate-700 mb-1">
                      Bandeira
                    </label>
                    <select
                      id="card-brand-select"
                      value={newCardBrand}
                      onChange={(e) => setNewCardBrand(e.target.value as 'Mastercard' | 'Visa' | 'Elo')}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                    >
                      <option value="Mastercard">Mastercard</option>
                      <option value="Visa">Visa</option>
                      <option value="Elo">Elo</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="card-limit-input" className="block text-xs font-semibold text-slate-700 mb-1">
                      Limite Total (R$)
                    </label>
                    <input
                      id="card-limit-input"
                      type="text"
                      value={newCardLimit}
                      onChange={(e) => setNewCardLimit(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="card-closing-input" className="block text-xs font-semibold text-slate-700 mb-1">
                        Dia Fecha
                      </label>
                      <input
                        id="card-closing-input"
                        type="number"
                        min={1}
                        max={31}
                        value={newCardClosing}
                        onChange={(e) => setNewCardClosing(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono tabular-nums text-slate-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="card-due-input" className="block text-xs font-semibold text-slate-700 mb-1">
                        Dia Vence
                      </label>
                      <input
                        id="card-due-input"
                        type="number"
                        min={1}
                        max={31}
                        value={newCardDue}
                        onChange={(e) => setNewCardDue(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono tabular-nums text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <label htmlFor="card-default-acc">Conta padrão:</label>
                    <select
                      id="card-default-acc"
                      value={newCardAccount}
                      onChange={(e) => setNewCardAccount(e.target.value)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Salvar Cartão
                  </button>
                </div>
              </form>
            )}

            {/* Grid of Credit Cards — Click any card to enter its dedicated page */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((card) => {
                const sum = cardSummaries.find((s) => s.cardId === card.id);
                const invoiceTotal = sum?.invoiceTotal ?? 0;
                const usedLimit = sum?.usedLimit ?? 0;
                const availableLimit = sum?.availableLimit ?? card.limit;
                const usagePercent = sum?.usagePercent ?? 0;
                const isPaid = sum?.isInvoicePaid ?? false;

                return (
                  <div
                    key={card.id}
                    data-testid={`credit-card-item-${card.id}`}
                    onClick={() => {
                      setSelectedCardId(card.id);
                      setActiveViewCardId(card.id);
                      setPaymentAccountId(card.defaultAccountId || accounts[0]?.id || '');
                      setShowPartialPayPanel(false);
                      setAnticipatingGroupId(null);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedCardId(card.id);
                        setActiveViewCardId(card.id);
                      }
                    }}
                    className="group rounded-2xl border border-slate-200 bg-white hover:border-violet-500 hover:shadow-md p-5 text-left transition-all cursor-pointer flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-2xs">
                          <CreditCardIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-bold text-slate-900 block truncate group-hover:text-violet-700 transition-colors">
                            {card.name}
                          </span>
                          <p className="text-[11px] text-slate-500 truncate">
                            {card.brand} · Fecha dia {card.closingDay} · Vence dia {card.dueDay}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : invoiceTotal === 0
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {isPaid ? 'Quitada' : invoiceTotal === 0 ? 'Sem Gastos' : 'Aberta'}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-[11px] font-medium text-slate-500">
                          Fatura de {formatMonthYearPT(selectedMonth)}
                        </p>
                        <p className="text-xl font-extrabold font-mono tabular-nums text-slate-900">
                          {formatBRL(invoiceTotal)}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 mb-1">
                          <span>Tomado: {formatBRL(usedLimit)}</span>
                          <span>Livre: {formatBRL(availableLimit)}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all ${
                              usagePercent > 80 ? 'bg-rose-600' : 'bg-slate-900'
                            }`}
                            style={{ width: `${Math.min(100, usagePercent)}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-violet-700 group-hover:text-violet-800">
                        <span>Abrir página e fatura do cartão</span>
                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* VIEW 2: DEDICATED CREDIT CARD PAGE WITH INVOICE & PROJECTIONS */}
      {isCardDetailOpen && (
        <div className="space-y-6 animate-expand-in" data-testid="card-dedicated-page">
          {/* Top Navigation Bar: Back to All Cards + Quick Switcher + Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="back-to-cards-list-btn"
                onClick={() => setActiveViewCardId(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar para Todos os Cartões ({cards.length})</span>
              </button>

              {cards.length > 1 && (
                <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
                  {cards.map((card) => {
                    const isSelected = card.id === activeCard.id;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          setSelectedCardId(card.id);
                          setActiveViewCardId(card.id);
                          setPaymentAccountId(card.defaultAccountId || accounts[0]?.id || '');
                          setShowPartialPayPanel(false);
                          setAnticipatingGroupId(null);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                          isSelected
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <CreditCardIcon className="h-3.5 w-3.5" />
                        <span>{card.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="open-anticipate-center-btn"
                onClick={() => {
                  if (anticipatingGroupId) {
                    setAnticipatingGroupId(null);
                  } else {
                    const firstGroup =
                      groupsWithFutureParcels[0]?.installmentGroupId ||
                      activeInstallmentGroups[0]?.installmentGroupId ||
                      '__empty__';
                    setAnticipatingGroupId(firstGroup);
                    setAnticipationCountToAdvance(0);
                    setAnticipationDiscountStr('15,00');
                  }
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  anticipatingGroupId
                    ? 'border-violet-600 bg-violet-600 text-white'
                    : 'border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100'
                }`}
              >
                <FastForward className="h-3.5 w-3.5" />
                <span>
                  Adiantar Parcelas
                  {groupsWithFutureParcels.length > 0
                    ? ` (${groupsWithFutureParcels.length})`
                    : ''}
                </span>
              </button>

              {onUpdateCard && (
                <button
                  type="button"
                  onClick={() => {
                    if (isEditingActiveCard) {
                      setIsEditingActiveCard(false);
                    } else {
                      setEditCardName(activeCard.name);
                      setEditCardBrand(activeCard.brand);
                      setEditCardLimit(activeCard.limit.toFixed(2).replace('.', ','));
                      setEditCardClosing(activeCard.closingDay);
                      setEditCardDue(activeCard.dueDay);
                      setEditCardAccount(
                        activeCard.defaultAccountId || accounts[0]?.id || ''
                      );
                      setIsEditingActiveCard(true);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>{isEditingActiveCard ? 'Cancelar Edição' : 'Editar Cartão'}</span>
                </button>
              )}

              {onDeleteCard && (
                confirmDeleteCardId === activeCard.id ? (
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs">
                    <span className="font-bold text-rose-900">Excluir cartão?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteCard(activeCard.id);
                        setConfirmDeleteCardId(null);
                        setActiveViewCardId(null);
                      }}
                      className="rounded bg-rose-600 px-2 py-0.5 font-bold text-white hover:bg-rose-700"
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteCardId(null)}
                      className="rounded bg-white px-2 py-0.5 font-semibold text-slate-700 border border-slate-300"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCardId(activeCard.id)}
                    aria-label={`Excluir cartão ${activeCard.name}`}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )
              )}

              <button
                type="button"
                onClick={onOpenNewCardExpense}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Compra Cartão</span>
              </button>
            </div>
          </div>

          {isEditingActiveCard && onUpdateCard && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const limitVal = parseBRLInput(editCardLimit);
                if (!editCardName.trim() || limitVal <= 0) return;
                onUpdateCard({
                  ...activeCard,
                  name: editCardName.trim(),
                  brand: editCardBrand,
                  limit: limitVal,
                  closingDay: Math.max(1, Math.min(31, editCardClosing || 20)),
                  dueDay: Math.max(1, Math.min(31, editCardDue || 28)),
                  defaultAccountId: editCardAccount || activeCard.defaultAccountId,
                });
                setIsEditingActiveCard(false);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <h3 className="text-xs font-bold text-slate-900">
                  Editar Configurações do Cartão — {activeCard.name}
                </h3>
                <span className="text-[11px] text-slate-500">
                  Ajuste limite, dia de fechamento, vencimento ou conta de débito padrão
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="lg:col-span-2">
                  <label htmlFor="card-edit-name-input" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Nome do Cartão
                  </label>
                  <input
                    type="text"
                    id="card-edit-name-input"
                    value={editCardName}
                    onChange={(e) => setEditCardName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="card-edit-brand-select" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Bandeira
                  </label>
                  <select
                    id="card-edit-brand-select"
                    value={editCardBrand}
                    onChange={(e) =>
                      setEditCardBrand(e.target.value as 'Mastercard' | 'Visa' | 'Elo')
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                  >
                    <option value="Mastercard">Mastercard</option>
                    <option value="Visa">Visa</option>
                    <option value="Elo">Elo</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="card-edit-limit-input" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Limite Total (R$)
                  </label>
                  <input
                    type="text"
                    id="card-edit-limit-input"
                    value={editCardLimit}
                    onChange={(e) => setEditCardLimit(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="card-edit-closing-input" className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Dia Fecha
                    </label>
                    <input
                      type="number"
                      id="card-edit-closing-input"
                      min={1}
                      max={31}
                      value={editCardClosing}
                      onChange={(e) => setEditCardClosing(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="card-edit-due-input" className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Dia Vence
                    </label>
                    <input
                      type="number"
                      id="card-edit-due-input"
                      min={1}
                      max={31}
                      value={editCardDue}
                      onChange={(e) => setEditCardDue(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="card-edit-default-account-select" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Conta Padrão
                  </label>
                  <select
                    id="card-edit-default-account-select"
                    value={editCardAccount}
                    onChange={(e) => setEditCardAccount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingActiveCard(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          )}

          {/* Active Card KPI Strip (2x2 on Mobile, 4 Columns on Desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">
                Fatura {formatMonthYearPT(selectedMonth)}
              </p>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 truncate">
                {formatBRL(activeSummary.invoiceTotal)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 truncate">
                <span>Fecha {activeCard.closingDay}</span>
                <span aria-hidden="true"> · </span>
                <span>Vence {activeCard.dueDay}</span>
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">Status da Fatura</p>
              <p
                className={`mt-1.5 sm:mt-2 text-base sm:text-xl font-bold truncate ${
                  activeSummary.isInvoicePaid ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {activeSummary.isInvoicePaid
                  ? 'Fatura Quitada'
                  : activeSummary.invoiceTotal === 0
                  ? 'Sem Gastos'
                  : 'Em Aberto'}
              </p>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs font-mono tabular-nums text-slate-500 truncate">
            Resta: {formatBRL(activeSummary.invoicePendingAmount)}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
          <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">
            Limite Tomado Total
          </p>
          <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-rose-700 truncate">
            {formatBRL(activeSummary.usedLimit)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs font-mono tabular-nums text-slate-500 truncate">
            {activeSummary.usagePercent}% de {formatBRL(activeCard.limit)}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
          <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">Limite Disponível</p>
          <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 truncate">
            {formatBRL(activeSummary.availableLimit)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 truncate">
            Liberado ao pagar fatura
          </p>
        </div>
      </div>

      {/* Pay Invoice Bar + 6-Month Commitment */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Invoice Items Table */}
        <section className="lg:col-span-8 rounded-xl border border-slate-200 bg-white flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 px-4 sm:px-6 py-4">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Itens da Fatura — {activeCard.name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Competência {formatMonthYearPT(selectedMonth)}
                </p>
              </div>

              {activeSummary.invoicePendingAmount > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Conta para debitar pagamento da fatura"
                    value={paymentAccountId}
                    onChange={(e) => setPaymentAccountId(e.target.value)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        Debitar: {acc.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPartialPayPanel((prev) => !prev);
                      setPartialPayError('');
                      setPartialPayAmountStr(
                        (Math.round((activeSummary.invoicePendingAmount / 2) * 100) / 100)
                          .toFixed(2)
                          .replace('.', ',')
                      );
                    }}
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    {showPartialPayPanel ? 'Cancelar Parcial' : 'Pagar Parcial'}
                  </button>
                  <button
                    type="button"
                    data-testid="pay-full-invoice-btn"
                    onClick={() => onPayInvoice(activeCard.id, paymentAccountId)}
                    className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    Quitar Total ({formatBRL(activeSummary.invoicePendingAmount)})
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Fatura Quitada</span>
                  </div>
                  {cardInvoicePaymentsInMonth.length > 0 && (
                    <button
                      type="button"
                      data-testid="reverse-invoice-payment-btn"
                      onClick={() =>
                        onDeleteTransaction(cardInvoicePaymentsInMonth[0].id, false)
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Estornar Pagamento (Refazer Cascata)</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Recorded Invoice Payments Banner (Cascade Reversal Control) */}
            {cardInvoicePaymentsInMonth.length > 0 && (
              <div
                data-testid="invoice-payment-cascade-banner"
                className="border-b border-emerald-200 bg-emerald-50/70 px-4 sm:px-6 py-3 space-y-2"
              >
                {cardInvoicePaymentsInMonth.map((payTx) => (
                  <div
                    key={payTx.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 text-emerald-950">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>{payTx.description}</strong> — Pago em{' '}
                        <span className="font-mono tabular-nums">
                          {formatShortDateBR(payTx.date)}
                        </span>{' '}
                        via{' '}
                        <strong>
                          {accMap.get(payTx.accountId || '') || 'Conta Bancária'}
                        </strong>{' '}
                        (
                        <strong className="font-mono tabular-nums">
                          {formatBRL(payTx.amount)}
                        </strong>
                        )
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteTransaction(payTx.id, false)}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 transition-colors"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Apagar Pagamento e Reabrir Fatura (Cascata)</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Inline Partial Invoice Payment Panel (#4) */}
            {showPartialPayPanel && activeSummary.invoicePendingAmount > 0 && (
              <div
                data-testid="partial-invoice-payment-panel"
                className="border-b border-emerald-200 bg-emerald-50/70 px-4 sm:px-6 py-3.5 flex flex-wrap items-end justify-between gap-3"
              >
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-emerald-950">
                    Pagamento Parcial / Abatimento de Fatura — {activeCard.name}
                  </h3>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Informe o valor que deseja abater agora. O saldo restante continuará em aberto na fatura de {formatMonthYearPT(selectedMonth)}.
                  </p>
                  {partialPayError && (
                    <p role="alert" className="text-[11px] font-semibold text-rose-700 mt-1">
                      {partialPayError}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs font-mono font-bold text-emerald-900">R$</span>
                  <input
                    type="text"
                    value={partialPayAmountStr}
                    onChange={(e) => {
                      setPartialPayAmountStr(e.target.value);
                      setPartialPayError('');
                    }}
                    placeholder="Ex: 500,00"
                    className="w-28 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const customAmt = parseBRLInput(partialPayAmountStr);
                      if (customAmt <= 0) {
                        setPartialPayError('Informe um valor maior que zero.');
                        return;
                      }
                      if (customAmt > activeSummary.invoicePendingAmount) {
                        setPartialPayError('O valor não pode ultrapassar o saldo pendente da fatura.');
                        return;
                      }
                      onPayInvoice(activeCard.id, paymentAccountId, customAmt);
                      setShowPartialPayPanel(false);
                    }}
                    className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Confirmar Abatimento
                  </button>
                </div>
              </div>
            )}

            {/* Central de Antecipação de Parcelas com Desconto */}
            {anticipatingGroupId && (() => {
              const effectiveGroupId =
                anticipatingGroupId === '__empty__'
                  ? groupsWithFutureParcels[0]?.installmentGroupId || ''
                  : anticipatingGroupId;

              const futureInstallments = getFutureUnpaidInstallments(
                transactions,
                effectiveGroupId,
                selectedMonth
              );
              const selectedSlice =
                anticipationCountToAdvance > 0
                  ? futureInstallments.slice(0, anticipationCountToAdvance)
                  : futureInstallments;

              const futureSum =
                Math.round(
                  selectedSlice.reduce((acc, t) => acc + t.amount, 0) * 100
                ) / 100;
              const discountNum = Math.max(0, parseBRLInput(anticipationDiscountStr));
              const finalProjected = Math.max(0, futureSum - discountNum);
              const activeGroupMeta = activeInstallmentGroups.find(
                (g) => g.installmentGroupId === effectiveGroupId
              );
              const sampleTitle =
                activeGroupMeta?.title ||
                futureInstallments[0]?.description.replace(/\s*\(\d+\/\d+\)\s*$/, '') ||
                'Compra Parcelada';

              return (
                <div
                  data-testid="anticipate-installments-panel"
                  className="border-b border-violet-200 bg-violet-50/90 px-4 sm:px-6 py-4 space-y-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-violet-950 flex items-center gap-1.5">
                        <FastForward className="h-4 w-4 text-violet-700" />
                        Central de Antecipação de Parcelas — {activeCard.name}
                      </h3>
                      <p className="text-[11px] text-violet-800 mt-0.5">
                        Traga parcelas de meses futuros para a fatura atual ({formatMonthYearPT(selectedMonth)}) com ou sem desconto bancário e libere limite após quitar.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAnticipatingGroupId(null)}
                      className="text-xs font-semibold text-violet-700 hover:underline"
                    >
                      Fechar Painel
                    </button>
                  </div>

                  {groupsWithFutureParcels.length === 0 ? (
                    <div className="rounded-lg border border-violet-200 bg-white p-3.5 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Todas as compras parceladas deste cartão já estão no mês atual ou não possuem parcelas futuras pendentes.
                      </span>
                      {activeInstallmentGroups.some((g) => g.anticipatedCountInMonth > 0) &&
                        onReverseAnticipation && (
                          <button
                            type="button"
                            onClick={() => {
                              const g = activeInstallmentGroups.find(
                                (item) => item.anticipatedCountInMonth > 0
                              );
                              if (g) onReverseAnticipation(g.installmentGroupId);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Desfazer Antecipação Realizada</span>
                          </button>
                        )}
                    </div>
                  ) : (
                    <>
                      {/* 1. Select Which Installment Purchase to Advance */}
                      {groupsWithFutureParcels.length > 1 && (
                        <div>
                          <label className="block text-[11px] font-bold text-violet-950 mb-1.5">
                            1. Escolha a compra parcelada que deseja adiantar:
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {groupsWithFutureParcels.map((grp) => {
                              const isSelected = grp.installmentGroupId === effectiveGroupId;
                              return (
                                <button
                                  key={grp.installmentGroupId}
                                  type="button"
                                  onClick={() => {
                                    setAnticipatingGroupId(grp.installmentGroupId);
                                    setAnticipationCountToAdvance(0);
                                  }}
                                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    isSelected
                                      ? 'border-violet-700 bg-violet-700 text-white'
                                      : 'border-violet-200 bg-white text-violet-900 hover:bg-violet-100'
                                  }`}
                                >
                                  {grp.title} ({grp.futureInstallmentsCount}x futuras ·{' '}
                                  {formatBRL(grp.futureTotalAmount)})
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 2. Choose How Many Future Installments to Advance */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-white rounded-xl border border-violet-200 p-3.5">
                        <div className="sm:col-span-5">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                            Quantas parcelas futuras de &ldquo;{sampleTitle}&rdquo; adiantar?
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => setAnticipationCountToAdvance(0)}
                              className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                                anticipationCountToAdvance === 0
                                  ? 'border-violet-700 bg-violet-700 text-white'
                                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              Todas ({futureInstallments.length}x)
                            </button>
                            {futureInstallments.map((inst, idx) => {
                              const countVal = idx + 1;
                              if (countVal === futureInstallments.length) return null;
                              return (
                                <button
                                  key={inst.id}
                                  type="button"
                                  onClick={() => setAnticipationCountToAdvance(countVal)}
                                  className={`rounded-md border px-2.5 py-1 text-xs font-mono font-semibold ${
                                    anticipationCountToAdvance === countVal
                                      ? 'border-violet-700 bg-violet-700 text-white'
                                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  +{countVal}x
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="sm:col-span-4">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-bold text-slate-700">
                              Desconto do banco (R$):
                            </label>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setAnticipationDiscountStr('0,00')}
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-200"
                              >
                                R$ 0
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setAnticipationDiscountStr(
                                    (Math.round(futureSum * 2) / 100)
                                      .toFixed(2)
                                      .replace('.', ',')
                                  )
                                }
                                className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 hover:bg-violet-200"
                              >
                                2%
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setAnticipationDiscountStr(
                                    (Math.round(futureSum * 5) / 100)
                                      .toFixed(2)
                                      .replace('.', ',')
                                  )
                                }
                                className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 hover:bg-violet-200"
                              >
                                5%
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={anticipationDiscountStr}
                            onChange={(e) => setAnticipationDiscountStr(e.target.value)}
                            placeholder="0,00"
                            className="w-full rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 focus:border-violet-600 focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-3 flex flex-col justify-end">
                          <div className="text-[11px] font-mono tabular-nums text-slate-600 mb-1.5">
                            De {formatBRL(futureSum)} por{' '}
                            <strong className="font-bold text-emerald-700">
                              {formatBRL(finalProjected)}
                            </strong>
                          </div>
                          <button
                            type="button"
                            data-testid="confirm-anticipate-btn"
                            onClick={() => {
                              onAnticipateInstallments?.(
                                effectiveGroupId,
                                discountNum,
                                anticipationCountToAdvance > 0
                                  ? anticipationCountToAdvance
                                  : undefined
                              );
                              setAnticipatingGroupId(null);
                            }}
                            className="w-full rounded-lg bg-violet-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-violet-800 transition-colors"
                          >
                            Adiantar {selectedSlice.length}x Agora
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {activeSummary.transactions.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-semibold text-slate-900">
                  Nenhuma compra registrada para esta fatura.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Registre compras à vista ou parceladas para acompanhar o limite real do cartão.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Card List (< sm) */}
                <div className="block sm:hidden divide-y divide-slate-100">
                  {activeSummary.transactions.map((tx) => {
                    const futureRemaining = getFutureUnpaidInstallments(
                      transactions,
                      tx.installmentGroupId,
                      selectedMonth
                    );
                    const wasAnticipated =
                      tx.isAnticipated || tx.description.includes('(Antecipada)');
                    return (
                      <div key={tx.id} className="p-3.5 space-y-2 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {tx.description}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              {formatShortDateBR(tx.date)} · {catMap.get(tx.categoryId) || 'Geral'} ·{' '}
                              {tx.installmentTotal && tx.installmentTotal > 1
                                ? `${tx.installmentNumber}/${tx.installmentTotal}`
                                : tx.recurrence === 'fixed'
                                ? 'Assinatura'
                                : 'À vista'}
                            </p>
                          </div>
                          <div className="text-right shrink-0 font-mono tabular-nums">
                            <p className="text-sm font-bold text-slate-900">
                              {formatBRL(tx.amount)}
                            </p>
                            <span
                              className={`text-[10px] font-semibold ${
                                tx.status === 'paid' ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {tx.status === 'paid' ? 'Quitado' : 'Em Aberto'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-1.5">
                            {futureRemaining.length > 0 && onAnticipateInstallments && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAnticipatingGroupId(tx.installmentGroupId || null);
                                  setAnticipationCountToAdvance(0);
                                  setAnticipationDiscountStr('15,00');
                                }}
                                className="inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-800"
                              >
                                <FastForward className="h-3 w-3" />
                                <span>Adiantar ({futureRemaining.length})</span>
                              </button>
                            )}
                            {wasAnticipated && onReverseAnticipation && (
                              <button
                                type="button"
                                onClick={() => onReverseAnticipation(tx.id)}
                                className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-900"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Reverter Antecipação</span>
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onDeleteTransaction(tx.id, Boolean(tx.installmentGroupId))
                            }
                            aria-label={`Excluir compra ${tx.description}`}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table (>= sm) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/40 text-xs font-semibold text-slate-500">
                        <th className="py-3 pl-6 pr-3">Compra</th>
                        <th className="py-3 px-3">Descrição & Categoria</th>
                        <th className="py-3 px-3">Parcela</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Valor na Fatura</th>
                        <th className="py-3 pl-3 pr-6 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {activeSummary.transactions.map((tx) => {
                        const futureRemaining = getFutureUnpaidInstallments(
                          transactions,
                          tx.installmentGroupId,
                          selectedMonth
                        );
                        const wasAnticipated =
                          tx.isAnticipated || tx.description.includes('(Antecipada)');
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/80">
                            <td className="py-3 pl-6 pr-3 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                              {formatShortDateBR(tx.date)}
                            </td>
                            <td className="py-3 px-3">
                              <p className="font-semibold text-slate-900">{tx.description}</p>
                              <p className="text-xs text-slate-500">
                                {catMap.get(tx.categoryId) || 'Geral'}
                              </p>
                            </td>
                            <td className="py-3 px-3 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span>
                                  {tx.installmentTotal && tx.installmentTotal > 1
                                    ? `${tx.installmentNumber}/${tx.installmentTotal}`
                                    : tx.recurrence === 'fixed'
                                    ? 'Assinatura'
                                    : 'À vista'}
                                </span>
                                {futureRemaining.length > 0 && onAnticipateInstallments && (
                                  <button
                                    type="button"
                                    data-testid={`anticipate-btn-${tx.id}`}
                                    onClick={() => {
                                      setAnticipatingGroupId(tx.installmentGroupId || null);
                                      setAnticipationCountToAdvance(0);
                                      setAnticipationDiscountStr('15,00');
                                    }}
                                    title={`Adiantar ${futureRemaining.length} parcela(s) futura(s) com desconto`}
                                    className="inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-sans font-semibold text-violet-800 hover:bg-violet-100 transition-colors"
                                  >
                                    <FastForward className="h-3 w-3" />
                                    <span>Adiantar ({futureRemaining.length})</span>
                                  </button>
                                )}
                                {wasAnticipated && onReverseAnticipation && (
                                  <button
                                    type="button"
                                    data-testid={`reverse-anticipate-btn-${tx.id}`}
                                    onClick={() => onReverseAnticipation(tx.id)}
                                    title="Devolver parcela antecipada para o mês futuro original"
                                    className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-sans font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    <span>Desfazer Antecipação</span>
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-xs whitespace-nowrap">
                              <span
                                className={
                                  tx.status === 'paid'
                                    ? 'font-semibold text-emerald-700'
                                    : 'font-medium text-amber-700'
                                }
                              >
                                {tx.status === 'paid' ? 'Fatura Paga' : 'Em Aberto'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                              {formatBRL(tx.amount)}
                            </td>
                            <td className="py-3 pl-3 pr-6 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  onDeleteTransaction(tx.id, Boolean(tx.installmentGroupId))
                                }
                                aria-label={`Excluir compra ${tx.description}`}
                                className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="border-t border-slate-200 px-4 sm:px-6 py-3.5 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>Ao pagar a fatura, o valor é debitado da conta escolhida automaticamente.</span>
            <span className="font-mono tabular-nums font-bold text-slate-900">
              Total Fatura: {formatBRL(activeSummary.invoiceTotal)}
            </span>
          </div>
        </section>

        {/* Right: 6-Month Installment Projection */}
        <section className="lg:col-span-4 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-200 px-4 sm:px-6 py-4">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Projeção de Parcelas Futuras
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Comprometimento já contratado nos próximos 6 meses neste cartão
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {futureProjections.map((proj) => (
                <div
                  key={proj.month}
                  className="flex items-center justify-between px-4 sm:px-6 py-3.5"
                >
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-900">{proj.label}</p>
                    <p className="text-[11px] sm:text-xs text-slate-500">
                      <span>{proj.count} lançamento(s)</span>
                      <span aria-hidden="true"> · </span>
                      <span>{proj.isPaid ? 'Paga' : 'Prevista'}</span>
                    </p>
                  </div>
                  <p className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-900">
                    {formatBRL(proj.total)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 px-6 py-3.5 bg-slate-50/60 rounded-b-xl">
            <p className="text-xs text-slate-600">
              Dica: Compras parceladas reduzem o limite total disponível até a quitação de cada parcela mensal.
            </p>
          </div>
        </section>
      </div>
      </div>
      )}
    </div>
  );
};
