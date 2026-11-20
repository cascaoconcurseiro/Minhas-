/** Tipos e props de InvestmentsTab. */
import { BankAccount, InvestmentAsset, InvestmentTargetMap, Transaction } from '../../../types/finance';
import { DEFAULT_INVESTMENT_TARGETS } from '../../../domain/investments/investmentRules';

export interface InvestmentsTabProps {
  getAuthToken: () => Promise<string>;
  selectedMonth: string;
  assets: InvestmentAsset[];
  targetMap?: InvestmentTargetMap;
  accounts: BankAccount[];
  /** Leva ao cadastro de conta quando falta uma conta em reais. */
  onRequestCreateAccount?: () => void;
  transactions?: Transaction[];
  monthlyLivingExpense: number;
  onAddAsset: (asset: Omit<InvestmentAsset, 'id'>) => void;
  onUpdateAsset: (asset: InvestmentAsset) => void;
  onBatchUpdateAssets?: (assets: InvestmentAsset[]) => void;
  onDeleteAsset: (assetId: string) => void;
  onOperateAsset: (
    assetId: string,
    operationType: 'buy' | 'sell' | 'update_quote',
    quantityDelta: number,
    unitPrice: number,
    settlementAccountId?: string,
    operationDate?: string
  ) => void;
  onRecordDividendIncome: (
    asset: InvestmentAsset,
    dividendAmount: number,
    receivingAccountId: string,
    operationDate?: string
  ) => void;
  onUpdateTargetMap?: (nextMap: InvestmentTargetMap) => void;
}

/** Aplica os valores padrão das props (mesmos de antes) e devolve tudo num objeto. */
export function resolveInvestmentsTabProps({
  getAuthToken,
  selectedMonth,
  assets,
  targetMap = DEFAULT_INVESTMENT_TARGETS,
  accounts,
  onRequestCreateAccount,
  transactions = [],
  monthlyLivingExpense,
  onAddAsset,
  onUpdateAsset,
  onBatchUpdateAssets,
  onDeleteAsset,
  onOperateAsset,
  onRecordDividendIncome,
  onUpdateTargetMap,
}: InvestmentsTabProps) {
  return {
    getAuthToken,
    selectedMonth,
    assets,
    accounts,
    onRequestCreateAccount,
    monthlyLivingExpense,
    onAddAsset,
    onUpdateAsset,
    onBatchUpdateAssets,
    onDeleteAsset,
    onOperateAsset,
    onRecordDividendIncome,
    onUpdateTargetMap,
    targetMap,
    transactions,
  };
}

export type InvestmentsTabPropsApi = ReturnType<typeof resolveInvestmentsTabProps>;
