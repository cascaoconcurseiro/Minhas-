import { jsPDF } from 'jspdf';
import { Category, Transaction, Trip, TripDashboardSummary } from '../types/finance';
import { formatBRL, formatShortDateBR } from './financeRules';
import {
  calculateExchangeSavingsAnalysis,
  CURRENCY_CATALOG,
  formatExchangeRateBR,
  formatForeignCurrency,
} from './travelRules';

export interface TripPdfReportData {
  trip: Trip;
  summary: TripDashboardSummary;
  transactions: Transaction[];
  categories: Category[];
}

/**
 * Sanitizes text to pure ASCII/standard Latin characters for jsPDF standard fonts.
 */
function sanitizePdfText(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^\x20-\x7E]/g, ' '); // remove non-printable ASCII
}

/**
 * Generates and triggers the direct download of a formatted PDF report for the trip.
 */
export function generateAndDownloadTripPdf({
  trip,
  summary,
  transactions,
  categories,
}: TripPdfReportData): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 14) {
      doc.addPage();
      y = 16;
    }
  };

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

  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  // --- HEADER ---
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, y, contentWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('RELATORIO FINANCEIRO DE VIAGEM & CAMBIO', margin + 6, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  const subtitle = `${sanitizePdfText(trip.name)} | Destino: ${sanitizePdfText(trip.destination || 'Nao especificado')} | Moeda: ${trip.currency}`;
  doc.text(subtitle, margin + 6, y + 14);

  const emitDate = `Emitido em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  doc.text(emitDate, pageWidth - margin - 6, y + 14, { align: 'right' });

  y += 28;

  // --- SECTION 1: RESUMO EXECUTIVO (KPIS) ---
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('1. RESUMO EXECUTIVO & METRICAS TOTAIS', margin, y);
  y += 4;

  const colWidth = (contentWidth - 6) / 4;
  const kpiItems = [
    {
      title: 'ORCAMENTO TOTAL',
      val1: formatForeignCurrency(summary.budgetForeign, trip.currency),
      val2: formatBRL(summary.budgetBrlEquivalent),
    },
    {
      title: 'TOTAL GASTO NA VIAGEM',
      val1: formatForeignCurrency(summary.groupTotalSpendForeign, trip.currency),
      val2: formatBRL(summary.groupTotalSpendBrl),
    },
    {
      title: 'SUA PARTE REAL',
      val1: formatForeignCurrency(summary.myPersonalSpendForeign, trip.currency),
      val2: formatBRL(summary.myPersonalSpendBrl),
    },
    {
      title: 'ECONOMIA CAMBIAL',
      val1: savingsAnalysis.totalSavingsBrl >= 0 ? `+${formatBRL(savingsAnalysis.totalSavingsBrl)}` : formatBRL(savingsAnalysis.totalSavingsBrl),
      val2: `${savingsAnalysis.overallSavingsPercent >= 0 ? '+' : ''}${savingsAnalysis.overallSavingsPercent}% vs Benchmark`,
    },
  ];

  kpiItems.forEach((kpi, idx) => {
    const kx = margin + idx * (colWidth + 2);
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(kx, y, colWidth, 18, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(kpi.title, kx + 3, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(kpi.val1), kx + 3, y + 10.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(sanitizePdfText(kpi.val2), kx + 3, y + 15);
  });

  y += 24;

  // --- SECTION 2: HISTÓRICO DE LOTES DE CÂMBIO ---
  const weightedVet =
    savingsAnalysis.totalForeignPurchased > 0
      ? savingsAnalysis.totalBrlPaid / savingsAnalysis.totalForeignPurchased
      : summary.weightedAverageRate;

  checkPageBreak(35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`2. HISTORICO DE LOTES DE CAMBIO REGISTRADOS (${trip.exchangeLots.length} LOTES)`, margin, y);
  y += 4;

  if (trip.exchangeLots.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Nenhum lote registrado. Cotacao de referencia padrao adotada: ${formatExchangeRateBR(trip.defaultExchangeRate)}`, margin, y + 4);
    y += 10;
  } else {
    // Table Header
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);

    const colsLot = [
      { text: 'DATA', x: margin + 3, align: 'left' as const },
      { text: 'ORIGEM / BOLSO', x: margin + 26, align: 'left' as const },
      { text: `VALOR (${trip.currency})`, x: margin + 85, align: 'right' as const },
      { text: 'COTACAO BASE', x: margin + 115, align: 'right' as const },
      { text: 'IOF (%)', x: margin + 133, align: 'right' as const },
      { text: 'VET EFETIVO', x: margin + 155, align: 'right' as const },
      { text: 'TOTAL PAGO (R$)', x: margin + contentWidth - 3, align: 'right' as const },
    ];

    colsLot.forEach((col) => {
      doc.text(col.text, col.x, y + 4.2, { align: col.align });
    });
    y += 6.5;

    trip.exchangeLots.forEach((lot, i) => {
      checkPageBreak(8);
      const rowBg = i % 2 === 0 ? 255 : 250;
      doc.setFillColor(rowBg, rowBg, rowBg);
      doc.rect(margin, y, contentWidth, 5.5, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);

      doc.text(formatShortDateBR(lot.date), colsLot[0].x, y + 3.8);
      doc.text(sanitizePdfText(lot.sourceLabel).substring(0, 32), colsLot[1].x, y + 3.8);
      doc.text(formatForeignCurrency(lot.foreignAmount, trip.currency), colsLot[2].x, y + 3.8, { align: 'right' });
      doc.text(formatExchangeRateBR(lot.rateBase), colsLot[3].x, y + 3.8, { align: 'right' });
      doc.text(`${lot.iofPercent.toFixed(1)}%`, colsLot[4].x, y + 3.8, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text(formatExchangeRateBR(lot.effectiveRateBrl), colsLot[5].x, y + 3.8, { align: 'right' });
      doc.text(formatBRL(lot.totalBrlPaid), colsLot[6].x, y + 3.8, { align: 'right' });

      y += 5.5;
    });

    // Weighted average summary line
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL CAMBIO COMPRADO / VET MEDIO:', margin + 3, y + 4.2);
    doc.text(formatForeignCurrency(savingsAnalysis.totalForeignPurchased, trip.currency), colsLot[2].x, y + 4.2, { align: 'right' });
    doc.text(formatExchangeRateBR(weightedVet), colsLot[5].x, y + 4.2, { align: 'right' });
    doc.text(formatBRL(savingsAnalysis.totalBrlPaid), colsLot[6].x, y + 4.2, { align: 'right' });
    y += 10;
  }

  // --- SECTION 3: ECONOMIA CAMBIAL REALIZADA ---
  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. ANALISE DE ECONOMIA CAMBIAL REALIZADA', margin, y);
  y += 4;

  doc.setFillColor(savingsAnalysis.totalSavingsBrl >= 0 ? 240 : 255, savingsAnalysis.totalSavingsBrl >= 0 ? 253 : 251, savingsAnalysis.totalSavingsBrl >= 0 ? 244 : 235); // emerald-50 or amber-50
  doc.setDrawColor(savingsAnalysis.totalSavingsBrl >= 0 ? 167 : 252, savingsAnalysis.totalSavingsBrl >= 0 ? 243 : 211, savingsAnalysis.totalSavingsBrl >= 0 ? 208 : 77); // emerald-200 or amber-200
  doc.roundedRect(margin, y, contentWidth, 16, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(savingsAnalysis.totalSavingsBrl >= 0 ? 6 : 146, savingsAnalysis.totalSavingsBrl >= 0 ? 95 : 64, savingsAnalysis.totalSavingsBrl >= 0 ? 70 : 14);

  const econTitle = savingsAnalysis.totalSavingsBrl >= 0
    ? `ECONOMIA REALIZADA: +${formatBRL(savingsAnalysis.totalSavingsBrl)} (+${savingsAnalysis.overallSavingsPercent}% de ganho cambial)`
    : `VARIACAO CAMBIAL: ${formatBRL(Math.abs(savingsAnalysis.totalSavingsBrl))} acima da media comercial`;
  doc.text(sanitizePdfText(econTitle), margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const econDesc = `Comparativo entre o VET Medio Ponderado pago (${formatExchangeRateBR(weightedVet)}) e a Cotacao Comercial Media de Referencia do periodo (${formatExchangeRateBR(savingsAnalysis.benchmarkRateUsed)}).`;
  doc.text(sanitizePdfText(econDesc), margin + 4, y + 11.5);

  y += 20;

  // --- SECTION 4: EXTRATO DE DESPESAS TOTAIS ---
  checkPageBreak(35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`4. EXTRATO DE DESPESAS DA VIAGEM (${tripExpenses.length} LANCAMENTOS)`, margin, y);
  y += 4;

  if (tripExpenses.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhuma despesa lancada nesta viagem ainda.', margin, y + 4);
    y += 10;
  } else {
    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);

    const colsExp = [
      { text: 'DATA', x: margin + 3, align: 'left' as const },
      { text: 'DESCRICAO', x: margin + 26, align: 'left' as const },
      { text: 'CATEGORIA', x: margin + 85, align: 'left' as const },
      { text: `ORIGINAL (${trip.currency})`, x: margin + 125, align: 'right' as const },
      { text: 'VET', x: margin + 145, align: 'right' as const },
      { text: 'CONVERTIDO (R$)', x: margin + contentWidth - 3, align: 'right' as const },
    ];

    colsExp.forEach((col) => {
      doc.text(col.text, col.x, y + 4.2, { align: col.align });
    });
    y += 6.5;

    tripExpenses.forEach((tx, i) => {
      checkPageBreak(8);
      const rowBg = i % 2 === 0 ? 255 : 250;
      doc.setFillColor(rowBg, rowBg, rowBg);
      doc.rect(margin, y, contentWidth, 5.5, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);

      const effectiveRate = tx.effectiveExchangeRate || tx.exchangeRate || trip.defaultExchangeRate || 1;
      const foreignAmt = tx.originalAmount || (tx.amount / effectiveRate);
      const catName = catMap.get(tx.categoryId) || 'Geral';

      doc.text(formatShortDateBR(tx.date), colsExp[0].x, y + 3.8);
      doc.text(sanitizePdfText(tx.description).substring(0, 32), colsExp[1].x, y + 3.8);
      doc.text(sanitizePdfText(catName).substring(0, 18), colsExp[2].x, y + 3.8);
      doc.text(formatForeignCurrency(foreignAmt, trip.currency), colsExp[3].x, y + 3.8, { align: 'right' });
      doc.text(formatExchangeRateBR(effectiveRate), colsExp[4].x, y + 3.8, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text(formatBRL(tx.amount), colsExp[5].x, y + 3.8, { align: 'right' });

      y += 5.5;
    });

    // Summary line
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL GASTO DA VIAGEM:', margin + 3, y + 4.2);
    doc.text(formatForeignCurrency(summary.groupTotalSpendForeign, trip.currency), colsExp[3].x, y + 4.2, { align: 'right' });
    doc.text(formatBRL(summary.groupTotalSpendBrl), colsExp[5].x, y + 4.2, { align: 'right' });
    y += 10;
  }

  // --- FOOTER (All Pages) ---
  const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `Minhas Economias BR — Controle Multi-Moeda & TravelSpend | Pagina ${p} de ${pageCount}`,
      margin,
      pageHeight - 6
    );
  }

  const cleanName = sanitizePdfText(trip.name).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const filename = `relatorio-viagem-${cleanName || 'financeiro'}.pdf`;

  // Trigger browser download
  doc.save(filename);
  return filename;
}
