/** Cotações: leitura do Google Finance e do texto da IA, tickers e atualização da carteira. */
import type {
  InvestmentAsset,
  InvestmentAssetClass,
} from '../../types/finance';
import {
  roundAssetPrice,
} from './portfolioMetrics.ts';

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
  rejectedQuotes: Array<{ ticker: string; previousPrice: number; quotedPrice: number }>;
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
  /** Cotações ignoradas por variação absurda (mais que o dobro ou menos que a metade do preço anterior). */
  rejectedQuotes: Array<{ ticker: string; previousPrice: number; quotedPrice: number }>;
} {
  const fetchedAt = options?.fetchedAt || new Date().toISOString();
  const rejectedQuotes: Array<{ ticker: string; previousPrice: number; quotedPrice: number }> = [];
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
      // A cotação vem de leitura de página e, às vezes, de IA: um preço fora da faixa provavelmente é erro e não pode
      // inflar ou derrubar o patrimônio em silêncio.
      if (asset.currentPrice > 0) {
        const ratio = matched.priceBrl / asset.currentPrice;
        if (ratio > 2 || ratio < 0.5) {
          rejectedQuotes.push({
            ticker: asset.ticker.trim().toUpperCase(),
            previousPrice: asset.currentPrice,
            quotedPrice: matched.priceBrl,
          });
          return asset;
        }
      }
      updatedCount++;
      matchedTickers.push(asset.ticker.trim().toUpperCase());
      return {
        ...asset,
        currentPrice: roundAssetPrice(matched.priceBrl),
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
    rejectedQuotes,
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

  const { updatedAssets, updatedCount, rejectedQuotes } = applyGoogleFinanceQuotesToAssets(
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
    rejectedQuotes,
    quotes,
    fetchedAt,
    sources,
  };
}
