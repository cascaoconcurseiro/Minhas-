/** Indicadores do mês: a receber, a pagar e acertado. Parte de SharedExpensesTab (ver SharedExpensesTab.tsx). */
import { formatBRL, formatMonthYearPT } from '../../../domain/finance/financeRules';
import { ArrowLeftRight, Mail, Plus, Receipt, Users } from 'lucide-react';
import type { SharedExpensesTabContext } from './sharedExpensesTabContext';

export function SharedKpiCards({ form }: { form: SharedExpensesTabContext }) {
  const {
    familyMembers,
    handleOpenAddMemberModal,
    onOpenNewSharedTransaction,
    overallIOweMembersThisMonth,
    overallNetCompensatedThisMonth,
    overallOwedToMeThisMonth,
    overallReceivedThisMonth,
    selectedMemberId,
    selectedMonth,
  } = form;
  return (
    <>
<section className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
        {/* KPI 1: Me Devem vs. Eu Devo */}
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              Me Devem vs. Eu Devo ({formatMonthYearPT(selectedMonth)})
            </span>
            <ArrowLeftRight className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">
                Me Devem
              </span>
              <span className="text-base font-bold tabular-nums text-emerald-800 dark:text-emerald-300 font-display">
                {formatBRL(overallOwedToMeThisMonth)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 block">
                Eu Devo
              </span>
              <span className="text-base font-bold tabular-nums text-amber-800 dark:text-amber-300 font-display">
                {formatBRL(overallIOweMembersThisMonth)}
              </span>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-indigo-800 dark:text-indigo-300">
            Apenas despesas nacionais em R$ (viagens ficam na moeda da viagem)
          </p>
        </div>

        {/* KPI 2: Saldo Líquido Compensado (Encontro de Contas) */}
        <div
          data-testid="shared-net-compensation-kpi"
          className={`rounded-xl border p-4 ${
            overallNetCompensatedThisMonth >= 0
              ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30'
              : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Valor Real Após Compensação
            </span>
            <Receipt className="h-4 w-4 text-emerald-600" />
          </div>
          <div
            className={`mt-2 text-xl font-bold tabular-nums font-display ${
              overallNetCompensatedThisMonth > 0
                ? 'text-emerald-900 dark:text-emerald-300'
                : overallNetCompensatedThisMonth < 0
                ? 'text-rose-900 dark:text-rose-300'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {overallNetCompensatedThisMonth > 0
              ? `Receber ${formatBRL(overallNetCompensatedThisMonth)}`
              : overallNetCompensatedThisMonth < 0
              ? `Pagar ${formatBRL(Math.abs(overallNetCompensatedThisMonth))}`
              : 'R$ 0,00 (Quitado)'}
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Diferença líquida automática (Me devem − Eu devo) • Quitado no mês: {formatBRL(overallReceivedThisMonth)}
          </p>
        </div>

        {/* KPI 3: Família & Contas Vinculadas por E-mail */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Família & Convites por E-mail
            </span>
            <Users className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-2 text-xl font-bold tabular-nums text-slate-900 dark:text-white font-display">
            {familyMembers.length} pessoa(s)
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {familyMembers.filter((m) => Boolean(m.email)).length} vinculada(s) a um e-mail
          </p>
        </div>

        {/* KPI 4: Botões de Ação Rápida */}
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex flex-col justify-center gap-2">
          <button
            type="button"
            data-testid="new-shared-expense-btn"
            onClick={() => onOpenNewSharedTransaction(selectedMemberId)}
            className="w-full min-w-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold leading-tight text-center text-white hover:bg-emerald-700 transition-colors whitespace-normal"
          >
            <Plus className="h-4 w-4" />
            Nova Despesa Compartilhada
          </button>
          <button
            type="button"
            data-testid="invite-family-member-btn"
            onClick={handleOpenAddMemberModal}
            className="w-full min-w-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold leading-tight text-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors whitespace-normal max-sm:min-h-10"
          >
            <Mail className="h-3.5 w-3.5 text-indigo-600" />
            + Cadastrar convite familiar
          </button>
        </div>
      </section>
    </>
  );
}
