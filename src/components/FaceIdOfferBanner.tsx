import React, { useEffect, useState } from 'react';
import { ScanFace, X } from 'lucide-react';
import {
  describePasskeyFailure,
  dismissPasskeyOffer,
  getPasskeyErrorMessage,
  isPasskeyEnabledHere,
  isPasskeySupported,
  preparePasskeyRegistration,
  registerPasskey,
  wasPasskeyOfferDismissed,
} from '../lib/passkeyClient';

/** Convite único, depois do login, para ativar o Face ID neste aparelho. */
export const FaceIdOfferBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; detail: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isPasskeyEnabledHere() || wasPasskeyOfferDismissed()) return;
    let cancelled = false;
    void isPasskeySupported().then((supported) => {
      if (cancelled || !supported) return;
      setVisible(true);
      // Busca o desafio e a biblioteca já ao abrir: o iPhone só abre o Face ID logo depois do toque.
      void preparePasskeyRegistration().then((ok) => {
        if (!cancelled) setReady(ok);
      });
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
      setError({ text: getPasskeyErrorMessage(e), detail: describePasskeyFailure(e) });
      // O desafio usado não vale mais: prepara outro e liga o botão de novo quando estiver pronto.
      setReady(false);
      void preparePasskeyRegistration().then(setReady);
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
          {error && (
            <p role="alert" className="text-xs font-semibold text-rose-700 dark:text-rose-300">
              {error.text}
              <span data-testid="face-id-offer-error-detail" className="mt-1 block break-words font-mono text-[10px] font-normal opacity-80">
                Detalhe: {error.detail}
              </span>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="face-id-offer-enable"
              onClick={() => void enable()}
              disabled={busy || !ready}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2.5 sm:py-1.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {ready ? 'Ativar Face ID' : 'Preparando…'}
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
