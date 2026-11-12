import React from 'react';
import {
  Calendar,
  CheckCircle2,
  Coins,
  FileDown,
  Globe,
  Printer,
  Receipt,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  Category,
  Transaction,
  Trip,
  TripDashboardSummary,
} from '../types/finance';
import { formatBRL, formatShortDateBR } from '../utils/financeRules';
import {
  calculateExchangeSavingsAnalysis,
  CURRENCY_CATALOG,
  CURRENCY_REGIME_DEFAULTS,
  formatExchangeRateBR,
  formatForeignCurrency,
} from '../utils/travelRules';

interface TripPdfReportModalProps {
  trip: Trip;
  summary: TripDashboardSummary;
  transactions: Transaction[];
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
}

export const TripPdfReportModal: React.FC<TripPdfReportModalProps> = ({
  trip,
  summary,
  transactions,
  categories,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const currencyMeta = CURRENCY_CATALOG[trip.currency] || CURRENCY_CATALOG.USD;
  const savingsAnalysis = calculateExchangeSavingsAnalysis(
    trip.exchangeLots,
    trip.currency,
    trip.defaultExchangeRate
  );

  const tripExpenses = transactions
    .filter(
      (tx) => tx.tripId === trip.id && tx.type === 'expense' && !tx.isInvoicePayment
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const { generateAndDownloadTripPdf } = await import('../utils/tripPdfGenerator');
    generateAndDownloadTripPdf({
      trip,
      summary,
      transactions,
      categories,
    });
  };

  return (
    <div
      id="printable-trip-report-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-3 sm:p-6 overflow-hidden modal-shell"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden modal-shell">
        {/* Modal Top Bar (Hidden in Print) */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
              Relatório Financeiro & Extrato da Viagem (PDF / Impressão)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="download-pdf-btn"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-2xs"
              title="Baixar arquivo PDF diretamente (.pdf)"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Baixar Arquivo PDF (.pdf)</span>
            </button>
            <button
              type="button"
              data-testid="print-action-btn"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir / Visualizar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar relatório"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div
          id="printable-trip-report"
          className="flex-1 overflow-y-auto overscroll-contain touch-pan-y modal-form-scroll custom-scrollbar p-5 sm:p-8 space-y-6 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900"
        >
          {/* Header Title Section */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-md bg-emerald-700 text-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                  Minhas Economias BR — Relatório Financeiro
                </span>
                <span className="text-xs text-slate-500">
                  Gerado em {new Date().toLocaleDateString('pt-BR')}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold font-display text-slate-900">
                {trip.name}
              </h1>
              <p className="text-sm text-slate-600 mt-0.5 flex items-center gap-2">
                <span>📍 {trip.destination}</span>
                <span>•</span>
                <span>
                  🗓️ {formatShortDateBR(trip.startDate)} a{' '}
                  {formatShortDateBR(trip.endDate)} ({summary.totalDays} dias)
                </span>
              </p>
            </div>

            <div className="text-left sm:text-right text-xs">
              <span className="block font-bold text-slate-500">Moeda Base:</span>
              <span className="font-extrabold text-base text-slate-900 font-mono">
                {currencyMeta.flag} {trip.currency} ({currencyMeta.symbol})
              </span>
              <span className="block text-slate-500 font-mono text-[11px]">
                VET Médio: {formatExchangeRateBR(summary.weightedAverageRate)}
              </span>
            </div>
          </div>

          {/* KPI Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-300 p-3 bg-slate-50">
              <span className="block text-[10px] font-bold uppercase text-slate-500">
                Gasto Total (Grupo)
              </span>
              <span className="block text-base font-extrabold font-mono text-slate-900 mt-1">
                {formatForeignCurrency(summary.groupTotalSpendForeign, trip.currency)}
              </span>
              <span className="text-[11px] text-slate-600 font-mono">
                ≈ {formatBRL(summary.groupTotalSpendBrl)}
              </span>
            </div>

            <div className="rounded-xl border border-emerald-300 p-3 bg-emerald-50">
              <span className="block text-[10px] font-bold uppercase text-emerald-800">
                Minha Parte Real
              </span>
              <span className="block text-base font-extrabold font-mono text-emerald-900 mt-1">
                {formatForeignCurrency(summary.myPersonalSpendForeign, trip.currency)}
              </span>
              <span className="text-[11px] text-emerald-800 font-mono">
                ≈ {formatBRL(summary.myPersonalSpendBrl)}
              </span>
            </div>

            <div className="rounded-xl border border-slate-300 p-3 bg-slate-50">
              <span className="block text-[10px] font-bold uppercase text-slate-500">
                Meta de Orçamento
              </span>
              <span className="block text-base font-extrabold font-mono text-slate-900 mt-1">
                {formatForeignCurrency(summary.budgetForeign, trip.currency)}
              </span>
              <span className="text-[11px] text-slate-600 font-mono">
                {summary.budgetUsedPercent}% utilizado
              </span>
            </div>

            <div className="rounded-xl border border-sky-300 p-3 bg-sky-50">
              <span className="block text-[10px] font-bold uppercase text-sky-800">
                Economia Cambial Total
              </span>
              <span className="block text-base font-extrabold font-mono text-sky-900 mt-1">
                {savingsAnalysis.totalSavingsBrl >= 0 ? '+' : ''}
                {formatBRL(savingsAnalysis.totalSavingsBrl)}
              </span>
              <span className="text-[11px] text-sky-800 font-mono">
                vs Taxa Comercial ({formatExchangeRateBR(savingsAnalysis.benchmarkRateUsed)})
              </span>
            </div>
          </div>

          {/* Section 1: Exchange Lots & Savings vs Commercial Benchmark */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-1.5 border-b border-slate-200 flex items-center justify-between">
              <span>1. Lotes de Câmbio Registrados & Economia Realizada</span>
              <span className="font-mono text-[11px] text-slate-500">
                {savingsAnalysis.lotCount} lotes • Total Comprado:{' '}
                {formatForeignCurrency(
                  savingsAnalysis.totalForeignPurchased,
                  trip.currency
                )}
              </span>
            </h2>

            {savingsAnalysis.lotCount === 0 ? (
              <p className="text-xs text-slate-400 py-3">
                Nenhum lote registrado. Câmbio padrão:{' '}
                {formatExchangeRateBR(trip.defaultExchangeRate)}.
              </p>
            ) : (
              <table className="w-full text-left text-xs mt-2 border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-500 text-[10px] font-bold uppercase">
                    <th className="py-1.5">Lote / Fonte</th>
                    <th className="py-1.5">Data</th>
                    <th className="py-1.5 text-right">Volume ({trip.currency})</th>
                    <th className="py-1.5 text-right">VET Pago</th>
                    <th className="py-1.5 text-right">Custo Total (R$)</th>
                    <th className="py-1.5 text-right">Taxa Comercial</th>
                    <th className="py-1.5 text-right">Economia Realizada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {savingsAnalysis.lotSeries.map((lot) => (
                    <tr key={lot.id} className="hover:bg-slate-50">
                      <td className="py-2 font-semibold text-slate-900">
                        {lot.sourceLabel}
                      </td>
                      <td className="py-2 text-slate-500">
                        {formatShortDateBR(lot.date)}
                      </td>
                      <td className="py-2 text-right font-mono font-bold">
                        {formatForeignCurrency(lot.foreignAmount, trip.currency)}
                      </td>
                      <td className="py-2 text-right font-mono font-bold text-sky-700">
                        {formatExchangeRateBR(lot.effectiveRate)}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {formatBRL(lot.totalBrlPaid)}
                      </td>
                      <td className="py-2 text-right font-mono text-slate-500">
                        {formatExchangeRateBR(lot.benchmarkRate)}
                      </td>
                      <td
                        className={`py-2 text-right font-mono font-bold ${
                          lot.isEconomy ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {lot.savingsTotalBrl >= 0 ? '+' : ''}
                        {formatBRL(lot.savingsTotalBrl)} ({lot.savingsPercent}%)
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-300 font-bold bg-slate-50">
                    <td colSpan={2} className="py-2 text-slate-900">
                      Totais & Médias Ponderadas
                    </td>
                    <td className="py-2 text-right font-mono">
                      {formatForeignCurrency(
                        savingsAnalysis.totalForeignPurchased,
                        trip.currency
                      )}
                    </td>
                    <td className="py-2 text-right font-mono text-sky-800">
                      {formatExchangeRateBR(summary.weightedAverageRate)}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {formatBRL(savingsAnalysis.totalBrlPaid)}
                    </td>
                    <td className="py-2 text-right font-mono text-slate-500">
                      {formatExchangeRateBR(savingsAnalysis.benchmarkRateUsed)}
                    </td>
                    <td className="py-2 text-right font-mono text-emerald-800">
                      {savingsAnalysis.totalSavingsBrl >= 0 ? '+' : ''}
                      {formatBRL(savingsAnalysis.totalSavingsBrl)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Section 2: Group Balances & Debt Settlement (Splitwise) */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-1.5 border-b border-slate-200 flex items-center justify-between">
              <span>2. Balanço do Grupo & Acertos (Splitwise)</span>
              <span className="font-mono text-[11px] text-slate-500">
                {trip.participants.length} participantes
              </span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div>
                <h3 className="text-[11px] font-bold text-slate-600 mb-1">
                  Saldo Individual dos Participantes:
                </h3>
                <div className="space-y-1.5">
                  {summary.participantBalances.map((pb) => (
                    <div
                      key={pb.participantId}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs border border-slate-200"
                    >
                      <span className="font-bold text-slate-800">
                        {pb.participantName}
                      </span>
                      <div className="text-right font-mono">
                        <span
                          className={`font-bold ${
                            pb.netBalanceForeign > 0.01
                              ? 'text-emerald-700'
                              : pb.netBalanceForeign < -0.01
                              ? 'text-rose-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {pb.netBalanceForeign > 0.01 ? '+' : ''}
                          {formatForeignCurrency(pb.netBalanceForeign, trip.currency)}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1.5">
                          ({formatBRL(pb.netBalanceBrl)})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-bold text-slate-600 mb-1">
                  Acertos Pendentes de Compensação:
                </h3>
                {summary.simplifiedDebts.length === 0 ? (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center text-xs text-emerald-800 font-semibold">
                    ✓ Todos os acertos estão quitados sem pendências.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {summary.simplifiedDebts.map((d, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs border border-slate-200"
                      >
                        <span className="font-medium text-slate-800">
                          <strong>{d.fromName}</strong> deve para{' '}
                          <strong>{d.toName}</strong>
                        </span>
                        <div className="text-right font-mono font-bold text-slate-900">
                          {formatForeignCurrency(d.amountForeign, trip.currency)}
                          <span className="text-[10px] text-slate-500 block">
                            ≈ {formatBRL(d.amountBrlEffective)} (VET{' '}
                            {formatExchangeRateBR(d.impliedEffectiveRate)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Full Expense History with Dual Currency */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-1.5 border-b border-slate-200 flex items-center justify-between">
              <span>3. Histórico Detalhado de Gastos ({tripExpenses.length} lançamentos)</span>
              <span className="font-mono text-[11px] text-slate-500">
                Moeda Original + Conversão Efetiva em R$
              </span>
            </h2>

            {tripExpenses.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">
                Nenhum lançamento registrado nesta viagem.
              </p>
            ) : (
              <table className="w-full text-left text-xs mt-2 border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-500 text-[10px] font-bold uppercase">
                    <th className="py-1.5">Data</th>
                    <th className="py-1.5">Descrição</th>
                    <th className="py-1.5">Regime / Pagador</th>
                    <th className="py-1.5 text-right">Valor Original</th>
                    <th className="py-1.5 text-right">Valor em R$</th>
                    <th className="py-1.5 text-right">Sua Parte Real</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tripExpenses.map((tx) => {
                    const payer =
                      trip.participants.find(
                        (p) => p.id === (tx.paidByParticipantId || 'me')
                      ) || trip.participants[0];
                    const txCurr = tx.originalCurrency || trip.currency;
                    const txForeign = tx.originalAmount || tx.amount;
                    const myForeign =
                      tx.myPersonalShareForeign ??
                      tx.tripShares?.find((s) => s.participantId === 'me')
                        ?.foreignShare ??
                      txForeign;
                    const myBrl =
                      tx.myPersonalShareBrl ??
                      tx.tripShares?.find((s) => s.participantId === 'me')
                        ?.brlShare ??
                      tx.amount;
                    const regime = tx.currencyRegime
                      ? CURRENCY_REGIME_DEFAULTS[tx.currencyRegime]?.shortLabel
                      : 'Padrão';

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="py-2 text-slate-500">
                          {formatShortDateBR(tx.date)}
                        </td>
                        <td className="py-2 font-semibold text-slate-900">
                          {tx.description}
                        </td>
                        <td className="py-2 text-slate-500 text-[11px]">
                          {regime} • {payer?.name}
                        </td>
                        <td className="py-2 text-right font-mono font-bold text-slate-900">
                          {formatForeignCurrency(txForeign, txCurr)}
                        </td>
                        <td className="py-2 text-right font-mono text-slate-700">
                          {formatBRL(tx.amount)}
                        </td>
                        <td className="py-2 text-right font-mono font-bold text-emerald-800">
                          {formatForeignCurrency(myForeign, txCurr)}
                          <span className="block text-[10px] text-slate-500 font-normal">
                            ({formatBRL(myBrl)})
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer Note */}
          <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
            Relatório emitido pelo Minhas Economias BR — Sistema de Controle Financeiro Pessoal & Viagens
          </div>
        </div>
      </div>
    </div>
  );
};
