/** Rodapé da janela. Parte de SettingsModal (ver SettingsModal.tsx). */
import type { SettingsModalContext } from './settingsModalContext';

export function SettingsFooter({ form }: { form: SettingsModalContext }) {
  const {
    onClose,
  } = form;
  return (
    <>
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
    </>
  );
}
