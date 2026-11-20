/** Ações: cadastrar/editar ativo, aporte, resgate e metas de alocação. Parte de InvestmentsTab (ver InvestmentsTab.tsx). */
import { InvestmentAsset } from '../../../types/finance';
import React, { useMemo } from 'react';
import { calculateInvestmentIncomeSummary, getLocalDateISO, parseBRLInput } from '../../../domain/finance/financeRules';
import { isValidISODate } from '../../../domain/finance/formatting';
import type { InvestmentsTabPropsApi } from './investmentsTabConfig';
import type { InvestmentsStateApi } from './useInvestmentsState';

export function useInvestmentsActions(ctx: InvestmentsTabPropsApi & InvestmentsStateApi) {
  const {
    activeOperation,
    assetClass,
    avgPriceStr,
    brlAccounts,
    currPriceStr,
    editingAsset,
    indexerLabel,
    institution,
    isTaxExempt,
    liquidity,
    localTargets,
    name,
    notes,
    onAddAsset,
    onOperateAsset,
    onRecordDividendIncome,
    onUpdateAsset,
    onUpdateTargetMap,
    opAccountId,
    opLinkBankAccount,
    opPriceStr,
    opQtyStr,
    operationDate,
    quantityStr,
    selectedMonth,
    setActiveOperation,
    setAssetClass,
    setAvgPriceStr,
    setCurrPriceStr,
    setEditingAsset,
    setFormError,
    setGoogleFinanceError,
    setIndexerLabel,
    setInstitution,
    setIsTaxExempt,
    setLiquidity,
    setName,
    setNotes,
    setOpAccountId,
    setOpLinkBankAccount,
    setOpPriceStr,
    setOpQtyStr,
    setOperationDate,
    setOperationError,
    setQuantityStr,
    setShowAssetForm,
    setShowTargetEditor,
    setTicker,
    setYieldStr,
    ticker,
    transactions,
    yieldStr,
  } = ctx;
  const openNewAssetForm = () => {
    setEditingAsset(null);
    setTicker('');
    setName('');
    setAssetClass('acoes_br');
    setInstitution('');
    setQuantityStr('');
    setAvgPriceStr('');
    setCurrPriceStr('');
    setIndexerLabel('');
    setLiquidity('D+2 (Bolsa B3)');
    setYieldStr('');
    setIsTaxExempt(false);
    setNotes('');
    setFormError('');
    setShowAssetForm(true);
  };

  const openEditAssetForm = (asset: InvestmentAsset) => {
    setEditingAsset(asset);
    setTicker(asset.ticker);
    setName(asset.name);
    setAssetClass(asset.assetClass);
    setInstitution(asset.institution);
    setQuantityStr(String(asset.quantity).replace('.', ','));
    setAvgPriceStr(asset.averagePrice.toFixed(2).replace('.', ','));
    setCurrPriceStr(asset.currentPrice.toFixed(2).replace('.', ','));
    setIndexerLabel(asset.indexerLabel);
    setLiquidity(asset.liquidity);
    setYieldStr(asset.monthlyYieldPercent.toFixed(2).replace('.', ','));
    setIsTaxExempt(asset.isTaxExempt);
    setNotes(asset.notes || '');
    setFormError('');
    setShowAssetForm(true);
  };

  const handleSaveAssetForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim() || !name.trim()) {
      setFormError('Informe o código/ticker e o nome do ativo.');
      return;
    }
    const qty = parseBRLInput(quantityStr);
    const avg = parseBRLInput(avgPriceStr);
    const curr = parseBRLInput(currPriceStr);
    if (qty <= 0) {
      setFormError('Informe uma quantidade maior que zero.');
      return;
    }
    if (avg <= 0 || curr <= 0) {
      setFormError('Informe preços médios e atuais maiores que zero.');
      return;
    }
    const monthlyY = Math.max(0, parseBRLInput(yieldStr));

    if (editingAsset) {
      onUpdateAsset({
        ...editingAsset,
        ticker: ticker.trim().toUpperCase(),
        name: name.trim(),
        assetClass,
        institution: institution.trim() || 'Corretora',
        quantity: qty,
        averagePrice: avg,
        currentPrice: curr,
        indexerLabel: indexerLabel.trim() || 'Mercado',
        liquidity,
        monthlyYieldPercent: monthlyY,
        isTaxExempt,
        notes: notes.trim() || undefined,
      });
    } else {
      onAddAsset({
        ticker: ticker.trim().toUpperCase(),
        name: name.trim(),
        assetClass,
        institution: institution.trim() || 'Corretora',
        quantity: qty,
        averagePrice: avg,
        currentPrice: curr,
        indexerLabel: indexerLabel.trim() || 'Mercado',
        liquidity,
        monthlyYieldPercent: monthlyY,
        isTaxExempt,
        notes: notes.trim() || undefined,
      });
    }
    setShowAssetForm(false);
    setEditingAsset(null);
  };

  const openOperationModal = (
    asset: InvestmentAsset,
    mode: 'buy' | 'sell' | 'update_quote' | 'dividend'
  ) => {
    setActiveOperation({ asset, mode });
    setOperationDate(getLocalDateISO());
    setOperationError('');
    setGoogleFinanceError(null);
    if (mode === 'dividend') {
      const estDiv =
        Math.round(
          asset.quantity *
            asset.currentPrice *
            (asset.monthlyYieldPercent / 100) *
            100
        ) / 100;
      setOpPriceStr(Math.max(1, estDiv).toFixed(2).replace('.', ','));
      setOpQtyStr('1');
    } else {
      setOpQtyStr(asset.assetClass.startsWith('renda_fixa') ? '1' : '10');
      setOpPriceStr(asset.currentPrice.toFixed(2).replace('.', ','));
    }
    setOpAccountId(brlAccounts[0]?.id || '');
    setOpLinkBankAccount(brlAccounts.length > 0);
  };

  const handleConfirmOperation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOperation) return;
    const { asset, mode } = activeOperation;

    if (!isValidISODate(operationDate)) { setOperationError('Informe uma data válida.'); return; }
    if (mode === 'dividend') {
      const divAmount = parseBRLInput(opPriceStr);
      if (!Number.isFinite(divAmount) || divAmount <= 0) {
        setOperationError('Informe um valor de provento maior que zero.');
        return;
      }
      if (!opAccountId) {
        setOperationError('Cadastre ou selecione uma conta para receber o provento.');
        return;
      }
      onRecordDividendIncome(asset, divAmount, opAccountId, operationDate);
      setActiveOperation(null);
      return;
    }

    const qty = parseBRLInput(opQtyStr);
    const price = parseBRLInput(opPriceStr);
    if (!Number.isFinite(price) || price <= 0 || (mode !== 'update_quote' && (!Number.isFinite(qty) || qty <= 0))) {
      setOperationError('Informe quantidade e preço maiores que zero.');
      return;
    }
    if (mode === 'sell' && qty > asset.quantity + 0.0000001) {
      setOperationError(`A quantidade vendida não pode superar o saldo de ${asset.quantity}.`);
      return;
    }
    if (opLinkBankAccount && mode !== 'update_quote' && !opAccountId) {
      setOperationError('Selecione uma conta ou desative o registro no extrato.');
      return;
    }
    setOperationError('');
    onOperateAsset(
      asset.id,
      mode,
      qty,
      price,
      opLinkBankAccount && mode !== 'update_quote' ? opAccountId : undefined,
      mode !== 'update_quote' ? operationDate : undefined
    );
    setActiveOperation(null);
  };

  const handleSaveTargets = () => {
    onUpdateTargetMap?.(localTargets);
    setShowTargetEditor(false);
  };

  const { monthTransactions: monthDividendTransactions, monthTotal: monthDividendsTotal, registeredTotal: allTimeDividendsTotal } = useMemo(
    () => calculateInvestmentIncomeSummary(transactions, selectedMonth),
    [transactions, selectedMonth]
  );

  return {
    allTimeDividendsTotal,
    handleConfirmOperation,
    handleSaveAssetForm,
    handleSaveTargets,
    monthDividendTransactions,
    monthDividendsTotal,
    openEditAssetForm,
    openNewAssetForm,
    openOperationModal,
  };
}

export type InvestmentsActionsApi = ReturnType<typeof useInvestmentsActions>;
