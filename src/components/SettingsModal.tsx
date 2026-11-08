import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Check,
  Cloud,
  Download,
  Eye,
  EyeOff,
  FolderKanban,
  Layers,
  LayoutGrid,
  LogOut,
  Moon,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sliders,
  Sun,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { AppSettings, BudgetBucket, Category, ReminderSettings } from '../types/finance';
import { formatBRL, parseBRLInput } from '../utils/financeRules';
import { parseCurrencyInput } from '../utils/currencyInput';
import { parseFullFinanceBackup } from '../utils/fullBackup';
import { CurrencyInput } from './CurrencyInput';
import {
  DEFAULT_REMINDER_SETTINGS,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
} from '../utils/reminderRules';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  initialTab?: 'appearance' | 'categories' | 'rules' | 'reminders' | 'profile';
  categories?: Category[];
  userEmail?: string | null;
  isUserLoggedIn?: boolean;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onAddCategory?: (newCat: Omit<Category, 'id'>) => void;
  onUpdateCategoryBudget?: (catId: string, newBudget: number) => void;
  onDeleteCategory?: (catId: string) => void;
  onAddSubcategory?: (categoryId: string, subcategoryName: string) => void;
  onDeleteSubcategory?: (categoryId: string, subcategoryId: string) => void;
  onOpenCloudTab?: () => void;
  onSignOut?: () => Promise<void>;
  onExportFullBackupJson: () => void;
  onImportFullBackupJson: (jsonText: string) => boolean | Promise<boolean>;
  onResetWorkspaceData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  initialTab = 'appearance',
  categories = [],
  userEmail,
  isUserLoggedIn = false,
  onUpdateSettings,
  onAddCategory,
  onUpdateCategoryBudget,
  onDeleteCategory,
  onAddSubcategory,
  onDeleteSubcategory,
  onOpenCloudTab,
  onSignOut,
  onExportFullBackupJson,
  onImportFullBackupJson,
  onResetWorkspaceData,
}) => {
  const [activeTab, setActiveTab] = useState<
    'appearance' | 'categories' | 'rules' | 'reminders' | 'profile'
  >(initialTab);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [testNotificationSent, setTestNotificationSent] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Category creation & inline budget editing state
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense');
  const [newCatBudgetStr, setNewCatBudgetStr] = useState('600,00');
  const [newCatGroup, setNewCatGroup] = useState<BudgetBucket>('essential');
  const [subInputs, setSubInputs] = useState<Record<string, string>>({});
  const [budgetEditInputs, setBudgetEditInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportSuccess(false);

    const reader = new FileReader();
    const failImport = () => {
      setImportSuccess(false);
      setImportError('Não foi possível ler ou restaurar este arquivo JSON.');
    };
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content !== 'string') return failImport();
      const backup = parseFullFinanceBackup(content);
      if (!backup) {
        setImportError('Arquivo JSON inválido ou fora do padrão do Minhas Economias BR.');
        return;
      }

      const preview = [
        `Contas: ${backup.accounts.length}`,
        `cartões: ${backup.cards.length}`,
        `categorias: ${backup.categories.length}`,
        `lançamentos: ${backup.transactions.length}`,
        `metas: ${backup.goals.length}`,
        `investimentos: ${backup.investments.length}`,
        `viagens: ${backup.trips.length}`,
      ].join(' · ');
      const confirmed = window.confirm(
        `Prévia do backup (versão ${backup.version}): ${preview}. Restaurar este arquivo substituirá os dados atuais do workspace. Se ainda não fez isso, baixe um backup atual antes de continuar. Depois da restauração, confira o status da nuvem até confirmar a sincronização com o Neon. Continuar?`
      );
      if (!confirmed) return;

      setIsImporting(true);
      void Promise.resolve()
        .then(() => onImportFullBackupJson(content))
        .then((ok) => {
          if (ok !== true) {
            setImportError('Arquivo JSON inválido ou fora do padrão do Minhas Economias BR.');
            return;
          }
          setImportSuccess(true);
          setTimeout(() => setImportSuccess(false), 3500);
        })
        .catch(failImport)
        .finally(() => setIsImporting(false));
    };
    reader.onerror = failImport;
    reader.onabort = failImport;
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !onAddCategory) return;
    const colors = [
      '#059669',
      '#2563eb',
      '#7c3aed',
      '#d97706',
      '#e11d48',
      '#0891b2',
      '#4f46e5',
    ];
    const randomColor = colors[categories.length % colors.length];
    onAddCategory({
      name: newCatName.trim(),
      type: newCatType,
      color: randomColor,
      icon: newCatType === 'income' ? 'briefcase' : 'shopping-bag',
      monthlyBudget:
        newCatType === 'expense' ? Math.max(0, parseCurrencyInput(newCatBudgetStr, 'BRL')) : 0,
      bucket: newCatType === 'expense' ? newCatGroup : 'financial',
      subcategories: [],
    });
    setNewCatName('');
    setNewCatBudgetStr('600,00');
  };

  const handleAddSub = (catId: string) => {
    const val = (subInputs[catId] || '').trim();
    if (!val || !onAddSubcategory) return;
    onAddSubcategory(catId, val);
    setSubInputs((prev) => ({ ...prev, [catId]: '' }));
  };

  const handleSaveCategoryBudget = (catId: string, fallbackBudget: number) => {
    if (!onUpdateCategoryBudget) return;
    const raw = budgetEditInputs[catId];
    if (raw === undefined) return;
    const parsed = Math.max(0, parseCurrencyInput(raw, 'BRL'));
    onUpdateCategoryBudget(catId, parsed || fallbackBudget);
    setBudgetEditInputs((prev) => {
      const next = { ...prev };
      delete next[catId];
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 p-0 sm:p-4 overflow-hidden modal-shell"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-settings-title"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-sheet-up sm:animate-modal-in">
        {/* Mobile Pull Indicator */}
        <div className="mx-auto mt-2 -mb-1 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 px-5 sm:px-6 py-3.5 sm:py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs shrink-0">
              <Settings className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h2
                id="modal-settings-title"
                className="text-base font-bold text-slate-900 dark:text-white font-display truncate"
              >
                Central de Configurações & Regras Financeiras
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Personalize aparência, categorias, efeito cascata, conta e backups
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configurações"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 4-Tab Navigation Grid — ZERO Horizontal Scrollbar (2x2 on mobile, 4 cols on tablet/desktop) */}
        <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-800/60 px-4 sm:px-6 py-2.5">
          <div
            data-testid="settings-tabs-grid"
            className="grid grid-cols-2 sm:grid-cols-5 gap-1.5"
          >
            <button
              type="button"
              data-testid="settings-tab-appearance"
              onClick={() => setActiveTab('appearance')}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition-all ${
                activeTab === 'appearance'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <Sun className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">1. Aparência</span>
            </button>

            <button
              type="button"
              data-testid="settings-tab-categories"
              onClick={() => setActiveTab('categories')}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition-all ${
                activeTab === 'categories'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <FolderKanban className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">2. Categorias</span>
            </button>

            <button
              type="button"
              data-testid="settings-tab-rules"
              onClick={() => setActiveTab('rules')}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition-all ${
                activeTab === 'rules'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <Sliders className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">3. Regras</span>
            </button>

            <button
              type="button"
              data-testid="settings-tab-reminders"
              onClick={() => setActiveTab('reminders')}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition-all ${
                activeTab === 'reminders'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <Bell className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">4. Lembretes</span>
            </button>

            <button
              type="button"
              data-testid="settings-tab-account"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition-all ${
                activeTab === 'profile'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">5. Backup</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y modal-form-scroll custom-scrollbar p-5 sm:p-6 space-y-6">
          {/* TAB 1: APPEARANCE & INTERFACE */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Tema Visual do Aplicativo
                  </label>
                  <span className="text-xs font-semibold text-emerald-700">
                    {settings.theme === 'dark' ? 'Modo Escuro Ativo' : 'Modo Claro Ativo'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ theme: 'light' })}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                      settings.theme === 'light'
                        ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`mt-0.5 rounded-lg p-2 ${
                        settings.theme === 'light'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Sun className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Modo Claro Editorial
                        </span>
                        {settings.theme === 'light' && (
                          <Check className="h-4 w-4 text-emerald-600" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                        Superfícies claras de alto contraste ideais para leitura diurna e análise de tabelas.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ theme: 'dark' })}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                      settings.theme === 'dark'
                        ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`mt-0.5 rounded-lg p-2 ${
                        settings.theme === 'dark'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Moon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Modo Escuro Noturno
                        </span>
                        {settings.theme === 'dark' && (
                          <Check className="h-4 w-4 text-emerald-600" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                        Paleta grafite profunda que reduz o cansaço visual com indicadores verde-esmeralda.
                      </p>
                    </div>
                  </button>
                </div>
              </section>

              <section className="space-y-3 pt-4 border-t border-slate-200">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  2. Privacidade e Densidade das Tabelas
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white border border-slate-200 p-2 text-slate-700 mt-0.5">
                      {settings.privacyMode ? (
                        <EyeOff className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        Modo Privacidade (Ocultar Saldos R$)
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Aplica desfoque nos valores monetários para usar o app em locais públicos com segurança.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.privacyMode}
                    onClick={() =>
                      onUpdateSettings({ privacyMode: !settings.privacyMode })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      settings.privacyMode ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                        settings.privacyMode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white border border-slate-200 p-2 text-slate-700 mt-0.5">
                      <LayoutGrid className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        Densidade de Exibição (Tabelas & Extratos)
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Escolha entre espaçamento confortável ou modo compacto de alta densidade.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ density: 'comfortable' })}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                        settings.density === 'comfortable'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Confortável
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ density: 'compact' })}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                        settings.density === 'compact'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Compacta
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: CATEGORIES, SUBCATEGORIES & BUDGET CEILINGS */}
          {activeTab === 'categories' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <h3 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <Plus className="h-4 w-4 text-emerald-600" />
                  Criar Nova Categoria Financeira
                </h3>
                <form
                  onSubmit={handleCreateCategory}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                >
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Nome da Categoria
                    </label>
                    <input
                      type="text"
                      required
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Ex: Educação, Pets, Impostos..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Tipo
                    </label>
                    <select
                      value={newCatType}
                      onChange={(e) =>
                        setNewCatType(e.target.value as 'expense' | 'income')
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                    >
                      <option value="expense">Despesa</option>
                      <option value="income">Receita</option>
                    </select>
                  </div>
                  {newCatType === 'expense' && (
                    <>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Teto Mensal (R$)
                        </label>
                        <CurrencyInput
                          value={newCatBudgetStr}
                          currency="BRL"
                          onValueChange={setNewCatBudgetStr}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Bloco 50/30/20
                        </label>
                        <select
                          value={newCatGroup}
                          onChange={(e) =>
                            setNewCatGroup(e.target.value as BudgetBucket)
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
                        >
                          <option value="essential">50% Essenciais</option>
                          <option value="lifestyle">30% Estilo de Vida</option>
                          <option value="financial">20% Futuro</option>
                        </select>
                      </div>
                    </>
                  )}
                  <div
                    className={
                      newCatType === 'expense' ? 'sm:col-span-2' : 'sm:col-span-6'
                    }
                  >
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition-colors"
                    >
                      + Adicionar
                    </button>
                  </div>
                </form>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Categorias Cadastradas ({categories.length}) — Edite Tetos e Subcategorias
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categories.map((cat) => {
                    const isEditingBudget = budgetEditInputs[cat.id] !== undefined;
                    return (
                      <div
                        key={cat.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {cat.name}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                cat.type === 'income'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {cat.type === 'income' ? 'Receita' : 'Despesa'}
                            </span>
                          </div>
                          {onDeleteCategory && categories.length > 3 && (
                            <button
                              type="button"
                              onClick={() => onDeleteCategory(cat.id)}
                              title="Excluir categoria"
                              className="text-slate-400 hover:text-rose-600 p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {cat.type === 'expense' && (
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 bg-white rounded-lg border border-slate-200/80 px-2.5 py-1.5">
                            <span>Teto de Orçamento:</span>
                            {isEditingBudget ? (
                              <div className="flex items-center gap-1">
                                <CurrencyInput
                                  value={budgetEditInputs[cat.id]}
                                  currency="BRL"
                                  onValueChange={(value) =>
                                    setBudgetEditInputs((prev) => ({
                                      ...prev,
                                      [cat.id]: value,
                                    }))
                                  }
                                  className="w-20 rounded border border-emerald-400 px-1.5 py-0.5 text-xs font-mono font-bold text-slate-900"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSaveCategoryBudget(
                                      cat.id,
                                      cat.monthlyBudget
                                    )
                                  }
                                  className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white"
                                >
                                  Salvar
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setBudgetEditInputs((prev) => ({
                                    ...prev,
                                    [cat.id]: String(cat.monthlyBudget),
                                  }))
                                }
                                className="font-mono font-bold text-slate-900 hover:text-emerald-700 underline decoration-dotted"
                              >
                                {formatBRL(cat.monthlyBudget)} (Editar)
                              </button>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5">
                          {(cat.subcategories || []).map((sub) => (
                            <span
                              key={sub.id}
                              className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] text-slate-700"
                            >
                              <span>{sub.name}</span>
                              {onDeleteSubcategory && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteSubcategory(cat.id, sub.id)}
                                  className="text-slate-400 hover:text-rose-600"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>

                        {onAddSubcategory && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <input
                              type="text"
                              value={subInputs[cat.id] || ''}
                              onChange={(e) =>
                                setSubInputs((prev) => ({
                                  ...prev,
                                  [cat.id]: e.target.value,
                                }))
                              }
                              placeholder="Nova subcategoria..."
                              className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-900"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddSub(cat.id)}
                              className="rounded-lg bg-slate-200 hover:bg-slate-300 px-2.5 py-1 text-[11px] font-bold text-slate-800"
                            >
                              + Sub
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FINANCIAL RULES, CASCADE & ALERTS */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              <section className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  1. Reversão de Pagamento & Efeito Cascata (Recorrências e Parcelas)
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white border border-slate-200 p-2 text-indigo-600 mt-0.5">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        Comportamento Padrão ao Editar Série Recorrente / Parcelada
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Quando você altera o valor ou categoria de uma conta fixa ou parcela, ou reverte um pagamento marcado por engano, qual escopo deve vir pré-selecionado?
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {(
                      [
                        {
                          id: 'single',
                          title: 'Apenas Este Mês',
                          desc: 'Altera somente o lançamento clicado',
                        },
                        {
                          id: 'this_and_future',
                          title: 'Este + Próximos (Cascata)',
                          desc: 'Propaga para os meses seguintes automaticamente',
                        },
                        {
                          id: 'all_series',
                          title: 'Toda a Série',
                          desc: 'Atualiza passados, atual e futuros da série',
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({ defaultCascadeMode: opt.id })
                        }
                        className={`rounded-xl border p-3 text-left transition-all ${
                          (settings.defaultCascadeMode || 'this_and_future') ===
                          opt.id
                            ? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-600'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <span className="block text-xs font-bold text-slate-900">
                          {opt.title}
                        </span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">
                          {opt.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-3 pt-4 border-t border-slate-200">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  2. Alertas de Orçamento & Painel de Avisos
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-white border border-slate-200 p-2 text-amber-600 mt-0.5">
                        <Bell className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">
                          Exibir Avisos no Topo da Visão Geral
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Mostra lembretes de contas pendentes do mês e categorias próximas do limite.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.showOverviewAlerts}
                      onClick={() =>
                        onUpdateSettings({
                          showOverviewAlerts: !settings.showOverviewAlerts,
                        })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        settings.showOverviewAlerts
                          ? 'bg-emerald-600'
                          : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                          settings.showOverviewAlerts
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="pt-3 border-t border-slate-200/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700">
                        Sensibilidade do Alerta Preventivo de Orçamento
                      </span>
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-900">
                        Avisar ao atingir {settings.budgetWarningPercent}% do teto
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {[70, 80, 85, 90].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() =>
                            onUpdateSettings({ budgetWarningPercent: pct })
                          }
                          className={`rounded-lg border py-1.5 text-xs font-mono font-bold transition-colors ${
                            settings.budgetWarningPercent === pct
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 4: DAILY REMINDERS & SCHEDULED NOTIFICATIONS */}
          {activeTab === 'reminders' && (
            <div className="space-y-6">
              {/* Section 1: Ativação e Horário */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Sistema de Lembretes Diários
                  </label>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      (settings.reminders?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled)
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {(settings.reminders?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled)
                      ? 'Lembretes Ativos'
                      : 'Lembretes Desativados'}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Ativar Alertas Diários Automáticos
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        O sistema verifica pendências e envia lembretes sobre contas a pagar e faturas a vencer.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.reminders?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled}
                      onClick={() =>
                        onUpdateSettings({
                          reminders: {
                            ...DEFAULT_REMINDER_SETTINGS,
                            ...settings.reminders,
                            enabled: !(settings.reminders?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled),
                          },
                        })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        (settings.reminders?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled)
                          ? 'bg-emerald-600'
                          : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          (settings.reminders?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled)
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-200/80 dark:border-slate-700">
                    <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Horário Preferencial (Navegador)
                      </label>
                      <select
                        value={settings.reminders?.preferredTime ?? DEFAULT_REMINDER_SETTINGS.preferredTime}
                        onChange={(e) =>
                          onUpdateSettings({
                            reminders: {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                              preferredTime: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                      >
                        <option value="07:00">07:00 (Início da manhã)</option>
                        <option value="08:00">08:00 (Manhã cedo)</option>
                        <option value="09:00">09:00 (Início do dia - Recomendado)</option>
                        <option value="12:00">12:00 (Almoço / Meio-dia)</option>
                        <option value="18:00">18:00 (Final do expediente)</option>
                        <option value="20:00">20:00 (Noite)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Recorrência dos Alertas
                      </label>
                      <select
                        id="settings-browser-recurrence"
                        value={settings.reminders?.recurrence ?? DEFAULT_REMINDER_SETTINGS.recurrence ?? 'daily'}
                        onChange={(e) =>
                          onUpdateSettings({
                            reminders: {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                              recurrence: e.target.value as any,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                      >
                        <option value="daily">Diário (Todos os dias)</option>
                        <option value="weekly">Semanal (Toda Segunda)</option>
                        <option value="monthly">Mensal (Dia 1º do mês)</option>
                        <option value="weekdays">Dias Úteis (Seg a Sex)</option>
                        <option value="urgent_only">Apenas Urgentes (Vencendo / Atrasados)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Antecedência para Faturas de Cartão
                      </label>
                      <select
                        value={settings.reminders?.daysBeforeInvoiceDue ?? DEFAULT_REMINDER_SETTINGS.daysBeforeInvoiceDue}
                        onChange={(e) =>
                          onUpdateSettings({
                            reminders: {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                              daysBeforeInvoiceDue: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                      >
                        <option value={1}>1 dia antes do vencimento</option>
                        <option value={2}>2 dias antes do vencimento</option>
                        <option value={3}>3 dias antes (Padrão ouro)</option>
                        <option value={5}>5 dias antes do vencimento</option>
                        <option value={7}>7 dias antes (1 semana)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 2: Tipos de Notificação */}
              <section className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  2. Quais pendências devem gerar lembretes?
                </label>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Faturas de Cartão de Crédito
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Notifica quando a fatura fecha ou aproxima do dia do vencimento.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.reminders?.notifyInvoiceDue ?? DEFAULT_REMINDER_SETTINGS.notifyInvoiceDue}
                      onChange={(e) =>
                        onUpdateSettings({
                          reminders: {
                            ...DEFAULT_REMINDER_SETTINGS,
                            ...settings.reminders,
                            notifyInvoiceDue: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-200/60 dark:border-slate-700">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Despesas e Boletos Pendentes
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Contas pontuais cadastradas com status &quot;Pendente&quot; no mês.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.reminders?.notifyPendingBills ?? DEFAULT_REMINDER_SETTINGS.notifyPendingBills}
                      onChange={(e) =>
                        onUpdateSettings({
                          reminders: {
                            ...DEFAULT_REMINDER_SETTINGS,
                            ...settings.reminders,
                            notifyPendingBills: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-200/60 dark:border-slate-700">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Transações Recorrentes (Contas Fixas)
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Aluguel, condomínio, internet, salário ou mensalidades fixas.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.reminders?.notifyRecurringEntries ?? DEFAULT_REMINDER_SETTINGS.notifyRecurringEntries}
                      onChange={(e) =>
                        onUpdateSettings({
                          reminders: {
                            ...DEFAULT_REMINDER_SETTINGS,
                            ...settings.reminders,
                            notifyRecurringEntries: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-200/60 dark:border-slate-700">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Rateios Familiares a Receber
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Lembrete de despesas compartilhadas ainda não reembolsadas.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.reminders?.notifySharedReimbursements ?? DEFAULT_REMINDER_SETTINGS.notifySharedReimbursements}
                      onChange={(e) =>
                        onUpdateSettings({
                          reminders: {
                            ...DEFAULT_REMINDER_SETTINGS,
                            ...settings.reminders,
                            notifySharedReimbursements: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                  </label>
                </div>
              </section>

              {/* Section 3: Notificações por E-mail */}
              <section className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  3. Envio de Lembretes por E-mail
                </label>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Ativar Notificações por E-mail
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Receba um boletim automático com faturas e boletos pendentes no horário e recorrência escolhidos.
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.reminders?.emailNotificationsEnabled ?? false}
                      onClick={() =>
                        onUpdateSettings({
                          reminders: {
                            ...DEFAULT_REMINDER_SETTINGS,
                            ...settings.reminders,
                            emailNotificationsEnabled: !(settings.reminders?.emailNotificationsEnabled ?? false),
                            notificationEmail:
                              settings.reminders?.notificationEmail || userEmail || '',
                          },
                        })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        (settings.reminders?.emailNotificationsEnabled ?? false)
                          ? 'bg-emerald-600'
                          : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          (settings.reminders?.emailNotificationsEnabled ?? false)
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200/80 dark:border-slate-700">
                    <div>
                      <label htmlFor="settings-reminder-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        E-mail Destinatário
                      </label>
                      <input
                        type="email"
                        id="settings-reminder-email"
                        placeholder="seuemail@exemplo.com"
                        value={settings.reminders?.notificationEmail ?? userEmail ?? ''}
                        onChange={(e) =>
                          onUpdateSettings({
                            reminders: {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                              notificationEmail: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="settings-reminder-email-time" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Horário do E-mail
                      </label>
                      <select
                        id="settings-reminder-email-time"
                        value={settings.reminders?.emailPreferredTime ?? DEFAULT_REMINDER_SETTINGS.emailPreferredTime ?? '08:00'}
                        onChange={(e) =>
                          onUpdateSettings({
                            reminders: {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                              emailPreferredTime: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                      >
                        <option value="07:00">07:00 (Início da manhã)</option>
                        <option value="08:00">08:00 (Manhã - Recomendado)</option>
                        <option value="09:00">09:00 (Horário comercial)</option>
                        <option value="12:00">12:00 (Meio-dia)</option>
                        <option value="18:00">18:00 (Fim de tarde)</option>
                        <option value="20:00">20:00 (Noite)</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="settings-email-recurrence"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        Recorrência de Envio por E-mail
                      </label>
                      <select
                        id="settings-email-recurrence"
                        data-testid="settings-email-recurrence-select"
                        value={settings.reminders?.emailRecurrence ?? DEFAULT_REMINDER_SETTINGS.emailRecurrence ?? 'daily'}
                        onChange={(e) =>
                          onUpdateSettings({
                            reminders: {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                              emailRecurrence: e.target.value as any,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                      >
                        <option value="daily">Diário (Todos os dias)</option>
                        <option value="weekly">Semanal (Toda Segunda)</option>
                        <option value="monthly">Mensal (Dia 1º do mês)</option>
                        <option value="weekdays">Dias Úteis (Seg a Sex)</option>
                        <option value="urgent_only">Apenas Urgentes (Vencendo / Atrasados)</option>
                      </select>
                    </div>
                  </div>

                  {/* Subsection: Credenciais do Servidor SMTP Próprio */}
                  <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                          Credenciais do Servidor SMTP Próprio
                        </h5>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Utilize seu próprio servidor SMTP (Gmail, Outlook, Zoho ou corporativo) para disparo dos lembretes.
                        </p>
                        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                          Por segurança, a senha não é salva no Neon nem nos backups. Redigite-a após recarregar o app ou importar um backup; durante esta sessão, os envios usam a senha informada.
                        </p>
                      </div>
                      <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                        Envio via SMTP do Usuário
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-5">
                        <label
                          htmlFor="settings-smtp-host"
                          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                        >
                          Host SMTP
                        </label>
                        <input
                          id="settings-smtp-host"
                          data-testid="settings-smtp-host-input"
                          type="text"
                          placeholder="ex: smtp.gmail.com"
                          value={settings.reminders?.smtpHost ?? settings.reminders?.smtpConfig?.host ?? ''}
                          onChange={(e) => {
                            const nextHost = e.target.value;
                            const currentRem = {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                            };
                            const portNum = Number(currentRem.smtpPort ?? 587) || 587;
                            onUpdateSettings({
                              reminders: {
                                ...currentRem,
                                smtpHost: nextHost,
                                smtpConfig: {
                                  host: nextHost.trim(),
                                  port: portNum,
                                  user: (currentRem.smtpUser || '').trim(),
                                  pass: currentRem.smtpPass || '',
                                  secure: portNum === 465,
                                },
                              },
                            });
                          }}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label
                          htmlFor="settings-smtp-port"
                          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                        >
                          Porta SMTP
                        </label>
                        <input
                          id="settings-smtp-port"
                          data-testid="settings-smtp-port-input"
                          type="number"
                          min={1}
                          max={65535}
                          placeholder="587"
                          value={settings.reminders?.smtpPort ?? settings.reminders?.smtpConfig?.port ?? 587}
                          onChange={(e) => {
                            const nextPort = Number(e.target.value) || 587;
                            const currentRem = {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                            };
                            onUpdateSettings({
                              reminders: {
                                ...currentRem,
                                smtpPort: nextPort,
                                smtpSecure: nextPort === 465,
                                smtpConfig: {
                                  host: (currentRem.smtpHost || '').trim(),
                                  port: nextPort,
                                  user: (currentRem.smtpUser || '').trim(),
                                  pass: currentRem.smtpPass || '',
                                  secure: nextPort === 465,
                                },
                              },
                            });
                          }}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="sm:col-span-5">
                        <label
                          htmlFor="settings-smtp-user"
                          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                        >
                          Usuário SMTP
                        </label>
                        <input
                          id="settings-smtp-user"
                          data-testid="settings-smtp-user-input"
                          type="text"
                          placeholder="seuemail@dominio.com"
                          value={settings.reminders?.smtpUser ?? settings.reminders?.smtpConfig?.user ?? ''}
                          onChange={(e) => {
                            const nextUser = e.target.value;
                            const currentRem = {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                            };
                            const portNum = Number(currentRem.smtpPort ?? 587) || 587;
                            onUpdateSettings({
                              reminders: {
                                ...currentRem,
                                smtpUser: nextUser,
                                smtpConfig: {
                                  host: (currentRem.smtpHost || '').trim(),
                                  port: portNum,
                                  user: nextUser.trim(),
                                  pass: currentRem.smtpPass || '',
                                  secure: portNum === 465,
                                },
                              },
                            });
                          }}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="sm:col-span-12">
                        <label
                          htmlFor="settings-smtp-pass"
                          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                        >
                          Senha SMTP / Senha de Aplicativo (App Password)
                        </label>
                        <div className="relative flex items-center">
                          <input
                            id="settings-smtp-pass"
                            data-testid="settings-smtp-pass-input"
                            type={showSmtpPassword ? 'text' : 'password'}
                            placeholder="Digite sua senha SMTP ou App Password de 16 dígitos"
                            value={settings.reminders?.smtpPass ?? settings.reminders?.smtpConfig?.pass ?? ''}
                            onChange={(e) => {
                              const nextPass = e.target.value;
                              const currentRem = {
                                ...DEFAULT_REMINDER_SETTINGS,
                                ...settings.reminders,
                              };
                              const portNum = Number(currentRem.smtpPort ?? 587) || 587;
                              onUpdateSettings({
                                reminders: {
                                  ...currentRem,
                                  smtpPass: nextPass,
                                  smtpConfig: {
                                    host: (currentRem.smtpHost || '').trim(),
                                    port: portNum,
                                    user: (currentRem.smtpUser || '').trim(),
                                    pass: nextPass,
                                    secure: portNum === 465,
                                  },
                                },
                              });
                            }}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-3 pr-9 py-2 text-xs font-mono text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSmtpPassword((prev) => !prev)}
                            aria-label={
                              showSmtpPassword
                                ? 'Ocultar senha SMTP'
                                : 'Mostrar senha SMTP'
                            }
                            className="absolute right-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            {showSmtpPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: Notificações do Navegador & Teste */}
              <section className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  4. Integração com o Navegador / Sistema Operacional
                </label>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Notificações Nativas do Sistema
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Receba alertas na área de trabalho ou tela de bloqueio mesmo em segundo plano.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await requestBrowserNotificationPermission();
                          if (res === 'granted') {
                            onUpdateSettings({
                              reminders: {
                                ...DEFAULT_REMINDER_SETTINGS,
                                ...settings.reminders,
                                browserNotificationsEnabled: true,
                              },
                            });
                            sendBrowserNotification(
                              'Notificações Ativadas! 🔔',
                              'Você receberá lembretes das suas faturas e contas pendentes.'
                            );
                          }
                        }}
                        className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 text-xs font-bold transition-colors"
                      >
                        Ativar no Navegador
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          sendBrowserNotification(
                            'Lembrete de Teste 🔔',
                            'Seu sistema de lembretes diários do Minhas Economias BR está funcionando perfeitamente!'
                          );
                          setTestNotificationSent(true);
                          setTimeout(() => setTestNotificationSent(false), 3500);
                        }}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                      >
                        {testNotificationSent ? 'Disparado!' : 'Testar Agora'}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 5: PROFILE & JSON BACKUP */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <section className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  1. Perfil do Titular & Chave PIX
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="settings-profile-name" className="block text-xs font-semibold text-slate-700 mb-1">
                        Seu Nome de Exibição
                      </label>
                      <input
                        type="text"
                        id="settings-profile-name"
                        value={settings.userName || ''}
                        onChange={(e) =>
                          onUpdateSettings({ userName: e.target.value })
                        }
                        placeholder="Seu nome completo"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="settings-profile-pix" className="block text-xs font-semibold text-slate-700 mb-1">
                        Sua Chave PIX Padrão (Reembolsos & Viagens)
                      </label>
                      <input
                        type="text"
                        id="settings-profile-pix"
                        value={settings.userPixKey || ''}
                        onChange={(e) =>
                          onUpdateSettings({ userPixKey: e.target.value })
                        }
                        placeholder="E-mail, CPF, telefone ou chave aleatória"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900"
                      />
                    </div>
                  </div>

                  {isUserLoggedIn && onSignOut && (
                    <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-slate-800">
                          Sessão Conectada: {userEmail || 'Conta autenticada'}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          Sessão autenticada. Consulte Conta e Nuvem para ver o estado do Neon.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await onSignOut();
                          onClose();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors shrink-0"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sair da Conta</span>
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-3 pt-4 border-t border-slate-200">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  2. Portabilidade & backup do workspace (JSON)
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white border border-slate-200 p-2 text-emerald-700 mt-0.5">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        Backup local e restauração
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        O arquivo guarda o workspace pessoal no seu dispositivo, vinculado à conta que o exportou. Não inclui convites nem despesas espelhadas recebidas. Ao restaurar em outra conta, os marcadores de compartilhamento são removidos. Antes de restaurar, baixe a versão atual e confira a sincronização com o Neon.
                      </p>
                    </div>
                  </div>

                  {importError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                      {importError}
                    </div>
                  )}

                  {importSuccess && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                        Backup restaurado na sessão. Confira o status da nuvem para confirmar o Neon.
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={onExportFullBackupJson}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Baixar backup do workspace (.JSON)</span>
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isImporting}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>{isImporting ? 'Restaurando backup…' : 'Restaurar de Arquivo .JSON'}</span>
                    </button>

                    {!confirmReset ? (
                      <button
                        type="button"
                        onClick={() => setConfirmReset(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors ml-auto"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Apagar dados do workspace pessoal</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 ml-auto">
                        <span className="text-[11px] font-semibold text-rose-700">
                          Apaga dados pessoais. Convites e lançamentos compartilhados ficam preservados. Confirmar?
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onResetWorkspaceData();
                            setConfirmReset(false);
                          }}
                          className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                        >
                          Sim, apagar dados pessoais
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmReset(false)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-6 py-3.5 pb-[max(env(safe-area-inset-bottom),0.875rem)]">
          <span className="text-[11px] text-slate-500">
            As alterações são salvas neste dispositivo; o status indica quando o Neon confirmar a sincronização.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
