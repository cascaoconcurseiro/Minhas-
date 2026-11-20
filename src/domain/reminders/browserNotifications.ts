/** Permissão e envio de notificações do navegador. */
import type {
  ReminderSettings,
} from '../../types/finance';
import {
  DEFAULT_REMINDER_SETTINGS,
} from './reminderSettings.ts';

export function getBrowserNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Wrapper seguro para Web Notification API do navegador.
 */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return 'denied';
  }
}

export interface BrowserNotificationInitResult {
  permission: NotificationPermission | 'unsupported';
  browserNotificationsEnabled: boolean;
  shouldShowSetupPrompt: boolean;
}

/**
 * Configura e sincroniza as permissões de notificação do navegador no fluxo de inicialização,
 * permitindo que o usuário receba alertas financeiros agendados diretamente no sistema operacional.
 */
export async function initializeBrowserNotificationPermissions(
  settings: ReminderSettings = DEFAULT_REMINDER_SETTINGS,
  options?: { requestIfDefault?: boolean }
): Promise<BrowserNotificationInitResult> {
  let permission = getBrowserNotificationPermissionState();

  if (permission === 'unsupported') {
    return {
      permission: 'unsupported',
      browserNotificationsEnabled: false,
      shouldShowSetupPrompt: false,
    };
  }

  // Se solicitado ou se o usuário já havia habilitado nas preferências e o navegador permite solicitar
  if (
    permission === 'default' &&
    (options?.requestIfDefault || settings.browserNotificationsEnabled)
  ) {
    try {
      const requested = await Notification.requestPermission();
      if (requested === 'granted' || requested === 'denied' || requested === 'default') {
        permission = requested;
      }
    } catch {
      // Alguns navegadores exigem gesto explícito do usuário; mantém 'default' para exibir a faixa de ativação 1-clique
      permission = getBrowserNotificationPermissionState();
    }
  }

  if (permission === 'granted') {
    return {
      permission: 'granted',
      browserNotificationsEnabled: settings.enabled !== false,
      shouldShowSetupPrompt: false,
    };
  }

  if (permission === 'denied') {
    return {
      permission: 'denied',
      browserNotificationsEnabled: false,
      shouldShowSetupPrompt: false,
    };
  }

  return {
    permission: 'default',
    browserNotificationsEnabled: false,
    shouldShowSetupPrompt: settings.enabled !== false,
  };
}

export function sendBrowserNotification(
  title: string,
  body: string,
  onClick?: () => void
): boolean {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return false;
  }

  try {
    const notif = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'minhas-economias-daily-alert',
    });
    if (onClick) {
      notif.onclick = () => {
        window.focus();
        onClick();
      };
    }
    return true;
  } catch {
    // Fallback para Service Worker Notification em contextos mobile/PWA
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.showNotification(title, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'minhas-economias-daily-alert',
          });
        })
        .catch(() => {
          // Ignore fallback errors
        });
      return true;
    }
    return false;
  }
}
