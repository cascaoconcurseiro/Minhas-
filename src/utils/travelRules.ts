import {
  BankAccount,
  Category,
  CreditCard,
  CurrencyCode,
  CurrencyPaymentRegime,
  InvestmentAsset,
  SavingsGoal,
  Transaction,
  Trip,
  TripCategorySpendPoint,
  TripDailySpendPoint,
  TripDashboardSummary,
  TripDebtTransfer,
  TripExchangeLot,
  TripExpenseShare,
  TripParticipant,
  TripParticipantBalance,
  TripSplitMethod,
} from '../types/finance';

export interface CurrencyMetadata {
  code: CurrencyCode;
  symbol: string;
  name: string;
  flag: string;
  defaultCommercialRateBrl: number; // Cotação comercial aproximada em R$
  decimals: number;
}

export const CURRENCY_CATALOG: Record<CurrencyCode, CurrencyMetadata> = {
  BRL: {
    code: 'BRL',
    symbol: 'R$',
    name: 'Real Brasileiro',
    flag: '🇧🇷',
    defaultCommercialRateBrl: 1.0,
    decimals: 2,
  },
  USD: {
    code: 'USD',
    symbol: 'US$',
    name: 'Dólar Americano',
    flag: '🇺🇸',
    defaultCommercialRateBrl: 5.75,
    decimals: 2,
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    flag: '🇪🇺',
    defaultCommercialRateBrl: 6.22,
    decimals: 2,
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'Libra Esterlina',
    flag: '🇬🇧',
    defaultCommercialRateBrl: 7.35,
    decimals: 2,
  },
  CAD: {
    code: 'CAD',
    symbol: 'C$',
    name: 'Dólar Canadense',
    flag: '🇨🇦',
    defaultCommercialRateBrl: 4.18,
    decimals: 2,
  },
  CHF: {
    code: 'CHF',
    symbol: 'CHF',
    name: 'Franco Suíço',
    flag: '🇨🇭',
    defaultCommercialRateBrl: 6.55,
    decimals: 2,
  },
  ARS: {
    code: 'ARS',
    symbol: 'ARS$',
    name: 'Peso Argentino (Blue/MEP)',
    flag: '🇦🇷',
    defaultCommercialRateBrl: 0.0052,
    decimals: 2,
  },
  CLP: {
    code: 'CLP',
    symbol: 'CLP$',
    name: 'Peso Chileno',
    flag: '🇨🇱',
    defaultCommercialRateBrl: 0.0061,
    decimals: 0,
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Iene Japonês',
    flag: '🇯🇵',
    defaultCommercialRateBrl: 0.038,
    decimals: 0,
  },
};

export const CURRENCY_REGIME_DEFAULTS: Record<
  CurrencyPaymentRegime,
  {
    label: string;
    shortLabel: string;
    defaultIofPercent: number;
    description: string;
  }
> = {
  global_account: {
    label: 'Conta Global Internacional (Wise / Nomad / C6 / Inter)',
    shortLabel: 'Wise / Nomad (1,1% IOF)',
    defaultIofPercent: 1.1,
    description: 'Usa o câmbio médio ponderado do seu bolso ou dólar comercial + 1,1% IOF',
  },
  credit_card_intl: {
    label: 'Cartão de Crédito Brasileiro no Exterior (3,38% IOF)',
    shortLabel: 'Cartão Crédito (3,38% IOF)',
    defaultIofPercent: 3.38,
    description: 'Converte pelo câmbio PTAX + spread do banco + 3,38% IOF direto na fatura em R$',
  },
  cash_fx: {
    label: 'Dinheiro em Espécie (Casa de Câmbio / Papel Moeda)',
    shortLabel: 'Espécie / Papel Moeda',
    defaultIofPercent: 0,
    description: 'Pago com notas físicas na moeda local pelo câmbio efetivo pago na troca',
  },
  brl_direct: {
    label: 'Pago Direto em Reais (PIX / Cartão Nacional / Agência BR)',
    shortLabel: 'Pago em R$ (PIX/Nacional)',
    defaultIofPercent: 0,
    description: 'Passagens, hotéis ou seguros já cobrados diretamente em R$ no Brasil',
  },
};

export function formatForeignCurrency(
  amount: number,
  currency: CurrencyCode = 'USD'
): string {
  const meta = CURRENCY_CATALOG[currency] || CURRENCY_CATALOG.USD;
  const normalized = Object.is(amount, -0) ? 0 : amount;
  if (currency === 'BRL') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(normalized);
  }
  const formattedNum = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(normalized);
  return `${meta.symbol} ${formattedNum}`;
}

export function formatExchangeRateBR(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return 'R$ 0,00';
  const decimals = rate < 0.1 ? 4 : 2;
  return `R$ ${rate.toFixed(decimals).replace('.', ',')}`;
}

export interface ConvertedBrlResult {
  foreignAmount: number;
  baseRate: number;
  iofPercent: number;
  effectiveRate: number; // VET (Valor Efetivo Total) em R$ por 1 unidade estrangeira
  baseBrlAmount: number;
  iofBrlAmount: number;
  totalBrl: number;
}

/**
 * Calcula a conversão exata de uma despesa em moeda estrangeira para Reais (BRL),
 * incluindo IOF (ex: 1,1% Conta Global ou 3,38% Cartão de Crédito Internacional).
 */
export function calculateConvertedBrlAmount(
  foreignAmount: number,
  baseRate: number,
  iofPercent = 0
): ConvertedBrlResult {
  const safeForeign = Math.max(0, Number.isFinite(foreignAmount) ? foreignAmount : 0);
  const safeRate = Math.max(0, Number.isFinite(baseRate) ? baseRate : 0);
  const safeIof = Math.max(0, Number.isFinite(iofPercent) ? iofPercent : 0);

  const effectiveRate = Math.round(safeRate * (1 + safeIof / 100) * 10000) / 10000;
  const baseBrlAmount = Math.round(safeForeign * safeRate * 100) / 100;
  const totalBrl = Math.round(safeForeign * safeRate * (1 + safeIof / 100) * 100) / 100;
  const iofBrlAmount = Math.round((totalBrl - baseBrlAmount) * 100) / 100;

  return {
    foreignAmount: safeForeign,
    baseRate: safeRate,
    iofPercent: safeIof,
    effectiveRate,
    baseBrlAmount,
    iofBrlAmount,
    totalBrl,
  };
}

/**
 * Calcula o Câmbio Médio Ponderado (VET médio) dos lotes de câmbio comprados para a viagem.
 * Ex: Lote 1: € 1.000 a R$ 6,10 (R$ 6.100) + Lote 2: € 500 a R$ 6,40 (R$ 3.200)
 * -> Total: € 1.500 por R$ 9.300 -> Câmbio Médio Ponderado = R$ 6,20 / € 1.
 */
export function calculateTripWeightedAverageRate(
  exchangeLots: TripExchangeLot[],
  fallbackDefaultRate: number
): {
  weightedAverageRate: number;
  totalForeignPurchased: number;
  totalBrlPaid: number;
} {
  if (!exchangeLots || exchangeLots.length === 0) {
    return {
      weightedAverageRate: fallbackDefaultRate > 0 ? fallbackDefaultRate : 1,
      totalForeignPurchased: 0,
      totalBrlPaid: 0,
    };
  }

  let totalForeign = 0;
  let totalBrl = 0;

  for (const lot of exchangeLots) {
    if (lot.foreignAmount > 0 && lot.totalBrlPaid > 0) {
      totalForeign += lot.foreignAmount;
      totalBrl += lot.totalBrlPaid;
    }
  }

  if (totalForeign <= 0) {
    return {
      weightedAverageRate: fallbackDefaultRate > 0 ? fallbackDefaultRate : 1,
      totalForeignPurchased: 0,
      totalBrlPaid: 0,
    };
  }

  const weightedAverageRate = Math.round((totalBrl / totalForeign) * 10000) / 10000;

  return {
    weightedAverageRate,
    totalForeignPurchased: Math.round(totalForeign * 100) / 100,
    totalBrlPaid: Math.round(totalBrl * 100) / 100,
  };
}

