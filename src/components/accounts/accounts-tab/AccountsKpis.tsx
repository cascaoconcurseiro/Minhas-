/** Indicadores consolidados das contas. Parte de AccountsTab (ver AccountsTab.tsx). */
import { ArrowUpRight, Building2, Landmark, Wallet } from 'lucide-react';
import { formatBRL } from '../../../domain/finance/financeRules';
import type { AccountsTabContext } from './accountsTabContext';

export function AccountsKpis({ form }: { form: AccountsTabContext }) {
  const {
    accounts,
    globalTotals,
  } = form;
  return (
    <>
<section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
                <span className="break-words sm:truncate">Saldo no Giro (Caixa)</span>
                <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 break-words sm:truncate">
                {formatBRL(globalTotals.giroCurrent)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums break-words sm:truncate">
                Proj. fim do mês: {formatBRL(globalTotals.giroProjected)}
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
                <span className="break-words sm:truncate">Patrimônio Contas</span>
                <Landmark className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 break-words sm:truncate">
                {formatBRL(globalTotals.totalPatrimony)}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 break-words sm:truncate">
                {accounts.length} conta(s) ativa(s)
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
                <span className="break-words sm:truncate">Contas no Giro Mensal</span>
                <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-slate-900 break-words sm:truncate">
                {accounts.filter((a) => a.includeInTotal).length} de {accounts.length}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 break-words sm:truncate">
                Compõem o caixa principal
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 gap-1">
                <span className="break-words sm:truncate">Reservas Fora do Giro</span>
                <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-600 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-base sm:text-2xl font-bold font-mono tabular-nums text-sky-700 break-words sm:truncate">
                {formatBRL(Math.max(0, globalTotals.totalPatrimony - globalTotals.giroCurrent))}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 break-words sm:truncate">
                Protegido fora do caixa diário
              </p>
            </div>
          </section>
    </>
  );
}
