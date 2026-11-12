import React from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  CreditCard as CreditCardIcon,
  FileSpreadsheet,
  Landmark,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  PiggyBank,
  Plane,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { BrandMark } from './BrandMark';

export type NavTabId =
  | 'overview'
  | 'transactions'
  | 'accounts'
  | 'cards'
  | 'budgets'
  | 'shared'
  | 'trips'
  | 'investments'
  | 'goals'
  | 'reports'
  | 'cloud';

interface SidebarNavProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileDrawerOpen: boolean;
  onCloseMobileDrawer: () => void;
  onOpenNewTransaction: (mode?: 'expense' | 'income' | 'credit_card' | 'transfer') => void;
  onOpenSettings: () => void;
  onOpenReminders?: () => void;
  urgentRemindersCount?: number;
  pendingTransactionsCount?: number;
  budgetAlertsCount?: number;
  pendingSharedCount?: number;
  activeTripsCount?: number;
  accountsTotalBalance?: number;
  investmentsTotalValue?: number;
  cloudUserEmail?: string | null;
  cloudSyncStatus?: 'local' | 'syncing' | 'synced' | 'error';
  onSignOut?: () => void;
}

interface NavItemConfig {
  id: NavTabId;
  label: string;
  shortDesc: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
  badgeTone?: 'amber' | 'rose' | 'emerald';
}

interface NavGroupConfig {
  groupId: string;
  groupLabel: string;
  items: NavItemConfig[];
}

