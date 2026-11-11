import React, { useState } from 'react';
import {
  BellRing,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard as CreditCardIcon,
  ExternalLink,
  Repeat,
  Settings,
  Users,
  X,
} from 'lucide-react';
import {
  ReminderItem,
} from '../types/finance';
import { formatBRL } from '../utils/financeRules';
import {
  summarizeReminders,
} from '../utils/reminderRules';

interface ReminderCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminders: ReminderItem[];
  onPayCardInvoice?: (cardId: string) => void;
  onMarkTransactionPaid?: (transactionId: string) => void;
  onEditTransaction?: (transactionId: string) => void;
  onOpenSettingsTab?: (tab: string) => void;
}

export const ReminderCenterModal: React.FC<ReminderCenterModalProps> = ({
  isOpen,
  onClose,
  reminders,
  onPayCardInvoice,
  onMarkTransactionPaid,
  onEditTransaction,
  onOpenSettingsTab,
}) => {
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'urgent' | 'invoice' | 'bill' | 'recurring' | 'shared'
  >('all');
  if (!isOpen) return null;

  const summary = summarizeReminders(reminders);

  const filteredReminders = reminders.filter((item) => {
    if (activeFilter === 'urgent') {
      return (
        item.urgency === 'overdue' ||
        item.urgency === 'due_today' ||
        item.urgency === 'due_soon'
      );
    }
    if (activeFilter === 'invoice') return item.type === 'invoice_due';
    if (activeFilter === 'bill') return item.type === 'pending_bill';
    if (activeFilter === 'recurring') return item.type === 'recurring_check';
    if (activeFilter === 'shared') return item.type === 'shared_pending';
    return true;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in modal-shell"
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="reminder-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
              >
                Notificações
                {summary.urgentCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 px-2 py-0.5 text-[11px] font-extrabold text-rose-700 dark:text-rose-300">
                    {summary.urgentCount} urgentes
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acompanhe os avisos das suas finanças.
              </p>
            </div>
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

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeFilter === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Todos ({reminders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('urgent')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeFilter === 'urgent'
                ? 'bg-rose-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Urgentes ({summary.urgentCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('invoice')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeFilter === 'invoice'
                ? 'bg-violet-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Faturas Cartão
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('bill')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeFilter === 'bill'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Contas & Boletos
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('recurring')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeFilter === 'recurring'
                ? 'bg-amber-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Fixos Recorrentes
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('shared')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeFilter === 'shared'
                ? 'bg-sky-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Rateios Compartilhados
          </button>
        </div>

        {/* Scrollable Content: Channel Configuration + Reminders List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Reminders List */}
          {filteredReminders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Nenhuma pendência nesta categoria!
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Suas contas e faturas estão em dia no mês selecionado. Novos vencimentos aparecerão aqui automaticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReminders.map((item) => {
                const isOverdue = item.urgency === 'overdue';
                const isToday = item.urgency === 'due_today';
                const isSoon = item.urgency === 'due_soon';

                return (
                  <div
                    key={item.id}
                    data-testid={`reminder-card-${item.id}`}
                    className={`rounded-xl border p-3.5 sm:p-4 transition-all space-y-3 ${
                      isOverdue
                        ? 'border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20'
                        : isToday
                        ? 'border-amber-300 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20'
                        : isSoon
                        ? 'border-sky-300 dark:border-sky-900 bg-sky-50/40 dark:bg-sky-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border mt-0.5 ${
                            item.type === 'invoice_due'
                              ? 'bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800'
                              : item.type === 'recurring_check'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : item.type === 'shared_pending'
                              ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          {item.type === 'invoice_due' ? (
                            <CreditCardIcon className="h-4 w-4" />
                          ) : item.type === 'recurring_check' ? (
                            <Repeat className="h-4 w-4" />
                          ) : item.type === 'shared_pending' ? (
                            <Users className="h-4 w-4" />
                          ) : (
                            <Calendar className="h-4 w-4" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                              {item.title}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                isOverdue
                                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                  : isToday
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                                  : isSoon
                                  ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {isOverdue
                                ? `Atrasada (${Math.abs(item.daysRemaining)}d)`
                                : isToday
                                ? 'Vence Hoje'
                                : `Em ${item.daysRemaining} dias`}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <span className="block text-[11px] font-semibold text-slate-400">
                          Valor
                        </span>
                        <span className="text-base sm:text-lg font-mono font-extrabold tabular-nums text-slate-900 dark:text-white">
                          {formatBRL(item.amount)}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      {item.type === 'invoice_due' &&
                        item.cardId &&
                        onPayCardInvoice && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onPayCardInvoice(item.cardId!);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition-colors"
                          >
                            <CreditCardIcon className="h-3.5 w-3.5" />
                            Pagar Fatura Agora
                          </button>
                        )}

                      {item.transactionId && onMarkTransactionPaid && (
                        <button
                          type="button"
                          onClick={() =>
                            onMarkTransactionPaid(item.transactionId!)
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Marcar como Pago
                        </button>
                      )}

                      {item.transactionId && onEditTransaction && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onEditTransaction(item.transactionId!);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Ver Detalhes
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Summary Bar */}
        <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-3 bg-slate-50 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
