import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonthsToYearMonth,
  applyCascadeAccountDelete,
  applyCascadeTransactionDelete,
  applyCascadeTransactionEdit,
  calculate503020Rule,
  calculateAccountBalances,
  calculateCategoryBreakdown,
  calculateCreditCardSummary,
  calculateDailyCashFlow,
  calculateFinancialHealthScore360,
  calculateMonthlySummary,
  calculatePeriodReport,
  calculateSixMonthComparativeSeries,
  createTransactionBatch,
  extractAvailableTransactionTags,
  getBudgetAlerts,
  getLocalDateISO,
  getEffectiveExpenseAmountForUser,
  normalizeSearchText,
  normalizeTransactionTag,
  normalizeTransactionTags,
  parseBRLInput,
  payCreditCardInvoice,
  resolveCreditCardInvoiceMonth,
  reverseCreditCardInvoicePayment,
  searchTransactionsGlobal,
  simulateFixedIncomeBR,
  summarizeGlobalSearchResults,
} from './financeRules';
import { BankAccount, Category, CreditCard, Transaction } from '../types/finance';
import { INITIAL_CATEGORIES } from './seedData';

test('parseBRLInput parses Brazilian and standard decimal strings accurately', () => {
  assert.equal(parseBRLInput('R$ 1.450,90'), 1450.9);
  assert.equal(parseBRLInput('R$ 1.005'), 1.01);
  assert.equal(parseBRLInput('R$ 0,105'), 0.11);
  assert.equal(parseBRLInput('1,234.56'), 1234.56);
  assert.equal(parseBRLInput('1.234.567'), 1234567);
  assert.equal(parseBRLInput('250,50'), 250.5);
  assert.equal(parseBRLInput('1200.75'), 1200.75);
  assert.equal(parseBRLInput(''), 0);
});

test('card invoice payment dates use the local calendar date, not the card due date', () => {
  assert.equal(getLocalDateISO(new Date(2026, 10, 7, 23, 30)), '2026-11-07');
});

test('card invoice settlement uses the same eligible purchases as its summary', () => {
  const card: CreditCard = {
    id: 'card-filtered',
    name: 'Cartão QA',
    brand: 'Visa',
    limit: 5000,
    closingDay: 20,
    dueDay: 28,
    defaultAccountId: 'acc-1',
    color: '#0f172a',
  };
  const [included] = createTransactionBatch({
    description: 'Despesa pessoal',
    amount: 100,
    date: '2026-11-05',
    competenceMonth: '2026-11',
    type: 'expense',
    status: 'pending',
    categoryId: 'cat-mercado',
    creditCardId: card.id,
    paymentMethod: 'credit_card',
    recurrence: 'single',
  });
  const excludedByMember = {
    ...included,
    id: 'tx-member-paid',
    description: 'Paga por familiar',
    amount: 25,
    sharedPaidBy: 'member' as const,
  };
  const companionOnly = {
    ...included,
    id: 'tx-companion-only',
    description: 'Despesa de acompanhante',
    amount: 25,
    isCompanionOnlyExpense: true,
  };
  const transactions = [included, excludedByMember, companionOnly];

  const before = calculateCreditCardSummary(card, transactions, '2026-11');
  assert.equal(before.invoiceTotal, 100);
  assert.equal(before.usedLimit, 100);

  const settled = payCreditCardInvoice(
    card,
    transactions,
    '2026-11',
    'acc-1',
    '2026-11-28'
  );
  const payment = settled.find((tx) => tx.isInvoicePayment);
  assert.equal(payment?.amount, 100);
  assert.equal(settled.find((tx) => tx.id === included.id)?.status, 'paid');
  assert.equal(settled.find((tx) => tx.id === excludedByMember.id)?.status, 'pending');
  assert.equal(settled.find((tx) => tx.id === companionOnly.id)?.status, 'pending');
  assert.equal(calculateCreditCardSummary(card, settled, '2026-11').invoicePendingAmount, 0);
});

test('card invoice settlement rejects invalid custom payments instead of treating them as full payment', () => {
  const card: CreditCard = {
    id: 'card-invalid-payment',
    name: 'Cartão QA',
    brand: 'Visa',
    limit: 5000,
    closingDay: 20,
    dueDay: 28,
    defaultAccountId: 'acc-1',
    color: '#0f172a',
  };
  const transactions = createTransactionBatch({
    description: 'Despesa',
    amount: 100,
    date: '2026-11-05',
    competenceMonth: '2026-11',
    type: 'expense',
    status: 'pending',
    categoryId: 'cat-mercado',
    creditCardId: card.id,
    paymentMethod: 'credit_card',
    recurrence: 'single',
  });

  for (const invalidAmount of [0, 0.004, -1, Number.NaN, Number.POSITIVE_INFINITY, 100.01]) {
    assert.equal(
      payCreditCardInvoice(card, transactions, '2026-11', 'acc-1', '2026-11-28', invalidAmount),
      transactions
    );
  }
});

test('createTransactionBatch creates accurate installments with remainder on 1st parcel and preserves subcategoryId', () => {
  const batch = createTransactionBatch({
    description: 'Geladeira Brastemp Frost Free',
    amount: 3000.01,
    amountMode: 'total_divided',
    date: '2026-10-15',
    competenceMonth: '2026-10',
    type: 'expense',
    status: 'pending',
    categoryId: 'cat-moradia',
    subcategoryId: 'sub-mor-manut',
    creditCardId: 'card-nubank',
    paymentMethod: 'credit_card',
    recurrence: 'installment',
    installmentTotal: 3,
  });

  assert.equal(batch.length, 3);
  assert.equal(batch[0].amount, 1000.01);
  assert.equal(batch[1].amount, 1000.0);
  assert.equal(batch[2].amount, 1000.0);
  assert.equal(batch[0].subcategoryId, 'sub-mor-manut');
  assert.equal(batch[0].competenceMonth, '2026-10');
  assert.equal(batch[1].competenceMonth, '2026-11');
  assert.equal(batch[2].competenceMonth, '2026-12');
});

test('calculateCreditCardSummary accounts for all unpaid future installments in usedLimit and payCreditCardInvoice settles current month', () => {
  const card: CreditCard = {
    id: 'card-1',
    name: 'Nubank Ultravioleta',
    brand: 'Mastercard',
    limit: 10000,
    closingDay: 25,
    dueDay: 5,
    defaultAccountId: 'acc-1',
    color: '#7c3aed',
  };

  const txs = createTransactionBatch({
    description: 'Notebook Dell',
    amount: 4000,
    amountMode: 'total_divided',
    date: '2026-10-10',
    competenceMonth: '2026-10',
    type: 'expense',
    status: 'pending',
    categoryId: 'cat-educacao',
    creditCardId: 'card-1',
    paymentMethod: 'credit_card',
    recurrence: 'installment',
    installmentTotal: 4,
  });

  const summaryOct = calculateCreditCardSummary(card, txs, '2026-10');
  assert.equal(summaryOct.invoiceTotal, 1000);
  assert.equal(summaryOct.invoicePendingAmount, 1000);
  assert.equal(summaryOct.usedLimit, 4000);
  assert.equal(summaryOct.availableLimit, 6000);

  const afterPayment = payCreditCardInvoice(card, txs, '2026-10', 'acc-1', '2026-10-25');
  const summaryAfter = calculateCreditCardSummary(card, afterPayment, '2026-10');
  assert.equal(summaryAfter.isInvoicePaid, true);
  assert.equal(summaryAfter.invoicePendingAmount, 0);
  assert.equal(summaryAfter.usedLimit, 3000);
  assert.equal(summaryAfter.availableLimit, 7000);
});

