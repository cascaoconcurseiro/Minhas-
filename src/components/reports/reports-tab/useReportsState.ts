/** Estado da tela: período, importação e confirmações. Parte de ReportsAndDataTab (ver ReportsAndDataTab.tsx). */
import { useEffect, useState } from 'react';
import { addMonthsToYearMonth } from '../../../domain/finance/financeRules';
import { getAccountCurrency } from '../../../domain/finance/transferRules';
import { PeriodPreset } from './reportsTabConfig';
import type { ReportsAndDataTabPropsApi } from './reportsTabConfig';

export function useReportsState(ctx: ReportsAndDataTabPropsApi) {
  const {
    accounts,
    cards,
    selectedMonth,
    transactions,
  } = ctx;
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('semiannual');
  const [customStartMonth, setCustomStartMonth] = useState(() =>
    addMonthsToYearMonth(selectedMonth, -5)
  );
  const [customEndMonth, setCustomEndMonth] = useState(selectedMonth);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmApplyHistoryTotals, setConfirmApplyHistoryTotals] = useState(false);
  const [historyBackupPrepared, setHistoryBackupPrepared] = useState(false);

  useEffect(() => {
    setHistoryBackupPrepared(false);
  }, [transactions, cards]);

  // Quick CSV paste import state
  const [csvPasteText, setCsvPasteText] = useState('');
  // A importação em lote é em reais: só contas em reais podem receber.
  const brlImportAccounts = accounts.filter((account) => getAccountCurrency(account) === 'BRL');
  const [importTargetAccId, setImportTargetAccId] = useState(brlImportAccounts[0]?.id || '');
  const [importFeedback, setImportFeedback] = useState('');

  return {
    brlImportAccounts,
    confirmApplyHistoryTotals,
    confirmReset,
    csvPasteText,
    customEndMonth,
    customStartMonth,
    historyBackupPrepared,
    importFeedback,
    importTargetAccId,
    isExportingPdf,
    periodPreset,
    setConfirmApplyHistoryTotals,
    setConfirmReset,
    setCsvPasteText,
    setCustomEndMonth,
    setCustomStartMonth,
    setHistoryBackupPrepared,
    setImportFeedback,
    setImportTargetAccId,
    setIsExportingPdf,
    setPeriodPreset,
  };
}

export type ReportsStateApi = ReturnType<typeof useReportsState>;
