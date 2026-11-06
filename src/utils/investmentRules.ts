import {
  InvestmentAsset,
  InvestmentAssetClass,
  InvestmentTargetMap,
} from '../types/finance';

export const DEFAULT_INVESTMENT_TARGETS: InvestmentTargetMap = {
  renda_fixa_pos: 35,
  renda_fixa_ipca: 20,
  fiis: 20,
  acoes_br: 15,
  exterior_etf: 10,
};

export interface AssetClassMetadata {
  id: InvestmentAssetClass;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  paysCashDividends: boolean;
}

export const INVESTMENT_CLASS_META: Record<InvestmentAssetClass, AssetClassMetadata> = {
  renda_fixa_pos: {
    id: 'renda_fixa_pos',
    label: 'Renda Fixa Pós-Fixada (Selic / CDI)',
    shortLabel: 'RF Pós (Selic/CDI)',
    description: 'Tesouro Selic, CDBs Liquidez Diária, LCI e LCA atrelados ao CDI',
    color: '#059669',
    paysCashDividends: false,
  },
  renda_fixa_ipca: {
    id: 'renda_fixa_ipca',
    label: 'Renda Fixa Inflação (IPCA+ / Pré)',
    shortLabel: 'RF Inflação (IPCA+)',
    description: 'Tesouro IPCA+, Debêntures Incentivadas e proteção do poder de compra',
    color: '#0284c7',
    paysCashDividends: false,
  },
  fiis: {
    id: 'fiis',
    label: 'Fundos Imobiliários (FIIs — Isentos IR)',
    shortLabel: 'FIIs (Dividendos)',
    description: 'Aluguéis mensais isentos de IR na pessoa física (Tijolo e Papel)',
    color: '#7c3aed',
    paysCashDividends: true,
  },
  acoes_br: {
    id: 'acoes_br',
    label: 'Ações Brasil (B3 — Valor & Dividendos)',
    shortLabel: 'Ações B3',
    description: 'Participação em empresas listadas na B3, Dividendos e JCP',
    color: '#d97706',
    paysCashDividends: true,
  },
  exterior_etf: {
    id: 'exterior_etf',
    label: 'Exterior & ETFs Globais (Dólar / S&P 500)',
    shortLabel: 'Exterior & ETFs',
    description: 'Diversificação cambial e exposição global (IVVB11, WRLD11, Stocks)',
    color: '#2563eb',
    paysCashDividends: false,
  },
};

export interface AssetPositionMetrics {
  asset: InvestmentAsset;
  investedCost: number;
  currentValue: number;
  capitalGain: number;
  profitabilityPercent: number;
  portfolioSharePercent: number;
  estimatedMonthlyIncome: number;
  estimatedAnnualIncome: number;
}

export interface ClassAllocationItem {
  assetClass: InvestmentAssetClass;
  label: string;
  shortLabel: string;
  color: string;
  investedCost: number;
  currentValue: number;
  capitalGain: number;
  profitabilityPercent: number;
  currentPercent: number;
  targetPercent: number;
  deviationPercent: number; // currentPercent - targetPercent
  idealValue: number;
  missingAmountToTarget: number; // max(0, idealValue - currentValue)
  estimatedMonthlyIncome: number;
  assetsCount: number;
}

export interface PortfolioSummary {
  totalInvestedCost: number;
  totalCurrentValue: number;
  totalCapitalGain: number;
  totalProfitabilityPercent: number;
  estimatedMonthlyPassiveIncome: number;
  estimatedAnnualPassiveIncome: number;
  cashDividendsMonthly: number; // FIIs + Ações
  compoundYieldMonthly: number; // Renda Fixa + ETFs
  immediateLiquidityValue: number;
  immediateLiquidityPercent: number;
  taxExemptValue: number;
  taxExemptPercent: number;
  livingCostCoveragePercent: number;
  positions: AssetPositionMetrics[];
  classAllocations: ClassAllocationItem[];
}

