import React, { useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Info,
  RefreshCw,
  UploadCloud,
  X,
} from 'lucide-react';
import { BankAccount, Category, CreditCard, CurrencyCode, Transaction } from '../types/finance';
import {
  convertCandidatesToTransactions,
  parseBankStatement,
  prepareReconciliationCandidates,
  ReconciliationCandidate,
} from '../utils/ofxParser';
import { formatBRL, formatMonthYearPT } from '../utils/financeRules';
import { formatForeignCurrency } from '../utils/travelRules';
import { isCurrencyInputValid, isExchangeRateInputValid, parseExchangeRateInput } from '../utils/currencyInput';
import { CategoryIconBadge } from './CategoryIconBadge';
import { InstitutionMark } from './InstitutionMark';

interface BankReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: BankAccount[];
  cards?: CreditCard[];
  categories: Category[];
  existingTransactions: Transaction[];
  onCommitImport: (transactions: Transaction[], accountId: string) => void | number;
  onAddAccount?: (account: Omit<BankAccount, 'id'>) => BankAccount | void;
  defaultAccountId?: string;
}

export const BankReconciliationModal: React.FC<BankReconciliationModalProps> = ({
  isOpen,
  onClose,
  accounts,
  cards = [],
  categories,
  existingTransactions,
  onCommitImport,
  onAddAccount,
  defaultAccountId,
}) => {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    defaultAccountId || accounts[0]?.id || ''
  );
  const [parsedItems, setParsedItems] = useState<ReturnType<typeof parseBankStatement>['items']>([]);
  const [candidates, setCandidates] = useState<ReconciliationCandidate[]>([]);
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
  const pendingInvoiceTotalsByCard = useMemo(() => {
    const cardIds = new Set(cards.map((card) => card.id));
    const totals = new Map<string, Map<string, number>>();
    for (const tx of existingTransactions) {
      if (
        !tx.creditCardId || !cardIds.has(tx.creditCardId) || tx.status !== 'pending' ||
        tx.isInvoicePayment || tx.isCompanionOnlyExpense || tx.sharedPaidBy === 'member'
      ) continue;
      const cardTotals = totals.get(tx.creditCardId) || new Map<string, number>();
      cardTotals.set(tx.competenceMonth, Math.round(((cardTotals.get(tx.competenceMonth) || 0) + tx.amount) * 100) / 100);
      totals.set(tx.creditCardId, cardTotals);
    }
    return totals;
  }, [cards, existingTransactions]);

  const buildCandidates = (
    items: ReturnType<typeof parseBankStatement>['items'],
    accountId: string,
    currency = 'BRL',
    exchangeRate?: number
  ) => prepareReconciliationCandidates(
    items,
    existingTransactions,
    categories,
    accountId,
    cards,
    { currency, exchangeRate }
  );

  const handleProcessRawText = (text: string, fileName?: string) => {
    setIsProcessing(true);
    setSuccessCount(null);
    setParseFeedback('');
    try {
      const parsed = parseBankStatement(text);
      const currency = parsed.metadata.currency || (parsed.fileFormat === 'csv' ? 'BRL' : undefined);
      setParsedItems(parsed.items);
      setExchangeRateInput('');
      setStatementMeta({
        fileFormat: parsed.fileFormat,
        bankId: parsed.metadata.bankId,
        accountId: parsed.metadata.accountId,
        currency,
        fileName: fileName || (parsed.fileFormat === 'ofx' ? 'extrato.ofx' : 'extrato.csv'),
      });

      const candList = buildCandidates(parsed.items, selectedAccountId, currency || 'BRL', currency === 'BRL' ? 1 : undefined);
      setCandidates(candList);
      if (parsed.items.length === 0) {
        setParseFeedback(
          parsed.skippedInvalidCount > 0
            ? `Nenhum lançamento válido foi encontrado; ${parsed.skippedInvalidCount} linha(s) inválida(s) foram ignoradas. Confira datas e valores.`
            : 'Nenhum lançamento foi encontrado neste extrato.'
        );
      } else if (parsed.skippedInvalidCount > 0) {
        setParseFeedback(
          `${parsed.skippedInvalidCount} linha(s) inválida(s) foram ignoradas. Revise o extrato antes de importar os lançamentos válidos.`
        );
      }
      setPasteMode(false);
    } catch (err) {
      console.error('Erro ao processar extrato bancário:', err);
      setParseFeedback('Não foi possível processar este extrato. Confira o formato do arquivo e tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    if (parsedItems.length > 0) {
      setCandidates(buildCandidates(
        parsedItems,
        accountId,
        statementMeta.currency || 'BRL',
        statementMeta.currency === 'BRL' ? 1 : parsedExchangeRate
      ));
    }
  };

  const handleExchangeRateChange = (value: string) => {
    setExchangeRateInput(value);
    if (parsedItems.length > 0) {
      setCandidates(buildCandidates(
        parsedItems,
        selectedAccountId,
        statementMeta.currency || 'BRL',
        parseExchangeRateInput(value)
      ));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleProcessRawText(content, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleProcessRawText(content, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleToggleCandidate = (id: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleCategoryChange = (id: string, categoryId: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, suggestedCategoryId: categoryId } : c))
    );
  };

  const getOpenInvoiceMonths = (cardId: string) => {
    return [...(pendingInvoiceTotalsByCard.get(cardId) || new Map<string, number>())]
      .filter(([, amount]) => amount > 0)
      .map(([month]) => month)
      .sort();
  };

  const handleInvoicePaymentChange = (id: string, isInvoicePayment: boolean) => {
    setCandidates((prev) => prev.map((candidate) => {
      if (candidate.id !== id) return candidate;
      if (!isInvoicePayment) {
        return { ...candidate, isInvoicePayment: false, settledCardId: undefined, settledInvoiceMonth: undefined };
      }
      const cardId = candidate.settledCardId || cards[0]?.id;
      const months = cardId ? getOpenInvoiceMonths(cardId) : [];
      return {
        ...candidate,
        isInvoicePayment: true,
        settledCardId: cardId,
        settledInvoiceMonth: candidate.settledInvoiceMonth && months.includes(candidate.settledInvoiceMonth)
          ? candidate.settledInvoiceMonth
          : months[0],
      };
    }));
  };

  const handleInvoiceCardChange = (id: string, cardId: string) => {
    const months = getOpenInvoiceMonths(cardId);
    setCandidates((prev) => prev.map((candidate) => candidate.id === id
      ? { ...candidate, settledCardId: cardId, settledInvoiceMonth: months[0] }
      : candidate));
  };

  const handleInvoiceMonthChange = (id: string, invoiceMonth: string) => {
    setCandidates((prev) => prev.map((candidate) => candidate.id === id
      ? { ...candidate, settledInvoiceMonth: invoiceMonth }
      : candidate));
  };

  const handleDescriptionChange = (id: string, desc: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, description: desc } : c))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setCandidates((prev) =>
      prev.map((c) => ({
        ...c,
        selected: select ? !c.isPotentialInvoicePayment || Boolean(c.isInvoicePayment) : false,
      }))
    );
  };

  const handleSelectOnlyNew = () => {
    setCandidates((prev) =>
      prev.map((c) => ({
        ...c,
        selected: !c.isDuplicate && (!c.isPotentialInvoicePayment || Boolean(c.isInvoicePayment)),
      }))
    );
  };

  const filteredCandidates = useMemo(() => {
    if (showOnlyNew) {
      return candidates.filter((c) => !c.isDuplicate);
    }
    return candidates;
  }, [candidates, showOnlyNew]);

  const summary = useMemo(() => {
    const totalItems = candidates.length;
    const selectedList = candidates.filter((c) => c.selected);
    const duplicates = candidates.filter((c) => c.isDuplicate).length;
    const invalidInvoicePayments = candidates.filter((candidate) => {
      if (!candidate.selected || !candidate.isInvoicePayment) return false;
      if (!candidate.settledCardId || !candidate.settledInvoiceMonth) return true;
      const card = cards.find((item) => item.id === candidate.settledCardId);
      if (!card) return true;
      const pendingAmount = pendingInvoiceTotalsByCard.get(card.id)?.get(candidate.settledInvoiceMonth) || 0;
      return candidate.amount <= 0 || candidate.amount > pendingAmount;
    }).length;

    let totalCredits = 0;
    let totalDebits = 0;
    for (const c of selectedList) {
      if (c.type === 'income') totalCredits += c.amount;
      else totalDebits += c.amount;
    }

    return {
      totalItems,
      selectedCount: selectedList.length,
      duplicates,
      invalidInvoicePayments,
      totalCredits: Math.round(totalCredits * 100) / 100,
      totalDebits: Math.round(totalDebits * 100) / 100,
      netFlow: Math.round((totalCredits - totalDebits) * 100) / 100,
    };
  }, [candidates, cards, pendingInvoiceTotalsByCard]);

  const handleCommit = () => {
    if (summary.selectedCount === 0 || statementCurrencyError) return;
    let targetAccId = selectedAccountId;
    if (!targetAccId && accounts.length === 0 && onAddAccount) {
      const created = onAddAccount({
        name: statementMeta.bankId === '260' ? 'Nubank Principal' : 'Conta Corrente',
        institution: statementMeta.bankId === '260' ? 'Nubank' : 'Banco',
        type: 'checking',
        initialBalance: 0,
        color: statementMeta.bankId === '260' ? '#7c3aed' : '#059669',
        includeInTotal: true,
      });
      if (created) {
        targetAccId = created.id;
        setSelectedAccountId(created.id);
      }
    }
    if (!targetAccId) return;

    const batchId = `import-${Date.now().toString(36)}`;
    const txsToImport = convertCandidatesToTransactions(
      candidates,
      targetAccId,
      batchId
    );

    const committedCount = onCommitImport(txsToImport, targetAccId);
    if (committedCount === 0) return;
    setSuccessCount(committedCount ?? txsToImport.length);
    setCandidates([]);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200 modal-shell"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reconciliation-modal-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="reconciliation-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                Conciliação Bancária & Importação Inteligente (OFX / CSV)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detecção automática de duplicidades, classificação preditiva por IA e conciliação atômica
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Account Bar & Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Conta Vinculada:
            </span>
            {accounts.length > 0 ? (
              <>
                <select
                  value={selectedAccountId}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-2xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.institution})
                    </option>
                  ))}
                </select>
                {currentAccount && (
                  <>
                    <InstitutionMark
                      institution={currentAccount.institution}
                      accountName={currentAccount.name}
                      color={currentAccount.color}
                      size="xs"
                    />
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: currentAccount.color }}
                      title={`Cor da conta: ${currentAccount.name}`}
                    />
                  </>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onAddAccount) {
                    const created = onAddAccount({
                      name: statementMeta.bankId === '260' ? 'Nubank Principal' : 'Conta Corrente',
                      institution: statementMeta.bankId === '260' ? 'Nubank' : 'Banco',
                      type: 'checking',
                      initialBalance: 0,
                      color: statementMeta.bankId === '260' ? '#7c3aed' : '#059669',
                      includeInTotal: true,
                    });
                    if (created) setSelectedAccountId(created.id);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
              >
                + Criar Conta Automática
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPasteMode(!pasteMode)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <FileText className="h-3.5 w-3.5" />
              {pasteMode ? 'Ocultar Colagem' : 'Colar Texto Manual'}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {successCount !== null && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40 animate-in fade-in">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    Conciliação concluída com sucesso!
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    {successCount} lançamento(s) foram importados e conciliados na conta{' '}
                    <strong>{currentAccount?.name}</strong>. Os saldos e relatórios foram atualizados automaticamente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {parseFeedback && (
            <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              {parseFeedback}
            </p>
          )}

          {statementCurrencyError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
              {statementCurrencyError}
            </p>
          )}

          {statementMeta.currency && statementMeta.currency !== 'BRL' && statementMeta.currency === targetCurrency && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 dark:border-sky-900/60 dark:bg-sky-950/30">
              <label htmlFor="reconciliation-exchange-rate" className="block text-xs font-semibold text-sky-950 dark:text-sky-100">
                Taxa de conversão do arquivo (R$ por 1 {statementMeta.currency})
              </label>
              <input
                id="reconciliation-exchange-rate"
                aria-label={`Taxa de conversão ${statementMeta.currency} para BRL`}
                type="text"
                inputMode="decimal"
                value={exchangeRateInput}
                onChange={(e) => handleExchangeRateChange(e.target.value)}
                placeholder="Ex.: 5,2000"
                className="mt-1 w-full max-w-xs rounded-md border border-sky-300 bg-white px-2.5 py-1.5 font-mono text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-sky-800 dark:bg-slate-900 dark:text-white"
              />
              <p className="mt-1 text-[11px] text-sky-800 dark:text-sky-200">
                Essa taxa será aplicada a cada linha e salva em cada lançamento junto ao valor e moeda originais. Para períodos com taxas diferentes, importe arquivos separados.
              </p>
            </div>
          )}

          {/* Paste manual content box */}
          {pasteMode && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  Colar Conteúdo OFX ou Linhas CSV:
                </span>
                <span className="text-[11px] text-blue-700 dark:text-blue-300">
                  Ex: Data;Descrição;Valor ou bloco &lt;STMTTRN&gt;
                </span>
              </div>
              <textarea
                rows={4}
                value={pastedContent}
                onChange={(e) => setPastedContent(e.target.value)}
                placeholder="Cole aqui o conteúdo do seu extrato bancário..."
                className="w-full rounded-lg border border-blue-200 bg-white p-2.5 font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none dark:border-blue-800 dark:bg-slate-900 dark:text-slate-200"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPastedContent('')}
                  className="rounded px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => handleProcessRawText(pastedContent, 'manual_colado.txt')}
                  disabled={!pastedContent.trim()}
                  className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Processar Linhas Coladas
                </button>
              </div>
            </div>
          )}

          {/* Drag & Drop Upload Zone (Shown when no candidates loaded) */}
          {candidates.length === 0 && !pasteMode && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                  : 'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-900'
              }`}
            >
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                accept=".ofx,.csv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 mb-3">
                <UploadCloud className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Arraste seu arquivo OFX ou CSV bancário aqui
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md">
                Compatível com extratos do <strong>Nubank, Itaú, Bradesco, Santander, Banco do Brasil, Inter, Caixa, C6</strong> e qualquer banco que exporte no formato <code>.ofx</code> ou <code>.csv</code>.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 dark:border-slate-700 dark:bg-slate-800">
                  .OFX (Recomendado)
                </span>
                <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 dark:border-slate-700 dark:bg-slate-800">
                  .CSV (Separado por ; ou ,)
                </span>
                <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 dark:border-slate-700 dark:bg-slate-800">
                  Detecção de Duplicatas por FITID
                </span>
              </div>
            </div>
          )}

          {/* Statement Candidates Preview Table */}
          {candidates.length > 0 && (
            <div className="space-y-3">
              {/* Status summary banner */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs dark:border-slate-800 dark:bg-slate-850">
                <div>
                  <span className="block text-slate-500 dark:text-slate-400">Total Encontrado</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {summary.totalItems} lançamentos ({statementMeta.fileFormat?.toUpperCase()})
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500 dark:text-slate-400">Selecionados</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {summary.selectedCount} para importar
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500 dark:text-slate-400">Possíveis Duplicadas</span>
                  <span className={`font-bold ${summary.duplicates > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    {summary.duplicates} sinalizadas
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500 dark:text-slate-400">Fluxo Líquido</span>
                  <span className={`font-bold font-mono ${summary.netFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {summary.netFlow >= 0 ? '+' : ''}{formatBRL(summary.netFlow)}
                  </span>
                </div>
              </div>

              {summary.invalidInvoicePayments > 0 && (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                  Selecione uma fatura em aberto e confira se o valor importado não supera o saldo dela.
                </p>
              )}

              {/* Selection filter toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(true)}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    Marcar Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(false)}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    Desmarcar Todos
                  </button>
                  {summary.duplicates > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectOnlyNew}
                      className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                    >
                      Desmarcar Duplicadas ({summary.duplicates})
                    </button>
                  )}
                </div>

                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyNew}
                    onChange={(e) => setShowOnlyNew(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Ocultar duplicatas da lista</span>
                </label>
              </div>

              {/* Candidate rows list */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                {filteredCandidates.map((c) => (
                  <div
                    key={c.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 text-xs transition-colors ${
                      c.isDuplicate
                        ? 'bg-amber-50/30 dark:bg-amber-950/20'
                        : c.selected
                        ? 'bg-white hover:bg-slate-50/80 dark:bg-slate-900 dark:hover:bg-slate-850'
                        : 'bg-slate-50/50 opacity-60 dark:bg-slate-900/60'
                    }`}
                  >
                    {/* Left: Checkbox + Date + Description */}
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={c.selected}
                        onChange={() => handleToggleCandidate(c.id)}
                        aria-label={`Selecionar ${c.description}`}
                        className="mt-0.5 sm:mt-0 rounded text-emerald-600 focus:ring-emerald-500 shrink-0"
                      />
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0 w-20">
                        {c.date}
                      </span>
                      <div className="min-w-0 flex-1">
                        <input
                          type="text"
                          value={c.description}
                          onChange={(e) => handleDescriptionChange(c.id, e.target.value)}
                          className="w-full bg-transparent font-medium text-slate-900 dark:text-white border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-none"
                        />
                        {c.isDuplicate && (
                          <div className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>{c.duplicateReason || 'Possível duplicata'}</span>
                          </div>
                        )}
                        {c.memo && c.memo !== c.description && (
                          <span className="block text-[10px] text-slate-400 truncate">
                            Memo original: {c.memo}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: transaction classification, category and amount */}
                    <div className="flex flex-col sm:items-end gap-2 shrink-0 pl-7 sm:pl-0">
                      {c.type === 'expense' && (
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <select
                            aria-label={`Tipo de lançamento de ${c.description}`}
                            value={c.isInvoicePayment ? 'invoice' : 'expense'}
                            onChange={(e) => handleInvoicePaymentChange(c.id, e.target.value === 'invoice')}
                            className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            <option value="expense">Despesa</option>
                            <option value="invoice">Pagamento de fatura</option>
                          </select>
                          {c.isInvoicePayment && (
                            <>
                              <select
                                aria-label={`Cartão da fatura de ${c.description}`}
                                value={c.settledCardId || ''}
                                onChange={(e) => handleInvoiceCardChange(c.id, e.target.value)}
                                className="max-w-36 rounded border border-violet-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 dark:border-violet-900 dark:bg-slate-800 dark:text-slate-300"
                              >
                                <option value="">Selecione o cartão</option>
                                {cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}
                              </select>
                              <select
                                aria-label={`Fatura quitada por ${c.description}`}
                                value={c.settledInvoiceMonth || ''}
                                onChange={(e) => handleInvoiceMonthChange(c.id, e.target.value)}
                                disabled={!c.settledCardId || getOpenInvoiceMonths(c.settledCardId).length === 0}
                                className="rounded border border-violet-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 disabled:opacity-50 dark:border-violet-900 dark:bg-slate-800 dark:text-slate-300"
                              >
                                <option value="">Selecione a fatura</option>
                                {c.settledCardId && getOpenInvoiceMonths(c.settledCardId).map((month) => (
                                  <option key={month} value={month}>{formatMonthYearPT(month)}</option>
                                ))}
                              </select>
                            </>
                          )}
                        </div>
                      )}
                      {c.isPotentialInvoicePayment && (
                        <span className="text-[10px] text-amber-700 dark:text-amber-300">
                          {c.isInvoicePayment
                            ? 'Pagamento de fatura reconhecido; confira cartão e competência.'
                            : 'Descrição sugere pagamento de fatura; revise antes de importar.'}
                        </span>
                      )}
                      <div className="flex items-center justify-end gap-3">
                        {!c.isInvoicePayment && (
                          <select
                            aria-label={`Categoria de ${c.description}`}
                            value={c.suggestedCategoryId}
                            onChange={(e) => handleCategoryChange(c.id, e.target.value)}
                            className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 max-w-[150px] truncate"
                          >
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        )}
                      <div className="text-right min-w-[90px]">
                        <span
                          className={`font-mono font-bold tabular-nums flex items-center justify-end gap-0.5 ${
                            c.type === 'income' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {c.type === 'income' ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" />
                          )}
                          {c.type === 'expense' ? '-' : '+'}
                          {c.originalCurrency && c.sourceAmount !== undefined
                            ? c.exchangeRate
                              ? `${formatForeignCurrency(c.sourceAmount, c.originalCurrency as CurrencyCode)} → ${formatBRL(c.amount)}`
                              : formatForeignCurrency(c.sourceAmount, c.originalCurrency as CurrencyCode)
                            : formatBRL(c.amount)}
                        </span>
                      </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Info className="h-4 w-4 shrink-0 text-slate-400" />
            <span>
              Ao confirmar, os lançamentos entram como conciliação bancária realizada (`reconciled: true`).
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Fechar
            </button>
            {candidates.length > 0 && (
              <button
                type="button"
                onClick={handleCommit}
                disabled={summary.selectedCount === 0 || summary.invalidInvoicePayments > 0 || Boolean(statementCurrencyError)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <FileCheck2 className="h-4 w-4" />
                Confirmar e Importar {summary.selectedCount} Lançamento(s)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
