/** Cliente Gemini, nomes de moedas e consulta direta ao Google Finance. */
import { GoogleGenAI } from '@google/genai';
import { ParsedGoogleFinanceQuote, formatGoogleFinanceSymbol, parseGoogleFinanceHtmlQuote } from '../src/domain/investments/investmentRules.ts';

export const CURRENCY_NAMES_PT: Record<string, string> = {
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

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super('A cotação em tempo real não está ativada neste servidor. Informe a cotação manualmente.');
  }
}

export function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfiguredError();
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'minhas-economias',
      },
    },
  });
}

export async function fetchDirectGoogleFinanceQuote(
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
