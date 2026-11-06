import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAssetOperation,
  applyGoogleFinanceQuotesToAssets,
  calculateAssetPositionMetrics,
  calculatePortfolioSummary,
  calculateSmartContributionAllocation,
  DEFAULT_INVESTMENT_TARGETS,
  formatGoogleFinanceSymbol,
  isMarketQuotedAsset,
  parseGoogleFinanceHtmlQuote,
  parseGoogleFinanceQuotesFromText,
  syncAssetsWithGoogleFinance,
} from './investmentRules';
import { InvestmentAsset } from '../types/finance';

const SAMPLE_ASSETS: InvestmentAsset[] = [
  {
    id: 'inv-1',
    ticker: 'TESOURO SELIC 2029',
    name: 'Tesouro Selic 2029 (Reserva)',
    assetClass: 'renda_fixa_pos',
    institution: 'Tesouro Direto',
    quantity: 2,
    averagePrice: 14000,
    currentPrice: 15000,
    indexerLabel: '100% Selic (10,75% a.a.)',
    liquidity: 'D+0 (Liquidez Diária)',
    monthlyYieldPercent: 0.85,
    isTaxExempt: false,
  },
  {
    id: 'inv-2',
    ticker: 'HGLG11',
    name: 'CSHG Logística FII',
    assetClass: 'fiis',
    institution: 'NuInvest',
    quantity: 100,
    averagePrice: 155,
    currentPrice: 160,
    indexerLabel: 'Dividendos Isentos IR',
    liquidity: 'D+2 (Bolsa B3)',
    monthlyYieldPercent: 0.9,
    isTaxExempt: true,
  },
];

test('calculateAssetPositionMetrics computes cost, current value, gain, and monthly passive income', () => {
  const m = calculateAssetPositionMetrics(SAMPLE_ASSETS[1], 46000);
  assert.equal(m.investedCost, 15500);
  assert.equal(m.currentValue, 16000);
  assert.equal(m.capitalGain, 500);
  assert.equal(m.estimatedMonthlyIncome, 144);
  assert.equal(m.estimatedAnnualIncome, 1728);
});

test('calculatePortfolioSummary aggregates portfolio metrics, passive income, and living cost coverage', () => {
  const summary = calculatePortfolioSummary(
    SAMPLE_ASSETS,
    DEFAULT_INVESTMENT_TARGETS,
    4000
  );
  // Total current: 30000 + 16000 = 46000; Total cost: 28000 + 15500 = 43500
  assert.equal(summary.totalCurrentValue, 46000);
  assert.equal(summary.totalInvestedCost, 43500);
  assert.equal(summary.totalCapitalGain, 2500);
  assert.equal(summary.immediateLiquidityValue, 30000);
  assert.equal(summary.taxExemptValue, 16000);
  // Monthly passive: 30000*0.0085 (255) + 16000*0.009 (144) = 399
  assert.equal(summary.estimatedMonthlyPassiveIncome, 399);
  assert.equal(summary.cashDividendsMonthly, 144);
  assert.equal(summary.compoundYieldMonthly, 255);
  assert.equal(summary.livingCostCoveragePercent, 10);
});

test('calculateSmartContributionAllocation prioritizes classes furthest below target without selling', () => {
  const recs = calculateSmartContributionAllocation(
    SAMPLE_ASSETS,
    DEFAULT_INVESTMENT_TARGETS,
    2000
  );
  const ipcaRec = recs.find((r) => r.assetClass === 'renda_fixa_ipca');
  const rfPosRec = recs.find((r) => r.assetClass === 'renda_fixa_pos');
  assert.ok(ipcaRec && ipcaRec.recommendedAmount > 0);
  // Renda Fixa Pós is already at 65.2% vs 35% target, so it receives R$ 0 new contribution
  assert.equal(rfPosRec?.recommendedAmount, 0);
});

test('applyAssetOperation recalculates weighted average price on buy and preserves average price on sell', () => {
  const base: InvestmentAsset = {
    id: 'inv-fii',
    ticker: 'XPML11',
    name: 'XP Malls FII',
    assetClass: 'fiis',
    institution: 'XP',
    quantity: 10,
    averagePrice: 100,
    currentPrice: 105,
    indexerLabel: 'Isento IR',
    liquidity: 'D+2 (Bolsa B3)',
    monthlyYieldPercent: 0.92,
    isTaxExempt: true,
  };

  // Buy 10 more at R$ 120 -> new qty 20, new averagePrice = R$ 110
  const afterBuy = applyAssetOperation(base, 'buy', 10, 120);
  assert.equal(afterBuy.quantity, 20);
  assert.equal(afterBuy.averagePrice, 110);
  assert.equal(afterBuy.currentPrice, 120);

  // Sell 5 at R$ 130 -> qty becomes 15, averagePrice stays R$ 110
  const afterSell = applyAssetOperation(afterBuy, 'sell', 5, 130);
  assert.equal(afterSell.quantity, 15);
  assert.equal(afterSell.averagePrice, 110);
  assert.equal(afterSell.currentPrice, 130);
});