test('calculateAccountBalances and calculateMonthlySummary separate realized vs projected balances', () => {
  const accounts: BankAccount[] = [
    {
      id: 'acc-itau',
      name: 'Itaú Uniclass',
      institution: 'Itaú',
      type: 'checking',
      initialBalance: 2000,
      color: '#ea580c',
      includeInTotal: true,
    },
  ];
  const cards: CreditCard[] = [];
  const txs: Transaction[] = [
    {
      id: 't1',
      description: 'Salário CLT',
      amount: 8000,
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
      id: 't2',
      description: 'Aluguel + Condomínio',
      amount: 2500,
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
      id: 't3',
      description: 'IPVA Parcela',
      amount: 500,
      date: '2026-10-28',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'pending',
      categoryId: 'cat-transporte',
      accountId: 'acc-itau',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
  ];

  const balances = calculateAccountBalances(accounts, txs, '2026-10');
  assert.equal(balances[0].currentBalance, 7500);
  assert.equal(balances[0].projectedBalance, 7000);

  const monthly = calculateMonthlySummary(accounts, cards, txs, '2026-10');
  assert.equal(monthly.incomeRealized, 8000);
  assert.equal(monthly.expenseRealized, 2500);
  assert.equal(monthly.expensePending, 500);
  assert.equal(monthly.netResultProjected, 5000);
});

test('simulateFixedIncomeBR applies Brazilian regressive IR rate and outperforms poupanca', () => {
  const sim = simulateFixedIncomeBR({
    initialAmount: 10000,
    monthlyContribution: 500,
    months: 12,
    cdiAnnualRatePercent: 11.25,
    cdiMultiplierPercent: 100,
    isTaxExempt: false,
  });

  assert.equal(sim.totalInvested, 16000);
  assert.equal(sim.irRatePercent, 20.0);
  assert.ok(sim.netBalanceCdi > sim.poupancaBalance);
  assert.ok(sim.advantageOverPoupanca > 0);
});

test('calculateCategoryBreakdown, subcategories, and getBudgetAlerts detect warning and over-limit budgets', () => {
  const categories: Category[] = [
    {
      id: 'c-inc',
      name: 'Salário',
      type: 'income',
      bucket: 'financial',
      monthlyBudget: 0,
      color: '#16a34a',
      icon: 'briefcase',
      subcategories: [{ id: 's-clt', name: 'CLT' }],
    },
    {
      id: 'c-ess',
      name: 'Moradia',
      type: 'expense',
      bucket: 'essential',
      monthlyBudget: 3000,
      color: '#0284c7',
      icon: 'home',
      subcategories: [
        { id: 's-alug', name: 'Aluguel' },
        { id: 's-cond', name: 'Condomínio' },
      ],
    },
    {
      id: 'c-life',
      name: 'Restaurantes',
      type: 'expense',
      bucket: 'lifestyle',
      monthlyBudget: 1000,
      color: '#d97706',
      icon: 'utensils',
      subcategories: [],
    },
  ];
  const txs: Transaction[] = [
    {
      id: '1',
      description: 'Salário',
      amount: 10000,
      date: '2026-10-05',
      competenceMonth: '2026-10',
      type: 'income',
      status: 'paid',
      categoryId: 'c-inc',
      subcategoryId: 's-clt',
      accountId: 'a1',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
    {
      id: '2',
      description: 'Aluguel',
      amount: 2500,
      date: '2026-10-10',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'paid',
      categoryId: 'c-ess',
      subcategoryId: 's-alug',
      accountId: 'a1',
      paymentMethod: 'boleto',
      recurrence: 'single',
    },
    {
      id: '2b',
      description: 'Condomínio',
      amount: 700,
      date: '2026-10-10',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'paid',
      categoryId: 'c-ess',
      subcategoryId: 's-cond',
      accountId: 'a1',
      paymentMethod: 'boleto',
      recurrence: 'single',
    },
    {
      id: '3',
      description: 'Jantar',
      amount: 850,
      date: '2026-10-12',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'paid',
      categoryId: 'c-life',
      accountId: 'a1',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
  ];

  const catBreakdown = calculateCategoryBreakdown(categories, txs, '2026-10');
  assert.equal(catBreakdown[0].categoryId, 'c-ess');
  assert.equal(catBreakdown[0].status, 'over'); // 3200 > 3000
  assert.equal(catBreakdown[0].subcategoryBreakdown.length, 2);
  assert.equal(catBreakdown[0].subcategoryBreakdown[0].subcategoryName, 'Aluguel');
  assert.equal(catBreakdown[1].categoryId, 'c-life');
  assert.equal(catBreakdown[1].status, 'warning'); // 850 >= 80% of 1000

  // With stricter 90% warning threshold, 850/1000 (85%) remains 'ok'
  const catBreakdown90 = calculateCategoryBreakdown(categories, txs, '2026-10', 90);
  assert.equal(catBreakdown90[1].status, 'ok');

  const alerts = getBudgetAlerts(catBreakdown);
  assert.equal(alerts.length, 2);
  assert.equal(alerts[0].status, 'over');
  assert.equal(alerts[1].status, 'warning');

  const rule = calculate503020Rule(categories, txs, '2026-10');
  assert.equal(rule.essentialPercent, 32);
  assert.equal(rule.lifestylePercent, 8.5);
  assert.equal(rule.financialPercent, 59.5);
  assert.equal(addMonthsToYearMonth('2026-10', 3), '2027-01');
});

test('calculatePeriodReport computes multi-month comparative summary and category/source distributions', () => {
  const accounts: BankAccount[] = [
    {
      id: 'a1',
      name: 'Itaú',
      institution: 'Itaú',
      type: 'checking',
      initialBalance: 1000,
      color: '#ea580c',
      includeInTotal: true,
    },
  ];
  const categories: Category[] = [
    {
      id: 'c-inc',
      name: 'Salário',
      type: 'income',
      bucket: 'financial',
      monthlyBudget: 0,
      color: '#059669',
      icon: 'briefcase',
      subcategories: [],
    },
    {
      id: 'c-exp',
      name: 'Moradia',
      type: 'expense',
      bucket: 'essential',
      monthlyBudget: 2000,
      color: '#1e293b',
      icon: 'home',
      subcategories: [],
    },
  ];
  const txs: Transaction[] = [
    {
      id: 't1',
      description: 'Salário Set',
      amount: 5000,
      date: '2026-09-05',
      competenceMonth: '2026-09',
      type: 'income',
      status: 'paid',
      categoryId: 'c-inc',
      accountId: 'a1',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
    {
      id: 't2',
      description: 'Aluguel Set',
      amount: 2000,
      date: '2026-09-10',
      competenceMonth: '2026-09',
      type: 'expense',
      status: 'paid',
      categoryId: 'c-exp',
      accountId: 'a1',
      paymentMethod: 'boleto',
      recurrence: 'single',
    },
    {
      id: 't3',
      description: 'Salário Out',
      amount: 6000,
      date: '2026-10-05',
      competenceMonth: '2026-10',
      type: 'income',
      status: 'paid',
      categoryId: 'c-inc',
      accountId: 'a1',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
    {
      id: 't4',
      description: 'Aluguel Out',
      amount: 2200,
      date: '2026-10-10',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'paid',
      categoryId: 'c-exp',
      accountId: 'a1',
      paymentMethod: 'boleto',
      recurrence: 'single',
    },
  ];

  const report = calculatePeriodReport(accounts, [], categories, txs, '2026-09', '2026-10');
  assert.equal(report.monthsCount, 2);
  assert.equal(report.totalIncome, 11000);
  assert.equal(report.totalExpense, 4200);
  assert.equal(report.netSavings, 6800);
  assert.equal(report.expensesByCategory.length, 1);
  assert.equal(report.incomesBySource.length, 1);
  assert.equal(report.monthlySeries.length, 2);
  // Expense increased from 2000 to 2200 (+10%)
  assert.equal(report.monthlySeries[1].expenseDeltaPercent, 10);
  // Income increased from 5000 to 6000 (+20%)
  assert.equal(report.monthlySeries[1].incomeDeltaPercent, 20);
});

test('createTransactionBatch correctly distributes sharedAmount across installments for family members', () => {
  const sharedBatch = createTransactionBatch({
    description: 'Smartphone Samsung Presente Família',
    amount: 1500,
    amountMode: 'total_divided',
    date: '2026-10-15',
    competenceMonth: '2026-10',
    type: 'expense',
    status: 'pending',
    categoryId: 'c-exp',
    paymentMethod: 'credit_card',
    recurrence: 'installment',
    installmentTotal: 3,
    isShared: true,
    sharedMemberId: 'fam-lucas',
    sharedAmount: 750, // 50% split of 1500
    sharedSplitMode: 'half',
  });

  assert.equal(sharedBatch.length, 3);
  assert.equal(sharedBatch[0].amount, 500);
  assert.equal(sharedBatch[0].isShared, true);
  assert.equal(sharedBatch[0].sharedMemberId, 'fam-lucas');
  assert.equal(sharedBatch[0].sharedAmount, 250);
  assert.equal(sharedBatch[0].sharedSplitMode, 'half');
  assert.equal(sharedBatch[0].sharedStatus, 'pending');

  assert.equal(sharedBatch[1].amount, 500);
  assert.equal(sharedBatch[1].sharedAmount, 250);
  assert.equal(sharedBatch[2].amount, 500);
  assert.equal(sharedBatch[2].sharedAmount, 250);
});

test('searchTransactionsGlobal filters transactions by description, category, subcategory, and notes with accent insensitivity', () => {
  const categories: Category[] = [
    {
      id: 'cat-saude',
      name: 'Saúde & Farmácia',
      type: 'expense',
      bucket: 'essential',
      monthlyBudget: 650,
      color: '#dc2626',
      icon: 'heart-pulse',
      subcategories: [{ id: 'sub-med', name: 'Medicamentos Contínuos' }],
    },
    {
      id: 'cat-freela',
      name: 'Projetos Extras & PIX',
      type: 'income',
      bucket: 'financial',
      monthlyBudget: 0,
      color: '#0d9488',
      icon: 'wallet',
      subcategories: [],
    },
  ];

  const txs: Transaction[] = [
    {
      id: 'tx-1',
      description: 'Droga Raia Centro',
      amount: 148.5,
      date: '2026-10-21',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-saude',
      subcategoryId: 'sub-med',
      accountId: 'acc-1',
      paymentMethod: 'pix',
      recurrence: 'single',
      notes: 'Comprei para mamãe Dona Sônia, reembolso pendente',
    },
    {
      id: 'tx-2',
      description: 'Consultoria UI/UX São Paulo',
      amount: 2400,
      date: '2026-10-16',
      competenceMonth: '2026-10',
      type: 'income',
      status: 'paid',
      categoryId: 'cat-freela',
      accountId: 'acc-1',
      paymentMethod: 'pix',
      recurrence: 'single',
      notes: 'NF-e emitida referente ao mês de setembro',
    },
    {
      id: 'tx-3',
      description: 'Exame Laboratorial Fleury',
      amount: 320,
      date: '2026-09-10',
      competenceMonth: '2026-09',
      type: 'expense',
      status: 'pending',
      categoryId: 'cat-saude',
      accountId: 'acc-1',
      paymentMethod: 'boleto',
      recurrence: 'single',
      notes: 'Checkup anual',
    },
  ];

  assert.equal(normalizeSearchText('Saúde & Farmácia'), 'saude & farmacia');

  // 1. Search by description
  const byDesc = searchTransactionsGlobal(txs, categories, { query: 'droga raia' });
  assert.equal(byDesc.length, 1);
  assert.equal(byDesc[0].transaction.id, 'tx-1');
  assert.equal(byDesc[0].matchedByDescription, true);

  // 2. Search by category (accent-insensitive: 'farmacia' matches 'Saúde & Farmácia')
  const byCat = searchTransactionsGlobal(txs, categories, { query: 'farmacia' });
  assert.equal(byCat.length, 2); // tx-1 and tx-3
  assert.equal(byCat[0].matchedByCategory, true);

  // 3. Search by note (accent-insensitive: 'mamae' or 'nf-e')
  const byNote = searchTransactionsGlobal(txs, categories, { query: 'mamae sonia' });
  assert.equal(byNote.length, 1);
  assert.equal(byNote[0].transaction.id, 'tx-1');
  assert.equal(byNote[0].matchedByNote, true);

  // 4. Filter specifically by fieldFilter: 'notes'
  const onlyNotes = searchTransactionsGlobal(txs, categories, {
    query: 'nf-e emitida',
    fieldFilter: 'notes',
  });
  assert.equal(onlyNotes.length, 1);
  assert.equal(onlyNotes[0].transaction.id, 'tx-2');

  // 5. Scope filter: 'selected_month' ('2026-10')
  const octHealth = searchTransactionsGlobal(txs, categories, {
    query: 'saude',
    scope: 'selected_month',
    selectedMonth: '2026-10',
  });
  assert.equal(octHealth.length, 1);
  assert.equal(octHealth[0].transaction.id, 'tx-1');

  // 6. Summary calculation
  const allMatches = searchTransactionsGlobal(txs, categories, { query: '2026', fieldFilter: 'all' });
  assert.equal(allMatches.length, 0);
  const summaryCat = summarizeGlobalSearchResults(byCat);
  assert.equal(summaryCat.totalCount, 2);
  assert.equal(summaryCat.expenseTotal, 468.5);
  assert.equal(summaryCat.pendingCount, 1);
});

test('payCreditCardInvoice supports partial payment and createTransactionBatch preserves targetInvestmentAssetId', () => {
  const card: CreditCard = {
    id: 'card-partial',
    name: 'Itaú Personnalité',
    brand: 'Visa',
    limit: 8000,
    closingDay: 20,
    dueDay: 28,
    defaultAccountId: 'acc-1',
    color: '#0f172a',
  };

  const txs = createTransactionBatch({
    description: 'Compra Supermercado',
    amount: 1000,
    date: '2026-10-10',
    competenceMonth: '2026-10',
    type: 'expense',
    status: 'pending',
    categoryId: 'cat-mercado',
    creditCardId: 'card-partial',
    paymentMethod: 'credit_card',
    recurrence: 'single',
  });

  // Pay R$ 400 partially out of R$ 1.000
  const afterPartial = payCreditCardInvoice(
    card,
    txs,
    '2026-10',
    'acc-1',
    '2026-10-20',
    400
  );
  const summaryPartial = calculateCreditCardSummary(card, afterPartial, '2026-10');
  assert.equal(summaryPartial.invoiceTotal, 1000);
  assert.equal(summaryPartial.invoicePendingAmount, 600);
  assert.equal(summaryPartial.isInvoicePaid, false);

  // Direct investment contribution via transfer
  const invBatch = createTransactionBatch({
    description: 'Aporte em MXRF11',
    amount: 500,
    date: '2026-10-15',
    competenceMonth: '2026-10',
    type: 'transfer',
    status: 'paid',
    categoryId: 'cat-aportes',
    accountId: 'acc-1',
    targetInvestmentAssetId: 'inv-mxrf11',
    paymentMethod: 'transfer',
    recurrence: 'single',
  });
  assert.equal(invBatch.length, 1);
  assert.equal(invBatch[0].targetInvestmentAssetId, 'inv-mxrf11');

  // Deleting the partial invoice payment reverses the cascade and merges split items back
  const paymentTx = afterPartial.find((t) => t.isInvoicePayment);
  assert.ok(paymentTx);
  const afterDeleteCascade = applyCascadeTransactionDelete(
    afterPartial,
    paymentTx.id,
    'single',
    [card]
  );
  const summaryRestored = calculateCreditCardSummary(
    card,
    afterDeleteCascade.updatedTransactions,
    '2026-10'
  );
  assert.equal(summaryRestored.invoiceTotal, 1000);
  assert.equal(summaryRestored.invoicePendingAmount, 1000);
  assert.equal(summaryRestored.isInvoicePaid, false);
  assert.equal(summaryRestored.transactions.length, 1);
  assert.equal(summaryRestored.transactions[0].amount, 1000);
});

test('partial card invoice settlement splits sharedAmount proportionally and reversal restores it', () => {
  const card: CreditCard = {
    id: 'card-shared-partial',
    name: 'Cartão compartilhado',
    brand: 'Visa',
    limit: 5000,
    closingDay: 20,
    dueDay: 28,
    defaultAccountId: 'acc-1',
    color: '#0f172a',
  };
  const txs = createTransactionBatch({
    description: 'Compra compartilhada',
    amount: 100,
    date: '2026-10-10',
    competenceMonth: '2026-10',
    type: 'expense',
    status: 'pending',
    categoryId: 'cat-mercado',
    creditCardId: card.id,
    paymentMethod: 'credit_card',
    recurrence: 'single',
    isShared: true,
    sharedAmount: 40,
    sharedPaidBy: 'me',
  });

  const partiallySettled = payCreditCardInvoice(
    card, txs, '2026-10', 'acc-1', '2026-10-20', 50
  );
  const splitRows = partiallySettled.filter((tx) => tx.description.includes('Compra compartilhada'));
  assert.deepEqual(splitRows.map((tx) => tx.sharedAmount).sort(), [20, 20]);

  const payment = partiallySettled.find((tx) => tx.isInvoicePayment)!;
  const restored = reverseCreditCardInvoicePayment(partiallySettled, payment.id, [card]);
  const original = restored.updatedTransactions.find((tx) => tx.id === txs[0].id);
  assert.equal(original?.amount, 100);
  assert.equal(original?.sharedAmount, 40);
});

test('reversing one of multiple partial invoice payments only reopens that payment', () => {
  const card: CreditCard = {
    id: 'card-multiple-partial',
    name: 'Cartão múltiplos parciais',
    brand: 'Visa',
    limit: 5000,
    closingDay: 20,
    dueDay: 28,
    defaultAccountId: 'acc-1',
    color: '#0f172a',
  };
  const txs = createTransactionBatch({
    description: 'Compra de R$ 100',
    amount: 100,
    date: '2026-10-10',
    competenceMonth: '2026-10',
    type: 'expense',
    status: 'pending',
    categoryId: 'cat-mercado',
    creditCardId: card.id,
    paymentMethod: 'credit_card',
    recurrence: 'single',
  });

  const afterFirstPayment = payCreditCardInvoice(card, txs, '2026-10', 'acc-1', '2026-10-20', 30);
  const firstPayment = afterFirstPayment.find((tx) => tx.isInvoicePayment)!;
  const afterSecondPayment = payCreditCardInvoice(card, afterFirstPayment, '2026-10', 'acc-1', '2026-10-21', 20);
  const secondPayment = afterSecondPayment.find((tx) => tx.isInvoicePayment)!;

  const afterFirstReversal = reverseCreditCardInvoicePayment(afterSecondPayment, firstPayment.id, [card]);
  assert.equal(calculateCreditCardSummary(card, afterFirstReversal.updatedTransactions, '2026-10').invoicePendingAmount, 80);
  assert.ok(afterFirstReversal.updatedTransactions.some((tx) => tx.id === secondPayment.id));

  const afterSecondReversal = reverseCreditCardInvoicePayment(afterFirstReversal.updatedTransactions, secondPayment.id, [card]);
  const summary = calculateCreditCardSummary(card, afterSecondReversal.updatedTransactions, '2026-10');
  assert.equal(summary.invoicePendingAmount, 100);
  assert.equal(summary.transactions.length, 1);
  assert.equal(summary.transactions[0].amount, 100);
});

test('blocks reversal of ambiguous legacy invoice payments without changing transactions', () => {
  const card: CreditCard = {
    id: 'card-legacy-ambiguous',
    name: 'Cartão legado',
    brand: 'Visa',
    limit: 5000,
    closingDay: 20,
    dueDay: 28,
    defaultAccountId: 'acc-1',
    color: '#0f172a',
  };
  const purchase = createTransactionBatch({
    description: 'Compra histórica', amount: 100, date: '2026-10-10',
    competenceMonth: '2026-10', type: 'expense', status: 'pending',
    categoryId: 'cat-mercado', creditCardId: card.id,
    paymentMethod: 'credit_card', recurrence: 'single',
  });
  const firstSettlement = payCreditCardInvoice(card, purchase, '2026-10', 'acc-1', '2026-10-20', 30);
  const firstPayment = firstSettlement.find((tx) => tx.isInvoicePayment)!;
  const secondSettlement = payCreditCardInvoice(card, firstSettlement, '2026-10', 'acc-1', '2026-10-21', 20);
  const secondPayment = secondSettlement.find((tx) => tx.isInvoicePayment)!;
  const legacyTransactions = secondSettlement.map(({ invoicePaymentId: _link, ...tx }) => tx);

  const result = reverseCreditCardInvoicePayment(legacyTransactions, firstPayment.id, [card]);
  assert.equal(result.updatedTransactions, legacyTransactions);
  assert.equal(result.restoredCardCount, 0);
  assert.match(result.actionDescription, /várias baixas legadas/);
  assert.equal(legacyTransactions.filter((tx) => tx.isInvoicePayment).length, 2);
  assert.ok(legacyTransactions.some((tx) => tx.id === secondPayment.id));

  const deletion = applyCascadeTransactionDelete(legacyTransactions, firstPayment.id, 'single', [card]);
  assert.equal(deletion.updatedTransactions, legacyTransactions);
  assert.equal(deletion.deletedCount, 0);
  assert.match(deletion.actionDescription || '', /Nenhum lançamento foi alterado/);
});

test('keeps legacy reversal behavior when one invoice payment is unambiguous', () => {
  const card: CreditCard = {
    id: 'card-legacy-single',
    name: 'Cartão legado único',
    brand: 'Visa',
    limit: 5000,
    closingDay: 20,
    dueDay: 28,
    defaultAccountId: 'acc-1',
    color: '#0f172a',
  };
  const purchase = createTransactionBatch({
    description: 'Compra histórica única', amount: 100, date: '2026-10-10',
    competenceMonth: '2026-10', type: 'expense', status: 'pending',
    categoryId: 'cat-mercado', creditCardId: card.id,
    paymentMethod: 'credit_card', recurrence: 'single',
  });
  const settled = payCreditCardInvoice(card, purchase, '2026-10', 'acc-1', '2026-10-20', 40)
    .map(({ invoicePaymentId: _link, ...tx }) => tx);
  const payment = settled.find((tx) => tx.isInvoicePayment)!;

  const result = reverseCreditCardInvoicePayment(settled, payment.id, [card]);
  const restored = result.updatedTransactions.find((tx) => tx.id === purchase[0].id);
  assert.equal(result.updatedTransactions.some((tx) => tx.id === payment.id), false);
  assert.equal(restored?.amount, 100);
  assert.equal(restored?.status, 'pending');
});

test('resolveCreditCardInvoiceMonth advances competenceMonth when purchase day is after card closingDay', () => {
  const card: CreditCard = {
    id: 'card-closing',
    name: 'Nubank Ultravioleta',
    brand: 'Mastercard',
    limit: 15000,
    closingDay: 20,
    dueDay: 28,
    defaultAccountId: 'acc-1',
    color: '#0f172a',
  };

  assert.equal(resolveCreditCardInvoiceMonth('2026-10-15', card), '2026-10');
  assert.equal(resolveCreditCardInvoiceMonth('2026-10-20', card), '2026-10');
  assert.equal(resolveCreditCardInvoiceMonth('2026-10-21', card), '2026-11');
  assert.equal(resolveCreditCardInvoiceMonth('2026-12-25', card), '2027-01');
});

test('shared expenses paid by member count only user share while pending and avoid double counting once settled', () => {
  const accounts: BankAccount[] = [
    {
      id: 'acc-1',
      name: 'Conta Principal',
      institution: 'Itaú',
      type: 'checking',
      initialBalance: 2000,
      color: '#0f172a',
      includeInTotal: true,
    },
  ];
  const categories: Category[] = [
    {
      id: 'cat-mercado',
      name: 'Supermercado',
      type: 'expense',
      bucket: 'essential',
      monthlyBudget: 1000,
      color: '#10b981',
      icon: 'shopping-cart',
      subcategories: [],
    },
  ];

  // R$ 300 grocery bill paid by family member, where user owes R$ 150
  const pendingSharedTx: Transaction = {
    id: 'tx-shared-member-1',
    description: 'Supermercado Pão de Açúcar',
    amount: 300,
    date: '2026-10-12',
    competenceMonth: '2026-10',
    type: 'expense',
    status: 'paid',
    categoryId: 'cat-mercado',
    paymentMethod: 'pix',
    recurrence: 'single',
    isShared: true,
    sharedMemberId: 'fam-1',
    sharedPaidBy: 'member',
    sharedAmount: 150,
    sharedStatus: 'pending',
  };

  const effPending = getEffectiveExpenseAmountForUser(pendingSharedTx);
  assert.deepEqual(effPending, { amount: 150, status: 'pending' });

  const summaryBeforeSettle = calculateMonthlySummary(
    accounts,
    [],
    [pendingSharedTx],
    '2026-10'
  );
  // Only the user's R$ 150 share counts as pending expense; bank current balance remains R$ 2.000
  assert.equal(summaryBeforeSettle.expenseTotal, 150);
  assert.equal(summaryBeforeSettle.expensePending, 150);
  assert.equal(summaryBeforeSettle.expenseRealized, 0);
  assert.equal(summaryBeforeSettle.totalCurrentBalance, 2000);
  assert.equal(summaryBeforeSettle.totalProjectedBalance, 1850);

  // Now settle the shared expense: original is marked 'received' and a real bank expense tx-reimb- is created
  const settledSharedTx: Transaction = {
    ...pendingSharedTx,
    sharedStatus: 'received',
    sharedSettledDate: '2026-10-14',
    sharedSettledAccountId: 'acc-1',
  };
  const reimbTx: Transaction = {
    id: 'tx-reimb-101',
    description: 'Pagamento de Rateio Compartilhado — Esposa (Supermercado Pão de Açúcar)',
    amount: 150,
    date: '2026-10-14',
    competenceMonth: '2026-10',
    type: 'expense',
    status: 'paid',
    categoryId: 'cat-mercado',
    accountId: 'acc-1',
    paymentMethod: 'pix',
    recurrence: 'single',
    notes: 'Pagamento da minha cota de despesa paga por Esposa [ref:tx-shared-member-1]',
  };

  assert.equal(getEffectiveExpenseAmountForUser(settledSharedTx), null);

  const summaryAfterSettle = calculateMonthlySummary(
    accounts,
    [],
    [reimbTx, settledSharedTx],
    '2026-10'
  );
  // Total expense is STILL R$ 150 (now paid from acc-1), NOT R$ 450 or R$ 300!
  assert.equal(summaryAfterSettle.expenseTotal, 150);
  assert.equal(summaryAfterSettle.expenseRealized, 150);
  assert.equal(summaryAfterSettle.expensePending, 0);
  assert.equal(summaryAfterSettle.totalCurrentBalance, 1850);
  assert.equal(summaryAfterSettle.totalProjectedBalance, 1850);

  const catBreakdown = calculateCategoryBreakdown(
    categories,
    [reimbTx, settledSharedTx],
    '2026-10',
    0
  );
  assert.equal(catBreakdown[0].spent, 150);

  // Deleting the settled shared transaction also removes its linked tx-reimb-101
  const afterDelete = applyCascadeTransactionDelete(
    [reimbTx, settledSharedTx],
    settledSharedTx.id,
    'single',
    []
  );
  assert.equal(afterDelete.updatedTransactions.length, 0);
});

test('INITIAL_CATEGORIES includes cat-aportes and cat-outros, and deleting a shared tx from a consolidated tx-reimb-all batch reopens sibling shared expenses', () => {
  assert.ok(INITIAL_CATEGORIES.some((c) => c.id === 'cat-aportes' && c.type === 'expense'));
  assert.ok(INITIAL_CATEGORIES.some((c) => c.id === 'cat-outros' && c.type === 'expense'));

  const sharedA: Transaction = {
    id: 'tx-sh-a',
    description: 'Jantar Compartilhado',
    amount: 200,
    date: '2026-10-10',
    competenceMonth: '2026-10',
    type: 'expense',
    status: 'paid',
    categoryId: 'cat-outros',
    accountId: 'acc-1',
    paymentMethod: 'pix',
    recurrence: 'single',
    isShared: true,
    sharedPaidBy: 'me',
    sharedMemberId: 'fam-1',
    sharedAmount: 100,
    sharedStatus: 'received',
    sharedSettledDate: '2026-10-20',
    sharedSettledAccountId: 'acc-1',
  };

  const sharedB: Transaction = {
    id: 'tx-sh-b',
    description: 'Uber Compartilhado',
    amount: 60,
    date: '2026-10-12',
    competenceMonth: '2026-10',
    type: 'expense',
    status: 'paid',
    categoryId: 'cat-outros',
    accountId: 'acc-1',
    paymentMethod: 'pix',
    recurrence: 'single',
    isShared: true,
    sharedPaidBy: 'member',
    sharedMemberId: 'fam-1',
    sharedAmount: 30,
    sharedStatus: 'received',
    sharedSettledDate: '2026-10-20',
    sharedSettledAccountId: 'acc-1',
  };

  const consolidatedReimb: Transaction = {
    id: 'tx-reimb-all-999',
    description: 'Acerto Compensado Recebido (Out/2026) — Familiar',
    amount: 70,
    date: '2026-10-20',
    competenceMonth: '2026-10',
    type: 'income',
    status: 'paid',
    categoryId: 'cat-rendimentos',
    accountId: 'acc-1',
    paymentMethod: 'pix',
    recurrence: 'single',
    notes: 'Encontro de contas bilateral [ref:tx-sh-a] [ref:tx-sh-b]',
  };

  const res = applyCascadeTransactionDelete(
    [consolidatedReimb, sharedA, sharedB],
    'tx-sh-a',
    'single',
    []
  );

  // tx-sh-a and tx-reimb-all-999 should be deleted, and tx-sh-b should be reopened as 'pending'
  assert.equal(res.updatedTransactions.length, 1);
  assert.equal(res.updatedTransactions[0].id, 'tx-sh-b');
  assert.equal(res.updatedTransactions[0].sharedStatus, 'pending');
  assert.equal(res.cascadeReopenedCount, 1);
});

test('deleting a shared installment series removes its linked reimbursement and reopens consolidated siblings', () => {
  const sharedInstallment: Transaction = {
    id: 'tx-sh-series-1',
    description: 'Aluguel compartilhado (1/2)',
    amount: 200,
    date: '2026-10-01',
    competenceMonth: '2026-10',
    type: 'expense',
    status: 'paid',
    categoryId: 'cat-moradia',
    accountId: 'acc-1',
    paymentMethod: 'pix',
    recurrence: 'installment',
    installmentGroupId: 'grp-shared-rent',
    isShared: true,
    sharedPaidBy: 'me',
    sharedAmount: 100,
    sharedStatus: 'received',
    sharedSettledDate: '2026-10-15',
  };
  const secondInstallment: Transaction = {
    ...sharedInstallment,
    id: 'tx-sh-series-2',
    description: 'Aluguel compartilhado (2/2)',
    date: '2026-11-01',
    competenceMonth: '2026-11',
    sharedStatus: 'pending',
    sharedSettledDate: undefined,
  };
  const siblingShared: Transaction = {
    ...sharedInstallment,
    id: 'tx-sh-sibling',
    description: 'Jantar compartilhado',
    amount: 80,
    date: '2026-10-10',
    recurrence: 'single',
    installmentGroupId: undefined,
    sharedAmount: 40,
    sharedStatus: 'received',
  };
  const reimbursement: Transaction = {
    id: 'tx-reimb-all-series',
    description: 'Acerto compensado recebido',
    amount: 140,
    date: '2026-10-15',
    competenceMonth: '2026-10',
    type: 'income',
    status: 'paid',
    categoryId: 'cat-rendimentos',
    accountId: 'acc-1',
    paymentMethod: 'pix',
    recurrence: 'single',
    notes: '[ref:tx-sh-series-1] [ref:tx-sh-sibling]',
  };

  const result = applyCascadeTransactionDelete(
    [sharedInstallment, secondInstallment, siblingShared, reimbursement],
    sharedInstallment.id,
    'all_series'
  );

  assert.deepEqual(result.updatedTransactions.map((tx) => tx.id), ['tx-sh-sibling']);
  assert.equal(result.updatedTransactions[0].sharedStatus, 'pending');
  assert.equal(result.cascadeReopenedCount, 1);
  assert.equal(result.deletedCount, 3);
});

test('deleting this-and-future shared installments reverses a consolidated settlement without deleting past installments', () => {
  const pastInstallment: Transaction = {
    id: 'tx-sh-future-1',
    description: 'Curso compartilhado (1/2)',
    amount: 100,
    date: '2026-10-01',
    competenceMonth: '2026-10',
    type: 'expense',
    status: 'paid',
    categoryId: 'cat-outros',
    accountId: 'acc-1',
    paymentMethod: 'pix',
    recurrence: 'installment',
    installmentGroupId: 'grp-shared-course',
    isShared: true,
    sharedPaidBy: 'me',
    sharedAmount: 50,
    sharedStatus: 'received',
  };
  const futureInstallment: Transaction = {
    ...pastInstallment,
    id: 'tx-sh-future-2',
    description: 'Curso compartilhado (2/2)',
    date: '2026-11-01',
    competenceMonth: '2026-11',
    sharedStatus: 'received',
    sharedSettledDate: '2026-11-15',
  };
  const siblingShared: Transaction = {
    ...pastInstallment,
    id: 'tx-sh-future-sibling',
    description: 'Cinema compartilhado',
    amount: 60,
    recurrence: 'single',
    installmentGroupId: undefined,
    sharedAmount: 30,
    sharedStatus: 'received',
    sharedSettledDate: '2026-11-15',
  };
  const consolidatedReimbursement: Transaction = {
    id: 'tx-reimb-all-future',
    description: 'Acerto consolidado',
    amount: 80,
    date: '2026-11-15',
    competenceMonth: '2026-11',
    type: 'income',
    status: 'paid',
    categoryId: 'cat-rendimentos',
    accountId: 'acc-1',
    paymentMethod: 'pix',
    recurrence: 'single',
    notes: '[ref:tx-sh-future-2] [ref:tx-sh-future-sibling]',
  };

  const result = applyCascadeTransactionDelete(
    [pastInstallment, futureInstallment, siblingShared, consolidatedReimbursement],
    futureInstallment.id,
    'this_and_future'
  );

  assert.deepEqual(result.updatedTransactions.map((tx) => tx.id), [
    pastInstallment.id,
    siblingShared.id,
  ]);
  assert.equal(result.updatedTransactions[0].sharedStatus, 'received');
  assert.equal(result.updatedTransactions[1].sharedStatus, 'pending');
  assert.equal(result.deletedCount, 2);
  assert.equal(result.cascadeReopenedCount, 1);
});

test('deleting an account reassigns linked records and removes transfers that collapse to one account', () => {
  const accounts: BankAccount[] = [
    { id: 'acc-delete', name: 'Conta a excluir', institution: 'Banco A', type: 'checking', initialBalance: 10, currency: 'BRL', color: '#000', includeInTotal: true },
    { id: 'acc-fallback', name: 'Conta destino', institution: 'Banco B', type: 'checking', initialBalance: 20, currency: 'BRL', color: '#000', includeInTotal: true },
    { id: 'acc-other', name: 'Outra conta', institution: 'Banco C', type: 'checking', initialBalance: 30, currency: 'BRL', color: '#000', includeInTotal: true },
  ];
  const cards: CreditCard[] = [
    { id: 'card-1', name: 'Cartão', brand: 'Visa', limit: 1000, closingDay: 10, dueDay: 20, defaultAccountId: 'acc-delete', color: '#000' },
  ];
  const expense: Transaction = {
    id: 'tx-expense', description: 'Compra', amount: 25, date: '2026-11-01', competenceMonth: '2026-11',
    type: 'expense', status: 'paid', categoryId: 'cat-outros', accountId: 'acc-delete', paymentMethod: 'pix', recurrence: 'single',
    sharedSettledAccountId: 'acc-delete',
  };
  const collapseTransfer: Transaction = {
    id: 'tx-collapse', description: 'Entre contas', amount: 5, date: '2026-11-02', competenceMonth: '2026-11',
    type: 'transfer', status: 'paid', categoryId: 'cat-outros', accountId: 'acc-delete', destinationAccountId: 'acc-fallback', paymentMethod: 'transfer', recurrence: 'single',
  };
  const survivingTransfer: Transaction = {
    ...collapseTransfer, id: 'tx-survive', accountId: 'acc-delete', destinationAccountId: 'acc-other',
  };
  const incomingTransfer: Transaction = {
    ...collapseTransfer, id: 'tx-incoming', accountId: 'acc-other', destinationAccountId: 'acc-delete',
  };

  const result = applyCascadeAccountDelete(accounts, cards, [expense, collapseTransfer, survivingTransfer, incomingTransfer], 'acc-delete');

  assert.deepEqual(result.updatedAccounts.map((account) => account.id), ['acc-fallback', 'acc-other']);
  assert.equal(result.updatedCards[0]?.defaultAccountId, 'acc-fallback');
  assert.equal(result.deletedTransactionCount, 1);
  assert.deepEqual(result.updatedTransactions.map((tx) => tx.id), ['tx-expense', 'tx-survive', 'tx-incoming']);
  assert.equal(result.updatedTransactions[0]?.accountId, 'acc-fallback');
  assert.equal(result.updatedTransactions[0]?.sharedSettledAccountId, 'acc-fallback');
  assert.equal(result.updatedTransactions[1]?.accountId, 'acc-fallback');
  assert.equal(result.updatedTransactions[2]?.destinationAccountId, 'acc-fallback');
});

test('deleting the last account unassigns ordinary transactions and removes related transfers', () => {
  const account: BankAccount = {
    id: 'acc-last', name: 'Última conta', institution: 'Banco', type: 'checking', initialBalance: 0,
    currency: 'BRL', color: '#000', includeInTotal: true,
  };
  const expense: Transaction = {
    id: 'tx-last-expense', description: 'Compra', amount: 10, date: '2026-11-01', competenceMonth: '2026-11',
    type: 'expense', status: 'paid', categoryId: 'cat-outros', accountId: account.id, paymentMethod: 'pix', recurrence: 'single',
  };
  const transfer: Transaction = {
    ...expense, id: 'tx-last-transfer', type: 'transfer', destinationAccountId: 'acc-missing', paymentMethod: 'transfer',
  };

  const result = applyCascadeAccountDelete([account], [], [expense, transfer], account.id);

  assert.deepEqual(result.updatedAccounts, []);
  assert.equal(result.updatedTransactions.length, 1);
  assert.equal(result.updatedTransactions[0]?.accountId, undefined);
  assert.equal(result.deletedTransactionCount, 1);
});

test('deleting an unknown account does not rewrite financial records', () => {
  const accounts: BankAccount[] = [];
  const cards: CreditCard[] = [];
  const transactions: Transaction[] = [];

  const result = applyCascadeAccountDelete(accounts, cards, transactions, 'missing');

  assert.equal(result.updatedAccounts, accounts);
  assert.equal(result.updatedCards, cards);
  assert.equal(result.updatedTransactions, transactions);
  assert.equal(result.deletedAccount, undefined);
});

test('calculateSixMonthComparativeSeries builds 6-month evolution of income vs expense and financial health indicators', () => {
  const accounts: BankAccount[] = [
    {
      id: 'acc-1',
      name: 'Nubank',
      institution: 'Nubank',
      type: 'checking',
      initialBalance: 1000,
      color: '#7c3aed',
      includeInTotal: true,
    },
  ];

  const txs: Transaction[] = [
    {
      id: 'tx-6m-1',
      description: 'Salário Agosto',
      amount: 6000,
      date: '2026-08-05',
      competenceMonth: '2026-08',
      type: 'income',
      status: 'paid',
      categoryId: 'cat-salario',
      accountId: 'acc-1',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
    {
      id: 'tx-6m-2',
      description: 'Aluguel Agosto',
      amount: 2400,
      date: '2026-08-10',
      competenceMonth: '2026-08',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-moradia',
      accountId: 'acc-1',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
    {
      id: 'tx-6m-3',
      description: 'Salário Setembro',
      amount: 6000,
      date: '2026-09-05',
      competenceMonth: '2026-09',
      type: 'income',
      status: 'paid',
      categoryId: 'cat-salario',
      accountId: 'acc-1',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
    {
      id: 'tx-6m-4',
      description: 'Gastos Extras Setembro',
      amount: 7000,
      date: '2026-09-15',
      competenceMonth: '2026-09',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-moradia',
      accountId: 'acc-1',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
    {
      id: 'tx-6m-5',
      description: 'Salário Outubro',
      amount: 8000,
      date: '2026-10-05',
      competenceMonth: '2026-10',
      type: 'income',
      status: 'paid',
      categoryId: 'cat-salario',
      accountId: 'acc-1',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
    {
      id: 'tx-6m-6',
      description: 'Despesas Outubro',
      amount: 3000,
      date: '2026-10-12',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-moradia',
      accountId: 'acc-1',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
  ];

  const report6m = calculateSixMonthComparativeSeries(accounts, [], txs, '2026-10');
  assert.equal(report6m.startMonth, '2026-05');
  assert.equal(report6m.endMonth, '2026-10');
  assert.equal(report6m.months.length, 6);
  assert.deepEqual(
    report6m.months.map((m) => m.month),
    ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']
  );

  // Totals across 6m: Income = 6000 + 6000 + 8000 = 20000; Expense = 2400 + 7000 + 3000 = 12400
  assert.equal(report6m.totalIncome6m, 20000);
  assert.equal(report6m.totalExpense6m, 12400);
  assert.equal(report6m.netSavings6m, 7600);
  assert.equal(report6m.overallSavingsRate6m, 38);
  assert.equal(report6m.surplusMonthsCount, 2); // Aug and Oct
  assert.equal(report6m.deficitMonthsCount, 1); // Sep
  assert.equal(report6m.financialHealthStatus, 'strong');
  assert.equal(report6m.months[3].healthStatus, 'surplus'); // 2026-08
  assert.equal(report6m.months[4].healthStatus, 'deficit'); // 2026-09
  assert.equal(report6m.months[5].healthStatus, 'surplus'); // 2026-10
});

test('calculateDailyCashFlow reconciles end-of-month balance with calculateAccountBalances including direct investment transfers and excluded accounts', () => {
  const accounts: BankAccount[] = [
    {
      id: 'acc-main',
      name: 'Itaú Principal',
      institution: 'Itaú',
      type: 'checking',
      initialBalance: 5000,
      color: '#0f172a',
      includeInTotal: true,
    },
    {
      id: 'acc-savings',
      name: 'Nubank Caixinha',
      institution: 'Nubank',
      type: 'savings',
      initialBalance: 1000,
      color: '#7c3aed',
      includeInTotal: true,
    },
    {
      id: 'acc-excluded',
      name: 'Conta Isolada PJ',
      institution: 'Cora',
      type: 'checking',
      initialBalance: 10000,
      color: '#64748b',
      includeInTotal: false,
    },
  ];

  const txs: Transaction[] = [
    // Internal transfer between two included accounts -> does not change total included liquidity
    {
      id: 'tx-cf-1',
      description: 'Transferência Interna Itaú -> Nubank',
      amount: 1200,
      date: '2026-10-05',
      competenceMonth: '2026-10',
      type: 'transfer',
      status: 'paid',
      categoryId: 'cat-transfer',
      accountId: 'acc-main',
      destinationAccountId: 'acc-savings',
      paymentMethod: 'transfer',
      recurrence: 'single',
    },
    // Direct investment transfer out of acc-main -> reduces liquid included cash by R$ 800
    {
      id: 'tx-cf-2',
      description: 'Aporte Direto Tesouro Selic',
      amount: 800,
      date: '2026-10-10',
      competenceMonth: '2026-10',
      type: 'transfer',
      status: 'paid',
      categoryId: 'cat-aportes',
      accountId: 'acc-main',
      targetInvestmentAssetId: 'inv-selic',
      paymentMethod: 'transfer',
      recurrence: 'single',
    },
    // Expense on excluded account -> should not affect included daily cash flow
    {
      id: 'tx-cf-3',
      description: 'Imposto PJ Isolado',
      amount: 900,
      date: '2026-10-12',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-outros',
      accountId: 'acc-excluded',
      paymentMethod: 'boleto',
      recurrence: 'single',
    },
  ];

  const balances = calculateAccountBalances(accounts, txs, '2026-10');
  const includedIds = new Set(accounts.filter((a) => a.includeInTotal).map((a) => a.id));
  const includedRealizedEnd = balances
    .filter((b) => includedIds.has(b.accountId))
    .reduce((sum, b) => sum + b.currentBalance, 0);

  // Starting included balance = 5000 + 1000 = 6000. Minus 800 investment contribution = 5200.
  assert.equal(includedRealizedEnd, 5200);

  const cashFlowPoints = calculateDailyCashFlow(accounts, txs, '2026-10');
  const lastDayPoint = cashFlowPoints[cashFlowPoints.length - 1];
  assert.equal(lastDayPoint.cumulativeBalance, includedRealizedEnd);
  assert.equal(lastDayPoint.projectedBalance, includedRealizedEnd);
});

test('calculateFinancialHealthScore360 computes 0-1000 score, net worth, runway months, and safe-to-spend per day', () => {
  const emptyMonthly = calculateMonthlySummary([], [], [], '2026-11');
  const cleanHealth = calculateFinancialHealthScore360({
    selectedMonth: '2026-11',
    monthlySummary: emptyMonthly,
    accounts: [],
    accountBalances: [],
    cards: [],
    cardSummaries: [],
    categoryBreakdown: [],
    investments: [],
    referenceDateIso: '2026-11-01',
  });
  assert.equal(cleanHealth.isCleanStart, true);
  assert.equal(cleanHealth.grade, 'onboarding');
  assert.equal(cleanHealth.daysRemainingInMonth, 30);

  const accounts: BankAccount[] = [
    {
      id: 'acc-1',
      name: 'Itaú Uniclass',
      institution: 'Itaú',
      type: 'checking',
      initialBalance: 12000,
      color: '#0f172a',
      includeInTotal: true,
    },
  ];
  const cards: CreditCard[] = [
    {
      id: 'card-1',
      name: 'Nubank Ultravioleta',
      brand: 'Mastercard',
      limit: 10000,
      closingDay: 20,
      dueDay: 28,
      defaultAccountId: 'acc-1',
      color: '#7c3aed',
    },
  ];
  const txs: Transaction[] = [
    {
      id: 'tx-h-1',
      description: 'Salário Mensal',
      amount: 10000,
      date: '2026-11-05',
      competenceMonth: '2026-11',
      type: 'income',
      status: 'paid',
      categoryId: 'cat-salario',
      accountId: 'acc-1',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
    {
      id: 'tx-h-2',
      description: 'Aluguel e Condomínio',
      amount: 3000,
      date: '2026-11-10',
      competenceMonth: '2026-11',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-moradia',
      accountId: 'acc-1',
      paymentMethod: 'pix',
      recurrence: 'single',
    },
    {
      id: 'tx-h-3',
      description: 'Supermercado no Crédito',
      amount: 1000,
      date: '2026-11-12',
      competenceMonth: '2026-11',
      type: 'expense',
      status: 'pending',
      categoryId: 'cat-mercado',
      creditCardId: 'card-1',
      paymentMethod: 'credit_card',
      recurrence: 'single',
    },
  ];

  const monthlySummary = calculateMonthlySummary(accounts, cards, txs, '2026-11');
  const accountBalances = calculateAccountBalances(accounts, txs, '2026-11');
  const cardSummaries = cards.map((c) => calculateCreditCardSummary(c, txs, '2026-11'));
  const categoryBreakdown = calculateCategoryBreakdown(
    INITIAL_CATEGORIES,
    txs,
    '2026-11',
    monthlySummary.expenseTotal
  );

  const activeHealth = calculateFinancialHealthScore360({
    selectedMonth: '2026-11',
    monthlySummary,
    accounts,
    accountBalances,
    cards,
    cardSummaries,
    categoryBreakdown,
    investments: [
      {
        id: 'inv-1',
        ticker: 'TESOURO SELIC 2029',
        name: 'Tesouro Selic',
        assetClass: 'renda_fixa_pos',
        institution: 'BTG',
        quantity: 2,
        averagePrice: 5000,
        currentPrice: 5500,
        indexerLabel: '100% SELIC',
        liquidity: 'D+0 (Liquidez Diária)',
        monthlyYieldPercent: 0.9,
        isTaxExempt: false,
      },
    ],
    referenceDateIso: '2026-11-16', // 15 days remaining in November (16..30)
  });

  // Liquid balance = 12000 + 10000 - 3000 = 19000. Investments = 11000. Card debt = 1000. Net worth = 29000.
  assert.equal(activeHealth.isCleanStart, false);
  assert.equal(activeHealth.liquidBalance, 19000);
  assert.equal(activeHealth.investmentsTotal, 11000);
  assert.equal(activeHealth.creditCardDebt, 1000);
  assert.equal(activeHealth.netWorth, 29000);
  assert.equal(activeHealth.daysRemainingInMonth, 15);
  // Projected surplus = 10000 - 4000 = 6000 -> 6000 / 15 days = R$ 400.00/day
  assert.equal(activeHealth.safeToSpendPerDay, 400);
  assert.ok(activeHealth.score >= 850);
  assert.equal(activeHealth.grade, 'excellent');
});

test('custom tags: normalizeTransactionTag, normalizeTransactionTags, createTransactionBatch, applyCascadeTransactionEdit, and searchTransactionsGlobal', () => {
  assert.equal(normalizeTransactionTag('  #Reembolsável Corporativo! '), 'Reembolsável-Corporativo');
  assert.equal(normalizeTransactionTag('###imposto_renda'), 'imposto_renda');
  assert.equal(normalizeTransactionTag('   '), '');

  const normalizedList = normalizeTransactionTags([
    '#reembolsavel, #Imposto-Renda',
    'reembolsável',
    '  Projeto Casa ',
    '',
  ]);
  assert.deepEqual(normalizedList, ['reembolsavel', 'Imposto-Renda', 'Projeto-Casa']);

  // Batch creation with tags on installments
  const instBatch = createTransactionBatch({
    description: 'Notebook Dell Inspiron',
    amount: 4500,
    amountMode: 'total_divided',
    date: '2026-11-10',
    competenceMonth: '2026-11',
    type: 'expense',
    status: 'pending',
    categoryId: 'cat-educacao',
    creditCardId: 'card-1',
    paymentMethod: 'credit_card',
    recurrence: 'installment',
    installmentTotal: 3,
    tags: ['#trabalho, #dedutivel-ir', ' home office '],
  });

  assert.equal(instBatch.length, 3);
  for (const parcel of instBatch) {
    assert.deepEqual(parcel.tags, ['trabalho', 'dedutivel-ir', 'home-office']);
  }

  // Cascade edit propagates updated tags across series
  const editedFirst: Transaction = {
    ...instBatch[0],
    tags: ['trabalho', 'reembolsado-empresa'],
  };
  const cascadeRes = applyCascadeTransactionEdit(instBatch, editedFirst, 'all_series');
  assert.equal(cascadeRes.affectedCount, 3);
  for (const tx of cascadeRes.updatedTransactions) {
    assert.deepEqual(tx.tags, ['trabalho', 'reembolsado-empresa']);
  }

  // Extract available tags ranks user tags first
  const extracted = extractAvailableTransactionTags(cascadeRes.updatedTransactions, false);
  assert.deepEqual(extracted, ['reembolsado-empresa', 'trabalho']);

  // Global search matches by #tag
  const searchMatches = searchTransactionsGlobal(
    cascadeRes.updatedTransactions,
    INITIAL_CATEGORIES,
    { query: '#reembolsado-empresa' }
  );
  assert.equal(searchMatches.length, 3);
  assert.equal(searchMatches[0].matchedByTag, true);
});




