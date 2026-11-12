import React, { useEffect, useState } from 'react';
import { ScanFace, X } from 'lucide-react';
import {
  dismissPasskeyOffer,
  getPasskeyErrorMessage,
  isPasskeyCancellation,
  isPasskeyEnabledHere,
  isPasskeySupported,
  registerPasskey,
  wasPasskeyOfferDismissed,
} from '../lib/passkeyClient';

/** Convite único, depois do login, para ativar o Face ID neste aparelho. */
export const FaceIdOfferBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPasskeyEnabledHere() || wasPasskeyOfferDismissed()) return;
    let cancelled = false;
    void isPasskeySupported().then((supported) => {
      if (!cancelled && supported) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    dismissPasskeyOffer();
    setVisible(false);
  };

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      await registerPasskey();
      setVisible(false);
    } catch (e) {
      if (!isPasskeyCancellation(e)) setError(getPasskeyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Ativar Face ID"
      data-testid="face-id-offer"
      className="mb-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5"
    >
      <div className="flex items-start gap-3">
        <ScanFace className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Entrar só com o rosto?</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Ative o Face ID e da próxima vez você entra sem digitar e-mail e senha.
            </p>
          </div>
          {error && <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="face-id-offer-enable"
              onClick={() => void enable()}
              disabled={busy}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
            >
              Ativar Face ID
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              Agora não
            </button>
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label="Fechar convite" className="rounded p-1 text-slate-400 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