export interface SmartContributionRecommendation {
  assetClass: InvestmentAssetClass;
  label: string;
  shortLabel: string;
  color: string;
  currentPercent: number;
  targetPercent: number;
  recommendedAmount: number;
  recommendedShareOfContribution: number;
  projectedPercentAfter: number;
}

export function calculateAssetPositionMetrics(
  asset: InvestmentAsset,
  totalPortfolioValue = 0
): AssetPositionMetrics {
  const investedCost = Math.round(asset.quantity * asset.averagePrice * 100) / 100;
  const currentValue = Math.round(asset.quantity * asset.currentPrice * 100) / 100;
  const capitalGain = Math.round((currentValue - investedCost) * 100) / 100;
  const profitabilityPercent =
    investedCost > 0
      ? Math.round((capitalGain / investedCost) * 10000) / 100
      : 0;
  const portfolioSharePercent =
    totalPortfolioValue > 0
      ? Math.round((currentValue / totalPortfolioValue) * 1000) / 10
      : 0;
  const estimatedMonthlyIncome =
    Math.round(currentValue * (asset.monthlyYieldPercent / 100) * 100) / 100;
  const estimatedAnnualIncome = Math.round(estimatedMonthlyIncome * 12 * 100) / 100;

  return {
    asset,
    investedCost,
    currentValue,
    capitalGain,
    profitabilityPercent,
    portfolioSharePercent,
    estimatedMonthlyIncome,
    estimatedAnnualIncome,
  };
}

