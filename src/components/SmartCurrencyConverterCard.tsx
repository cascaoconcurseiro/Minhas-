import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  Calculator,
  Check,
  Coins,
  Copy,
  ExternalLink,
  Globe,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { CurrencyCode, TripExchangeLot } from '../types/finance';
import { formatBRL, parseBRLInput } from '../utils/financeRules';
import {
  compareLiveRateWithTripVet,
  convertSmartCurrency,
  CURRENCY_CATALOG,
  formatExchangeRateBR,
  formatForeignCurrency,
  getLatestExchangeRateInfo,
  LatestExchangeRateInfo,
} from '../utils/travelRules';

const FOREIGN_CURRENCIES: CurrencyCode[] = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CAD',
  'ARS',
  'CLP',
  'JPY',
];

const QUICK_AMOUNT_PRESETS = [10, 50, 100, 500, 1000];

export interface LiveFxQuoteResponse {
  currency: CurrencyCode;
  targetCurrency: 'BRL';
  commercialRateBrl: number;
  summaryText: string;
  fetchedAt: string;
  sources: { uri: string; title: string }[];
}

interface SmartCurrencyConverterCardProps {
  exchangeLots: TripExchangeLot[];
  currency: CurrencyCode;
  defaultExchangeRate: number;
  remainingForeignBalance?: number;
  privacyMode?: boolean;
  allowCurrencyChange?: boolean;
  onUseConvertedValue?: (valBrl: number, valForeign: number) => void;
  onApplyLiveRateToTrip?: (liveRate: number, currency: CurrencyCode) => void;
}

export const SmartCurrencyConverterCard: React.FC<
  SmartCurrencyConverterCardProps
