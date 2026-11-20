/** Economia cambial: compara o custo dos lotes com a cotação comercial. */
import type {
  CurrencyCode,
  TripExchangeLot,
} from '../../types/finance';
import {
  CURRENCY_CATALOG,
} from './currencyCatalog.ts';
import {
  isUsableExchangeLot,
} from './exchangeRates.ts';

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
    Number.isFinite(fallbackBenchmarkRate) && fallbackBenchmarkRate > 0
      ? fallbackBenchmarkRate
      : meta.defaultCommercialRateBrl > 0
      ? meta.defaultCommercialRateBrl
      : 1.0;

  const validLots = (exchangeLots || []).filter(isUsableExchangeLot);
  if (validLots.length === 0) {
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
  const sortedLots = validLots.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const lotSeries: LotSavingsItem[] = sortedLots.map((lot, idx) => {
    const effectiveRate = Number.isFinite(lot.effectiveRateBrl) && lot.effectiveRateBrl > 0
      ? lot.effectiveRateBrl
      : Number.isFinite(lot.rateBase) && lot.rateBase > 0
      ? lot.rateBase
      : lot.totalBrlPaid / lot.foreignAmount;
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
        const rate = Number.isFinite(l.effectiveRateBrl) && l.effectiveRateBrl > 0
          ? l.effectiveRateBrl
          : Number.isFinite(l.rateBase) && l.rateBase > 0
          ? l.rateBase
          : l.totalBrlPaid / l.foreignAmount;
        totalBrlPaid += Number.isFinite(l.totalBrlPaid) && l.totalBrlPaid > 0
          ? l.totalBrlPaid
          : l.foreignAmount * rate;
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
