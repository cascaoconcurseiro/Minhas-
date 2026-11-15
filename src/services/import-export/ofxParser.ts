import { Category, CreditCard, CurrencyCode, FamilyMember, Transaction } from '../../types/finance';
import { matchCategoryByDescription } from '../../domain/finance/categoryMatching';
import { calculateSharedAmount } from '../../domain/finance/financeRules';
import { learnCategoryHabit } from '../../domain/budgets/decisionEngine';
import { buildEstablishmentIndex, learnSharingFromHistory, normalizeDescription, type LearnedSharing } from '../../domain/budgets/learningRules';

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
  sourceAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;
  type: 'income' | 'expense';
  description: string;
  memo?: string;
  suggestedCategoryId: string;
  isPotentialInvoicePayment?: boolean;
  isInvoicePayment?: boolean;
  settledCardId?: string;
  settledInvoiceMonth?: string;
  isDuplicate: boolean;
  duplicateReason?: string;
  selected: boolean;
  /** De onde veio a categoria sugerida: do histórico da pessoa ou de uma regra de estabelecimento. */
  suggestedCategorySource?: 'history' | 'rule';
  /** Conta pendente que esta linha do extrato quita (em vez de criar um lançamento novo). */
  matchedPendingId?: string;
  matchedPendingDescription?: string;
  /** Divisão com familiar aprendida com o histórico para este estabelecimento. */
  learnedSharing?: LearnedSharing;
}

export interface ParseStatementResult {
  metadata: BankStatementMetadata;
  items: ParsedBankStatementItem[];
  fileFormat: 'ofx' | 'csv' | 'unknown';
  totalCredits: number;
  totalDebits: number;
  netFlow: number;
  skippedInvalidCount: number;
}

/**
 * Normalizes an OFX date string into standard YYYY-MM-DD.
 * Formats encountered:
 * - 20261021120000[-3:BRT]
 * - 20261021
 * - 2026-10-21
 */
export function normalizeOfxDate(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  const ymdMatch = clean.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return isValidCalendarDate(`${year}-${month}-${day}`) ? `${year}-${month}-${day}` : '';
  }
  const isoMatch = clean.match(/^(\d{4}-\d{2}-\d{2})(?:$|\s|T)/);
  if (isoMatch && isValidCalendarDate(isoMatch[1])) {
    return isoMatch[1];
  }
  return '';
}

