/** Lançamentos do extrato com saldo corrido. Parte de AccountsTab (ver AccountsTab.tsx). */
import { CategoryIconBadge } from '../../ui/CategoryIconBadge';
import { formatBRL, formatShortDateBR } from '../../../domain/finance/financeRules';
import { confirmTransactionDeletion } from '../../../domain/finance/transactionDeletion';
import { Check, CheckCircle2, Copy, Edit3, Trash2 } from 'lucide-react';
import type { AccountDetailContext } from './accountsTabContext';

export function AccountStatementEntries({ form }: { form: AccountDetailContext }) {
  const {
    accMap,
    catMap,
    filteredStatementEntries,
    getMethodLabel,
    onDeleteTransaction,
    onDuplicateTransaction,
    onEditTransaction,
    onToggleTransactionStatus,
  } = form;
  return (
    <>
{/* Statement Entries */}
        {filteredStatementEntries.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-slate-900">
              Nenhuma movimentação encontrada nesta conta para o filtro selecionado.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Registre um pagamento, depósito PIX ou transferência entre contas para movimentar o extrato.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Statement Cards (< sm) */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {filteredStatementEntries.map((entry) => {
                const tx = entry.transaction;
                const cat = catMap.get(tx.categoryId);
                const counterpartyName = entry.isTransferIncoming
                  ? accMap.get(tx.accountId || '')?.name || 'Outra Conta'
                  : entry.isTransferOutgoing
                  ? accMap.get(tx.destinationAccountId || '')?.name || 'Outra Conta'
                  : null;

                return (
                  <div key={tx.id} className="p-4 space-y-2 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CategoryIconBadge
                          icon={cat?.icon}
                          color={cat?.color}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 break-words sm:truncate">
                            {tx.description}
                          </p>
                          <p className="text-[11px] text-slate-500 break-words sm:truncate">
                            <span className="font-mono tabular-nums">
                              {formatShortDateBR(tx.date)}
                            </span>
                            <span aria-hidden="true"> · </span>
                            <span>
                              {entry.isTransferIncoming
                                ? `Recebido de ${counterpartyName}`
                                : entry.isTransferOutgoing
                                ? `Enviado p/ ${counterpartyName}`
                                : cat?.name || 'Geral'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p
                          className={`text-xs font-extrabold font-mono tabular-nums ${
                            entry.direction === 'credit'
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {entry.direction === 'credit' ? '+' : '-'}
                          {formatBRL(tx.amount)}
                        </p>
                        <p className="text-[10px] font-mono tabular-nums text-slate-500">
                          Saldo: {formatBRL(entry.runningBalanceAfter)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px]">
                      <button
                        type="button"
                        onClick={() => onToggleTransactionStatus(tx.id)}
                        className={`font-semibold ${
                          tx.status === 'paid'
                            ? 'text-emerald-700'
                            : 'text-amber-700 underline'
                        }`}
                      >
                        {tx.status === 'paid' ? '✓ Compensado no Saldo' : '⏳ Pendente (Efetivar)'}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEditTransaction(tx)}
                          className="text-slate-500 hover:text-slate-900 font-medium"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => { if (confirmTransactionDeletion(tx)) onDeleteTransaction(tx.id); }}
                          className="text-rose-600 hover:text-rose-800 font-medium"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Real Bank Statement Table (>= sm) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-500">
                    <th className="py-3 pl-6 pr-3 whitespace-nowrap">Data</th>
                    <th className="py-3 px-3">Histórico / Lançamento</th>
                    <th className="py-3 px-3 whitespace-nowrap">Meio</th>
                    <th className="py-3 px-3 whitespace-nowrap">Compensação</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Movimento (R$)</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">
                      Saldo Após Lançamento
                    </th>
                    <th className="py-3 pl-3 pr-6 text-right whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredStatementEntries.map((entry) => {
                    const tx = entry.transaction;
                    const cat = catMap.get(tx.categoryId);
                    const counterpartyName = entry.isTransferIncoming
                      ? accMap.get(tx.accountId || '')?.name || 'Outra Conta'
                      : entry.isTransferOutgoing
                      ? accMap.get(tx.destinationAccountId || '')?.name || 'Outra Conta'
                      : null;

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/90 transition-colors">
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
                              <p className="font-semibold text-slate-900">{tx.description}</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {entry.isTransferIncoming ? (
                                  <span className="font-medium text-emerald-700">
                                    Transferência recebida de {counterpartyName}
                                  </span>
                                ) : entry.isTransferOutgoing ? (
                                  <span className="font-medium text-slate-700">
                                    Transferência enviada para {counterpartyName}
                                  </span>
                                ) : (
                                  <span>
                                    {cat?.name || 'Geral'}
                                  </span>
                                )}
                                {tx.notes && (
                                  <>
                                    <span aria-hidden="true"> · </span>
                                    <span className="italic">{tx.notes}</span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
                          {getMethodLabel(tx.paymentMethod)}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onToggleTransactionStatus(tx.id)}
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              tx.status === 'paid'
                                ? 'text-emerald-700 hover:text-emerald-900'
                                : 'text-amber-700 underline hover:text-amber-900'
                            }`}
                          >
                            {tx.status === 'paid' ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Compensado</span>
                              </>
                            ) : (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                <span>Previsto (Efetivar)</span>
                              </>
                            )}
                          </button>
                        </td>

                        <td
                          className={`py-3 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                            entry.direction === 'credit'
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {entry.direction === 'credit' ? '+' : '-'}
                          {formatBRL(tx.amount)}
                        </td>

                        <td
                          data-testid="statement-running-balance-cell"
                          className={`py-3 px-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                            entry.runningBalanceAfter >= 0
                              ? 'text-slate-900'
                              : 'text-rose-700'
                          }`}
                        >
                          {formatBRL(entry.runningBalanceAfter)}
                        </td>

                        <td className="py-3 pl-3 pr-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            {onDuplicateTransaction && (
                              <button
                                type="button"
                                onClick={() => onDuplicateTransaction(tx)}
                                title="Duplicar lançamento"
                                className="rounded p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-900"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onEditTransaction(tx)}
                              title="Editar lançamento"
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-900"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const deleteGroup = Boolean(tx.installmentGroupId);
                                if (confirmTransactionDeletion(tx, deleteGroup)) onDeleteTransaction(tx.id, deleteGroup);
                              }}
                              title="Excluir lançamento"
                              className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
    </>
  );
}
