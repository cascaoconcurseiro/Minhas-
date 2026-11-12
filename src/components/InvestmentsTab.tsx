import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  CheckCircle2,
  Coins,
  DollarSign,
  Edit3,
  ExternalLink,
  Landmark,
  Layers,
  Loader2,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  BankAccount,
  InvestmentAsset,
  InvestmentAssetClass,
  InvestmentLiquidity,
  InvestmentTargetMap,
  Transaction,
} from '../types/finance';
import {
  formatBRL,
  getLocalDateISO,
  formatMonthYearPT,
  formatShortDateBR,
  normalizeSearchText,
  parseBRLInput,
  calculateInvestmentIncomeSummary,
} from '../utils/financeRules';
import {
  calculatePortfolioSummary,
  calculateSmartContributionAllocation,
  DEFAULT_INVESTMENT_TARGETS,
  fetchGoogleFinanceQuotes,
  INVESTMENT_CLASS_META,
  isMarketQuotedAsset,
  syncAssetsWithGoogleFinance,
} from '../utils/investmentRules';
import { CurrencyInput } from './CurrencyInput';
import { InstitutionMark } from './InstitutionMark';

interface InvestmentsTabProps {
  getAuthToken: () => Promise<string>;
  selectedMonth: string;
  assets: InvestmentAsset[];
  targetMap?: InvestmentTargetMap;
  accounts: BankAccount[];
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

export const InvestmentsTab: React.FC<InvestmentsTabProps> = ({
  getAuthToken,
  selectedMonth,
  assets,
  targetMap = DEFAULT_INVESTMENT_TARGETS,
  accounts,
  transactions = [],
  monthlyLivingExpense,
  onAddAsset,
  onUpdateAsset,
  onBatchUpdateAssets,
  onDeleteAsset,
  onOperateAsset,
  onRecordDividendIncome,
  onUpdateTargetMap,
}) => {
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
  const [opAccountId, setOpAccountId] = useState<string>(accounts[0]?.id || '');
  useEffect(() => {
    if (
      (!opAccountId || !accounts.some((a) => a.id === opAccountId)) &&
      accounts.length > 0
    ) {
      setOpAccountId(accounts[0].id);
    }
  }, [accounts, opAccountId]);
  const [opLinkBankAccount, setOpLinkBankAccount] = useState(true);
  const [operationError, setOperationError] = useState('');

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
      setGoogleFinanceMessage(
        `${updatedCount} ativo(s) com cotação atualizada via Google Finance (${quotes
          .map((q) => `${q.ticker}: ${formatBRL(q.priceBrl)}`)
          .join(' · ')}).`
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

  const summary = useMemo(
    () =>
      calculatePortfolioSummary(
        assets,
        targetMap,
        monthlyLivingExpense > 0 ? monthlyLivingExpense : 5000
      ),
    [assets, targetMap, monthlyLivingExpense]
  );

  const contributionAmount = Math.max(0, parseBRLInput(contributionDraftStr));
  const smartRecommendations = useMemo(
    () =>
      calculateSmartContributionAllocation(
        assets,
        targetMap,
        contributionAmount
      ),
    [assets, targetMap, contributionAmount]
  );

  const filteredPositions = useMemo(() => {
    const normQuery = normalizeSearchText(searchQuery);
    return summary.positions.filter((pos) => {
      if (classFilter !== 'all' && pos.asset.assetClass !== classFilter) {
        return false;
      }
      if (normQuery) {
        const searchable = normalizeSearchText(
          `${pos.asset.ticker} ${pos.asset.name} ${pos.asset.institution} ${pos.asset.indexerLabel}`
        );
        if (!searchable.includes(normQuery)) return false;
      }
      return true;
    });
  }, [summary.positions, classFilter, searchQuery]);

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
    setOpAccountId(accounts[0]?.id || '');
    setOpLinkBankAccount(accounts.length > 0);
  };

  const handleConfirmOperation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOperation) return;
    const { asset, mode } = activeOperation;

