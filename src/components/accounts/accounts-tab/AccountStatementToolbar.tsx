/** Filtros e ajuste de saldo do extrato. Parte de AccountsTab (ver AccountsTab.tsx). */
import { Building2, Clock, FileCheck2, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { formatBRL, formatMonthYearPT, parseBRLInput } from '../../../domain/finance/financeRules';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { isValidBrlBalanceInput } from './accountsTabConfig';
import type { AccountDetailContext } from './accountsTabContext';

export function AccountStatementToolbar({ form }: { form: AccountDetailContext }) {
  const {
    activeAccount,
    getAccountTypeLabel,
    isAdjustingInitial,
    onOpenNewTransaction,
    onOpenReconciliation,
    onUpdateAccountInitialBalance,
    quickInitialError,
    quickInitialStr,
    searchQuery,
    selectedMonth,
    setIsAdjustingInitial,
    setQuickInitialError,
    setQuickInitialStr,
    setSearchQuery,
    setStatementFilter,
    statementFilter,
    statementSummary,
  } = form;
  return (
    <>
{/* Bank Statement Top Header */}
            <div className="border-b border-slate-200 bg-slate-50/70 px-4 sm:px-6 py-4 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white font-bold shadow-2xs"
                    style={{ backgroundColor: activeAccount.color || '#059669' }}
                  >
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        Extrato Bancário — {activeAccount.name}
                      </h2>
                      <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {getAccountTypeLabel(activeAccount.type)}
                      </span>
                    </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Competência {formatMonthYearPT(selectedMonth)} · Saldo calculado linha a linha como no extrato do seu banco
                </p>
              </div>
            </div>

            {/* Quick Account Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {onOpenReconciliation && (
                <button
                  type="button"
                  onClick={() => onOpenReconciliation(activeAccount.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
                >
                  <FileCheck2 className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Importar OFX Nesta Conta</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsAdjustingInitial((prev) => !prev);
                  setQuickInitialStr(
                    activeAccount.initialBalance.toFixed(2).replace('.', ',')
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                <span>Ajustar Saldo Inicial</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenNewTransaction('income')}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Receita</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenNewTransaction('expense')}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Despesa</span>
              </button>
            </div>
          </div>

          {/* Inline Initial Balance Reconciler */}
          {isAdjustingInitial && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex flex-wrap items-center justify-between gap-3 animate-expand-in">
              <div className="text-xs text-emerald-950">
                <strong>Conciliação de Saldo Inicial ({activeAccount.name}):</strong> Ajuste o saldo base de implantação para que o saldo atual bata exatamente com o aplicativo do seu banco.
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs font-mono font-bold text-slate-700">R$</span>
                <CurrencyInput
                  value={quickInitialStr}
                  currency="BRL"
                  onValueChange={(value) => { setQuickInitialStr(value); setQuickInitialError(''); }}
                  className="w-32 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-mono tabular-nums text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    const parsedBalance = parseBRLInput(quickInitialStr);
                    if (!isValidBrlBalanceInput(quickInitialStr)) {
                      setQuickInitialError('Informe um saldo válido para conciliação.');
                      return;
                    }
                    onUpdateAccountInitialBalance(activeAccount.id, parsedBalance);
                    setIsAdjustingInitial(false);
                  }}
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Salvar Saldo
                </button>
              </div>
              {quickInitialError && <p role="alert" className="w-full text-right text-xs font-medium text-red-700">{quickInitialError}</p>}
            </div>
          )}

          {/* Filter & Search Bar inside Account Statement */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pt-1">
            <div className="flex overflow-x-auto no-scrollbar items-center gap-1 rounded-lg bg-slate-200/70 p-1 max-w-full">
              {[
                { id: 'all', label: 'Tudo' },
                { id: 'credit', label: 'Entradas (+)' },
                { id: 'debit', label: 'Saídas (-)' },
                { id: 'transfer', label: 'Transferências (⇄)' },
                { id: 'pending', label: 'Pendentes' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatementFilter(tab.id as any)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    statementFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar histórico desta conta..."
                  className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

            </div>
          </div>
        </div>

        {/* Opening Balance Banner Row (Saldo Anterior em 01/MM) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/70 px-4 sm:px-6 py-2.5 text-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-700">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span>
              Saldo Anterior / Abertura do Mês (01/{selectedMonth.slice(5, 7)}/
              {selectedMonth.slice(0, 4)})
            </span>
          </div>
          <span
            data-testid="statement-opening-balance"
            className={`font-mono tabular-nums font-bold ${
              statementSummary.openingBalance >= 0 ? 'text-slate-900' : 'text-rose-700'
            }`}
          >
            {formatBRL(statementSummary.openingBalance)}
          </span>
        </div>
    </>
  );
}
