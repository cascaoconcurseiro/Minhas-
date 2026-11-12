import { jsPDF } from 'jspdf';
import {
  AccountBalanceSummary,
  BankAccount,
  Category,
  CreditCard,
  InvestmentAsset,
  Transaction,
} from '../types/finance';
import {
  calculateAccountBalances,
  calculateCategoryBreakdown,
  calculateMonthlySummary,
  formatBRL,
  formatMonthYearPT,
  formatShortDateBR,
  getConsumptionMonth,
  getLocalDateISO,
} from './financeRules';

export interface MonthlyReportPdfData {
  selectedMonth: string;
  accounts: BankAccount[];
  accountBalances: AccountBalanceSummary[];
  cards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  investments?: InvestmentAsset[];
  userName?: string;
  userEmail?: string;
  returnBlob?: boolean;
}

export interface GeneratedReportPdfResult {
  filename: string;
  doc: jsPDF;
  pageCount: number;
  blob?: Blob;
}

/**
 * Sanitizes text to standard ASCII characters for jsPDF's built-in Helvetica font
 * to avoid encoding artifacts or missing glyphs in printable output.
 */
export function sanitizePdfText(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^\x20-\x7E]/g, ' ') // replace non-ASCII with spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates an executive, styled, printable monthly financial report in PDF format
 * using pure vector drawing primitives and jsPDF standard fonts.
 */
