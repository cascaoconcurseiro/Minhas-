/** Cotação de câmbio e de ativos (Google Finance e Gemini). Parte do servidor (ver backend/app.ts). */
import type { Express } from 'express';
import { isPlausibleLiveRate, parseLiveExchangeRateFromText } from '../../src/domain/trips/travelRules.ts';
import { ParsedGoogleFinanceQuote, normalizeTickerSymbol, parseGoogleFinanceQuotesFromText } from '../../src/domain/investments/investmentRules.ts';
import { CURRENCY_NAMES_PT, GeminiNotConfiguredError, createGeminiClient, fetchDirectGoogleFinanceQuote } from '../marketData.ts';

export function registerMarketDataRoutes(app: Express) {
  app.post('/api/fx/live-rate', async (req, res) => {
    try {
      const requestedCurrency = req.body?.currency ?? 'EUR';
      if (typeof requestedCurrency !== 'string') {
        res.status(400).json({ error: 'Informe um código de moeda válido.' });
        return;
      }
      const rawCurrency = requestedCurrency.trim().toUpperCase();
      if (!Object.hasOwn(CURRENCY_NAMES_PT, rawCurrency)) {
        res.status(400).json({ error: 'Moeda não suportada para cotação em tempo real.' });
        return;
      }

      if (rawCurrency === 'BRL') {
        res.json({
          currency: 'BRL',
          targetCurrency: 'BRL',
          commercialRateBrl: 1,
          summaryText: 'Moeda local já é o Real Brasileiro (1 BRL = R$ 1,00).',
          fetchedAt: new Date().toISOString(),
          sources: [],
        });
        return;
      }

      const currencyLabel = CURRENCY_NAMES_PT[rawCurrency] || rawCurrency;
      const ai = createGeminiClient();

      const prompt = [
        `Consulte no Google Search a cotação comercial atual em tempo real de 1 ${currencyLabel} para Real Brasileiro (BRL) hoje.`,
        `Responda OBRIGATORIAMENTE começando a primeira linha exatamente no formato:`,
        `TAXA_COMERCIAL_BRL: <valor numérico decimal usando ponto, exemplo: 6.1845>`,
        `Na segunda linha, escreva um resumo curto e direto (1 a 2 frases em português) informando a cotação comercial atual de 1 ${rawCurrency} em R$ (BRL) encontrada agora.`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const responseText = (response.text ?? '').trim();
      const parsedRate = parseLiveExchangeRateFromText(responseText);

      if (!parsedRate || parsedRate <= 0) {
        res.status(502).json({
          error:
            'Não foi possível extrair um valor numérico de cotação da busca em tempo real. Tente consultar novamente em instantes.',
        });
        return;
      }

      if (!isPlausibleLiveRate(rawCurrency, parsedRate)) {
        res.status(502).json({
          error:
            'A cotação encontrada ficou fora da faixa esperada para essa moeda e foi descartada por segurança. Informe a cotação manualmente ou tente novamente.',
        });
        return;
      }

      const rawChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const seenUris = new Set<string>();
      const sources: { uri: string; title: string }[] = [];

      for (const chunk of rawChunks) {
        const uri = chunk?.web?.uri;
        if (uri && !seenUris.has(uri)) {
          seenUris.add(uri);
          sources.push({
            uri,
            title: chunk?.web?.title || uri,
          });
        }
      }

      const cleanSummary = responseText
        .replace(/^TAXA_COMERCIAL_BRL\s*:\s*[^\n]+\n?/i, '')
        .trim();

      res.json({
        currency: rawCurrency,
        targetCurrency: 'BRL',
        commercialRateBrl: parsedRate,
        summaryText:
          cleanSummary ||
          `Cotação comercial atual: 1 ${rawCurrency} = R$ ${parsedRate
            .toFixed(parsedRate < 0.1 ? 4 : 4)
            .replace('.', ',')}.`,
        fetchedAt: new Date().toISOString(),
        sources,
      });
    } catch (err: unknown) {
      console.error('Erro em /api/fx/live-rate:', err instanceof Error ? err.message : err);
      // Detalhes técnicos do provedor ficam só no log do servidor.
      res.status(err instanceof GeminiNotConfiguredError ? 503 : 500).json({
        error: err instanceof GeminiNotConfiguredError
          ? err.message
          : 'Não foi possível consultar a cotação agora. Informe a cotação manualmente ou tente de novo.',
      });
    }
  });

  // Google Finance Real-Time Stock, FII & ETF Quote Synchronization
  app.post('/api/investments/sync-quotes', async (req, res) => {
    try {
      const requestedTickers = req.body?.tickers;
      if (
        !Array.isArray(requestedTickers) ||
        requestedTickers.length > 20 ||
        requestedTickers.some((ticker: unknown) => typeof ticker !== 'string')
      ) {
        res.status(400).json({ error: 'Informe de um a 20 tickers válidos para buscar cotações.' });
        return;
      }

      const rawTickers = Array.from(
        new Set<string>(requestedTickers.map((ticker: string) => normalizeTickerSymbol(ticker)).filter(Boolean))
      );

      if (rawTickers.length === 0) {
        res.status(400).json({
          error:
            'Informe ao menos um ticker para atualizar as cotações no Google Finance.',
        });
        return;
      }
      if (rawTickers.some((ticker) => !/^[A-Z0-9.-]{1,20}$/.test(ticker))) {
        res.status(400).json({ error: 'Um ou mais tickers contêm caracteres inválidos.' });
        return;
      }

      const quoteMap = new Map<string, ParsedGoogleFinanceQuote>();
      const sources: { uri: string; title: string }[] = [];
      const seenUris = new Set<string>();

      // 1) Consulta direta rápida no Google Finance BVMF para Ações B3, FIIs e ETFs locais
      const directResults = await Promise.all(
        rawTickers.map((ticker) => fetchDirectGoogleFinanceQuote(ticker))
      );

      for (const directQuote of directResults) {
        if (directQuote && directQuote.priceBrl > 0) {
          quoteMap.set(directQuote.ticker, directQuote);
          if (directQuote.sourceUri && !seenUris.has(directQuote.sourceUri)) {
            seenUris.add(directQuote.sourceUri);
            sources.push({
              uri: directQuote.sourceUri,
              title: `Google Finance — ${directQuote.ticker}`,
            });
          }
        }
      }

      const missingTickers = rawTickers.filter((t) => !quoteMap.has(t));
      const missingTickerSet = new Set(missingTickers);

      // 2) Fallback / Complemento via Gemini Google Search Grounding para ativos no exterior ou não resolvidos diretamente
      if (missingTickers.length > 0 && process.env.GEMINI_API_KEY) {
        try {
          const ai = createGeminiClient();
          const prompt = [
            `Consulte agora no Google Finance / B3 via Google Search a cotação atual de mercado (em Reais BRL) e a variação percentual do dia para os seguintes ativos: ${missingTickers.join(', ')}.`,
            `Se algum ativo for negociado em Dólar (USD) no exterior (ex: AAPL, NVDA, VT, VOO), converta o preço unitário atual para Reais (BRL) pela cotação comercial de hoje.`,
            `Para CADA ativo encontrado, retorne OBRIGATORIAMENTE uma linha no formato exato (usando ponto como separador decimal):`,
            `QUOTE_LINE: TICKER | PRECO_BRL | VARIACAO_PCT | NOME_OFICIAL`,
            `Exemplo:`,
            `QUOTE_LINE: PETR4 | 38.45 | +1.25 | Petróleo Brasileiro S.A. - Petrobras`,
            `QUOTE_LINE: HGLG11 | 158.90 | -0.18 | CSHG Logística FII`,
          ].join('\n');

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              tools: [{ googleSearch: {} }],
            },
          });

          const responseText = (response.text ?? '').trim();
          const aiQuotes = parseGoogleFinanceQuotesFromText(responseText);

          for (const q of aiQuotes) {
            if (missingTickerSet.has(q.ticker) && !quoteMap.has(q.ticker)) {
              quoteMap.set(q.ticker, q);
            }
          }

          const rawChunks =
            response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          for (const chunk of rawChunks) {
            const uri = chunk?.web?.uri;
            if (uri && !seenUris.has(uri)) {
              seenUris.add(uri);
              sources.push({
                uri,
                title: chunk?.web?.title || uri,
              });
            }
          }
        } catch (aiErr) {
          console.warn(
            'Aviso: falha no complemento via Gemini Search para cotações:',
            aiErr instanceof Error ? aiErr.message : aiErr
          );
        }
      }

      const quotes = Array.from(quoteMap.values());

      if (quotes.length === 0) {
        res.status(502).json({
          error:
            'Não foi possível obter a cotação no Google Finance para o(s) ticker(s) informado(s). Verifique o código do ativo (ex: PETR4, VALE3, HGLG11, IVVB11).',
        });
        return;
      }

      res.json({
        quotes,
        fetchedAt: new Date().toISOString(),
        sources,
      });
    } catch (err: unknown) {
      console.error('Erro em /api/investments/sync-quotes:', err instanceof Error ? err.message : err);
      res.status(500).json({ error: 'Não foi possível atualizar as cotações agora. Tente de novo em instantes.' });
    }
  });
}
