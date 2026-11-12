import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonthsToYearMonth,
  applyReconciledBankTransactions,
  applyCascadeAccountDelete,
  applyCascadeTransactionDelete,
  applyCascadeTransactionEdit,
  calculate503020Rule,
  calculateAccountBalances,
  calculateCalendarDaySummary,
  calculateCategoryBreakdown,
  calculateCalendarCellTotals,
  calculateCreditCardSummary,
  calculateCurrentPosition,
  calculateNetWorth,
  isPendingBankObligation,
  calculateDailyCashFlow,
  calculateFinancialHealthScore360,
  calculateMonthlySummary,
  calculatePersonalDre,
  duplicateFinancialTransaction,
  calculateInvestmentIncomeSummary,
  previewCategoryBudget,
  calculateSharedAmount,
  calculatePeriodReport,
  calculateSixMonthComparativeSeries,
  createTransactionBatch,
  extractAvailableTransactionTags,
  getBudgetAlerts,
  getPendingBankMovements,
  getLocalDateISO,
  getTransactionsLinkedToCreditCard,
  getTransactionsLinkedToCategory,
  getClampedMonthDate,
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

test('duplicated expense is an independent operation without settlement, import or installment identities', () => {
  const tx: Transaction = { id:'original', description:'Synthetic expense', amount:100, date:'2026-11-11', competenceMonth:'2026-12',
    type:'expense', status:'paid', categoryId:'shopping', paymentMethod:'credit_card', creditCardId:'card', recurrence:'installment',
    installmentGroupId:'series', installmentNumber:1, installmentTotal:3, installmentPurchaseTotal:300,
    isShared:true, sharedAmount:50, sharedMemberId:'member', sharedStatus:'received', sharedSyncId:'shared-original',
    sharedSettlementId:'settled', sharedSettledAccountId:'bank', sharedSettledDate:'2026-11-12',
    invoicePaymentId:'invoice', partialSplitOriginalId:'split', fitid:'bank-fitid', importBatchId:'import', reconciled:true };
  const copy=duplicateFinancialTransaction(tx,'copy')!;
  assert.equal(copy.amount,100);
  assert.equal(copy.status,'pending');
  assert.equal(copy.sharedStatus,'pending');
  assert.equal(copy.sharedAmount,50);
  for(const key of ['installmentGroupId','installmentPurchaseTotal','sharedSyncId','sharedSettlementId','sharedSettledDate','invoicePaymentId','partialSplitOriginalId','fitid','importBatchId','reconciled']) {
    assert.equal((copy as unknown as Record<string,unknown>)[key],undefined,key);
  }
  assert.equal(tx.sharedStatus,'received');
  assert.equal(duplicateFinancialTransaction({...tx,isInvoicePayment:true},'blocked'),null);
  assert.equal(duplicateFinancialTransaction({...tx,id:'tx-reimb-123'},'blocked'),null);
  assert.equal(duplicateFinancialTransaction({...tx,id:'tx-mirror-123'},'blocked'),null);
});

test('settled shared expenses and reimbursement movements require reversal before generic editing', () => {
  const tx: Transaction = { id:'shared-settled', description:'Synthetic expense', amount:100, date:'2026-11-11', competenceMonth:'2026-11',
    type:'expense',status:'paid',categoryId:'food',paymentMethod:'pix',recurrence:'single',isShared:true,sharedAmount:50,sharedStatus:'received' };
  const rows=[tx];
  const result=applyCascadeTransactionEdit(rows,{...tx,amount:200,sharedStatus:'pending'},'single');
  assert.ok(result.error);
  assert.equal(result.updatedTransactions,rows);
  assert.equal(result.affectedCount,0);
  const reimb={...tx,id:'tx-reimb-one',isShared:false};
  assert.ok(applyCascadeTransactionEdit([reimb],{...reimb,amount:200}).error);
});

test('budget preview uses the saved invoice month and exact first installment cents', () => {
  const category: Category = { ...INITIAL_CATEGORIES.find((item) => item.type === 'expense')!, monthlyBudget: 100 };
  const draft = {
    description: 'Synthetic installments', amount: .08, date: '2026-11-11', competenceMonth: '2026-12',
    type: 'expense' as const, status: 'pending' as const, categoryId: category.id,
    paymentMethod: 'credit_card' as const, creditCardId: 'card', recurrence: 'installment' as const,
    amountMode: 'total_divided' as const, installmentTotal: 5,
  };
  const existing = createTransactionBatch({ ...draft, amount: 90, recurrence: 'single', competenceMonth: '2026-11' });
  const december = createTransactionBatch({ ...draft, amount: 20, recurrence: 'single' });
  const preview = previewCategoryBudget([category], [...existing, ...december], draft)!;
  const saved = createTransactionBatch(draft);
  assert.equal(preview.month, '2026-12');
  assert.equal(preview.spentBefore, 20);
  assert.equal(preview.projectedSpent, 20 + saved[0].amount);
  assert.equal(preview.projectedSpent, 20.02);
  assert.equal(preview.draftMonthlyAmount, saved[0].amount);
  const warning = previewCategoryBudget([category], december, { ...draft, amount: 60, recurrence: 'single' })!;
  assert.equal(warning.statusAfter, 'warning');
  const over = previewCategoryBudget([category], december, { ...draft, amount: 300, recurrence: 'single' })!;
  assert.equal(over.statusAfter, 'over');
  assert.equal(over.remainingAfter, -220);
  const unbudgeted = previewCategoryBudget([{ ...category, monthlyBudget: 0 }], [], draft)!;
  assert.equal(unbudgeted.hasBudget, false);
  assert.equal(unbudgeted.draftMonthlyAmount, .02);
});