function isValidCalendarDate(isoDate: string): boolean {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Parses numeric amount from Brazilian bank OFX or CSV.
 * Supports "-123.45", "-123,45", "1.234,56", "+500".
 */
export function parseBankAmount(amountStr: string): number {
  let clean = amountStr.trim().replace(/R\$/gi, '').replace(/\s/g, '');
  // Contabilidade: (123,45) e 123,45- significam valor negativo
  const parenthesized = /^\(.*\)$/.test(clean);
  if (parenthesized) clean = clean.slice(1, -1);
  const trailingMinus = /^[\d.,]+-$/.test(clean);
  if (trailingMinus) clean = clean.slice(0, -1);
  if ((parenthesized || trailingMinus) && !clean.startsWith('-')) clean = `-${clean.replace(/^\+/, '')}`;
  if (!clean || !/^[+-]?[\d.,]+$/.test(clean)) return Number.NaN;
  const sign = clean.startsWith('-') ? '-' : '';
  clean = clean.replace(/^[+-]/, '');
  if (!clean || !/\d/.test(clean)) return Number.NaN;

  const comma = clean.lastIndexOf(',');
  const dot = clean.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? ',' : '.';
    const groupingSeparator = decimalSeparator === ',' ? '.' : ',';
    const [integerPart, fractionPart] = clean.split(decimalSeparator);
    if (!fractionPart || fractionPart.length > 2 || !/^\d+$/.test(fractionPart)) return Number.NaN;
    const groups = integerPart.split(groupingSeparator);
    if (!/^\d{1,3}$/.test(groups[0]) || groups.slice(1).some((group) => !/^\d{3}$/.test(group))) return Number.NaN;
    clean = `${groups.join('')}.${fractionPart}`;
  } else if (comma >= 0 || dot >= 0) {
    const separator = comma >= 0 ? ',' : '.';
    const groups = clean.split(separator);
    if (groups.some((group) => !/^\d+$/.test(group))) return Number.NaN;
    if (groups.length > 2) {
      if (groups.slice(1).some((group) => !/^\d{3}$/.test(group))) return Number.NaN;
      clean = groups.join('');
    } else if (groups[1].length === 3 && groups[0].length <= 3) {
      clean = groups.join('');
    } else {
      if (groups[1].length > 2) return Number.NaN;
      clean = `${groups[0]}.${groups[1]}`;
    }
  }
  const num = Number(`${sign}${clean}`);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : Number.NaN;
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
    currency: extractOfxTag(rawText, 'CURDEF')?.toUpperCase(),
    statementStart: normalizeOfxDate(extractOfxTag(rawText, 'DTSTART') || ''),
    statementEnd: normalizeOfxDate(extractOfxTag(rawText, 'DTEND') || ''),
  };

  const items: ParsedBankStatementItem[] = [];
  let skippedInvalidCount = 0;
  // Match each <STMTTRN> block
  const trnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>|$))/gi;
  let match: RegExpExecArray | null;

  while ((match = trnRegex.exec(rawText)) !== null) {
    const trnBlock = match[1];
    if (!trnBlock.trim()) continue;

    const trntype = extractOfxTag(trnBlock, 'TRNTYPE') || 'OTHER';
    const dtposted = extractOfxTag(trnBlock, 'DTPOSTED') || '';
    const trnamt = extractOfxTag(trnBlock, 'TRNAMT') || '';
    const fitid = extractOfxTag(trnBlock, 'FITID');
    const memo = extractOfxTag(trnBlock, 'MEMO') || '';
    const name = extractOfxTag(trnBlock, 'NAME') || '';

    const parsedDate = normalizeOfxDate(dtposted);
    const amount = parseBankAmount(trnamt);
    if (!parsedDate || !Number.isFinite(amount) || amount === 0) {
      skippedInvalidCount += 1;
      continue;
    }
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
    skippedInvalidCount,
  };
}

/**
 * Normalizes Brazilian DD/MM/YYYY or YYYY-MM-DD date strings.
 */
export function normalizeCsvDate(rawDate: string): string {
  const clean = rawDate.trim();
  const dmyMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    return isValidCalendarDate(normalized) ? normalized : '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean) && isValidCalendarDate(clean)) {
    return clean;
  }
  return '';
}

/**
 * Identificador criado para linhas de CSV sem coluna de ID: depende do conteúdo (data, valor, descrição e a
 * ordem entre linhas iguais), não da posição da linha. Com a posição, o arquivo seguinte do mesmo banco gerava
 * os mesmos ids e as linhas novas eram tratadas como repetidas.
 */