export function calculatePortfolioSummary(
  assets: InvestmentAsset[],
  targetMap: InvestmentTargetMap = DEFAULT_INVESTMENT_TARGETS,
  monthlyLivingExpense = 0
): PortfolioSummary {
  const rawTotalCurrent = assets.reduce(
    (sum, a) => sum + a.quantity * a.currentPrice,
    0
  );
  const totalCurrentValue = Math.round(rawTotalCurrent * 100) / 100;

  const positions = assets
    .map((asset) => calculateAssetPositionMetrics(asset, totalCurrentValue))
    .sort((a, b) => b.currentValue - a.currentValue);

  let totalInvestedCost = 0;
  let estimatedMonthlyPassiveIncome = 0;
  let cashDividendsMonthly = 0;
  let compoundYieldMonthly = 0;
  let immediateLiquidityValue = 0;
  let taxExemptValue = 0;

  for (const pos of positions) {
    totalInvestedCost = Math.round((totalInvestedCost + pos.investedCost) * 100) / 100;
    estimatedMonthlyPassiveIncome =
      Math.round((estimatedMonthlyPassiveIncome + pos.estimatedMonthlyIncome) * 100) / 100;

    const meta = INVESTMENT_CLASS_META[pos.asset.assetClass];
    if (meta?.paysCashDividends) {
      cashDividendsMonthly =
        Math.round((cashDividendsMonthly + pos.estimatedMonthlyIncome) * 100) / 100;
    } else {
      compoundYieldMonthly =
        Math.round((compoundYieldMonthly + pos.estimatedMonthlyIncome) * 100) / 100;
    }

    if (
      pos.asset.liquidity === 'D+0 (Liquidez Diária)' ||
      pos.asset.liquidity === 'D+1'
    ) {
      immediateLiquidityValue =
        Math.round((immediateLiquidityValue + pos.currentValue) * 100) / 100;
    }

    if (pos.asset.isTaxExempt) {
      taxExemptValue = Math.round((taxExemptValue + pos.currentValue) * 100) / 100;
    }
  }

  const totalCapitalGain = Math.round((totalCurrentValue - totalInvestedCost) * 100) / 100;
  const totalProfitabilityPercent =
    totalInvestedCost > 0
      ? Math.round((totalCapitalGain / totalInvestedCost) * 10000) / 100
      : 0;

  const estimatedAnnualPassiveIncome =
    Math.round(estimatedMonthlyPassiveIncome * 12 * 100) / 100;

  const immediateLiquidityPercent =
    totalCurrentValue > 0
      ? Math.round((immediateLiquidityValue / totalCurrentValue) * 1000) / 10
      : 0;

  const taxExemptPercent =
    totalCurrentValue > 0
      ? Math.round((taxExemptValue / totalCurrentValue) * 1000) / 10
      : 0;

  const livingCostCoveragePercent =
    monthlyLivingExpense > 0
      ? Math.round((estimatedMonthlyPassiveIncome / monthlyLivingExpense) * 1000) / 10
      : 0;

  const classes: InvestmentAssetClass[] = [
    'renda_fixa_pos',
    'renda_fixa_ipca',
    'fiis',
    'acoes_br',
    'exterior_etf',
  ];

  const classAllocations: ClassAllocationItem[] = classes.map((cls) => {
    const meta = INVESTMENT_CLASS_META[cls];
    const classPositions = positions.filter((p) => p.asset.assetClass === cls);
    const investedCost =
      Math.round(classPositions.reduce((s, p) => s + p.investedCost, 0) * 100) / 100;
    const currentValue =
      Math.round(classPositions.reduce((s, p) => s + p.currentValue, 0) * 100) / 100;
    const capitalGain = Math.round((currentValue - investedCost) * 100) / 100;
    const profitabilityPercent =
      investedCost > 0 ? Math.round((capitalGain / investedCost) * 10000) / 100 : 0;

    const currentPercent =
      totalCurrentValue > 0
        ? Math.round((currentValue / totalCurrentValue) * 1000) / 10
        : 0;
    const targetPercent = targetMap[cls] ?? 0;
    const deviationPercent = Math.round((currentPercent - targetPercent) * 10) / 10;
    const idealValue =
      Math.round(totalCurrentValue * (targetPercent / 100) * 100) / 100;
    const missingAmountToTarget = Math.max(
      0,
      Math.round((idealValue - currentValue) * 100) / 100
    );
    const estimatedMonthlyIncome =
      Math.round(
        classPositions.reduce((s, p) => s + p.estimatedMonthlyIncome, 0) * 100
      ) / 100;

    return {
      assetClass: cls,
      label: meta.label,
      shortLabel: meta.shortLabel,
      color: meta.color,
      investedCost,
      currentValue,
      capitalGain,
      profitabilityPercent,
      currentPercent,
      targetPercent,
      deviationPercent,
      idealValue,
      missingAmountToTarget,
      estimatedMonthlyIncome,
      assetsCount: classPositions.length,
    };
  });

  return {
    totalInvestedCost,
    totalCurrentValue,
    totalCapitalGain,
    totalProfitabilityPercent,
    estimatedMonthlyPassiveIncome,
    estimatedAnnualPassiveIncome,
    cashDividendsMonthly,
    compoundYieldMonthly,
    immediateLiquidityValue,
    immediateLiquidityPercent,
    taxExemptValue,
    taxExemptPercent,
    livingCostCoveragePercent,
    positions,
    classAllocations,
  };
}

/**
 * Computes how to allocate a new cash contribution (R$) across asset classes
 * so the portfolio moves closer to target percentages WITHOUT selling existing assets.
 */
