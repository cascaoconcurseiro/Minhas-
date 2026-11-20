/** Cotação em tempo real: leitura do texto, plausibilidade e comparação com o VET da viagem. */
import {
  CURRENCY_CATALOG,
} from './currencyCatalog.ts';

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

/**
 * A cotação "ao vivo" vem de uma IA lendo a web: só vale se ficar numa faixa plausível em torno da cotação de referência
 * da moeda (entre metade e o dobro). Fora disso é quase certamente erro de leitura e não pode virar câmbio de ninguém.
 */
export function isPlausibleLiveRate(currency: string, rate: number): boolean {
  const meta = (CURRENCY_CATALOG as Record<string, { defaultCommercialRateBrl: number } | undefined>)[currency];
  if (!meta || !(meta.defaultCommercialRateBrl > 0)) return false;
  if (!Number.isFinite(rate) || rate <= 0) return false;
  const ratio = rate / meta.defaultCommercialRateBrl;
  return ratio >= 0.5 && ratio <= 2;
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
