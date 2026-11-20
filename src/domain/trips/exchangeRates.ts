/** Conversão para reais e taxa média ponderada (VET) dos lotes de câmbio. */
import type {
  TripExchangeLot,
} from '../../types/finance';

export interface ConvertedBrlResult {
  isValid: boolean;
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
  const invalidResult: ConvertedBrlResult = {
    isValid: false,
    foreignAmount: Number.isFinite(foreignAmount) && foreignAmount > 0 ? foreignAmount : 0,
    baseRate: Number.isFinite(baseRate) && baseRate > 0 ? baseRate : 0,
    iofPercent: Number.isFinite(iofPercent) && iofPercent >= 0 && iofPercent <= 100 ? iofPercent : 0,
    effectiveRate: 0,
    baseBrlAmount: 0,
    iofBrlAmount: 0,
    totalBrl: 0,
  };
  if (
    !Number.isFinite(foreignAmount) || foreignAmount <= 0 ||
    !Number.isFinite(baseRate) || baseRate <= 0 ||
    !Number.isFinite(iofPercent) || iofPercent < 0 || iofPercent > 100
  ) return invalidResult;

  const baseBrlCents = Math.round(foreignAmount * baseRate * 100);
  const totalBrlCents = Math.round(foreignAmount * baseRate * (1 + iofPercent / 100) * 100);
  const effectiveRate = Math.round(baseRate * (1 + iofPercent / 100) * 10000) / 10000;
  if (
    !Number.isSafeInteger(baseBrlCents) || baseBrlCents <= 0 ||
    !Number.isSafeInteger(totalBrlCents) || totalBrlCents <= 0 ||
    !Number.isSafeInteger(Math.round(effectiveRate * 10000)) || effectiveRate <= 0
  ) return invalidResult;

  const baseBrlAmount = baseBrlCents / 100;
  const totalBrl = totalBrlCents / 100;
  const iofBrlAmount = (totalBrlCents - baseBrlCents) / 100;

  return {
    isValid: true,
    foreignAmount,
    baseRate,
    iofPercent,
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
  const validLots = (exchangeLots || []).filter(isUsableExchangeLot);
  const fallbackRate = Number.isFinite(fallbackDefaultRate) && fallbackDefaultRate > 0 ? fallbackDefaultRate : 1;
  if (validLots.length === 0) {
    return {
      weightedAverageRate: fallbackRate,
      totalForeignPurchased: 0,
      totalBrlPaid: 0,
    };
  }

  let totalForeign = 0;
  let totalBrl = 0;

  for (const lot of validLots) {
    totalForeign += lot.foreignAmount;
    const rate = Number.isFinite(lot.effectiveRateBrl) && lot.effectiveRateBrl > 0
      ? lot.effectiveRateBrl
      : Number.isFinite(lot.rateBase) && lot.rateBase > 0
      ? lot.rateBase
      : lot.totalBrlPaid / lot.foreignAmount;
    totalBrl += Number.isFinite(lot.totalBrlPaid) && lot.totalBrlPaid > 0
      ? lot.totalBrlPaid
      : lot.foreignAmount * rate;
  }

  if (!Number.isFinite(totalForeign) || !Number.isFinite(totalBrl) || totalForeign <= 0 || totalBrl <= 0) {
    return {
      weightedAverageRate: fallbackRate,
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

export function isUsableExchangeLot(lot: TripExchangeLot): boolean {
  if (!lot || !Number.isFinite(lot.foreignAmount) || lot.foreignAmount <= 0 ||
      !Number.isSafeInteger(Math.round(lot.foreignAmount * 100))) return false;
  if (!Number.isFinite(lot.totalBrlPaid) ||
      (lot.totalBrlPaid > 0 && !Number.isSafeInteger(Math.round(lot.totalBrlPaid * 100)))) return false;
  if (lot.totalBrlPaid > 0) return true;
  const rate = Number.isFinite(lot.effectiveRateBrl) && lot.effectiveRateBrl > 0
    ? lot.effectiveRateBrl
    : lot.rateBase;
  const derivedCents = lot.foreignAmount * rate * 100;
  return Number.isFinite(rate) && rate > 0 && Number.isSafeInteger(Math.round(derivedCents)) && derivedCents > 0;
}