const getSyncStatusConfig = (
  status: 'local' | 'syncing' | 'synced' | 'error' = 'synced'
) => {
  switch (status) {
    case 'syncing':
      return {
        label: 'Sincronizando...',
        detail: 'Salvando na nuvem',
        dotColor: 'bg-sky-500',
        pingColor: 'bg-sky-400',
        textColor: 'text-sky-800 dark:text-sky-300',
        subTextColor: 'text-sky-600 dark:text-sky-400',
        badgeBg: 'bg-sky-50/80 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800',
        Icon: RefreshCw,
        iconClass: 'animate-spin text-sky-600 dark:text-sky-400',
        tooltip: 'Login ativo; salvando seus dados financeiros no Neon PostgreSQL.',
      };
    case 'error':
      return {
        label: 'Falha na sincronização',
        detail: 'Alterações podem estar pendentes',
        dotColor: 'bg-rose-500',
        pingColor: 'bg-rose-400',
        textColor: 'text-rose-800 dark:text-rose-300',
        subTextColor: 'text-rose-600 dark:text-rose-400',
        badgeBg: 'bg-rose-50/80 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800',
        Icon: AlertCircle,
        iconClass: 'text-rose-600 dark:text-rose-400',
        tooltip: 'O último salvamento não foi confirmado. Seus dados locais foram preservados; tente sincronizar novamente quando a conexão voltar.',
      };
    case 'local':
      return {
        label: 'Armazenamento local',
        detail: 'Cofre ativo no dispositivo',
        dotColor: 'bg-slate-400',
        pingColor: 'bg-slate-300',
        textColor: 'text-slate-800 dark:text-slate-200',
        subTextColor: 'text-slate-500 dark:text-slate-400',
        badgeBg: 'bg-slate-50 border-slate-200 dark:bg-slate-800/60 dark:border-slate-700',
        Icon: ShieldCheck,
        iconClass: 'text-slate-500 dark:text-slate-400',
        tooltip: 'Dados armazenados com segurança localmente.',
      };
    case 'synced':
    default:
      return {
        label: 'Nuvem sincronizada',
        detail: 'Neon PostgreSQL',
        dotColor: 'bg-emerald-500',
        pingColor: 'bg-emerald-400',
        textColor: 'text-emerald-800 dark:text-emerald-300',
        subTextColor: 'text-emerald-600 dark:text-emerald-400',
        badgeBg: 'bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800',
        Icon: CheckCircle2,
        iconClass: 'text-emerald-600 dark:text-emerald-400',
        tooltip: 'Workspace sincronizado com Neon PostgreSQL.',
      };
  }
};

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isMobileDrawerOpen,
  onCloseMobileDrawer,
  onOpenNewTransaction,
  onOpenSettings,
  onOpenReminders,
  urgentRemindersCount = 0,
  pendingTransactionsCount = 0,
  budgetAlertsCount = 0,
  pendingSharedCount = 0,
  activeTripsCount = 0,
  cloudUserEmail = null,
  cloudSyncStatus = 'synced',
  onSignOut,
}) => {
  const syncConfig = getSyncStatusConfig(cloudSyncStatus);
  const SyncIcon = syncConfig.Icon;

  const navGroups: NavGroupConfig[] = [
    {
      groupId: 'daily_cashflow',
      groupLabel: 'Dia a Dia & Caixa',
      items: [
        {
          id: 'overview',
          label: 'Visão Geral',
          shortDesc: 'Painel executivo, saldos e alertas',
          icon: LayoutDashboard,
        },
        {
          id: 'transactions',
          label: 'Lançamentos',
          shortDesc: 'Extrato diário, cascata e calendário',
          icon: ListOrdered,
          badgeCount: pendingTransactionsCount > 0 ? pendingTransactionsCount : undefined,
          badgeTone: 'amber',
        },
        {
          id: 'accounts',
          label: 'Contas & Carteiras',
          shortDesc: 'Saldos e extrato bancário real',
          icon: Landmark,
        },
        {
          id: 'cards',
          label: 'Cartões de Crédito',
          shortDesc: 'Faturas, limites e parcelas',
          icon: CreditCardIcon,
        },
      ],
    },
    {
      groupId: 'planning_control',
      groupLabel: 'Planejamento, Viagens & Rateio',
      items: [
        {
          id: 'budgets',
          label: 'Orçamentos',
          shortDesc: 'Tetos de gastos por categoria',
          icon: PieChart,
          badgeCount: budgetAlertsCount > 0 ? budgetAlertsCount : undefined,
          badgeTone: 'rose',
        },
        {
          id: 'trips',
          label: 'Viagens & Câmbio',
          shortDesc: 'TravelSpend, multi-moeda e grupo',
          icon: Plane,
          badgeCount: activeTripsCount > 0 ? activeTripsCount : undefined,
          badgeTone: 'emerald',
        },
        {
          id: 'shared',
          label: 'Compartilhado',
          shortDesc: 'Rateio familiar e reembolsos',
          icon: Users,
          badgeCount: pendingSharedCount > 0 ? pendingSharedCount : undefined,
          badgeTone: 'emerald',
        },
      ],
    },
    {
      groupId: 'wealth_future',
      groupLabel: 'Patrimônio & Futuro',
      items: [
        {
          id: 'investments',
          label: 'Investimentos',
          shortDesc: 'Renda Fixa, FIIs, Ações e Proventos',
          icon: TrendingUp,
        },
        {
          id: 'goals',
          label: 'Metas & Reservas',
          shortDesc: 'Objetivos e simulador CDI',
          icon: PiggyBank,
        },
      ],
    },
    {
      groupId: 'analytics_system',
      groupLabel: 'Análise & Relatórios',
      items: [
        {
          id: 'reports',
          label: 'Relatórios & DRE',
          shortDesc: 'DRE mensal, evolução, CSV e JSON',
          icon: FileSpreadsheet,
        },
      ],
    },
  ];

  const handleItemClick = (id: NavTabId) => {
    onSelectTab(id);
    onCloseMobileDrawer();
  };

  return (
    <>
      {/* Desktop Collapsible Left Sidebar */}
      <aside
        aria-label="Menu lateral de navegação"
        data-testid="desktop-sidebar"
        data-collapsed={isCollapsed ? 'true' : 'false'}
        className={`hidden lg:flex flex-col shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 sticky top-0 h-screen z-30 select-none transition-[width] duration-200 ease-out ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {/* Top Brand + Collapse Toggle */}
        <div
          className={`flex items-center border-b border-slate-200 dark:border-slate-800 h-14 px-3.5 ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => handleItemClick('overview')}
              className="flex items-center gap-2.5 text-left min-w-0 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-lg"
            >
              <BrandMark size="sm" />
              <div className="min-w-0">
                <span className="block text-sm font-bold tracking-tight text-slate-900 dark:text-white font-display truncate">
                  Minhas Economias
                </span>
                <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  Controle Financeiro & Viagens
                </span>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4 text-blue-600" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Grouped Navigation Links List */}
        <nav
          aria-label="Módulos do sistema"
          className="flex-1 overflow-y-auto custom-scrollbar py-2.5 px-2.5 space-y-3.5"
        >
          {navGroups.map((group, groupIdx) => (
            <div key={group.groupId} className="space-y-0.5">
              {!isCollapsed ? (
                <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {group.groupLabel}
                </div>
              ) : (
                groupIdx > 0 && <div className="mx-2 my-1.5 border-t border-slate-100" />
              )}

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemClick(item.id)}
                    title={isCollapsed ? `${item.label} — ${item.shortDesc}` : undefined}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center rounded-xl transition-colors group ${
                      isCollapsed
                        ? 'justify-center p-2.5'
                        : 'justify-between gap-2.5 px-3 py-2 text-left'
                    } ${
                      isActive
                        ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-100 shadow-2xs dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-900/70'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-blue-600'
                            : 'text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
                        }`}
                      />
                      {!isCollapsed && (
                        <span className="text-xs truncate whitespace-nowrap">{item.label}</span>
                      )}
                    </div>

                    {!isCollapsed && item.badgeCount !== undefined && item.badgeCount > 0 && (
                      <span
                        className={`text-[10px] font-mono tabular-nums font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                          item.badgeTone === 'rose'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
                            : item.badgeTone === 'amber'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                        }`}
                      >
                        {item.badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom Visual Sync Status Footer */}
        <div className="p-2.5 border-t border-slate-200 dark:border-slate-800">
          {/* Normal syncing stays quiet; only failures need an interrupting status. */}
          {cloudSyncStatus === 'error' && <button
            type="button"
            data-testid="sidebar-cloud-sync-status"
            onClick={() => onSelectTab('cloud')}
            title={syncConfig.tooltip}
            aria-label={`${syncConfig.label} - ${syncConfig.detail}. Abrir configurações de nuvem.`}
            className={`rounded-xl border transition-all text-left ${
              isCollapsed
                ? 'p-2 flex items-center justify-center'
                : 'px-3 py-2 flex items-center justify-between gap-2.5'
            } ${syncConfig.badgeBg}`}
          >
            {isCollapsed ? (
              <span className="relative flex h-3 w-3">
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${syncConfig.dotColor}`}
                />
              </span>
            ) : (
              <>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${syncConfig.dotColor}`}
                    />
                  </span>
                  <div className="min-w-0">
                    <span
                      className={`block text-[11px] font-bold leading-tight truncate ${syncConfig.textColor}`}
                    >
                      {syncConfig.label}
                    </span>
                    <span
                      className={`block text-[10px] leading-tight truncate ${syncConfig.subTextColor}`}
                    >
                      {syncConfig.detail}
                    </span>
                  </div>
                </div>
                <SyncIcon className={`h-4 w-4 shrink-0 ${syncConfig.iconClass}`} />
              </>
            )}
          </button>}

          {cloudUserEmail && onSignOut && (
            <button
              type="button"
              data-testid="sidebar-logout-btn"
              onClick={onSignOut}
              title={isCollapsed ? `Sair (${cloudUserEmail})` : undefined}
              aria-label="Sair da conta"
              className={`w-full mt-1.5 flex items-center rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors ${
                isCollapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2'
              }`}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span className="truncate">Sair da Conta</span>}
            </button>
          )}
        </div>
      </aside>

      {/* Mobile & Tablet Slide-Over Drawer (< lg screens) */}
      {isMobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex modal-shell"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            onClick={onCloseMobileDrawer}
          />

          {/* Drawer Content */}
          <div
            data-testid="mobile-sidebar-drawer"
            className="relative z-10 flex w-72 max-w-[84vw] flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 h-full shadow-2xl border-r border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3.5 pt-[max(env(safe-area-inset-top),0.875rem)]">
              <div className="flex items-center gap-2 min-w-0">
                <BrandMark size="sm" />
                <div className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900 dark:text-white font-display truncate">
                    Minhas Economias
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-semibold truncate">
                    Controle Financeiro & Viagens
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onCloseMobileDrawer}
                aria-label="Fechar menu lateral"
                className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onCloseMobileDrawer();
                  onOpenNewTransaction('expense');
                }}
                className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Lançamento</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseMobileDrawer();
                  onOpenNewTransaction('credit_card');
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 text-center dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                + Compra Cartão
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseMobileDrawer();
                  onOpenNewTransaction('income');
                }}
                className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-2 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 text-center"
              >
                + Receita
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
              {navGroups.map((group) => (
                <div key={group.groupId} className="space-y-1">
                  <div className="px-2.5 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {group.groupLabel}
                  </div>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleItemClick(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-100 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-900/70'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon
                            className={`h-4 w-4 shrink-0 ${
                              isActive ? 'text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          />
                          <div className="min-w-0">
                            <span className="block text-xs font-semibold truncate">
                              {item.label}
                            </span>
                            <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {item.shortDesc}
                            </span>
                          </div>
                        </div>

                        {item.badgeCount !== undefined && item.badgeCount > 0 && (
                          <span className="text-[10px] font-mono tabular-nums font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 shrink-0">
                            {item.badgeCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
              {cloudSyncStatus === 'error' && <button
                type="button"
                data-testid="mobile-cloud-sync-status"
                onClick={() => {
                  onCloseMobileDrawer();
                  onSelectTab('cloud');
                }}
                title={syncConfig.tooltip}
                aria-label={`${syncConfig.label} - ${syncConfig.detail}. Abrir configurações de nuvem.`}
                className={`w-full rounded-xl border px-3 py-2 flex items-center justify-between gap-2.5 text-left ${syncConfig.badgeBg}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${syncConfig.dotColor}`}
                    />
                  </span>
                  <div className="min-w-0">
                    <span
                      className={`block text-[11px] font-bold leading-tight truncate ${syncConfig.textColor}`}
                    >
                      {syncConfig.label}
                    </span>
                    <span
                      className={`block text-[10px] leading-tight truncate ${syncConfig.subTextColor}`}
                    >
                      {syncConfig.detail}
                    </span>
                  </div>
                </div>
                <SyncIcon className={`h-4 w-4 shrink-0 ${syncConfig.iconClass}`} />
              </button>}

              {onOpenReminders && (
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobileDrawer();
                    onOpenReminders();
                  }}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold ${
                    (urgentRemindersCount || 0) > 0
                      ? 'bg-amber-50 text-amber-900 border border-amber-200'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Bell className="h-4 w-4 text-amber-500" />
                    <span>Notificações</span>
                  </div>
                  {(urgentRemindersCount || 0) > 0 && (
                    <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {urgentRemindersCount}
                    </span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onCloseMobileDrawer();
                  onOpenSettings();
                }}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Settings className="h-4 w-4 text-slate-500" />
                <span>Configurações Completas</span>
              </button>

              {cloudUserEmail && onSignOut && (
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobileDrawer();
                    onSignOut();
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4 text-rose-600" />
                  <span>Sair da Conta ({cloudUserEmail})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