export interface LotSavingsItem {
  id: string;
  label: string;
  sourceLabel: string;
  date: string;
  currency: CurrencyCode;
  foreignAmount: number;
  effectiveRate: number; // VET pago (R$)
  benchmarkRate: number; // Cotação comercial de referência (R$)
  savingsPerUnitBrl: number; // Diferença por unidade (R$)
  savingsTotalBrl: number; // Economia total em R$ (positivo = economizou)
  savingsPercent: number; // % economizado vs. referência comercial
  isEconomy: boolean;
  totalBrlPaid: number;
  benchmarkBrlTotal: number;
}

export interface MonthlySavingsItem {
  month: string; // YYYY-MM
  monthLabel: string; // Ex: "Out/2026"
  currency: CurrencyCode;
  foreignAmount: number;
  totalBrlPaid: number;
  weightedEffectiveRate: number;
  benchmarkRate: number;
  benchmarkBrlTotal: number;
  savingsTotalBrl: number;
  savingsPercent: number;
  lotCount: number;
  isEconomy: boolean;
}

export interface ExchangeSavingsAnalysis {
  lotSeries: LotSavingsItem[];
  monthlySeries: MonthlySavingsItem[];
  benchmarkRateUsed: number;
  totalForeignPurchased: number;
  totalBrlPaid: number;
  totalBenchmarkBrl: number;
  totalSavingsBrl: number;
  overallSavingsPercent: number;
  bestLot: LotSavingsItem | null;
  lotCount: number;
}

/**
 * Calcula a economia cambial realizada ao trocar dinheiro em diferentes momentos,
 * comparando o VET efetivo de cada lote com a taxa de câmbio comercial média do período.
 */
export function calculateExchangeSavingsAnalysis(
  exchangeLots: TripExchangeLot[],
  currency: CurrencyCode,
  fallbackBenchmarkRate: number
): ExchangeSavingsAnalysis {
  const meta = CURRENCY_CATALOG[currency] || CURRENCY_CATALOG.USD;
  // Cotação comercial de referência do período: usa o fallback (ex: defaultExchangeRate da viagem)
  // ou a cotação padrão comercial do catálogo.
  const benchmarkRate =
    fallbackBenchmarkRate > 0
      ? fallbackBenchmarkRate
      : meta.defaultCommercialRateBrl > 0
      ? meta.defaultCommercialRateBrl
      : 1.0;

  if (!exchangeLots || exchangeLots.length === 0) {
    return {
      lotSeries: [],
      monthlySeries: [],
      benchmarkRateUsed: benchmarkRate,
      totalForeignPurchased: 0,
      totalBrlPaid: 0,
      totalBenchmarkBrl: 0,
      totalSavingsBrl: 0,
      overallSavingsPercent: 0,
      bestLot: null,
      lotCount: 0,
    };
  }

  // Ordena os lotes cronologicamente para a série histórica
  const sortedLots = [...exchangeLots].sort((a, b) => a.date.localeCompare(b.date));

  const lotSeries: LotSavingsItem[] = sortedLots.map((lot, idx) => {
    const effectiveRate = lot.effectiveRateBrl > 0 ? lot.effectiveRateBrl : lot.rateBase;
    const savingsPerUnitBrl = Math.round((benchmarkRate - effectiveRate) * 10000) / 10000;
    const benchmarkBrlTotal = Math.round(lot.foreignAmount * benchmarkRate * 100) / 100;
    const actualBrlTotal = lot.totalBrlPaid > 0 ? lot.totalBrlPaid : Math.round(lot.foreignAmount * effectiveRate * 100) / 100;
    const savingsTotalBrl = Math.round((benchmarkBrlTotal - actualBrlTotal) * 100) / 100;
    const savingsPercent = benchmarkRate > 0 ? Math.round(((benchmarkRate - effectiveRate) / benchmarkRate) * 1000) / 10 : 0;

    return {
      id: lot.id,
      label: `Lote ${idx + 1}`,
      sourceLabel: lot.sourceLabel || `Remessa ${idx + 1}`,
      date: lot.date,
      currency: lot.currency || currency,
      foreignAmount: lot.foreignAmount,
      effectiveRate,
      benchmarkRate,
      savingsPerUnitBrl,
      savingsTotalBrl,
      savingsPercent,
      isEconomy: savingsTotalBrl >= 0,
      totalBrlPaid: actualBrlTotal,
      benchmarkBrlTotal,
    };
  });

  // Agrupamento por mês ("Mês da Viagem")
  const monthlyMap = new Map<string, TripExchangeLot[]>();
  for (const lot of sortedLots) {
    const monthKey = lot.date ? lot.date.slice(0, 7) : 'sem-data';
    const group = monthlyMap.get(monthKey) || [];
    group.push(lot);
    monthlyMap.set(monthKey, group);
  }

  const MONTH_NAMES_SHORT = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];

  const monthlySeries: MonthlySavingsItem[] = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, lots]) => {
      let totalForeign = 0;
      let totalBrlPaid = 0;
      for (const l of lots) {
        totalForeign += l.foreignAmount;
        totalBrlPaid += l.totalBrlPaid > 0 ? l.totalBrlPaid : l.foreignAmount * (l.effectiveRateBrl || l.rateBase);
      }
      const weightedEffectiveRate = totalForeign > 0 ? Math.round((totalBrlPaid / totalForeign) * 10000) / 10000 : benchmarkRate;
      const benchmarkBrlTotal = Math.round(totalForeign * benchmarkRate * 100) / 100;
      const savingsTotalBrl = Math.round((benchmarkBrlTotal - totalBrlPaid) * 100) / 100;
      const savingsPercent = benchmarkRate > 0 ? Math.round(((benchmarkRate - weightedEffectiveRate) / benchmarkRate) * 1000) / 10 : 0;

      const [year, m] = monthKey.split('-');
      const monthIdx = parseInt(m, 10) - 1;
      const monthLabel = !isNaN(monthIdx) && MONTH_NAMES_SHORT[monthIdx]
        ? `${MONTH_NAMES_SHORT[monthIdx]}/${year}`
        : monthKey;

      return {
        month: monthKey,
        monthLabel,
        currency,
        foreignAmount: Math.round(totalForeign * 100) / 100,
        totalBrlPaid: Math.round(totalBrlPaid * 100) / 100,
        weightedEffectiveRate,
        benchmarkRate,
        benchmarkBrlTotal,
        savingsTotalBrl,
        savingsPercent,
        lotCount: lots.length,
        isEconomy: savingsTotalBrl >= 0,
      };
    });

  const totalForeignPurchased = Math.round(lotSeries.reduce((s, l) => s + l.foreignAmount, 0) * 100) / 100;
  const totalBrlPaid = Math.round(lotSeries.reduce((s, l) => s + l.totalBrlPaid, 0) * 100) / 100;
  const totalBenchmarkBrl = Math.round(totalForeignPurchased * benchmarkRate * 100) / 100;
  const totalSavingsBrl = Math.round((totalBenchmarkBrl - totalBrlPaid) * 100) / 100;
  const overallSavingsPercent = totalBenchmarkBrl > 0 ? Math.round((totalSavingsBrl / totalBenchmarkBrl) * 1000) / 10 : 0;

  const bestLot = [...lotSeries].sort((a, b) => b.savingsTotalBrl - a.savingsTotalBrl)[0] || null;

  return {
    lotSeries,
    monthlySeries,
    benchmarkRateUsed: benchmarkRate,
    totalForeignPurchased,
    totalBrlPaid,
    totalBenchmarkBrl,
    totalSavingsBrl,
    overallSavingsPercent,
    bestLot,
    lotCount: lotSeries.length,
  };
}

export interface LatestExchangeRateInfo {
  rate: number;
  sourceType: 'latest_lot' | 'weighted_average' | 'default_benchmark';
  sourceLabel: string;
  lotDate?: string;
  lotId?: string;
  iofPercent?: number;
}