test('isMarketQuotedAsset and parseGoogleFinanceQuotesFromText parse live Google Finance tickers and prices accurately', () => {
  assert.equal(
    isMarketQuotedAsset({ ticker: 'PETR4', assetClass: 'acoes_br' }),
    true
  );
  assert.equal(
    isMarketQuotedAsset({ ticker: 'HGLG11', assetClass: 'fiis' }),
    true
  );
  assert.equal(
    isMarketQuotedAsset({
      ticker: 'TESOURO SELIC 2029',
      assetClass: 'renda_fixa_pos',
    }),
    false
  );

  const sampleOutput = [
    'QUOTE_LINE: BVMF:PETR4 | R$ 38,45 | +1,25% | Petróleo Brasileiro S.A.',
    'QUOTE_LINE: HGLG11 | 158.90 | -0.18 | CSHG Logística FII',
    'QUOTE_LINE: IVVB11 | 342.10 | +0.64 | iShares S&P 500 FII',
  ].join('\n');

  const quotes = parseGoogleFinanceQuotesFromText(sampleOutput);
  assert.equal(quotes.length, 3);
  assert.equal(quotes[0].ticker, 'PETR4');
  assert.equal(quotes[0].priceBrl, 38.45);
  assert.equal(quotes[0].changePercent, 1.25);
  assert.equal(quotes[0].assetClassHint, 'acoes_br');

  assert.equal(quotes[1].ticker, 'HGLG11');
  assert.equal(quotes[1].priceBrl, 158.9);
  assert.equal(quotes[1].changePercent, -0.18);
  assert.equal(quotes[1].assetClassHint, 'fiis');

  assert.equal(quotes[2].ticker, 'IVVB11');
  assert.equal(quotes[2].priceBrl, 342.1);
  assert.equal(quotes[2].assetClassHint, 'exterior_etf');
});

test('formatGoogleFinanceSymbol, parseGoogleFinanceHtmlQuote, applyGoogleFinanceQuotesToAssets, and syncAssetsWithGoogleFinance update currentPrice automatically', async () => {
  assert.equal(formatGoogleFinanceSymbol('PETR4'), 'PETR4:BVMF');
  assert.equal(formatGoogleFinanceSymbol('PETR4F'), 'PETR4:BVMF');
  assert.equal(formatGoogleFinanceSymbol('HGLG11'), 'HGLG11:BVMF');
  assert.equal(formatGoogleFinanceSymbol('BVMF:VALE3'), 'VALE3:BVMF');

  const sampleHtml = `
    <div data-last-price="37.82" data-currency-code="BRL" data-last-normal-market-change-percent="1.45"></div>
    <div class="zzDege">Petróleo Brasileiro S.A. - Petrobras</div>
  `;
  const parsedHtml = parseGoogleFinanceHtmlQuote(sampleHtml, 'PETR4');
  assert.ok(parsedHtml);
  assert.equal(parsedHtml.ticker, 'PETR4');
  assert.equal(parsedHtml.priceBrl, 37.82);
  assert.equal(parsedHtml.changePercent, 1.45);
  assert.equal(parsedHtml.name, 'Petróleo Brasileiro S.A. - Petrobras');
  assert.equal(parsedHtml.assetClassHint, 'acoes_br');

  const portfolio: InvestmentAsset[] = [
    ...SAMPLE_ASSETS,
    {
      id: 'inv-3',
      ticker: 'PETR4',
      name: 'Petrobras PN',
      assetClass: 'acoes_br',
      institution: 'XP',
      quantity: 200,
      averagePrice: 32,
      currentPrice: 35,
      indexerLabel: 'Ações B3',
      liquidity: 'D+2 (Bolsa B3)',
      monthlyYieldPercent: 1.1,
      isTaxExempt: false,
    },
  ];

  let capturedAuthHeader = '';
  const mockFetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedAuthHeader = new Headers(init?.headers).get('Authorization') || '';
    return {
      ok: true,
      json: async () => ({
        quotes: [
          { ticker: 'HGLG11', priceBrl: 164.25, changePercent: 0.42 },
          { ticker: 'PETR4', priceBrl: 39.1, changePercent: 1.85 },
        ],
        fetchedAt: '2026-10-30T12:00:00.000Z',
        sources: [
          {
            uri: 'https://www.google.com/finance/quote/PETR4:BVMF',
            title: 'Google Finance — PETR4',
          },
        ],
      }),
    };
  }) as typeof fetch;

  const syncResult = await syncAssetsWithGoogleFinance(
    portfolio,
    undefined,
    mockFetcher,
    'test-neon-auth-token'
  );

  assert.equal(capturedAuthHeader, 'Bearer test-neon-auth-token');
  assert.equal(syncResult.updatedCount, 2);
  // Fixed income asset currentPrice remains unchanged (15000)
  assert.equal(syncResult.updatedAssets[0].currentPrice, 15000);
  // FII HGLG11 currentPrice updated to 164.25
  assert.equal(syncResult.updatedAssets[1].currentPrice, 164.25);
  assert.equal(syncResult.updatedAssets[1].dailyChangePercent, 0.42);
  // Stock PETR4 currentPrice updated to 39.10
  assert.equal(syncResult.updatedAssets[2].currentPrice, 39.1);
  assert.equal(syncResult.updatedAssets[2].dailyChangePercent, 1.85);

  // Verify direct applyGoogleFinanceQuotesToAssets also matches fractional B3 tickers (e.g. PETR4F)
  const fracResult = applyGoogleFinanceQuotesToAssets(
    [{ ...portfolio[2], ticker: 'PETR4F' }],
    [{ ticker: 'PETR4', priceBrl: 40.5 }]
  );
  assert.equal(fracResult.updatedCount, 1);
  assert.equal(fracResult.updatedAssets[0].currentPrice, 40.5);
});

