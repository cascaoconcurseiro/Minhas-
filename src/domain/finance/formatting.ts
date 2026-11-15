/**
 * Formatação e leitura de dinheiro (R$) e auxiliares de datas e meses ("AAAA-MM").
 * Funções puras sem dependência de outras regras; reexportadas por `financeRules.ts` (os imports antigos continuam valendo).
 */

export function formatBRL(value: number): string {
  const normalized = Object.is(value, -0) ? 0 : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalized);
}

export function getLocalDateISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseBRLInput(raw: string): number {
  if (!raw || typeof raw !== 'string') return 0;
  const cleaned = raw.trim().replace(/[R$\s]/g, '');
  if (!cleaned) return 0;
  const match = cleaned.match(/^([+-]?)([\d.,]+)$/);
  if (!match) return 0;

  const sign = match[1] === '-' ? -1n : 1n;
  const value = match[2];
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  const hasComma = lastComma !== -1;
  const hasDot = lastDot !== -1;

  let integerPart = value;
  let fractionPart = '';

  if (hasComma && hasDot) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const groupingSeparator = decimalSeparator === ',' ? '.' : ',';
    const decimalIndex = Math.max(lastComma, lastDot);
    integerPart = value.slice(0, decimalIndex);
    fractionPart = value.slice(decimalIndex + 1);
    if (
      integerPart.includes(groupingSeparator) &&
      !new RegExp(`^\\d{1,3}(?:\\${groupingSeparator}\\d{3})+$`).test(integerPart)
    ) {
      return 0;
    }
    integerPart = integerPart.replaceAll(groupingSeparator, '');
  } else if (hasComma || hasDot) {
    const separator = hasComma ? ',' : '.';
    const parts = value.split(separator);
    if (parts.length > 2) {
      if (!/^\d{1,3}(?:[.,]\d{3})+$/.test(value)) return 0;
      integerPart = parts.join('');
    } else {
      [integerPart, fractionPart] = parts;
    }
  }

  if (!/^\d*$/.test(integerPart) || !/^\d*$/.test(fractionPart)) return 0;
  if (!integerPart && !fractionPart) return 0;

  try {
    const wholeCents = BigInt(integerPart || '0') * 100n;
    const fractionCents = BigInt((fractionPart + '00').slice(0, 2) || '0');
    let cents = wholeCents + fractionCents;
    if ((fractionPart[2] || '0') >= '5') cents += 1n;
    cents *= sign;
    const safeCents = Number(cents);
    return Number.isSafeInteger(safeCents) ? safeCents / 100 : 0;
  } catch {
    return 0;
  }
}

export function addMonthsToYearMonth(yearMonth: string, offset: number): string {
  const [yStr, mStr] = yearMonth.split('-');
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  const d = new Date(Date.UTC(year, monthIndex + offset, 1));
  const newYear = d.getUTCFullYear();
  const newMonth = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${newYear}-${newMonth}`;
}

/** Returns a card/bill date using the month's last day when its configured day is unavailable. */
export function getClampedMonthDate(yearMonth: string, day: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const safeDay = Math.min(Math.max(1, Math.trunc(day || 1)), daysInMonth);
  return `${yearMonth}-${String(safeDay).padStart(2, '0')}`;
}

export function addMonthsToDateString(dateStr: string, offset: number): string {
  const [yStr, mStr, dStr] = dateStr.split('-');
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  const day = Number(dStr);

  const targetFirst = new Date(Date.UTC(year, monthIndex + offset, 1));
  const targetYear = targetFirst.getUTCFullYear();
  const targetMonthIndex = targetFirst.getUTCMonth();
  const maxDaysInTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, maxDaysInTargetMonth);

  return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function formatMonthYearPT(yearMonth: string): string {
  const [yStr, mStr] = yearMonth.split('-');
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  const mIndex = Math.max(0, Math.min(11, Number(mStr) - 1));
  return `${months[mIndex]} de ${yStr}`;
}

export function formatShortMonthPT(yearMonth: string): string {
  const [yStr, mStr] = yearMonth.split('-');
  const shortMonths = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  const mIndex = Math.max(0, Math.min(11, Number(mStr) - 1));
  return `${shortMonths[mIndex]}/${yStr.slice(2)}`;
}

export function formatShortDateBR(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function getMonthRange(startMonth: string, endMonth: string): string[] {
  const [startStr, finishStr] =
    startMonth <= endMonth ? [startMonth, endMonth] : [endMonth, startMonth];
  const result: string[] = [];
  let current = startStr;
  let guard = 0;
  while (current <= finishStr && guard < 36) {
    result.push(current);
    current = addMonthsToYearMonth(current, 1);
    guard++;
  }
  return result;
}