/**
 * Retorna a cotação do último lote de câmbio registrado para a viagem.
 * Se houver lotes, retorna a taxa efetiva do lote mais recente.
 * Caso contrário, faz fallback para o câmbio médio ou cotação padrão da viagem.
 */
export function getLatestExchangeRateInfo(
  exchangeLots: TripExchangeLot[],
  fallbackRate: number
): LatestExchangeRateInfo {
  if (exchangeLots && exchangeLots.length > 0) {
    // Encontra o lote mais recente por data (e ID como desempate)
    const sorted = [...exchangeLots].sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      if (cmp !== 0) return cmp;
      return b.id.localeCompare(a.id);
    });
    const latest = sorted[0];
    const rate = latest.effectiveRateBrl > 0 ? latest.effectiveRateBrl : latest.rateBase;
    return {
      rate: Math.round(rate * 10000) / 10000,
      sourceType: 'latest_lot',
      sourceLabel: latest.sourceLabel || `Último Lote (${latest.date})`,
      lotDate: latest.date,
      lotId: latest.id,
      iofPercent: latest.iofPercent,
    };
  }

  const safeFallback = fallbackRate > 0 ? fallbackRate : 1.0;
  return {
    rate: safeFallback,
    sourceType: 'default_benchmark',
    sourceLabel: 'Cotação Referência Padrão',
  };
}

/**
 * Utilitário de Conversão Inteligente de Moeda:
 * Converte bidirecionalmente entre moeda estrangeira e Reais (BRL),
 * usando a cotação do último lote registrado ou taxa informada.
 */
export function convertSmartCurrency(params: {
  amount: number;
  direction: 'foreign_to_brl' | 'brl_to_foreign';
  rate: number;
}): {
  foreignAmount: number;
  brlAmount: number;
  rateUsed: number;
} {
  const { amount, direction, rate } = params;
  const safeAmount = Math.max(0, Number.isFinite(amount) ? amount : 0);
  const safeRate = Math.max(0.0001, Number.isFinite(rate) ? rate : 1.0);

  if (direction === 'foreign_to_brl') {
    const brlAmount = Math.round(safeAmount * safeRate * 100) / 100;
    return {
      foreignAmount: safeAmount,
      brlAmount,
      rateUsed: safeRate,
    };
  } else {
    const foreignAmount = Math.round((safeAmount / safeRate) * 100) / 100;
    return {
      foreignAmount,
      brlAmount: safeAmount,
      rateUsed: safeRate,
    };
  }
}

/**
 * Extrai a taxa numérica de câmbio em BRL retornada pelo Gemini + Google Search grounding.
 */
export function parseLiveExchangeRateFromText(rawText: string): number | null {
  if (!rawText || typeof rawText !== 'string') return null;

  // 1. Formato estruturado prioritário: TAXA_COMERCIAL_BRL: 6.1845
  const taggedMatch = rawText.match(
    /TAXA_COMERCIAL_BRL\s*:\s*R?\$?\s*([0-9]+(?:[.,][0-9]+)?)/i
  );
  if (taggedMatch && taggedMatch[1]) {
    const normalized = taggedMatch[1].replace(',', '.');
    const val = Number.parseFloat(normalized);
    if (Number.isFinite(val) && val > 0 && val < 100000) {
      return Math.round(val * 10000) / 10000;
    }
  }

  // 2. Padrão explícito "R$ 6,18" ou "= 6,18 BRL"
  const explicitMatch = rawText.match(
    /(?:R\$\s*|1\s+[A-Z]{3}\s*=\s*R?\$?\s*)([0-9]+(?:[.,][0-9]{1,6})?)/i
  );
  if (explicitMatch && explicitMatch[1]) {
    const normalized = explicitMatch[1].replace(',', '.');
    const val = Number.parseFloat(normalized);
    if (Number.isFinite(val) && val > 0 && val < 100000) {
      return Math.round(val * 10000) / 10000;
    }
  }

  return null;
}

export interface LiveRateComparisonResult {
  liveCommercialRate: number;
  liveEstimatedWiseVet: number; // Comercial + 1.1% IOF
  tripVetRate: number;
  diffPerUnitBrl: number; // Positivo = lotes da viagem saíram mais baratos que comprar hoje
  diffPercent: number;
  isTripLotCheaper: boolean;
}

/**
 * Compara a cotação comercial em tempo real (Google Search) com o VET médio da viagem.
 */
export function compareLiveRateWithTripVet(
  liveCommercialRate: number,
  tripVetRate: number,
  iofPercent = 1.1
): LiveRateComparisonResult {
  const safeLive = Math.max(0.0001, Number.isFinite(liveCommercialRate) ? liveCommercialRate : 1);
  const safeTripVet = Math.max(0.0001, Number.isFinite(tripVetRate) ? tripVetRate : safeLive);
  const liveEstimatedWiseVet =
    Math.round(safeLive * (1 + Math.max(0, iofPercent) / 100) * 10000) / 10000;
  const diffPerUnitBrl =
    Math.round((liveEstimatedWiseVet - safeTripVet) * 10000) / 10000;
  const diffPercent =
    liveEstimatedWiseVet > 0
      ? Math.round(((liveEstimatedWiseVet - safeTripVet) / liveEstimatedWiseVet) * 1000) / 10
      : 0;

  return {
    liveCommercialRate: safeLive,
    liveEstimatedWiseVet,
    tripVetRate: safeTripVet,
    diffPerUnitBrl,
    diffPercent,
    isTripLotCheaper: diffPerUnitBrl >= 0,
  };
}

export interface CustomParticipantSplitInput {
  participantId: string;
  exactForeign?: number;
  percentage?: number;
  sharesWeight?: number;
}

/**
 * Calcula o rateio exato de uma despesa de viagem entre os participantes selecionados,
 * tanto na moeda original da viagem quanto em Reais (BRL), garantindo que a soma dos
 * centavos feche 100% com o total da nota sem sobras de arredondamento.
 */
export function calculateTripExpenseSplit(
  totalForeignAmount: number,
  totalBrlAmount: number,
  participants: TripParticipant[],
  selectedParticipantIds: string[],
  method: TripSplitMethod,
  customInputs: CustomParticipantSplitInput[] = []
): TripExpenseShare[] {
  const validParticipants = participants.filter((p) =>
    selectedParticipantIds.includes(p.id)
  );
  const activeList =
    validParticipants.length > 0 ? validParticipants : participants.slice(0, 1);

  if (activeList.length === 0) return [];

  const count = activeList.length;
  const customMap = new Map(customInputs.map((c) => [c.participantId, c]));

  // Cálculo dos pesos proporcionais de cada participante
  let weights: number[] = [];

  if (method === 'equal' || method === 'individual') {
    weights = activeList.map(() => 1);
  } else if (method === 'exact') {
    const exactValues = activeList.map(
      (p) => Math.max(0, customMap.get(p.id)?.exactForeign || 0)
    );
    const sumExact = exactValues.reduce((a, b) => a + b, 0);
    weights = sumExact > 0 ? exactValues : activeList.map(() => 1);
  } else if (method === 'percentage') {
    const pctValues = activeList.map(
      (p) => Math.max(0, customMap.get(p.id)?.percentage || 0)
    );
    const sumPct = pctValues.reduce((a, b) => a + b, 0);
    weights = sumPct > 0 ? pctValues : activeList.map(() => 1);
  } else if (method === 'shares') {
    const shareValues = activeList.map(
      (p) => Math.max(0, customMap.get(p.id)?.sharesWeight ?? 1)
    );
    const sumShares = shareValues.reduce((a, b) => a + b, 0);
    weights = sumShares > 0 ? shareValues : activeList.map(() => 1);
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0) || count;

  const shares: TripExpenseShare[] = [];
  let allocatedForeign = 0;
  let allocatedBrl = 0;

  for (let i = 0; i < count; i++) {
    const p = activeList[i];
    const ratio = weights[i] / totalWeight;
    const isLast = i === count - 1;

    const rawForeign = isLast
      ? Math.round((totalForeignAmount - allocatedForeign) * 100) / 100
      : Math.floor(totalForeignAmount * ratio * 100) / 100;

    const rawBrl = isLast
      ? Math.round((totalBrlAmount - allocatedBrl) * 100) / 100
      : Math.floor(totalBrlAmount * ratio * 100) / 100;

    allocatedForeign = Math.round((allocatedForeign + rawForeign) * 100) / 100;
    allocatedBrl = Math.round((allocatedBrl + rawBrl) * 100) / 100;

    shares.push({
      participantId: p.id,
      foreignShare: Math.max(0, rawForeign),
      brlShare: Math.max(0, rawBrl),
      percentage: Math.round(ratio * 1000) / 10,
      sharesWeight: customMap.get(p.id)?.sharesWeight ?? 1,
    });
  }

  return shares;
}

