/** Ações: baixar CSV, exportar PDF e importar lançamentos. Parte de ReportsAndDataTab (ver ReportsAndDataTab.tsx). */
import { exportTransactionsToSafeCSV } from '../../../services/import-export/transactionsCsv';
import { isSharedOnlyExpense } from '../../../domain/finance/financeRules';
import { exportFinancialHistoryAuditCsv } from '../../../domain/budgets/legacyFinancialAudit';
import React from 'react';
import { parseQuickCsvLines } from '../../../services/import-export/quickCsvImport';
import type { ReportsAndDataTabPropsApi } from './reportsTabConfig';
import type { ReportsStateApi } from './useReportsState';
import type { ReportsDerivedApi } from './useReportsDerived';

export function useReportsActions(ctx: ReportsAndDataTabPropsApi & ReportsStateApi & ReportsDerivedApi) {
  const {
    accountBalances,
    accounts,
    brlImportAccounts,
    cards,
    categories,
    csvPasteText,
    historyAuditRows,
    importTargetAccId,
    investments,
    onImportQuickCsvLines,
    selectedMonth,
    setCsvPasteText,
    setImportFeedback,
    setIsExportingPdf,
    transactions,
    userEmail,
    userName,
  } = ctx;
  const handleDownloadCSV = () => {
    const csvContent = exportTransactionsToSafeCSV(transactions.filter((tx) => !isSharedOnlyExpense(tx)), categories, accounts, cards);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minhas-economias-extrato-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadHistoryAudit = () => {
    const csvContent = exportFinancialHistoryAuditCsv(historyAuditRows);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minhas-auditoria-historica-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      // Carrega o gerador de PDF (biblioteca pesada) só quando a pessoa pede o arquivo.
      const { generateMonthlyFinancialReportPdf } = await import('../../../services/import-export/reportPdfGenerator');
      generateMonthlyFinancialReportPdf({
        selectedMonth,
        accounts,
        accountBalances,
        cards,
        categories,
        transactions,
        investments,
        userName,
        userEmail,
      });
    } catch (err) {
      console.error('Erro ao gerar relatório em PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleRunImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (brlImportAccounts.length === 0) return;
    const count = onImportQuickCsvLines(
      csvPasteText,
      importTargetAccId || brlImportAccounts[0]?.id || ''
    );
    if (count > 0) {
      const { rejected } = parseQuickCsvLines(csvPasteText);
      if (rejected.length > 0) {
        setImportFeedback(
          `${count} lançamento(s) importado(s). ${rejected.length} linha(s) com erro foram mantidas na caixa para correção (formato: YYYY-MM-DD;Descrição;Valor).`
        );
        setCsvPasteText(rejected.join('\n'));
      } else {
        setImportFeedback(`${count} lançamento(s) importado(s) com sucesso para o extrato!`);
        setCsvPasteText('');
      }
    } else {
      setImportFeedback(
        'Use o formato: YYYY-MM-DD;Descrição;Valor (ex: 2026-10-22;Padaria Real;-34,90)'
      );
    }
  };

  return {
    handleDownloadCSV,
    handleDownloadHistoryAudit,
    handleExportPdf,
    handleRunImport,
  };
}

export type ReportsActionsApi = ReturnType<typeof useReportsActions>;
