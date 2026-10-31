import test from 'node:test';
import assert from 'node:assert/strict';
import {
  anticipateCardInstallments,
  calculateAccountStatementWithRunningBalance,
  calculateBudgetImpactPreview,
  calculateMonthBurnRateMarker,
  calculateWeeklyCashPulse,
  getCategorySuggestionsForDescription,
  getSmartTransactionSuggestions,
  groupTransactionsByDate,
  predictCategoryFromDescription,
} from './uxEnhancementRules';
import { Category, Transaction } from '../types/finance';

test('calculateBudgetImpactPreview computes accurate before/after budget metrics and over-limit status', () => {
  const supermercadoCat: Category = {
    id: 'cat-mercado',
    name: 'Supermercado & Feira',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 1600,
    color: '#059669',
    icon: 'shopping-cart',
    subcategories: [],
  };

  const previewOk = calculateBudgetImpactPreview(supermercadoCat, 1369.6, 100);
  assert.equal(previewOk.hasBudget, true);
  assert.equal(previewOk.projectedSpent, 1469.6);
  assert.equal(previewOk.remainingAfter, 130.4);
  assert.equal(previewOk.statusAfter, 'warning');

  const previewOver = calculateBudgetImpactPreview(supermercadoCat, 1369.6, 300);
  assert.equal(previewOver.projectedSpent, 1669.6);
  assert.equal(previewOver.remainingAfter, -69.6);
  assert.equal(previewOver.statusAfter, 'over');

  const previewInstallment = calculateBudgetImpactPreview(
    supermercadoCat,
    1300,
    600,
    'installment',
    'total_divided',
    3
  );
  assert.equal(previewInstallment.addedInMonth, 200);
  assert.equal(previewInstallment.projectedSpent, 1500);
  assert.equal(previewInstallment.remainingAfter, 100);
});

test('groupTransactionsByDate groups transactions chronologically and computes daily subtotals', () => {
  const sampleTxs: Transaction[] = [
    {
      id: 't1',
      description: 'Padaria',
      amount: 35,
      date: '2026-10-15',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-mercado',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
    {
      id: 't2',
      description: 'Supermercado',
      amount: 165,
      date: '2026-10-15',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-mercado',
      paymentMethod: 'debit_card',
      recurrence: 'single',
    },
    {
      id: 't3',
      description: 'Freela Design',
      amount: 900,
      date: '2026-10-14',
      competenceMonth: '2026-10',
      type: 'income',
      status: 'paid',
      categoryId: 'cat-freela',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
  ];

  const groups = groupTransactionsByDate(sampleTxs, '2026-10-15');
  assert.equal(groups.length, 2);
  assert.equal(groups[0].date, '2026-10-15');
  assert.ok(groups[0].dayHeaderLabel.startsWith('Hoje'));
  assert.equal(groups[0].dayExpense, 200);
  assert.equal(groups[0].dayNet, -200);
  assert.equal(groups[0].transactions.length, 2);

  assert.equal(groups[1].date, '2026-10-14');
  assert.ok(groups[1].dayHeaderLabel.startsWith('Ontem'));
  assert.equal(groups[1].dayIncome, 900);
  assert.equal(groups[1].dayNet, 900);
});

test('getSmartTransactionSuggestions deduplicates history and strips installment suffixes', () => {
  const history: Transaction[] = [
    {
      id: 'h1',
      description: 'Supermercado Pão de Açúcar',
      amount: 420,
      date: '2026-10-10',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-mercado',
      subcategoryId: 'sub-atacado',
      accountId: 'acc-itau',
      paymentMethod: 'debit_card',
      recurrence: 'single',
    },
    {
      id: 'h2',
      description: 'Supermercado Pão de Açúcar',
      amount: 380,
      date: '2026-09-10',
      competenceMonth: '2026-09',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-mercado',
      subcategoryId: 'sub-atacado',
      accountId: 'acc-itau',
      paymentMethod: 'debit_card',
      recurrence: 'single',
    },
    {
      id: 'h3',
      description: 'Enel Energia Elétrica',
      amount: 210,
      date: '2026-10-05',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-moradia',
      accountId: 'acc-nubank',
      paymentMethod: 'boleto',
      recurrence: 'single',
    },
  ];

  const topAll = getSmartTransactionSuggestions('', history, 'expense', 3);
  assert.equal(topAll.length, 2);
  assert.equal(topAll[0].cleanDescription, 'Supermercado Pão de Açúcar');
  assert.equal(topAll[0].occurrences, 2);
  assert.equal(topAll[0].categoryId, 'cat-mercado');

  const filtered = getSmartTransactionSuggestions('enel', history, 'expense', 3);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].cleanDescription, 'Enel Energia Elétrica');
  assert.equal(filtered[0].paymentMethod, 'boleto');
});