/**
 * Algoritmo estilo Splitwise / Tricount de simplificação de dívidas em múltiplas moedas:
 * Recebe os saldos líquidos dos participantes (Positivo = Credor que pagou a mais; Negativo = Devedor)
 * e retorna o número mínimo de transferências necessárias para zerar a viagem.
 */
export function simplifyTripDebts(
  balances: TripParticipantBalance[],
  defaultEffectiveRate: number
): TripDebtTransfer[] {
  const debtors = balances
    .filter((b) => b.netBalanceForeign < -0.009)
    .map((b) => ({
      id: b.participantId,
      name: b.participantName,
      debtForeign: Math.abs(b.netBalanceForeign),
      debtBrl: Math.abs(b.netBalanceBrl),
    }))
    .sort((a, b) => b.debtForeign - a.debtForeign);

  const creditors = balances
    .filter((b) => b.netBalanceForeign > 0.009)
    .map((b) => ({
      id: b.participantId,
      name: b.participantName,
      creditForeign: b.netBalanceForeign,
      creditBrl: b.netBalanceBrl,
    }))
    .sort((a, b) => b.creditForeign - a.creditForeign);

  const transfers: TripDebtTransfer[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settledForeign =
      Math.round(Math.min(debtor.debtForeign, creditor.creditForeign) * 100) / 100;

    if (settledForeign > 0.009) {
      // Calcula a taxa efetiva proporcional das despesas que geraram o saldo
      const creditorImpliedRate =
        creditor.creditForeign > 0
          ? creditor.creditBrl / creditor.creditForeign
          : defaultEffectiveRate;

      const settledBrl =
        Math.round(settledForeign * creditorImpliedRate * 100) / 100;

      transfers.push({
        fromParticipantId: debtor.id,
        fromName: debtor.name,
        toParticipantId: creditor.id,
        toName: creditor.name,
        amountForeign: settledForeign,
        amountBrlEffective: settledBrl,
        impliedEffectiveRate:
          Math.round(creditorImpliedRate * 10000) / 10000,
      });

      debtor.debtForeign = Math.round((debtor.debtForeign - settledForeign) * 100) / 100;
      debtor.debtBrl = Math.max(0, Math.round((debtor.debtBrl - settledBrl) * 100) / 100);
      creditor.creditForeign =
        Math.round((creditor.creditForeign - settledForeign) * 100) / 100;
      creditor.creditBrl = Math.max(
        0,
        Math.round((creditor.creditBrl - settledBrl) * 100) / 100
      );
    }

    if (debtor.debtForeign <= 0.009) dIdx++;
    if (creditor.creditForeign <= 0.009) cIdx++;
  }

  return transfers;
}

function getDatesBetween(startDate: string, endDate: string): string[] {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  if (!sy || !ey) return [startDate];

  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  if (end < start) return [startDate];

  const dates: string[] = [];
  const current = new Date(start);
  let guard = 0;
  while (current <= end && guard < 90) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
    guard++;
  }
  return dates.length > 0 ? dates : [startDate];
}

/**
 * Motor completo de inteligência de viagem estilo TravelSpend + Splitwise Multi-Moeda:
 * Calcula gastos pessoais vs. gastos do grupo, ritmo diário, orçamento restante por dia,
 * saldo da carteira de câmbio (Wise/Espécie), divisão por categoria e acerto de contas.
 */