test('budget edit preview reuses cascade allocation while preserving a paid installment', () => {
  const category: Category = { ...INITIAL_CATEGORIES.find((item) => item.type === 'expense')!, monthlyBudget: 500 };
  const draft = { description: 'Synthetic edit', amount: 300, date: '2026-11-11', competenceMonth: '2026-11',
    type: 'expense' as const, status: 'paid' as const, categoryId: category.id, paymentMethod: 'credit_card' as const,
    creditCardId: 'card', recurrence: 'installment' as const, installmentTotal: 3, amountMode: 'total_divided' as const };
  const rows = createTransactionBatch(draft);
  const before = JSON.stringify(rows);
  const edit = { ...draft, amount: 360, installmentPurchaseTotal: 360, status: 'pending' as const,
    date: rows[1].date, competenceMonth: rows[1].competenceMonth };
  const preview = previewCategoryBudget([category], rows, edit, rows[1].id, 'all_series')!;
  assert.equal(preview.spentBefore, 100);
  assert.equal(preview.projectedSpent, 130);
  assert.equal(preview.draftMonthlyAmount, 130);
  assert.equal(JSON.stringify(rows), before);
});

test('personal DRE uses the same shared-expense and income exclusions as monthly totals', () => {
  const base: Transaction = {
    id: 'shared-dre', description: 'Shared synthetic expense', amount: 100,
    date: '2026-11-11', competenceMonth: '2026-11', type: 'expense', status: 'pending',
    categoryId: 'consumption', recurrence: 'single', paymentMethod: 'pix',
    isShared: true, sharedPaidBy: 'member', sharedAmount: 30,
  };
  const rows: Transaction[] = [
    base,
    { ...base, id: 'missing-share', sharedAmount: undefined },
    { ...base, id: 'already-settled', sharedStatus: 'received' },
    { ...base, id: 'member-income', type: 'income' },
    { ...base, id: 'invoice-payment', isInvoicePayment: true },
    { ...base, id: 'future', competenceMonth: '2026-12' },
    { ...base, id: 'salary', type: 'income', sharedPaidBy: undefined, isShared: false, amount: 200 },
  ];
  const dre = calculatePersonalDre(rows, '2026-11', [], [], []);
  const monthly = calculateMonthlySummary([], [], rows, '2026-11');
  assert.equal(dre.consumptionExpenses, 30);
  assert.equal(dre.consumptionExpenses, monthly.expenseTotal);
  assert.equal(dre.totalIncome, monthly.incomeTotal);
  assert.equal(dre.totalIncome, 200);
  assert.equal(dre.netSurplusAfterInvestments, 170);
});

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

test('card due dates clamp to the last valid day in shorter months', () => {
  assert.equal(getClampedMonthDate('2026-11', 31), '2026-11-30');
  assert.equal(getClampedMonthDate('2026-02', 31), '2026-02-28');
  assert.equal(getClampedMonthDate('2028-02', 31), '2028-02-29');
});

test('calendar day spending counts the purchase once and keeps invoice settlement out of purchase totals', () => {
  const summary = calculateCalendarDaySummary([
    {
      id: 'card-purchase', description: 'Parcela compra', amount: 100,
      date: '2026-11-10', competenceMonth: '2026-11', type: 'expense',
      status: 'pending', categoryId: 'cat-outros', creditCardId: 'card-1',
      paymentMethod: 'credit_card', recurrence: 'installment',
    },
    {
      id: 'invoice-payment', description: 'Pagamento Fatura', amount: 100,
      date: '2026-11-10', competenceMonth: '2026-11', type: 'expense',
      status: 'paid', categoryId: 'cat-fatura', accountId: 'account-1',
      paymentMethod: 'boleto', recurrence: 'single', isInvoicePayment: true,
    },
    {
      id: 'bank-bill', description: 'Conta de luz', amount: 25,
      date: '2026-11-10', competenceMonth: '2026-11', type: 'expense',
      status: 'pending', categoryId: 'cat-outros', accountId: 'account-1',
      paymentMethod: 'debit', recurrence: 'single',
    },
  ] as Transaction[]);

  assert.deepEqual(summary, {
    pendingExpense: 125,
    paidExpense: 0,
    income: 0,
    dayBalance: -125,
  });
});

test('card deletion lookup includes purchases and current or legacy invoice payments', () => {
  const card: CreditCard = {
    id: 'card-qa',
    name: 'Cartão QA',
    brand: 'Visa',
    limit: 5000,
    closingDay: 20,
    dueDay: 28,
    defaultAccountId: 'account-1',
    color: '#123456',
  };
  const transactions = [
    { id: 'purchase-1', creditCardId: card.id, description: 'Compra', isInvoicePayment: false },
    { id: 'invoice-linked', settledCardId: card.id, description: 'Pagamento', isInvoicePayment: true },
    { id: 'tx-inv-card-qa-2026-11-1', description: 'Pagamento legado', isInvoicePayment: true },
    { id: 'invoice-other', settledCardId: 'card-other', description: 'Outro cartão', isInvoicePayment: true },
    { id: 'unrelated', description: 'Compra do cartão QA em dinheiro', isInvoicePayment: false },
  ] as Transaction[];

  assert.deepEqual(
    getTransactionsLinkedToCreditCard(card, transactions).map((tx) => tx.id),
    ['purchase-1', 'invoice-linked', 'tx-inv-card-qa-2026-11-1']
  );
});

