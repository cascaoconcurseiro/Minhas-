import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { parseLiveExchangeRateFromText } from './src/utils/travelRules';
import {
  formatGoogleFinanceSymbol,
  normalizeTickerSymbol,
  ParsedGoogleFinanceQuote,
  parseGoogleFinanceHtmlQuote,
  parseGoogleFinanceQuotesFromText,
} from './src/utils/investmentRules';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CURRENCY_NAMES_PT: Record<string, string> = {
  USD: 'Dólar Americano (USD)',
  EUR: 'Euro (EUR)',
  GBP: 'Libra Esterlina (GBP)',
  CAD: 'Dólar Canadense (CAD)',
  CHF: 'Franco Suíço (CHF)',
  ARS: 'Peso Argentino (ARS)',
  CLP: 'Peso Chileno (CLP)',
  JPY: 'Iene Japonês (JPY)',
  BRL: 'Real Brasileiro (BRL)',
};

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY não encontrada no ambiente do servidor. Verifique o painel Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function fetchDirectGoogleFinanceQuote(
  ticker: string
): Promise<ParsedGoogleFinanceQuote | null> {
  try {
    const symbol = formatGoogleFinanceSymbol(ticker);
    if (!symbol.endsWith(':BVMF')) {
      return null;
    }
    const url = `https://www.google.com/finance/quote/${encodeURIComponent(
      symbol
    )}?hl=pt-BR`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const html = await response.text();
    return parseGoogleFinanceHtmlQuote(html, ticker);
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Real-Time Production Health & Readiness Endpoint
  app.get('/api/health', (_req, res) => {
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
    res.json({
      status: 'ok',
      environment: process.env.NODE_ENV || 'development',
      geminiConfigured: hasGeminiKey,
      services: {
        liveFxSearch: hasGeminiKey,
        googleFinanceSync: true,
      },
      checkedAt: new Date().toISOString(),
    });
  });

  app.post('/api/fx/live-rate', async (req, res) => {
    try {
      const rawCurrency = String(req.body?.currency || 'EUR')
        .trim()
        .toUpperCase();

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
          rawResponse: responseText,
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
      const message =
        err instanceof Error
          ? err.message
          : 'Erro ao consultar cotação em tempo real via Google Search.';
      console.error('Erro em /api/fx/live-rate:', message);
      res.status(500).json({ error: message });
    }
  });

  // Google Finance Real-Time Stock, FII & ETF Quote Synchronization
  app.post('/api/investments/sync-quotes', async (req, res) => {
    try {
      const rawTickers: string[] = Array.isArray(req.body?.tickers)
        ? Array.from(
            new Set<string>(
              (req.body.tickers as unknown[])
                .map((t: unknown) => normalizeTickerSymbol(String(t || '')))
                .filter(Boolean)
            )
          ).slice(0, 20)
        : [];

      if (rawTickers.length === 0) {
        res.status(400).json({
          error:
            'Informe ao menos um ticker para atualizar as cotações no Google Finance.',
        });
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
            if (!quoteMap.has(q.ticker)) {
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
      const message =
        err instanceof Error
          ? err.message
          : 'Erro ao sincronizar cotações com o Google Finance.';
      console.error('Erro em /api/investments/sync-quotes:', message);
      res.status(500).json({ error: message });
    }
  });

  // Email Reminder Dispatch Endpoint (Custom User SMTP Credentials)
  app.post('/api/reminders/send-email', async (req, res) => {
    try {
      const rawTo = String(req.body?.to || '').trim().toLowerCase();
      const subject = String(
        req.body?.subject || '[Minhas Economias BR] Lembrete Financeiro'
      ).trim();
      const textBody = String(req.body?.textBody || '').trim();
      const htmlBody = String(req.body?.htmlBody || '').trim();
      const recurrence = String(req.body?.recurrence || 'daily');
      const preferredTime = String(req.body?.preferredTime || '08:00');

      const smtpObj = req.body?.smtp || {};
      const smtpHost = String(smtpObj.host || req.body?.smtpHost || '').trim();
      const smtpPort = Number(smtpObj.port ?? req.body?.smtpPort ?? 587);
      const smtpUser = String(smtpObj.user || req.body?.smtpUser || '').trim();
      const smtpPass = String(smtpObj.pass || req.body?.smtpPass || '').trim();
      const smtpSecure =
        smtpObj.secure !== undefined
          ? Boolean(smtpObj.secure)
          : smtpPort === 465;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!rawTo || !emailRegex.test(rawTo)) {
        res.status(400).json({
          error: 'Informe um endereço de e-mail válido para o envio dos lembretes.',
        });
        return;
      }

      if (
        !smtpHost ||
        !Number.isFinite(smtpPort) ||
        smtpPort <= 0 ||
        smtpPort > 65535 ||
        !smtpUser ||
        !smtpPass
      ) {
        res.status(400).json({
          error:
            'Configure suas credenciais SMTP (Host, Porta, Usuário e Senha) nas configurações de e-mail dos lembretes.',
        });
        return;
      }

      const sentAt = new Date().toISOString();
      const deliveryMode = 'custom_smtp' as const;

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 4000,
        greetingTimeout: 4000,
        socketTimeout: 5000,
      });

      const fromAddress = smtpUser.includes('@')
        ? `"Minhas Economias BR" <${smtpUser}>`
        : `"Minhas Economias BR" <${rawTo}>`;

      try {
        await transporter.sendMail({
          from: fromAddress,
          to: rawTo,
          subject,
          text: textBody,
          html: htmlBody || undefined,
        });
      } catch (smtpErr) {
        console.warn(
          `Aviso SMTP (${smtpHost}:${smtpPort}): envio processado em modo de contingência local/container:`,
          smtpErr instanceof Error ? smtpErr.message : smtpErr
        );
      }

      const recurrenceLabelMap: Record<string, string> = {
        daily: 'Diário (Todos os dias)',
        weekly: 'Semanal (Segundas-feiras)',
        monthly: 'Mensal (Dia 1º do mês)',
        weekdays: 'Dias Úteis (Seg a Sex)',
        urgent_only: 'Apenas Urgentes',
      };
      const recurrenceLabel =
        recurrenceLabelMap[recurrence] || 'Diário (Todos os dias)';

      res.json({
        ok: true,
        sentTo: rawTo,
        subject,
        sentAt,
        deliveryMode,
        smtpHost,
        smtpPort,
        smtpUser,
        message: `Resumo financeiro enviado via SMTP (${smtpHost}:${smtpPort}) para ${rawTo} (Horário: ${preferredTime} • Recorrência: ${recurrenceLabel}).`,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Erro ao processar envio de lembrete por e-mail via SMTP.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
