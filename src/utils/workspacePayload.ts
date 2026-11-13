function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isSafeMoneyValue(
  value: unknown,
  allowNegative: boolean,
  requireExactCents = false
): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (!allowNegative && value < 0) return false;
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents)) return false;
  return !requireExactCents || Math.abs(value - cents / 100) < 1e-7;
}

function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidYearMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function isSafeNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 &&
    Number.isSafeInteger(Math.round(value * 1_000_000));
}

function isSafePositiveNumber(value: unknown): value is number {
  return isSafeNonNegativeNumber(value) && value > 0;
}

const supportedCurrencyCodes = new Set(['BRL', 'USD', 'EUR', 'GBP', 'ARS', 'CLP', 'JPY', 'CAD', 'CHF']);

function isSupportedCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && supportedCurrencyCodes.has(value);
}

function isSafeCurrencyAmount(value: unknown, currency: unknown): value is number {
  if (!isSafeNonNegativeNumber(value) || !isSupportedCurrencyCode(currency)) return false;
  const fractionDigits = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).resolvedOptions().maximumFractionDigits;
  if (typeof fractionDigits !== 'number' || fractionDigits < 0 || fractionDigits > 6) return false;
  const scale = 10 ** fractionDigits;
  const minorUnits = Math.round(value * scale);
  return Number.isSafeInteger(minorUnits) && Math.abs(value - minorUnits / scale) < 1e-7;
}

function validateTrip(item: Record<string, unknown>): boolean {
  if ('name' in item) {
    if (
      !isValidISODate(item.startDate) || !isValidISODate(item.endDate) ||
      item.endDate < item.startDate ||
      !isSupportedCurrencyCode(item.currency) ||
      !isSafePositiveNumber(item.defaultExchangeRate) ||
      !isSafeCurrencyAmount(item.budgetForeign, item.currency) ||
      !Array.isArray(item.exchangeLots) || !Array.isArray(item.settlements)
    ) return false;
  }
  if ('currency' in item && !isSupportedCurrencyCode(item.currency)) return false;
  if ('defaultExchangeRate' in item && !isSafePositiveNumber(item.defaultExchangeRate)) return false;
  if ('budgetForeign' in item && ('currency' in item
    ? !isSafeCurrencyAmount(item.budgetForeign, item.currency)
    : !isSafeNonNegativeNumber(item.budgetForeign))) return false;
  if ('exchangeLots' in item) {
    if (!Array.isArray(item.exchangeLots) || !item.exchangeLots.every((lot) => {
      if (!isRecord(lot)) return false;
      const isExchangeLot = 'id' in lot || 'foreignAmount' in lot || 'rateBase' in lot;
      return (!isExchangeLot || (isValidISODate(lot.date) && isSafePositiveNumber(lot.foreignAmount) && isSafePositiveNumber(lot.rateBase))) &&
        (!('currency' in lot) || (isSupportedCurrencyCode(lot.currency) && (!('currency' in item) || lot.currency === item.currency))) &&
        (!('foreignAmount' in lot) || ('currency' in item
          ? isSafeCurrencyAmount(lot.foreignAmount, item.currency)
          : isSafeNonNegativeNumber(lot.foreignAmount))) &&
        (!('date' in lot) || isValidISODate(lot.date)) &&
        (!('rateBase' in lot) || isSafePositiveNumber(lot.rateBase)) &&
        (!('iofPercent' in lot) || (isSafeNonNegativeNumber(lot.iofPercent) && lot.iofPercent <= 100)) &&
        (!('effectiveRateBrl' in lot) || isSafePositiveNumber(lot.effectiveRateBrl)) &&
        (!('totalBrlPaid' in lot) || isSafeMoneyValue(lot.totalBrlPaid, false, true));
    })) return false;
  }
  if ('settlements' in item) {
    if (!Array.isArray(item.settlements) || !item.settlements.every((settlement) => {
      if (!isRecord(settlement)) return false;
      const isSettlement = 'id' in settlement || 'foreignAmountEquivalent' in settlement || 'brlAmountSettled' in settlement;
      return (!isSettlement || isValidISODate(settlement.date)) &&
        (!('date' in settlement) || isValidISODate(settlement.date)) &&
        (!('foreignAmountEquivalent' in settlement) || ('currency' in item
          ? isSafeCurrencyAmount(settlement.foreignAmountEquivalent, item.currency)
          : isSafeNonNegativeNumber(settlement.foreignAmountEquivalent))) &&
        (!('brlAmountSettled' in settlement) || isSafeMoneyValue(settlement.brlAmountSettled, false, true)) &&
        (!('exchangeRateUsed' in settlement) || isSafePositiveNumber(settlement.exchangeRateUsed));
    })) return false;
  }
  return true;
}

