/** Lista de lançamentos por dia (celular e computador). Parte de TransactionsTab (ver TransactionsTab.tsx). */
import { limitDailyGroups } from './transactionsTabConfig';
import { formatBRL, formatShortDateBR } from '../../../domain/finance/financeRules';
import { describeTransferForeignLeg } from '../../../domain/finance/transferRules';
import { SwipeableTransactionCard } from '../SwipeableTransactionCard';
import { CategoryIconBadge } from '../../ui/CategoryIconBadge';
import { Check, Copy, Edit3, FastForward, RotateCcw, Trash2 } from 'lucide-react';
import type { TransactionsTabContext } from './transactionsTabContext';

export function LedgerListBody({ form }: { form: TransactionsTabContext }) {
  const {
    accMap,
    accounts,
    cardMap,
    catMap,
    dailyGroups,
    getMethodLabel,
    getTransactionOriginMarks,
    groupsWithFutureInstallments,
    handleSearchInputChange,
    isReconcileMode,
    monthTransactions,
    onAnticipateInstallments,
    onDuplicateTransaction,
    onEditTransaction,
    onOpenNewTransaction,
    onReverseAnticipation,
    onToggleStatus,
    requestTransactionDeletion,
    rowLimit,
    selectedTxIds,
    setActionSheetTx,
    setCategoryFilter,
    setRowLimit,
    setSelectedTxIds,
    setSourceFilter,
    setStatusFilter,
    setTagFilter,
    setTypeFilter,
    toggleSelectTx,
  } = form;
  return (
    <>
{monthTransactions.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-semibold text-slate-900">
              Nenhum lançamento encontrado com os filtros aplicados.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Limpe os filtros ou registre uma nova movimentação manual no mês.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  handleSearchInputChange('');
                  setTypeFilter('all');
                  setStatusFilter('all');
                  setCategoryFilter('all');
                  setSourceFilter('all');
                  setTagFilter('all');
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Limpar Filtros
              </button>
              <button
                type="button"
                onClick={() => onOpenNewTransaction('expense')}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Novo Lançamento
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Mobile Native Card List Grouped by Date (< sm screens) */}
            <div className="block sm:hidden" data-testid="mobile-grouped-ledger">
              {/* Ergonomic Mobile Gestures Tip Bar */}
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-medium">
                  Deslize p/ os lados ou segure para ações
                </span>
                <span className="text-[10px] text-slate-400">
                  ← Menu | Efetivar →
                </span>
              </div>

              <div className="divide-y divide-slate-200">
                {limitDailyGroups(dailyGroups, rowLimit).map((group) => (
                  <div key={group.date} data-testid={`daily-group-${group.date}`}>
                    {/* Daily Group Header with Subtotal */}
                    <div className="flex items-center justify-between gap-2 bg-slate-100/80 px-4 py-2 border-b border-slate-200/80">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800">
                          {group.dayHeaderLabel}
                        </span>
                        {group.weekdayLabel && (
                          <span className="text-[11px] text-slate-500 ml-1.5">
                            · {group.weekdayLabel}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums shrink-0">
                        <span className="text-slate-500 mr-1">Saldo do dia:</span>
                        <strong
                          className={
                            group.dayNet > 0
                              ? 'text-emerald-700 font-bold'
                              : group.dayNet < 0
                              ? 'text-rose-700 font-bold'
                              : 'text-slate-700 font-bold'
                          }
                        >
                          {group.dayNet > 0 ? '+' : ''}
                          {formatBRL(group.dayNet)}
                        </strong>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {group.transactions.map((tx) => {
                        const cat = catMap.get(tx.categoryId);
                        const originMarks = getTransactionOriginMarks(tx);
                        const originLabel = tx.creditCardId
                          ? `Cartão ${cardMap.get(tx.creditCardId) || ''}`
                          : tx.type === 'transfer'
                          ? `${accMap.get(tx.accountId || '') || 'Origem'} → ${
                              accMap.get(tx.destinationAccountId || '') || 'Destino'
                            }${describeTransferForeignLeg(tx, accounts)}`
                          : accMap.get(tx.accountId || '') || 'Carteira';

                        const installmentMeta =
                          tx.installmentTotal && tx.installmentTotal > 1
                            ? `${tx.installmentNumber}/${tx.installmentTotal}`
                            : null;

                        return (
                          <div key={tx.id} className="flex items-stretch">
                            {isReconcileMode && (
                              <label className="flex items-center justify-center pl-3.5 pr-1 bg-white cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedTxIds.includes(tx.id)}
                                  onChange={() => toggleSelectTx(tx.id)}
                                  aria-label={`Selecionar ${tx.description} para conferência`}
                                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                              </label>
                            )}
                            <div className="flex-1 min-w-0">
                              <SwipeableTransactionCard
                                transaction={tx}
                                category={cat}
                                originLabel={originLabel}
                                originMarks={originMarks}
                                installmentMeta={installmentMeta}
                                onToggleStatus={onToggleStatus}
                                onEdit={onEditTransaction}
                                onDuplicate={onDuplicateTransaction}
                                onDelete={requestTransactionDeletion}
                                onOpenActionSheet={(targetTx) => setActionSheetTx(targetTx)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {monthTransactions.length > rowLimit && (
                  <button
                    type="button"
                    data-testid="ledger-show-more"
                    onClick={() => setRowLimit((limit) => limit + 120)}
                    className="w-full px-4 py-3 text-xs font-bold text-blue-700 hover:bg-slate-50"
                  >
                    Mostrar mais ({monthTransactions.length - rowLimit})
                  </button>
                )}
              </div>
            </div>

            {/* Desktop Table View (>= sm screens) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/40 text-xs font-semibold text-slate-500">
                    {isReconcileMode && (
                      <th className="py-3 pl-5 pr-2 w-10">
                        <input
                          type="checkbox"
                          aria-label="Selecionar todos os lançamentos visíveis"
                          checked={
                            monthTransactions.length > 0 &&
                            selectedTxIds.length === monthTransactions.length
                          }
                          onChange={(e) =>
                            setSelectedTxIds(
                              e.target.checked ? monthTransactions.map((t) => t.id) : []
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                    )}
                    <th className="py-3 pl-6 pr-3 whitespace-nowrap">Data</th>
                    <th className="py-3 px-3">Descrição, Categoria & Subcategoria</th>
                    <th className="py-3 px-3 whitespace-nowrap">Conta / Cartão</th>
                    <th className="py-3 px-3 whitespace-nowrap">Situação</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Valor (R$)</th>
                    <th className="py-3 pl-3 pr-6 text-right whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {monthTransactions.slice(0, rowLimit).map((tx) => {
                    const cat = catMap.get(tx.categoryId);
                    const catName =
                      tx.type === 'transfer'
                        ? 'Transferência entre Contas'
                        : tx.isInvoicePayment
                        ? 'Pagamento de Fatura'
                        : cat?.name || 'Geral';

                    const originLabel = tx.creditCardId
                      ? `Cartão ${cardMap.get(tx.creditCardId) || ''}`
                      : tx.type === 'transfer'
                      ? `${accMap.get(tx.accountId || '') || 'Origem'} → ${
                          accMap.get(tx.destinationAccountId || '') || 'Destino'
                        }${describeTransferForeignLeg(tx, accounts)}`
                      : accMap.get(tx.accountId || '') || 'Carteira';
                    const originMarks = getTransactionOriginMarks(tx);

                    const installmentMeta =
                      tx.installmentTotal && tx.installmentTotal > 1
                        ? `Parcela ${tx.installmentNumber}/${tx.installmentTotal}`
                        : tx.recurrence === 'fixed'
                        ? 'Fixo Mensal'
                        : 'Único';

                    return (
                      <tr
                        key={tx.id}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setActionSheetTx(tx);
                        }}
                        title="Clique com botão direito para abrir menu de ações"
                        className={`hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors group cursor-context-menu ${
                          isReconcileMode && selectedTxIds.includes(tx.id)
                            ? 'bg-emerald-50/40'
                            : ''
                        }`}
                      >
                        {isReconcileMode && (
                          <td className="py-3 pl-5 pr-2">
                            <input
                              type="checkbox"
                              checked={selectedTxIds.includes(tx.id)}
                              onChange={() => toggleSelectTx(tx.id)}
                              aria-label={`Selecionar ${tx.description}`}
                              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                        )}
                        <td className="py-3 pl-6 pr-3 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                          {formatShortDateBR(tx.date)}
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <CategoryIconBadge
                              icon={cat?.icon}
                              color={cat?.color}
                              size="sm"
                            />
                            <div>
                              <div className="font-semibold text-slate-900 flex flex-wrap items-center gap-1.5">
                                <span>{tx.description}</span>
                                {tx.isInvoicePayment && (
                                  <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800 border border-violet-200">
                                    Pagamento de Fatura (Cascata)
                                  </span>
                                )}
                                {tx.isAnticipated && (
                                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                                    Antecipada
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span className="font-medium text-slate-700">
                                  {catName}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{getMethodLabel(tx.paymentMethod)}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">{installmentMeta}</span>
                                {tx.installmentPurchaseTotal !== undefined && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-medium text-violet-700">
                                      Compra total {formatBRL(tx.installmentPurchaseTotal)}
                                    </span>
                                  </>
                                )}
                                {tx.notes && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="italic text-slate-500">{tx.notes}</span>
                                  </>
                                )}
                              </div>
                              {tx.tags && tx.tags.length > 0 && (
                                <div
                                  data-testid="ledger-row-tags"
                                  className="mt-1 flex flex-wrap items-center gap-1"
                                >
                                  {tx.tags.map((tag) => (
                                    <button
                                      key={tag}
                                      type="button"
                                      data-testid="ledger-tag-badge"
                                      onClick={() =>
                                        setTagFilter((prev) => (prev === tag ? 'all' : tag))
                                      }
                                      title={`Filtrar pela tag #${tag}`}
                                      className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
                                    >
                                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                        #
                                      </span>
                                      <span>{tag}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-xs text-slate-700 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            {originMarks}
                            {originLabel}
                          </span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onToggleStatus(tx.id)}
                            aria-label={`Alternar situação de ${tx.description}`}
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                              tx.isInvoicePayment
                                ? 'text-violet-700 hover:text-violet-900 underline decoration-violet-400/70 underline-offset-2'
                                : tx.status === 'paid'
                                ? 'text-emerald-700 hover:text-emerald-900'
                                : 'text-amber-700 hover:text-amber-900 underline decoration-amber-400/70 underline-offset-2'
                            }`}
                          >
                            {tx.isInvoicePayment ? (
                              <>
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Estornar Fatura</span>
                              </>
                            ) : (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                <span>
                                  {tx.status === 'paid'
                                    ? tx.type === 'income'
                                      ? 'Recebido'
                                      : 'Efetivado'
                                    : tx.creditCardId
                                    ? 'Na Fatura'
                                    : 'Pendente (Efetivar)'}
                                </span>
                              </>
                            )}
                          </button>
                        </td>

                        <td
                          className={`py-3 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                            tx.type === 'income'
                              ? 'text-emerald-700'
                              : tx.type === 'transfer'
                              ? 'text-slate-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                          {formatBRL(tx.installmentPurchaseTotal ?? tx.amount)}
                          {tx.installmentPurchaseTotal !== undefined && (
                            <div className="text-xs font-medium text-slate-500">
                              Em {tx.installmentTotal}x · parcela {tx.installmentNumber}/{tx.installmentTotal}: {formatBRL(tx.amount)}
                            </div>
                          )}
                        </td>

                        <td className="py-3 pl-3 pr-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            {tx.installmentGroupId &&
                              groupsWithFutureInstallments.has(tx.installmentGroupId) &&
                              onAnticipateInstallments && (
                                <button
                                  type="button"
                                  data-testid="ledger-anticipate-btn"
                                  onClick={() =>
                                    onAnticipateInstallments(tx.installmentGroupId!, 0)
                                  }
                                  title="Adiantar parcelas futuras desta compra para o mês atual"
                                  className="inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-800 hover:bg-violet-100 transition-colors"
                                >
                                  <FastForward className="h-3 w-3" />
                                  Adiantar
                                </button>
                              )}
                            {tx.isAnticipated && onReverseAnticipation && (
                              <button
                                type="button"
                                data-testid="ledger-reverse-anticipation-btn"
                                onClick={() => onReverseAnticipation(tx.id)}
                                title="Desfazer antecipação desta parcela"
                                className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-100 transition-colors"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Desfazer Antecip.
                              </button>
                            )}
                            {onDuplicateTransaction && (
                              <button
                                type="button"
                                onClick={() => onDuplicateTransaction(tx)}
                                aria-label={`Duplicar ${tx.description}`}
                                title="Duplicar lançamento"
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onEditTransaction(tx)}
                              aria-label={`Editar ${tx.description}`}
                              title="Editar lançamento"
                              className="rounded p-1.5 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                requestTransactionDeletion(tx.id, Boolean(tx.installmentGroupId))
                              }
                              aria-label={`Excluir ${tx.description}`}
                              title={
                                tx.isInvoicePayment
                                  ? 'Excluir pagamento de fatura e refazer efeito cascata'
                                  : 'Excluir lançamento'
                              }
                              className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {monthTransactions.length > rowLimit && (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <button
                          type="button"
                          data-testid="ledger-show-more-table"
                          onClick={() => setRowLimit((limit) => limit + 120)}
                          className="w-full px-4 py-3 text-xs font-bold text-blue-700 hover:bg-slate-50"
                        >
                          Mostrar mais ({monthTransactions.length - rowLimit})
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </>
  );
}
