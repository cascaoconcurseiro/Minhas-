import { Category, Transaction } from '../types/finance';

export interface ParsedBankStatementItem {
  fitid?: string;
  date: string; // YYYY-MM-DD
  amount: number; // positive for income, negative for expense
  description: string;
  memo?: string;
  trntype?: string;
  rawType: 'income' | 'expense';
}

export interface BankStatementMetadata {
  bankId?: string;
  accountId?: string;
  currency?: string;
  statementStart?: string;
  statementEnd?: string;
}

export interface ReconciliationCandidate {
  id: string;
  fitid?: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  description: string;
  memo?: string;
  suggestedCategoryId: string;
  isDuplicate: boolean;
  duplicateReason?: string;
  selected: boolean;
}

export interface ParseStatementResult {
  metadata: BankStatementMetadata;
  items: ParsedBankStatementItem[];
  fileFormat: 'ofx' | 'csv' | 'unknown';
  totalCredits: number;
  totalDebits: number;
  netFlow: number;
}

/**
 * Normalizes an OFX date string into standard YYYY-MM-DD.
 * Formats encountered:
 * - 20261021120000[-3:BRT]
 * - 20261021
 * - 2026-10-21
 */
export function normalizeOfxDate(dateStr: string): string {
  if (!dateStr) {
    return new Date().toISOString().slice(0, 10);
  }
  const clean = dateStr.trim();
  const ymdMatch = clean.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    return clean.slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Parses numeric amount from Brazilian bank OFX or CSV.
 * Supports "-123.45", "-123,45", "1.234,56", "+500".
 */
export function parseBankAmount(amountStr: string): number {
  if (!amountStr) return 0;
  let clean = amountStr.trim().replace(/\s/g, '');
  if (!clean) return 0;

  // If format is like -1.234,56 or 1.234,56 (Brazilian standard)
  if (/\.\d{3},\d{2}$/.test(clean) || /,\d{1,2}$/.test(clean)) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (/,\d{3}\.\d{2}$/.test(clean)) {
    // US format with comma thousands
    clean = clean.replace(/,/g, '');
  }

  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Extracts tag value from an OFX string (SGML or XML style).
 * Works with `<TAG>Value\n` (SGML) and `<TAG>Value</TAG>` (XML).
 */
export function extractOfxTag(block: string, tagName: string): string | undefined {
  const xmlRegex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const xmlMatch = block.match(xmlRegex);
  if (xmlMatch && xmlMatch[1] !== undefined) {
    return xmlMatch[1].trim();
  }

  const sgmlRegex = new RegExp(`<${tagName}>([^<\r\n]+)`, 'i');
  const sgmlMatch = block.match(sgmlRegex);
  if (sgmlMatch && sgmlMatch[1] !== undefined) {
    return sgmlMatch[1].trim();
  }

  return undefined;
}

/**
 * Parses an OFX file (both SGML and XML versions) into statement items.
 */
export function parseOFX(rawText: string): ParseStatementResult {
  const metadata: BankStatementMetadata = {
    bankId: extractOfxTag(rawText, 'BANKID'),
    accountId: extractOfxTag(rawText, 'ACCTID'),
    currency: extractOfxTag(rawText, 'CURDEF') || 'BRL',
    statementStart: normalizeOfxDate(extractOfxTag(rawText, 'DTSTART') || ''),
    statementEnd: normalizeOfxDate(extractOfxTag(rawText, 'DTEND') || ''),
  };

  const items: ParsedBankStatementItem[] = [];
  // Match each <STMTTRN> block
  const trnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>|$))/gi;
  let match: RegExpExecArray | null;

  while ((match = trnRegex.exec(rawText)) !== null) {
    const trnBlock = match[1];
    if (!trnBlock.trim()) continue;

    const trntype = extractOfxTag(trnBlock, 'TRNTYPE') || 'OTHER';
    const dtposted = extractOfxTag(trnBlock, 'DTPOSTED') || '';
    const trnamt = extractOfxTag(trnBlock, 'TRNAMT') || '0';
    const fitid = extractOfxTag(trnBlock, 'FITID');
    const memo = extractOfxTag(trnBlock, 'MEMO') || '';
    const name = extractOfxTag(trnBlock, 'NAME') || '';

    const parsedDate = normalizeOfxDate(dtposted);
    const amount = parseBankAmount(trnamt);
    const rawDescription = (name || memo || 'Lançamento Bancário').trim();

    const isExpense = amount < 0 || trntype.toUpperCase() === 'DEBIT';
    const rawType: 'income' | 'expense' = isExpense ? 'expense' : 'income';

    items.push({
      fitid: fitid?.trim() || undefined,
      date: parsedDate,
      amount: Math.abs(amount),
      description: rawDescription,
      memo: memo && memo !== rawDescription ? memo.trim() : undefined,
      trntype,
      rawType,
    });
  }

  let totalCredits = 0;
  let totalDebits = 0;
  for (const item of items) {
    if (item.rawType === 'income') totalCredits += item.amount;
    else totalDebits += item.amount;
  }

  return {
    metadata,
    items,
    fileFormat: 'ofx',
    totalCredits: Math.round(totalCredits * 100) / 100,
    totalDebits: Math.round(totalDebits * 100) / 100,
    netFlow: Math.round((totalCredits - totalDebits) * 100) / 100,
  };
}