    const parsedDate = new Date(`${operationDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(operationDate) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0,10) !== operationDate) { setOperationError('Informe uma data válida.'); return; }
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

  return (
    <div className="module-page space-y-6 min-w-0 max-w-full" data-testid="investments-tab-view">
      {/* Row 1: 4 Executive Wealth & Passive Income KPIs (2x2 on Mobile, 4 Columns on Desktop) */}
      <section
        aria-label="Indicadores da Carteira de Investimentos"
        className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4"
      >
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
            <span className="truncate">Patrimônio Investido</span>
            <Landmark className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
          </div>
          <p
            data-testid="portfolio-total-value"
            className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 truncate"
          >
            {formatBRL(summary.totalCurrentValue)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums truncate">
            Custo: {formatBRL(summary.totalInvestedCost)}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
            <span className="truncate">Ganho de Capital</span>
            <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 flex flex-wrap items-baseline gap-1.5">
            <p
              className={`text-base sm:text-2xl font-bold font-mono tabular-nums truncate ${
                summary.totalCapitalGain >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {summary.totalCapitalGain >= 0 ? '+' : ''}
              {formatBRL(summary.totalCapitalGain)}
            </p>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] sm:text-xs font-bold font-mono tabular-nums ${
                summary.totalProfitabilityPercent >= 0
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {summary.totalProfitabilityPercent >= 0 ? '+' : ''}
              {summary.totalProfitabilityPercent}%
            </span>
          </div>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums truncate">
            Liq. D+0/D+1: {summary.immediateLiquidityPercent}%
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
            <span className="truncate">Renda Passiva/Mês</span>
            <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 shrink-0" />
          </div>
          <p
            data-testid="portfolio-passive-income"
            className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 truncate"
          >
            +{formatBRL(summary.estimatedMonthlyPassiveIncome)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums truncate">
            FII/Ações: {formatBRL(summary.cashDividendsMonthly)}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
            <span className="truncate">Cobertura Custo</span>
            <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-600 shrink-0" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 truncate">
            {summary.livingCostCoveragePercent}%
            <span className="text-[10px] sm:text-xs font-normal text-slate-500"> do mês</span>
          </p>
          <div className="mt-1.5 sm:mt-2 h-1.5 sm:h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-300"
              style={{
                width: `${Math.min(100, summary.livingCostCoveragePercent)}%`,
              }}
            />
          </div>
        </div>
      </section>

      {/* Row 2: Asset Allocation Map + Smart Contribution Rebalancer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: Asset Class Allocation vs Target */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-emerald-600" />
                  <span>Alocação Estratégica por Classe de Ativo</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Diversificação entre Renda Fixa Selic/CDI, Inflação IPCA+, FIIs, Ações B3 e Exterior
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setLocalTargets(targetMap);
                  setShowTargetEditor((prev) => !prev);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <Sliders className="h-3.5 w-3.5 text-slate-500" />
                <span>{showTargetEditor ? 'Fechar Metas' : 'Definir % Ideal'}</span>
              </button>
            </div>

            {/* Stacked Portfolio Allocation Bar */}
            <div className="h-3.5 w-full rounded-full bg-slate-100 overflow-hidden flex border border-slate-200/70">
              {summary.classAllocations.map((cls) => (
                <div
                  key={cls.assetClass}
                  style={{
                    width: `${cls.currentPercent}%`,
                    backgroundColor: cls.color,
                  }}
                  title={`${cls.shortLabel}: ${cls.currentPercent}% (${formatBRL(
                    cls.currentValue
                  )})`}
                  className="h-full transition-all duration-300"
                />
              ))}
            </div>

            {/* Optional Target Allocation Editor */}
            {showTargetEditor && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 animate-expand-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Ajustar Percentual Ideal de Cada Classe (Soma recomendada: 100%)
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveTargets}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Salvar Metas
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {summary.classAllocations.map((cls) => (
                    <div key={cls.assetClass}>
                      <label className="block text-[11px] font-semibold text-slate-600 truncate mb-1">
                        {cls.shortLabel} (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={localTargets[cls.assetClass]}
                        onChange={(e) =>
                          setLocalTargets((prev) => ({
                            ...prev,
                            [cls.assetClass]: Number(e.target.value) || 0,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Class Breakdown Rows */}
            <div className="divide-y divide-slate-100">
              {summary.classAllocations.map((cls) => {
                const isUnderTarget = cls.deviationPercent < -2;
                return (
                  <div
                    key={cls.assetClass}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: cls.color }}
                        />
                        <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {cls.label}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          ({cls.assetsCount})
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-slate-600">
                        <span>
                          Saldo: <strong className="text-slate-900">{formatBRL(cls.currentValue)}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Atual: <strong>{cls.currentPercent}%</strong> / Meta:{' '}
                          <strong>{cls.targetPercent}%</strong>
                        </span>
                        {isUnderTarget && (
                          <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-sans font-semibold text-amber-800">
                            Faltam {formatBRL(cls.missingAmountToTarget)} p/ meta
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right font-mono tabular-nums shrink-0">
                      <span
                        className={`text-xs font-bold ${
                          cls.capitalGain >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {cls.capitalGain >= 0 ? '+' : ''}
                        {formatBRL(cls.capitalGain)} ({cls.profitabilityPercent}%)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Renda: +{formatBRL(cls.estimatedMonthlyIncome)}/mês
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Patrimônio Isento de IR (LCI/LCA, FIIs e Ações):{' '}
              <strong className="text-slate-800 font-mono">
                {formatBRL(summary.taxExemptValue)} ({summary.taxExemptPercent}%)
              </strong>
            </span>
          </div>
        </section>

        {/* Right 5 Cols: Smart Contribution Rebalancer (Onde aportar este mês sem vender) */}
        <section
          data-testid="smart-rebalancer-panel"
          className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span>Simulador de Próximo Aporte</span>
                </h2>
                <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Rebalancear Sem Vender
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Informe quanto você vai investir neste mês. O sistema direciona o aporte para as classes abaixo da meta, evitando vendas e pagamento de IR.
              </p>
            </div>

            <div>
              <label
                htmlFor="smart-contribution-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Valor do Novo Aporte Mensal (R$)
              </label>
              <div className="flex items-center gap-2">
                <CurrencyInput
                  id="smart-contribution-input"
                  value={contributionDraftStr}
                  currency="BRL"
                  onValueChange={setContributionDraftStr}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base font-bold font-mono tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
                {[1000, 2500, 5000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      setContributionDraftStr(preset.toFixed(2).replace('.', ','))
                    }
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-mono font-semibold text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 transition-colors shrink-0"
                  >
                    {preset / 1000}k
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <p className="text-xs font-bold text-slate-700">
                Distribuição Recomendada para {formatBRL(contributionAmount)}:
              </p>
              {smartRecommendations.map((rec) => (
                <div
                  key={rec.assetClass}
                  className={`rounded-xl border p-3 transition-colors ${
                    rec.recommendedAmount > 0
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-slate-200/70 bg-slate-50/50 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: rec.color }}
                      />
                      {rec.shortLabel}
                    </span>
                    <span className="font-mono tabular-nums font-extrabold text-emerald-800">
                      {rec.recommendedAmount > 0
                        ? `Aportar ${formatBRL(rec.recommendedAmount)}`
                        : 'Já acima da meta (R$ 0,00)'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500">
                    <span>
                      Antes: {rec.currentPercent}% → Após: {rec.projectedPercentAfter}%
                    </span>
                    <span>Meta: {rec.targetPercent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-slate-100/80 p-3 text-[11px] text-slate-600">
            Dica B3 & IR: Rebalancear comprando os ativos descontados mantém sua carteira alinhada sem gerar DARF de ganho de capital.
          </div>
        </section>
      </div>

      {/* Row 3: Detailed Assets Table & Operations */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 sm:px-6 py-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Posições Detalhadas da Carteira ({assets.length} ativos)
                </h2>
                <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                  <TrendingUp className="h-3 w-3 text-sky-600" />
                  Google Finance Sync
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Sincronize automaticamente ações da B3, FIIs e ETFs com o Google Finance em tempo real
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setAutoSyncEnabled(next);
                    try {
                      localStorage.setItem(
                        'minhas_economias_gfinance_autosync',
                        next ? '1' : '0'
                      );
                    } catch {
                      // Ignore
                    }
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600"
                />
                <span>Auto-sync Google Finance</span>
              </label>

              <button
                type="button"
                data-testid="sync-google-finance-btn"
                onClick={() => handleSyncPortfolioWithGoogleFinance(marketQuotedAssets)}
                disabled={isSyncingGoogleFinance}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100 transition-colors disabled:opacity-60"
              >
                {isSyncingGoogleFinance ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-700" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 text-sky-700" />
                )}
                <span>
                  {isSyncingGoogleFinance
                    ? 'Atualizando Cotações...'
                    : 'Atualizar Cotações'}
                </span>
              </button>

              <button
                type="button"
                data-testid="open-new-investment-btn"
                onClick={openNewAssetForm}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-2xs"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Ativo / Aplicação</span>
              </button>
            </div>
          </div>

          {googleFinanceMessage && (
            <div
              data-testid="google-finance-sync-banner"
              className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-3.5 py-2.5 text-xs text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <span className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                {googleFinanceMessage}
              </span>
              {googleFinanceSources.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {googleFinanceSources.slice(0, 2).map((src, idx) => (
                    <a
                      key={`${src.uri}-${idx}`}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-medium text-emerald-800 hover:underline max-w-[180px] truncate"
                    >
                      <span className="truncate">{src.title}</span>
                      <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {googleFinanceError && (
            <div role="alert" data-testid="google-finance-error" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-800">
              {googleFinanceError}
            </div>
          )}

          {/* Filter & Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex overflow-x-auto no-scrollbar items-center gap-1 rounded-lg bg-slate-200/70 p-1 max-w-full">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'renda_fixa_pos', label: 'RF Pós (Selic/CDI)' },
                { id: 'renda_fixa_ipca', label: 'RF IPCA+' },
                { id: 'fiis', label: 'FIIs' },
                { id: 'acoes_br', label: 'Ações B3' },
                { id: 'exterior_etf', label: 'Exterior' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setClassFilter(tab.id as any)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    classFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="pointer-events-none absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar ticker, corretora ou indexador..."
                className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Add / Edit Asset Form */}
        {showAssetForm && (
          <form
            onSubmit={handleSaveAssetForm}
            className="border-b border-slate-200 bg-slate-50 p-4 sm:p-6 space-y-4 animate-expand-in"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingAsset
                  ? `Editar Ativo — ${editingAsset.ticker}`
                  : 'Cadastrar Novo Ativo na Carteira'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAssetForm(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label htmlFor="investment-form-ticker" className="block text-xs font-semibold text-slate-700 mb-1">
                  Código / Ticker (B3 / Global)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    id="investment-form-ticker"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    placeholder="Ex: PETR4, HGLG11, IVVB11"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono uppercase text-slate-900"
                  />
                  <button
                    type="button"
                    data-testid="lookup-ticker-google-finance-btn"
                    onClick={handleLookupSingleTickerOnGoogleFinance}
                    disabled={isLookingUpTicker}
                    title="Buscar cotação atual e nome do ativo no Google Finance"
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-2 text-[11px] font-bold text-sky-900 hover:bg-sky-100 transition-colors shrink-0 disabled:opacity-60"
                  >
                    {isLookingUpTicker ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-700" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 text-sky-700" />
                    )}
                    <span>Cotação</span>
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="investment-form-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Descritivo do Ativo
                </label>
                <input
                  type="text"
                  id="investment-form-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: CSHG Logística FII / Tesouro Selic"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="investment-form-class" className="block text-xs font-semibold text-slate-700 mb-1">
                  Classe do Ativo
                </label>
                <select
                  id="investment-form-class"
                  value={assetClass}
                  onChange={(e) =>
                    setAssetClass(e.target.value as InvestmentAssetClass)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  <option value="renda_fixa_pos">Renda Fixa Pós (Selic / CDI)</option>
                  <option value="renda_fixa_ipca">Renda Fixa Inflação (IPCA+)</option>
                  <option value="fiis">Fundos Imobiliários (FIIs)</option>
                  <option value="acoes_br">Ações Brasil (B3)</option>
                  <option value="exterior_etf">Exterior & ETFs</option>
                </select>
              </div>

              <div>
                <label htmlFor="investment-form-institution" className="block text-xs font-semibold text-slate-700 mb-1">
                  Instituição / Corretora
                </label>
                <div className="flex min-w-0 items-center gap-2">
                  <InstitutionMark institution={institution} size="sm" />
                  <input
                    type="text"
                    id="investment-form-institution"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Ex: XP, BTG, Itaú, NuInvest"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="investment-form-quantity" className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantidade de Cotas / Títulos
                </label>
                <input
                  type="text"
                  id="investment-form-quantity"
                  value={quantityStr}
                  onChange={(e) => setQuantityStr(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="investment-form-average-price" className="block text-xs font-semibold text-slate-700 mb-1">
                  Preço Médio de Compra (R$)
                </label>
                <CurrencyInput
                  id="investment-form-average-price"
                  value={avgPriceStr}
                  currency="BRL"
                  onValueChange={setAvgPriceStr}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="investment-form-current-price" className="block text-xs font-semibold text-slate-700 mb-1">
                  Cotação / Valor Unitário Atual (R$)
                </label>
                <CurrencyInput
                  id="investment-form-current-price"
                  value={currPriceStr}
                  currency="BRL"
                  onValueChange={setCurrPriceStr}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="investment-form-yield" className="block text-xs font-semibold text-slate-700 mb-1">
                  Rendimento / Dividend Yield Mensal (%)
                </label>
                <input
                  type="text"
                  id="investment-form-yield"
                  value={yieldStr}
                  onChange={(e) => setYieldStr(e.target.value)}
                  placeholder="Ex: 0,85"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-center">
              <div>
                <label htmlFor="investment-form-indexer" className="block text-xs font-semibold text-slate-700 mb-1">
                  Indexador / Rentabilidade Contratada
                </label>
                <input
                  type="text"
                  id="investment-form-indexer"
                  value={indexerLabel}
                  onChange={(e) => setIndexerLabel(e.target.value)}
                  placeholder="Ex: 102% CDI, IPCA + 6,4%, DY 10% a.a."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="investment-form-liquidity" className="block text-xs font-semibold text-slate-700 mb-1">
                  Prazo de Liquidez (Resgate)
                </label>
                <select
                  id="investment-form-liquidity"
                  value={liquidity}
                  onChange={(e) =>
                    setLiquidity(e.target.value as InvestmentLiquidity)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  <option value="D+0 (Liquidez Diária)">D+0 (Liquidez Diária)</option>
                  <option value="D+1">D+1</option>
                  <option value="D+2 (Bolsa B3)">D+2 (Bolsa B3)</option>
                  <option value="No Vencimento">Somente no Vencimento</option>
                </select>
              </div>

              <div className="pt-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isTaxExempt}
                    onChange={(e) => setIsTaxExempt(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                  />
                  <span>Ativo Isento de Imposto de Renda (LCI/LCA/FII)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowAssetForm(false)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                {editingAsset ? 'Salvar Ativo' : 'Adicionar à Carteira'}
              </button>
            </div>
          </form>
        )}

        {/* Quick Operation Inline Panel (Buy / Sell / Quote / Dividend) */}
        {activeOperation && (
          <form
            data-testid="investment-operation-panel"
            onSubmit={handleConfirmOperation}
            className="border-b border-emerald-200 bg-emerald-50/80 px-4 sm:px-6 py-4 space-y-3 animate-expand-in"
          >
            {activeOperation.mode !== 'update_quote' && (
              <label className="block text-xs font-semibold text-slate-700 mb-3">
                Data da operação
                <input type="date" data-testid="investment-operation-date" value={operationDate} onChange={event=>setOperationDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
            )}

            {operationError && (
              <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {operationError}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-emerald-950">
                  {activeOperation.mode === 'buy'
                    ? `Registrar Novo Aporte / Compra — ${activeOperation.asset.ticker}`
                    : activeOperation.mode === 'sell'
                    ? `Registrar Resgate / Venda — ${activeOperation.asset.ticker}`
                    : activeOperation.mode === 'dividend'
                    ? `Creditar Dividendo / Provento no Caixa — ${activeOperation.asset.ticker}`
                    : `Atualizar Cotação de Mercado — ${activeOperation.asset.ticker}`}
                </h3>
                <p className="text-[11px] text-emerald-800">
                  {activeOperation.mode === 'buy'
                    ? 'O sistema recalcula automaticamente o seu Preço Médio Ponderado.'
                    : activeOperation.mode === 'sell'
                    ? 'O resgate reduz a quantidade mantendo o Preço Médio original (Regra da Receita Federal).'
                    : activeOperation.mode === 'dividend'
                    ? 'Lança o provento recebido diretamente como receita efetivada na sua conta bancária.'
                    : 'Atualiza o valor de mercado atual para refletir sua posição patrimonial.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveOperation(null)}
                className="text-xs font-semibold text-emerald-800 hover:underline"
              >
                Cancelar
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              {activeOperation.mode !== 'update_quote' &&
                activeOperation.mode !== 'dividend' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-950 mb-1">
                      Quantidade ({activeOperation.mode === 'buy' ? 'Comprada' : 'Vendida'}):
                    </label>
                    <input
                      type="text"
                      value={opQtyStr}
                      onChange={(e) => {
                        setOpQtyStr(e.target.value);
                        setOperationError('');
                      }}
                      className="w-28 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                    />
                  </div>
                )}

              <div>
                <label className="block text-[11px] font-semibold text-emerald-950 mb-1">
                  {activeOperation.mode === 'dividend'
                    ? 'Valor Total do Provento Recebido (R$):'
                    : 'Preço Unitário / Cotação (R$):'}
                </label>
                <div className="flex items-center gap-1.5">
                  <CurrencyInput
                    value={opPriceStr}
                    currency="BRL"
                    onValueChange={(value) => {
                      setOpPriceStr(value);
                      setOperationError('');
                    }}
                    className="w-36 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                  />
                  {activeOperation.mode !== 'dividend' &&
                    isMarketQuotedAsset(activeOperation.asset) && (
                      <button
                        type="button"
                        onClick={handleFetchQuoteForActiveOperation}
                        disabled={isLookingUpTicker}
                        title="Buscar cotação atual no Google Finance"
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-[11px] font-bold text-sky-900 hover:bg-sky-100 transition-colors disabled:opacity-60"
                      >
                        {isLookingUpTicker ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-700" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5 text-sky-700" />
                        )}
                        <span>Buscar Cotação</span>
                      </button>
                    )}
                </div>
              </div>

              {activeOperation.mode !== 'update_quote' && (
                <div>
                  <label className="block text-[11px] font-semibold text-emerald-950 mb-1">
                    {activeOperation.mode === 'buy'
                      ? 'Debitar Aporte da Conta:'
                      : 'Creditar Valor na Conta:'}
                  </label>
                  <select
                    value={opAccountId}
                    onChange={(e) => setOpAccountId(e.target.value)}
                    className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const selectedAccount = accounts.find((account) => account.id === opAccountId);
                    return selectedAccount ? (
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                        <InstitutionMark institution={selectedAccount.institution} accountName={selectedAccount.name} color={selectedAccount.color} size="xs" />
                        <span>Conta selecionada: {selectedAccount.name}</span>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {activeOperation.mode !== 'update_quote' &&
                activeOperation.mode !== 'dividend' && (
                  <label className="flex items-center gap-1.5 text-xs font-medium text-emerald-950 pb-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={opLinkBankAccount}
                      onChange={(e) => setOpLinkBankAccount(e.target.checked)}
                      className="h-4 w-4 rounded border-emerald-300 text-emerald-600"
                    />
                    <span>Registrar no extrato da conta</span>
                  </label>
                )}

              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors ml-auto"
              >
                Confirmar Operação
              </button>
            </div>
          </form>
        )}

        {/* Mobile Cards (< sm) */}
        <div className="block sm:hidden divide-y divide-slate-100">
          {filteredPositions.map((pos) => {
            const { asset } = pos;
            const meta = INVESTMENT_CLASS_META[asset.assetClass];
            return (
              <div key={asset.id} className="p-4 space-y-2.5 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="text-xs font-extrabold font-mono text-slate-900">
                        {asset.ticker}
                      </span>
                      {asset.isTaxExempt && (
                        <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                          Isento IR
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-700 mt-0.5">
                      {asset.name}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <InstitutionMark institution={asset.institution} size="xs" />
                      {asset.institution} · {asset.indexerLabel}
                    </p>
                  </div>

                  <div className="text-right shrink-0 font-mono tabular-nums">
                    <p className="text-sm font-extrabold text-slate-900">
                      {formatBRL(pos.currentValue)}
                    </p>
                    <p
                      className={`text-[11px] font-bold ${
                        pos.capitalGain >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {pos.capitalGain >= 0 ? '+' : ''}
                      {formatBRL(pos.capitalGain)} ({pos.profitabilityPercent}%)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2 text-[11px] font-mono tabular-nums">
                  <div>
                    <span className="text-slate-400 block">Qtd / PM</span>
                    <span className="text-slate-800 font-semibold">
                      {asset.quantity} × {formatBRL(asset.averagePrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Cotação</span>
                    <span className="text-slate-800 font-semibold">
                      {formatBRL(asset.currentPrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Renda/Mês</span>
                    <span className="text-emerald-700 font-bold">
                      +{formatBRL(pos.estimatedMonthlyIncome)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openOperationModal(asset, 'buy')}
                      className="rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11px] font-semibold text-blue-800"
                    >
                      + Aportar
                    </button>
                    <button
                      type="button"
                      onClick={() => openOperationModal(asset, 'sell')}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                    >
                      Resgatar
                    </button>
                    <button
                      type="button"
                      onClick={() => openOperationModal(asset, 'dividend')}
                      className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900"
                    >
                      + Dividendo
                    </button>
                    {isMarketQuotedAsset(asset) && (
                      <button
                        type="button"
                        onClick={() => handleSyncPortfolioWithGoogleFinance([asset])}
                        disabled={isSyncingGoogleFinance}
                        className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-900 disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${
                            isSyncingGoogleFinance ? 'animate-spin' : ''
                          }`}
                        />
                        <span>Cotação</span>
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditAssetForm(asset)}
                    className="text-[11px] font-medium text-slate-500 underline"
                  >
                    Editar
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Table (>= sm) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-500">
                <th className="py-3 pl-6 pr-3">Ativo & Indexador</th>
                <th className="py-3 px-3 whitespace-nowrap">Classe & Liquidez</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Qtd · Preço Médio</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Cotação Atual</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Saldo Bruto</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Rentabilidade</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Renda Passiva/Mês</th>
                <th className="py-3 pl-3 pr-6 text-right whitespace-nowrap">Operações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredPositions.map((pos) => {
                const { asset } = pos;
                const meta = INVESTMENT_CLASS_META[asset.assetClass];

                return (
                  <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 pl-6 pr-3">
                      <div className="flex items-start gap-2.5">
                        <span
                          className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">
                              {asset.ticker}
                            </span>
                            {asset.isTaxExempt && (
                              <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                Isento IR
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-700">{asset.name}</p>
                          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                            <InstitutionMark institution={asset.institution} size="xs" />
                            {asset.institution} · {asset.indexerLabel}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-xs whitespace-nowrap">
                      <p className="font-semibold text-slate-800">{meta.shortLabel}</p>
                      <p className="text-[11px] text-slate-500">{asset.liquidity}</p>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                      <div>
                        <strong>{asset.quantity}</strong> un.
                      </div>
                      <div className="text-[11px] text-slate-500">
                        PM: {formatBRL(asset.averagePrice)}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs font-semibold text-slate-900 whitespace-nowrap">
                      <div className="flex flex-col items-end gap-0.5">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openOperationModal(asset, 'update_quote')}
                            title="Clique para editar cotação manualmente"
                            className="hover:underline inline-flex items-center gap-1"
                          >
                            <span>{formatBRL(asset.currentPrice)}</span>
                          </button>
                          {isMarketQuotedAsset(asset) && (
                            <button
                              type="button"
                              onClick={() => handleSyncPortfolioWithGoogleFinance([asset])}
                              disabled={isSyncingGoogleFinance}
                              title={`Sincronizar ${asset.ticker} com o Google Finance`}
                              className="rounded p-1 text-sky-600 hover:bg-sky-50 transition-colors"
                            >
                              <RefreshCw
                                className={`h-3 w-3 ${
                                  isSyncingGoogleFinance ? 'animate-spin' : ''
                                }`}
                              />
                            </button>
                          )}
                        </div>
                        {typeof asset.dailyChangePercent === 'number' && (
                          <span
                            className={`text-[10px] font-bold ${
                              asset.dailyChangePercent >= 0
                                ? 'text-emerald-600'
                                : 'text-rose-600'
                            }`}
                          >
                            Hoje: {asset.dailyChangePercent >= 0 ? '+' : ''}
                            {asset.dailyChangePercent}%
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="font-bold text-slate-900">
                        {formatBRL(pos.currentValue)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {pos.portfolioSharePercent}% da carteira
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div
                        className={`font-bold text-xs ${
                          pos.capitalGain >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {pos.capitalGain >= 0 ? '+' : ''}
                        {formatBRL(pos.capitalGain)}
                      </div>
                      <div
                        className={`text-[11px] font-semibold ${
                          pos.profitabilityPercent >= 0
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {pos.profitabilityPercent >= 0 ? '+' : ''}
                        {pos.profitabilityPercent}%
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="font-bold text-emerald-700 text-xs">
                        +{formatBRL(pos.estimatedMonthlyIncome)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {asset.monthlyYieldPercent}% a.m.
                      </div>
                    </td>

                    <td className="py-3.5 pl-3 pr-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openOperationModal(asset, 'buy')}
                          title="Registrar novo aporte / compra"
                          className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100"
                        >
                          + Aportar
                        </button>
                        <button
                          type="button"
                          onClick={() => openOperationModal(asset, 'sell')}
                          title="Registrar resgate / venda"
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Resgatar
                        </button>
                        <button
                          type="button"
                          onClick={() => openOperationModal(asset, 'dividend')}
                          title="Lançar dividendo/provento recebido na conta corrente"
                          className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          $ Provento
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditAssetForm(asset)}
                          aria-label={`Editar ${asset.ticker}`}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteAsset(asset.id)}
                          aria-label={`Excluir ${asset.ticker}`}
                          className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Row 4: Monthly Dividend & Passive Income History Map (#5) */}
      <section
        data-testid="dividend-history-section"
        className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4 shadow-2xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Histórico de Proventos & Dividendos no Extrato ({formatMonthYearPT(selectedMonth)})
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhe dividendos de FIIs, JCP e rendimentos recebidos ou previstos. Cada lançamento indica se já foi creditado.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-right">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                No Mês ({selectedMonth})
              </span>
              <span className="font-mono tabular-nums text-xs sm:text-sm font-extrabold text-emerald-800">
                +{formatBRL(monthDividendsTotal)}
              </span>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-right">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Registrado
              </span>
              <span className="font-mono tabular-nums text-xs sm:text-sm font-bold text-slate-900">
                {formatBRL(allTimeDividendsTotal)}
              </span>
            </div>
          </div>
        </div>

        {monthDividendTransactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
            <p className="text-xs font-semibold text-slate-700">
              Nenhum dividendo ou provento registrado no extrato em {formatMonthYearPT(selectedMonth)}.
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Use o botão <strong>+ Dividendo / $ Provento</strong> em qualquer ativo acima para creditar os proventos recebidos na sua conta.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {monthDividendTransactions.map((tx) => {
              const accName =
                accounts.find((a) => a.id === tx.accountId)?.name || 'Conta Corrente';
              return (
                <div
                  key={tx.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {tx.description}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {formatShortDateBR(tx.date)} · {accName} ·{' '}
                      {tx.status === 'paid' ? 'Creditado' : 'Previsto'}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums text-sm font-extrabold text-emerald-700 shrink-0">
                    +{formatBRL(tx.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
