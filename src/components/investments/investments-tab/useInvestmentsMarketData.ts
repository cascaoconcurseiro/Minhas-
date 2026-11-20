/** Cotações: sincronizar carteira, buscar ticker e preço da operação. Parte de InvestmentsTab (ver InvestmentsTab.tsx). */
import { useEffect, useMemo } from 'react';
import { fetchGoogleFinanceQuotes, isMarketQuotedAsset, syncAssetsWithGoogleFinance } from '../../../domain/investments/investmentRules';
import { InvestmentAsset } from '../../../types/finance';
import { formatBRL } from '../../../domain/finance/financeRules';
import type { InvestmentsTabPropsApi } from './investmentsTabConfig';
import type { InvestmentsStateApi } from './useInvestmentsState';

export function useInvestmentsMarketData(ctx: InvestmentsTabPropsApi & InvestmentsStateApi) {
  const {
    activeOperation,
    assets,
    autoSyncEnabled,
    avgPriceStr,
    getAuthToken,
    hasAutoSyncedOnMountRef,
    name,
    onBatchUpdateAssets,
    onUpdateAsset,
    setAssetClass,
    setAvgPriceStr,
    setCurrPriceStr,
    setFormError,
    setGoogleFinanceError,
    setGoogleFinanceMessage,
    setGoogleFinanceSources,
    setIsLookingUpTicker,
    setIsSyncingGoogleFinance,
    setIsTaxExempt,
    setLiquidity,
    setName,
    setOpPriceStr,
    setTicker,
    ticker,
  } = ctx;
  const marketQuotedAssets = useMemo(
    () => assets.filter((a) => isMarketQuotedAsset(a)),
    [assets]
  );

  const handleSyncPortfolioWithGoogleFinance = async (
    targetAssets: InvestmentAsset[] = marketQuotedAssets
  ) => {
    setIsSyncingGoogleFinance(true);
    setGoogleFinanceError(null);
    setGoogleFinanceMessage(null);

    try {
      const {
        updatedAssets,
        updatedCount,
        rejectedQuotes,
        quotes,
        sources,
      } = await syncAssetsWithGoogleFinance(
        assets,
        targetAssets,
        fetch,
        await getAuthToken()
      );

      if (updatedCount > 0) {
        if (onBatchUpdateAssets) {
          onBatchUpdateAssets(updatedAssets);
        } else {
          const matchedSet = new Set(
            quotes.map((q) => q.ticker.trim().toUpperCase())
          );
          for (const asset of updatedAssets) {
            const clean = asset.ticker.trim().toUpperCase();
            const base = /^[A-Z]{4}\d{1,2}F$/.test(clean)
              ? clean.slice(0, -1)
              : clean;
            if (matchedSet.has(clean) || matchedSet.has(base)) {
              onUpdateAsset(asset);
            }
          }
        }
      }

      setGoogleFinanceSources(sources);
      const rejectedNote =
        rejectedQuotes.length > 0
          ? ` Ignorada(s) por variação suspeita (mais que o dobro ou menos que a metade do preço anterior): ${rejectedQuotes
              .map((q) => `${q.ticker} (${formatBRL(q.previousPrice)} → ${formatBRL(q.quotedPrice)})`)
              .join(', ')}. Confira e atualize à mão se estiver certo.`
          : '';
      const quotesNote = quotes.length > 0
        ? ` (${quotes.map((q) => `${q.ticker}: ${formatBRL(q.priceBrl)}`).join(' · ')})`
        : '';
      setGoogleFinanceMessage(
        updatedCount > 0
          ? `${updatedCount} ativo(s) com cotação atualizada via Google Finance${quotesNote}.${rejectedNote}`
          : `Nenhuma cotação foi atualizada pelo Google Finance.${rejectedNote}`
      );
    } catch (err: unknown) {
      setGoogleFinanceError(
        err instanceof Error
          ? err.message
          : 'Erro ao atualizar cotações com o Google Finance.'
      );
    } finally {
      setIsSyncingGoogleFinance(false);
    }
  };

  // Auto-sync on mount when autoSyncEnabled is true and there are market assets
  useEffect(() => {
    if (
      autoSyncEnabled &&
      !hasAutoSyncedOnMountRef.current &&
      marketQuotedAssets.length > 0
    ) {
      hasAutoSyncedOnMountRef.current = true;
      handleSyncPortfolioWithGoogleFinance(marketQuotedAssets);
    }
  }, [autoSyncEnabled, marketQuotedAssets.length]);

  const handleLookupSingleTickerOnGoogleFinance = async () => {
    const cleanTicker = ticker.trim().toUpperCase();
    if (!cleanTicker) {
      setFormError(
        'Digite o código/ticker (ex: PETR4, HGLG11, IVVB11, AAPL) antes de buscar no Google Finance.'
      );
      return;
    }

    setIsLookingUpTicker(true);
    setFormError('');
    try {
      const { quotes } = await fetchGoogleFinanceQuotes(
        [cleanTicker],
        fetch,
        await getAuthToken()
      );
      const found = quotes[0];
      if (!found) {
        throw new Error(`Ticker ${cleanTicker} não encontrado no Google Finance.`);
      }

      setTicker(found.ticker);
      const formattedPrice = found.priceBrl.toFixed(2).replace('.', ',');
      setCurrPriceStr(formattedPrice);
      if (!avgPriceStr.trim()) {
        setAvgPriceStr(formattedPrice);
      }
      if (found.name && !name.trim()) {
        setName(found.name);
      }
      if (found.assetClassHint) {
        setAssetClass(found.assetClassHint);
        if (found.assetClassHint === 'fiis') {
          setIsTaxExempt(true);
          setLiquidity('D+2 (Bolsa B3)');
        } else if (
          found.assetClassHint === 'acoes_br' ||
          found.assetClassHint === 'exterior_etf'
        ) {
          setLiquidity('D+2 (Bolsa B3)');
        }
      }
    } catch (err: unknown) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Erro ao consultar ticker no Google Finance.'
      );
    } finally {
      setIsLookingUpTicker(false);
    }
  };

  const handleFetchQuoteForActiveOperation = async () => {
    if (!activeOperation) return;
    setIsLookingUpTicker(true);
    setGoogleFinanceError(null);
    try {
      const { quotes } = await fetchGoogleFinanceQuotes([
        activeOperation.asset.ticker,
      ], fetch, await getAuthToken());
      const found = quotes[0];
      if (found && found.priceBrl > 0) {
        setOpPriceStr(found.priceBrl.toFixed(2).replace('.', ','));
      } else {
        throw new Error(`Nenhuma cotação válida foi retornada para ${activeOperation.asset.ticker}.`);
      }
    } catch (err: unknown) {
      setGoogleFinanceError(
        err instanceof Error
          ? err.message
          : 'Não foi possível buscar a cotação no Google Finance.'
      );
    } finally {
      setIsLookingUpTicker(false);
    }
  };

  return {
    handleFetchQuoteForActiveOperation,
    handleLookupSingleTickerOnGoogleFinance,
    handleSyncPortfolioWithGoogleFinance,
    marketQuotedAssets,
  };
}

export type InvestmentsMarketDataApi = ReturnType<typeof useInvestmentsMarketData>;