/**
 * Normalizes Brazilian DD/MM/YYYY or YYYY-MM-DD date strings.
 */
export function normalizeCsvDate(rawDate: string): string {
  const clean = rawDate.trim();
  const dmyMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    return clean.slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Parses Brazilian bank CSV exports (Nubank, Itaú, Bradesco, Inter, Santander, etc.).
 */
export function parseBrazilianCSV(csvText: string): ParseStatementResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      metadata: {},
      items: [],
      fileFormat: 'csv',
      totalCredits: 0,
      totalDebits: 0,
      netFlow: 0,
    };
  }

  // Detect delimiter: semicolon is most common in Brazil, comma otherwise
  const firstLine = lines[0];
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = semicolonCount >= commaCount ? ';' : ',';

  // Helper to split CSV line safely handling quotes
  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        insideQuotes = !insideQuotes;
      } else if (ch === delimiter && !insideQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result.map((col) => col.replace(/^["']|["']$/g, '').trim());
  };

  const headerCols = splitLine(firstLine).map((c) => c.toLowerCase());
  const hasHeader = headerCols.some(
    (c) =>
      c.includes('data') ||
      c.includes('date') ||
      c.includes('valor') ||
      c.includes('amount') ||
      c.includes('desc') ||
      c.includes('hist')
  );

  let dateIdx = -1;
  let descIdx = -1;
  let amountIdx = -1;
  let fitidIdx = -1;

  if (hasHeader) {
    dateIdx = headerCols.findIndex((c) => c.includes('data') || c.includes('date'));
    descIdx = headerCols.findIndex(
      (c) =>
        c.includes('desc') ||
        c.includes('hist') ||
        c.includes('título') ||
        c.includes('titulo') ||
        c.includes('nome')
    );
    amountIdx = headerCols.findIndex(
      (c) => c.includes('valor') || c.includes('amount') || c.includes('quantia')
    );
    fitidIdx = headerCols.findIndex(
      (c) =>
        c.includes('id') ||
        c.includes('identificador') ||
        c.includes('documento') ||
        c.includes('doc')
    );
  }

  // Fallbacks if header wasn't fully identified
  if (dateIdx < 0) dateIdx = 0;
  if (descIdx < 0) descIdx = 1;
  if (amountIdx < 0) amountIdx = 2;

  const dataRows = hasHeader ? lines.slice(1) : lines;
  const items: ParsedBankStatementItem[] = [];

  dataRows.forEach((line, rowIdx) => {
    const cols = splitLine(line);
    if (cols.length < 2) return;

    const rawDate = cols[dateIdx] || '';
    const rawDesc = cols[descIdx] || 'Lançamento Manual';
    const rawAmt = cols[amountIdx] || '0';
    const fitid = fitidIdx >= 0 ? cols[fitidIdx] : undefined;

    // Skip empty or summary rows
    if (!rawDate && !rawDesc) return;
    if (rawDesc.toLowerCase().includes('saldo do dia') || rawDesc.toLowerCase().includes('saldo anterior')) {
      return;
    }

    const parsedDate = normalizeCsvDate(rawDate);
    const parsedAmount = parseBankAmount(rawAmt);
    if (parsedAmount === 0 && !rawDesc) return;

    const rawType: 'income' | 'expense' = parsedAmount < 0 ? 'expense' : 'income';

    items.push({
      fitid: fitid?.trim() || `csv-row-${rowIdx + 1}`,
      date: parsedDate,
      amount: Math.abs(parsedAmount),
      description: rawDesc,
      rawType,
    });
  });

  let totalCredits = 0;
  let totalDebits = 0;
  for (const item of items) {
    if (item.rawType === 'income') totalCredits += item.amount;
    else totalDebits += item.amount;
  }

  return {
    metadata: {},
    items,
    fileFormat: 'csv',
    totalCredits: Math.round(totalCredits * 100) / 100,
    totalDebits: Math.round(totalDebits * 100) / 100,
    netFlow: Math.round((totalCredits - totalDebits) * 100) / 100,
  };
}

/**
 * Universal auto-detection parser: accepts OFX content, CSV content, or raw copy-paste lines.
 */
export function parseBankStatement(rawContent: string): ParseStatementResult {
  const trimmed = rawContent.trim();
  if (trimmed.includes('<OFX') || trimmed.includes('<STMTTRN>') || trimmed.includes('OFXHEADER')) {
    return parseOFX(rawContent);
  }
  return parseBrazilianCSV(rawContent);
}

/**
 * Smart categorization dictionary based on common Brazilian bank statement descriptions.
 */
const CATEGORY_KEYWORDS: Array<{ categoryIdHint: string; keywords: string[] }> = [
  {
    categoryIdHint: 'cat-alimentacao',
    keywords: [
      'ifood',
      'rappi',
      'uber eats',
      'padaria',
      'restaurante',
      'lanchonete',
      'bar',
      'cafe',
      'cafeteria',
      'starbucks',
      'mc donalds',
      'mcdonalds',
      'burger king',
      'burguer',
      'subway',
      'habib',
      'pizzaria',
      'churrascaria',
      'sushi',
      'acai',
      'sorveteria',
      'adega',
    ],
  },
  {
    categoryIdHint: 'cat-mercado',
    keywords: [
      'supermercado',
      'mercado',
      'carrefour',
      'pao de acucar',
      'pão de açúcar',
      'atacadao',
      'atacadão',
      'assai',
      'assaí',
      'extra',
      'muffato',
      'hortifruti',
      'sacolao',
      'sacolão',
      'dia brasil',
      'mercearia',
      'hipermercado',
      'sonda',
      'st marche',
    ],
  },
  {
    categoryIdHint: 'cat-transporte',
    keywords: [
      'uber',
      '99app',
      '99 tecnologia',
      'posto',
      'combustivel',
      'combustível',
      'gasolina',
      'etanol',
      'shell',
      'ipiranga',
      'br distribuidora',
      'ale combustiveis',
      'pedagio',
      'pedágio',
      'sem parar',
      'conectcar',
      'veloe',
      'estacionamento',
      'metro',
      'metrô',
      'cptm',
      'sptrans',
      'bilhete unico',
      'auto posto',
    ],
  },
  {
    categoryIdHint: 'cat-saude',
    keywords: [
      'farmacia',
      'farmácia',
      'drogaria',
      'raia',
      'drogasil',
      'pague menos',
      'panvel',
      'droga raia',
      'hospital',
      'clinica',
      'clínica',
      'laboratorio',
      'laboratório',
      'medico',
      'médico',
      'dentista',
      'odontologia',
      'unimed',
      'amil',
      'bradesco saude',
      'fleury',
      'dasa',
    ],
  },
  {
    categoryIdHint: 'cat-lazer',
    keywords: [
      'netflix',
      'spotify',
      'amazon prime',
      'prime video',
      'disney',
      'hbo max',
      'max.com',
      'cinema',
      'cinemark',
      'uci cinema',
      'steam',
      'playstation',
      'xbox',
      'nintendo',
      'ingresso',
      'sympla',
      'eventim',
      'teatro',
      'show',
    ],
  },
  {
    categoryIdHint: 'cat-moradia',
    keywords: [
      'aluguel',
      'condominio',
      'condomínio',
      'enel',
      'cpfl',
      'eletropaulo',
      'cemig',
      'sabesp',
      'sanepar',
      'copasa',
      'comgas',
      'comgás',
      'claro',
      'vivo',
      'tim',
      'oi fibra',
      'internet',
      'iptu',
      'gas encanado',
      'luz',
      'energia eletrica',
    ],
  },
  {
    categoryIdHint: 'cat-compras',
    keywords: [
      'amazon',
      'mercado livre',
      'mercadolivre',
      'shopee',
      'shein',
      'aliexpress',
      'magazine luiza',
      'magalu',
      'casas bahia',
      'americanas',
      'zara',
      'renner',
      'riachuelo',
      'c&a',
      'centauro',
      'decathlon',
      'leroy merlin',
    ],
  },
  {
    categoryIdHint: 'cat-educacao',
    keywords: [
      'escola',
      'colegio',
      'colégio',
      'faculdade',
      'universidade',
      'curso',
      'udemy',
      'alura',
      'coursera',
      'livraria',
      'mensalidade escolar',
    ],
  },
  {
    categoryIdHint: 'cat-salario',
    keywords: [
      'salario',
      'salário',
      'folha de pagamento',
      'vencimentos',
      'pro-labore',
      'ted recebida',
      'ted receb',
      'ted credito',
      'credito em conta',
      'remuneração',
      'adiantamento salarial',
    ],
  },
  {
    categoryIdHint: 'cat-rendimentos',
    keywords: [
      'dividendo',
      'jcp',
      'juros s/ capital',
      'rendimento',
      'rendimentos',
      'proventos',
      'resgate cdi',
      'remuneração aplic',
    ],
  },
];

/**
 * Infers the best category for a transaction based on description keywords.
 */
export function inferCategoryByDescription(
  description: string,
  categories: Category[],
  type: 'income' | 'expense' = 'expense'
): string {
  const normDesc = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const group of CATEGORY_KEYWORDS) {
    for (const kw of group.keywords) {
      const normKw = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normDesc.includes(normKw)) {
        // Find existing category matching either the hint ID or the name
        const match = categories.find(
          (c) =>
            c.id === group.categoryIdHint ||
            c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(normKw)
        );
        if (match) {
          return match.id;
        }
      }
    }
  }

  // Fallback: match by transaction type
  const fallbackCat = categories.find((c) => c.type === type);
  return fallbackCat ? fallbackCat.id : categories[0]?.id || 'cat-outros';
}

