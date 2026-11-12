import React, { useCallback, useEffect, useState } from 'react';
import { ScanFace, Trash2 } from 'lucide-react';
import {
  describePasskeyFailure,
  getPasskeyErrorMessage,
  isPasskeyEnabledHere,
  isPasskeySupported,
  listPasskeys,
  preparePasskeyRegistration,
  registerPasskey,
  removePasskey,
  setPasskeyEnabledHere,
  type PasskeySummary,
} from '../lib/passkeyClient';

function formatDate(value: string | null): string {
  if (!value) return 'ainda não usado';
  return new Date(value).toLocaleDateString('pt-BR');
}

/** Ativa, lista e remove o Face ID (passkey) da conta. */
export const FaceIdCard: React.FC = () => {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [items, setItems] = useState<PasskeySummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string; detail?: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [enabledHere, setEnabledHere] = useState(() => isPasskeyEnabledHere());

  const refresh = useCallback(async () => {
    try {
      setItems(await listPasskeys());
    } catch {
      // A lista é só informativa; o botão de ativar continua funcionando.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void isPasskeySupported().then((value) => {
      if (cancelled) return;
      setSupported(value);
      if (!value) return;
      void refresh();
      // Busca o desafio e a biblioteca já ao abrir: o iPhone só abre o Face ID logo depois do toque.
      if (!isPasskeyEnabledHere()) {
        void preparePasskeyRegistration().then((ok) => {
          if (!cancelled) setReady(ok);
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const handleEnable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await registerPasskey();
      setEnabledHere(true);
      setMessage({ tone: 'ok', text: 'Face ID ativado. Na próxima vez, entre só com o rosto.' });
      await refresh();
    } catch (error) {
      setMessage({ tone: 'error', text: getPasskeyErrorMessage(error), detail: describePasskeyFailure(error) });
      // O desafio usado não vale mais: prepara outro e liga o botão de novo quando estiver pronto.
      setReady(false);
      void preparePasskeyRegistration().then(setReady);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (item: PasskeySummary) => {
    setBusy(true);
    setMessage(null);
    try {
      await removePasskey(item.id);
      if (items.length <= 1) {
        setPasskeyEnabledHere(false);
        setEnabledHere(false);
      }
      setMessage({ tone: 'ok', text: 'Face ID removido.' });
      await refresh();
    } catch (error) {
      setMessage({ tone: 'error', text: getPasskeyErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  if (supported === null) return null;

  return (
    <section
      aria-label="Face ID"
      data-testid="face-id-card"
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
          <ScanFace className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Entrar com Face ID</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Entre no app só com o rosto, sem digitar a senha. Seu rosto nunca sai do celular.
          </p>
        </div>
      </div>

      {!supported ? (
        <p className="text-xs text-slate-500 dark:text-slate-400" data-testid="face-id-unsupported">
          Este aparelho ou navegador não oferece Face ID, Touch ID ou biometria para o app.
        </p>
      ) : (
        <>
          {!enabledHere && (
            <button
              type="button"
              data-testid="face-id-enable-btn"
              onClick={() => void handleEnable()}
              disabled={busy || !ready}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-60"
            >
              <ScanFace className="h-4 w-4" />
              {ready ? 'Ativar Face ID neste aparelho' : 'Preparando o Face ID…'}
            </button>
          )}
          {enabledHere && (
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              Face ID ativado neste aparelho.
            </p>
          )}
          {items.length > 0 && (
            <ul className="space-y-1.5" data-testid="face-id-list">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2 text-xs"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-900 dark:text-white">{item.label}</span>
                    <span className="block text-slate-500 dark:text-slate-400">
                      Ativado em {formatDate(item.createdAt)} · último uso: {formatDate(item.lastUsedAt)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleRemove(item)}
                    disabled={busy}
                    aria-label={`Remover Face ID de ${item.label}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900 px-2 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {message && (
        <p
          role="status"
          className={`text-xs font-semibold ${message.tone === 'ok' ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}
        >
          {message.text}
          {message.detail && (
            <span data-testid="face-id-error-detail" className="mt-1 block break-words font-mono text-[10px] font-normal opacity-80">
              Detalhe: {message.detail}
            </span>
          )}
        </p>
      )}
    </section>
  );
};
