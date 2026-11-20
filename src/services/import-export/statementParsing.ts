/** Leitura de extrato OFX e CSV bancário (datas, valores e linhas). */
import type {
  BankStatementMetadata,
  ParseStatementResult,
  ParsedBankStatementItem,
} from './statementTypes.ts';

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