export function generateMonthlyFinancialReportPdf({
  selectedMonth,
  accounts,
  accountBalances: initialAccountBalances,
  cards,
  categories,
  transactions,
  investments = [],
  userName = 'Usuario',
  userEmail,
  returnBlob = false,
}: MonthlyReportPdfData): GeneratedReportPdfResult {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm
  let y = 14;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 16) {
      doc.addPage();
      y = 16;
    }
  };

  // 1. Calculations & Metrics
  const summary = calculateMonthlySummary(accounts, cards, transactions, selectedMonth);
  const categoryBreakdown = calculateCategoryBreakdown(categories, transactions, selectedMonth);

  const accountBalances =
    initialAccountBalances && initialAccountBalances.length > 0
      ? initialAccountBalances
      : calculateAccountBalances(accounts, transactions, selectedMonth);

  const liquidAccountsTotal = accountBalances
    .filter((ab) => {
      const acc = accounts.find((a) => a.id === ab.accountId);
      return acc ? acc.includeInTotal : true;
    })
    .reduce((sum, ab) => sum + ab.currentBalance, 0);

  const investedAssetsTotal = investments.reduce(
    (sum, asset) => sum + Math.round(asset.quantity * asset.currentPrice * 100) / 100,
    0
  );
  const totalNetWorth = Math.round((liquidAccountsTotal + investedAssetsTotal) * 100) / 100;

  // Top month expenses
  const topExpenses = transactions
    .filter(
      (tx) =>
        getConsumptionMonth(tx) === selectedMonth &&
        tx.type === 'expense' &&
        !tx.isInvoicePayment &&
        !tx.isCompanionOnlyExpense
    )
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const cardMap = new Map(cards.map((c) => [c.id, c.name]));

  // --- HEADER BANNER ---
  // Slate-900 background banner with Emerald-500 accent strip
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'F');

  // Emerald accent top strip
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.roundedRect(margin, y, contentWidth, 2.5, 1, 1, 'F');

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text('MINHAS ECONOMIAS BR — RELATORIO FINANCEIRO MENSAL', margin + 6, y + 10.5);

  // Subtitles & User Meta
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // slate-300
  const competenceLabel = sanitizePdfText(formatMonthYearPT(selectedMonth)).toUpperCase();
  const now = new Date();
  const dateStr = `${formatShortDateBR(getLocalDateISO(now))} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  doc.text(`Competencia: ${competenceLabel}  |  Gerado em: ${dateStr}`, margin + 6, y + 16.5);

  const userDisplayName = sanitizePdfText(userName || userEmail || 'Usuario');
  doc.text(`Titular: ${userDisplayName}`, margin + 6, y + 21);

  // Watermark badge on right of banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(110, 231, 183); // emerald-300
  doc.text('DOCUMENTO OFICIAL', pageWidth - margin - 6, y + 10.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Regime de Competencia', pageWidth - margin - 6, y + 16.5, { align: 'right' });

  y += 29;

  // --- SECTION: RESUMO EXECUTIVO (4 KPI CARDS) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. RESUMO EXECUTIVO DO MES', margin, y);
  y += 4;

  const kpiCardWidth = (contentWidth - 6) / 4; // 4 cards with 2mm spacing
  const kpis = [
    {
      title: 'RECEITAS REALIZADAS',
      value: formatBRL(summary.incomeTotal),
      subtext: `Efetivado: ${formatBRL(summary.incomeRealized)}`,
      accentR: 16,
      accentG: 185,
      accentB: 129, // Emerald
    },
    {
      title: 'DESPESAS TOTAIS',
      value: formatBRL(summary.expenseTotal),
      subtext: `Cartoes: ${formatBRL(summary.creditCardMonthTotal)}`,
      accentR: 244,
      accentG: 63,
      accentB: 94, // Rose
    },
    {
      title: 'RESULTADO LIQUIDO',
      value: `${summary.netResultProjected >= 0 ? '+' : ''}${formatBRL(summary.netResultProjected)}`,
      subtext: summary.netResultProjected >= 0 ? 'Superavit Operacional' : 'Deficit no Mes',
      accentR: summary.netResultProjected >= 0 ? 16 : 225,
      accentG: summary.netResultProjected >= 0 ? 185 : 29,
      accentB: summary.netResultProjected >= 0 ? 129 : 72,
    },
    {
      title: 'TAXA DE POUPANCA',
      value: `${summary.savingsRateProjected.toFixed(1)}%`,
      subtext: summary.savingsRateProjected >= 20 ? 'Meta Ideal Atingida (>20%)' : 'Abaixo da meta recomendada',
      accentR: 99,
      accentG: 102,
      accentB: 241, // Indigo
    },
  ];

  kpis.forEach((kpi, idx) => {
    const kx = margin + idx * (kpiCardWidth + 2);
    // Background card
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(kx, y, kpiCardWidth, 18, 1.5, 1.5, 'FD');

    // Colored accent left border
    doc.setFillColor(kpi.accentR, kpi.accentG, kpi.accentB);
    doc.roundedRect(kx, y, 1.5, 18, 0.5, 0.5, 'F');

    // KPI Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(kpi.title, kx + 3.5, y + 4.5);

    // KPI Main Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(sanitizePdfText(kpi.value), kx + 3.5, y + 10.5);

    // KPI Subtext
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(sanitizePdfText(kpi.subtext), kx + 3.5, y + 15);
  });

  y += 23;

  // --- SECTION 2: SALDOS DAS CONTAS & LIQUIDEZ ---
  checkPageBreak(35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('2. SALDOS BANCARIOS E PATRIMONIO CONSOLIDADO', margin, y);
  y += 4;

  // Table header
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);

  const colsAcc = [
    { text: 'INSTITUICAO / CONTA', x: margin + 3, align: 'left' as const },
    { text: 'TIPO DE CONTA', x: margin + 65, align: 'left' as const },
    { text: 'NO SALDO GERAL', x: margin + 115, align: 'left' as const },
    { text: 'SALDO ATUAL (R$)', x: margin + contentWidth - 3, align: 'right' as const },
  ];

  colsAcc.forEach((col) => {
    doc.text(col.text, col.x, y + 4.2, { align: col.align });
  });
  y += 6.5;

  if (accounts.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhuma conta bancaria cadastrada.', margin + 3, y + 4);
    y += 8;
  } else {
    accounts.forEach((acc, i) => {
      checkPageBreak(6);
      const rowBg = i % 2 === 0 ? 255 : 250;
      doc.setFillColor(rowBg, rowBg, rowBg);
      doc.rect(margin, y, contentWidth, 5.2, 'F');

      const balObj = accountBalances.find((b) => b.accountId === acc.id);
      const currBal = balObj ? balObj.currentBalance : acc.initialBalance;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(30, 41, 59);

      const typeLabel =
        acc.type === 'checking'
          ? 'Conta Corrente'
          : acc.type === 'cash'
          ? 'Carteira / Dinheiro'
          : acc.type === 'investment'
          ? 'Conta de Investimentos'
          : acc.type === 'international'
          ? 'Conta Internacional'
          : 'Poupanca';

      doc.text(sanitizePdfText(acc.name).substring(0, 32), colsAcc[0].x, y + 3.7);
      doc.text(sanitizePdfText(typeLabel), colsAcc[1].x, y + 3.7);
      doc.text(acc.includeInTotal ? 'Sim' : 'Oculto do Total', colsAcc[2].x, y + 3.7);

      doc.setFont('helvetica', 'bold');
      if (currBal < 0) {
        doc.setTextColor(225, 29, 72); // rose-600
      } else {
        doc.setTextColor(15, 23, 42); // slate-900
      }
      doc.text(sanitizePdfText(formatBRL(currBal)), colsAcc[3].x, y + 3.7, { align: 'right' });

      y += 5.2;
    });

    // Consolidated Wealth Strip
    checkPageBreak(8);
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);

    doc.text('TOTAL DE LIQUIDEZ DISPONIVEL EM CONTAS:', margin + 3, y + 4.2);
    doc.setTextColor(16, 185, 129); // emerald-600
    doc.text(sanitizePdfText(formatBRL(liquidAccountsTotal)), colsAcc[3].x, y + 4.2, {
      align: 'right',
    });
    y += 7.5;

    if (investments.length > 0) {
      checkPageBreak(6);
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 5.2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Ativos de Investimentos (${investments.length} ativos): ${formatBRL(investedAssetsTotal)}  |  PATRIMONIO LIQUIDO TOTAL:`,
        margin + 3,
        y + 3.7
      );
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(sanitizePdfText(formatBRL(totalNetWorth)), colsAcc[3].x, y + 3.7, {
        align: 'right',
      });
      y += 7.5;
    }
  }

  y += 5;

  // --- SECTION 3: DESPESAS POR CATEGORIA & GRAFICO VETORIAL ---
  checkPageBreak(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('3. DESPESAS POR CATEGORIA E GRAFICO DE PARTICIPACAO', margin, y);
  y += 4;

  const totalExpenseAmount = categoryBreakdown.reduce((sum, item) => sum + item.spent, 0);
  const activeCategories = categoryBreakdown
    .filter((item) => item.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);

  const colsCat = [
    { text: 'CATEGORIA', x: margin + 3, align: 'left' as const },
    { text: 'GASTO (R$)', x: margin + 55, align: 'right' as const },
    { text: '% TOTAL', x: margin + 74, align: 'right' as const },
    { text: 'GRAFICO DE PARTICIPACAO (PROPORCAO)', x: margin + 82, align: 'left' as const },
    { text: 'TETO ORCADO', x: margin + 148, align: 'right' as const },
    { text: 'STATUS', x: margin + contentWidth - 3, align: 'right' as const },
  ];

  colsCat.forEach((col) => {
    doc.text(col.text, col.x, y + 4.2, { align: col.align });
  });
  y += 6.5;

  if (activeCategories.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhuma despesa registrada para o periodo selecionado.', margin + 3, y + 4);
    y += 9;
  } else {
    const barMaxWidth = 52; // mm width allocated for horizontal vector bar

    activeCategories.forEach((catItem, idx) => {
      checkPageBreak(6.5);
      const rowBg = idx % 2 === 0 ? 255 : 250;
      doc.setFillColor(rowBg, rowBg, rowBg);
      doc.rect(margin, y, contentWidth, 5.8, 'F');

      const pctTotal =
        totalExpenseAmount > 0
          ? Math.round((catItem.spent / totalExpenseAmount) * 1000) / 10
          : 0;

      // Texts
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text(sanitizePdfText(catItem.categoryName).substring(0, 24), colsCat[0].x, y + 4);

      doc.setFont('helvetica', 'bold');
      doc.text(sanitizePdfText(formatBRL(catItem.spent)), colsCat[1].x, y + 4, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.text(`${pctTotal.toFixed(1)}%`, colsCat[2].x, y + 4, { align: 'right' });

      // Graphical Vector Progress Bar:
      // Draw background track (light gray)
      const barX = margin + 82;
      const barY = y + 1.8;
      const barHeight = 2.4;
      doc.setFillColor(226, 232, 240); // slate-200
      doc.roundedRect(barX, barY, barMaxWidth, barHeight, 0.8, 0.8, 'F');

      // Draw filled portion based on % of total expense
      const fillWidth = Math.max(0.8, Math.min(barMaxWidth, (pctTotal / 100) * barMaxWidth));
      // Color depends on budget status
      if (catItem.status === 'over') {
        doc.setFillColor(239, 68, 68); // red-500
      } else if (catItem.status === 'warning') {
        doc.setFillColor(245, 158, 11); // amber-500
      } else {
        doc.setFillColor(16, 185, 129); // emerald-500
      }
      doc.roundedRect(barX, barY, fillWidth, barHeight, 0.8, 0.8, 'F');

      // Budget column
      const budgetStr =
        catItem.budget > 0 ? formatBRL(catItem.budget) : '-';
      doc.text(sanitizePdfText(budgetStr), colsCat[4].x, y + 4, { align: 'right' });

      // Status column
      const statusLabel =
        catItem.status === 'over'
          ? 'Estourado'
          : catItem.status === 'warning'
          ? 'Em Alerta'
          : catItem.budget > 0
          ? 'No Limite'
          : 'Sem Teto';

      if (catItem.status === 'over') {
        doc.setTextColor(225, 29, 72); // rose-600
        doc.setFont('helvetica', 'bold');
      } else if (catItem.status === 'warning') {
        doc.setTextColor(217, 119, 6); // amber-600
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
      }
      doc.text(statusLabel, colsCat[5].x, y + 4, { align: 'right' });

      y += 5.8;
    });

    // Total category row
    checkPageBreak(7);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL DE DESPESAS CLASSIFICADAS:', margin + 3, y + 4.2);
    doc.text(sanitizePdfText(formatBRL(totalExpenseAmount)), colsCat[1].x, y + 4.2, {
      align: 'right',
    });
    doc.text('100.0%', colsCat[2].x, y + 4.2, { align: 'right' });
    y += 9;
  }

  // --- SECTION 4: MAIORES DESPESAS DO MÊS ---
  checkPageBreak(35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('4. MAIORES DESPESAS DO MES (TOP LANCAMENTOS)', margin, y);
  y += 4;

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);

  const colsTop = [
    { text: 'DATA', x: margin + 3, align: 'left' as const },
    { text: 'DESCRICAO', x: margin + 24, align: 'left' as const },
    { text: 'CATEGORIA', x: margin + 82, align: 'left' as const },
    { text: 'ORIGEM / FORMA', x: margin + 128, align: 'left' as const },
    { text: 'VALOR (R$)', x: margin + contentWidth - 3, align: 'right' as const },
  ];

  colsTop.forEach((col) => {
    doc.text(col.text, col.x, y + 4.2, { align: col.align });
  });
  y += 6.5;

  if (topExpenses.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhum lancamento de despesa encontrado para este mes.', margin + 3, y + 4);
    y += 9;
  } else {
    topExpenses.forEach((tx, idx) => {
      checkPageBreak(6);
      const rowBg = idx % 2 === 0 ? 255 : 250;
      doc.setFillColor(rowBg, rowBg, rowBg);
      doc.rect(margin, y, contentWidth, 5.2, 'F');

      const catName = categoryMap.get(tx.categoryId) || 'Sem Categoria';
      const sourceName = tx.creditCardId
        ? `Cartao ${cardMap.get(tx.creditCardId) || ''}`
        : tx.accountId
        ? `Conta ${accountMap.get(tx.accountId) || ''}`
        : 'Outros';

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);

      doc.text(formatShortDateBR(tx.date), colsTop[0].x, y + 3.7);
      doc.text(sanitizePdfText(tx.description).substring(0, 36), colsTop[1].x, y + 3.7);
      doc.text(sanitizePdfText(catName).substring(0, 24), colsTop[2].x, y + 3.7);
      doc.text(sanitizePdfText(sourceName).substring(0, 22), colsTop[3].x, y + 3.7);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(sanitizePdfText(formatBRL(tx.amount)), colsTop[4].x, y + 3.7, { align: 'right' });

      y += 5.2;
    });
    y += 6;
  }

  // --- FOOTER FOR ALL PAGES ---
  const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);

    // Subtle divider line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `Minhas Economias BR — Relatorio Financeiro Mensal | Competencia: ${selectedMonth} | Pagina ${p} de ${pageCount}`,
      margin,
      pageHeight - 5
    );

    doc.text('Documento gerado com dados locais e confidenciais', pageWidth - margin, pageHeight - 5, {
      align: 'right',
    });
  }

  const filename = `relatorio-financeiro-${selectedMonth}.pdf`;

  // Trigger browser download if applicable and not explicitly suppressed
  if (typeof window !== 'undefined' && !returnBlob) {
    doc.save(filename);
  }

  let blob: Blob | undefined;
  if (returnBlob || typeof window === 'undefined') {
    blob = doc.output('blob');
  }

  return {
    filename,
    doc,
    pageCount,
    blob,
  };
}
