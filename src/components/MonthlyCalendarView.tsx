import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  CreditCard as CreditCardIcon,
  Edit3,
  Plus,
  Repeat,
  Trash2,
  Users,
} from 'lucide-react';
import {
  BankAccount,
  Category,
  CreditCard,
  Transaction,
} from '../types/finance';
import {
  calculateCalendarDaySummary,
  calculateCreditCardSummary,
  formatBRL,
  formatMonthYearPT,
  getClampedMonthDate,
  getLedgerTransactionsForMonth,
  getEffectiveExpenseAmountForUser,
} from '../utils/financeRules';
import { calculateWeeklyCashPulse } from '../utils/uxEnhancementRules';
import { CategoryIconBadge } from './CategoryIconBadge';
import { CardNetworkMark } from './CardNetworkMark';
import { InstitutionMark } from './InstitutionMark';

export type CalendarFilterType =
  | 'all'
  | 'pending'
  | 'cards'
  | 'recurring'
  | 'paid';

interface MonthlyCalendarViewProps {
  selectedMonth: string; // 'YYYY-MM'
  transactions: Transaction[];
  accounts: BankAccount[];
  cards: CreditCard[];
  categories: Category[];
  onToggleStatus: (txId: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (txId: string, deleteGroup?: boolean) => void;
  onOpenNewTransaction: (
    mode: 'expense' | 'income' | 'credit_card' | 'transfer',
    initialDate?: string
  ) => void;
}

interface CardInvoiceDueItem {
  id: string;
  cardId: string;
  cardName: string;
  cardBrand: CreditCard['brand'];
  amount: number;
  isPaid: boolean;
  closingDay: number;
  dueDay: number;
  dueDate: string;
}

const WEEKDAY_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAY_NAMES_FULL = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

export const MonthlyCalendarView: React.FC<MonthlyCalendarViewProps> = ({
  selectedMonth,
  transactions,
  accounts,
  cards,
  categories,
  onToggleStatus,
  onEditTransaction,
  onDeleteTransaction,
  onOpenNewTransaction,
}) => {
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilterType>('all');

  // Parse year and month
  const [yearNum, monthNum] = useMemo(
    () => selectedMonth.split('-').map(Number),
    [selectedMonth]
  );

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c.name])), [cards]);

  // Credit card invoices due in selectedMonth
  const cardInvoicesDue = useMemo<CardInvoiceDueItem[]>(() => {
    return cards.map((card) => {
      const summary = calculateCreditCardSummary(card, transactions, selectedMonth);
      const dueDate = getClampedMonthDate(selectedMonth, card.dueDay);
      return {
        id: `invoice-${card.id}-${selectedMonth}`,
        cardId: card.id,
        cardName: card.name,
        cardBrand: card.brand,
        amount: summary.invoiceTotal,
        isPaid: summary.isInvoicePaid,
        closingDay: card.closingDay,
        dueDay: card.dueDay,
        dueDate,
      };
    });
  }, [cards, transactions, selectedMonth]);

  // Map of card invoices by date (e.g. '2026-10-10' -> [invoice])
  const cardInvoicesByDate = useMemo(() => {
    const map = new Map<string, CardInvoiceDueItem[]>();
    for (const inv of cardInvoicesDue) {
      if (!map.has(inv.dueDate)) {
        map.set(inv.dueDate, []);
      }
      map.get(inv.dueDate)!.push(inv);
    }
    return map;
  }, [cardInvoicesDue]);

  // Transactions mapped by date (YYYY-MM-DD)
  const transactionsByDate = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    const months = new Set(
      transactions.flatMap((tx) => [
        tx.date.slice(0, 7),
        ...(tx.originalDateBeforeAnticipation
          ? [tx.originalDateBeforeAnticipation.slice(0, 7)]
          : []),
      ])
    );
    const calendarTransactions = Array.from(months).flatMap((month) =>
      getLedgerTransactionsForMonth(transactions, month)
    );
    for (const tx of calendarTransactions) {
      // Group by date
      if (!map.has(tx.date)) {
        map.set(tx.date, []);
      }
      map.get(tx.date)!.push(tx);
    }
    return map;
  }, [transactions]);

  // Summary counts for this month
  const monthStats = useMemo(() => {
    const monthTxs = getLedgerTransactionsForMonth(transactions, selectedMonth);

    let pendingBillsCount = 0;
    let pendingBillsAmount = 0;
    let recurringCount = 0;
    let totalIncome = 0;
    let totalExpense = 0;

    for (const tx of monthTxs) {
      if (tx.isInvoicePayment || tx.type === 'transfer' || tx.isCompanionOnlyExpense) continue;
      if (tx.type === 'income') {
        if (tx.sharedPaidBy === 'member') continue;
        totalIncome += tx.amount;
      } else if (tx.type === 'expense') {
        const eff = getEffectiveExpenseAmountForUser(tx);
        if (!eff) continue;
        totalExpense += eff.amount;

        // Contas bancárias a vencer no caixa (compras no cartão são somadas em Faturas de Cartão)
        if (eff.status === 'pending' && !tx.creditCardId && tx.sharedPaidBy !== 'member') {
          pendingBillsCount += 1;
          pendingBillsAmount += eff.amount;
        }
      }

      if (tx.recurrence === 'installment' || tx.recurrence === 'fixed') {
        recurringCount += 1;
      }
    }

    const openInvoices = cardInvoicesDue.filter((inv) => !inv.isPaid && inv.amount > 0);
    const openInvoicesAmount = openInvoices.reduce((acc, inv) => acc + inv.amount, 0);

    return {
      pendingBillsCount,
      pendingBillsAmount: Math.round(pendingBillsAmount * 100) / 100,
      openInvoicesCount: openInvoices.length,
      openInvoicesAmount: Math.round(openInvoicesAmount * 100) / 100,
      recurringCount,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
    };
  }, [transactions, selectedMonth, cardInvoicesDue]);

  // Initial active day selection: look for earliest pending bill in month or day 15 or day 01
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Check if there is an urgent pending bill in the selected month
    const pendingInMonth = getLedgerTransactionsForMonth(transactions, selectedMonth)
      .filter((t) => t.status === 'pending')
      .sort((a, b) => a.date.localeCompare(b.date));
    if (pendingInMonth.length > 0) {
      return pendingInMonth[0].date;
    }
    return `${selectedMonth}-01`;
  });

  // Calculate calendar grid cells
  const calendarCells = useMemo(() => {
    const totalDaysInCurrentMonth = new Date(yearNum, monthNum, 0).getDate();
    const firstDayOfWeek = new Date(yearNum, monthNum - 1, 1).getDay(); // 0 is Sunday
    const prevMonthDays = new Date(yearNum, monthNum - 1, 0).getDate();

    const prevMonthStr = new Date(Date.UTC(yearNum, monthNum - 2, 1))
      .toISOString()
      .slice(0, 7);
    const nextMonthStr = new Date(Date.UTC(yearNum, monthNum, 1))
      .toISOString()
      .slice(0, 7);

    interface DayCell {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      weekdayIndex: number;
    }

    const cells: DayCell[] = [];

    // Leading days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const dateStr = `${prevMonthStr}-${String(d).padStart(2, '0')}`;
      const weekdayIndex = new Date(yearNum, monthNum - 2, d).getDay();
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        weekdayIndex,
      });
    }

    // Days of current month
    for (let d = 1; d <= totalDaysInCurrentMonth; d++) {
      const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      const weekdayIndex = new Date(yearNum, monthNum - 1, d).getDay();
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        weekdayIndex,
      });
    }

    // Trailing days to complete multiple of 7
    const remainingSlots = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remainingSlots; d++) {
      const dateStr = `${nextMonthStr}-${String(d).padStart(2, '0')}`;
      const weekdayIndex = new Date(yearNum, monthNum, d).getDay();
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        weekdayIndex,
      });
    }

    return cells;
  }, [yearNum, monthNum, selectedMonth]);

  // Selected date details
  const selectedDateTxs = useMemo(() => {
    return (transactionsByDate.get(selectedDate) || []).slice().sort((a, b) => {
      // Pending first, then by amount
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
      return b.amount - a.amount;
    });
  }, [transactionsByDate, selectedDate]);

  const selectedDateInvoices = useMemo(() => {
    return cardInvoicesByDate.get(selectedDate) || [];
  }, [cardInvoicesByDate, selectedDate]);

  const selectedDayFullLabel = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    if (!y || !m || !d) return selectedDate;
    const dateObj = new Date(y, m - 1, d);
    const weekday = WEEKDAY_NAMES_FULL[dateObj.getDay()];
    return `${d} de ${formatMonthYearPT(`${y}-${String(m).padStart(2, '0')}`)} — ${weekday}`;
  }, [selectedDate]);

  const selectedDayTotals = useMemo(() => {
    return calculateCalendarDaySummary(selectedDateTxs.filter((tx) => !tx.creditCardId));
  }, [selectedDateTxs]);

  // Today string for comparison (in Brazil timezone/standard)
  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
  }, []);

  return (
    <div className="space-y-6">
      {/* Visual KPI Strip: Calendar Insights & Pending Due Dates */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Contas a Vencer no Mês */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">
              Contas a Vencer (Pendentes)
            </span>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-xl font-bold tabular-nums text-amber-950 font-display">
            {formatBRL(monthStats.pendingBillsAmount)}
          </div>
          <p className="mt-1 text-xs text-amber-700">
            {monthStats.pendingBillsCount}{' '}
            {monthStats.pendingBillsCount === 1 ? 'conta aguarda' : 'contas aguardam'}{' '}
            baixa no caixa
          </p>
        </div>

        {/* KPI 2: Faturas de Cartão */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Faturas de Cartão no Mês
            </span>
            <CreditCardIcon className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-2 text-xl font-bold tabular-nums text-slate-900 font-display">
            {formatBRL(monthStats.openInvoicesAmount)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {monthStats.openInvoicesCount > 0
              ? `${monthStats.openInvoicesCount} fatura(s) aberta(s) no período`
              : 'Todas as faturas pagas ou zeradas'}
          </p>
        </div>

        {/* KPI 3: Parcelamentos & Custos Fixos */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Parcelados & Recorrentes
            </span>
            <Repeat className="h-4 w-4 text-violet-600" />
          </div>
          <div className="mt-2 text-xl font-bold tabular-nums text-slate-900 font-display">
            {monthStats.recurringCount} itens
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Parcelas ativas e despesas fixas recorrentes
          </p>
        </div>

        {/* KPI 4: Despesas Totais Previstas */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Despesas nas Datas do Mês
            </span>
            <ArrowDownRight className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 text-xl font-bold tabular-nums text-rose-700 font-display">
            {formatBRL(monthStats.totalExpense)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Receitas: {formatBRL(monthStats.totalIncome)}
          </p>
        </div>
      </section>

      {/* Suggestion #5: Weekly Cash Pulse (Pulso Semanal do Mês — Mapa de Calor Semanal) */}
      <section
        data-testid="weekly-cash-pulse-strip"
        className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-900">
              Compras por Semana
            </h3>
            <p className="text-[11px] text-slate-500">
              Valor total das compras na semana da compra, contado uma vez. Orçamento e faturas continuam por parcela.
            </p>
          </div>
          <span className="text-[11px] font-mono tabular-nums text-slate-500">
            5 blocos semanais
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {calculateWeeklyCashPulse(transactions, selectedMonth).map((week) => {
            const selectedDayNum = Number(selectedDate.slice(8, 10));
            const isWeekActive =
              selectedDayNum >= week.startDay && selectedDayNum <= week.endDay;

            return (
              <button
                key={week.weekIndex}
                type="button"
                data-testid={`weekly-pulse-card-${week.weekIndex}`}
                onClick={() => setSelectedDate(week.firstDate)}
                className={`rounded-xl border p-3 text-left transition-all flex flex-col justify-between gap-2 ${
                  isWeekActive
                    ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600/20'
                    : week.isPeakExpenseWeek
                    ? 'border-rose-200 bg-rose-50/40 hover:border-rose-300'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-slate-900">{week.label}</span>
                  {week.isPeakExpenseWeek && (
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-800 shrink-0">
                      Pico Saídas
                    </span>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                  {week.rangeLabel} · {week.txCount} mov.
                </div>

                <div className="pt-1 border-t border-slate-200/70 flex items-center justify-between text-[11px] font-mono tabular-nums">
                  <span className="text-rose-700 font-bold">
                    -{formatBRL(week.expense)}
                  </span>
                  {week.pendingCount > 0 && (
                    <span className="text-[10px] font-semibold text-amber-700">
                      {week.pendingCount} pend.
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Calendar Filter Toolbar & Legend */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setCalendarFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                calendarFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos os Itens
            </button>
            <button
              type="button"
              onClick={() => setCalendarFilter('pending')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                calendarFilter === 'pending'
                  ? 'bg-amber-100 text-amber-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚠️ Pendências & A Vencer
            </button>
            <button
              type="button"
              onClick={() => setCalendarFilter('cards')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                calendarFilter === 'cards'
                  ? 'bg-violet-100 text-violet-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              💳 Faturas de Cartão
            </button>
            <button
              type="button"
              onClick={() => setCalendarFilter('recurring')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                calendarFilter === 'recurring'
                  ? 'bg-blue-100 text-blue-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🔁 Parcelados & Fixos
            </button>
            <button
              type="button"
              onClick={() => setCalendarFilter('paid')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                calendarFilter === 'paid'
                  ? 'bg-emerald-100 text-emerald-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ✅ Pagos & Efetivados
            </button>
          </div>

          {/* Quick Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
              Conta a Vencer
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-600" />
              Fatura de Cartão
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
              Parcelado / Recorrente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Pago / Recebido
            </span>
          </div>
        </div>
      </section>

      {/* The Monthly Calendar Grid */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Day-of-Week Table Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100/80 text-center text-xs font-bold text-slate-700">
          {WEEKDAY_HEADERS.map((h, i) => (
            <div
              key={h}
              className={`py-2.5 border-r border-slate-200 last:border-r-0 ${
                i === 0 || i === 6 ? 'bg-slate-200/40 text-slate-600' : ''
              }`}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Calendar Matrix Rows */}
        <div className="grid grid-cols-7 divide-y divide-slate-200 auto-rows-fr">
          {calendarCells.map((cell) => {
            const isSelected = cell.dateStr === selectedDate;
            const isToday = cell.dateStr === todayStr;

            // Raw items for this cell
            const allDayTxs = transactionsByDate.get(cell.dateStr) || [];
            const allDayInvoices = cardInvoicesByDate.get(cell.dateStr) || [];

            // Apply active calendar filter
            const filteredTxs = allDayTxs.filter((tx) => {
              if (calendarFilter === 'pending') return tx.status === 'pending';
              if (calendarFilter === 'cards') return Boolean(tx.creditCardId);
              if (calendarFilter === 'recurring')
                return tx.recurrence === 'installment' || tx.recurrence === 'fixed';
              if (calendarFilter === 'paid') return tx.status === 'paid';
              return true;
            });

            const filteredInvoices = allDayInvoices.filter((inv) => {
              if (calendarFilter === 'pending') return !inv.isPaid && inv.amount > 0;
              if (calendarFilter === 'cards') return true;
              if (calendarFilter === 'recurring') return false;
              if (calendarFilter === 'paid') return inv.isPaid;
              return true;
            });

            const hasPendingBills = allDayTxs.some(
              (tx) => tx.status === 'pending' && tx.type === 'expense'
            );
            const hasOpenInvoice = allDayInvoices.some(
              (inv) => !inv.isPaid && inv.amount > 0
            );

            // Day sum
            let dayExpenses = 0;
            let dayIncomes = 0;
            for (const tx of allDayTxs) {
              if (tx.isInvoicePayment || tx.type === 'transfer' || tx.creditCardId) continue;
              if (tx.type === 'expense') dayExpenses += tx.amount;
              else if (tx.type === 'income') dayIncomes += tx.amount;
            }

            // Visible items limit in cell
            const totalItemsCount = filteredInvoices.length + filteredTxs.length;
            const visibleInvoices = filteredInvoices.slice(0, 2);
            const remainingForTxs = Math.max(0, 3 - visibleInvoices.length);
            const visibleTxs = filteredTxs.slice(0, remainingForTxs);
            const hiddenCount = totalItemsCount - (visibleInvoices.length + visibleTxs.length);

            return (
              <div
                key={cell.dateStr}
                onClick={() => setSelectedDate(cell.dateStr)}
                className={`min-h-[90px] sm:min-h-[115px] min-w-0 overflow-hidden p-1 sm:p-2 border-r border-slate-200 last:border-r-0 flex flex-col justify-between transition-colors cursor-pointer group ${
                  !cell.isCurrentMonth
                    ? 'bg-slate-50/60 text-slate-400 opacity-60'
                    : isSelected
                    ? 'bg-emerald-50/40 ring-2 ring-emerald-500 ring-inset z-10'
                    : hasPendingBills || hasOpenInvoice
                    ? 'bg-amber-50/20 hover:bg-slate-50'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                {/* Cell Header: Day Number + Daily Balance + Quick Add Button */}
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span
                        className={`inline-flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-[11px] sm:text-xs font-bold tabular-nums ${
                          isToday
                            ? 'bg-emerald-600 text-white'
                            : isSelected
                            ? 'bg-slate-900 text-white'
                            : cell.isCurrentMonth
                            ? 'text-slate-800'
                            : 'text-slate-400'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                      {hasPendingBills && (
                        <span
                          title="Conta pendente a vencer neste dia"
                          className="h-2 w-2 shrink-0 rounded-full bg-amber-500 ring-1 ring-white"
                        />
                      )}
                      {hasOpenInvoice && (
                        <span
                          title="Vencimento de fatura de cartão em aberto"
                          className="h-2 w-2 shrink-0 rounded-full bg-violet-600 ring-1 ring-white"
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Daily Net Pill if current month */}
                      {cell.isCurrentMonth && (dayExpenses > 0 || dayIncomes > 0) && (
                        <span
                          className={`hidden xl:inline-block text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded ${
                            dayExpenses > 0
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {dayExpenses > 0 ? `-${formatBRL(dayExpenses)}` : `+${formatBRL(dayIncomes)}`}
                        </span>
                      )}

                      {/* Quick + Button on Hover */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDate(cell.dateStr);
                          onOpenNewTransaction('expense', cell.dateStr);
                        }}
                        title={`Lançar despesa ou receita em ${cell.dateStr}`}
                        aria-label={`Lançar em ${cell.dateStr}`}
                        className="hidden sm:inline-flex opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-opacity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Day Content Badges */}
                  <div className="mt-1.5 space-y-1 min-w-0">
                    {/* Credit Card Invoices Due on this Day */}
                    {visibleInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className={`truncate rounded px-1 sm:px-1.5 py-0.5 text-[10px] font-semibold flex items-center justify-between border min-w-0 ${
                          inv.isPaid
                            ? 'bg-slate-100 border-slate-200 text-slate-600 line-through'
                            : 'bg-violet-50 border-violet-200 text-violet-900 font-bold'
                        }`}
                        title={`Fatura ${inv.cardName}: ${formatBRL(inv.amount)} (${
                          inv.isPaid ? 'Paga' : 'Vencimento da Fatura'
                        })`}
                      >
                        <span className="truncate flex items-center gap-1 min-w-0">
                          <CardNetworkMark brand={inv.cardBrand} compact />
                          <span className="truncate">Fat. {inv.cardName}</span>
                        </span>
                        <span className="hidden md:inline tabular-nums shrink-0 ml-1">
                          {formatBRL(inv.amount)}
                        </span>
                      </div>
                    ))}

                    {/* Transactions Due / Realized on this Day */}
                    {visibleTxs.map((tx) => {
                      const isPending = tx.status === 'pending';
                      const isExpense = tx.type === 'expense';
                      const isIncome = tx.type === 'income';
                      const isRecurring =
                        tx.recurrence === 'installment' || tx.recurrence === 'fixed';

                      return (
                        <div
                          key={tx.id}
                          className={`rounded px-1 sm:px-1.5 py-0.5 text-[10px] flex flex-wrap items-center justify-between border min-w-0 ${
                            isPending && isExpense
                              ? 'bg-amber-50/90 border-amber-300 text-amber-950 font-bold'
                              : isIncome
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-medium'
                              : isExpense && tx.creditCardId
                              ? 'bg-slate-50 border-slate-200 text-slate-700'
                              : 'bg-slate-100 border-slate-200 text-slate-700'
                          }`}
                          title={`${tx.description} — ${formatBRL(tx.amount)} (${
                            isPending ? 'Pendente a pagar' : 'Pago/Recebido'
                          })${
                            tx.installmentNumber
                              ? ` - Parcela ${tx.installmentNumber}/${tx.installmentTotal}`
                              : ''
                          }${
                            tx.installmentPurchaseTotal !== undefined
                              ? ` — Compra total ${formatBRL(tx.installmentPurchaseTotal)}`
                              : ''
                          }`}
                        >
                          {tx.installmentPurchaseTotal !== undefined && (
                            <span className="w-full text-violet-800 font-bold tabular-nums break-words">
                              {formatBRL(tx.installmentPurchaseTotal)} em {tx.installmentTotal}x
                              <span className="block font-normal">Parcela {tx.installmentNumber}/{tx.installmentTotal}: {formatBRL(tx.amount)}</span>
                            </span>
                          )}
                          <span className="truncate flex items-center gap-1 min-w-0">
                            {isPending && isExpense ? (
                              <Clock className="h-2.5 w-2.5 text-amber-600 shrink-0" />
                            ) : isIncome ? (
                              <ArrowUpRight className="h-2.5 w-2.5 text-emerald-600 shrink-0" />
                            ) : isRecurring ? (
                              <Repeat className="h-2.5 w-2.5 text-violet-600 shrink-0" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                            )}
                            <span className="truncate">{tx.description}</span>
                          </span>

                          <span className={`${tx.installmentPurchaseTotal !== undefined ? 'hidden' : 'hidden md:inline'} tabular-nums shrink-0 ml-1 font-semibold`}>
                            {isIncome ? '+' : '-'}
                            {formatBRL(tx.amount)}
                          </span>
                        </div>
                      );
                    })}

                    {hiddenCount > 0 && (
                      <div className="text-[10px] font-bold text-slate-500 hover:text-slate-800 text-center py-0.5">
                        +{hiddenCount} mais...
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer status dot indicator for compact screens */}
                <div className="mt-1 flex items-center gap-1 justify-end">
                  {filteredTxs.length > 0 && (
                    <span className="text-[9px] text-slate-400 font-medium">
                      {filteredTxs.length} {filteredTxs.length === 1 ? 'item' : 'itens'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Selected Day Inspector Panel */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
              <h3 className="text-base font-bold text-slate-900 font-display">
                Detalhamento do Dia: {selectedDayFullLabel}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualize vencimentos, faturas, efetive baixas ou edite lançamentos previstos para esta data
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenNewTransaction('expense', selectedDate)}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              + Despesa neste Dia
            </button>
            <button
              type="button"
              onClick={() => onOpenNewTransaction('income', selectedDate)}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              + Receita
            </button>
          </div>
        </div>

        {/* Selected Day Summary Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 rounded-lg p-3">
          <div>
            <span className="text-[11px] font-semibold text-slate-500">
              A Pagar / Pendente
            </span>
            <div className="text-sm font-bold tabular-nums text-amber-700">
              {formatBRL(selectedDayTotals.pendingExpense)}
            </div>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500">
              Pago / Efetivado
            </span>
            <div className="text-sm font-bold tabular-nums text-slate-700">
              {formatBRL(selectedDayTotals.paidExpense)}
            </div>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500">
              Receitas do Dia
            </span>
            <div className="text-sm font-bold tabular-nums text-emerald-700">
              +{formatBRL(selectedDayTotals.income)}
            </div>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500">
              Saldo Previsto do Dia
            </span>
            <div
              className={`text-sm font-bold tabular-nums ${
                selectedDayTotals.dayBalance >= 0
                  ? 'text-emerald-700'
                  : 'text-rose-700'
              }`}
            >
              {selectedDayTotals.dayBalance >= 0 ? '+' : ''}
              {formatBRL(selectedDayTotals.dayBalance)}
            </div>
          </div>
        </div>

        {/* Credit Card Invoices Due on this Day */}
        {selectedDateInvoices.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCardIcon className="h-3.5 w-3.5 text-violet-600" />
              Vencimento de Fatura de Cartão de Crédito
            </h4>
            <p className="text-[11px] text-slate-500">
              A fatura fica separada das compras lançadas; o pagamento aparece na data em que saiu da conta.
            </p>
            <div className="space-y-2">
              {selectedDateInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className={`rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    inv.isPaid
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-violet-200 bg-violet-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700">
                      <CardNetworkMark brand={inv.cardBrand} compact />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 font-display">
                          Fatura {inv.cardName}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          ({inv.cardBrand} · Fecha dia {inv.closingDay} · Vence dia {inv.dueDate.slice(-2)}{Number(inv.dueDate.slice(-2)) !== inv.dueDay ? ` (padrão ${inv.dueDay})` : ''})
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        {inv.isPaid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Fatura paga e liquidada da conta
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-violet-800 font-semibold">
                            <Clock className="h-3.5 w-3.5" />
                            Fatura aguardando pagamento
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-base font-bold tabular-nums text-slate-900 font-display">
                        {formatBRL(inv.amount)}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Total da Fatura
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transactions list on this Day */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            Lançamentos e Vencimentos Agendados ({selectedDateTxs.length})
          </h4>

          {selectedDateTxs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              Nenhum lançamento agendado para o dia {selectedDate}.
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => onOpenNewTransaction('expense', selectedDate)}
                  className="text-emerald-700 font-semibold hover:underline"
                >
                  Clique aqui para agendar uma conta ou receita neste dia.
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white overflow-hidden">
              {selectedDateTxs.map((tx) => {
                const cat = catMap.get(tx.categoryId);
                const subName = cat?.subcategories?.find(
                  (s) => s.id === tx.subcategoryId
                )?.name;
                const isExpense = tx.type === 'expense';
                const isIncome = tx.type === 'income';
                const isPending = tx.status === 'pending';

                return (
                  <div
                    key={tx.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <CategoryIconBadge
                        icon={cat?.icon}
                        color={cat?.color}
                        size="md"
                      />

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {tx.description}
                          </span>

                          {/* Recurrence Badge */}
                          {tx.recurrence === 'installment' && tx.installmentNumber && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 border border-violet-200">
                              <Repeat className="h-2.5 w-2.5" />
                              Parcela {tx.installmentNumber}/{tx.installmentTotal}
                            </span>
                          )}
                          {tx.installmentPurchaseTotal !== undefined && (
                            <span className="text-xs font-medium text-violet-700">
                              Compra total {formatBRL(tx.installmentPurchaseTotal)}
                            </span>
                          )}

                          {tx.recurrence === 'fixed' && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                              <Repeat className="h-2.5 w-2.5" />
                              Despesa Fixa
                            </span>
                          )}

                          {tx.isShared && tx.sharedAmount && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200">
                              <Users className="h-2.5 w-2.5" />
                              Compartilhado (A receber {formatBRL(tx.sharedAmount)})
                            </span>
                          )}

                          {/* Status Badge */}
                          {isPending ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                              <Clock className="h-2.5 w-2.5" />
                              Pendente / A Vencer
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                              <Check className="h-2.5 w-2.5" />
                              Efetivado / Pago
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>
                            {cat?.name || 'Sem categoria'}
                            {subName ? ` › ${subName}` : ''}
                          </span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1.5">
                            {tx.creditCardId ? (
                              <CardNetworkMark brand={cards.find((card) => card.id === tx.creditCardId)?.brand || 'Visa'} compact />
                            ) : tx.accountId ? (
                              <InstitutionMark
                                institution={accounts.find((account) => account.id === tx.accountId)?.institution}
                                accountName={accMap.get(tx.accountId)}
                                color={accounts.find((account) => account.id === tx.accountId)?.color}
                                size="xs"
                              />
                            ) : null}
                            <span>
                              {tx.creditCardId
                                ? `Cartão ${cardMap.get(tx.creditCardId)}`
                                : tx.accountId
                                ? accMap.get(tx.accountId)
                                : 'Caixa Geral'}
                            </span>
                          </span>
                          {tx.notes && (
                            <>
                              <span>•</span>
                              <span className="italic">{tx.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="text-right">
                        <div
                          className={`text-base font-bold tabular-nums font-display ${
                            isIncome
                              ? 'text-emerald-700'
                              : isPending
                              ? 'text-amber-900'
                              : 'text-slate-900'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {formatBRL(tx.installmentPurchaseTotal ?? tx.amount)}
                        </div>
                        {tx.installmentPurchaseTotal !== undefined && (
                          <div className="text-xs font-medium text-slate-600">
                            Em {tx.installmentTotal}x · parcela {tx.installmentNumber}/{tx.installmentTotal}: {formatBRL(tx.amount)}
                          </div>
                        )}
                        <span className="text-[11px] text-slate-400 capitalize">
                          {tx.paymentMethod === 'pix'
                            ? 'PIX'
                            : tx.paymentMethod === 'boleto'
                            ? 'Boleto'
                            : tx.paymentMethod === 'credit_card'
                            ? 'Cartão'
                            : tx.paymentMethod}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onToggleStatus(tx.id)}
                          title={
                            isPending
                              ? 'Efetivar / Marcar como Pago'
                              : 'Reabrir / Marcar como Pendente'
                          }
                          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                            isPending
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {isPending ? 'Efetivar' : 'Pago'}
                        </button>

                        <button
                          type="button"
                          onClick={() => onEditTransaction(tx)}
                          aria-label={`Editar ${tx.description}`}
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteTransaction(tx.id)}
                          aria-label={`Excluir ${tx.description}`}
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