test('calculateMonthBurnRateMarker identifies under, on, and over pace budgets', () => {
  // October 2026 has 31 days; day 15 is ~48.4%
  const onPace = calculateMonthBurnRateMarker('2026-10', 50, 15);
  assert.equal(onPace.daysInMonth, 31);
  assert.equal(onPace.monthProgressPercent, 48.4);
  assert.equal(onPace.paceStatus, 'on_pace');

  const overPace = calculateMonthBurnRateMarker('2026-10', 85, 15);
  assert.equal(overPace.paceStatus, 'over_pace');

  const underPace = calculateMonthBurnRateMarker('2026-10', 20, 15);
  assert.equal(underPace.paceStatus, 'under_pace');
});

test('anticipateCardInstallments moves future unpaid installments into current competence with discount', () => {
  const txs: Transaction[] = [
    {
      id: 'i1',
      description: 'Notebook Dell (1/3)',
      amount: 500,
      date: '2026-10-12',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'pending',
      categoryId: 'cat-lazer',
      creditCardId: 'card-nubank',
      paymentMethod: 'credit_card',
      recurrence: 'installment',
      installmentGroupId: 'grp-dell',
      installmentNumber: 1,
      installmentTotal: 3,
    },
    {
      id: 'i2',
      description: 'Notebook Dell (2/3)',
      amount: 500,
      date: '2026-11-12',
      competenceMonth: '2026-11',
      type: 'expense',
      status: 'pending',
      categoryId: 'cat-lazer',
      creditCardId: 'card-nubank',
      paymentMethod: 'credit_card',
      recurrence: 'installment',
      installmentGroupId: 'grp-dell',
      installmentNumber: 2,
      installmentTotal: 3,
    },
    {
      id: 'i3',
      description: 'Notebook Dell (3/3)',
      amount: 500,
      date: '2026-12-12',
      competenceMonth: '2026-12',
      type: 'expense',
      status: 'pending',
      categoryId: 'cat-lazer',
      creditCardId: 'card-nubank',
      paymentMethod: 'credit_card',
      recurrence: 'installment',
      installmentGroupId: 'grp-dell',
      installmentNumber: 3,
      installmentTotal: 3,
    },
  ];

  const res = anticipateCardInstallments(txs, 'grp-dell', '2026-10', 40);
  assert.equal(res.anticipatedCount, 2);
  assert.equal(res.originalSum, 1000);
  assert.equal(res.finalSum, 960);

  const inOct = res.updatedTransactions.filter((t) => t.competenceMonth === '2026-10');
  assert.equal(inOct.length, 3);
  assert.equal(inOct[1].amount, 480);
  assert.ok(inOct[1].description.includes('(Antecipada)'));
  assert.equal(inOct[1].isAnticipated, true);
  assert.equal(inOct[1].originalCompetenceMonth, '2026-11');

  // Selective anticipation of just 1 installment
  const resOne = anticipateCardInstallments(txs, 'grp-dell', '2026-10', 10, 1);
  assert.equal(resOne.anticipatedCount, 1);
  assert.equal(resOne.finalSum, 490);
});