function validateFinancialItem(item: Record<string, unknown>, field: string): boolean {
  const optionalMoneyFields: Record<string, string[]> = {
    accountsJson: ['initialBalance', 'initialBalanceForeign'],
    cardsJson: ['limit'],
    categoriesJson: ['monthlyBudget'],
    transactionsJson: [
      'amount',
      'installmentPurchaseTotal',
      'sharedAmount',
      'originalAmount',
      'transferFromAmount',
      'transferToAmount',
      'originalAmountBeforeDiscount',
      'myPersonalShareBrl',
      'myPersonalShareForeign',
    ],
  };
  const centPrecisionFields = new Set([
    'initialBalance',
    'limit',
    'monthlyBudget',
    'amount',
    'installmentPurchaseTotal',
    'sharedAmount',
    'myPersonalShareBrl',
  ]);
  const moneyFields = optionalMoneyFields[field] || [];
  for (const moneyField of moneyFields) {
    if (
      moneyField in item &&
      !isSafeMoneyValue(
        item[moneyField],
        moneyField === 'initialBalance',
        centPrecisionFields.has(moneyField)
      )
    ) {
      return false;
    }
  }

  if (field === 'transactionsJson' && 'type' in item) {
    if (
      !['income', 'expense', 'transfer'].includes(String(item.type)) ||
      !isSafeMoneyValue(item.amount, false) ||
      !isValidISODate(item.date) ||
      !isValidYearMonth(item.competenceMonth) ||
      !['paid', 'pending'].includes(String(item.status))
    ) return false;
    if ('transferExchangeRate' in item && !isSafePositiveNumber(item.transferExchangeRate)) return false;
  }
  if (field === 'accountsJson' && 'type' in item && !isSafeMoneyValue(item.initialBalance, true)) {
    return false;
  }
  if (field === 'cardsJson' && 'name' in item && !isSafeMoneyValue(item.limit, false)) {
    return false;
  }
  if (field === 'categoriesJson' && 'type' in item && !isSafeMoneyValue(item.monthlyBudget, false)) {
    return false;
  }
  if (field === 'goalsJson') {
    if ('name' in item && (
      !isSafePositiveNumber(item.targetAmount) ||
      !isSafeNonNegativeNumber(item.currentAmount) ||
      !isSafeNonNegativeNumber(item.monthlyContribution) ||
      !isValidISODate(item.deadline)
    )) return false;
    for (const key of ['targetAmount', 'currentAmount', 'monthlyContribution']) {
      if (key in item && !isSafeMoneyValue(item[key], false, true)) return false;
    }
    if ('deadline' in item && !isValidISODate(item.deadline)) return false;
  }
  if (field === 'investmentsJson') {
    if ('ticker' in item || 'assetClass' in item) {
      if (
        !isSafeNonNegativeNumber(item.quantity) ||
        !isSafePositiveNumber(item.averagePrice) ||
        !isSafePositiveNumber(item.currentPrice) ||
        !isSafeNonNegativeNumber(item.monthlyYieldPercent)
      ) return false;
    }
    for (const key of ['quantity', 'averagePrice', 'currentPrice']) {
      if (key in item && !isSafeNonNegativeNumber(item[key])) return false;
    }
    for (const key of ['monthlyYieldPercent', 'dailyChangePercent']) {
      if (key in item && (typeof item[key] !== 'number' || !Number.isFinite(item[key]) || Math.abs(item[key] as number) > 1_000_000)) return false;
    }
    if ('monthlyYieldPercent' in item && (item.monthlyYieldPercent as number) < 0) return false;
  }
  if (field === 'tripsJson' && !validateTrip(item)) return false;
  return true;
}

/** Parse persisted workspace collections without replacing damaged data with defaults. */
export function parseWorkspaceArray<T>(raw: unknown, fallback: T[], field: string): T[] {
  if (raw === undefined || raw === null) return fallback;

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`O campo ${field} do workspace contém JSON inválido.`);
    }
  }

  if (
    !Array.isArray(parsed) ||
    !parsed.every((item) =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      item.id.trim() &&
      validateFinancialItem(item, field)
    )
  ) {
    throw new Error(`O campo ${field} do workspace contém uma coleção inválida.`);
  }
  const recordIds = (parsed as Array<Record<string, unknown>>).map((item) =>
    String(item.id).trim()
  );
  if (new Set(recordIds).size !== recordIds.length) {
    throw new Error(`O campo ${field} do workspace contém IDs repetidos.`);
  }
  return parsed as T[];
}

/** Parse persisted workspace objects without silently resetting them to defaults. */
export function parseWorkspaceObject<T extends object>(
  raw: unknown,
  fallback: T,
  field: string
): T {
  if (raw === undefined || raw === null) return fallback;

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`O campo ${field} do workspace contém JSON inválido.`);
    }
  }

  if (!isRecord(parsed)) {
    throw new Error(`O campo ${field} do workspace contém um objeto inválido.`);
  }
  return { ...fallback, ...parsed };
}
