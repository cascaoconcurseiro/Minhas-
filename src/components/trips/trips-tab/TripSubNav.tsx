/** Navegação entre as 4 subtelas da viagem. Parte de TripsTab (ver TripsTab.tsx). */
import { Coins, HelpCircle, Receipt, Users } from 'lucide-react';
import type { TripPageContext } from './tripsTabContext';

export function TripSubNav({ form }: { form: TripPageContext }) {
  const {
    activeSubView,
    activeTrip,
    setActiveSubView,
    summary,
    tripTransactions,
  } = form;
  return (
    <>
{/* 4-Column Sub-navigation Grid (100% Visible without Horizontal Scrollbar) */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-2xs">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setActiveSubView('overview_spend')}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
              activeSubView === 'overview_spend'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <Receipt className="h-4 w-4 shrink-0" />
            <span className="break-words sm:truncate">
              1. Diário & Extrato ({tripTransactions.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('group_split')}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
              activeSubView === 'group_split'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <Users className="h-4 w-4 shrink-0" />
            <span className="break-words sm:truncate">2. Divisão & Quem Deve</span>
            {summary.simplifiedDebts.length > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold shrink-0 ${
                  activeSubView === 'group_split'
                    ? 'bg-white/25 text-white'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {summary.simplifiedDebts.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('fx_wallet')}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
              activeSubView === 'fx_wallet'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <Coins className="h-4 w-4 shrink-0" />
            <span className="break-words sm:truncate">
              3. Carteira Câmbio ({activeTrip.exchangeLots.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('how_it_works')}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
              activeSubView === 'how_it_works'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            <span className="break-words sm:truncate">4. Guia: Como Funciona</span>
          </button>
        </div>
      </div>
    </>
  );
}
