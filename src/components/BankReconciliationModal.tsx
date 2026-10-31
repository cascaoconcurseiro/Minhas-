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
import { BankAccount, Category, Transaction } from '../types/finance';
import {
  convertCandidatesToTransactions,
  parseBankStatement,
  prepareReconciliationCandidates,
  ReconciliationCandidate,
} from '../utils/ofxParser';
import { formatBRL } from '../utils/financeRules';
import { CategoryIconBadge } from './CategoryIconBadge';

interface BankReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: BankAccount[];
  categories: Category[];
  existingTransactions: Transaction[];
  onCommitImport: (transactions: Transaction[], accountId: string) => void;
  onAddAccount?: (account: Omit<BankAccount, 'id'>) => BankAccount | void;
  defaultAccountId?: string;
}

export const BankReconciliationModal: React.FC<BankReconciliationModalProps> = ({
  isOpen,
  onClose,
  accounts,
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
  const [candidates, setCandidates] = useState<ReconciliationCandidate[]>([]);
  const [statementMeta, setStatementMeta] = useState<{
    fileFormat?: 'ofx' | 'csv' | 'unknown';
    bankId?: string;
    accountId?: string;
    fileName?: string;
  }>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedContent, setPastedContent] = useState('');
  const [successCount, setSuccessCount] = useState<number | null>(null);

  // Auto-sync defaultAccountId if provided
  React.useEffect(() => {
    if (defaultAccountId && accounts.some((a) => a.id === defaultAccountId)) {
      setSelectedAccountId(defaultAccountId);
    }
  }, [defaultAccountId, accounts]);

  const currentAccount = accounts.find((a) => a.id === selectedAccountId);

  const handleProcessRawText = (text: string, fileName?: string) => {
    setIsProcessing(true);
    setSuccessCount(null);
    try {
      const parsed = parseBankStatement(text);
      setStatementMeta({
        fileFormat: parsed.fileFormat,
        bankId: parsed.metadata.bankId,
        accountId: parsed.metadata.accountId,
        fileName: fileName || (parsed.fileFormat === 'ofx' ? 'extrato.ofx' : 'extrato.csv'),
      });

      const candList = prepareReconciliationCandidates(
        parsed.items,
        existingTransactions,
        categories,
        selectedAccountId
      );
      setCandidates(candList);
      setPasteMode(false);
    } catch (err) {
      console.error('Erro ao processar extrato bancário:', err);
    } finally {
      setIsProcessing(false);
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

  const handleDescriptionChange = (id: string, desc: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, description: desc } : c))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setCandidates((prev) =>
      prev.map((c) => ({
        ...c,
        selected: select ? true : false,
      }))
    );
  };

  const handleSelectOnlyNew = () => {
    setCandidates((prev) =>
      prev.map((c) => ({
        ...c,
        selected: !c.isDuplicate,
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
      totalCredits: Math.round(totalCredits * 100) / 100,
      totalDebits: Math.round(totalDebits * 100) / 100,
      netFlow: Math.round((totalCredits - totalDebits) * 100) / 100,
    };
  }, [candidates]);

  const handleCommit = () => {
    if (summary.selectedCount === 0) return;
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

    onCommitImport(txsToImport, targetAccId);
    setSuccessCount(txsToImport.length);
    setCandidates([]);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
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
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-2xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.institution})
                    </option>
                  ))}
                </select>
                {currentAccount && (
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: currentAccount.color }}
                    title={`Cor da conta: ${currentAccount.name}`}
                  />
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
                className="inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
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

          {/* Paste manual content box */}
          {pasteMode && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  Colar Conteúdo OFX ou Linhas CSV:
                </span>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-300">
                  Ex: Data;Descrição;Valor ou bloco &lt;STMTTRN&gt;
                </span>
              </div>
              <textarea
                rows={4}
                value={pastedContent}
                onChange={(e) => setPastedContent(e.target.value)}
                placeholder="Cole aqui o conteúdo do seu extrato bancário..."
                className="w-full rounded-lg border border-indigo-200 bg-white p-2.5 font-mono text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-indigo-800 dark:bg-slate-900 dark:text-slate-200"
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
                  className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
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
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
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
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 mb-3">
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

                    {/* Right: Category Selector + Amount */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-7 sm:pl-0">
                      <select
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
                          {c.type === 'expense' ? '-' : '+'}{formatBRL(c.amount)}
                        </span>
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
                disabled={summary.selectedCount === 0}
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
