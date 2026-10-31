import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMonthlyFinancialReportPdf,
  sanitizePdfText,
} from './reportPdfGenerator';
import { BankAccount, Category, CreditCard, Transaction } from '../types/finance';

describe('reportPdfGenerator - Monthly Financial Report PDF', () => {
  test('sanitizePdfText removes accents and strips non-ASCII symbols cleanly', () => {
    assert.strictEqual(sanitizePdfText('Relatório de Habitação & Alimentação'), 'Relatorio de Habitacao & Alimentacao');
    assert.strictEqual(sanitizePdfText('Salário R$ 10.500,00'), 'Salario R$ 10.500,00');
    assert.strictEqual(sanitizePdfText(''), '');
  });

  test('generates a valid PDF with empty accounts and transactions without crashing', () => {
    const result = generateMonthlyFinancialReportPdf({
      selectedMonth: '2026-10',
      accounts: [],
      accountBalances: [],
      cards: [],
      categories: [],
      transactions: [],
      userName: 'Teste Usuario',
      returnBlob: true,
    });

    assert.strictEqual(result.filename, 'relatorio-financeiro-2026-10.pdf');
    assert.ok(result.doc);
    assert.ok(result.pageCount >= 1);
    assert.ok(result.blob);
    assert.ok(result.blob.size > 0);
  });

  test('generates multi-section report with accounts, category breakdown, vector bars and top expenses', () => {
    const sampleAccounts: BankAccount[] = [
      {
        id: 'acc-1',
        name: 'Nubank Conta Principal',
        institution: 'Nubank',
        type: 'checking',
        initialBalance: 2500,
        color: '#820ad1',
        includeInTotal: true,
      },
      {
        id: 'acc-2',
        name: 'Carteira Física',
        institution: 'Dinheiro',
        type: 'cash',
        initialBalance: 200,
        color: '#10b981',
        includeInTotal: true,
      },
    ];

    const sampleCards: CreditCard[] = [
      {
        id: 'card-1',
        name: 'Nubank Ultravioleta',
        brand: 'Mastercard',
        limit: 15000,
        closingDay: 5,
        dueDay: 12,
        defaultAccountId: 'acc-1',
        color: '#820ad1',
      },
    ];

    const sampleCategories: Category[] = [
      {
        id: 'cat-salario',
        name: 'Salário & Renda',
        type: 'income',
        bucket: 'financial',
        color: '#10b981',
        icon: 'briefcase',
        monthlyBudget: 0,
        subcategories: [],
      },
      {
        id: 'cat-alimentacao',
        name: 'Alimentação & Mercado',
        type: 'expense',
        bucket: 'essential',
        color: '#f59e0b',
        icon: 'utensils',
        monthlyBudget: 1500,
        subcategories: [],
      },
      {
        id: 'cat-moradia',
        name: 'Moradia & Aluguel',
        type: 'expense',
        bucket: 'essential',
        color: '#6366f1',
        icon: 'home',
        monthlyBudget: 2200,
        subcategories: [],
      },
    ];

    const sampleTransactions: Transaction[] = [
      {
        id: 'tx-1',
        description: 'Salário Tech Corp',
        amount: 8500,
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
        id: 'tx-2',
        description: 'Aluguel Apartamento',
        amount: 2200,
        date: '2026-10-10',
        competenceMonth: '2026-10',
        type: 'expense',
        status: 'paid',
        categoryId: 'cat-moradia',
        accountId: 'acc-1',
        paymentMethod: 'pix',
        recurrence: 'single',
      },
      {
        id: 'tx-3',
        description: 'Supermercado Mensal Pão de Açúcar',
        amount: 850.5,
        date: '2026-10-12',
        competenceMonth: '2026-10',
        type: 'expense',
        status: 'paid',
        categoryId: 'cat-alimentacao',
        creditCardId: 'card-1',
        paymentMethod: 'credit_card',
        recurrence: 'single',
      },
    ];

    const result = generateMonthlyFinancialReportPdf({
      selectedMonth: '2026-10',
      accounts: sampleAccounts,
      accountBalances: [],
      cards: sampleCards,
      categories: sampleCategories,
      transactions: sampleTransactions,
      userName: 'Carlos Silva',
      userEmail: 'carlos@exemplo.com.br',
      returnBlob: true,
    });

    assert.strictEqual(result.filename, 'relatorio-financeiro-2026-10.pdf');
    assert.ok(result.pageCount >= 1);
    assert.ok(result.blob && result.blob.size > 2000, 'Blob size should reflect complete PDF contents');
  });
});