export function calculateTripDashboardSummary(
  trip: Trip,
  allTransactions: Transaction[],
  categories: Category[] = [],
  referenceTodayStr?: string
): TripDashboardSummary {
  const {
    weightedAverageRate,
    totalForeignPurchased,
    totalBrlPaid: totalBrlPurchasedForLots,
  } = calculateTripWeightedAverageRate(
    trip.exchangeLots || [],
    trip.defaultExchangeRate || CURRENCY_CATALOG[trip.currency]?.defaultCommercialRateBrl || 1
  );

  const tripTxs = allTransactions.filter(
    (tx) => tx.tripId === trip.id && tx.type === 'expense' && !tx.isInvoicePayment
  );

  const meParticipant =
    trip.participants.find((p) => p.isMe) ||
    trip.participants[0] || {
      id: 'me',
      name: 'Você',
      isMe: true,
      color: '#059669',
    };

  const balanceMap = new Map<string, TripParticipantBalance>();
  for (const p of trip.participants) {
    balanceMap.set(p.id, {
      participantId: p.id,
      participantName: p.name,
      isMe: Boolean(p.isMe),
      color: p.color,
      pixKey: p.pixKey,
      paidForeign: 0,
      paidBrl: 0,
      consumedForeign: 0,
      consumedBrl: 0,
      settledSentForeign: 0,
      settledReceivedForeign: 0,
      settledSentBrl: 0,
      settledReceivedBrl: 0,
      netBalanceForeign: 0,
      netBalanceBrl: 0,
    });
  }

  let groupTotalSpendForeign = 0;
  let groupTotalSpendBrl = 0;
  let myPersonalSpendForeign = 0;
  let myPersonalSpendBrl = 0;
  let myOutOfPocketPaidForeign = 0;
  let myOutOfPocketPaidBrl = 0;
  let foreignSpentFromGlobalOrCash = 0;

  const dailyMap = new Map<
    string,
    {
      mySpendForeign: number;
      mySpendBrl: number;
      groupSpendForeign: number;
      groupSpendBrl: number;
    }
  >();

  const catMap = new Map<
    string,
    {
      mySpendForeign: number;
      mySpendBrl: number;
      groupSpendForeign: number;
      groupSpendBrl: number;
    }
  >();

  for (const tx of tripTxs) {
    const txBrl = tx.amount;
    // Determina o valor na moeda base da viagem
    let txForeign = tx.originalAmount || 0;
    if (!txForeign || tx.originalCurrency === 'BRL') {
      txForeign =
        weightedAverageRate > 0
          ? Math.round((txBrl / weightedAverageRate) * 100) / 100
          : txBrl;
    } else if (tx.originalCurrency && tx.originalCurrency !== trip.currency) {
      txForeign =
        weightedAverageRate > 0
          ? Math.round((txBrl / weightedAverageRate) * 100) / 100
          : tx.originalAmount || 0;
    }

    const payerId = tx.paidByParticipantId || meParticipant.id;
    const payerEntry = balanceMap.get(payerId) || balanceMap.get(meParticipant.id);
    if (payerEntry) {
      payerEntry.paidForeign = Math.round((payerEntry.paidForeign + txForeign) * 100) / 100;
      payerEntry.paidBrl = Math.round((payerEntry.paidBrl + txBrl) * 100) / 100;
    }

    if (payerId === meParticipant.id) {
      myOutOfPocketPaidForeign =
        Math.round((myOutOfPocketPaidForeign + txForeign) * 100) / 100;
      myOutOfPocketPaidBrl = Math.round((myOutOfPocketPaidBrl + txBrl) * 100) / 100;

      if (
        tx.currencyRegime === 'global_account' ||
        tx.currencyRegime === 'cash_fx' ||
        (!tx.creditCardId && tx.originalCurrency && tx.originalCurrency !== 'BRL')
      ) {
        foreignSpentFromGlobalOrCash =
          Math.round((foreignSpentFromGlobalOrCash + txForeign) * 100) / 100;
      }
    }

    // Distribui o consumo entre os participantes (tripShares) ou 100% para quem pagou
    let myTxForeign = txForeign;
    let myTxBrl = txBrl;

    if (Array.isArray(tx.tripShares) && tx.tripShares.length > 0) {
      myTxForeign = 0;
      myTxBrl = 0;
      for (const share of tx.tripShares) {
        const memberEntry = balanceMap.get(share.participantId);
        if (memberEntry) {
          memberEntry.consumedForeign =
            Math.round((memberEntry.consumedForeign + share.foreignShare) * 100) / 100;
          memberEntry.consumedBrl =
            Math.round((memberEntry.consumedBrl + share.brlShare) * 100) / 100;
        }
        if (share.participantId === meParticipant.id) {
          myTxForeign = Math.round((myTxForeign + share.foreignShare) * 100) / 100;
          myTxBrl = Math.round((myTxBrl + share.brlShare) * 100) / 100;
        }
      }
    } else {
      if (payerEntry) {
        payerEntry.consumedForeign =
          Math.round((payerEntry.consumedForeign + txForeign) * 100) / 100;
        payerEntry.consumedBrl =
          Math.round((payerEntry.consumedBrl + txBrl) * 100) / 100;
      }
      if (payerId !== meParticipant.id) {
        myTxForeign = 0;
        myTxBrl = 0;
      }
    }

    groupTotalSpendForeign = Math.round((groupTotalSpendForeign + txForeign) * 100) / 100;
    groupTotalSpendBrl = Math.round((groupTotalSpendBrl + txBrl) * 100) / 100;
    myPersonalSpendForeign = Math.round((myPersonalSpendForeign + myTxForeign) * 100) / 100;
    myPersonalSpendBrl = Math.round((myPersonalSpendBrl + myTxBrl) * 100) / 100;

    // Série Diária
    const dayPoint = dailyMap.get(tx.date) || {
      mySpendForeign: 0,
      mySpendBrl: 0,
      groupSpendForeign: 0,
      groupSpendBrl: 0,
    };
    dayPoint.mySpendForeign = Math.round((dayPoint.mySpendForeign + myTxForeign) * 100) / 100;
    dayPoint.mySpendBrl = Math.round((dayPoint.mySpendBrl + myTxBrl) * 100) / 100;
    dayPoint.groupSpendForeign =
      Math.round((dayPoint.groupSpendForeign + txForeign) * 100) / 100;
    dayPoint.groupSpendBrl = Math.round((dayPoint.groupSpendBrl + txBrl) * 100) / 100;
    dailyMap.set(tx.date, dayPoint);

    // Série por Categoria
    const catPoint = catMap.get(tx.categoryId) || {
      mySpendForeign: 0,
      mySpendBrl: 0,
      groupSpendForeign: 0,
      groupSpendBrl: 0,
    };
    catPoint.mySpendForeign = Math.round((catPoint.mySpendForeign + myTxForeign) * 100) / 100;
    catPoint.mySpendBrl = Math.round((catPoint.mySpendBrl + myTxBrl) * 100) / 100;
    catPoint.groupSpendForeign =
      Math.round((catPoint.groupSpendForeign + txForeign) * 100) / 100;
    catPoint.groupSpendBrl = Math.round((catPoint.groupSpendBrl + txBrl) * 100) / 100;
    catMap.set(tx.categoryId, catPoint);
  }

  // Aplica os reembolsos / acertos já realizados (settlements)
  for (const st of trip.settlements || []) {
    const sender = balanceMap.get(st.fromParticipantId);
    const receiver = balanceMap.get(st.toParticipantId);
    if (sender) {
      sender.settledSentForeign =
        Math.round((sender.settledSentForeign + st.foreignAmountEquivalent) * 100) / 100;
      sender.settledSentBrl =
        Math.round((sender.settledSentBrl + st.brlAmountSettled) * 100) / 100;
    }
    if (receiver) {
      receiver.settledReceivedForeign =
        Math.round((receiver.settledReceivedForeign + st.foreignAmountEquivalent) * 100) / 100;
      receiver.settledReceivedBrl =
        Math.round((receiver.settledReceivedBrl + st.brlAmountSettled) * 100) / 100;
    }
  }

  const participantBalances: TripParticipantBalance[] = [];
  for (const b of balanceMap.values()) {
    // Saldo líquido = (Quanto Pagou - Quanto Consumiu) + (Quanto Pagou em Acertos - Quanto Recebeu em Acertos)
    b.netBalanceForeign =
      Math.round(
        (b.paidForeign -
          b.consumedForeign +
          b.settledSentForeign -
          b.settledReceivedForeign) *
          100
      ) / 100;
    b.netBalanceBrl =
      Math.round(
        (b.paidBrl - b.consumedBrl + b.settledSentBrl - b.settledReceivedBrl) * 100
      ) / 100;
    participantBalances.push(b);
  }

  const simplifiedDebts = simplifyTripDebts(participantBalances, weightedAverageRate);
  const myBalanceObj = participantBalances.find((p) => p.isMe) || participantBalances[0];
  const myNetSettlementForeign = myBalanceObj ? myBalanceObj.netBalanceForeign : 0;
  const myNetSettlementBrl = myBalanceObj ? myBalanceObj.netBalanceBrl : 0;

  // Cálculo de dias de viagem e ritmo diário (TravelSpend)
  const tripDates = getDatesBetween(trip.startDate, trip.endDate);
  const totalDays = Math.max(1, tripDates.length);

  // Determina quantos dias já decorreram (com base nas datas de gastos ou data de referência)
  const txDates = Array.from(dailyMap.keys()).sort();
  const latestTxDate = txDates.length > 0 ? txDates[txDates.length - 1] : '';
  const effectiveToday = referenceTodayStr || latestTxDate || trip.startDate;

  let elapsedDays = 1;
  if (effectiveToday <= trip.startDate) {
    elapsedDays = txDates.length > 0 ? Math.max(1, txDates.length) : 1;
  } else if (effectiveToday >= trip.endDate) {
    elapsedDays = totalDays;
  } else {
    const idx = tripDates.indexOf(effectiveToday);
    elapsedDays = idx >= 0 ? idx + 1 : Math.max(1, txDates.length);
  }

  const remainingDays = Math.max(0, totalDays - elapsedDays);

  const budgetForeign = Math.max(0, trip.budgetForeign || 0);
  const budgetBrlEquivalent =
    Math.round(budgetForeign * weightedAverageRate * 100) / 100;
  const budgetRemainingForeign =
    Math.round((budgetForeign - myPersonalSpendForeign) * 100) / 100;
  const budgetUsedPercent =
    budgetForeign > 0
      ? Math.round((myPersonalSpendForeign / budgetForeign) * 1000) / 10
      : 0;

  const myDailyAverageForeign =
    Math.round((myPersonalSpendForeign / Math.max(1, elapsedDays)) * 100) / 100;
  const myDailyAverageBrl =
    Math.round(myDailyAverageForeign * weightedAverageRate * 100) / 100;

  const daysDivisorForSafeRemaining = remainingDays > 0 ? remainingDays : 1;
  const safeRemainingDailyForeign =
    budgetRemainingForeign > 0
      ? Math.round((budgetRemainingForeign / daysDivisorForSafeRemaining) * 100) / 100
      : 0;
  const safeRemainingDailyBrl =
    Math.round(safeRemainingDailyForeign * weightedAverageRate * 100) / 100;

  // Monta a série diária incluindo todos os dias da viagem + eventuais despesas pré-viagem
  const allDatesSet = new Set<string>([...tripDates, ...txDates]);
  const sortedAllDates = Array.from(allDatesSet).sort();

  const dailySeries: TripDailySpendPoint[] = sortedAllDates.map((dStr) => {
    const pt = dailyMap.get(dStr) || {
      mySpendForeign: 0,
      mySpendBrl: 0,
      groupSpendForeign: 0,
      groupSpendBrl: 0,
    };
    const parts = dStr.split('-');
    const dayLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dStr;
    return {
      date: dStr,
      dayLabel,
      ...pt,
    };
  });

  const catLookup = new Map(categories.map((c) => [c.id, c]));
  const categoryBreakdown: TripCategorySpendPoint[] = Array.from(catMap.entries())
    .map(([catId, val]) => {
      const cat = catLookup.get(catId);
      return {
        categoryId: catId,
        categoryName: cat?.name || 'Viagem & Geral',
        categoryColor: cat?.color || '#0284c7',
        mySpendForeign: val.mySpendForeign,
        mySpendBrl: val.mySpendBrl,
        groupSpendForeign: val.groupSpendForeign,
        groupSpendBrl: val.groupSpendBrl,
        percentOfMySpend:
          myPersonalSpendForeign > 0
            ? Math.round((val.mySpendForeign / myPersonalSpendForeign) * 1000) / 10
            : 0,
      };
    })
    .sort((a, b) => b.mySpendForeign - a.mySpendForeign);

  const remainingForeignWalletBalance =
    Math.round((totalForeignPurchased - foreignSpentFromGlobalOrCash) * 100) / 100;

  return {
    tripId: trip.id,
    currency: trip.currency,
    weightedAverageRate,
    totalForeignPurchased,
    totalBrlPurchasedForLots,
    remainingForeignWalletBalance,
    totalDays,
    elapsedDays,
    remainingDays,
    groupTotalSpendForeign,
    groupTotalSpendBrl,
    myPersonalSpendForeign,
    myPersonalSpendBrl,
    myOutOfPocketPaidForeign,
    myOutOfPocketPaidBrl,
    budgetForeign,
    budgetBrlEquivalent,
    budgetRemainingForeign,
    budgetUsedPercent,
    myDailyAverageForeign,
    myDailyAverageBrl,
    safeRemainingDailyForeign,
    safeRemainingDailyBrl,
    dailySeries,
    categoryBreakdown,
    participantBalances,
    simplifiedDebts,
    myNetSettlementForeign,
    myNetSettlementBrl,
  };
}

