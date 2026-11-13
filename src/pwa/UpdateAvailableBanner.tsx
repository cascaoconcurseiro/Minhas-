import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { checkAndApplyUpdate, isUpdatePending, subscribeUpdatePending } from './pwaControl';

interface UpdateAvailableBannerProps {
  /** Quanto tempo a versão nova pode ficar esperando sozinha antes de aparecer o aviso. */
  delayMs?: number;
}

/**
 * Aviso discreto quando há versão nova pronta e ela ainda não entrou sozinha (por exemplo, porque a
 * pessoa está usando o app sem parar). Atualizar recarrega o app, então só acontece por toque.
 */
export const UpdateAvailableBanner: React.FC<UpdateAvailableBannerProps> = ({ delayMs = 10_000 }) => {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const arm = () => {
      if (timer !== undefined) return;
      timer = window.setTimeout(() => setVisible(true), delayMs);
    };
    if (isUpdatePending()) arm();
    const unsubscribe = subscribeUpdatePending(arm);
    return () => {
      unsubscribe();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [delayMs]);

  if (!visible) return null;

  return (
    <div
      role="status"
      data-testid="update-available-banner"
      className="fixed inset-x-3 bottom-24 z-[90] mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-lg lg:bottom-4"
    >
      <span className="text-sm font-semibold">Nova versão do app disponível</span>
      <button
        type="button"
        data-testid="update-available-apply"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await checkAndApplyUpdate();
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-bold text-slate-900 disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
        {busy ? 'Atualizando…' : 'Atualizar'}
      </button>
    </div>
  );
};