function syntheticCsvFitid(date: string, amount: number, description: string, counts: Map<string, number>): string {
  const slug = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
  const key = `csv-${date}-${Math.round(amount * 100)}-${slug}`;
  const next = (counts.get(key) ?? 0) + 1;
  counts.set(key, next);
  return `${key}-${next}`;
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
      skippedInvalidCount: 0,
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
  let extraDescIdx = -1;
  let fitidIdx = -1;
  let debitIdx = -1;
  let creditIdx = -1;
  let typeIdx = -1;

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
    // Extratos com "Histórico" e "Descrição" separados (ex.: Inter): junta os dois para não perder o nome
    if (descIdx >= 0 && headerCols[descIdx].includes('hist')) {
      extraDescIdx = headerCols.findIndex((c, index) => index !== descIdx && c.includes('desc'));
    }
    debitIdx = headerCols.findIndex((c) => /^(d[ée]bito|debit|sa[ií]da|saidas?|valor d[ée]bito)s?$/.test(c));
    creditIdx = headerCols.findIndex((c) => /^(cr[ée]dito|credit|entrada|entradas|valor cr[ée]dito)s?$/.test(c));
    typeIdx = headerCols.findIndex((c) => /^(d\/c|c\/d|dc|natureza|tipo|tipo lan[cç]amento|d[ée]bito\/cr[ée]dito|cr[ée]dito\/d[ée]bito)$/.test(c));
    fitidIdx = headerCols.findIndex(
      (c) =>
        c.includes('id') ||
        c.includes('identificador') ||
        c.includes('documento') ||
        c.includes('doc')
    );
  }

  const hasAmountHeader = amountIdx >= 0;
  // Fallbacks if header wasn't fully identified
  if (dateIdx < 0) dateIdx = 0;
  if (descIdx < 0) descIdx = 1;
  if (amountIdx < 0) amountIdx = 2;

  const dataRows = hasHeader ? lines.slice(1) : lines;
  const items: ParsedBankStatementItem[] = [];
  const syntheticCounts = new Map<string, number>();
  let skippedInvalidCount = 0;

  dataRows.forEach((line, rowIdx) => {
    const cols = splitLine(line);
    if (cols.length < 2) {
      skippedInvalidCount += 1;
      return;
    }

    const rawDate = cols[dateIdx] || '';
    const baseDesc = cols[descIdx] || 'Lançamento Manual';
    const extraDesc = extraDescIdx >= 0 ? (cols[extraDescIdx] || '').trim() : '';
    const rawDesc = extraDesc && extraDesc.toLowerCase() !== baseDesc.toLowerCase() ? `${baseDesc} - ${extraDesc}` : baseDesc;
    // Extratos com colunas separadas de débito e crédito: crédito entra (+), débito sai (-)
    const hasSplitColumns = debitIdx >= 0 && creditIdx >= 0 && !hasAmountHeader;
    let rawAmt = cols[amountIdx] || '';
    if (hasSplitColumns) {
      const credit = parseBankAmount(cols[creditIdx] || '');
      const debit = parseBankAmount(cols[debitIdx] || '');
      const creditValue = Number.isFinite(credit) ? Math.abs(credit) : 0;
      const debitValue = Number.isFinite(debit) ? Math.abs(debit) : 0;
      const net = Math.round((creditValue - debitValue) * 100) / 100;
      rawAmt = net === 0 ? '' : net.toFixed(2).replace('.', ',');
    }
    const fitid = fitidIdx >= 0 ? cols[fitidIdx] : undefined;

    // Skip empty or summary rows
    if (!rawDate && !rawDesc) return;
    if (rawDesc.toLowerCase().includes('saldo do dia') || rawDesc.toLowerCase().includes('saldo anterior')) {
      return;
    }

    const parsedDate = normalizeCsvDate(rawDate);
    let parsedAmount = parseBankAmount(rawAmt);
    // Coluna D/C (ou Tipo): o valor vem sem sinal e a coluna diz se saiu ou entrou
    if (typeIdx >= 0 && !hasSplitColumns && Number.isFinite(parsedAmount) && parsedAmount > 0) {
      const marker = (cols[typeIdx] || '').trim().toLowerCase();
      if (/^(d|deb|d[ée]bito|debit|saida|sa[ií]da|despesa)$/.test(marker)) parsedAmount = -parsedAmount;
    }
    if (!parsedDate || !Number.isFinite(parsedAmount) || parsedAmount === 0) {
      skippedInvalidCount += 1;
      return;
    }

    const rawType: 'income' | 'expense' = parsedAmount < 0 ? 'expense' : 'income';

    items.push({
      fitid: fitid?.trim() || syntheticCsvFitid(parsedDate, parsedAmount, rawDesc, syntheticCounts),
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
    skippedInvalidCount,
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
 * Infers the best category for a transaction based on description keywords.
 */
export function inferCategoryByDescription(
  description: string,
  categories: Category[],
  type: 'income' | 'expense' = 'expense'
): string {
  const match = matchCategoryByDescription(description, categories, type);
  if (match) return match.categoryId;

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

export interface DuplicateLookup {
  byFitid: Map<string, Transaction[]>;
  byDate: Map<string, Transaction[]>;
}

/** Índices por identificador e por dia, para conferir centenas de linhas sem varrer o histórico inteiro a cada uma. */
export function buildDuplicateLookup(transactions: Transaction[]): DuplicateLookup {
  const byFitid = new Map<string, Transaction[]>();
  const byDate = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.fitid) {
      const sameId = byFitid.get(tx.fitid);
      if (sameId) sameId.push(tx);
      else byFitid.set(tx.fitid, [tx]);
    }
    const list = byDate.get(tx.date);
    if (list) list.push(tx);
    else byDate.set(tx.date, [tx]);
  }
  return { byFitid, byDate };
}

function shiftIsoDate(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/**
 * Detects whether an imported bank item is already present in the existing transactions list.
 */
export function checkItemDuplicate(
  item: ParsedBankStatementItem,
  existingTransactions: Transaction[],
  targetAccountId?: string,
  statementCurrency = 'BRL',
  exchangeRate?: number,
  ignoreTransactionId?: string,
  lookup?: DuplicateLookup
): { isDuplicate: boolean; reason?: string } {
  // Com o índice, só olha os lançamentos do mesmo dia (e dias vizinhos), não a lista inteira
  const sameDayTransactions = lookup ? lookup.byDate.get(item.date) ?? [] : existingTransactions;
  const nearbyTransactions = lookup
    ? [shiftIsoDate(item.date, -1), item.date, shiftIsoDate(item.date, 1)].flatMap((date) => lookup.byDate.get(date) ?? [])
    : existingTransactions;
  // 1. Exact FITID match
  // Ids antigos 'csv-row-N' vinham da posição da linha e não identificam o lançamento: ignora-os
  if (item.fitid && !/^csv-row-\d+$/.test(item.fitid)) {
    // O FITID só identifica o lançamento dentro da conta do extrato: a mesma chave em outra conta não é repetição.
    const sameAccount = (tx: Transaction) =>
      !targetAccountId || !tx.accountId || tx.accountId === targetAccountId || tx.destinationAccountId === targetAccountId;
    const candidates = lookup
      ? lookup.byFitid.get(item.fitid) ?? []
      : existingTransactions.filter((tx) => tx.fitid && tx.fitid === item.fitid);
    const fitidMatch = candidates.find((tx) => tx.id !== ignoreTransactionId && sameAccount(tx));
    if (fitidMatch) {
      return {
        isDuplicate: true,
        reason: `FITID idêntico já cadastrado (${fitidMatch.description} em ${fitidMatch.date})`,
      };
    }
  }

  // 1b. Transferência entre contas já lançada à mão: a saída (ou entrada) do extrato é a mesma movimentação.
  // Sem isto o dinheiro sairia duas vezes da conta (a transferência e uma despesa nova).
  const transferMatch = nearbyTransactions.find((tx) => {
    if (tx.id === ignoreTransactionId) return false;
    if (tx.type !== 'transfer' || !tx.accountId || !tx.destinationAccountId) return false;
    if (tx.status !== 'paid') return false;
    const isOutgoing = item.rawType === 'expense';
    const sideAccountId = isOutgoing ? tx.accountId : tx.destinationAccountId;
    if (targetAccountId && sideAccountId !== targetAccountId) return false;
    if (daysApart(tx.date, item.date) > 1) return false;
    const foreignLeg = isOutgoing ? tx.transferFromAmount : tx.transferToAmount;
    const legAmount = statementCurrency !== 'BRL' && foreignLeg ? foreignLeg : tx.amount;
    const itemAmount =
      statementCurrency !== 'BRL' && !foreignLeg && Number.isFinite(exchangeRate)
        ? Math.round(item.amount * (exchangeRate || 1) * 100) / 100
        : item.amount;
    return Math.abs(legAmount - itemAmount) < 0.01;
  });
  if (transferMatch) {
    return {
      isDuplicate: true,
      reason: `Já registrada como transferência entre contas (${transferMatch.description} em ${transferMatch.date})`,
    };
  }

  // 2. Exact Date + Amount match on same account (or matching description)
  const normImportDesc = cleanDescriptionForComparison(item.description);
  const amountInBrlCents = Math.round(item.amount * (exchangeRate || 1) * 100);
  const comparableAmount = statementCurrency === 'BRL' || !Number.isFinite(exchangeRate) ||
    !Number.isSafeInteger(amountInBrlCents)
    ? item.amount
    : amountInBrlCents / 100;
  const potentialMatches = sameDayTransactions.filter((tx) => {
    if (tx.id === ignoreTransactionId) return false;
    if (targetAccountId && tx.accountId && tx.accountId !== targetAccountId) {
      return false;
    }
    const isSameDate = tx.date === item.date;
    const txComparableAmount = statementCurrency !== 'BRL' && tx.originalCurrency === statementCurrency &&
      Number.isFinite(tx.originalAmount)
      ? tx.originalAmount as number
      : tx.amount;
    const itemComparableAmount = statementCurrency !== 'BRL' && tx.originalCurrency === statementCurrency
      ? item.amount
      : comparableAmount;
    const isSameAmount = Math.abs(txComparableAmount - itemComparableAmount) < 0.01;
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
const PENDING_MATCH_WINDOW_DAYS = 7;

function daysApart(a: string, b: string): number {
  return Math.abs(Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000));
}

function sharesMeaningfulWord(a: string, b: string): boolean {
  const wordsA = new Set(a.split(' ').filter((word) => word.length >= 4));
  return b.split(' ').some((word) => word.length >= 4 && wordsA.has(word));
}

/**
 * Acha a conta pendente que esta linha do extrato quita: mesmo tipo e valor, data até 7 dias de
 * diferença e nome parecido; sem nome parecido, só vale se for a única pendência com aquele valor.
 * Mais de uma possibilidade = não casa (a pessoa decide).
 */
function findPendingMatch(
  item: { date: string; description: string; rawType: 'income' | 'expense' },
  amountBrl: number,
  pending: Transaction[],
  claimed: Set<string>
): Transaction | undefined {
  const sameValue = pending.filter(
    (tx) =>
      !claimed.has(tx.id) &&
      tx.type === item.rawType &&
      Math.abs(tx.amount - amountBrl) < 0.01 &&
      daysApart(tx.date, item.date) <= PENDING_MATCH_WINDOW_DAYS
  );
  if (sameValue.length === 0) return undefined;
  const itemName = normalizeDescription(item.description);
  const named = sameValue.filter((tx) => sharesMeaningfulWord(itemName, normalizeDescription(tx.description)));
  if (named.length === 1) return named[0];
  if (named.length === 0 && sameValue.length === 1) return sameValue[0];
  return undefined;
}

export function prepareReconciliationCandidates(
  items: ParsedBankStatementItem[],
  existingTransactions: Transaction[],
  categories: Category[],
  targetAccountId?: string,
  cards: CreditCard[] = [],
  fx: { currency?: string; exchangeRate?: number } = {},
  familyMembers: FamilyMember[] = []
): ReconciliationCandidate[] {
  const statementCurrency = fx.currency || 'BRL';
  const exchangeRate = statementCurrency === 'BRL' ? 1 : fx.exchangeRate;
  const hasValidExchangeRate = Number.isFinite(exchangeRate) && (exchangeRate || 0) > 0;
  const cardIds = new Set(cards.map((card) => card.id));
  const pendingInvoicesByCard = new Map<string, Map<string, number>>();
  for (const tx of existingTransactions) {
    if (
      !tx.creditCardId || !cardIds.has(tx.creditCardId) || tx.status !== 'pending' ||
      tx.isInvoicePayment || tx.isCompanionOnlyExpense || tx.sharedPaidBy === 'member'
    ) continue;
    const months = pendingInvoicesByCard.get(tx.creditCardId) || new Map<string, number>();
    months.set(tx.competenceMonth, Math.round(((months.get(tx.competenceMonth) || 0) + tx.amount) * 100) / 100);
    pendingInvoicesByCard.set(tx.creditCardId, months);
  }
  const pendingInvoices = cards.flatMap((card) =>
    [...(pendingInvoicesByCard.get(card.id) || new Map<string, number>())]
      .filter(([, amount]) => amount > 0)
      .map(([invoiceMonth, amount]) => ({
        cardId: card.id,
        cardName: cleanDescriptionForComparison(card.name),
        invoiceMonth,
        amount,
      }))
  );

  const pendingBills = existingTransactions.filter(
    (tx) =>
      tx.status === 'pending' &&
      !tx.creditCardId &&
      !tx.isInvoicePayment &&
      !tx.isCompanionOnlyExpense &&
      tx.sharedPaidBy !== 'member' &&
      (tx.type === 'income' || tx.type === 'expense') &&
      (!targetAccountId || !tx.accountId || tx.accountId === targetAccountId)
  );
  const claimedPending = new Set<string>();
  const establishmentIndex = buildEstablishmentIndex(existingTransactions);
  const duplicateLookup = buildDuplicateLookup(existingTransactions);

  const seenFitIds = new Set<string>();
  return items.map((item, idx) => {
    const pendingMatch =
      statementCurrency === 'BRL'
        ? findPendingMatch(item, item.amount, pendingBills, claimedPending)
        : undefined;
    if (pendingMatch) claimedPending.add(pendingMatch.id);
    // A conta pendente que casou não conta como "duplicata" desta linha
    const dupCheck = checkItemDuplicate(
      item,
      existingTransactions,
      targetAccountId,
      statementCurrency,
      exchangeRate,
      pendingMatch?.id,
      duplicateLookup
    );
    const normalizedFitId = item.fitid?.trim();
    const repeatedInStatement = Boolean(normalizedFitId && seenFitIds.has(normalizedFitId));
    if (normalizedFitId) seenFitIds.add(normalizedFitId);
    const ruleMatch = matchCategoryByDescription(item.description, categories, item.rawType);
    const habit = learnCategoryHabit(item.description, existingTransactions, item.rawType, establishmentIndex);
    const habitCategory = habit && categories.some((category) => category.id === habit.value && category.type === item.rawType)
      ? habit.value
      : undefined;
    const suggestedCategoryId = habitCategory
      ?? ruleMatch?.categoryId
      ?? inferCategoryByDescription(item.description, categories, item.rawType);
    const suggestedCategorySource: 'history' | 'rule' | undefined = habitCategory ? 'history' : ruleMatch ? 'rule' : undefined;
    const normalizedDescription = cleanDescriptionForComparison(item.description);
    const convertedCents = Math.round(item.amount * (exchangeRate || 1) * 100);
    const hasSafeConversion = statementCurrency === 'BRL' ||
      (hasValidExchangeRate && Number.isSafeInteger(convertedCents) && convertedCents > 0);
    const amountBrl = statementCurrency === 'BRL' || !hasSafeConversion
      ? item.amount
      : convertedCents / 100;
    const isPotentialInvoicePayment = item.rawType === 'expense' &&
      (/(^|\s)fatura(\s|$)/.test(normalizedDescription) ||
        /\b(pagamento|pagto|pgto) cartao( de credito)?\b/.test(normalizedDescription));
    const invoiceMatches: Array<{ cardId: string; invoiceMonth: string }> = [];

    if (isPotentialInvoicePayment) {
      for (const invoice of pendingInvoices) {
        const descriptionNamesCard = invoice.cardName.length > 0 &&
          ` ${normalizedDescription} `.includes(` ${invoice.cardName} `);
        const amountMatchesInvoice = Math.abs(invoice.amount - amountBrl) < 0.01;
        const amountFitsInvoice = amountBrl > 0 && amountBrl <= invoice.amount;
        if (amountFitsInvoice && (amountMatchesInvoice || descriptionNamesCard)) {
          invoiceMatches.push({ cardId: invoice.cardId, invoiceMonth: invoice.invoiceMonth });
        }
      }
    }

    const invoiceMatch = invoiceMatches.length === 1 ? invoiceMatches[0] : undefined;

    return {
      id: `reconcile-${idx}-${normalizedFitId || item.date}`,
      fitid: item.fitid,
      date: item.date,
      amount: amountBrl,
      sourceAmount: statementCurrency === 'BRL' ? undefined : item.amount,
      originalCurrency: statementCurrency === 'BRL' ? undefined : statementCurrency,
      exchangeRate: statementCurrency !== 'BRL' && hasSafeConversion ? exchangeRate : undefined,
      type: item.rawType,
      description: item.description,
      memo: item.memo,
      suggestedCategoryId: invoiceMatch
        ? categories.find((category) => category.id === 'cat-fatura')?.id || suggestedCategoryId
        : suggestedCategoryId,
      isPotentialInvoicePayment,
      isInvoicePayment: Boolean(invoiceMatch),
      settledCardId: invoiceMatch?.cardId,
      settledInvoiceMonth: invoiceMatch?.invoiceMonth,
      suggestedCategorySource: invoiceMatch ? undefined : suggestedCategorySource,
      matchedPendingId: pendingMatch?.id,
      matchedPendingDescription: pendingMatch?.description,
      learnedSharing:
        item.rawType === 'expense' && !invoiceMatch && !pendingMatch && statementCurrency === 'BRL'
          ? learnSharingFromHistory(item.description, existingTransactions, familyMembers, establishmentIndex) ?? undefined
          : undefined,
      isDuplicate: dupCheck.isDuplicate || repeatedInStatement,
      duplicateReason: repeatedInStatement
        ? `FITID repetido neste arquivo (${normalizedFitId})`
        : dupCheck.reason,
      selected: !dupCheck.isDuplicate && !repeatedInStatement &&
        (!isPotentialInvoicePayment || Boolean(invoiceMatch)),
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
    .filter((c) => c.selected && c.amount > 0 && (!c.isInvoicePayment || Boolean(c.settledCardId && c.settledInvoiceMonth)))
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
        settlesPendingTransactionId: c.matchedPendingId,
        ...(c.learnedSharing && !c.matchedPendingId
          ? {
              isShared: true,
              sharedMemberId: c.learnedSharing.memberId,
              sharedPaidBy: c.learnedSharing.paidBy,
              sharedSplitMode: c.learnedSharing.splitMode === 'half' ? ('half' as const) : ('custom' as const),
              sharedAmount: calculateSharedAmount(c.amount, c.learnedSharing.splitMode, c.learnedSharing.percentage),
              sharedStatus: 'pending' as const,
            }
          : {}),
        isInvoicePayment: c.isInvoicePayment || undefined,
        settledCardId: c.isInvoicePayment ? c.settledCardId : undefined,
        settledInvoiceMonth: c.isInvoicePayment ? c.settledInvoiceMonth : undefined,
        originalAmount: c.originalCurrency ? c.sourceAmount : undefined,
        originalCurrency: c.originalCurrency as CurrencyCode | undefined,
        exchangeRate: c.originalCurrency ? c.exchangeRate : undefined,
        effectiveExchangeRate: c.originalCurrency ? c.exchangeRate : undefined,
        currencyRegime: c.originalCurrency ? 'global_account' : undefined,
      };
    });
}

/**
 * Strips obsolete, null, undefined, and empty string properties from transactions
 * before persisting the parsed records in Neon.
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
