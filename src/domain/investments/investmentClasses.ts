/** Classes de ativo e seus metadados (rótulo, cor, se paga provento em dinheiro). */
import type {
  InvestmentAssetClass,
  InvestmentTargetMap,
} from '../../types/finance';

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