test('calculateWeeklyCashPulse splits month into 5 weeks and flags peak expense week', () => {
  const txs: Transaction[] = [
    {
      id: 'w1',
      description: 'Aluguel',
      amount: 2500,
      date: '2026-10-05',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-moradia',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
    {
      id: 'w2',
      description: 'Feira',
      amount: 180,
      date: '2026-10-16',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'pending',
      categoryId: 'cat-mercado',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
  ];

  const pulse = calculateWeeklyCashPulse(txs, '2026-10');
  assert.equal(pulse.length, 5);
  assert.equal(pulse[0].expense, 2500);
  assert.equal(pulse[0].isPeakExpenseWeek, true);
  assert.equal(pulse[2].expense, 180);
  assert.equal(pulse[2].pendingCount, 1);
  assert.equal(pulse[2].isPeakExpenseWeek, false);
});

test('calculateAccountStatementWithRunningBalance computes opening balance and running balance after each entry', () => {
  const txs: Transaction[] = [
    {
      id: 'prev-1',
      description: 'Salário Setembro',
      amount: 1000,
      date: '2026-09-05',
      competenceMonth: '2026-09',
      type: 'income',
      status: 'paid',
      categoryId: 'cat-salario',
      accountId: 'acc-itau',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
    {
      id: 'oct-1',
      description: 'Salário Outubro',
      amount: 5000,
      date: '2026-10-05',
      competenceMonth: '2026-10',
      type: 'income',
      status: 'paid',
      categoryId: 'cat-salario',
      accountId: 'acc-itau',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
    {
      id: 'oct-2',
      description: 'Aluguel',
      amount: 2000,
      date: '2026-10-10',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-moradia',
      accountId: 'acc-itau',
      paymentMethod: 'boleto',
      recurrence: 'single',
    },
    {
      id: 'oct-3',
      description: 'Aporte Reserva',
      amount: 500,
      date: '2026-10-12',
      competenceMonth: '2026-10',
      type: 'transfer',
      status: 'paid',
      categoryId: 'cat-transfer',
      accountId: 'acc-itau',
      destinationAccountId: 'acc-reserva',
      paymentMethod: 'transfer',
      recurrence: 'single',
    },
  ];

  // Initial: 500 + Sept: 1000 => Opening Oct = 1500
  const stmt = calculateAccountStatementWithRunningBalance(
    'acc-itau',
    500,
    txs,
    '2026-10'
  );
  assert.equal(stmt.openingBalance, 1500);
  assert.equal(stmt.entriesChronological.length, 3);
  assert.equal(stmt.entriesChronological[0].runningBalanceAfter, 6500);
  assert.equal(stmt.entriesChronological[1].runningBalanceAfter, 4500);
  assert.equal(stmt.entriesChronological[2].runningBalanceAfter, 4000);
  assert.equal(stmt.closingRealizedBalance, 4000);
});

test('predictCategoryFromDescription suggests the most probable category and subcategory based on description and past transactions', () => {
  const sampleCategories: Category[] = [
    {
      id: 'cat-alimentacao',
      name: 'Alimentação & Mercado',
      type: 'expense',
      bucket: 'essential',
      monthlyBudget: 1500,
      color: '#f59e0b',
      icon: 'utensils',
      subcategories: [
        { id: 'sub-mercado', name: 'Supermercado' },
        { id: 'sub-restaurante', name: 'Restaurante / Lanches' },
      ],
    },
    {
      id: 'cat-transporte',
      name: 'Transporte & Mobilidade',
      type: 'expense',
      bucket: 'essential',
      monthlyBudget: 600,
      color: '#0284c7',
      icon: 'car',
      subcategories: [
        { id: 'sub-uber', name: 'Aplicativos (Uber/99)' },
        { id: 'sub-combustivel', name: 'Combustível' },
      ],
    },
    {
      id: 'cat-salario',
      name: 'Salário & Renda',
      type: 'income',
      bucket: 'financial',
      monthlyBudget: 0,
      color: '#10b981',
      icon: 'briefcase',
      subcategories: [],
    },
  ];

  const pastTransactions: Transaction[] = [
    {
      id: 'tx-1',
      description: 'Supermercado Pão de Açúcar (1/1)',
      amount: 280,
      date: '2026-09-12',
      competenceMonth: '2026-09',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-alimentacao',
      subcategoryId: 'sub-mercado',
      paymentMethod: 'credit_card',
      recurrence: 'single',
    },
    {
      id: 'tx-2',
      description: 'Supermercado Pão de Açúcar',
      amount: 310,
      date: '2026-10-02',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-alimentacao',
      subcategoryId: 'sub-mercado',
      paymentMethod: 'credit_card',
      recurrence: 'single',
    },
    {
      id: 'tx-3',
      description: 'Uber Viagem Aeroporto',
      amount: 45.9,
      date: '2026-09-25',
      competenceMonth: '2026-09',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-transporte',
      subcategoryId: 'sub-uber',
      paymentMethod: 'credit_card',
      recurrence: 'single',
    },
    {
      id: 'tx-4',
      description: 'Uber Central',
      amount: 28.5,
      date: '2026-10-15',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-transporte',
      subcategoryId: 'sub-uber',
      paymentMethod: 'credit_card',
      recurrence: 'single',
    },
    {
      id: 'tx-5',
      description: 'Salário Tech Solutions',
      amount: 9000,
      date: '2026-10-05',
      competenceMonth: '2026-10',
      type: 'income',
      status: 'paid',
      categoryId: 'cat-salario',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
  ];

  // 1. Exact / strong match on "Uber"
  const uberSuggestion = predictCategoryFromDescription(
    'Uber',
    pastTransactions,
    sampleCategories,
    'expense'
  );
  assert.ok(uberSuggestion !== null);
  assert.equal(uberSuggestion.categoryId, 'cat-transporte');
  assert.equal(uberSuggestion.categoryName, 'Transporte & Mobilidade');
  assert.equal(uberSuggestion.subcategoryId, 'sub-uber');
  assert.equal(uberSuggestion.subcategoryName, 'Aplicativos (Uber/99)');
  assert.ok(uberSuggestion.confidence >= 0.75);
  assert.equal(uberSuggestion.frequency, 2);

  // 2. Partial / substring match on "pão de açúcar"
  const mercadoSuggestion = predictCategoryFromDescription(
    'Pao de Acucar',
    pastTransactions,
    sampleCategories,
    'credit_card'
  );
  assert.ok(mercadoSuggestion !== null);
  assert.equal(mercadoSuggestion.categoryId, 'cat-alimentacao');
  assert.equal(mercadoSuggestion.subcategoryId, 'sub-mercado');
  assert.ok(mercadoSuggestion.confidence >= 0.70);

  // 3. Income mode match on "Salario"
  const incomeSuggestion = predictCategoryFromDescription(
    'Salario Empresa',
    pastTransactions,
    sampleCategories,
    'income'
  );
  assert.ok(incomeSuggestion !== null);
  assert.equal(incomeSuggestion.categoryId, 'cat-salario');

  // 4. Returns null for empty / too short strings or transfer mode
  assert.equal(predictCategoryFromDescription('', pastTransactions, sampleCategories), null);
  assert.equal(predictCategoryFromDescription('a', pastTransactions, sampleCategories), null);
  assert.equal(
    predictCategoryFromDescription('Uber', pastTransactions, sampleCategories, 'transfer'),
    null
  );

  // 5. Multi-candidate helper returns ranked candidates
  const multi = getCategorySuggestionsForDescription(
    'Supermercado',
    pastTransactions,
    sampleCategories,
    'expense',
    3
  );
  assert.ok(multi.length >= 1);
  assert.equal(multi[0].categoryId, 'cat-alimentacao');
});


