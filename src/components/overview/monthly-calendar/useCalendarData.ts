/** Lançamentos e faturas por data, estatísticas do mês, células do calendário e totais do dia selecionado. Parte de MonthlyCalendarView (ver MonthlyCalendarView.tsx). */
import { useMemo, useState } from 'react';
import { calculateCalendarDaySummary, calculateCreditCardSummary, formatMonthYearPT, getClampedMonthDate, getEffectiveExpenseAmountForUser, getInstallmentAndRecurringItemsForMonth, getLedgerTransactionsForMonth, isOutsidePersonalResult } from '../../../domain/finance/financeRules';
import { Transaction } from '../../../types/finance';
import { calculateCardCommitmentByMonth } from '../../../domain/cards/cardCommitment';
import { CardInvoiceDueItem, WEEKDAY_NAMES_FULL } from './monthlyCalendarConfig';
import type { MonthlyCalendarPropsApi } from './monthlyCalendarConfig';
import type { CalendarStateApi } from './useCalendarState';

export function useCalendarData(ctx: MonthlyCalendarPropsApi & CalendarStateApi) {
  const {
    accounts,
    cards,
    categories,
    monthNum,
    selectedMonth,
    transactions,
    yearNum,
  } = ctx;
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
  const commitment = useMemo(
    () => calculateCardCommitmentByMonth({ transactions, referenceMonth: selectedMonth, monthsBack: 0, monthsAhead: 0 })[0],
    [transactions, selectedMonth]
  );

  const monthStats = useMemo(() => {
    const monthTxs = getLedgerTransactionsForMonth(transactions, selectedMonth);

    let pendingBillsCount = 0;
    let pendingBillsAmount = 0;
    let totalIncome = 0;
    let totalExpense = 0;

    for (const tx of monthTxs) {
      if (tx.isInvoicePayment || tx.type === 'transfer' || isOutsidePersonalResult(tx)) continue;
      if (tx.type === 'income') {
        if (tx.sharedPaidBy === 'member') continue;
        totalIncome += tx.amount;
      } else if (tx.type === 'expense') {
        const expenseForSummary = tx.creditCardId && tx.installmentPurchaseTotal !== undefined
          ? { ...tx, amount: tx.installmentPurchaseTotal }
          : tx;
        const eff = getEffectiveExpenseAmountForUser(expenseForSummary);
        if (!eff) continue;
        totalExpense += eff.amount;

        // Contas bancárias a vencer no caixa (compras no cartão são somadas em Faturas de Cartão)
        if (eff.status === 'pending' && !tx.creditCardId && tx.sharedPaidBy !== 'member') {
          pendingBillsCount += 1;
          pendingBillsAmount += eff.amount;
        }
      }
    }

    const openInvoices = cardInvoicesDue.filter((inv) => !inv.isPaid && inv.amount > 0);
    const openInvoicesAmount = openInvoices.reduce((acc, inv) => acc + Math.round(inv.amount * 100), 0) / 100;

    return {
      pendingBillsCount,
      pendingBillsAmount: Math.round(pendingBillsAmount * 100) / 100,
      openInvoicesCount: openInvoices.length,
      openInvoicesAmount: Math.round(openInvoicesAmount * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
    };
  }, [transactions, selectedMonth, cardInvoicesDue]);

  // Parcelas e despesas fixas do mês (cartão ou banco), uma linha por cobrança.
  const [showRecurringList, setShowRecurringList] = useState(false);
  const recurringItems = useMemo(
    () => getInstallmentAndRecurringItemsForMonth(transactions, selectedMonth),
    [transactions, selectedMonth]
  );
  const recurringTotal = useMemo(
    () => recurringItems.reduce((sum, tx) => sum + Math.round((getEffectiveExpenseAmountForUser(tx)?.amount ?? (tx.type === 'income' ? tx.amount : 0)) * 100), 0) / 100,
    [recurringItems]
  );

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

  return {
    accMap,
    calendarCells,
    cardInvoicesByDate,
    cardMap,
    catMap,
    commitment,
    monthStats,
    recurringItems,
    recurringTotal,
    selectedDate,
    selectedDateInvoices,
    selectedDateTxs,
    selectedDayFullLabel,
    selectedDayTotals,
    setSelectedDate,
    setShowRecurringList,
    showRecurringList,
    todayStr,
    transactionsByDate,
  };
}

export type CalendarDataApi = ReturnType<typeof useCalendarData>;
