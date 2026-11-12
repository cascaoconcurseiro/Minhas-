import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Edit3,
  FileText,
  FolderOpen,
  Search,
  Tag,
  X,
} from 'lucide-react';
import {
  BankAccount,
  Category,
  CreditCard,
  FamilyMember,
  Transaction,
} from '../types/finance';
import {
  formatBRL,
  formatMonthYearPT,
  formatShortDateBR,
  formatShortMonthPT,
  searchTransactionsGlobal,
  summarizeGlobalSearchResults,
} from '../utils/financeRules';
import { CategoryIconBadge } from './CategoryIconBadge';
import { CardNetworkMark } from './CardNetworkMark';
import { InstitutionMark } from './InstitutionMark';

interface GlobalSearchPanelProps {
  query: string;
  onChangeQuery: (newQuery: string) => void;
  onClearSearch: () => void;
  selectedMonth: string;
  transactions: Transaction[];
  categories: Category[];
  accounts: BankAccount[];
  cards: CreditCard[];
  familyMembers: FamilyMember[];
  onToggleStatus: (txId: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onJumpToTransactionInLedger: (tx: Transaction) => void;
}

export const GlobalSearchPanel: React.FC<GlobalSearchPanelProps> = ({
  query,
  onChangeQuery,
  onClearSearch,
  selectedMonth,
  transactions,
  categories,
  accounts,
  cards,
  familyMembers,
  onToggleStatus,
  onEditTransaction,
  onJumpToTransactionInLedger,
}) => {
  const [scope, setScope] = useState<'all_months' | 'selected_month'>('all_months');
  const [fieldFilter, setFieldFilter] = useState<
    'all' | 'description' | 'category' | 'notes'
  >('all');
  const [typeFilter, setTypeFilter] = useState<
    'all' | 'expense' | 'income' | 'credit_card' | 'shared'
  >('all');

  const catMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const accMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name])),
    [accounts]
  );
  const cardMap = useMemo(
    () => new Map(cards.map((c) => [c.id, c.name])),
    [cards]
  );
  const memberMap = useMemo(
    () => new Map(familyMembers.map((m) => [m.id, m.name])),
    [familyMembers]
  );

  // Base counts for scope switcher
  const allMonthsBaseMatches = useMemo(
    () =>
      searchTransactionsGlobal(transactions, categories, {
        query,
        scope: 'all_months',
        fieldFilter: 'all',
        typeFilter: 'all',
      }),
    [transactions, categories, query]
  );

  const selectedMonthBaseMatches = useMemo(
    () =>
      searchTransactionsGlobal(transactions, categories, {
        query,
        scope: 'selected_month',
        selectedMonth,
        fieldFilter: 'all',
        typeFilter: 'all',
      }),
    [transactions, categories, query, selectedMonth]
  );

  // Base counts for field filter within active scope & type
  const activeScopeBaseMatches = useMemo(
    () =>
      searchTransactionsGlobal(transactions, categories, {
        query,
        scope,
        selectedMonth,
        typeFilter,
        fieldFilter: 'all',
      }),
    [transactions, categories, query, scope, selectedMonth, typeFilter]
  );

  const fieldCounts = useMemo(
    () => summarizeGlobalSearchResults(activeScopeBaseMatches),
    [activeScopeBaseMatches]
  );

  // Final filtered matches
  const filteredMatches = useMemo(
    () =>
      searchTransactionsGlobal(transactions, categories, {
        query,
        scope,
        selectedMonth,
        typeFilter,
        fieldFilter,
      }),
    [transactions, categories, query, scope, selectedMonth, typeFilter, fieldFilter]
  );

  const summary = useMemo(
    () => summarizeGlobalSearchResults(filteredMatches),
    [filteredMatches]
  );

  if (!query.trim()) {
    return null;
  }

  return (
    <section
      aria-label="Resultados da Busca Global"
      className="mx-auto w-full max-w-7xl px-6 pt-5"
    >
      <div className="rounded-xl border border-emerald-300 bg-white shadow-sm overflow-hidden">
        {/* Top Header of Global Search Panel */}
        <div className="border-b border-slate-200 bg-slate-900 px-5 py-3.5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Search className="h-4 w-4 text-emerald-400 shrink-0" />
            <div>
              <h2 className="text-sm font-bold font-display">
                Busca Global de Transações:{' '}
                <span className="text-emerald-300">"{query.trim()}"</span>
              </h2>
              <p className="text-xs text-slate-300">
                Filtrando instantaneamente por descrição, categoria ou nota em qualquer aba
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300 font-mono tabular-nums">
              {summary.totalCount}{' '}
              {summary.totalCount === 1 ? 'resultado' : 'resultados'}
            </span>
            <button
              type="button"
              onClick={onClearSearch}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Fechar Busca (Esc)
            </button>
          </div>
        </div>

        {/* Filter Controls Bar: Scope + Field (Descrição / Categoria / Nota) + Type */}
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Scope Filter */}
            <div
              role="group"
              aria-label="Período da busca"
              className="inline-flex items-center rounded-lg bg-slate-200/80 p-1"
            >
              <button
                type="button"
                onClick={() => setScope('all_months')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  scope === 'all_months'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos os Meses ({allMonthsBaseMatches.length})
              </button>
              <button
                type="button"
                onClick={() => setScope('selected_month')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  scope === 'selected_month'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {formatMonthYearPT(selectedMonth)} ({selectedMonthBaseMatches.length})
              </button>
            </div>

            {/* Field Filter: All vs Description vs Category vs Notes */}
            <div
              role="group"
              aria-label="Filtrar por campo"
              className="inline-flex flex-wrap items-center rounded-lg bg-slate-200/80 p-1 gap-0.5"
            >
              <button
                type="button"
                onClick={() => setFieldFilter('all')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  fieldFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos os Campos
              </button>
              <button
                type="button"
                onClick={() => setFieldFilter('description')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  fieldFilter === 'description'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="h-3 w-3 text-slate-500" />
                Descrição ({fieldCounts.matchedByDescriptionCount})
              </button>
              <button
                type="button"
                onClick={() => setFieldFilter('category')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  fieldFilter === 'category'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderOpen className="h-3 w-3 text-slate-500" />
                Categoria ({fieldCounts.matchedByCategoryCount})
              </button>
              <button
                type="button"
                onClick={() => setFieldFilter('notes')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  fieldFilter === 'notes'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Tag className="h-3 w-3 text-slate-500" />
                Nota ({fieldCounts.matchedByNoteCount})
              </button>
            </div>
          </div>

          {/* Type Filter */}
          <div
            role="group"
            aria-label="Filtrar por tipo de lançamento"
            className="inline-flex flex-wrap items-center rounded-lg bg-slate-200/80 p-1 gap-0.5"
          >
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'expense', label: 'Despesas Conta' },
                { id: 'credit_card', label: 'Cartão' },
                { id: 'income', label: 'Receitas' },
                { id: 'shared', label: 'Compartilhados' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeFilter(t.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  typeFilter === t.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary KPI Strip for Search Results */}
        <div className="border-b border-slate-200 bg-white px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] font-medium text-slate-500">
              Lançamentos Filtrados
            </p>
            <p className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {summary.totalCount} {summary.totalCount === 1 ? 'item' : 'itens'}
              {summary.pendingCount > 0 && (
                <span className="ml-1.5 text-xs font-normal text-amber-700">
                  · {summary.pendingCount} pendente(s)
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500">
              Soma de Receitas
            </p>
            <p className="text-sm font-bold text-emerald-700 font-mono tabular-nums mt-0.5">
              + {formatBRL(summary.incomeTotal)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500">
              Soma de Despesas
            </p>
            <p className="text-sm font-bold text-rose-700 font-mono tabular-nums mt-0.5">
              - {formatBRL(summary.expenseTotal)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500">
              Saldo dos Resultados
            </p>
            <p
              className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${
                summary.netTotal >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatBRL(summary.netTotal)}
            </p>
          </div>
        </div>

        {/* Results List / Table */}
        {filteredMatches.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-semibold text-slate-900">
              Nenhuma transação encontrada para "{query}" com os filtros atuais.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Experimente buscar por uma descrição (ex: "Coco Bambu"), categoria (ex: "Saúde" ou "Moradia") ou palavra da nota (ex: "PIX", "mamãe", "NF-e").
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {scope !== 'all_months' && (
                <button
                  type="button"
                  onClick={() => setScope('all_months')}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Buscar em Todos os Meses
                </button>
              )}
              {fieldFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFieldFilter('all')}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Buscar em Todos os Campos
                </button>
              )}
              <button
                type="button"
                onClick={() => onChangeQuery('Saúde')}
                className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                Testar "Saúde"
              </button>
              <button
                type="button"
                onClick={() => onChangeQuery('mamãe')}
                className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                Testar nota "mamãe"
              </button>
              <button
                type="button"
                onClick={onClearSearch}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Limpar Busca
              </button>
            </div>
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="py-2.5 px-4">Data / Mês</th>
                  <th className="py-2.5 px-4">Descrição & Nota</th>
                  <th className="py-2.5 px-4">Categoria</th>
                  <th className="py-2.5 px-4">Conta / Cartão</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Valor</th>
                  <th className="py-2.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredMatches.map((item) => {
                  const tx = item.transaction;
                  const cat = catMap.get(tx.categoryId);
                  const originName = tx.creditCardId
                    ? `Cartão ${cardMap.get(tx.creditCardId) || ''}`
                    : accMap.get(tx.accountId || '') || 'Conta';
                  const originAccount = tx.creditCardId
                    ? null
                    : accounts.find((account) => account.id === tx.accountId) ?? null;
                  const originCard = tx.creditCardId
                    ? cards.find((card) => card.id === tx.creditCardId) ?? null
                    : null;
                  const sharedMemberName = tx.sharedMemberId
                    ? memberMap.get(tx.sharedMemberId)
                    : undefined;

                  const matchedFields: string[] = [];
                  if (item.matchedByDescription) matchedFields.push('Descrição');
                  if (item.matchedByCategory) matchedFields.push('Categoria');
                  if (item.matchedByTag) matchedFields.push('Tag');
                  if (item.matchedByNote && !item.matchedByTag) matchedFields.push('Nota');

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/90 transition-colors"
                    >
                      {/* Date & Month */}
                      <td className="py-3 px-4 whitespace-nowrap align-top">
                        <div className="font-mono font-semibold text-slate-900 tabular-nums">
                          {formatShortDateBR(tx.date)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatShortMonthPT(tx.competenceMonth)}
                        </div>
                      </td>

                      {/* Description + Note + Tags + Match Reason */}
                      <td className="py-3 px-4 align-top">
                        <div className="font-semibold text-slate-900 flex flex-wrap items-center gap-1.5">
                          <span>{tx.description}</span>
                          {tx.installmentTotal && tx.installmentTotal > 1 && (
                            <span className="text-[11px] font-mono text-slate-500">
                              ({tx.installmentNumber}/{tx.installmentTotal})
                            </span>
                          )}
                        </div>

                        {tx.tags && tx.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {tx.tags.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => onChangeQuery(`#${tag}`)}
                                className="inline-flex items-center gap-0.5 rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
                              >
                                <span className="font-mono text-emerald-600">#</span>
                                <span>{tag}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {tx.notes && (
                          <p className="mt-0.5 text-[11px] text-slate-600">
                            <span className="font-semibold text-slate-700">
                              Nota:
                            </span>{' '}
                            {tx.notes}
                          </p>
                        )}

                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span>
                            Encontrado em:{' '}
                            <strong className="font-medium text-emerald-800">
                              {matchedFields.join(', ') || ' Geral'}
                            </strong>
                          </span>
                          {tx.isShared && sharedMemberName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-600">
                                Compartilhado c/ {sharedMemberName} (
                                {formatBRL(tx.sharedAmount || 0)})
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <CategoryIconBadge
                            icon={cat?.icon || 'tag'}
                            color={cat?.color || '#64748b'}
                            size="sm"
                          />
                          <div>
                            <div className="font-medium text-slate-900">
                              {item.categoryName}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Account / Card */}
                      <td className="py-3 px-4 align-top whitespace-nowrap text-slate-600">
                        <span className="inline-flex items-center gap-2">
                          {originAccount ? (
                            <InstitutionMark
                              institution={originAccount.institution}
                              accountName={originAccount.name}
                              color={originAccount.color}
                              size="xs"
                            />
                          ) : originCard ? (
                            <CardNetworkMark brand={originCard.brand} compact />
                          ) : null}
                          <span>{originName}</span>
                        </span>
                      </td>

                      {/* Status Toggle Button */}
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onToggleStatus(tx.id)}
                          aria-label={
                            tx.status === 'paid'
                              ? `Marcar ${tx.description} como pendente`
                              : `Efetivar ${tx.description}`
                          }
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                            tx.status === 'paid'
                              ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                          }`}
                        >
                          <Check className="h-3 w-3" />
                          {tx.status === 'paid' ? 'Pago' : 'Pendente'}
                        </button>
                      </td>

                      {/* Amount */}
                      <td
                        className={`py-3 px-4 align-top whitespace-nowrap text-right font-mono font-bold tabular-nums ${
                          tx.type === 'income'
                            ? 'text-emerald-700'
                            : tx.type === 'expense'
                              ? 'text-slate-900'
                              : 'text-blue-700'
                        }`}
                      >
                        {tx.type === 'income' ? '+ ' : tx.type === 'expense' ? '- ' : ''}
                        {formatBRL(tx.amount)}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3 px-4 align-top whitespace-nowrap text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditTransaction(tx)}
                            aria-label={`Editar ${tx.description}`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <Edit3 className="h-3 w-3" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => onJumpToTransactionInLedger(tx)}
                            aria-label={`Ver ${tx.description} no extrato`}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                          >
                            <span>Extrato</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
