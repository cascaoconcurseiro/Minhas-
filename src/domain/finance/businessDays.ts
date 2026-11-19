/**
 * Dia útil bancário. Conta que vence em fim de semana ou feriado bancário pode ser paga, sem multa, no
 * próximo dia útil (fatura de cartão e boleto). Por isso o app só considera "atrasado" depois desse dia.
 *
 * Feriados: os nacionais fixos (inclui 20/11, nacional desde 2024) e os dias sem expediente bancário do
 * calendário da Febraban que dependem da Páscoa (segunda e terça de Carnaval, Sexta-feira Santa e
 * Corpus Christi). Feriados estaduais e municipais não entram.
 */

const FIXED_HOLIDAYS = new Set(['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25']);

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano), em UTC. */
export function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const movableCache = new Map<number, Set<string>>();

function getMovableBankHolidays(year: number): Set<string> {
  const cached = movableCache.get(year);
  if (cached) return cached;
  const easter = getEasterSunday(year).getTime();
  const shift = (days: number) => new Date(easter + days * 86_400_000).toISOString().slice(0, 10);
  // Carnaval (segunda e terça), Sexta-feira Santa e Corpus Christi.
  const result = new Set([shift(-48), shift(-47), shift(-2), shift(60)]);
  movableCache.set(year, result);
  return result;
}

function parseDate(date: string): Date | null {
  const match = DATE_PATTERN.exec(date);
  if (!match) return null;
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return parsed.toISOString().slice(0, 10) === date ? parsed : null;
}

export function isBankBusinessDay(date: string): boolean {
  const parsed = parseDate(date);
  if (!parsed) return false;
  const weekday = parsed.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  if (FIXED_HOLIDAYS.has(date.slice(5))) return false;
  return !getMovableBankHolidays(parsed.getUTCFullYear()).has(date);
}

/** O próprio dia, se for útil; senão o próximo dia útil. Data inválida volta sem mudança. */
export function getNextBankBusinessDay(date: string): string {
  const parsed = parseDate(date);
  if (!parsed) return date;
  let current = date;
  for (let guard = 0; guard < 10 && !isBankBusinessDay(current); guard += 1) {
    parsed.setUTCDate(parsed.getUTCDate() + 1);
    current = parsed.toISOString().slice(0, 10);
  }
  return current;
}
