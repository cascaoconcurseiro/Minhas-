import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  compactTransactionForStorage,
  convertCandidatesToTransactions,
  extractOfxTag,
  inferCategoryByDescription,
  matchCategoryByDescription,
  normalizeCsvDate,
  normalizeOfxDate,
  parseBankAmount,
  parseBankStatement,
  parseBrazilianCSV,
  parseOFX,
  prepareReconciliationCandidates,
} from './ofxParser';
import { Category, CreditCard, Transaction } from '../types/finance';
import { INITIAL_CATEGORIES } from './seedData';
import { applyReconciledBankTransactions } from './financeRules';

const MOCK_CATEGORIES: Category[] = [
  {
    id: 'cat-alimentacao',
    name: 'Alimentação & Restaurantes',
    type: 'expense',
    bucket: 'lifestyle',
    monthlyBudget: 800,
    color: '#f97316',
    icon: 'utensils',
  },
  {
    id: 'cat-mercado',
    name: 'Supermercado & Feira',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 1200,
    color: '#10b981',
    icon: 'shopping-cart',
  },
  {
    id: 'cat-transporte',
    name: 'Transporte & Combustível',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 500,
    color: '#06b6d4',
    icon: 'car',
  },
  {
    id: 'cat-saude',
    name: 'Saúde & Farmácia',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 400,
    color: '#ef4444',
    icon: 'heart-pulse',
  },
  {
    id: 'cat-moradia',
    name: 'Moradia & Contas Fixas',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 2500,
    color: '#6366f1',
    icon: 'home',
  },
  {
    id: 'cat-lazer',
    name: 'Lazer & Streaming',
    type: 'expense',
    bucket: 'lifestyle',
    monthlyBudget: 350,
    color: '#8b5cf6',
    icon: 'tv',
  },
  {
    id: 'cat-salario',
    name: 'Salário & Vencimentos',
    type: 'income',
    bucket: 'financial',
    monthlyBudget: 0,
    color: '#059669',
    icon: 'briefcase',
  },
  {
    id: 'cat-outros',
    name: 'Outros Lançamentos',
    type: 'expense',
    bucket: 'lifestyle',
    monthlyBudget: 200,
    color: '#64748b',
    icon: 'tag',
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

  it('rejects malformed amounts and impossible dates instead of converting them to zero or today', () => {
    assert.ok(Number.isNaN(parseBankAmount('12abc')));
    assert.ok(Number.isNaN(parseBankAmount('1.23,45')));
    assert.strictEqual(normalizeCsvDate('31/02/2026'), '');
    assert.strictEqual(normalizeCsvDate('2026-13-01'), '');
    assert.strictEqual(normalizeOfxDate('20260230'), '');
    assert.strictEqual(normalizeOfxDate(''), '');
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
    assert.strictEqual(result.metadata.currency, 'BRL');
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

  it('keeps OFX currency unknown when CURDEF is absent', () => {
    const result = parseOFX('<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261106</DTPOSTED><TRNAMT>-12.50</TRNAMT></STMTTRN></BANKTRANLIST></OFX>');
    assert.equal(result.metadata.currency, undefined);
    assert.equal(result.items.length, 1);
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

  it('skips CSV rows with invalid date or amount rather than inventing a valid transaction', () => {
    const result = parseBrazilianCSV('Data;Descrição;Valor\n31/02/2026;Data impossível;12,00\n05/10/2026;Valor inválido;12abc\n06/10/2026;Compra válida;-10,50');
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].description, 'Compra válida');
    assert.strictEqual(result.items[0].date, '2026-10-06');
    assert.strictEqual(result.items[0].amount, 10.5);
    assert.strictEqual(result.skippedInvalidCount, 2);
  });

  it('skips OFX transactions with missing, invalid, or zero amounts', () => {
    const result = parseOFX(`<OFX><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261001<TRNAMT>12abc</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261002</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261003<TRNAMT>0.00</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261004<TRNAMT>-12.34</STMTTRN>
</BANKTRANLIST></OFX>`);
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].date, '2026-10-04');
    assert.strictEqual(result.items[0].amount, 12.34);
    assert.strictEqual(result.skippedInvalidCount, 3);
  });

  it('infers Brazilian category keywords accurately', () => {
    const cases: Array<[string, 'expense' | 'income', string]> = [
      ['PAGAMENTO IFOOD BRASIL', 'expense', 'cat-restaurantes'],
      ['PADARIA PAO QUENTE', 'expense', 'cat-cafe'],
      ['CARREFOUR HIPERMERCADO', 'expense', 'cat-mercado'],
      ['SUPERMERCADO APOLO', 'expense', 'cat-mercado'],
      ['POSTO SHELL COMBUSTIVEL', 'expense', 'cat-transporte'],
      ['UBER *TRIP', 'expense', 'cat-transporte'],
      ['OFICINA MECANICA DO ZE', 'expense', 'cat-veiculo'],
      ['DROGA RAIA FARMACIA', 'expense', 'cat-farmacia'],
      ['UNIMED PLANO DE SAUDE', 'expense', 'cat-plano-saude'],
      ['CLINICA SAO LUCAS', 'expense', 'cat-saude'],
      ['PETZ PET SHOP', 'expense', 'cat-pets'],
      ['ENEL ENERGIA ELETRICA', 'expense', 'cat-contas'],
      ['VIVO FIBRA INTERNET', 'expense', 'cat-internet'],
      ['ALUGUEL APARTAMENTO', 'expense', 'cat-moradia'],
      ['NETFLIX ENTRETENIMENTO', 'expense', 'cat-assinaturas'],
      ['CINEMARK INGRESSO', 'expense', 'cat-lazer'],
      ['LATAM AIRLINES PASSAGEM', 'expense', 'cat-viagens'],
      ['SMART FIT ACADEMIA', 'expense', 'cat-academia'],
      ['BARBEARIA DO JOAO', 'expense', 'cat-beleza'],
      ['LOJAS RENNER', 'expense', 'cat-vestuario'],
      ['LEROY MERLIN', 'expense', 'cat-casa-decoracao'],
      ['MERCADO LIVRE COMPRA', 'expense', 'cat-compras'],
      ['IPVA 2026 DETRAN', 'expense', 'cat-impostos'],
      ['TARIFA BANCARIA CESTA', 'expense', 'cat-tarifas'],
      ['EMPRESTIMO CONSIGNADO', 'expense', 'cat-dividas'],
      ['ESCOLA COLEGIO MENSALIDADE', 'expense', 'cat-educacao'],
      ['DIZIMO IGREJA', 'expense', 'cat-doacoes'],
      ['TED SALARIO FOLHA', 'income', 'cat-salario'],
      ['13O SALARIO', 'income', 'cat-13-ferias'],
      ['DIVIDENDO FII', 'income', 'cat-rendimentos'],
      ['RESTITUICAO IMPOSTO DE RENDA', 'income', 'cat-restituicao-ir'],
      ['REEMBOLSO DESPESA', 'income', 'cat-reembolsos'],
    ];
    for (const [description, type, expected] of cases) {
      assert.strictEqual(
        inferCategoryByDescription(description, INITIAL_CATEGORIES, type),
        expected,
        `${description} -> ${expected}`
      );
    }
  });

  it('matches common merchants to a category and stays silent for unknown text', () => {
    assert.deepStrictEqual(
      matchCategoryByDescription('Compra na Amazon', INITIAL_CATEGORIES, 'expense'),
      { categoryId: 'cat-compras' }
    );
    assert.deepStrictEqual(
      matchCategoryByDescription('AMAZON PRIME VIDEO', INITIAL_CATEGORIES, 'expense'),
      { categoryId: 'cat-assinaturas' }
    );
    assert.strictEqual(matchCategoryByDescription('BARCLAYS SERVICOS FINANCEIROS', INITIAL_CATEGORIES, 'expense'), null);
    assert.strictEqual(matchCategoryByDescription('Estabelecimento sem regra', INITIAL_CATEGORIES, 'expense'), null);
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

  it('selects only the first occurrence of a repeated FITID in the same statement', () => {
    const candidates = prepareReconciliationCandidates(
      [
        { fitid: 'BANK-ROW-1', date: '2026-10-20', amount: 25.5, description: 'Mercado', rawType: 'expense' },
        { fitid: ' BANK-ROW-1 ', date: '2026-10-20', amount: 25.5, description: 'Mercado', rawType: 'expense' },
      ],
      [],
      MOCK_CATEGORIES,
      'acc-itaú'
    );

    assert.equal(candidates[0].selected, true);
    assert.equal(candidates[0].isDuplicate, false);
    assert.equal(candidates[1].selected, false);
    assert.equal(candidates[1].isDuplicate, true);
    assert.ok(candidates[1].duplicateReason?.includes('repetido neste arquivo'));
  });

  it('converts foreign statement rows to BRL, preserves source currency/rate, and matches duplicates by original amount', () => {
    const item = {
      fitid: 'USD-ROW-1', date: '2026-11-06', amount: 12.5,
      description: 'Compra internacional', rawType: 'expense' as const,
    };
    const existing: Transaction = {
      id: 'existing-usd', description: item.description, amount: 62.5,
      originalAmount: 12.5, originalCurrency: 'USD', exchangeRate: 5,
      date: item.date, competenceMonth: '2026-11', type: 'expense',
      status: 'paid', categoryId: 'cat-outros', accountId: 'acc-usd',
      paymentMethod: 'debit_card', recurrence: 'single',
    };

    const [candidate] = prepareReconciliationCandidates(
      [item], [], MOCK_CATEGORIES, 'acc-usd', [], { currency: 'USD', exchangeRate: 5.2 }
    );
    assert.equal(candidate.amount, 65);
    assert.equal(candidate.sourceAmount, 12.5);
    assert.equal(candidate.originalCurrency, 'USD');
    assert.equal(candidate.exchangeRate, 5.2);

    const [transaction] = convertCandidatesToTransactions([candidate], 'acc-usd', 'usd-import');
    assert.equal(transaction.amount, 65);
    assert.equal(transaction.originalAmount, 12.5);
    assert.equal(transaction.originalCurrency, 'USD');
    assert.equal(transaction.exchangeRate, 5.2);
    assert.equal(transaction.currencyRegime, 'global_account');

    const [duplicate] = prepareReconciliationCandidates(
      [item], [existing], MOCK_CATEGORIES, 'acc-usd', [], { currency: 'USD', exchangeRate: 5.2 }
    );
    assert.equal(duplicate.isDuplicate, true);
    assert.equal(duplicate.selected, false);
  });

  it('recognizes a uniquely matching statement row as a card invoice settlement', () => {
    const card: CreditCard = {
      id: 'card-nubank', name: 'Nubank', brand: 'Mastercard', limit: 5000,
      closingDay: 20, dueDay: 28, defaultAccountId: 'acc-nubank', color: '#820ad1',
    };
    const purchase: Transaction = {
      id: 'purchase-nubank', description: 'Compra online', amount: 100,
      date: '2026-10-10', competenceMonth: '2026-10', type: 'expense',
      status: 'pending', categoryId: 'cat-outros', creditCardId: card.id,
      paymentMethod: 'credit_card', recurrence: 'single',
    };
    const [candidate] = prepareReconciliationCandidates(
      [{ fitid: 'FIT-INVOICE-1', date: '2026-10-28', amount: 100, description: 'PAGAMENTO FATURA NUBANK', rawType: 'expense' }],
      [purchase], INITIAL_CATEGORIES, 'acc-nubank', [card]
    );

    assert.equal(candidate.isPotentialInvoicePayment, true);
    assert.equal(candidate.isInvoicePayment, true);
    assert.equal(candidate.settledCardId, card.id);
    assert.equal(candidate.settledInvoiceMonth, '2026-10');
    assert.equal(candidate.selected, true);

    const [imported] = convertCandidatesToTransactions([candidate], 'acc-nubank', 'import-test');
    assert.equal(imported.isInvoicePayment, true);
    assert.equal(imported.settledCardId, card.id);
    assert.equal(imported.settledInvoiceMonth, '2026-10');

    const secondCard: CreditCard = { ...card, id: 'card-second', name: 'Outro Cartão' };
    const ambiguous = prepareReconciliationCandidates(
      [{ date: '2026-10-28', amount: 100, description: 'PAGAMENTO FATURA', rawType: 'expense' }],
      [purchase, { ...purchase, id: 'purchase-second', creditCardId: secondCard.id }],
      INITIAL_CATEGORIES, 'acc-nubank', [card, secondCard]
    )[0];
    assert.equal(ambiguous.isPotentialInvoicePayment, true);
    assert.equal(ambiguous.isInvoicePayment, false);
    assert.equal(ambiguous.settledCardId, undefined);
    assert.equal(ambiguous.selected, false);
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

describe('smart statement import', () => {
  const account = 'acc-main';
  const cats = INITIAL_CATEGORIES;
  const item = (over: Partial<{ date: string; description: string; amount: number; rawType: 'income' | 'expense'; fitid: string }> = {}) => ({
    date: '2026-11-10', description: 'APOLO SUPERMERCADO', amount: 135, rawType: 'expense' as const, fitid: 'F1', ...over,
  });
  const existing = (over: Partial<Transaction>): Transaction => ({
    id: 'e1', description: 'Apolo', amount: 135, date: '2026-11-08', competenceMonth: '2026-11', type: 'expense',
    status: 'paid', categoryId: 'cat-mercado', paymentMethod: 'pix', recurrence: 'single', accountId: account, ...over,
  });
  const fran = { id: 'fam-fran', name: 'FRAN', color: '#ec4899', relationship: 'cônjuge' } as never;

  it('uses the person\'s own history to choose the category before generic rules', () => {
    const history = [
      existing({ id: 'h1', description: 'Padaria do Zé', categoryId: 'cat-restaurantes', date: '2026-10-01' }),
      existing({ id: 'h2', description: 'Padaria do Zé', categoryId: 'cat-restaurantes', date: '2026-10-08' }),
    ];
    const [candidate] = prepareReconciliationCandidates([item({ description: 'PADARIA DO ZE', amount: 20 })], history, cats, account);
    assert.equal(candidate.suggestedCategoryId, 'cat-restaurantes', 'o histórico vence a regra de "padaria"');
    assert.equal(candidate.suggestedCategorySource, 'history');

    const [byRule] = prepareReconciliationCandidates([item({ description: 'SMART FIT ACADEMIA', amount: 99 })], [], cats, account);
    assert.equal(byRule.suggestedCategoryId, 'cat-academia');
    assert.equal(byRule.suggestedCategorySource, 'rule');
  });

  it('settles the pending bill that matches instead of creating a duplicate', () => {
    const pending = existing({ id: 'p1', description: 'Apolo mercado', status: 'pending', date: '2026-11-12' });
    const [candidate] = prepareReconciliationCandidates([item()], [pending], cats, account);
    assert.equal(candidate.matchedPendingId, 'p1');
    assert.equal(candidate.isDuplicate, false);
    assert.equal(candidate.selected, true);

    const created = convertCandidatesToTransactions([candidate], account, 'b1');
    assert.equal(created[0].settlesPendingTransactionId, 'p1');
    const result = applyReconciledBankTransactions([pending], created, []);
    assert.equal(result.updatedTransactions.length, 1, 'não duplica o lançamento');
    assert.equal(result.updatedTransactions[0].status, 'paid');
    assert.equal(result.updatedTransactions[0].date, '2026-11-10', 'usa a data real do extrato');
    assert.equal(result.updatedTransactions[0].fitid, 'F1');
    assert.equal(result.updatedTransactions[0].reconciled, true);
    assert.equal(result.importedCount, 1);
  });

  it('does not match when the value, the dates or the type are different, or when it is ambiguous', () => {
    const base = existing({ id: 'p1', description: 'Apolo mercado', status: 'pending', date: '2026-11-12' });
    const match = (pending: Transaction[], overrides = {}) =>
      prepareReconciliationCandidates([item(overrides)], pending, cats, account)[0].matchedPendingId;
    assert.equal(match([{ ...base, amount: 140 }]), undefined, 'valor diferente');
    assert.equal(match([{ ...base, date: '2026-12-20' }]), undefined, 'data muito distante');
    assert.equal(match([{ ...base, type: 'income' }]), undefined, 'tipo diferente');
    assert.equal(match([base, { ...base, id: 'p2' }]), undefined, 'duas contas iguais: a pessoa decide');
    assert.equal(match([{ ...base, creditCardId: 'card-1' }]), undefined, 'compra de cartão não é conta pendente');
  });

  it('a pending bill is claimed by one statement line only', () => {
    const pending = existing({ id: 'p1', description: 'Apolo mercado', status: 'pending', date: '2026-11-12' });
    const result = prepareReconciliationCandidates(
      [item({ fitid: 'F1' }), item({ fitid: 'F2', date: '2026-11-11' })], [pending], cats, account
    );
    assert.equal(result.filter((candidate) => candidate.matchedPendingId === 'p1').length, 1);
  });

  it('applies the split the person usually makes for that place and carries it to the new transaction', () => {
    const history = ['h1', 'h2', 'h3'].map((id, i) =>
      existing({ id, description: 'Apolo', date: `2026-10-0${i + 1}`, isShared: true, sharedMemberId: 'fam-fran', sharedAmount: 67.5, sharedPaidBy: 'me', sharedSplitMode: 'half', sharedStatus: 'pending' })
    );
    const [candidate] = prepareReconciliationCandidates([item()], history, cats, account, [], {}, [fran]);
    assert.equal(candidate.learnedSharing?.memberId, 'fam-fran');
    const [tx] = convertCandidatesToTransactions([candidate], account, 'b1');
    assert.equal(tx.isShared, true);
    assert.equal(tx.sharedMemberId, 'fam-fran');
    assert.equal(tx.sharedAmount, 67.5);
    assert.equal(tx.sharedSplitMode, 'half');
    assert.equal(tx.settlesPendingTransactionId, undefined);

    const [income] = prepareReconciliationCandidates([item({ rawType: 'income' })], history, cats, account, [], {}, [fran]);
    assert.equal(income.learnedSharing, undefined, 'receita não é dividida');
  });

  it('keeps flagging a real duplicate and never stores the transient settle field', () => {
    const paid = existing({ id: 'e1', description: 'Apolo', date: '2026-11-10', status: 'paid' });
    const [dup] = prepareReconciliationCandidates([item()], [paid], cats, account);
    assert.equal(dup.isDuplicate, true);
    assert.equal(dup.matchedPendingId, undefined);

    const orphan = { ...existing({ id: 'new1' }), settlesPendingTransactionId: 'gone' };
    const result = applyReconciledBankTransactions([], [orphan], []);
    assert.equal(result.updatedTransactions.length, 1);
    assert.equal('settlesPendingTransactionId' in result.updatedTransactions[0], false);
  });
});
