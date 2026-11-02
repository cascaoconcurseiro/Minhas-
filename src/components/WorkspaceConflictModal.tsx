import { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, UploadCloud } from 'lucide-react';
import type { NeonWorkspaceSnapshot } from '../lib/neonWorkspace';

export interface WorkspaceConflictState {
  localPayload: Record<string, unknown>;
  remoteSnapshot: NeonWorkspaceSnapshot;
}

interface WorkspaceConflictModalProps {
  conflict: WorkspaceConflictState;
  isOpen: boolean;
  isSaving: boolean;
  errorMessage?: string | null;
  onDismiss: () => void;
  onKeepLocal: () => void;
  onUseCloud: () => void;
}

const DATA_KEYS = [
  ['accountsJson', 'Contas'],
  ['cardsJson', 'Cartões'],
  ['categoriesJson', 'Categorias'],
  ['transactionsJson', 'Lançamentos'],
  ['goalsJson', 'Metas'],
  ['familyMembersJson', 'Pessoas compartilhadas'],
  ['investmentsJson', 'Investimentos'],
  ['tripsJson', 'Viagens'],
] as const;

function getItemCount(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (Array.isArray(value)) return value.length;
  if (typeof value !== 'string') return 0;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function versionSummary(payload: Record<string, unknown>) {
  return DATA_KEYS.map(([key, label]) => ({ label, count: getItemCount(payload, key) }));
}

export function WorkspaceConflictModal({
  conflict,
  isOpen,
  isSaving,
  errorMessage,
  onDismiss,
  onKeepLocal,
  onUseCloud,
}: WorkspaceConflictModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const localSummary = versionSummary(conflict.localPayload);
  const cloudSummary = versionSummary(conflict.remoteSnapshot.payload);
  const versions = [
    { title: 'Nesta aba', summary: localSummary },
    { title: 'No Neon', summary: cloudSummary },
  ];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    setBackupDownloaded(false);
  }, [conflict]);

  const downloadBothVersions = () => {
    const content = {
      exportedAt: new Date().toISOString(),
      cloudRevision: conflict.remoteSnapshot.revision,
      localPayload: conflict.localPayload,
      cloudPayload: conflict.remoteSnapshot.payload,
    };
    const blob = new Blob([JSON.stringify(content, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `minhas-economias-conflito-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setBackupDownloaded(true);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="workspace-conflict-title"
      aria-describedby="workspace-conflict-description"
      aria-busy={isSaving}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClose={onDismiss}
      className="m-auto w-[min(100%-1.5rem,46rem)] max-h-[min(90dvh,48rem)] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="max-h-[min(90dvh,48rem)] overflow-y-auto p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-amber-100 p-2 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <RefreshCw aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 id="workspace-conflict-title" className="text-lg font-bold">
              Este workspace mudou em outro lugar
            </h2>
            <p id="workspace-conflict-description" className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Sua cópia local e a versão do Neon são diferentes. As duas estão preservadas. Baixe uma cópia de segurança antes de escolher qual versão continuará ativa.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {versions.map(({ title, summary }) => (
            <section
              key={title}
              aria-label={`Resumo da versão ${title}`}
              className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
            >
              <h3 className="font-semibold">{title}</h3>
              <dl className="mt-3 space-y-1 text-sm">
                {summary.map(({ label, count }) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
                    <dd className="font-medium tabular-nums">{count}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        {errorMessage && (
          <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
            {errorMessage}
          </p>
        )}

        <button
          type="button"
          onClick={downloadBothVersions}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          <Download aria-hidden="true" className="h-4 w-4" />
          {backupDownloaded ? 'Baixar cópia das duas versões novamente' : 'Baixar cópia de segurança das duas versões'}
        </button>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={!backupDownloaded || isSaving}
            onClick={onKeepLocal}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UploadCloud aria-hidden="true" className="h-4 w-4" />
            {isSaving ? 'Salvando sua versão…' : 'Manter esta aba no Neon'}
          </button>
          <button
            type="button"
            disabled={!backupDownloaded || isSaving}
            onClick={onUseCloud}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Descartar alterações locais e carregar Neon
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          “Manter esta aba” grava sua cópia sobre a versão atual do Neon. “Carregar Neon” descarta as alterações locais desta aba e recarrega os dados da nuvem. As duas opções só ficam disponíveis depois do download da cópia de segurança.
        </p>
      </div>
    </dialog>
  );
}
