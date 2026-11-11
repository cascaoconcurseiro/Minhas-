import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type {
  BankAccount,
  Category,
  CreditCard,
  MonthlyFinancialSummary,
  Transaction,
} from '../types/finance';
import {
  calculateAccountBalances,
  calculateCategoryBreakdown,
  calculateCreditCardSummary,
  calculateMonthlySummary,
} from '../utils/financeRules';
import { OverviewTab } from './OverviewTab';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const zeroSummary: MonthlyFinancialSummary = {
  month: '2026-11',
  totalCurrentBalance: 0,
  totalProjectedBalance: 0,
  incomeRealized: 0,
  incomePending: 0,
  incomeTotal: 0,
  expenseRealized: 0,
  expensePending: 0,
  expenseTotal: 0,
  creditCardMonthTotal: 0,
  netResultProjected: 0,
  netResultRealized: 0,
  savingsRateProjected: 0,
};

type OverviewNavTab =
  | 'overview'
  | 'accounts'
  | 'investments'
  | 'transactions'
  | 'cards'
  | 'budgets'
  | 'goals'
  | 'trips'
  | 'reports'
  | 'cloud';

type OverviewTabProps = React.ComponentProps<typeof OverviewTab>;

test('overview does not expose technical audit controls to the user', () => {
  const page = renderOverviewTab();
  assert.doesNotMatch(page.textContent ?? '', /Auditoria Contábil Completa/);
});

function renderOverviewTab(
  onNavigateTab: (tab: OverviewNavTab) => void = () => {},
  overrides: Partial<OverviewTabProps> = {}
) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      React.createElement(OverviewTab, {
        selectedMonth: '2026-11',
        monthlySummary: zeroSummary,
        accounts: [],
        accountBalances: [],
        cards: [],
        cardSummaries: [],
        categories: [],
        categoryBreakdown: [],
        transactions: [],
        investments: [],
        onToggleStatus: () => {},
        onToggleAccountInTotal: () => {},
        onOpenNewTransaction: () => {},
        onNavigateTab,
        ...overrides,
      })
    );
  });
  return container;
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('OverviewTab renders honest zero-state metrics without demo records', () => {
  const page = renderOverviewTab();
  const text = page.textContent ?? '';

  assert.match(text, /Visão Geral|Boa tarde|Bom dia|Boa noite/);
  assert.match(text, /Sem pendências bancárias em Novembro de 2026/);
  assert.match(text, /Saldo em Contas \(Hoje\)/);
  assert.match(text, /Previsto Fim do Mês/);
  assert.match(text, /Receitas do Mês/);
  assert.match(text, /Despesas Totais/);
  assert.ok((text.match(/R\$\s*0,00/g) ?? []).length >= 4);
  assert.doesNotMatch(text, /Nubank|tx-demo|demo-|mock-/i);
});

test('OverviewTab navigates to reports from its dashboard action', async () => {
  const navigatedTabs: string[] = [];
  const page = renderOverviewTab((tab) => { navigatedTabs.push(tab); });
  const reportsButton = [...page.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Ver gráficos & relatórios')
  );
  assert.ok(reportsButton);

  await act(async () => { reportsButton.click(); });
  assert.deepEqual(navigatedTabs, ['reports']);
});