export interface FinancialIntegrityCheckItem {
  id: string;
  title: string;
  description: string;
  passed: boolean;
  issueCount: number;
  issueDetails?: string[];
  metricLabel: string;
}

export interface FinancialIntegrityAuditReport {
  isAllHealthy: boolean;
  totalChecks: number;
  passedChecks: number;
  totalIssuesFound: number;
  checks: FinancialIntegrityCheckItem[];
}

const LEGACY_DEMO_IDS = new Set([
  'acc-itau',
  'acc-nubank',
  'card-nubank',
  'card-itau',
  'trip-eurotrip',
]);

function isLegacyMockId(id: string): boolean {
  if (!id || typeof id !== 'string') return true;
  const normalizedId = id.trim().toLowerCase();
  return /^(mock|demo|seed)(?:-|$)/.test(normalizedId) || LEGACY_DEMO_IDS.has(normalizedId);
}

export function isLegacyMockRecord(item: unknown): boolean {
  if (!item || typeof item !== 'object') return true;
  const rec = item as Record<string, unknown>;
  if (rec.isMock === true || rec.isDemo === true) return true;
  const id = typeof rec.id === 'string' ? rec.id : '';
  if (isLegacyMockId(id)) return true;

  const fitid = typeof rec.fitid === 'string' ? rec.fitid.trim().toUpperCase() : '';
  if (
    fitid.startsWith('NUBANK-SAL-') ||
    fitid.startsWith('NUBANK-MKT-') ||
    fitid.startsWith('NUBANK-IFOOD-') ||
    fitid.startsWith('NUBANK-UBER-') ||
    fitid.startsWith('NUBANK-NETFLIX-') ||
    fitid.startsWith('MOCK-') ||
    fitid.startsWith('DEMO-')
  ) {
    return true;
  }

  return false;
}

export function stripLegacyMockRecords<T>(items: T[]): T[] {
  return items.filter((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const id = (item as Record<string, unknown>).id;
    return typeof id === 'string' && id.trim().length > 0 && !isLegacyMockRecord(item);
  });
}


/**
 * Audita em tempo real a Fonte Única de Dados (Single Source of Truth — SSOT)
 * verificando integridade referencial, partidas dobradas, faturas, câmbio, rateios e ausência de dados mock.
 */
