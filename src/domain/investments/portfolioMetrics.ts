/** Posição por ativo, resumo da carteira, aporte inteligente e operação de compra/venda. */
import type {
  InvestmentAsset,
  InvestmentAssetClass,
  InvestmentTargetMap,
} from '../../types/finance';
import {
  DEFAULT_INVESTMENT_TARGETS,
  INVESTMENT_CLASS_META,
} from './investmentClasses.ts';

export function roundAssetPrice(value: number): number {
  if (!Number.isFinite(value)) return value;
  return value >= 1 ? Math.round(value * 100) / 100 : Math.round(value * 1_000_000) / 1_000_000;
}


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
  const safeUnit = Math.max(0.000001, unitPrice);

  if (operationType === 'update_quote') {
    return {
      ...asset,
      currentPrice: roundAssetPrice(safeUnit),
    };
  }

  const safeQty = Math.max(0, quantityDelta);
  if (operationType === 'buy') {
    const oldCost = asset.quantity * asset.averagePrice;
    const addedCost = safeQty * safeUnit;
    const nextQty = Math.round((asset.quantity + safeQty) * 10000) / 10000;
    const nextAvg =
      nextQty > 0
        ? roundAssetPrice((oldCost + addedCost) / nextQty)
        : safeUnit;

    return {
      ...asset,
      quantity: nextQty,
      averagePrice: nextAvg,
      currentPrice: roundAssetPrice(safeUnit),
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
    // Mesmo arredondamento da compra: ativo abaixo de R$ 1 mantém até 6 casas.
    currentPrice: roundAssetPrice(safeUnit),
  };
}
