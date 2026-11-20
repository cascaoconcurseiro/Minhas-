/** Resultado da leitura: candidatos para lançar, com categoria e pagamento de fatura. Parte de BankReconciliationModal (ver BankReconciliationModal.tsx). */
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, UploadCloud } from 'lucide-react';
import { formatBRL, formatMonthYearPT } from '../../../domain/finance/financeRules';
import { formatForeignCurrency } from '../../../domain/trips/travelRules';
import { CurrencyCode } from '../../../types/finance';
import type { BankReconciliationModalContext } from './bankReconciliationContext';

export function ReconciliationCandidates({ form }: { form: BankReconciliationModalContext }) {
  const {
    candidates,
    cards,
    categories,
    currentAccount,
    exchangeRateInput,
    fileInputId,
    fileInputRef,
    filteredCandidates,
    getOpenInvoiceMonths,
    handleCategoryChange,
    handleDescriptionChange,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleExchangeRateChange,
    handleFileChange,
    handleInvoiceCardChange,
    handleInvoiceMonthChange,
    handleInvoicePaymentChange,
    handleProcessRawText,
    handleSelectAll,
    handleSelectOnlyNew,
    handleToggleCandidate,
    isDragging,
    parseFeedback,
    pasteMode,
    pastedContent,
    rowLimit,
    setPastedContent,
    setRowLimit,
    setShowOnlyNew,
    showOnlyNew,
    statementCurrencyError,
    statementMeta,
    successCount,
    summary,
    targetCurrency,
  } = form;
  return (
    <>
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
                {filteredCandidates.slice(0, rowLimit).map((c) => (
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
                        {c.matchedPendingId && (
                          <div
                            data-testid={`pending-match-${c.id}`}
                            className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5"
                          >
                            <span>Quita a conta pendente "{c.matchedPendingDescription}" (não cria lançamento novo)</span>
                          </div>
                        )}
                        {c.learnedSharing && (
                          <div
                            data-testid={`learned-sharing-${c.id}`}
                            className="text-[11px] text-indigo-700 dark:text-indigo-400 mt-0.5"
                          >
                            Dividido com {c.learnedSharing.memberName} (
                            {c.learnedSharing.splitMode === 'half' ? 'metade' : `${c.learnedSharing.percentage}%`}) como nas últimas vezes
                          </div>
                        )}
                        {c.suggestedCategorySource === 'history' && !c.isInvoicePayment && (
                          <span className="block text-[10px] text-slate-400">Categoria pelo seu histórico</span>
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
                {filteredCandidates.length > rowLimit && (
                  <button
                    type="button"
                    data-testid="reconciliation-show-more"
                    onClick={() => setRowLimit((limit) => limit + 200)}
                    className="w-full px-4 py-3 text-xs font-bold text-blue-700 hover:bg-slate-50"
                  >
                    Mostrar mais ({filteredCandidates.length - rowLimit})
                  </button>
                )}
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
    </>
  );
}
