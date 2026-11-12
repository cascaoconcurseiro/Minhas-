import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { checkAndApplyUpdate, getAppBuild, type UpdateCheckResult } from '../pwa/pwaControl';

const MESSAGES: Record<UpdateCheckResult, { tone: 'ok' | 'warn'; text: string }> = {
  latest: { tone: 'ok', text: 'Você já está com a versão mais recente.' },
  updating: { tone: 'ok', text: 'Versão nova encontrada. Atualizando e recarregando o app…' },
  offline: { tone: 'warn', text: 'Sem conexão. Tente de novo com a internet ligada.' },
  unsupported: { tone: 'warn', text: 'Este navegador não atualiza sozinho. Feche o app por completo e abra de novo.' },
};

function formatBuiltAt(value: string): string {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'desenvolvimento local';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Mostra a versão do app em uso e permite buscar e aplicar uma atualização na hora. */
export const AppVersionCard: React.FC = () => {
  const build = getAppBuild();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);

  const handleCheck = async () => {
    setBusy(true);
    setResult(null);
    try {
      setResult(await checkAndApplyUpdate());
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Versão do app"
      data-testid="app-version"
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
    >
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Versão do app</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          O app procura versão nova sozinho e atualiza assim que você para de mexer. Se quiser, busque agora.
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-1.5 text-xs font-mono">
        <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-1">
          <dt className="text-slate-500 dark:text-slate-400">Versão</dt>
          <dd data-testid="app-version-sha" className="font-bold text-slate-900 dark:text-white">{build.sha}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-1">
          <dt className="text-slate-500 dark:text-slate-400">Publicada em</dt>
          <dd className="font-bold text-slate-900 dark:text-white">{formatBuiltAt(build.builtAt)}</dd>
        </div>
      </dl>
      <button
        type="button"
        data-testid="app-version-check-btn"
        onClick={() => void handleCheck()}
        disabled={busy}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-4 text-sm font-bold text-white dark:text-slate-900 disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
        {busy ? 'Procurando…' : 'Buscar atualização agora'}
      </button>
      {result && (
        <p
          role="status"
          data-testid="app-version-result"
          className={`text-xs font-semibold ${
            MESSAGES[result].tone === 'ok' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
          }`}
        >
          {MESSAGES[result].text}
        </p>
      )}
    </section>
  );
};
