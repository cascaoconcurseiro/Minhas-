/** Estado da tela: filtros, formulário do ativo, operação e cotações. Parte de InvestmentsTab (ver InvestmentsTab.tsx). */
import { useEffect, useRef, useState } from 'react';
import { InvestmentAsset, InvestmentAssetClass, InvestmentLiquidity, InvestmentTargetMap } from '../../../types/finance';
import { getLocalDateISO } from '../../../domain/finance/financeRules';
import { getAccountCurrency } from '../../../domain/finance/transferRules';
import type { InvestmentsTabPropsApi } from './investmentsTabConfig';

export function useInvestmentsState(ctx: InvestmentsTabPropsApi) {
  const {
    accounts,
    targetMap,
  } = ctx;
  const [classFilter, setClassFilter] = useState<'all' | InvestmentAssetClass>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [contributionDraftStr, setContributionDraftStr] = useState('');
  const [showTargetEditor, setShowTargetEditor] = useState(false);
  const [localTargets, setLocalTargets] = useState<InvestmentTargetMap>(targetMap);

  // New / Edit Asset Form State
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<InvestmentAsset | null>(null);
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [assetClass, setAssetClass] = useState<InvestmentAssetClass>('acoes_br');
  const [institution, setInstitution] = useState('');
  const [quantityStr, setQuantityStr] = useState('');
  const [avgPriceStr, setAvgPriceStr] = useState('');
  const [currPriceStr, setCurrPriceStr] = useState('');
  const [indexerLabel, setIndexerLabel] = useState('');
  const [liquidity, setLiquidity] = useState<InvestmentLiquidity>('D+2 (Bolsa B3)');
  const [yieldStr, setYieldStr] = useState('');
  const [isTaxExempt, setIsTaxExempt] = useState(false);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Google Finance Synchronization State
  const [isSyncingGoogleFinance, setIsSyncingGoogleFinance] = useState(false);
  const [isLookingUpTicker, setIsLookingUpTicker] = useState(false);
  const [googleFinanceMessage, setGoogleFinanceMessage] = useState<string | null>(null);
  const [googleFinanceError, setGoogleFinanceError] = useState<string | null>(null);
  const [googleFinanceSources, setGoogleFinanceSources] = useState<
    { uri: string; title: string }[]
  >([]);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('minhas_economias_gfinance_autosync') !== '0';
    } catch {
      return true;
    }
  });
  const hasAutoSyncedOnMountRef = useRef(false);

  // Quick Operation Panel State (Buy / Sell / Quote / Dividend)
  const [activeOperation, setActiveOperation] = useState<{
    asset: InvestmentAsset;
    mode: 'buy' | 'sell' | 'update_quote' | 'dividend';
  } | null>(null);
  const [operationDate, setOperationDate] = useState(getLocalDateISO);
  const [opQtyStr, setOpQtyStr] = useState('1');
  const [opPriceStr, setOpPriceStr] = useState('');
  // Compra e resgate de ativos movimentam reais: só contas em reais podem ser debitadas/creditadas.
  const brlAccounts = accounts.filter((account) => getAccountCurrency(account) === 'BRL');
  const [opAccountId, setOpAccountId] = useState<string>(brlAccounts[0]?.id || '');
  useEffect(() => {
    const brl = accounts.filter((a) => getAccountCurrency(a) === 'BRL');
    if ((!opAccountId || !brl.some((a) => a.id === opAccountId)) && brl.length > 0) {
      setOpAccountId(brl[0].id);
    }
  }, [accounts, opAccountId]);
  const [opLinkBankAccount, setOpLinkBankAccount] = useState(true);
  const [operationError, setOperationError] = useState('');

  return {
    activeOperation,
    assetClass,
    autoSyncEnabled,
    avgPriceStr,
    brlAccounts,
    classFilter,
    contributionDraftStr,
    currPriceStr,
    editingAsset,
    formError,
    googleFinanceError,
    googleFinanceMessage,
    googleFinanceSources,
    hasAutoSyncedOnMountRef,
    indexerLabel,
    institution,
    isLookingUpTicker,
    isSyncingGoogleFinance,
    isTaxExempt,
    liquidity,
    localTargets,
    name,
    notes,
    opAccountId,
    opLinkBankAccount,
    opPriceStr,
    opQtyStr,
    operationDate,
    operationError,
    quantityStr,
    searchQuery,
    setActiveOperation,
    setAssetClass,
    setAutoSyncEnabled,
    setAvgPriceStr,
    setClassFilter,
    setContributionDraftStr,
    setCurrPriceStr,
    setEditingAsset,
    setFormError,
    setGoogleFinanceError,
    setGoogleFinanceMessage,
    setGoogleFinanceSources,
    setIndexerLabel,
    setInstitution,
    setIsLookingUpTicker,
    setIsSyncingGoogleFinance,
    setIsTaxExempt,
    setLiquidity,
    setLocalTargets,
    setName,
    setNotes,
    setOpAccountId,
    setOpLinkBankAccount,
    setOpPriceStr,
    setOpQtyStr,
    setOperationDate,
    setOperationError,
    setQuantityStr,
    setSearchQuery,
    setShowAssetForm,
    setShowTargetEditor,
    setTicker,
    setYieldStr,
    showAssetForm,
    showTargetEditor,
    ticker,
    yieldStr,
  };
}

export type InvestmentsStateApi = ReturnType<typeof useInvestmentsState>;