export function runFinancialIntegrityAudit(params: {
  accountsCount: number;
  cardsCount: number;
  transactions: Transaction[];
  trips: Trip[];
  accounts?: BankAccount[];
  cards?: CreditCard[];
  categories?: Category[];
  investments?: InvestmentAsset[];
  goals?: SavingsGoal[];
}): FinancialIntegrityAuditReport {
  const {
    transactions,
    trips,
    accounts = [],
    cards = [],
    categories = [],
    investments = [],
    goals = [],
  } = params;

  // 1. Validação Estrutural de Lançamentos (Datas, Competência e Valores Positivos)
  const invalidStructureTxs = transactions.filter(
    (t) =>
      !t.id ||
      typeof t.amount !== 'number' ||
      Number.isNaN(t.amount) ||
      t.amount < 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(t.date || '') ||
      !/^\d{4}-\d{2}$/.test(t.competenceMonth || '')
  );

  // 2. Integridade Referencial (Vínculos de Contas, Cartões, Categorias, Viagens e Metas)
  const accountIds = new Set(accounts.map((a) => a.id));
  const cardIds = new Set(cards.map((c) => c.id));
  const categoryIds = new Set(categories.map((c) => c.id));
  const tripIds = new Set(trips.map((tr) => tr.id));
  const assetIds = new Set(investments.map((inv) => inv.id));

  const orphanRefIssues: string[] = [];
  if (accounts.length > 0 || cards.length > 0 || categories.length > 0) {
    for (const tx of transactions) {
      if (
        accounts.length > 0 &&
        tx.accountId &&
        !tx.isCompanionOnlyExpense &&
        !accountIds.has(tx.accountId)
      ) {
        orphanRefIssues.push(`Lançamento "${tx.description}" aponta para conta inexistente.`);
      }
      if (cards.length > 0 && tx.creditCardId && !cardIds.has(tx.creditCardId)) {
        orphanRefIssues.push(`Lançamento "${tx.description}" aponta para cartão inexistente.`);
      }
      if (
        categories.length > 0 &&
        tx.type !== 'transfer' &&
        !tx.isInvoicePayment &&
        tx.categoryId &&
        !categoryIds.has(tx.categoryId)
      ) {
        orphanRefIssues.push(
          `Lançamento "${tx.description}" aponta para categoria removida.`
        );
      }
      if (tx.tripId && !tripIds.has(tx.tripId)) {
        orphanRefIssues.push(`Lançamento "${tx.description}" aponta para viagem removida.`);
      }
      if (
        investments.length > 0 &&
        tx.targetInvestmentAssetId &&
        !assetIds.has(tx.targetInvestmentAssetId)
      ) {
        orphanRefIssues.push(
          `Lançamento "${tx.description}" aponta para ativo de investimento removido.`
        );
      }
    }
    for (const g of goals) {
      if (g.linkedAssetId && !assetIds.has(g.linkedAssetId)) {
        orphanRefIssues.push(`Meta "${g.name}" vinculada a ativo removido.`);
      }
    }
  }

  // 3. Partidas Dobradas em Transferências entre Contas e Aportes Diretos em Ativos
  const transfers = transactions.filter((t) => t.type === 'transfer');
  const invalidTransfers = transfers.filter((t) => {
    if (!t.accountId) return true;
    const hasValidAccountDest =
      Boolean(t.destinationAccountId) && t.accountId !== t.destinationAccountId;
    const hasValidInvestmentDest = Boolean(t.targetInvestmentAssetId);
    return !hasValidAccountDest && !hasValidInvestmentDest;
  });

  // 4. Pagamentos de Fatura Isolados das Categorias de Consumo (Sem Dupla Contagem)
  const invoicePayments = transactions.filter((t) => t.isInvoicePayment);
  const invalidInvoicePayments = invoicePayments.filter(
    (t) => t.type !== 'expense' || Boolean(t.creditCardId)
  );

  // 5. Contas Internacionais e Despesas em Moeda Estrangeira com Câmbio e IOF Íntegros
  const fxTransactions = transactions.filter(
    (t) => t.originalCurrency && t.originalCurrency !== 'BRL' && (t.originalAmount || 0) > 0
  );
  const invalidFxTxs = fxTransactions.filter(
    (t) => t.amount <= 0 || (t.effectiveExchangeRate || t.exchangeRate || 0) <= 0
  );
  const invalidIntlAccounts = accounts.filter(
    (a) => a.type === 'international' && (!a.currency || a.currency === 'BRL')
  );
  const fxIssuesCount = invalidFxTxs.length + invalidIntlAccounts.length;

  // 6. Rateios de Viagem e Isolamento de Gastos Pagos por Terceiros
  const splitTripTxs = transactions.filter(
    (t) => Array.isArray(t.tripShares) && t.tripShares.length > 0
  );
  const invalidSplitTxs = splitTripTxs.filter((t) => {
    const sumBrl = (t.tripShares || []).reduce((acc, s) => acc + s.brlShare, 0);
    return Math.abs(sumBrl - t.amount) > 0.05;
  });
  const companionPaidTxs = transactions.filter(
    (t) => t.paidByParticipantId && t.paidByParticipantId !== 'me'
  );
  const unisolatedCompanionTxs = companionPaidTxs.filter(
    (t) => !t.isCompanionOnlyExpense
  );
  const splitIssuesCount = invalidSplitTxs.length + unisolatedCompanionTxs.length;

  // 7. Marcadores explícitos de demonstração nos dados carregados
  const mockItemsCount =
    accounts.filter((x) => isLegacyMockRecord(x)).length +
    cards.filter((x) => isLegacyMockRecord(x)).length +
    transactions.filter((x) => isLegacyMockRecord(x)).length +
    investments.filter((x) => isLegacyMockRecord(x)).length +
    goals.filter((x) => isLegacyMockRecord(x)).length +
    trips.filter((x) => isLegacyMockRecord(x)).length;

  const checks: FinancialIntegrityCheckItem[] = [
    {
      id: 'ssot_engine',
      title: 'Fonte Única de Dados & Estrutura Contábil (SSOT)',
      description:
        'Todos os lançamentos possuem datas ISO válidas, mês de competência estruturado e valores numéricos íntegros.',
      passed: invalidStructureTxs.length === 0,
      issueCount: invalidStructureTxs.length,
      issueDetails: invalidStructureTxs.map(
        (t) => `Lançamento "${t.description || t.id}" com data/competência ou valor inválido.`
      ),
      metricLabel:
        invalidStructureTxs.length === 0
          ? `${transactions.length} lançamentos unificados`
          : `${invalidStructureTxs.length} erro(s) estrutural(is)`,
    },
    {
      id: 'orphan_references',
      title: 'Integridade Referencial (Contas, Cartões, Categorias e Metas)',
      description:
        'Verifica se algum lançamento, fatura ou meta aponta para conta, cartão, categoria, viagem ou ativo excluído.',
      passed: orphanRefIssues.length === 0,
      issueCount: orphanRefIssues.length,
      issueDetails: orphanRefIssues,
      metricLabel:
        orphanRefIssues.length === 0
          ? '100% dos vínculos ativos'
          : `${orphanRefIssues.length} vínculo(s) órfão(s)`,
    },
    {
      id: 'double_entry_transfers',
      title: 'Partidas Dobradas em Transferências & Aportes',
      description:
        'Transferências debitam a origem e creditam o destino distinto sem inflar receitas ou despesas do mês.',
      passed: invalidTransfers.length === 0,
      issueCount: invalidTransfers.length,
      issueDetails: invalidTransfers.map(
        (t) => `Transferência "${t.description}" sem conta origem/destino distinta.`
      ),
      metricLabel:
        invalidTransfers.length === 0
          ? `${transfers.length} transferências íntegras`
          : `${invalidTransfers.length} transferência(s) inválida(s)`,
    },
    {
      id: 'credit_card_competence',
      title: 'Isolamento Caixa vs. Competência de Cartões',
      description:
        'Compras no crédito respeitam o fechamento da fatura e baixas de fatura não geram dupla contagem nas categorias.',
      passed: invalidInvoicePayments.length === 0,
      issueCount: invalidInvoicePayments.length,
      issueDetails: invalidInvoicePayments.map(
        (t) => `Baixa de fatura "${t.description}" vinculada incorretamente como compra.`
      ),
      metricLabel:
        invalidInvoicePayments.length === 0
          ? `${invoicePayments.length} baixas conciliadas`
          : `${invalidInvoicePayments.length} baixa(s) com conflito`,
    },
    {
      id: 'fx_multi_currency',
      title: 'Contas Internacionais & Conversão Cambial (IOF / VET)',
      description:
        'Contas globais (Wise/Nomad) independentes de viagem e compras em moeda estrangeira com VET e IOF consistentes.',
      passed: fxIssuesCount === 0,
      issueCount: fxIssuesCount,
      metricLabel:
        fxIssuesCount === 0
          ? `${fxTransactions.length} compras multi-moeda`
          : `${fxIssuesCount} alerta(s) cambial(is)`,
    },
    {
      id: 'trip_group_split',
      title: 'Fechamento de Centavos & Isolamento de Terceiros (Splitwise)',
      description:
        'Rateios em grupo fecham 100% ao centavo e gastos pagos por amigos não descontam do seu banco pessoal.',
      passed: splitIssuesCount === 0,
      issueCount: splitIssuesCount,
      metricLabel:
        splitIssuesCount === 0
          ? `${trips.length} viagens / ${splitTripTxs.length} rateios`
          : `${splitIssuesCount} divergência(s) de rateio`,
    },
    {
      id: 'zero_mock_data',
      title: 'Marcadores explícitos de demonstração',
      description:
        'Procura IDs e campos marcados explicitamente como demonstração nos registros carregados nesta sessão. Não verifica o banco diretamente.',
      passed: mockItemsCount === 0,
      issueCount: mockItemsCount,
      metricLabel:
        mockItemsCount === 0
          ? 'Nenhum marcador explícito encontrado'
          : `${mockItemsCount} registro(s) marcado(s) para revisão`,
    },
  ];

  const passedChecks = checks.filter((c) => c.passed).length;
  const totalIssuesFound = checks.reduce((acc, c) => acc + c.issueCount, 0);

  return {
    isAllHealthy: passedChecks === checks.length,
    totalChecks: checks.length,
    passedChecks,
    totalIssuesFound,
    checks,
  };
}

export interface SanitizeFinancialStateResult {
  repairedCount: number;
  repairedLog: string[];
  accounts: BankAccount[];
  cards: CreditCard[];
  transactions: Transaction[];
  goals: SavingsGoal[];
  investments: InvestmentAsset[];
  trips: Trip[];
}

/**
 * Executa varredura e auto-reparo determinístico em toda a base financeira para corrigir
 * vínculos órfãos, competências ausentes, isolamento de despesas de terceiros, arredondamento de rateios
 * e remoção de eventuais registros legados/mock.
 */