> = ({
  exchangeLots,
  currency,
  defaultExchangeRate,
  remainingForeignBalance = 0,
  privacyMode = false,
  allowCurrencyChange = false,
  onUseConvertedValue,
  onApplyLiveRateToTrip,
}) => {
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(
    currency === 'BRL' ? 'EUR' : currency
  );

  useEffect(() => {
    if (currency && currency !== 'BRL') {
      setSelectedCurrency(currency);
    }
  }, [currency]);

  const effectiveCurrency: CurrencyCode = allowCurrencyChange
    ? selectedCurrency
    : currency;

  const latestRateInfo: LatestExchangeRateInfo = useMemo(() => {
    const fallback =
      effectiveCurrency === currency && defaultExchangeRate > 0
        ? defaultExchangeRate
        : CURRENCY_CATALOG[effectiveCurrency]?.defaultCommercialRateBrl || 1;
    const lotsForCurrency = exchangeLots.filter(
      (lot) => !lot.currency || lot.currency === effectiveCurrency
    );
    return getLatestExchangeRateInfo(lotsForCurrency, fallback);
  }, [exchangeLots, defaultExchangeRate, effectiveCurrency, currency]);

  const [direction, setDirection] = useState<'foreign_to_brl' | 'brl_to_foreign'>(
    'foreign_to_brl'
  );
  const [inputAmountStr, setInputAmountStr] = useState('100');
  const [rateMode, setRateMode] = useState<'live_google' | 'trip_lot' | 'manual'>(
    'trip_lot'
  );
  const [customRateStr, setCustomRateStr] = useState('');
  const [hasCopied, setHasCopied] = useState(false);

  // Real-Time Google Search Quote State
  const [liveQuote, setLiveQuote] = useState<LiveFxQuoteResponse | null>(null);
  const [isFetchingLiveRate, setIsFetchingLiveRate] = useState(false);
  const [liveRateError, setLiveRateError] = useState<string | null>(null);

  const handleFetchLiveRate = async (targetCurr: CurrencyCode = effectiveCurrency) => {
    if (targetCurr === 'BRL') return;
    setIsFetchingLiveRate(true);
    setLiveRateError(null);
    try {
      const response = await fetch('/api/fx/live-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: targetCurr }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(
          data.error || 'Não foi possível consultar a cotação em tempo real.'
        );
      }
      setLiveQuote(data as LiveFxQuoteResponse);
      setRateMode('live_google');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Falha ao consultar cotação em tempo real no Google Search.';
      setLiveRateError(msg);
    } finally {
      setIsFetchingLiveRate(false);
    }
  };

  const activeRate = useMemo(() => {
    if (rateMode === 'live_google' && liveQuote && liveQuote.currency === effectiveCurrency) {
      return liveQuote.commercialRateBrl;
    }
    if (rateMode === 'manual') {
      const parsed = parseBRLInput(customRateStr);
      if (parsed > 0) return parsed;
    }
    return latestRateInfo.rate;
  }, [rateMode, liveQuote, effectiveCurrency, customRateStr, latestRateInfo.rate]);

  const convertedResult = useMemo(() => {
    const rawAmt = parseBRLInput(inputAmountStr) || 0;
    return convertSmartCurrency({
      amount: rawAmt,
      direction,
      rate: activeRate,
    });
  }, [inputAmountStr, direction, activeRate]);

  const liveComparison = useMemo(() => {
    if (
      !liveQuote ||
      liveQuote.currency !== effectiveCurrency ||
      exchangeLots.length === 0
    ) {
      return null;
    }
    return compareLiveRateWithTripVet(
      liveQuote.commercialRateBrl,
      latestRateInfo.rate,
      1.1
    );
  }, [liveQuote, effectiveCurrency, exchangeLots.length, latestRateInfo.rate]);

  const handleToggleDirection = () => {
    setDirection((prev) =>
      prev === 'foreign_to_brl' ? 'brl_to_foreign' : 'foreign_to_brl'
    );
    if (direction === 'foreign_to_brl') {
      setInputAmountStr(String(convertedResult.brlAmount));
    } else {
      setInputAmountStr(String(convertedResult.foreignAmount));
    }
  };

  const handleCopyResult = () => {
    const textToCopy =
      direction === 'foreign_to_brl'
        ? formatBRL(convertedResult.brlAmount)
        : formatForeignCurrency(convertedResult.foreignAmount, effectiveCurrency);
    navigator.clipboard?.writeText(textToCopy);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  const meta = CURRENCY_CATALOG[effectiveCurrency] || CURRENCY_CATALOG.EUR;
  const mask = (v: string) => (privacyMode ? '••••••' : v);

  const leftoverReconversionBrl = useMemo(() => {
    if (remainingForeignBalance <= 0) return 0;
    return Math.round(remainingForeignBalance * activeRate * 100) / 100;
  }, [remainingForeignBalance, activeRate]);

  return (
    <div
      data-testid="quick-currency-converter-card"
      className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-4"
    >
      {/* Header with Real-Time Google Search CTA */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <Calculator className="h-4 w-4" />
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
              Conversão Rápida ({effectiveCurrency} ⇄ BRL) & Cotação em Tempo Real
            </h3>
            <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800">
              <Globe className="h-3 w-3" />
              Google Search em Tempo Real
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Consulte a taxa de câmbio comercial agora via Google Search ou converta usando o câmbio registrado nos seus lotes da viagem.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {allowCurrencyChange && (
            <select
              data-testid="quick-converter-currency-select"
              aria-label="Selecionar moeda estrangeira para conversão"
              value={effectiveCurrency}
              onChange={(e) => {
                const next = e.target.value as CurrencyCode;
                setSelectedCurrency(next);
                setLiveRateError(null);
              }}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
            >
              {FOREIGN_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {CURRENCY_CATALOG[code].flag} {code} — {CURRENCY_CATALOG[code].name}
                </option>
              ))}
            </select>
          )}

          {effectiveCurrency !== 'BRL' && (
            <button
              type="button"
              data-testid="fetch-live-fx-rate-btn"
              disabled={isFetchingLiveRate}
              onClick={() => handleFetchLiveRate(effectiveCurrency)}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-60 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-colors"
            >
              {isFetchingLiveRate ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Buscando no Google...</span>
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  <span>
                    {liveQuote && liveQuote.currency === effectiveCurrency
                      ? `Atualizar Cotação (${effectiveCurrency} → BRL)`
                      : `Buscar Cotação Atual (${effectiveCurrency} → BRL)`}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Live Google Search Result Banner */}
      {liveRateError && (
        <div
          data-testid="live-fx-rate-error"
          className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/80 dark:bg-rose-950/40 p-3 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200"
        >
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Não foi possível obter a cotação em tempo real</p>
            <p>{liveRateError}</p>
          </div>
        </div>
      )}

      {liveQuote && liveQuote.currency === effectiveCurrency && (
        <div
          data-testid="live-fx-rate-result-banner"
          className="rounded-xl border border-sky-200 dark:border-sky-800/80 bg-sky-50/70 dark:bg-sky-950/30 p-3.5 space-y-2.5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-extrabold font-mono text-white">
                1 {effectiveCurrency} = {formatExchangeRateBR(liveQuote.commercialRateBrl)}
              </span>
              <span className="text-[11px] font-semibold text-sky-900 dark:text-sky-200">
                Câmbio Comercial em Tempo Real •{' '}
                {new Date(liveQuote.fetchedAt).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                (Est. Wise/Nomad c/ 1,1% IOF:{' '}
                <strong>
                  {formatExchangeRateBR(
                    Math.round(liveQuote.commercialRateBrl * 1.011 * 10000) / 10000
                  )}
                </strong>
                )
              </span>
            </div>

            {onApplyLiveRateToTrip && (
              <button
                type="button"
                data-testid="apply-live-rate-to-trip-btn"
                onClick={() =>
                  onApplyLiveRateToTrip(liveQuote.commercialRateBrl, effectiveCurrency)
                }
                className="inline-flex items-center gap-1 rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-sky-800 dark:text-sky-200 hover:bg-sky-100 transition-colors self-start sm:self-auto"
              >
                <Sparkles className="h-3 w-3 text-sky-600" />
                <span>Usar como Referência da Viagem</span>
              </button>
            )}
          </div>

          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
            {liveQuote.summaryText}
          </p>

          {liveComparison && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              {liveComparison.isTripLotCheaper ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-emerald-800 dark:text-emerald-300">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Seu câmbio na viagem ({formatExchangeRateBR(liveComparison.tripVetRate)}) está{' '}
                  {Math.abs(liveComparison.diffPercent)}% mais barato que comprar hoje c/ IOF!
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 text-amber-900 dark:text-amber-300">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Cotação de hoje c/ 1,1% IOF ({formatExchangeRateBR(liveComparison.liveEstimatedWiseVet)}) está{' '}
                  {Math.abs(liveComparison.diffPercent)}% abaixo do seu último lote ({formatExchangeRateBR(liveComparison.tripVetRate)}).
                </span>
              )}
            </div>
          )}

          {liveQuote.sources && liveQuote.sources.length > 0 && (
            <div className="pt-2 border-t border-sky-200/60 dark:border-sky-800/60 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-bold text-slate-500 dark:text-slate-400">
                Fontes Google Search:
              </span>
              {liveQuote.sources.slice(0, 4).map((src, idx) => (
                <a
                  key={`${src.uri}-${idx}`}
                  href={src.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 px-2 py-0.5 text-sky-700 dark:text-sky-300 hover:underline max-w-[240px] truncate"
                >
                  <span className="truncate">{src.title}</span>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rate Source Selector Pills + Active Rate Readout */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-500 mr-1">
            Taxa usada na conversão:
          </span>

          {liveQuote && liveQuote.currency === effectiveCurrency && (
            <button
              type="button"
              data-testid="rate-mode-live-google-btn"
              onClick={() => setRateMode('live_google')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                rateMode === 'live_google'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Google Search ({formatExchangeRateBR(liveQuote.commercialRateBrl)})
            </button>
          )}

          <button
            type="button"
            data-testid="rate-mode-trip-lot-btn"
            onClick={() => setRateMode('trip_lot')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
              rateMode === 'trip_lot'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {latestRateInfo.sourceType === 'latest_lot'
              ? `Último Lote (${formatExchangeRateBR(latestRateInfo.rate)})`
              : `Referência (${formatExchangeRateBR(latestRateInfo.rate)})`}
          </button>

          <button
            type="button"
            data-testid="rate-mode-manual-btn"
            onClick={() => {
              setRateMode('manual');
              if (!customRateStr) {
                setCustomRateStr(activeRate.toFixed(4).replace('.', ','));
              }
            }}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
              rateMode === 'manual'
                ? 'bg-slate-900 text-white dark:bg-slate-700 shadow-2xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            Manual
          </button>

          {rateMode === 'manual' && (
            <div className="inline-flex items-center gap-1 ml-1">
              <span className="text-[11px] font-bold text-slate-400">R$</span>
              <input
                type="text"
                data-testid="quick-converter-manual-rate-input"
                value={customRateStr}
                onChange={(e) => setCustomRateStr(e.target.value)}
                placeholder="0,0000"
                className="w-24 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>
          )}
        </div>

        <div className="text-right font-mono">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Cotação Aplicada
          </span>
          <span
            data-testid="quick-converter-active-rate"
            className="text-xs sm:text-sm font-extrabold text-emerald-700 dark:text-emerald-400"
          >
            1 {effectiveCurrency} = {formatExchangeRateBR(activeRate)}
          </span>
        </div>
      </div>

      {/* Interactive Bidirectional Converter Form */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Source Input */}
        <div className="md:col-span-5 space-y-1.5">
          <label className="block text-[11px] font-bold uppercase text-slate-500">
            {direction === 'foreign_to_brl'
              ? `Valor em ${meta.name} (${effectiveCurrency})`
              : 'Valor em Reais (BRL)'}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-slate-400">
              {direction === 'foreign_to_brl' ? meta.symbol : 'R$'}
            </span>
            <input
              type="text"
              data-testid="quick-converter-amount-input"
              value={inputAmountStr}
              onChange={(e) => setInputAmountStr(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-11 pr-3 py-2.5 text-base font-extrabold font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Quick Amount Presets */}
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {QUICK_AMOUNT_PRESETS.map((presetVal) => (
              <button
                key={presetVal}
                type="button"
                onClick={() => setInputAmountStr(String(presetVal))}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors"
              >
                {direction === 'foreign_to_brl'
                  ? `${meta.symbol} ${presetVal}`
                  : `R$ ${presetVal}`}
              </button>
            ))}
          </div>
        </div>

        {/* Direction Switcher Button */}
        <div className="md:col-span-2 flex justify-center py-1">
          <button
            type="button"
            data-testid="quick-converter-swap-btn"
            onClick={handleToggleDirection}
            title="Inverter direção da conversão"
            aria-label="Inverter direção da conversão de moeda"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 p-2.5 text-slate-700 dark:text-slate-200 shadow-2xs transition-transform active:scale-95"
          >
            <ArrowLeftRight className="h-4 w-4 text-emerald-600" />
            <span className="md:hidden text-xs font-bold">Inverter</span>
          </button>
        </div>

        {/* Converted Output Display */}
        <div className="md:col-span-5 space-y-1.5">
          <label className="block text-[11px] font-bold uppercase text-slate-500">
            {direction === 'foreign_to_brl'
              ? 'Equivalente em Reais (BRL)'
              : `Equivalente em ${meta.name} (${effectiveCurrency})`}
          </label>
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 px-3.5 py-2.5">
            <span
              data-testid="quick-converter-result-value"
              className="text-base font-extrabold font-mono text-emerald-900 dark:text-emerald-200 truncate"
            >
              {direction === 'foreign_to_brl'
                ? mask(formatBRL(convertedResult.brlAmount))
                : mask(
                    formatForeignCurrency(
                      convertedResult.foreignAmount,
                      effectiveCurrency
                    )
                  )}
            </span>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                type="button"
                onClick={handleCopyResult}
                title="Copiar valor convertido"
                className="rounded-lg p-1 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
              >
                {hasCopied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
              {onUseConvertedValue && (
                <button
                  type="button"
                  onClick={() =>
                    onUseConvertedValue(
                      convertedResult.brlAmount,
                      convertedResult.foreignAmount
                    )
                  }
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition-colors"
                >
                  Lançar Gasto
                </button>
              )}
            </div>
          </div>
          <span className="block text-[10px] text-slate-400">
            {direction === 'foreign_to_brl'
              ? `${formatForeignCurrency(convertedResult.foreignAmount, effectiveCurrency)} × ${formatExchangeRateBR(activeRate)}`
              : `${formatBRL(convertedResult.brlAmount)} ÷ ${formatExchangeRateBR(activeRate)}`}
          </span>
        </div>
      </div>

      {/* Leftover Reconversion Insight */}
      {remainingForeignBalance > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            <Coins className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>
              <strong>Saldo restante na moeda:</strong>{' '}
              <strong className="font-mono">
                {formatForeignCurrency(remainingForeignBalance, effectiveCurrency)}
              </strong>{' '}
              equivale a ≈{' '}
              <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                {mask(formatBRL(leftoverReconversionBrl))}
              </strong>{' '}
              nesta cotação.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
