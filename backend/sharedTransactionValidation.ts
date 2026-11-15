/** Validate a shared expense share before it affects another user's financial totals. */
export function normalizeSharedAmount(amountInput: unknown, sharedAmountInput: unknown): number | null {
  if (typeof amountInput !== 'number') return null;
  const amount = amountInput;
  if (!Number.isFinite(amount) || amount < 0) return null;

  const sharedAmount = sharedAmountInput === undefined || sharedAmountInput === null
    ? amount
    : typeof sharedAmountInput === 'number' ? sharedAmountInput : Number.NaN;
  if (!Number.isFinite(sharedAmount) || sharedAmount < 0 || sharedAmount > amount) {
    return null;
  }
  const amountCents = Math.round(amount * 100);
  const sharedAmountCents = Math.round(sharedAmount * 100);
  if (!Number.isSafeInteger(amountCents) || !Number.isSafeInteger(sharedAmountCents)) {
    return null;
  }
  return sharedAmountCents / 100;
}

/** Vencimento da fatura enviado por quem lançou: só aceita uma data real no formato AAAA-MM-DD. */
export function normalizeSharedDueDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}