export function sanitizeAndRepairFinancialState(params: {
  accounts: BankAccount[];
  cards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  goals: SavingsGoal[];
  investments: InvestmentAsset[];
  trips: Trip[];
}): SanitizeFinancialStateResult {
  const repairedLog: string[] = [];
  let repairedCount = 0;

  const cleanAccounts = params.accounts
    .filter((a) => {
      const ok = !isLegacyMockRecord(a);
      if (!ok) {
        repairedCount++;
        repairedLog.push(`Conta legada/mock "${a.name}" removida.`);
      }
      return ok;
    })
    .map((a) => {
      if (a.type === 'international' && (!a.currency || a.currency === 'BRL')) {
        repairedCount++;
        repairedLog.push(`Moeda da conta internacional "${a.name}" ajustada para EUR.`);
        return { ...a, currency: 'EUR' as CurrencyCode };
      }
      return a;
    });

  const cleanCards = params.cards.filter((c) => {
    const ok = !isLegacyMockRecord(c);
    if (!ok) {
      repairedCount++;
      repairedLog.push(`Cartão legado/mock "${c.name}" removido.`);
    }
    return ok;
  });

  const cleanInvestments = params.investments
    .filter((inv) => {
      const ok = !isLegacyMockRecord(inv);
      if (!ok) {
        repairedCount++;
        repairedLog.push(`Ativo legado/mock "${inv.ticker}" removido.`);
      }
      return ok;
    })
    .map((inv) => {
      const safeQty = Math.max(0, Number(inv.quantity) || 0);
      const safeAvg = Math.max(0, Number(inv.averagePrice) || 0);
      const safeCur = Math.max(0, Number(inv.currentPrice) || safeAvg);
      if (
        safeQty !== inv.quantity ||
        safeAvg !== inv.averagePrice ||
        safeCur !== inv.currentPrice
      ) {
        repairedCount++;
        repairedLog.push(`Valores numéricos do ativo "${inv.ticker}" normalizados.`);
        return {
          ...inv,
          quantity: safeQty,
          averagePrice: safeAvg,
          currentPrice: safeCur,
        };
      }
      return inv;
    });

  const cleanTrips = params.trips.filter((tr) => {
    const ok = !isLegacyMockRecord(tr);
    if (!ok) {
      repairedCount++;
      repairedLog.push(`Viagem legada/mock "${tr.name}" removida.`);
    }
    return ok;
  });

  const accountIds = new Set(cleanAccounts.map((a) => a.id));
  const cardIds = new Set(cleanCards.map((c) => c.id));
  const categoryIds = new Set(params.categories.map((c) => c.id));
  const tripIds = new Set(cleanTrips.map((tr) => tr.id));
  const assetIds = new Set(cleanInvestments.map((inv) => inv.id));

  const defaultExpenseCatId =
    params.categories.find((c) => c.type === 'expense')?.id ||
    params.categories[0]?.id ||
    'cat-moradia';
  const defaultIncomeCatId =
    params.categories.find((c) => c.type === 'income')?.id ||
    params.categories[0]?.id ||
    'cat-salario';
  const fallbackAccountId = cleanAccounts[0]?.id || '';

  const cleanGoals = params.goals
    .filter((g) => {
      const ok = !isLegacyMockRecord(g);
      if (!ok) {
        repairedCount++;
        repairedLog.push(`Meta legada/mock "${g.name}" removida.`);
      }
      return ok;
    })
    .map((g) => {
      if (g.linkedAssetId && !assetIds.has(g.linkedAssetId)) {
        repairedCount++;
        repairedLog.push(`Vínculo de ativo inexistente removido da meta "${g.name}".`);
        return { ...g, linkedAssetId: undefined };
      }
      return g;
    });

  const cleanTransactions = params.transactions
    .filter((tx) => {
      const ok = !isLegacyMockRecord(tx);
      if (!ok) {
        repairedCount++;
        repairedLog.push(`Lançamento legado/mock "${tx.description}" removido.`);
      }
      return ok;
    })
    .map((tx) => {
      let modified = false;
      const nextTx: Transaction = { ...tx };

      // Ensure valid date and competenceMonth
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nextTx.date || '')) {
        nextTx.date = new Date().toISOString().slice(0, 10);
        modified = true;
      }
      if (!/^\d{4}-\d{2}$/.test(nextTx.competenceMonth || '')) {
        nextTx.competenceMonth = nextTx.date.slice(0, 7);
        modified = true;
      }

      // Ensure non-negative amount
      if (typeof nextTx.amount !== 'number' || Number.isNaN(nextTx.amount) || nextTx.amount < 0) {
        nextTx.amount = Math.abs(Number(nextTx.amount) || 0);
        modified = true;
      }

      // Invoice payment isolation
      if (nextTx.isInvoicePayment && nextTx.creditCardId) {
        nextTx.creditCardId = undefined;
        modified = true;
      }

      // Companion-paid isolation
      if (
        nextTx.paidByParticipantId &&
        nextTx.paidByParticipantId !== 'me' &&
        !nextTx.isCompanionOnlyExpense
      ) {
        nextTx.isCompanionOnlyExpense = true;
        modified = true;
      }

      // Orphan tripId cleanup
      if (nextTx.tripId && !tripIds.has(nextTx.tripId)) {
        nextTx.tripId = undefined;
        modified = true;
      }

      // Orphan targetInvestmentAssetId cleanup
      if (
        cleanInvestments.length > 0 &&
        nextTx.targetInvestmentAssetId &&
        !assetIds.has(nextTx.targetInvestmentAssetId)
      ) {
        nextTx.targetInvestmentAssetId = undefined;
        if (nextTx.type === 'transfer' && !nextTx.destinationAccountId) {
          nextTx.type = 'expense';
          nextTx.categoryId = categoryIds.has('cat-aportes')
            ? 'cat-aportes'
            : defaultExpenseCatId;
        }
        modified = true;
      }

      // Destination-less transfer repair
      if (
        nextTx.type === 'transfer' &&
        !nextTx.destinationAccountId &&
        !nextTx.targetInvestmentAssetId
      ) {
        nextTx.type = 'expense';
        nextTx.categoryId =
          nextTx.categoryId && categoryIds.has(nextTx.categoryId)
            ? nextTx.categoryId
            : categoryIds.has('cat-aportes')
            ? 'cat-aportes'
            : defaultExpenseCatId;
        modified = true;
      }

      // Orphan categoryId repair
      if (
        params.categories.length > 0 &&
        nextTx.type !== 'transfer' &&
        !nextTx.isInvoicePayment &&
        (!nextTx.categoryId || !categoryIds.has(nextTx.categoryId))
      ) {
        nextTx.categoryId =
          nextTx.type === 'income' ? defaultIncomeCatId : defaultExpenseCatId;
        modified = true;
      }

      // Orphan creditCardId cleanup
      if (cleanCards.length > 0 && nextTx.creditCardId && !cardIds.has(nextTx.creditCardId)) {
        nextTx.creditCardId = undefined;
        modified = true;
      }

      // Orphan accountId repair
      if (
        cleanAccounts.length > 0 &&
        nextTx.accountId &&
        !nextTx.isCompanionOnlyExpense &&
        !accountIds.has(nextTx.accountId)
      ) {
        nextTx.accountId = fallbackAccountId;
        modified = true;
      }

      // TripShares cent alignment
      if (Array.isArray(nextTx.tripShares) && nextTx.tripShares.length > 0) {
        const sumBrl = nextTx.tripShares.reduce((acc, s) => acc + s.brlShare, 0);
        const diff = Math.round((nextTx.amount - sumBrl) * 100) / 100;
        if (Math.abs(diff) > 0.01) {
          const updatedShares = [...nextTx.tripShares];
          updatedShares[0] = {
            ...updatedShares[0],
            brlShare: Math.round((updatedShares[0].brlShare + diff) * 100) / 100,
          };
          nextTx.tripShares = updatedShares;
          modified = true;
        }
      }

      if (modified) {
        repairedCount++;
        repairedLog.push(`Lançamento "${nextTx.description}" normalizado.`);
      }
      return nextTx;
    });

  return {
    repairedCount,
    repairedLog,
    accounts: cleanAccounts,
    cards: cleanCards,
    transactions: cleanTransactions,
    goals: cleanGoals,
    investments: cleanInvestments,
    trips: cleanTrips,
  };
}
