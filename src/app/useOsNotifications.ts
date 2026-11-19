/** Notificações do sistema e envio diário de lembretes. Parte do App (ver src/App.tsx). */
import { useEffect } from 'react';
import { DEFAULT_REMINDER_SETTINGS, dispatchEmailReminder, formatReminderNotificationMessage, getBrowserNotificationPermissionState, initializeBrowserNotificationPermissions, requestBrowserNotificationPermission, sendBrowserNotification, shouldTriggerDailyNotification, shouldTriggerEmailNotification } from '../domain/reminders/reminderRules';
import { isWorkspaceLoadedForUser } from '../services/workspace/workspaceSession';
import type { AppStateApi } from './useAppState';
import type { WorkspaceSyncApi } from './useWorkspaceSync';
import type { TransactionActionsApi } from './useTransactionActions';
import type { NoticesAndInsightsApi } from './useNoticesAndInsights';

export function useOsNotifications(app: AppStateApi & WorkspaceSyncApi & TransactionActionsApi & NoticesAndInsightsApi) {
  const {
    currentUser,
    dailyReminders,
    effectiveUserDisplayName,
    effectiveUserEmail,
    handleToggleTransactionStatus,
    handleUpdateSettings,
    loadedWorkspaceUidRef,
    scheduledEmailAttemptRef,
    setBrowserPermissionState,
    setIsReminderModalOpen,
    setSettings,
    setShowNotificationInitPrompt,
    settings,
    showNotice,
    todayDateStr,
    transactions,
  } = app;
  // Fluxo de Inicialização de Permissões de Notificação do Sistema Operacional
  useEffect(() => {
    let isMounted = true;
    const remSettings = settings.reminders || DEFAULT_REMINDER_SETTINGS;

    initializeBrowserNotificationPermissions(remSettings, {
      requestIfDefault: false,
    }).then((initResult) => {
      if (!isMounted) return;
      setBrowserPermissionState(initResult.permission);

      if (
        initResult.permission === 'granted' &&
        remSettings.enabled !== false &&
        !remSettings.browserNotificationsEnabled
      ) {
        setSettings((prev) => ({
          ...prev,
          reminders: {
            ...(prev.reminders || DEFAULT_REMINDER_SETTINGS),
            browserNotificationsEnabled: true,
          },
        }));
      } else if (
        (initResult.permission === 'denied' || initResult.permission === 'unsupported') &&
        remSettings.browserNotificationsEnabled
      ) {
        setSettings((prev) => ({
          ...prev,
          reminders: {
            ...(prev.reminders || DEFAULT_REMINDER_SETTINGS),
            browserNotificationsEnabled: false,
          },
        }));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [settings.reminders?.enabled]);

  const handleActivateOsNotificationsFromInit = async () => {
    const perm = await requestBrowserNotificationPermission();
    setBrowserPermissionState(perm);
    if (perm === 'granted') {
      const nextReminders = {
        ...(settings.reminders || DEFAULT_REMINDER_SETTINGS),
        enabled: true,
        browserNotificationsEnabled: true,
      };
      handleUpdateSettings({ reminders: nextReminders });
      const { title, body } = formatReminderNotificationMessage(dailyReminders);
      sendBrowserNotification(title, body, () => {
        setIsReminderModalOpen(true);
      });
      showNotice(
        'Alertas financeiros do sistema operacional ativados com sucesso!',
        undefined,
        true
      );
    } else if (perm === 'denied') {
      handleUpdateSettings({
        reminders: {
          ...(settings.reminders || DEFAULT_REMINDER_SETTINGS),
          browserNotificationsEnabled: false,
        },
      });
      showNotice(
        'Permissão bloqueada pelo navegador. Você pode liberar no ícone de cadeado da barra de endereço.',
        undefined,
        true
      );
    }
  };

  const handleDismissNotificationInitPrompt = () => {
    setShowNotificationInitPrompt(false);
    try {
      localStorage.setItem('minhas_economias_os_notif_dismissed_v1', '1');
    } catch {
      // Ignore storage errors
    }
  };

  // Background daily scheduled reminder checker
  useEffect(() => {
    const checkDailySchedule = () => {
      if (!isWorkspaceLoadedForUser(loadedWorkspaceUidRef.current, currentUser?.uid ?? null)) return;

      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      const remSettings = settings.reminders || DEFAULT_REMINDER_SETTINGS;
      if (
        shouldTriggerDailyNotification(
          remSettings,
          todayDateStr,
          currentTimeStr,
          dailyReminders
        )
      ) {
        if (
          (remSettings.browserNotificationsEnabled ||
            getBrowserNotificationPermissionState() === 'granted') &&
          dailyReminders.length > 0
        ) {
          const { title, body } = formatReminderNotificationMessage(dailyReminders);
          sendBrowserNotification(title, body, () => {
            setIsReminderModalOpen(true);
          });
        }
        setSettings((prev) => ({
          ...prev,
          reminders: {
            ...(prev.reminders || DEFAULT_REMINDER_SETTINGS),
            lastNotifiedDate: todayDateStr,
          },
        }));
      }

      if (
        shouldTriggerEmailNotification(
          remSettings,
          todayDateStr,
          currentTimeStr,
          dailyReminders
        )
      ) {
        const targetEmail = (
          remSettings.notificationEmail ||
          effectiveUserEmail ||
          ''
        ).trim();
        if (
          targetEmail && dailyReminders.length > 0 && currentUser &&
          !currentUser.isAnonymous &&
          (!scheduledEmailAttemptRef.current ||
            scheduledEmailAttemptRef.current.date !== todayDateStr ||
            Date.now() - scheduledEmailAttemptRef.current.at >= 15 * 60 * 1000)
        ) {
          scheduledEmailAttemptRef.current = { date: todayDateStr, at: Date.now() };
          void (async () => {
            try {
              const authToken = await currentUser.getIdToken();
              const result = await dispatchEmailReminder({
                reminders: dailyReminders,
                recipientEmail: targetEmail,
                userName: effectiveUserDisplayName || settings.userName,
                settings: remSettings,
                recurrence: remSettings.emailRecurrence || remSettings.recurrence || 'daily',
                preferredTime: remSettings.emailPreferredTime || remSettings.preferredTime || '08:00',
                currentDateStr: todayDateStr,
                currentTimeStr,
                authToken,
              });
              if (result.ok) {
                setSettings((prev) => ({
                  ...prev,
                  reminders: {
                    ...(prev.reminders || DEFAULT_REMINDER_SETTINGS),
                    lastEmailNotifiedDate: todayDateStr,
                  },
                }));
              }
            } catch (error) {
              console.error('Não foi possível enviar o lembrete agendado:', error);
            }
          })();
        }
      }
    };

    checkDailySchedule();
    const timer = setInterval(checkDailySchedule, 60000);
    return () => clearInterval(timer);
  }, [settings.reminders, todayDateStr, dailyReminders, currentUser, effectiveUserEmail, effectiveUserDisplayName, settings.userName]);

  const handleMarkTransactionPaid = (txId: string) => {
    const target = transactions.find((t) => t.id === txId);
    if (!target) return;
    if (target.status === 'paid') return;
    handleToggleTransactionStatus(txId, 'single');
  };

  return {
    handleActivateOsNotificationsFromInit,
    handleDismissNotificationInitPrompt,
    handleMarkTransactionPaid,
  };
}

export type OsNotificationsApi = ReturnType<typeof useOsNotifications>;
