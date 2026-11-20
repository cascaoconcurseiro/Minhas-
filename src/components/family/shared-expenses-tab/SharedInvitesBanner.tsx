/** Convites recebidos ainda sem resposta. Parte de SharedExpensesTab (ver SharedExpensesTab.tsx). */
import { Mail, X } from 'lucide-react';
import { AcceptFamilyInviteForm } from '../AcceptFamilyInviteForm';
import type { SharedExpensesTabContext } from './sharedExpensesTabContext';

export function SharedInvitesBanner({ form }: { form: SharedExpensesTabContext }) {
  const {
    onAcceptFamilyInvite,
    onDeclineFamilyInvite,
    pendingIncomingInvites,
  } = form;
  return (
    <>
{pendingIncomingInvites.length > 0 && (
        <div
          data-testid="incoming-family-invites-card"
          className="rounded-2xl border-2 border-indigo-400 bg-indigo-50/90 dark:bg-indigo-950/50 p-4 sm:p-5 space-y-3 shadow-xs"
        >
          {pendingIncomingInvites.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                  <Mail className="h-3 w-3" />
                  Convite Familiar Recebido
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  {inv.invitedByName || inv.name} ({inv.invitedByEmail || inv.email}) convidou você para a Divisão Familiar
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Ao aceitar, suas despesas compartilhadas e o encontro de contas ficam sincronizados entre as contas.
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-2 shrink-0 sm:items-end">
                {onAcceptFamilyInvite && (
                  <AcceptFamilyInviteForm
                    inviteId={inv.id}
                    onAccept={(code) => onAcceptFamilyInvite(inv, code)}
                  />
                )}
                <button
                  type="button"
                  data-testid={`decline-family-invite-${inv.id}`}
                  onClick={() => onDeclineFamilyInvite && onDeclineFamilyInvite(inv)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
