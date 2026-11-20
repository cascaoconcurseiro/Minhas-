/** Cabeçalho da janela de configurações. Parte de SettingsModal (ver SettingsModal.tsx). */
import { Settings, X } from 'lucide-react';
import type { SettingsModalContext } from './settingsModalContext';

export function SettingsHeader({ form }: { form: SettingsModalContext }) {
  const {
    onClose,
  } = form;
  return (
    <>
<div className="shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 px-5 sm:px-6 py-3.5 sm:py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs shrink-0">
              <Settings className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h2
                id="modal-settings-title"
                className="text-base font-bold text-slate-900 dark:text-white font-display break-words sm:truncate"
              >
                Central de Configurações & Regras Financeiras
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 break-words sm:truncate">
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
    </>
  );
}
