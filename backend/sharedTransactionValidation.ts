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
