/** Abas das configurações. Parte de SettingsModal (ver SettingsModal.tsx). */
import { Bell, FolderKanban, Sliders, Sun, UserCheck } from 'lucide-react';
import type { SettingsModalContext } from './settingsModalContext';

export function SettingsTabs({ form }: { form: SettingsModalContext }) {
  const {
    activeTab,
    setActiveTab,
  } = form;
  return (
    <>
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
              <span className="break-words sm:truncate">1. Aparência</span>
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
              <span className="break-words sm:truncate">2. Categorias</span>
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
              <span className="break-words sm:truncate">3. Regras</span>
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
              <span className="break-words sm:truncate">4. Lembretes</span>
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
              <span className="break-words sm:truncate">5. Backup</span>
            </button>
          </div>
        </div>
    </>
  );
}