export function calculateSmartContributionAllocation(
  assets: InvestmentAsset[],
  targetMap: InvestmentTargetMap,
  contributionAmount: number
): SmartContributionRecommendation[] {
  const safeContribution = Math.max(0, contributionAmount);
  const summary = calculatePortfolioSummary(assets, targetMap);
  const newTotalPortfolio = summary.totalCurrentValue + safeContribution;

  // Calculate how much each class needs to reach its target in the new total portfolio
  const deficits = summary.classAllocations.map((cls) => {
    const targetValueAfter = newTotalPortfolio * (cls.targetPercent / 100);
    const needed = Math.max(0, targetValueAfter - cls.currentValue);
    return {
      ...cls,
      needed,
    };
  });

  const totalDeficit = deficits.reduce((s, d) => s + d.needed, 0);

  return deficits.map((item) => {
    let recommendedAmount = 0;
    if (safeContribution > 0) {
      if (totalDeficit > 0) {
        recommendedAmount =
          Math.round(((item.needed / totalDeficit) * safeContribution) * 100) / 100;
      } else {
        recommendedAmount =
          Math.round(((item.targetPercent / 100) * safeContribution) * 100) / 100;
      }
    }

    const recommendedShareOfContribution =
      safeContribution > 0
        ? Math.round((recommendedAmount / safeContribution) * 1000) / 10
        : 0;

    const projectedValueAfter = item.currentValue + recommendedAmount;
    const projectedPercentAfter =
      newTotalPortfolio > 0
        ? Math.round((projectedValueAfter / newTotalPortfolio) * 1000) / 10
        : item.targetPercent;

    return {
      assetClass: item.assetClass,
      label: item.label,
      shortLabel: item.shortLabel,
      color: item.color,
      currentPercent: item.currentPercent,
      targetPercent: item.targetPercent,
      recommendedAmount,
      recommendedShareOfContribution,
      projectedPercentAfter,
    };
  });
}

/**
 * Applies a Buy (Aporte), Sell (Resgate), or Quote Update to an InvestmentAsset,
 * computing Weighted Average Price (Preço Médio Ponderado) according to Brazilian tax rules.
 */
export function applyAssetOperation(
  asset: InvestmentAsset,
  operationType: 'buy' | 'sell' | 'update_quote',
  quantityDelta: number,
  unitPrice: number
): InvestmentAsset {
  const safeUnit = Math.max(0.01, unitPrice);

  if (operationType === 'update_quote') {
    return {
      ...asset,
      currentPrice: Math.round(safeUnit * 100) / 100,
    };
  }

  const safeQty = Math.max(0, quantityDelta);
  if (operationType === 'buy') {
    const oldCost = asset.quantity * asset.averagePrice;
    const addedCost = safeQty * safeUnit;
    const nextQty = Math.round((asset.quantity + safeQty) * 10000) / 10000;
    const nextAvg =
      nextQty > 0
        ? Math.round(((oldCost + addedCost) / nextQty) * 100) / 100
        : safeUnit;

    return {
      ...asset,
      quantity: nextQty,
      averagePrice: nextAvg,
      currentPrice: Math.round(safeUnit * 100) / 100,
    };
  }

  // Sell (Resgate): reduces quantity, preserves averagePrice per Receita Federal rule
  const remainingQty = Math.max(
    0,
    Math.round((asset.quantity - safeQty) * 10000) / 10000
  );
  return {
    ...asset,
    quantity: remainingQty,
    currentPrice: Math.round(safeUnit * 100) / 100,
  };
}

export interface ParsedGoogleFinanceQuote {
  ticker: string;
  priceBrl: number;
  changePercent?: number;
  name?: string;
  assetClassHint?: InvestmentAssetClass;
  sourceUri?: string;
}

export interface GoogleFinanceSyncSource {
  uri: string;
  title: string;
}

export interface GoogleFinanceSyncResponse {
  quotes: ParsedGoogleFinanceQuote[];
  fetchedAt: string;
  sources: GoogleFinanceSyncSource[];
}

export interface GoogleFinancePortfolioSyncResult {
  updatedAssets: InvestmentAsset[];
  updatedCount: number;
  quotes: ParsedGoogleFinanceQuote[];
  fetchedAt: string;
  sources: GoogleFinanceSyncSource[];
}

/**
 * Normaliza o código do ticker removendo prefixos de bolsa (ex: BVMF:, B3:, NASDAQ:)
 * e sufixos de mercado fracionário (ex: PETR4F -> PETR4 para consulta no Google Finance).
 */
export function normalizeTickerSymbol(rawTicker: string): string {
  return String(rawTicker || '')
    .replace(/^(BVMF|B3|NASDAQ|NYSE|NYSEARCA)\s*:\s*/i, '')
    .replace(/:(BVMF|B3|NASDAQ|NYSE|NYSEARCA)$/i, '')
    .trim()
    .toUpperCase();
}

