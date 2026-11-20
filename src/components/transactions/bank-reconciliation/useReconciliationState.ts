/** Estado da janela: arquivo, itens lidos, candidatos e filtros. Parte de BankReconciliationModal (ver BankReconciliationModal.tsx). */
import React, { useId, useRef, useState } from 'react';
import { ReconciliationCandidate, parseBankStatement } from '../../../services/import-export/ofxParser';
import { isCurrencyInputValid, isExchangeRateInputValid, parseExchangeRateInput } from '../../../utils/currencyInput';
import { CurrencyCode } from '../../../types/finance';
import type { BankReconciliationModalPropsApi } from './bankReconciliationConfig';

export function useReconciliationState(ctx: BankReconciliationModalPropsApi) {
  const {
    accounts,
    defaultAccountId,
  } = ctx;
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    defaultAccountId || accounts[0]?.id || ''
  );
  const [parsedItems, setParsedItems] = useState<ReturnType<typeof parseBankStatement>['items']>([]);
  const [candidates, setCandidates] = useState<ReconciliationCandidate[]>([]);
  // A lista mostra os primeiros itens e abre o resto sob demanda (extratos grandes travavam a tela); a seleção vale para todos
  const [rowLimit, setRowLimit] = useState(100);
  const [exchangeRateInput, setExchangeRateInput] = useState('');
  const [statementMeta, setStatementMeta] = useState<{
    fileFormat?: 'ofx' | 'csv' | 'unknown';
    bankId?: string;
    accountId?: string;
    currency?: string;
    fileName?: string;
  }>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedContent, setPastedContent] = useState('');
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [parseFeedback, setParseFeedback] = useState('');

  // Auto-sync defaultAccountId if provided
  React.useEffect(() => {
    if (defaultAccountId && accounts.some((a) => a.id === defaultAccountId)) {
      setSelectedAccountId(defaultAccountId);
    }
  }, [defaultAccountId, accounts]);

  const currentAccount = accounts.find((a) => a.id === selectedAccountId);
  const targetCurrency = currentAccount?.currency || 'BRL';
  const parsedExchangeRate = parseExchangeRateInput(exchangeRateInput);
  const statementCurrencyError = statementMeta.fileFormat
    ? !statementMeta.currency
      ? 'A moeda do extrato não foi identificada. Nenhum lançamento será importado até que um extrato com moeda explícita seja fornecido.'
      : statementMeta.currency !== targetCurrency
      ? `O extrato está em ${statementMeta.currency}, mas a conta selecionada usa ${targetCurrency}. Selecione uma conta compatível.`
      : statementMeta.currency !== 'BRL'
      ? parsedItems.some((item) => !isCurrencyInputValid(item.amount.toString(), statementMeta.currency as CurrencyCode))
        ? `Há valores com precisão inválida para ${statementMeta.currency}. Confira a unidade monetária do extrato antes de importar.`
        : !isExchangeRateInputValid(exchangeRateInput)
        ? `Informe a taxa de conversão em BRL por 1 ${statementMeta.currency}. Ela será registrada nos lançamentos importados.`
        : parsedItems.some((item) => {
            const convertedCents = Math.round(item.amount * parsedExchangeRate * 100);
            return !Number.isSafeInteger(convertedCents) || convertedCents <= 0;
          })
        ? 'A conversão de pelo menos uma linha excede a faixa segura de centavos em BRL. Revise os valores ou divida o arquivo.'
        : ''
      : ''
    : '';

  return {
    candidates,
    currentAccount,
    exchangeRateInput,
    fileInputId,
    fileInputRef,
    isDragging,
    parseFeedback,
    parsedExchangeRate,
    parsedItems,
    pasteMode,
    pastedContent,
    rowLimit,
    selectedAccountId,
    setCandidates,
    setExchangeRateInput,
    setIsDragging,
    setIsProcessing,
    setParseFeedback,
    setParsedItems,
    setPasteMode,
    setPastedContent,
    setRowLimit,
    setSelectedAccountId,
    setShowOnlyNew,
    setStatementMeta,
    setSuccessCount,
    showOnlyNew,
    statementCurrencyError,
    statementMeta,
    successCount,
    targetCurrency,
  };
}

export type ReconciliationStateApi = ReturnType<typeof useReconciliationState>;
