import React from 'react';
import {
  BellRing,
  CheckCircle2,
  CreditCard as CreditCardIcon,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { FamilyMember, ReminderItem } from '../types/finance';
import { formatBRL } from '../utils/financeRules';
import { countBellNotices, type AppNotice, type AppNoticeAction } from '../utils/appNotices';

interface ReminderCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Avisos de hoje: atrasados, que vencem hoje ou em poucos dias. */
  reminders: ReminderItem[];
  /** Convites de família recebidos e ainda sem resposta. */
  familyInvites?: FamilyMember[];
  onAcceptFamilyInvite?: (member: FamilyMember) => void;
  onDeclineFamilyInvite?: (member: FamilyMember) => void;
  onPayCardInvoice?: (cardId: string) => void;
  onMarkTransactionPaid?: (transactionId: string) => void;
  onOpenSettingsTab?: (tab: string) => void;
  /** Previsão de saldo negativo, cartão perto ou acima do limite e dados para revisar. */
  notices?: AppNotice[];
  onNoticeAction?: (action: AppNoticeAction) => void;
  /** Marca o aviso como lido (some até o conteúdo mudar). */
  onDismissNotice?: (notice: AppNotice) => void;
}

const urgencyStyles: Record<string, string> = {
  overdue: 'border-rose-300 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20',
  due_today: 'border-amber-300 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20',
  due_soon: 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
  upcoming: 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
};

function urgencyLabel(item: ReminderItem): string {
  if (item.urgency === 'overdue') return `Atrasado há ${Math.abs(item.daysRemaining)}d`;
  if (item.urgency === 'due_today') return 'Vence hoje';
  return item.daysRemaining === 1 ? 'Vence amanhã' : `Vence em ${item.daysRemaining} dias`;
}

export const ReminderCenterModal: React.FC<ReminderCenterModalProps> = ({
  isOpen,
  onClose,
  reminders,
  familyInvites = [],
  onAcceptFamilyInvite,
  onDeclineFamilyInvite,
  onPayCardInvoice,
  onMarkTransactionPaid,
  onOpenSettingsTab,
  notices = [],
  onNoticeAction,
  onDismissNotice,
}) => {
  if (!isOpen) return null;

  const totalNotices = reminders.length + familyInvites.length + countBellNotices(notices);
  const hasItems = reminders.length + familyInvites.length + notices.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in modal-shell"
    >
      <div className="relative w-full max-w-lg max-h-[88dvh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <BellRing className="h-4 w-4" />
            </div>
            <h2
              id="reminder-modal-title"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              Notificações
              {totalNotices > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 text-[11px] font-extrabold text-rose-700 dark:text-rose-300">
                  {totalNotices}
                </span>
              )}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenSettingsTab && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettingsTab('reminders');
                }}
                title="Configurações de notificações"
                aria-label="Configurações de notificações"
                className="rounded-lg p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-lg p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {!hasItems ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Nada exige atenção hoje
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Contas atrasadas, vencimentos próximos, previsão de saldo, cartão e convites aparecem aqui.
              </p>
            </div>
          ) : (
            <>
              {familyInvites.map((invite) => (
                <div
                  key={invite.id}
                  data-testid={`family-invite-notice-${invite.id}`}
                  className="rounded-xl border border-indigo-300 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/20 p-3.5 space-y-2.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        Convite de {invite.invitedByName || invite.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Convidou você para dividir despesas em família.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    {onDeclineFamilyInvite && (
                      <button
                        type="button"
                        onClick={() => onDeclineFamilyInvite(invite)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                      >
                        Recusar
                      </button>
                    )}
                    {onAcceptFamilyInvite && (
                      <button
                        type="button"
                        data-testid={`accept-family-invite-${invite.id}`}
                        onClick={() => onAcceptFamilyInvite(invite)}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition-colors"
                      >
                        Aceitar
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {notices.map((notice) => (
                <div
                  key={notice.id}
                  data-testid={`notice-${notice.id}`}
                  className={`rounded-xl border p-3.5 space-y-2.5 ${
                    notice.tone === 'danger'
                      ? 'border-rose-300 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20'
                      : notice.tone === 'warn'
                      ? 'border-amber-300 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white break-words">{notice.title}</p>
                    {notice.detail && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 break-words">{notice.detail}</p>
                    )}
                  </div>
                  {((notice.action && notice.actionLabel && onNoticeAction) || onDismissNotice) && (
                    <div className="flex flex-wrap justify-end gap-2">
                      {onDismissNotice && (
                        <button
                          type="button"
                          data-testid={`notice-dismiss-${notice.id}`}
                          onClick={() => onDismissNotice(notice)}
                          className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 dark:border-slate-700 px-3 text-xs font-bold text-slate-700 dark:text-slate-200"
                        >
                          Marcar como lido
                        </button>
                      )}
                      {notice.action && notice.actionLabel && onNoticeAction && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNoticeAction(notice.action!);
                        }}
                        className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 dark:bg-white px-3 text-xs font-bold text-white dark:text-slate-900"
                      >
                        {notice.actionLabel}
                      </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {reminders.map((item) => (
                <div
                  key={item.id}
                  data-testid={`reminder-card-${item.id}`}
                  className={`rounded-xl border p-3.5 space-y-2.5 ${urgencyStyles[item.urgency]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white break-words sm:truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        <span
                          className={
                            item.urgency === 'overdue'
                              ? 'font-bold text-rose-600 dark:text-rose-400'
                              : item.urgency === 'due_today'
                              ? 'font-bold text-amber-700 dark:text-amber-400'
                              : 'font-semibold'
                          }
                        >
                          {urgencyLabel(item)}
                        </span>
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-mono font-extrabold tabular-nums text-slate-900 dark:text-white">
                      {formatBRL(item.amount)}
                    </span>
                  </div>

                  {((item.type === 'invoice_due' && item.cardId && onPayCardInvoice) ||
                    (item.transactionId && item.type !== 'shared_pending' && onMarkTransactionPaid)) && (
                    <div className="flex justify-end">
                      {item.type === 'invoice_due' && item.cardId && onPayCardInvoice ? (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onPayCardInvoice(item.cardId!);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-white hover:opacity-90 px-3 py-1.5 text-xs font-bold text-white dark:text-slate-900 transition-opacity"
                        >
                          <CreditCardIcon className="h-3.5 w-3.5" />
                          Pagar fatura
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onMarkTransactionPaid?.(item.transactionId!)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Marcar como pago
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
