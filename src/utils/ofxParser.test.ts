import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  compactTransactionForStorage,
  convertCandidatesToTransactions,
  extractOfxTag,
  inferCategoryByDescription,
  normalizeCsvDate,
  normalizeOfxDate,
  parseBankAmount,
  parseBankStatement,
  parseBrazilianCSV,
  parseOFX,
  prepareReconciliationCandidates,
} from './ofxParser';
import { Category, Transaction } from '../types/finance';

const MOCK_CATEGORIES: Category[] = [
  {
    id: 'cat-alimentacao',
    name: 'Alimentação & Restaurantes',
    type: 'expense',
    bucket: 'lifestyle',
    monthlyBudget: 800,
    color: '#f97316',
    icon: 'utensils',
    subcategories: [],
  },
  {
    id: 'cat-mercado',
    name: 'Supermercado & Feira',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 1200,
    color: '#10b981',
    icon: 'shopping-cart',
    subcategories: [],
  },
  {
    id: 'cat-transporte',
    name: 'Transporte & Combustível',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 500,
    color: '#06b6d4',
    icon: 'car',
    subcategories: [],
  },
  {
    id: 'cat-saude',
    name: 'Saúde & Farmácia',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 400,
    color: '#ef4444',
    icon: 'heart-pulse',
    subcategories: [],
  },
  {
    id: 'cat-moradia',
    name: 'Moradia & Contas Fixas',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 2500,
    color: '#6366f1',
    icon: 'home',
    subcategories: [],
  },
  {
    id: 'cat-lazer',
    name: 'Lazer & Streaming',
    type: 'expense',
    bucket: 'lifestyle',
    monthlyBudget: 350,
    color: '#8b5cf6',
    icon: 'tv',
    subcategories: [],
  },
  {
    id: 'cat-salario',
    name: 'Salário & Vencimentos',
    type: 'income',
    bucket: 'financial',
    monthlyBudget: 0,
    color: '#059669',
    icon: 'briefcase',
    subcategories: [],
  },
  {
    id: 'cat-outros',
    name: 'Outros Lançamentos',
    type: 'expense',
    bucket: 'lifestyle',
    monthlyBudget: 200,
    color: '#64748b',
    icon: 'tag',
    subcategories: [],
  },
];

