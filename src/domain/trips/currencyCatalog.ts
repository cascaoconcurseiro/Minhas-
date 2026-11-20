/** Catálogo de moedas, regimes de pagamento e formatação de valores em moeda estrangeira. */
import type {
  CurrencyCode,
  CurrencyPaymentRegime,
} from '../../types/finance';

export interface CurrencyMetadata {
  code: CurrencyCode;
  symbol: string;
  name: string;
  flag: string;
  defaultCommercialRateBrl: number; // Cotação comercial aproximada em R$
  decimals: number;
}

export const CURRENCY_CATALOG: Record<CurrencyCode, CurrencyMetadata> = {
  BRL: {
    code: 'BRL',
    symbol: 'R$',
    name: 'Real Brasileiro',
    flag: '🇧🇷',
    defaultCommercialRateBrl: 1.0,
    decimals: 2,
  },
  USD: {
    code: 'USD',
    symbol: 'US$',
    name: 'Dólar Americano',
    flag: '🇺🇸',
    defaultCommercialRateBrl: 5.75,
    decimals: 2,
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    flag: '🇪🇺',
    defaultCommercialRateBrl: 6.22,
    decimals: 2,
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'Libra Esterlina',
    flag: '🇬🇧',
    defaultCommercialRateBrl: 7.35,
    decimals: 2,
  },
  CAD: {
    code: 'CAD',
    symbol: 'C$',
    name: 'Dólar Canadense',
    flag: '🇨🇦',
    defaultCommercialRateBrl: 4.18,
    decimals: 2,
  },
  CHF: {
    code: 'CHF',
    symbol: 'CHF',
    name: 'Franco Suíço',
    flag: '🇨🇭',
    defaultCommercialRateBrl: 6.55,
    decimals: 2,
  },
  ARS: {
    code: 'ARS',
    symbol: 'ARS$',
    name: 'Peso Argentino (Blue/MEP)',
    flag: '🇦🇷',
    defaultCommercialRateBrl: 0.0052,
    decimals: 2,
  },
  CLP: {
    code: 'CLP',
    symbol: 'CLP$',
    name: 'Peso Chileno',
    flag: '🇨🇱',
    defaultCommercialRateBrl: 0.0061,
    decimals: 0,
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Iene Japonês',
    flag: '🇯🇵',
    defaultCommercialRateBrl: 0.038,
    decimals: 0,
  },
};

export const CURRENCY_REGIME_DEFAULTS: Record<
  CurrencyPaymentRegime,
  {
    label: string;
    shortLabel: string;
    defaultIofPercent: number;
    description: string;
  }
> = {
  global_account: {
    label: 'Conta Global Internacional (Wise / Nomad / C6 / Inter)',
    shortLabel: 'Wise / Nomad (1,1% IOF)',
    defaultIofPercent: 1.1,
    description: 'Usa o câmbio médio ponderado do seu bolso ou dólar comercial + 1,1% IOF',
  },
  credit_card_intl: {
    label: 'Cartão de Crédito Brasileiro no Exterior (3,38% IOF)',
    shortLabel: 'Cartão Crédito (3,38% IOF)',
    defaultIofPercent: 3.38,
    description: 'Converte pelo câmbio PTAX + spread do banco + 3,38% IOF direto na fatura em R$',
  },
  cash_fx: {
    label: 'Dinheiro em Espécie (Casa de Câmbio / Papel Moeda)',
    shortLabel: 'Espécie / Papel Moeda',
    defaultIofPercent: 0,
    description: 'Pago com notas físicas na moeda local pelo câmbio efetivo pago na troca',
  },
  brl_direct: {
    label: 'Pago Direto em Reais (PIX / Cartão Nacional / Agência BR)',
    shortLabel: 'Pago em R$ (PIX/Nacional)',
    defaultIofPercent: 0,
    description: 'Passagens, hotéis ou seguros já cobrados diretamente em R$ no Brasil',
  },
};

export function formatForeignCurrency(
  amount: number,
  currency: CurrencyCode = 'USD'
): string {
  const meta = CURRENCY_CATALOG[currency] || CURRENCY_CATALOG.USD;
  const normalized = Object.is(amount, -0) ? 0 : amount;
  if (currency === 'BRL') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(normalized);
  }
  const formattedNum = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(normalized);
  return `${meta.symbol} ${formattedNum}`;
}

export function formatExchangeRateBR(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return 'R$ 0,00';
  const decimals = rate < 0.1 ? 4 : 2;
  return `R$ ${rate.toFixed(decimals).replace('.', ',')}`;
}