/**
 * Infere a classe do ativo a partir do padrão do ticker (Ações B3, FIIs ou ETFs/Exterior).
 */
export function inferAssetClassFromTicker(
  ticker: string
): InvestmentAssetClass | undefined {
  const clean = normalizeTickerSymbol(ticker);
  if (!clean) return undefined;

  const baseTicker = /^[A-Z]{4}\d{1,2}F$/.test(clean)
    ? clean.slice(0, -1)
    : clean;

  const knownEtfs = new Set([
    'IVVB11',
    'WRLD11',
    'NASD11',
    'BOVA11',
    'SMAL11',
    'HASH11',
    'DIVO11',
    'GOLD11',
    'SPXI11',
    'ACWI11',
  ]);

  if (knownEtfs.has(baseTicker)) {
    return 'exterior_etf';
  }
  if (/^[A-Z]{4}11$/.test(baseTicker)) {
    return 'fiis';
  }
  if (/^[A-Z]{4}[3456]$/.test(baseTicker)) {
    return 'acoes_br';
  }
  if (/^[A-Z]{1,5}$/.test(baseTicker)) {
    return 'exterior_etf';
  }
  return undefined;
}

/**
 * Formata um ticker para o padrão de URL do Google Finance (ex: PETR4 -> PETR4:BVMF, HGLG11 -> HGLG11:BVMF).
 */
export function formatGoogleFinanceSymbol(
  ticker: string,
  assetClass?: InvestmentAssetClass
): string {
  const raw = String(ticker || '').trim().toUpperCase();
  if (!raw) return '';

  // Se estiver no formato EXCHANGE:TICKER (ex: BVMF:VALE3), inverte para TICKER:EXCHANGE
  if (/^(BVMF|B3|NASDAQ|NYSE|NYSEARCA)\s*:\s*[A-Z0-9.]+$/.test(raw)) {
    const [exch, sym] = raw.split(':').map((s) => s.trim());
    return `${sym}:${exch === 'B3' ? 'BVMF' : exch}`;
  }
  // Se já estiver no formato TICKER:EXCHANGE, preserva
  if (/^[A-Z0-9.]+\s*:\s*[A-Z0-9]+$/.test(raw)) {
    const [sym, exch] = raw.split(':').map((s) => s.trim());
    return `${sym}:${exch === 'B3' ? 'BVMF' : exch}`;
  }

  const clean = normalizeTickerSymbol(raw);
  // Remove o 'F' de lote fracionário B3 (ex: PETR4F -> PETR4) para consulta de preço unitário no Google Finance
  const b3Base = /^[A-Z]{4}\d{1,2}F$/.test(clean) ? clean.slice(0, -1) : clean;

  if (
    /^[A-Z]{4}\d{1,2}$/.test(b3Base) ||
    assetClass === 'acoes_br' ||
    assetClass === 'fiis'
  ) {
    return `${b3Base}:BVMF`;
  }

  return clean;
}

/**
 * Identifica se o ativo possui ticker listado em bolsa/mercado (B3, FIIs, ETFs, BDRs, Stocks)
 * elegível para sincronização automática no Google Finance.
 */
export function isMarketQuotedAsset(
  asset: Pick<InvestmentAsset, 'ticker' | 'assetClass'>
): boolean {
  const cleanTicker = normalizeTickerSymbol(asset.ticker);
  if (!cleanTicker) return false;
  if (
    asset.assetClass === 'acoes_br' ||
    asset.assetClass === 'fiis' ||
    asset.assetClass === 'exterior_etf'
  ) {
    return true;
  }
  // Tickers B3 padrão (ex: PETR4, VALE3, HGLG11, IVVB11, BOVA11, KLBN11) ou globais curtos sem espaço
  return (
    /^[A-Z]{4}\d{1,2}[FB]?$/.test(cleanTicker) || /^[A-Z]{2,5}$/.test(cleanTicker)
  );
}