describe('ofxParser Unit Tests', () => {
  it('normalizes OFX date strings correctly', () => {
    assert.strictEqual(normalizeOfxDate('20261021120000[-3:BRT]'), '2026-10-21');
    assert.strictEqual(normalizeOfxDate('20261005'), '2026-10-05');
    assert.strictEqual(normalizeOfxDate('2026-10-15'), '2026-10-15');
  });

  it('parses bank amounts in Brazilian and international formats', () => {
    assert.strictEqual(parseBankAmount('-125,50'), -125.5);
    assert.strictEqual(parseBankAmount('-1.250,75'), -1250.75);
    assert.strictEqual(parseBankAmount('3.500,00'), 3500);
    assert.strictEqual(parseBankAmount('-45.80'), -45.8);
    assert.strictEqual(parseBankAmount('1,500.50'), 1500.5);
  });

  it('extracts SGML and XML tags accurately', () => {
    const sgmlBlock = `
      <TRNTYPE>DEBIT
      <DTPOSTED>20261020
      <TRNAMT>-89.90
      <FITID>BRAD-20261020-01
      <MEMO>FARMACIA DROGASIL
    `;
    assert.strictEqual(extractOfxTag(sgmlBlock, 'TRNTYPE'), 'DEBIT');
    assert.strictEqual(extractOfxTag(sgmlBlock, 'FITID'), 'BRAD-20261020-01');
    assert.strictEqual(extractOfxTag(sgmlBlock, 'MEMO'), 'FARMACIA DROGASIL');

    const xmlBlock = `
      <TRNTYPE>CREDIT</TRNTYPE>
      <TRNAMT>4500.00</TRNAMT>
      <FITID>NUBANK-CREDIT-77</FITID>
    `;
    assert.strictEqual(extractOfxTag(xmlBlock, 'TRNTYPE'), 'CREDIT');
    assert.strictEqual(extractOfxTag(xmlBlock, 'TRNAMT'), '4500.00');
    assert.strictEqual(extractOfxTag(xmlBlock, 'FITID'), 'NUBANK-CREDIT-77');
  });

  it('parses full OFX statement with debits, credits, and metadata', () => {
    const rawOfx = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0</CODE>
        <SEVERITY>INFO</SEVERITY>
      </STATUS>
      <DTSERVER>20261025120000</DTSERVER>
      <LANGUAGE>POR</LANGUAGE>
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <CURDEF>BRL</CURDEF>
        <BANKACCTFROM>
          <BANKID>341</BANKID>
          <ACCTID>12345-6</ACCTID>
          <ACCTTYPE>CHECKING</ACCTTYPE>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20261001</DTSTART>
          <DTEND>20261025</DTEND>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261005120000[-3:BRT]
            <TRNAMT>-142.80
            <FITID>ITAU-20261005-01
            <MEMO>SUPERMERCADO CARREFOUR
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20261005120000[-3:BRT]
            <TRNAMT>5800.00
            <FITID>ITAU-20261005-SAL
            <MEMO>TED SALARIO EMPRESA XYZ
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261008120000[-3:BRT]
            <TRNAMT>-45.00
            <FITID>ITAU-20261008-UBER
            <MEMO>UBER TRIP 99281
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
`;

    const result = parseOFX(rawOfx);
    assert.strictEqual(result.fileFormat, 'ofx');
    assert.strictEqual(result.metadata.bankId, '341');
    assert.strictEqual(result.metadata.accountId, '12345-6');
    assert.strictEqual(result.items.length, 3);

    // Carrefour debit
    assert.strictEqual(result.items[0].fitid, 'ITAU-20261005-01');
    assert.strictEqual(result.items[0].date, '2026-10-05');
    assert.strictEqual(result.items[0].amount, 142.8);
    assert.strictEqual(result.items[0].rawType, 'expense');

    // Salary credit
    assert.strictEqual(result.items[1].fitid, 'ITAU-20261005-SAL');
    assert.strictEqual(result.items[1].amount, 5800);
    assert.strictEqual(result.items[1].rawType, 'income');

    assert.strictEqual(result.totalCredits, 5800);
    assert.strictEqual(result.totalDebits, 187.8);
    assert.strictEqual(result.netFlow, 5612.2);
  });

  it('parses Brazilian CSV with semicolon and Brazilian currency', () => {
    const csvContent = `
Data;Descrição;Valor;Identificador
05/10/2026;Pão de Açúcar;-320,50;DOC-1001
08/10/2026;Restaurante Mocotó;-112,00;DOC-1002
10/10/2026;TED Recebida Venda;450,00;DOC-1003
`;

    const res = parseBrazilianCSV(csvContent);
    assert.strictEqual(res.fileFormat, 'csv');
    assert.strictEqual(res.items.length, 3);
    assert.strictEqual(res.items[0].date, '2026-10-05');
    assert.strictEqual(res.items[0].description, 'Pão de Açúcar');
    assert.strictEqual(res.items[0].amount, 320.5);
    assert.strictEqual(res.items[0].rawType, 'expense');

    assert.strictEqual(res.items[2].date, '2026-10-10');
    assert.strictEqual(res.items[2].amount, 450);
    assert.strictEqual(res.items[2].rawType, 'income');
  });

  it('normalizes DD/MM/YYYY dates', () => {
    assert.strictEqual(normalizeCsvDate('25/12/2026'), '2026-12-25');
    assert.strictEqual(normalizeCsvDate('05/01/2026'), '2026-01-05');
    assert.strictEqual(normalizeCsvDate('2026-08-14'), '2026-08-14');
  });

  it('infers Brazilian category keywords accurately', () => {
    assert.strictEqual(
      inferCategoryByDescription('PAGAMENTO IFOOD BRASIL', MOCK_CATEGORIES, 'expense'),
      'cat-alimentacao'
    );
    assert.strictEqual(
      inferCategoryByDescription('CARREFOUR HIPERMERCADO', MOCK_CATEGORIES, 'expense'),
      'cat-mercado'
    );
    assert.strictEqual(
      inferCategoryByDescription('POSTO SHELL COMBUSTIVEL', MOCK_CATEGORIES, 'expense'),
      'cat-transporte'
    );
    assert.strictEqual(
      inferCategoryByDescription('DROGA RAIA FARMACIA', MOCK_CATEGORIES, 'expense'),
      'cat-saude'
    );
    assert.strictEqual(
      inferCategoryByDescription('ENEL ENERGIA ELETRICA', MOCK_CATEGORIES, 'expense'),
      'cat-moradia'
    );
    assert.strictEqual(
      inferCategoryByDescription('NETFLIX ENTRETENIMENTO', MOCK_CATEGORIES, 'expense'),
      'cat-lazer'
    );
    assert.strictEqual(
      inferCategoryByDescription('TED SALARIO FOLHA', MOCK_CATEGORIES, 'income'),
      'cat-salario'
    );
  });

  it('detects duplicate transactions by FITID and by Date/Amount match', () => {
    const existingTransactions: Transaction[] = [
      {
        id: 'tx-001',
        description: 'Posto Ipiranga',
        amount: 200,
        date: '2026-10-10',
        competenceMonth: '2026-10',
        type: 'expense',
        status: 'paid',
        categoryId: 'cat-transporte',
        accountId: 'acc-itaú',
        paymentMethod: 'pix',
        recurrence: 'single',
        fitid: 'FITID-EXISTING-99',
      },
      {
        id: 'tx-002',
        description: 'Almoço Restaurante Real',
        amount: 58.5,
        date: '2026-10-12',
        competenceMonth: '2026-10',
        type: 'expense',
        status: 'paid',
        categoryId: 'cat-alimentacao',
        accountId: 'acc-itaú',
        paymentMethod: 'debit_card',
        recurrence: 'single',
      },
    ];

    const parsedItems = [
      {
        fitid: 'FITID-EXISTING-99',
        date: '2026-10-10',
        amount: 200,
        description: 'Auto Posto Ipiranga',
        rawType: 'expense' as const,
      },
      {
        fitid: 'FITID-NEW-101',
        date: '2026-10-12',
        amount: 58.5,
        description: 'Restaurante Real',
        rawType: 'expense' as const,
      },
      {
        fitid: 'FITID-NEW-102',
        date: '2026-10-15',
        amount: 32.0,
        description: 'Padaria Central',
        rawType: 'expense' as const,
      },
    ];

    const candidates = prepareReconciliationCandidates(
      parsedItems,
      existingTransactions,
      MOCK_CATEGORIES,
      'acc-itaú'
    );

    // First candidate has identical FITID -> duplicate!
    assert.strictEqual(candidates[0].isDuplicate, true);
    assert.strictEqual(candidates[0].selected, false);
    assert.ok(candidates[0].duplicateReason?.includes('FITID'));

    // Second candidate matches date + amount on same account -> duplicate flagged!
    assert.strictEqual(candidates[1].isDuplicate, true);
    assert.strictEqual(candidates[1].selected, false);

    // Third candidate is brand new -> selected!
    assert.strictEqual(candidates[2].isDuplicate, false);
    assert.strictEqual(candidates[2].selected, true);
    assert.strictEqual(candidates[2].suggestedCategoryId, 'cat-alimentacao');
  });

  it('converts candidates into production transactions with batchId and reconciled tag', () => {
    const candidates = [
      {
        id: 'cand-1',
        fitid: 'FIT-1',
        date: '2026-10-18',
        amount: 75.0,
        type: 'expense' as const,
        description: 'Uber *Viagem',
        suggestedCategoryId: 'cat-transporte',
        isDuplicate: false,
        selected: true,
      },
      {
        id: 'cand-2',
        fitid: 'FIT-2',
        date: '2026-10-19',
        amount: 50.0,
        type: 'expense' as const,
        description: 'Supermercado Dia',
        suggestedCategoryId: 'cat-mercado',
        isDuplicate: true,
        selected: false, // Deselected
      },
    ];

    const txs = convertCandidatesToTransactions(candidates, 'acc-nubank', 'batch-test-1');
    assert.strictEqual(txs.length, 1);
    assert.strictEqual(txs[0].description, 'Uber *Viagem');
    assert.strictEqual(txs[0].amount, 75);
    assert.strictEqual(txs[0].date, '2026-10-18');
    assert.strictEqual(txs[0].competenceMonth, '2026-10');
    assert.strictEqual(txs[0].accountId, 'acc-nubank');
    assert.strictEqual(txs[0].fitid, 'FIT-1');
    assert.strictEqual(txs[0].importBatchId, 'batch-test-1');
    assert.strictEqual(txs[0].reconciled, true);
  });

  it('compacts transaction for storage, stripping redundant falsy/empty fields', () => {
    const verboseTx: Transaction = {
      id: 'tx-verb-1',
      description: 'Compra Simples',
      amount: 100,
      date: '2026-10-20',
      competenceMonth: '2026-10',
      type: 'expense',
      status: 'paid',
      categoryId: 'cat-outros',
      paymentMethod: 'pix',
      recurrence: 'single',
      notes: '',
      isShared: false,
      isInvoicePayment: false,
      isAnticipated: false,
      isCompanionOnlyExpense: false,
      reconciled: true,
    };

    const compacted = compactTransactionForStorage(verboseTx);
    assert.strictEqual(compacted.id, 'tx-verb-1');
    assert.strictEqual(compacted.amount, 100);
    assert.strictEqual(compacted.reconciled, true);
    // Redundant falsy/empty fields should be omitted to save bytes
    assert.strictEqual((compacted as any).isShared, undefined);
    assert.strictEqual((compacted as any).isInvoicePayment, undefined);
    assert.strictEqual((compacted as any).isAnticipated, undefined);
    assert.strictEqual((compacted as any).notes, undefined);
  });
});
