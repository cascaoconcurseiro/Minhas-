import React, { useState } from 'react';
import {
  Cloud,
  CreditCard,
  Grid,
  Home,
  Landmark,
  LogOut,
  Menu,
  PieChart,
  PiggyBank,
  Plane,
  Plus,
  Receipt,
  Settings,
  Smartphone,
  Sliders,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface MobileBottomNavProps {
  activeTab: string;
  onSelectTab: (tab: any) => void;
  onOpenNewTransaction: (mode?: 'expense' | 'income' | 'credit_card' | 'transfer') => void;
  onOpenSettings: () => void;
  userEmail?: string | null;
  onSignOut?: () => Promise<void>;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenNewTransaction,
  onOpenSettings,
  userEmail,
  onSignOut,
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const handleTabClick = (tabId: string) => {
    setShowMoreMenu(false);
    onSelectTab(tabId);
  };

  const isMoreTabActive = [
    'accounts',
    'investments',
    'shared',
    'budgets',
    'goals',
    'trips',
    'reports',
    'cloud',
  ].includes(activeTab);

  return (
    <>
      {/* Native Bottom Bar (Only visible on Mobile/Tablet < XL) */}
      <nav
        aria-label="Navegação móvel nativa"
        className="fixed inset-x-0 bottom-0 z-40 lg:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 px-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
      >
        <div className="mx-auto flex max-w-md items-center justify-between">
          {/* Tab 1: Início */}
          <button
            type="button"
            onClick={() => handleTabClick('overview')}
            className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors ${
              activeTab === 'overview'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px] mt-0.5">Início</span>
          </button>

          {/* Tab 2: Extrato / Lançamentos */}
          <button
            type="button"
            onClick={() => handleTabClick('transactions')}
            className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors ${
              activeTab === 'transactions'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            <Receipt className="h-5 w-5" />
            <span className="text-[10px] mt-0.5">Extrato</span>
          </button>

          {/* Center Elevated Action: (+) Novo Lançamento */}
          <div className="flex-1 flex justify-center -mt-5">
            <button
              type="button"
              onClick={() => onOpenNewTransaction('expense')}
              aria-label="Novo lançamento"
              className="flex h-13 w-13 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 active:scale-95 transition-transform ring-4 ring-white dark:ring-slate-900"
            >
              <Plus className="h-6 w-6 stroke-[2.5]" />
            </button>
          </div>

          {/* Tab 3: Cartões */}
          <button
            type="button"
            onClick={() => handleTabClick('cards')}
            className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors ${
              activeTab === 'cards'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            <CreditCard className="h-5 w-5" />
            <span className="text-[10px] mt-0.5">Cartões</span>
          </button>

          {/* Tab 4: Mais Módulos */}
          <button
            type="button"
            onClick={() => setShowMoreMenu(true)}
            className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors ${
              isMoreTabActive || showMoreMenu
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] mt-0.5">Mais</span>
          </button>
        </div>
      </nav>

      {/* Mobile "Mais" Bottom Sheet Drawer */}
      {showMoreMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-[2px] lg:hidden overflow-hidden modal-shell"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowMoreMenu(false);
          }}
        >
          <div className="w-full max-w-lg rounded-t-3xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-5 shadow-2xl animate-sheet-up modal-shell modal-form-scroll max-h-[85vh] overflow-y-auto custom-scrollbar pb-[max(env(safe-area-inset-bottom),1.5rem)]">
            {/* Top Drag Indicator */}
            <div className="mx-auto -mt-1 mb-4 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                  Mais Módulos & Ferramentas
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Acesse recursos complementares do seu controle
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMoreMenu(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Navigation Grid Grouped by Financial Pillars */}
            <div className="space-y-4 pt-4">
              {/* Group 1: Contas & Patrimônio */}
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">
                  Contas Bancárias & Patrimônio
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleTabClick('accounts')}
                    className={`col-span-2 flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                      activeTab === 'accounts'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                      <Landmark className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold block text-slate-900 dark:text-white">
                        Contas & Carteiras (Extrato Bancário)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                        Saldos bancários, carteira física e extrato progressivo linha a linha
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabClick('investments')}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                      activeTab === 'investments'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold block text-slate-900 dark:text-white">
                        Investimentos
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                        RF, FIIs, Ações e Proventos
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabClick('goals')}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                      activeTab === 'goals'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300">
                      <PiggyBank className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold block text-slate-900 dark:text-white">
                        Metas & Reservas
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                        Caixinhas e simulador CDI
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Group 2: Planejamento, Viagens & Controle */}
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">
                  Planejamento, Viagens & Rateio
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleTabClick('trips')}
                    className={`col-span-2 flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                      activeTab === 'trips'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300">
                      <Plane className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold block text-slate-900 dark:text-white">
                        Viagens & Câmbio (TravelSpend + Splitwise)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                        Multi-moeda, ritmo diário, câmbio médio Wise/Espécie e divisão em grupo
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabClick('budgets')}
                    className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${
                      activeTab === 'budgets'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300">
                      <Sliders className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold block text-slate-900 dark:text-white">
                        Orçamentos
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                        Tetos mensais
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabClick('shared')}
                    className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${
                      activeTab === 'shared'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-100 text-pink-700 dark:bg-pink-950/70 dark:text-pink-300">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold block text-slate-900 dark:text-white">
                        Compartilhado
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                        Rateio familiar
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabClick('reports')}
                    className={`col-span-2 flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                      activeTab === 'reports'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                      <PieChart className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold block text-slate-900 dark:text-white">
                        Relatórios & DRE
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                        Evolução mensal, CSV & Backup
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabClick('cloud')}
                    className={`col-span-2 flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                      activeTab === 'cloud'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
                      <Settings className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold block text-slate-900 dark:text-white">Conta e Nuvem</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                        Login, sessão e estado do Neon
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Settings & Install Actions */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenSettings();
                }}
                className="w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 p-3 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  Configurações, Tema & Privacidade
                </span>
                <span className="text-[11px] text-slate-400 font-normal">Abrir ›</span>
              </button>

              {userEmail && onSignOut && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onSignOut();
                  }}
                  className="w-full flex items-center justify-between rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/60 dark:bg-rose-950/30 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <LogOut className="h-4 w-4 text-rose-600 shrink-0" />
                    <span className="truncate">Sair da Conta ({userEmail})</span>
                  </span>
                </button>
              )}

              <div className="flex items-center justify-center pt-2">
                <PWAInstallButton variant="button" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
