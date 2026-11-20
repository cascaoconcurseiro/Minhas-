/** Resultado da verificação dos dados. Parte de AuthAndCloudTab (ver AuthAndCloudTab.tsx). */
import { CheckCircle2 } from 'lucide-react';
import type { AuthAndCloudTabContext } from './authCloudTabContext';

export function AuthRepairFeedback({ form }: { form: AuthAndCloudTabContext }) {
  const {
    repairFeedback,
    setRepairFeedback,
  } = form;
  return (
    <>
{repairFeedback && (
        <div
          role="status"
          data-testid="system-scan-feedback"
          className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            {repairFeedback}
          </span>
          <button
            type="button"
            onClick={() => setRepairFeedback(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:underline text-[11px]"
          >
            Fechar
          </button>
        </div>
      )}
    </>
  );
}