/**
 * Extrai a cotação atual diretamente do HTML de uma página do Google Finance
 * (ex: https://www.google.com/finance/quote/PETR4:BVMF).
 */
export function parseGoogleFinanceHtmlQuote(
  html: string,
  requestedTicker: string
): ParsedGoogleFinanceQuote | null {
  if (!html || typeof html !== 'string') return null;
  const cleanTicker = normalizeTickerSymbol(requestedTicker);
  if (!cleanTicker) return null;

  const baseTicker = /^[A-Z]{4}\d{1,2}F$/.test(cleanTicker)
    ? cleanTicker.slice(0, -1)
    : cleanTicker;
  const escapedTicker = baseTicker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const symbol = formatGoogleFinanceSymbol(cleanTicker);

  // 1) Formato moderno AF_initDataCallback do Google Finance:
  // ["PETR4","BVMF"],"Petrobras",0,"BRL",[52.76,0.56,1.0727,2,2,2]
  const afPattern = new RegExp(
    `\\["${escapedTicker}","([A-Z0-9]+)"\\],"([^"]+)",\\d+,"BRL",\\[([0-9]+(?:\\.[0-9]+)?),([+-]?[0-9]+(?:\\.[0-9]+)?|null),([+-]?[0-9]+(?:\\.[0-9]+)?|null)`,
    'i'
  );
  const afMatch = html.match(afPattern);
  if (afMatch) {
    const priceBrl = Math.round(Number(afMatch[3]) * 100) / 100;
    if (Number.isFinite(priceBrl) && priceBrl > 0) {
      const rawChangePct =
        afMatch[5] && afMatch[5] !== 'null' ? Number(afMatch[5]) : undefined;
      const changePercent =
        typeof rawChangePct === 'number' && Number.isFinite(rawChangePct)
          ? Math.round(rawChangePct * 100) / 100
          : undefined;
      const name = afMatch[2]
        ? afMatch[2]
            .replace(/\\u0026/g, '&')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .trim()
        : undefined;

      return {
        ticker: cleanTicker,
        priceBrl,
        changePercent,
        name,
        assetClassHint: inferAssetClassFromTicker(cleanTicker),
        sourceUri: `https://www.google.com/finance/quote/${encodeURIComponent(symbol)}`,
      };
    }
  }

  // 2) Fallback para atributos estruturados DOM: data-last-price="38.45" data-currency-code="BRL"
  const priceAttrMatch = html.match(/data-last-price="([0-9]+(?:\.[0-9]+)?)"/i);
  const currencyMatch = html.match(/data-currency-code="([A-Z]{3})"/i);
  const currencyCode = currencyMatch ? currencyMatch[1].toUpperCase() : 'BRL';

  if (currencyCode && currencyCode !== 'BRL') {
    return null;
  }

  let priceBrl = 0;
  if (priceAttrMatch) {
    priceBrl = Math.round(Number(priceAttrMatch[1]) * 100) / 100;
  } else {
    const visualPriceMatch = html.match(
      /class="YMlKec fxKbKc"[^>]*>\s*(?:R\$\s*)?([0-9.]+,[0-9]{2}|[0-9]+\.[0-9]{2})\s*</i
    );
    if (visualPriceMatch) {
      const raw = visualPriceMatch[1];
      const normalized = raw.includes(',')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw;
      priceBrl = Math.round(Number(normalized) * 100) / 100;
    }
  }

  if (!Number.isFinite(priceBrl) || priceBrl <= 0) {
    return null;
  }

  let changePercent: number | undefined;
  const changeAttrMatch = html.match(
    /data-last-normal-market-change-percent="([+-]?[0-9]+(?:\.[0-9]+)?)"/i
  );
  if (changeAttrMatch) {
    const parsedChange = Number(changeAttrMatch[1]);
    if (Number.isFinite(parsedChange)) {
      changePercent = Math.round(parsedChange * 100) / 100;
    }
  }

  let name: string | undefined;
  const titleMatch = html.match(/<div class="zzDege"[^>]*>([^<]+)<\/div>/i);
  if (titleMatch && titleMatch[1]) {
    name = titleMatch[1]
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();
  }

  return {
    ticker: cleanTicker,
    priceBrl,
    changePercent,
    name,
    assetClassHint: inferAssetClassFromTicker(cleanTicker),
    sourceUri: `https://www.google.com/finance/quote/${encodeURIComponent(symbol)}`,
  };
}