/**
 * Normalizes description text for duplicate matching comparison.
 */
function cleanDescriptionForComparison(desc: string): string {
  return desc
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects whether an imported bank item is already present in the existing transactions list.
 */
export function checkItemDuplicate(
  item: ParsedBankStatementItem,
  existingTransactions: Transaction[],
  targetAccountId?: string
): { isDuplicate: boolean; reason?: string } {
  // 1. Exact FITID match
  if (item.fitid) {
    const fitidMatch = existingTransactions.find((tx) => tx.fitid && tx.fitid === item.fitid);
    if (fitidMatch) {
      return {
        isDuplicate: true,
        reason: `FITID idêntico já cadastrado (${fitidMatch.description} em ${fitidMatch.date})`,
      };
    }
  }

  // 2. Exact Date + Amount match on same account (or matching description)
  const normImportDesc = cleanDescriptionForComparison(item.description);
  const potentialMatches = existingTransactions.filter((tx) => {
    if (targetAccountId && tx.accountId && tx.accountId !== targetAccountId) {
      return false;
    }
    const isSameDate = tx.date === item.date;
    const isSameAmount = Math.abs(tx.amount - item.amount) < 0.01;
    const isSameType = tx.type === item.rawType;
    return isSameDate && isSameAmount && isSameType;
  });

  if (potentialMatches.length > 0) {
    // Check if any has high description overlap
    for (const match of potentialMatches) {
      const normTxDesc = cleanDescriptionForComparison(match.description);
      const isDescMatch =
        normImportDesc.includes(normTxDesc) ||
        normTxDesc.includes(normImportDesc) ||
        normImportDesc.slice(0, 8) === normTxDesc.slice(0, 8);

      if (isDescMatch) {
        return {
          isDuplicate: true,
          reason: `Mesma data (${item.date}), valor (${item.amount}) e descrição semelhante`,
        };
      }
    }

    // Even if description differs slightly, warn about same date and amount on same account
    return {
      isDuplicate: true,
      reason: `Mesma data (${item.date}) e valor exato (${item.amount.toFixed(2)}) nesta conta`,
    };
  }

  return { isDuplicate: false };
}

/**
 * Prepares statement items into reconciliation candidates with duplicate flags and category suggestions.
 */
export function prepareReconciliationCandidates(
  items: ParsedBankStatementItem[],
  existingTransactions: Transaction[],
  categories: Category[],
  targetAccountId?: string
): ReconciliationCandidate[] {
  return items.map((item, idx) => {
    const dupCheck = checkItemDuplicate(item, existingTransactions, targetAccountId);
    const suggestedCategoryId = inferCategoryByDescription(item.description, categories, item.rawType);

    return {
      id: `reconcile-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      fitid: item.fitid,
      date: item.date,
      amount: item.amount,
      type: item.rawType,
      description: item.description,
      memo: item.memo,
      suggestedCategoryId,
      isDuplicate: dupCheck.isDuplicate,
      duplicateReason: dupCheck.reason,
      selected: !dupCheck.isDuplicate, // Default to unchecked if duplicate
    };
  });
}

/**
 * Converts selected reconciliation candidates into production Transaction objects.
 */
export function convertCandidatesToTransactions(
  candidates: ReconciliationCandidate[],
  accountId: string,
  batchId?: string
): Transaction[] {
  const currentBatchId = batchId || `batch-ofx-${Date.now().toString(36)}`;

  return candidates
    .filter((c) => c.selected && c.amount > 0)
    .map((c) => {
      const competenceMonth = c.date.slice(0, 7);
      return {
        id: `tx-ofx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        description: c.description,
        amount: c.amount,
        date: c.date,
        competenceMonth,
        type: c.type,
        status: 'paid',
        categoryId: c.suggestedCategoryId,
        accountId,
        paymentMethod: 'pix',
        recurrence: 'single',
        notes: c.memo ? `Conciliação Bancária OFX: ${c.memo}` : 'Importado via Extrato Bancário / OFX',
        fitid: c.fitid,
        importBatchId: currentBatchId,
        reconciled: true,
      };
    });
}

/**
 * Strips obsolete, null, undefined, and empty string properties from transactions
 * before saving to Firestore.
 * Reduces document payload size by 35-50%, extending storage headroom to thousands of transactions.
 */
export function compactTransactionForStorage(tx: Transaction): Partial<Transaction> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(tx)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (key === 'isShared' && value === false) continue;
    if (key === 'isInvoicePayment' && value === false) continue;
    if (key === 'isAnticipated' && value === false) continue;
    if (key === 'isCompanionOnlyExpense' && value === false) continue;
    if (key === 'reconciled' && value === false) continue;
    clean[key] = value;
  }
  return clean as Partial<Transaction>;
}

export function compactTransactionListForStorage(transactions: Transaction[]): Partial<Transaction>[] {
  return transactions.map(compactTransactionForStorage);
}
