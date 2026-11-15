import React from 'react';
import { AlertTriangle, Copy, Info, MessageCircle } from 'lucide-react';
import {
  buildFamilyInviteMessage,
  buildWhatsAppInviteUrl,
  getFamilyInviteStatus,
} from '../../domain/family/familyInvite';
import type { FamilyInviteTone } from '../../domain/family/familyInvite';

interface FamilyInvitePanelProps {
  email: string;
  /** true/false vindo do servidor; undefined quando ele não soube responder. */
  hasAccount?: boolean;
  onFeedback: (message: string) => void;
}

const TONE_STYLES: Record<FamilyInviteTone, string> = {
  warning: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
  info: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

/** Convite pendente enviado por mim: diz em que pé está e deixa avisar a pessoa (o app não envia e-mail). */
export const FamilyInvitePanel: React.FC<FamilyInvitePanelProps> = ({ email, hasAccount, onFeedback }) => {
  const status = getFamilyInviteStatus(email, hasAccount);
  const message = buildFamilyInviteMessage({ appUrl: window.location.origin, email });
  const Icon = status.tone === 'warning' ? AlertTriangle : Info;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(message);
      onFeedback('Convite copiado. Cole na conversa com a pessoa.');
    } catch {
      onFeedback('Não foi possível copiar. Use o botão WhatsApp.');
    }
  };

  return (
    <div
      data-testid="family-invite-panel"
      className={`rounded-lg border p-2.5 text-xs space-y-2 ${TONE_STYLES[status.tone]}`}
    >
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 break-words">
          <p className="font-bold">{status.title}</p>
          <p className="mt-0.5">{status.detail}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => void copyInvite()}
          className="inline-flex items-center gap-1 rounded border border-current bg-white/70 px-2 py-1 text-[11px] font-bold hover:bg-white dark:bg-slate-900/40"
        >
          <Copy className="h-3 w-3" aria-hidden="true" />
          Copiar convite
        </button>
        <a
          href={buildWhatsAppInviteUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded border border-current bg-white/70 px-2 py-1 text-[11px] font-bold hover:bg-white dark:bg-slate-900/40"
        >
          <MessageCircle className="h-3 w-3" aria-hidden="true" />
          Enviar pelo WhatsApp
        </a>
      </div>
    </div>
  );
};