test('OverviewTab pending and paid bill controls route status changes for the selected transaction', async () => {
  const toggledIds: string[] = [];
  const transactions: Transaction[] = [
    {
      id: 'bill-pending-synthetic',
      description: 'Conta pendente sintética',
      amount: 42.5,
      date: '2026-11-12',
      competenceMonth: '2026-11',
      type: 'expense',
      status: 'pending',
      categoryId: 'category-synthetic',
      accountId: 'account-synthetic',
      paymentMethod: 'boleto',
      recurrence: 'single',
    },
    {
      id: 'bill-paid-synthetic',
      description: 'Conta paga sintética',
      amount: 58.25,
      date: '2026-11-08',
      competenceMonth: '2026-11',
      type: 'expense',
      status: 'paid',
      categoryId: 'category-synthetic',
      accountId: 'account-synthetic',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
  ];
  const page = renderOverviewTab(() => {}, {
    transactions,
    onToggleStatus: (id) => toggledIds.push(id),
  });

  const markPaid = page.querySelector<HTMLButtonElement>(
    'button[aria-label="Efetivar Conta pendente sintética"]'
  );
  assert.ok(markPaid);
  await act(async () => { markPaid.click(); });
  assert.deepEqual(toggledIds, ['bill-pending-synthetic']);

  const paidTab = [...page.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Efetivados (1)')
  );
  assert.ok(paidTab);
  await act(async () => { paidTab.click(); });

  const revert = page.querySelector<HTMLButtonElement>(
    'button[aria-label="Reverter Conta paga sintética para pendente"]'
  );
  assert.ok(revert);
  await act(async () => { revert.click(); });
  assert.deepEqual(toggledIds, ['bill-pending-synthetic', 'bill-paid-synthetic']);
});

test('OverviewTab keeps cash-flow and card totals consistent for pending month data', () => {
  const account: BankAccount = {
    id: 'account-synthetic',
    name: 'Conta de teste',
    institution: 'Banco sintético',
    type: 'checking',
    initialBalance: 2000,
    currency: 'BRL',
    color: '#059669',
    includeInTotal: true,
  };
  const card: CreditCard = {
    id: 'card-synthetic',
    name: 'Cartão de teste',
    brand: 'Visa',
    limit: 1000,
    closingDay: 20,
    dueDay: 28,
    defaultAccountId: account.id,
    color: '#0f172a',
  };
  const category: Category = {
    id: 'category-synthetic',
    name: 'Categoria sintética',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 500,
    color: '#059669',
    icon: 'home',
    subcategories: [],
  };
  const transactions: Transaction[] = [
    {
      id: 'income-paid',
      description: 'Receita efetivada',
      amount: 1000,
      date: '2026-11-05',
      competenceMonth: '2026-11',
      type: 'income',
      status: 'paid',
      categoryId: 'income-category',
      accountId: account.id,
      paymentMethod: 'pix',
      recurrence: 'single',
    },
    {
      id: 'income-pending',
      description: 'Receita prevista',
      amount: 200,
      date: '2026-11-20',
      competenceMonth: '2026-11',
      type: 'income',
      status: 'pending',
      categoryId: 'income-category',
      accountId: account.id,
      paymentMethod: 'pix',
      recurrence: 'single',
    },
    {
      id: 'bank-expense-pending',
      description: 'Conta prevista',
      amount: 100,
      date: '2026-11-24',
      competenceMonth: '2026-11',
      type: 'expense',
      status: 'pending',
      categoryId: category.id,
      accountId: account.id,
      paymentMethod: 'boleto',
      recurrence: 'single',
    },
    {
      id: 'card-expense-pending',
      description: 'Compra prevista no cartão',
      amount: 250,
      date: '2026-11-12',
      competenceMonth: '2026-11',
      type: 'expense',
      status: 'pending',
      categoryId: category.id,
      creditCardId: card.id,
      paymentMethod: 'credit_card',
      recurrence: 'single',
    },
  ];
  const selectedMonth = '2026-11';
  const accounts = [account];
  const cards = [card];
  const categoryBreakdown = calculateCategoryBreakdown([category], transactions, selectedMonth);
  const accountBalances = calculateAccountBalances(accounts, transactions, selectedMonth);
  const cardSummaries = cards.map((item) =>
    calculateCreditCardSummary(item, transactions, selectedMonth)
  );
  const monthlySummary = calculateMonthlySummary(accounts, cards, transactions, selectedMonth);
  const page = renderOverviewTab(() => {}, {
    selectedMonth,
    monthlySummary,
    accounts,
    accountBalances,
    cards,
    cardSummaries,
    categories: [category],
    categoryBreakdown,
    transactions,
  });
  const text = page.textContent ?? '';

  assert.equal(monthlySummary.incomeTotal, 1200);
  assert.equal(monthlySummary.expenseTotal, 350);
  assert.equal(monthlySummary.totalProjectedBalance, 2850);
  assert.equal(monthlySummary.creditCardMonthTotal, 250);
  assert.match(text, /R\$\s*1\.200,00/);
  assert.match(text, /R\$\s*350,00/);
  assert.match(text, /R\$\s*2\.850,00/);
  assert.match(text, /Fatura do mêsR\$\s*250,00/);
  assert.match(text, /Total em faturas neste mês: R\$\s*250,00/);
});