/**
 * Extrai cotações estruturadas retornadas pela busca do Google Finance via Gemini Grounding.
 * Formato esperado por linha:
 * QUOTE_LINE: TICKER | PRECO_BRL | VARIACAO_PCT | NOME_ATIVO
 */
export function parseGoogleFinanceQuotesFromText(
  text: string
): ParsedGoogleFinanceQuote[] {
  if (!text || typeof text !== 'string') return [];

  const results: ParsedGoogleFinanceQuote[] = [];
  const seen = new Set<string>();
  const lines = text.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(/QUOTE_LINE\s*:\s*(.+)$/i);
    if (!match) continue;

    const parts = match[1].split('|').map((p) => p.trim());
    if (parts.length < 2) continue;

    const rawTicker = normalizeTickerSymbol(parts[0]);
    if (!rawTicker || seen.has(rawTicker)) continue;

    const rawPriceStr = parts[1].replace(/R\$\s*/gi, '').trim();
    const normalizedPriceStr =
      rawPriceStr.includes(',') && rawPriceStr.includes('.')
        ? rawPriceStr.replace(/\./g, '').replace(',', '.')
        : rawPriceStr.replace(',', '.');
    const priceMatch = normalizedPriceStr.match(/(\d+(?:\.\d+)?)/);
    if (!priceMatch) continue;

    const priceBrl = Math.round(Number(priceMatch[1]) * 100) / 100;
    if (!Number.isFinite(priceBrl) || priceBrl <= 0) continue;

    let changePercent: number | undefined;
    if (parts[2]) {
      const cleanChange = parts[2].replace('%', '').replace(',', '.').trim();
      const parsedChange = Number(cleanChange);
      if (Number.isFinite(parsedChange)) {
        changePercent = Math.round(parsedChange * 100) / 100;
      }
    }

    const name = parts[3] ? parts[3].trim() : undefined;
    const assetClassHint = inferAssetClassFromTicker(rawTicker);

    seen.add(rawTicker);
    results.push({
      ticker: rawTicker,
      priceBrl,
      changePercent,
      name,
      assetClassHint,
    });
  }

  return results;
}

/**
 * Aplica as cotações obtidas do Google Finance sobre a lista de ativos da carteira,
 * preenchendo automaticamente o campo `currentPrice` (além de `dailyChangePercent`, `lastQuoteSyncAt` e `quoteSourceUri`).
 */
