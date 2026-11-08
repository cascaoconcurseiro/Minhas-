import { parseBRLInput } from './financeRules';

export interface QuickCsvRow {
  line: string;
  date: string;
  description: string;
  amount: number;
  isNegative: boolean;
}

export interface QuickCsvParseResult {
  valid: QuickCsvRow[];
  rejected: string[];
}

function parseSignedAmount(rawVal: string): { amount: number; isNegative: boolean } {
  const trimmed = rawVal.trim();
  const wrappedInParens = /^\(.*\)$/.test(trimmed);
  const trailingMinus = /-\s*$/.test(trimmed);
  const normalized = trimmed.replace(/[()]/g, '').replace(/-\s*$/, '');
  const parsed = parseBRLInput(normalized);
  return {
    amount: Math.abs(parsed),
    isNegative: parsed < 0 || wrappedInParens || trailingMinus,
  };
}

export function parseQuickCsvLines(linesText: string): QuickCsvParseResult {
  const valid: QuickCsvRow[] = [];
  const rejected: string[] = [];

  linesText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line.split(';');
      if (parts.length < 3) return void rejected.push(line);
      const date = parts[0].trim();
      const description = parts[1].trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !description) return void rejected.push(line);

      const [year, month, day] = date.split('-').map(Number);
      const parsedDate = new Date(Date.UTC(year, month - 1, day));
      if (
        parsedDate.getUTCFullYear() !== year ||
        parsedDate.getUTCMonth() !== month - 1 ||
        parsedDate.getUTCDate() !== day
      ) {
        return void rejected.push(line);
      }

      const { amount, isNegative } = parseSignedAmount(parts[2]);
      if (amount <= 0) return void rejected.push(line);

      valid.push({ line, date, description, amount, isNegative });
    });

  return { valid, rejected };
}