test('category deletion lookup finds the transactions linked to a category', () => {
  const transactions = [
    { id: 'tx-sub-1', categoryId: 'cat-food' },
    { id: 'tx-sub-2', categoryId: 'cat-food' },
    { id: 'tx-category-2', categoryId: 'cat-home' },
  ] as Transaction[];

  assert.deepEqual(
    getTransactionsLinkedToCategory('cat-food', transactions).map((tx) => tx.id),
    ['tx-sub-1', 'tx-sub-2']
  );
  assert.deepEqual(getTransactionsLinkedToCategory('cat-missing', transactions), []);
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

test('card invoice payment is filed against its invoice but debits cash in the actual payment month', () => {
  const account: BankAccount = {
    id: 'acc-1', name: 'Conta principal', institution: 'Banco QA', type: 'checking',
    initialBalance: 1000, color: '#0f172a', includeInTotal: true,
  };
  const card: CreditCard = {
    id: 'card-cash-month', name: 'Cartão QA', brand: 'Visa', limit: 2000,
    closingDay: 20, dueDay: 5, defaultAccountId: account.id, color: '#0f172a',
  };
  const purchases = createTransactionBatch({
    description: 'Compra do mês anterior', amount: 200, date: '2026-09-18',
    competenceMonth: '2026-10', type: 'expense', status: 'pending', categoryId: 'cat-compras',
    creditCardId: card.id, paymentMethod: 'credit_card', recurrence: 'single',
  });
  const settled = payCreditCardInvoice(card, purchases, '2026-10', account.id, '2026-11-02');
  const payment = settled.find((tx) => tx.isInvoicePayment);
  assert.equal(payment?.settledInvoiceMonth, '2026-10');
  assert.equal(payment?.competenceMonth, '2026-11');
  assert.equal(calculateAccountBalances([account], settled, '2026-10')[0].currentBalance, 1000);
  assert.equal(calculateAccountBalances([account], settled, '2026-11')[0].currentBalance, 800);
  const octoberFlow = calculateDailyCashFlow([account], [card], settled, '2026-10');
  const novemberFlow = calculateDailyCashFlow([account], [card], settled, '2026-11');
  assert.equal(octoberFlow[octoberFlow.length - 1].cumulativeBalance, 1000);
  assert.equal(novemberFlow[1].cumulativeBalance, 800);

  const legacyPayment = settled.map((tx) => tx.isInvoicePayment
    ? { ...tx, competenceMonth: '2026-10', settledInvoiceMonth: undefined }
    : tx);
  assert.equal(calculateAccountBalances([account], legacyPayment, '2026-10')[0].currentBalance, 1000);
  assert.equal(calculateAccountBalances([account], legacyPayment, '2026-11')[0].currentBalance, 800);
});

test('paying a card invoice reduces bank cash once without duplicating purchase spending', () => {
  const account: BankAccount = {
    id: 'acc-card-payment', name: 'Conta principal', institution: 'Banco QA', type: 'checking',
    initialBalance: 1000, color: '#0f172a', includeInTotal: true,
  };
  const card: CreditCard = {
    id: 'card-payment-semantics', name: 'Cartão QA', brand: 'Visa', limit: 2000,
    closingDay: 20, dueDay: 25, defaultAccountId: account.id, color: '#0f172a',
  };
  const purchase = createTransactionBatch({
    description: 'Compra de mercado', amount: 100, date: '2026-10-21',
    competenceMonth: '2026-11', type: 'expense', status: 'pending', categoryId: 'cat-outros',
    creditCardId: card.id, paymentMethod: 'credit_card', recurrence: 'single',
  });
  const beforePayment = calculateMonthlySummary([account], [card], purchase, '2026-11');
  assert.equal(beforePayment.totalCurrentBalance, 1000);
  assert.equal(beforePayment.totalProjectedBalance, 900);
  assert.equal(beforePayment.expensePending, 100);

  const settled = payCreditCardInvoice(card, purchase, '2026-11', account.id, '2026-11-18');
  const payment = settled.find((tx) => tx.isInvoicePayment);
  assert.ok(payment);
  assert.equal(payment.type, 'expense');
  assert.equal(payment.amount, 100);
  assert.equal(payment.competenceMonth, '2026-11');

  const afterPayment = calculateMonthlySummary([account], [card], settled, '2026-11');
  assert.equal(afterPayment.totalCurrentBalance, 900, 'pagamento debita uma vez do dinheiro da conta');
  assert.equal(afterPayment.totalProjectedBalance, 900);
  assert.equal(afterPayment.expenseRealized, 100, 'consumo é reconhecido pela compra, não pelo pagamento duplicado');
  assert.equal(afterPayment.expensePending, 0);
  assert.equal(afterPayment.expenseTotal, 100);
  assert.equal(calculateAccountBalances([account], settled, '2026-11')[0].monthExpense, 100);

  const category = calculateCategoryBreakdown(INITIAL_CATEGORIES, settled, '2026-11')
    .find((item) => item.categoryId === 'cat-outros');
  assert.equal(category?.spent, 100, 'o total por categoria mantém apenas a compra');
  const report = calculatePeriodReport(
    [account], [card], INITIAL_CATEGORIES, settled, '2026-11', '2026-11'
  );
  assert.equal(report.totalExpense, 100, 'relatório de período exclui o pagamento da compra já reconhecida');
  assert.equal(report.expensesByCategory.find((item) => item.id === 'cat-outros')?.amount, 100);
  assert.equal(report.monthlySeries[0].cumulativeBalance, 900, 'saldo de caixa ainda reflete a liquidação');
  assert.deepEqual(calculateCalendarDaySummary([payment]), {
    pendingExpense: 0, paidExpense: 0, income: 0, dayBalance: 0,
  });

  const cashFlow = calculateDailyCashFlow([account], [card], settled, '2026-11');
  assert.equal(cashFlow[17].expense, 100, 'a saída de caixa aparece na data real do pagamento');
  assert.equal(cashFlow.at(-1)?.cumulativeBalance, 900);
  assert.equal(cashFlow.at(-1)?.projectedBalance, 900);
});

test('reconciled bank invoice payments settle linked card purchases and preserve bank import identity', () => {
  const account: BankAccount = {
    id: 'acc-import', name: 'Conta importada', institution: 'Banco QA', type: 'checking',
    initialBalance: 1000, color: '#0f172a', includeInTotal: true,
  };
  const card: CreditCard = {
    id: 'card-import', name: 'Cartão importado', brand: 'Visa', limit: 1000,
    closingDay: 20, dueDay: 28, defaultAccountId: account.id, color: '#123456',
  };
  const [purchase] = createTransactionBatch({
    description: 'Compra importada', amount: 100, date: '2026-10-10',
    competenceMonth: '2026-10', type: 'expense', status: 'pending', categoryId: 'cat-compras',
    creditCardId: card.id, paymentMethod: 'credit_card', recurrence: 'single',
  });
  const importedPayment: Transaction = {
    id: 'tx-ofx-payment-1', description: 'PAGAMENTO FATURA CARTAO', amount: 100,
    date: '2026-10-28', competenceMonth: '2026-10', type: 'expense', status: 'paid',
    categoryId: 'cat-fatura', accountId: account.id, paymentMethod: 'pix', recurrence: 'single',
    fitid: 'FITID-INVOICE-1', importBatchId: 'batch-1', reconciled: true,
    isInvoicePayment: true, settledCardId: card.id, settledInvoiceMonth: '2026-10',
    originalAmount: 20, originalCurrency: 'USD', exchangeRate: 5.2,
    effectiveExchangeRate: 5.2, currencyRegime: 'global_account',
  };

  const result = applyReconciledBankTransactions([purchase], [importedPayment], [card]);
  const savedPayment = result.updatedTransactions.find((tx) => tx.isInvoicePayment);
  const savedPurchase = result.updatedTransactions.find((tx) => tx.id === purchase.id);

  assert.equal(result.importedCount, 1);
  assert.equal(result.rejectedInvoicePayments, 0);
  assert.equal(savedPayment?.id, importedPayment.id);
  assert.equal(savedPayment?.fitid, importedPayment.fitid);
  assert.equal(savedPayment?.settledCardId, card.id);
  assert.equal(savedPayment?.originalAmount, importedPayment.originalAmount);
  assert.equal(savedPayment?.originalCurrency, importedPayment.originalCurrency);
  assert.equal(savedPayment?.exchangeRate, importedPayment.exchangeRate);
  assert.equal(savedPayment?.effectiveExchangeRate, importedPayment.effectiveExchangeRate);
  assert.equal(savedPurchase?.status, 'paid');
  assert.equal(savedPurchase?.invoicePaymentId, importedPayment.id);
  assert.equal(calculateCreditCardSummary(card, result.updatedTransactions, '2026-10').invoicePendingAmount, 0);

  const duplicateBatch = applyReconciledBankTransactions(
    [purchase],
    [importedPayment, { ...importedPayment, id: 'tx-ofx-payment-duplicate', fitid: 'FITID-INVOICE-2' }],
    [card]
  );
  assert.equal(duplicateBatch.importedCount, 1);
  assert.equal(duplicateBatch.rejectedInvoicePayments, 1);
  assert.equal(duplicateBatch.updatedTransactions.filter((tx) => tx.isInvoicePayment).length, 1);

  const rejected = applyReconciledBankTransactions([purchase], [{ ...importedPayment, amount: 101 }], [card]);
  assert.equal(rejected.importedCount, 0);
  assert.equal(rejected.rejectedInvoicePayments, 1);
  assert.deepEqual(rejected.updatedTransactions, [purchase]);
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

test('createTransactionBatch creates accurate installments with remainder on 1st parcel ', () => {
  const batch = createTransactionBatch({
    description: 'Geladeira Brastemp Frost Free',
    amount: 3000.01,
    amountMode: 'total_divided',
    date: '2026-10-15',
    competenceMonth: '2026-10',
    type: 'expense',
    status: 'pending',
    categoryId: 'cat-moradia',
    creditCardId: 'card-nubank',
    paymentMethod: 'credit_card',
    recurrence: 'installment',
    installmentTotal: 3,
  });

  assert.equal(batch.length, 3);
  assert.equal(batch[0].amount, 1000.01);
  assert.equal(batch[1].amount, 1000.0);
  assert.equal(batch[2].amount, 1000.0);
  assert.equal(batch.every((tx) => tx.installmentPurchaseTotal === 3000.01), true);
  assert.equal(batch[0].competenceMonth, '2026-10');
  assert.equal(batch[1].competenceMonth, '2026-11');
  assert.equal(batch[2].competenceMonth, '2026-12');
});

test('createTransactionBatch divides purchase and shared portions with integer cents and spreads remainders', () => {
  const batch = createTransactionBatch({
    description: 'Compra pequena',
    amount: 0.08,
    amountMode: 'total_divided',
    date: '2026-11-11',
    competenceMonth: '2026-11',
    type: 'expense',
    status: 'pending',
    categoryId: 'cat-moradia',
    paymentMethod: 'credit_card',
    recurrence: 'installment',
    installmentTotal: 5,
    isShared: true,
    sharedAmount: 0.07,
  });

  assert.deepEqual(batch.map((tx) => tx.amount), [0.02, 0.02, 0.02, 0.01, 0.01]);
  assert.deepEqual(batch.map((tx) => tx.sharedAmount), [0.02, 0.02, 0.01, 0.01, 0.01]);
  assert.equal(batch.reduce((sum, tx) => sum + Math.round(tx.amount * 100), 0), 8);
  assert.equal(batch.reduce((sum, tx) => sum + Math.round((tx.sharedAmount || 0) * 100), 0), 7);

  const evenlyDivided = createTransactionBatch({
    description: 'Compra de cinquenta e oito centavos',
    amount: 0.58,
    amountMode: 'total_divided',
    date: '2026-11-11',
    type: 'expense',
    status: 'pending',
    categoryId: 'cat-moradia',
    paymentMethod: 'credit_card',
    recurrence: 'installment',
    installmentTotal: 2,
  });
  assert.deepEqual(evenlyDivided.map((tx) => tx.amount), [0.29, 0.29]);
});

test('editing a recurring series start date shifts future dates and competence by month', () => {
  const batch = createTransactionBatch({
    description: 'Internet residencial', amount: 120, date: '2026-08-10',
    competenceMonth: '2026-08', type: 'expense', status: 'paid',
    categoryId: 'cat-moradia', accountId: 'acc-1', paymentMethod: 'boleto',
    recurrence: 'fixed', fixedMonthsCount: 3,
  });
  const edited = {
    ...batch[0],
    date: '2026-09-15',
    competenceMonth: '2026-09',
  };
  const result = applyCascadeTransactionEdit(batch, edited, 'all_series');
  assert.deepEqual(
    result.updatedTransactions.map((tx) => [tx.date, tx.competenceMonth]),
    [['2026-09-15', '2026-09'], ['2026-10-15', '2026-10'], ['2026-11-15', '2026-11']]
  );
});

test('editing the original installment purchase total reallocates pending installments in cents and preserves paid rows', () => {
  const batch = createTransactionBatch({
    description: 'Compra parcelada sintética', amount: 1000, amountMode: 'total_divided',
    date: '2026-10-11', competenceMonth: '2026-10', type: 'expense', status: 'pending',
    categoryId: 'cat-compras', creditCardId: 'card-1', paymentMethod: 'credit_card',
    recurrence: 'installment', installmentTotal: 3,
  });
  const withFirstInstallmentPaid = batch.map((tx, index) => index === 0 ? { ...tx, status: 'paid' as const } : tx);
  const edited = {
    ...withFirstInstallmentPaid[0],
    amount: 1200,
    installmentPurchaseTotal: 1200,
    date: '2026-10-12',
    competenceMonth: '2026-10',
  };

  const result = applyCascadeTransactionEdit(withFirstInstallmentPaid, edited, 'all_series');
  const series = result.updatedTransactions.sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
  assert.equal(result.error, undefined);
  assert.equal(series[0].amount, 333.34);
  assert.equal(series[0].status, 'paid');
  assert.equal(series[1].amount, 433.33);
  assert.equal(series[2].amount, 433.33);
  assert.equal(series.reduce((sum, tx) => sum + tx.amount, 0), 1200);
  assert.deepEqual(series.map((tx) => tx.date), ['2026-10-12', '2026-11-12', '2026-12-12']);
  assert.deepEqual(series.map((tx) => tx.competenceMonth), ['2026-10', '2026-11', '2026-12']);
  assert.ok(series.every((tx) => tx.installmentPurchaseTotal === 1200));
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

test('calculateAccountBalances includes overdue pending cash movements in projection, without changing monthly totals', () => {
  const accounts: BankAccount[] = [
    { id: 'acc-source', name: 'Conta origem', institution: 'Banco', type: 'checking', initialBalance: 1000, color: '#000', includeInTotal: true },
    { id: 'acc-destination', name: 'Conta destino', institution: 'Banco', type: 'checking', initialBalance: 100, color: '#000', includeInTotal: true },
  ];
  const transactions: Transaction[] = [
    {
      id: 'overdue-expense', description: 'Conta vencida', amount: 100, date: '2026-10-10', competenceMonth: '2026-10',
      type: 'expense', status: 'pending', categoryId: 'cat-outros', accountId: 'acc-source', paymentMethod: 'boleto', recurrence: 'single',
    },
    {
      id: 'overdue-income', description: 'Recebimento atrasado', amount: 50, date: '2026-10-15', competenceMonth: '2026-10',
      type: 'income', status: 'pending', categoryId: 'cat-salario', accountId: 'acc-destination', paymentMethod: 'pix', recurrence: 'single',
    },
    {
      id: 'overdue-transfer', description: 'Transferência pendente', amount: 200, date: '2026-10-20', competenceMonth: '2026-10',
      type: 'transfer', status: 'pending', categoryId: 'cat-outros', accountId: 'acc-source', destinationAccountId: 'acc-destination',
      paymentMethod: 'transfer', recurrence: 'single',
    },
    {
      id: 'current-expense', description: 'Conta atual', amount: 25, date: '2026-11-05', competenceMonth: '2026-11',
      type: 'expense', status: 'pending', categoryId: 'cat-outros', accountId: 'acc-source', paymentMethod: 'boleto', recurrence: 'single',
    },
    {
      id: 'future-expense', description: 'Conta futura', amount: 40, date: '2026-12-05', competenceMonth: '2026-12',
      type: 'expense', status: 'pending', categoryId: 'cat-outros', accountId: 'acc-source', paymentMethod: 'boleto', recurrence: 'single',
    },
  ];

  const balances = calculateAccountBalances(accounts, transactions, '2026-11');
  assert.equal(balances[0].currentBalance, 1000);
  assert.equal(balances[0].projectedBalance, 675);
  assert.equal(balances[0].monthExpense, 25);
  assert.equal(balances[1].currentBalance, 100);
  assert.equal(balances[1].projectedBalance, 350);
  assert.equal(balances[1].monthIncome, 0);
});

test('monthly projected balance subtracts open card invoices through the month, but not future installments', () => {
  const account: BankAccount = {
    id: 'acc-cash', name: 'Conta', institution: 'Banco', type: 'checking', initialBalance: 1000, color: '#000', includeInTotal: true,
  };
  const card: CreditCard = {
    id: 'card-1', name: 'Cartão', brand: 'Visa', limit: 5000, closingDay: 20, dueDay: 28, defaultAccountId: account.id, color: '#000',
  };
  const transactions: Transaction[] = [
    {
      id: 'card-overdue', description: 'Fatura anterior', amount: 300, date: '2026-10-10', competenceMonth: '2026-10',
      type: 'expense', status: 'pending', categoryId: 'cat-outros', creditCardId: card.id, paymentMethod: 'credit_card', recurrence: 'single',
    },
    {
      id: 'card-current', description: 'Fatura atual', amount: 200, date: '2026-11-10', competenceMonth: '2026-11',
      type: 'expense', status: 'pending', categoryId: 'cat-outros', creditCardId: card.id, paymentMethod: 'credit_card', recurrence: 'single',
    },
    {
      id: 'card-future', description: 'Parcela futura', amount: 400, date: '2026-12-10', competenceMonth: '2026-12',
      type: 'expense', status: 'pending', categoryId: 'cat-outros', creditCardId: card.id, paymentMethod: 'credit_card', recurrence: 'installment',
    },
  ];

  const summary = calculateMonthlySummary([account], [card], transactions, '2026-11');
  assert.equal(summary.totalCurrentBalance, 1000);
  assert.equal(summary.totalProjectedBalance, 500);
  assert.equal(summary.creditCardMonthTotal, 200);
});

test('pending bank list includes current and overdue receivables/payables but excludes transfers and card purchases', () => {
  const transaction = (id: string, overrides: Partial<Transaction>): Transaction => ({
    id, description: id, amount: 10, date: '2026-10-10', competenceMonth: '2026-10',
    type: 'expense', status: 'pending', categoryId: 'cat-outros', accountId: 'acc-1',
    paymentMethod: 'boleto', recurrence: 'single', ...overrides,
  });
  const items = [
    transaction('overdue', {}),
    transaction('current', { date: '2026-11-20', competenceMonth: '2026-11' }),
    transaction('future-month', { date: '2026-12-01', competenceMonth: '2026-12' }),
    transaction('transfer', { type: 'transfer', destinationAccountId: 'acc-2' }),
    transaction('income', { type: 'income', categoryId: 'cat-salario' }),
    transaction('card', { creditCardId: 'card-1' }),
    transaction('invalid-date', { date: '2026-02-30', competenceMonth: '2026-02' }),
  ];

  const currentMonthItems = getPendingBankMovements(items, '2026-11', '2026-11-11');
  assert.deepEqual(currentMonthItems.map((tx) => tx.id), ['overdue', 'income', 'current']);
  assert.deepEqual(getPendingBankMovements(items, '2026-10', '2026-11-11').map((tx) => tx.id), ['overdue', 'income']);
  assert.deepEqual(getPendingBankMovements(null, '2026-11', '2026-11-11'), []);
  assert.deepEqual(getPendingBankMovements(items, '2026-13', '2026-11-11'), []);
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

test('calculateCategoryBreakdown and getBudgetAlerts detect warning and over-limit budgets', () => {
  const categories: Category[] = [
    {
      id: 'c-inc',
      name: 'Salário',
      type: 'income',
      bucket: 'financial',
      monthlyBudget: 0,
      color: '#16a34a',
      icon: 'briefcase',
    },
    {
      id: 'c-ess',
      name: 'Moradia',
      type: 'expense',
      bucket: 'essential',
      monthlyBudget: 3000,
      color: '#0284c7',
      icon: 'home',
    },
    {
      id: 'c-life',
      name: 'Restaurantes',
      type: 'expense',
      bucket: 'lifestyle',
      monthlyBudget: 1000,
      color: '#d97706',
      icon: 'utensils',
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
  assert.equal(catBreakdown[0].spent, 3200);
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
    },
    {
      id: 'c-exp',
      name: 'Moradia',
      type: 'expense',
      bucket: 'essential',
      monthlyBudget: 2000,
      color: '#1e293b',
      icon: 'home',
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

test('searchTransactionsGlobal filters transactions by description, category and notes with accent insensitivity', () => {
  const categories: Category[] = [
    {
      id: 'cat-saude',
      name: 'Saúde & Farmácia',
      type: 'expense',
      bucket: 'essential',
      monthlyBudget: 650,
      color: '#dc2626',
      icon: 'heart-pulse',
    },
    {
      id: 'cat-freela',
      name: 'Projetos Extras & PIX',
      type: 'income',
      bucket: 'financial',
      monthlyBudget: 0,
      color: '#0d9488',
      icon: 'wallet',
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

test('resolveCreditCardInvoiceMonth accounts for both the card closing and due days', () => {
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

  const dueBeforeClosing: CreditCard = { ...card, dueDay: 5 };
  assert.equal(resolveCreditCardInvoiceMonth('2026-10-15', dueBeforeClosing), '2026-11');
  assert.equal(resolveCreditCardInvoiceMonth('2026-10-20', dueBeforeClosing), '2026-11');
  assert.equal(resolveCreditCardInvoiceMonth('2026-10-21', dueBeforeClosing), '2026-12');
  assert.equal(resolveCreditCardInvoiceMonth('2026-12-25', dueBeforeClosing), '2027-02');

  const dueAfterClosing: CreditCard = { ...card, closingDay: 5, dueDay: 20 };
  assert.equal(resolveCreditCardInvoiceMonth('2026-09-05', dueAfterClosing), '2026-09');
  assert.equal(resolveCreditCardInvoiceMonth('2026-09-06', dueAfterClosing), '2026-10');
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

test('INITIAL_CATEGORIES includes core financial categories, and deleting a shared tx from a consolidated tx-reimb-all batch reopens sibling shared expenses', () => {
  assert.ok(INITIAL_CATEGORIES.some((c) => c.id === 'cat-aportes' && c.type === 'expense'));
  assert.ok(INITIAL_CATEGORIES.some((c) => c.id === 'cat-outros' && c.type === 'expense'));
  assert.ok(INITIAL_CATEGORIES.some((c) => c.id === 'cat-fatura' && c.type === 'expense'));

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
  assert.equal(result.updatedAccounts[0]?.initialBalance, 30);
  const balanceBefore = calculateAccountBalances(
    accounts,
    [expense, collapseTransfer, survivingTransfer, incomingTransfer],
    '2026-11'
  ).reduce((sum, balance) => sum + balance.currentBalance, 0);
  const balanceAfter = calculateAccountBalances(
    result.updatedAccounts,
    result.updatedTransactions,
    '2026-11'
  ).reduce((sum, balance) => sum + balance.currentBalance, 0);
  assert.equal(balanceAfter, balanceBefore);
});

test('deleting the last account is blocked while it has linked transactions', () => {
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

  assert.equal(result.deletedAccount, undefined);
  assert.match(result.error || '', /última conta/);
  assert.deepEqual(result.updatedAccounts, [account]);
  assert.deepEqual(result.updatedTransactions, [expense, transfer]);
  assert.equal(result.deletedTransactionCount, 0);
});

test('deleting an account is blocked when no compatible consolidation account exists', () => {
  const accounts: BankAccount[] = [
    { id: 'acc-delete-usd', name: 'Conta USD', institution: 'A', type: 'international', currency: 'USD', initialBalance: 0, initialBalanceForeign: 100, color: '#000', includeInTotal: true },
    { id: 'acc-main-brl', name: 'Conta BRL', institution: 'B', type: 'checking', currency: 'BRL', initialBalance: 0, color: '#000', includeInTotal: true },
  ];
  const result = applyCascadeAccountDelete(accounts, [], [], 'acc-delete-usd');

  assert.equal(result.deletedAccount, undefined);
  assert.match(result.error || '', /mesma moeda/);
  assert.deepEqual(result.updatedAccounts, accounts);
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

  const cashFlowPoints = calculateDailyCashFlow(accounts, [], txs, '2026-10');
  const lastDayPoint = cashFlowPoints[cashFlowPoints.length - 1];
  assert.equal(lastDayPoint.cumulativeBalance, includedRealizedEnd);
  assert.equal(lastDayPoint.projectedBalance, includedRealizedEnd);
});

test('daily cash flow projects open card invoices and member-paid shares without changing realized balance', () => {
  const account: BankAccount = {
    id: 'acc-cash-flow', name: 'Conta principal', institution: 'Banco', type: 'checking',
    initialBalance: 1000, color: '#000000', includeInTotal: true,
  };
  const card: CreditCard = {
    id: 'card-cash-flow', name: 'Cartão', brand: 'Visa', limit: 5000,
    closingDay: 20, dueDay: 15, defaultAccountId: account.id, color: '#000000',
  };
  const purchases: Transaction[] = [
    {
      id: 'purchase-overdue', description: 'Fatura anterior', amount: 50,
      date: '2026-10-05', competenceMonth: '2026-10', type: 'expense', status: 'pending',
      categoryId: 'cat-outros', creditCardId: card.id, paymentMethod: 'credit_card', recurrence: 'single',
    },
    {
      id: 'purchase-current', description: 'Fatura atual', amount: 100,
      date: '2026-11-05', competenceMonth: '2026-11', type: 'expense', status: 'pending',
      categoryId: 'cat-outros', creditCardId: card.id, paymentMethod: 'credit_card', recurrence: 'single',
    },
    {
      id: 'shared-debt-current', description: 'Parte paga pela família', amount: 80,
      date: '2026-11-20', competenceMonth: '2026-11', type: 'expense', status: 'paid',
      categoryId: 'cat-outros', paymentMethod: 'pix', recurrence: 'single',
      isShared: true, sharedPaidBy: 'member', sharedAmount: 25, sharedStatus: 'pending',
    },
  ];

  const flow = calculateDailyCashFlow([account], [card], purchases, '2026-11');
  assert.equal(flow[0].expense, 50);
  assert.equal(flow[0].projectedBalance, 950);
  assert.equal(flow[13].projectedBalance, 950);
  assert.equal(flow[14].expense, 100);
  assert.equal(flow[14].projectedBalance, 850);
  assert.equal(flow[14].cumulativeBalance, 1000, 'unpaid invoices do not change the realized balance');
  assert.equal(flow[19].expense, 25);
  assert.equal(flow[19].projectedBalance, 825);

  const monthly = calculateMonthlySummary([account], [card], purchases, '2026-11');
  assert.equal(flow.at(-1)?.projectedBalance, monthly.totalProjectedBalance);
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

test('card debt is deducted consistently from DRE and health even without bank accounts or a current invoice', () => {
  const card: CreditCard = { id: 'debt-card', name: 'Synthetic card', brand: 'Visa', limit: 10000, closingDay: 30, dueDay: 5, color: '#000000', defaultAccountId: '' };
  const rows = createTransactionBatch({ description: 'Synthetic purchase', amount: 1435, date: '2026-11-11',
    competenceMonth: '2026-12', type: 'expense', status: 'pending', categoryId: 'shopping',
    creditCardId: card.id, paymentMethod: 'credit_card', recurrence: 'installment', installmentTotal: 12 });
  const summaries = [calculateCreditCardSummary(card, rows, '2026-11')];
  const monthly = calculateMonthlySummary([], [card], rows, '2026-11');
  assert.equal(summaries[0].invoiceTotal, 0);
  const health = calculateFinancialHealthScore360({ selectedMonth: '2026-11', monthlySummary: monthly,
    accounts: [], accountBalances: [], cards: [card], cardSummaries: summaries, categoryBreakdown: [], referenceDateIso: '2026-11-11' });
  const dre = calculatePersonalDre(rows, '2026-11', [], [], summaries);
  assert.equal(health.isCleanStart, false);
  assert.equal(health.creditCardDebt, 1435);
  assert.equal(health.netWorth, -1435);
  assert.equal(dre.totalNetWorth, health.netWorth);
  assert.equal(dre.creditCardDebt, health.creditCardDebt);
});

test('future subscriptions stay forecast without consuming limit while all contracted installments consume it', () => {
  const card: CreditCard = { id: 'subscription-card', name: 'Synthetic card', brand: 'Visa', limit: 1000, closingDay: 20, dueDay: 28, color: '#000000', defaultAccountId: '' };
  const base = { description: 'Subscription', amount: 10, date: '2026-11-11', competenceMonth: '2026-11',
    type: 'expense' as const, status: 'pending' as const, categoryId: 'subscriptions', creditCardId: card.id, paymentMethod: 'credit_card' as const };
  const fixed = createTransactionBatch({ ...base, recurrence: 'fixed', fixedMonthsCount: 3 });
  const installments = createTransactionBatch({ ...base, amount: 40, recurrence: 'installment', installmentTotal: 4 });
  const rows = [...fixed, ...installments];
  const november = calculateCreditCardSummary(card, rows, '2026-11', '2026-11-11');
  const decemberForecast = calculateCreditCardSummary(card, rows, '2026-12', '2026-11-11');
  assert.equal(november.usedLimit, 50);
  assert.equal(november.availableLimit, 950);
  assert.equal(decemberForecast.usedLimit, november.usedLimit);
  assert.equal(decemberForecast.invoiceTotal, 20);
  assert.equal(calculateCreditCardSummary(card, rows, '2026-12', '2026-12-11').usedLimit, 60);
});

test('investment income and DRE share exclusions for family reimbursements and sum cents consistently', () => {
  const base: Transaction = { id: 'yield-one', description: 'Dividend', amount: .1, date: '2026-11-11',
    competenceMonth: '2026-11', type: 'income', status: 'paid', categoryId: 'cat-rendimentos', recurrence: 'single', paymentMethod: 'pix' };
  const rows: Transaction[] = [base, { ...base, id: 'yield-two', amount: .2, status: 'pending' },
    { ...base, id: 'family-income', amount: 999, sharedPaidBy: 'member' },
    { ...base, id: 'tx-reimb-synthetic', amount: 100 },
    { ...base, id: 'described-reimbursement', amount: 200, description: 'Reembolso compartilhado' },
    { ...base, id: 'companion', amount: 500, isCompanionOnlyExpense: true }];
  const summary = calculateInvestmentIncomeSummary(rows, '2026-11');
  const dre = calculatePersonalDre(rows, '2026-11', [], [], []);
  assert.equal(summary.monthTotal, .3);
  assert.equal(summary.registeredTotal, .3);
  assert.deepEqual(summary.monthTransactions.map((tx) => tx.id).sort(), ['yield-one', 'yield-two']);
  assert.equal(dre.dividendIncome, summary.monthTotal);
  assert.equal(dre.operationalIncome, 300);
});

test('shared installment edits distribute the total share and preserve paid and settled shares', () => {
  const input = { description: 'Shared synthetic', amount: 300, date: '2026-11-11', competenceMonth: '2026-11',
    type: 'expense' as const, status: 'paid' as const, categoryId: 'shopping', creditCardId: 'card', paymentMethod: 'credit_card' as const,
    recurrence: 'installment' as const, installmentTotal: 3, isShared: true, sharedAmount: 150, sharedMemberId: 'member', sharedPaidBy: 'me' as const };
  const rows = createTransactionBatch(input);
  const edit = { ...rows[1], amount: 360, installmentPurchaseTotal: 360, sharedAmount: 180 };
  const result = applyCascadeTransactionEdit(rows, edit, 'all_series');
  assert.equal(result.error, undefined);
  assert.deepEqual(result.updatedTransactions.map((tx) => tx.amount), [100, 130, 130]);
  assert.deepEqual(result.updatedTransactions.map((tx) => tx.sharedAmount), [50, 65, 65]);
  const settled = rows.map((tx, index) => index === 2 ? { ...tx, sharedStatus: 'received' as const } : tx);
  const settledResult = applyCascadeTransactionEdit(settled, edit, 'all_series');
  assert.deepEqual(settledResult.updatedTransactions.map((tx) => tx.sharedAmount), [50, 80, 50]);
  assert.equal(settledResult.updatedTransactions[2].sharedStatus, 'received');
  assert.ok(applyCascadeTransactionEdit(rows, { ...edit, sharedAmount: 20 }, 'all_series').error);
  assert.ok(applyCascadeTransactionEdit(settled, { ...edit, installmentPurchaseTotal: 180 }, 'all_series').error);
});

test('shared custom preview equals the saved installment share, including small remainders', () => {
  const category: Category = { ...INITIAL_CATEGORIES.find((item) => item.type === 'expense')!, monthlyBudget: 100 };
  const draft = { description: 'Shared preview', amount: 300, date: '2026-11-11', competenceMonth: '2026-11',
    type: 'expense' as const, status: 'pending' as const, categoryId: category.id, creditCardId: 'card', paymentMethod: 'credit_card' as const,
    recurrence: 'installment' as const, installmentTotal: 3, isShared: true, sharedAmount: calculateSharedAmount(300, 'custom', 50, 60) };
  assert.equal(previewCategoryBudget([category], [], draft)?.draftSharedAmount, 20);
  const small = { ...draft, amount: .02, sharedAmount: calculateSharedAmount(.02, 'half') };
  assert.equal(previewCategoryBudget([category], [], small)?.draftSharedAmount, createTransactionBatch(small)[0].sharedAmount);
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





test('net worth uses today\'s position and does not change with the month being browsed', () => {
  const accounts = [{ id: 'a1', name: 'Conta', institution: 'Banco', type: 'checking', initialBalance: 1000, color: '#000', includeInTotal: true }] as never[];
  const cards = [{ id: 'c1', name: 'Cartão', brand: 'Visa', limit: 5000, closingDay: 10, dueDay: 20, defaultAccountId: 'a1', color: '#000' }] as never[];
  const base = { paymentMethod: 'pix', recurrence: 'single', categoryId: 'cat' };
  const transactions = [
    { ...base, id: 'salary', description: 'Salário', amount: 3000, date: '2026-11-05', competenceMonth: '2026-11', type: 'income', status: 'paid', accountId: 'a1' },
    { ...base, id: 'card', description: 'Compra', amount: 300, date: '2026-11-15', competenceMonth: '2026-11', type: 'expense', status: 'pending', creditCardId: 'c1', paymentMethod: 'credit_card' },
  ] as never[];

  const position = calculateCurrentPosition(accounts, cards, transactions, '2026-11-20');
  const worth = calculateNetWorth(position.accountBalances, [], position.cardSummaries);
  assert.equal(worth.liquidAccountsBalance, 4000);
  assert.equal(worth.creditCardDebt, 300);
  assert.equal(worth.totalNetWorth, 3700);

  // Navegar para outubro muda o saldo "ao fim do mês", mas nunca a posição de hoje.
  const octoberBalances = calculateAccountBalances(accounts, transactions, '2026-10');
  assert.equal(octoberBalances[0].currentBalance, 1000);
  const again = calculateCurrentPosition(accounts, cards, transactions, '2026-11-20');
  assert.deepEqual(again, position);
});

test('one rule defines a pending bank obligation for both overview and notices', () => {
  const tx = (over: object) => ({ id: 't', description: 'x', amount: 10, date: '2026-11-10', competenceMonth: '2026-11', type: 'expense', status: 'pending', categoryId: 'c', paymentMethod: 'pix', recurrence: 'single', ...over });
  assert.equal(isPendingBankObligation(tx({}) as never), true);
  assert.equal(isPendingBankObligation(tx({ status: 'paid' }) as never), false);
  assert.equal(isPendingBankObligation(tx({ type: 'transfer' }) as never), false);
  assert.equal(isPendingBankObligation(tx({ creditCardId: 'c1' }) as never), false);
  assert.equal(isPendingBankObligation(tx({ sharedPaidBy: 'member' }) as never), false);
  assert.equal(isPendingBankObligation(tx({ isCompanionOnlyExpense: true }) as never), false);
  assert.equal(isPendingBankObligation(tx({ date: '2026-13-40' }) as never), false);
});

test('calendar cell total sums the day, counts installment purchases by their full price and skips settlements', () => {
  const tx = (over: object) => ({ id: 't' + Math.random(), description: 'x', amount: 10, date: '2026-11-11', competenceMonth: '2026-12', type: 'expense', status: 'pending', categoryId: 'c', paymentMethod: 'credit_card', recurrence: 'single', creditCardId: 'c1', ...over });
  const totals = calculateCalendarCellTotals([
    tx({ amount: 119.59, recurrence: 'installment', installmentNumber: 1, installmentTotal: 12, installmentPurchaseTotal: 1435 }),
    tx({ amount: 135 }),
    tx({ amount: 50 }),
    tx({ amount: 500, isInvoicePayment: true, creditCardId: undefined }),
    tx({ amount: 80, type: 'transfer', creditCardId: undefined }),
    tx({ amount: 300, type: 'income', creditCardId: undefined, status: 'paid' }),
  ] as never[]);
  assert.equal(totals.expense, 1620);
  assert.equal(totals.income, 300);
  assert.deepEqual(calculateCalendarCellTotals([]), { expense: 0, income: 0 });
});