export function applyGoogleFinanceQuotesToAssets(
  assets: InvestmentAsset[],
  quotes: ParsedGoogleFinanceQuote[],
  options?: { fetchedAt?: string; defaultSourceUri?: string }
): {
  updatedAssets: InvestmentAsset[];
  updatedCount: number;
  matchedTickers: string[];
} {
  const fetchedAt = options?.fetchedAt || new Date().toISOString();
  const quoteMap = new Map<string, ParsedGoogleFinanceQuote>();

  for (const quote of quotes) {
    const clean = normalizeTickerSymbol(quote.ticker);
    if (clean && quote.priceBrl > 0) {
      quoteMap.set(clean, quote);
      // Também indexa sem o 'F' caso o usuário tenha cadastrado lote fracionário (ex: PETR4F)
      if (/^[A-Z]{4}\d{1,2}F$/.test(clean)) {
        quoteMap.set(clean.slice(0, -1), quote);
      }
    }
  }

  let updatedCount = 0;
  const matchedTickers: string[] = [];

  const updatedAssets = assets.map((asset) => {
    const cleanAssetTicker = normalizeTickerSymbol(asset.ticker);
    const baseAssetTicker = /^[A-Z]{4}\d{1,2}F$/.test(cleanAssetTicker)
      ? cleanAssetTicker.slice(0, -1)
      : cleanAssetTicker;

    const matched =
      quoteMap.get(cleanAssetTicker) || quoteMap.get(baseAssetTicker);

    if (matched && Number.isFinite(matched.priceBrl) && matched.priceBrl > 0) {
      updatedCount++;
      matchedTickers.push(asset.ticker.trim().toUpperCase());
      return {
        ...asset,
        currentPrice: Math.round(matched.priceBrl * 100) / 100,
        dailyChangePercent:
          typeof matched.changePercent === 'number'
            ? matched.changePercent
            : asset.dailyChangePercent,
        lastQuoteSyncAt: fetchedAt,
        quoteSourceUri:
          matched.sourceUri || options?.defaultSourceUri || asset.quoteSourceUri,
      };
    }

    return asset;
  });

  return {
    updatedAssets,
    updatedCount,
    matchedTickers,
  };
}

/**
 * Consulta a API de integração com o Google Finance (`/api/investments/sync-quotes`)
 * para buscar as cotações atuais (em R$) de ações, FIIs e ETFs.
 */
export async function fetchGoogleFinanceQuotes(
  tickers: string[],
  fetcher: typeof fetch = fetch,
  authToken = ''
): Promise<GoogleFinanceSyncResponse> {
  const uniqueTickers = Array.from(
    new Set(tickers.map((t) => normalizeTickerSymbol(t)).filter(Boolean))
  );

  if (uniqueTickers.length === 0) {
    throw new Error(
      'Informe ao menos um código de ação, FII ou ETF (ex: PETR4, VALE3, HGLG11, IVVB11) para atualizar as cotações.'
    );
  }

  const response = await fetcher('/api/investments/sync-quotes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ tickers: uniqueTickers }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data?.error ||
        'Não foi possível buscar as cotações atuais no Google Finance.'
    );
  }

  const quotes: ParsedGoogleFinanceQuote[] = Array.isArray(data.quotes)
    ? data.quotes
    : [];
  const fetchedAt: string = data.fetchedAt || new Date().toISOString();
  const sources: GoogleFinanceSyncSource[] = Array.isArray(data.sources)
    ? data.sources
    : [];

  return {
    quotes,
    fetchedAt,
    sources,
  };
}

/**
 * Integração completa com o Google Finance: filtra automaticamente os ativos de renda variável
 * (ações B3, FIIs e ETFs/Exterior), busca suas cotações em tempo real e preenche o campo `currentPrice`.
 */
export async function syncAssetsWithGoogleFinance(
  allAssets: InvestmentAsset[],
  targetSubset?: InvestmentAsset[],
  fetcher: typeof fetch = fetch,
  authToken = ''
): Promise<GoogleFinancePortfolioSyncResult> {
  const candidates = (targetSubset ?? allAssets).filter((a) =>
    isMarketQuotedAsset(a)
  );
  const tickers = Array.from(
    new Set(candidates.map((a) => normalizeTickerSymbol(a.ticker)).filter(Boolean))
  );

  if (tickers.length === 0) {
    throw new Error(
      'Cadastre ao menos uma Ação, FII ou ETF (ex: PETR4, VALE3, HGLG11, IVVB11) para atualizar as cotações com o Google Finance.'
    );
  }

  const { quotes, fetchedAt, sources } = await fetchGoogleFinanceQuotes(
    tickers,
    fetcher,
    authToken
  );

  const { updatedAssets, updatedCount } = applyGoogleFinanceQuotesToAssets(
    allAssets,
    quotes,
    {
      fetchedAt,
      defaultSourceUri: sources[0]?.uri,
    }
  );

  return {
    updatedAssets,
    updatedCount,
    quotes,
    fetchedAt,
    sources,
  };
}
