/** Busca e filtros do extrato. Parte de TransactionsTab (ver TransactionsTab.tsx). */
import { Plus, Search, Tag } from 'lucide-react';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import { CardNetworkMark } from '../../cards/CardNetworkMark';
import type { TransactionsTabContext } from './transactionsTabContext';

export function LedgerFilters({ form }: { form: TransactionsTabContext }) {
  const {
    accounts,
    cards,
    categories,
    categoryFilter,
    effectiveSearchQuery,
    handleSearchInputChange,
    onOpenNewTransaction,
    selectedSourceAccount,
    selectedSourceCard,
    setCategoryFilter,
    setSourceFilter,
    setStatusFilter,
    setTagFilter,
    setTypeFilter,
    sourceFilter,
    statusFilter,
    tagFilter,
    typeFilter,
    usedTagsInLedger,
  } = form;
  return (
    <>
{/* Filter & Search Toolbar */}
          <section className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 max-w-full">
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className={`px-3 py-2.5 sm:py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos os Lançamentos
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('expense')}
              className={`px-3 py-2.5 sm:py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === 'expense'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Despesas Conta
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('credit_card')}
              className={`px-3 py-2.5 sm:py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === 'credit_card'
                  ? 'bg-white text-violet-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Compras Cartão
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('income')}
              className={`px-3 py-2.5 sm:py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === 'income'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Receitas
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('transfer')}
              className={`px-3 py-2.5 sm:py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === 'transfer'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Transferências
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenNewTransaction('expense')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Lançar Despesa
            </button>
            <button
              type="button"
              onClick={() => onOpenNewTransaction('credit_card')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              + Compra Parcelada
            </button>
            <button
              type="button"
              onClick={() => onOpenNewTransaction('income')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
            >
              + Receita
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              aria-label="Buscar lançamento por descrição, categoria ou nota"
              value={effectiveSearchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              placeholder="Buscar descrição ou nota..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2.5 sm:py-1.5 text-sm sm:text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <select
            aria-label="Filtrar por situação"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'paid' | 'pending')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 sm:py-1.5 text-sm sm:text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
          >
            <option value="all">Todas as situações</option>
            <option value="paid">Somente Efetivados (Pagos / Recebidos)</option>
            <option value="pending">Somente Pendentes (Previstos)</option>
          </select>

          <select
            aria-label="Filtrar por categoria"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 sm:py-1.5 text-sm sm:text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
          >
            <option value="all">Todas as Categorias</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <div className="min-w-0">
            <select
              aria-label="Filtrar por conta ou cartão"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 sm:py-1.5 text-sm sm:text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
            >
              <option value="all">Todas as Contas e Cartões</option>
              <optgroup label="Contas e Carteiras">
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    Conta: {acc.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Cartões de Crédito">
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    Cartão: {card.name}
                  </option>
                ))}
              </optgroup>
            </select>
            {(selectedSourceAccount || selectedSourceCard) && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                {selectedSourceAccount ? (
                  <InstitutionMark
                    institution={selectedSourceAccount.institution}
                    accountName={selectedSourceAccount.name}
                    color={selectedSourceAccount.color}
                    size="xs"
                  />
                ) : selectedSourceCard ? (
                  <CardNetworkMark brand={selectedSourceCard.brand} compact />
                ) : null}
                <span>{selectedSourceAccount?.name || selectedSourceCard?.name}</span>
              </div>
            )}
          </div>
        </div>

        {usedTagsInLedger.length > 0 && (
          <div
            data-testid="ledger-tag-filter-bar"
            className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100"
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 mr-1">
              <Tag className="h-3 w-3 text-emerald-600" />
              Filtrar por Tag:
            </span>
            <button
              type="button"
              onClick={() => setTagFilter('all')}
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                tagFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas
            </button>
            {usedTagsInLedger.map((tag) => (
              <button
                key={tag}
                type="button"
                data-testid={`ledger-filter-tag-${tag}`}
                onClick={() => setTagFilter(tagFilter === tag ? 'all' : tag)}
                className={`inline-flex items-center gap-0.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  tagFilter === tag
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <span className="font-mono">#</span>
                <span>{tag}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
