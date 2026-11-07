import React, { useEffect, useState } from 'react';
import {
  BellRing,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard as CreditCardIcon,
  ExternalLink,
  Eye,
  EyeOff,
  Mail,
  Repeat,
  Send,
  Server,
  Settings,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import {
  ReminderItem,
  ReminderRecurrence,
  ReminderSettings,
} from '../types/finance';
import { formatBRL } from '../utils/financeRules';
import {
  dispatchEmailReminder,
  getRecurrenceLabel,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
  summarizeReminders,
} from '../utils/reminderRules';

interface ReminderCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminders: ReminderItem[];
  settings: ReminderSettings;
  userEmail?: string | null;
  userName?: string | null;
  getAuthToken: () => Promise<string>;
  onUpdateReminderSettings: (partial: Partial<ReminderSettings>) => void;
  onPayCardInvoice?: (cardId: string) => void;
  onMarkTransactionPaid?: (transactionId: string) => void;
  onEditTransaction?: (transactionId: string) => void;
  onOpenSettingsTab?: (tab: string) => void;
}

export const ReminderCenterModal: React.FC<ReminderCenterModalProps> = ({
  isOpen,
  onClose,
  reminders,
  settings,
  userEmail,
  userName,
  getAuthToken,
  onUpdateReminderSettings,
  onPayCardInvoice,
  onMarkTransactionPaid,
  onEditTransaction,
  onOpenSettingsTab,
}) => {
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'urgent' | 'invoice' | 'bill' | 'recurring' | 'shared'
  >('all');
  const [showChannelConfig, setShowChannelConfig] = useState(true);
  const [testNotificationSent, setTestNotificationSent] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [emailInput, setEmailInput] = useState<string>(
    settings.notificationEmail || userEmail || ''
  );
  const [smtpHostInput, setSmtpHostInput] = useState<string>(
    settings.smtpHost || settings.smtpConfig?.host || ''
  );
  const [smtpPortInput, setSmtpPortInput] = useState<string>(
    String(settings.smtpPort ?? settings.smtpConfig?.port ?? 587)
  );
  const [smtpUserInput, setSmtpUserInput] = useState<string>(
    settings.smtpUser || settings.smtpConfig?.user || ''
  );
  const [smtpPassInput, setSmtpPassInput] = useState<string>(
    settings.smtpPass || settings.smtpConfig?.pass || ''
  );
  const [showSmtpPass, setShowSmtpPass] = useState<boolean>(false);

  const [browserPermission, setBrowserPermission] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  useEffect(() => {
    if (settings.notificationEmail) {
      setEmailInput(settings.notificationEmail);
    } else if (userEmail && !emailInput) {
      setEmailInput(userEmail);
    }
    setSmtpHostInput(settings.smtpHost ?? settings.smtpConfig?.host ?? '');
    setSmtpPortInput(String(settings.smtpPort ?? settings.smtpConfig?.port ?? 587));
    setSmtpUserInput(settings.smtpUser ?? settings.smtpConfig?.user ?? '');
    setSmtpPassInput(settings.smtpPass ?? settings.smtpConfig?.pass ?? '');
  }, [
    settings.notificationEmail,
    settings.smtpHost,
    settings.smtpPort,
    settings.smtpUser,
    settings.smtpPass,
    settings.smtpConfig,
    userEmail,
  ]);

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

  const handleRequestPermission = async () => {
    const res = await requestBrowserNotificationPermission();
    setBrowserPermission(res);
    if (res === 'granted') {
      onUpdateReminderSettings({ browserNotificationsEnabled: true });
      sendBrowserNotification(
        'Lembretes Ativados! 🔔',
        'Você receberá lembretes agendados de faturas e contas pendentes.'
      );
    }
  };

  const handleSendTestNotification = () => {
    const urgentItem =
      reminders.find(
        (r) => r.urgency === 'due_today' || r.urgency === 'overdue'
      ) || reminders[0];
    const title = urgentItem
      ? `Lembrete: ${urgentItem.title} (${formatBRL(urgentItem.amount)})`
      : 'Minhas Economias BR — Tudo em dia!';
    const body = urgentItem
      ? `${urgentItem.description}. Toque para abrir seu controle financeiro.`
      : 'Você não possui contas vencendo hoje. Parabéns pelo controle financeiro!';

    sendBrowserNotification(title, body, () => {
      window.focus();
    });

    setTestNotificationSent(true);
    setTimeout(() => setTestNotificationSent(false), 3500);
  };

  const handleSaveEmailAddress = (nextEmail: string) => {
    setEmailInput(nextEmail);
    onUpdateReminderSettings({ notificationEmail: nextEmail.trim() });
  };

  const handleUpdateSmtpField = (
    field: 'smtpHost' | 'smtpPort' | 'smtpUser' | 'smtpPass',
    rawValue: string
  ) => {
    if (field === 'smtpHost') {
      setSmtpHostInput(rawValue);
      onUpdateReminderSettings({ smtpHost: rawValue.trim() });
    } else if (field === 'smtpPort') {
      setSmtpPortInput(rawValue);
      const nextPortNum = Number(rawValue) || 587;
      onUpdateReminderSettings({
        smtpPort: nextPortNum,
        smtpSecure: nextPortNum === 465,
      });
    } else if (field === 'smtpUser') {
      setSmtpUserInput(rawValue);
      onUpdateReminderSettings({ smtpUser: rawValue.trim() });
    } else if (field === 'smtpPass') {
      setSmtpPassInput(rawValue);
      onUpdateReminderSettings({ smtpPass: rawValue });
    }
  };

  const handleSendTestEmail = async () => {
    const targetEmail = (
      emailInput.trim() ||
      settings.notificationEmail ||
      userEmail ||
      ''
    ).trim();

    if (!targetEmail || !targetEmail.includes('@')) {
      setEmailStatusMessage({
        type: 'error',
        text: 'Informe um endereço de e-mail válido para enviar o teste.',
      });
      return;
    }

    const hostVal = smtpHostInput.trim();
    const portVal = Number(smtpPortInput) || 587;
    const userVal = smtpUserInput.trim();
    const passVal = smtpPassInput.trim();

    if (!hostVal || !userVal || !passVal) {
      setEmailStatusMessage({
        type: 'error',
        text: 'Configure suas credenciais SMTP (Host, Porta, Usuário e Senha) para enviar o e-mail.',
      });
      return;
    }

    setIsSendingTestEmail(true);
    setEmailStatusMessage(null);
    try {
      const updatedSettings: ReminderSettings = {
        ...settings,
        notificationEmail: targetEmail,
        smtpHost: hostVal,
        smtpPort: portVal,
        smtpUser: userVal,
        smtpPass: passVal,
        smtpSecure: portVal === 465,
        smtpConfig: {
          host: hostVal,
          port: portVal,
          user: userVal,
          pass: passVal,
          secure: portVal === 465,
        },
      };

      const res = await dispatchEmailReminder({
        reminders,
        recipientEmail: targetEmail,
        userName: userName || undefined,
        settings: updatedSettings,
        smtp: updatedSettings.smtpConfig,
        recurrence: settings.emailRecurrence || settings.recurrence || 'daily',
        preferredTime:
          settings.emailPreferredTime || settings.preferredTime || '08:00',
        isTest: true,
        authToken: await getAuthToken(),
      });

      onUpdateReminderSettings({
        notificationEmail: targetEmail,
        emailNotificationsEnabled: true,
        smtpHost: hostVal,
        smtpPort: portVal,
        smtpUser: userVal,
        smtpPass: passVal,
        smtpSecure: portVal === 465,
        smtpConfig: updatedSettings.smtpConfig,
      });

      setEmailStatusMessage({
        type: 'success',
        text:
          res.message ||
          `E-mail de teste enviado via SMTP (${hostVal}:${portVal}) para ${res.sentTo}!`,
      });
    } catch (err) {
      setEmailStatusMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Erro ao disparar e-mail de teste via SMTP.',
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
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
                Central de Lembretes & Notificações
                {summary.urgentCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 px-2 py-0.5 text-[11px] font-extrabold text-rose-700 dark:text-rose-300">
                    {summary.urgentCount} urgentes
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Alertas no navegador e por e-mail com horário e recorrência personalizáveis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowChannelConfig((prev) => !prev)}
              data-testid="toggle-reminder-channels-btn"
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold border transition-colors ${
                showChannelConfig
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Canais & Horários</span>
              {showChannelConfig ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {onOpenSettingsTab && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettingsTab('reminders');
                }}
                title="Configurações Avançadas de Lembretes"
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

        {/* Quick Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40 text-xs">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-2 text-center bg-white dark:bg-slate-900">
            <span className="block text-[10px] uppercase font-bold text-slate-400">
              Total Pendente
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
              {formatBRL(summary.totalPendingAmount)}
            </span>
          </div>
          <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 p-2 text-center bg-rose-50/60 dark:bg-rose-950/30">
            <span className="block text-[10px] uppercase font-bold text-rose-700 dark:text-rose-300">
              Vencidos
            </span>
            <span className="font-mono font-bold text-rose-700 dark:text-rose-300 text-sm">
              {summary.overdueCount}
            </span>
          </div>
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 p-2 text-center bg-amber-50/60 dark:bg-amber-950/30">
            <span className="block text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300">
              Vence Hoje
            </span>
            <span className="font-mono font-bold text-amber-700 dark:text-amber-300 text-sm">
              {summary.dueTodayCount}
            </span>
          </div>
          <div className="rounded-xl border border-sky-200 dark:border-sky-900/60 p-2 text-center bg-sky-50/60 dark:bg-sky-950/30">
            <span className="block text-[10px] uppercase font-bold text-sky-700 dark:text-sky-300">
              Próximos Dias
            </span>
            <span className="font-mono font-bold text-sky-700 dark:text-sky-300 text-sm">
              {summary.dueSoonCount}
            </span>
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
          {/* Expandable Configuration Panel: Browser & Email Notification Schedule & Recurrence */}
          {showChannelConfig && (
            <section
              data-testid="reminder-channels-config-panel"
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Configuração de Envio: Navegador & E-mail
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Sistema Geral de Lembretes:
                  </span>
                  <button
                    id="quick-reminder-toggle"
                    type="button"
                    role="switch"
                    aria-checked={settings.enabled}
                    onClick={() =>
                      onUpdateReminderSettings({ enabled: !settings.enabled })
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      settings.enabled
                        ? 'bg-emerald-600'
                        : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.enabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Card 1: Browser Notifications */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BellRing className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Alertas no Navegador
                      </span>
                    </div>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        browserPermission === 'granted' && settings.enabled
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {browserPermission === 'granted' ? 'Permitido' : 'Pendente'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor="browser-reminder-time"
                        className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1"
                      >
                        Horário do Alerta
                      </label>
                      <select
                        id="browser-reminder-time"
                        value={settings.preferredTime || '09:00'}
                        onChange={(e) =>
                          onUpdateReminderSettings({
                            preferredTime: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white"
                      >
                        <option value="07:00">07:00</option>
                        <option value="08:00">08:00</option>
                        <option value="09:00">09:00</option>
                        <option value="12:00">12:00</option>
                        <option value="18:00">18:00</option>
                        <option value="20:00">20:00</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="browser-reminder-recurrence"
                        className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1"
                      >
                        Recorrência
                      </label>
                      <select
                        id="browser-reminder-recurrence"
                        value={settings.recurrence || 'daily'}
                        onChange={(e) =>
                          onUpdateReminderSettings({
                            recurrence: e.target.value as ReminderRecurrence,
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-800 dark:text-white"
                      >
                        <option value="daily">Diário (Todos os dias)</option>
                        <option value="weekly">Semanal (Segundas)</option>
                        <option value="monthly">Mensal (Dia 1º do mês)</option>
                        <option value="weekdays">Dias Úteis (Seg–Sex)</option>
                        <option value="urgent_only">Apenas Urgentes</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    {browserPermission !== 'granted' ? (
                      <button
                        type="button"
                        onClick={handleRequestPermission}
                        className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-2.5 py-1.5 text-xs font-bold transition-colors"
                      >
                        Permitir no Navegador
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        {getRecurrenceLabel(settings.recurrence)} às{' '}
                        {settings.preferredTime || '09:00'}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleSendTestNotification}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors ml-auto"
                    >
                      <Send className="h-3 w-3 text-sky-600" />
                      {testNotificationSent ? 'Enviado!' : 'Testar Alerta'}
                    </button>
                  </div>
                </div>

                {/* Card 2: Email Notifications */}
                <div
                  data-testid="email-reminder-config-card"
                  className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-slate-900 p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Notificações por E-mail
                      </span>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-label="Ativar notificações por e-mail"
                      aria-checked={Boolean(settings.emailNotificationsEnabled)}
                      data-testid="email-reminder-toggle"
                      onClick={() =>
                        onUpdateReminderSettings({
                          emailNotificationsEnabled:
                            !settings.emailNotificationsEnabled,
                          notificationEmail:
                            emailInput.trim() ||
                            settings.notificationEmail ||
                            userEmail ||
                            '',
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        settings.emailNotificationsEnabled
                          ? 'bg-emerald-600'
                          : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          settings.emailNotificationsEnabled
                            ? 'translate-x-4'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div>
                    <label
                      htmlFor="reminder-email-address"
                      className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1"
                    >
                      E-mail Destinatário
                    </label>
                    <input
                      id="reminder-email-address"
                      type="email"
                      value={emailInput}
                      onChange={(e) => handleSaveEmailAddress(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor="email-reminder-time"
                        className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1"
                      >
                        Horário do E-mail
                      </label>
                      <select
                        id="email-reminder-time"
                        value={
                          settings.emailPreferredTime ||
                          settings.preferredTime ||
                          '08:00'
                        }
                        onChange={(e) =>
                          onUpdateReminderSettings({
                            emailPreferredTime: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white"
                      >
                        <option value="07:00">07:00 (Manhã)</option>
                        <option value="08:00">08:00 (Padrão)</option>
                        <option value="09:00">09:00 (Comercial)</option>
                        <option value="12:00">12:00 (Meio-dia)</option>
                        <option value="18:00">18:00 (Fim de tarde)</option>
                        <option value="20:00">20:00 (Noite)</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="email-reminder-recurrence"
                        className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1"
                      >
                        Recorrência do E-mail
                      </label>
                      <select
                        id="email-reminder-recurrence"
                        data-testid="email-recurrence-select"
                        value={
                          settings.emailRecurrence ||
                          settings.recurrence ||
                          'daily'
                        }
                        onChange={(e) =>
                          onUpdateReminderSettings({
                            emailRecurrence:
                              e.target.value as ReminderRecurrence,
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-800 dark:text-white"
                      >
                        <option value="daily">Diário (Todos os dias)</option>
                        <option value="weekly">Semanal (Segundas)</option>
                        <option value="monthly">Mensal (Dia 1º do mês)</option>
                        <option value="weekdays">Dias Úteis (Seg–Sex)</option>
                        <option value="urgent_only">Apenas Urgentes</option>
                      </select>
                    </div>
                  </div>

                  {/* Custom SMTP Credentials Section */}
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/50 p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        <Server className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        Servidor SMTP Próprio (Envio Direto)
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {smtpHostInput.trim() && smtpUserInput.trim() && smtpPassInput.trim()
                          ? 'Configurado'
                          : 'Obrigatório'}
                      </span>
                    </div>
                    <p className="text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
                      Por segurança, a senha não é salva no Neon nem nos backups. Redigite-a após recarregar o app ou importar um backup; durante esta sessão, os envios usam a senha informada.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <label
                          htmlFor="reminder-smtp-host"
                          className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5"
                        >
                          Host SMTP
                        </label>
                        <input
                          id="reminder-smtp-host"
                          data-testid="reminder-smtp-host-input"
                          type="text"
                          value={smtpHostInput}
                          onChange={(e) =>
                            handleUpdateSmtpField('smtpHost', e.target.value)
                          }
                          placeholder="ex: smtp.gmail.com"
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="reminder-smtp-port"
                          className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5"
                        >
                          Porta
                        </label>
                        <input
                          id="reminder-smtp-port"
                          data-testid="reminder-smtp-port-input"
                          type="number"
                          min={1}
                          max={65535}
                          value={smtpPortInput}
                          onChange={(e) =>
                            handleUpdateSmtpField('smtpPort', e.target.value)
                          }
                          placeholder="587"
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label
                          htmlFor="reminder-smtp-user"
                          className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5"
                        >
                          Usuário SMTP
                        </label>
                        <input
                          id="reminder-smtp-user"
                          data-testid="reminder-smtp-user-input"
                          type="text"
                          value={smtpUserInput}
                          onChange={(e) =>
                            handleUpdateSmtpField('smtpUser', e.target.value)
                          }
                          placeholder="usuario@dominio.com"
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="reminder-smtp-pass"
                          className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5"
                        >
                          Senha / App Password
                        </label>
                        <div className="relative flex items-center">
                          <input
                            id="reminder-smtp-pass"
                            data-testid="reminder-smtp-pass-input"
                            type={showSmtpPass ? 'text' : 'password'}
                            value={smtpPassInput}
                            onChange={(e) =>
                              handleUpdateSmtpField('smtpPass', e.target.value)
                            }
                            placeholder="Senha ou App Password"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-2 pr-7 py-1 text-xs font-mono text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSmtpPass((prev) => !prev)}
                            aria-label={
                              showSmtpPass
                                ? 'Ocultar senha SMTP'
                                : 'Mostrar senha SMTP'
                            }
                            className="absolute right-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            {showSmtpPass ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-500 truncate">
                      {settings.emailNotificationsEnabled
                        ? `Ativo: ${getRecurrenceLabel(
                            settings.emailRecurrence || settings.recurrence
                          )} às ${settings.emailPreferredTime || '08:00'}`
                        : 'Envio automático desativado'}
                    </span>

                    <button
                      type="button"
                      onClick={handleSendTestEmail}
                      disabled={isSendingTestEmail}
                      data-testid="send-test-email-btn"
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-2.5 py-1.5 text-xs font-bold text-white transition-colors shrink-0"
                    >
                      <Mail className="h-3 w-3" />
                      {isSendingTestEmail
                        ? 'Enviando...'
                        : 'Testar E-mail Agora'}
                    </button>
                  </div>

                  {emailStatusMessage && (
                    <div
                      data-testid="email-reminder-feedback"
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
                        emailStatusMessage.type === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {emailStatusMessage.text}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

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
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <BellRing className="h-3.5 w-3.5 text-sky-600" />
              Navegador:{' '}
              <strong>
                {settings.enabled
                  ? `${getRecurrenceLabel(settings.recurrence)} às ${
                      settings.preferredTime || '09:00'
                    }`
                  : 'Desativado'}
              </strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-emerald-600" />
              E-mail:{' '}
              <strong>
                {settings.enabled && settings.emailNotificationsEnabled
                  ? `${getRecurrenceLabel(
                      settings.emailRecurrence || settings.recurrence
                    )} às ${settings.emailPreferredTime || '08:00'}`
                  : 'Desativado'}
              </strong>
            </span>
          </div>

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
