import type { AppSettings, ReminderSettings } from '../types/finance';
import { parseWorkspaceObject } from './workspacePayload';

/** Remove SMTP secrets before settings leave the active in-memory session. */
export function removeSmtpPasswordsFromSettings(settings: AppSettings): AppSettings {
  const settingsRecord = settings as AppSettings & Record<string, unknown>;
  const rawReminders = settingsRecord.reminders;
  if (!rawReminders || typeof rawReminders !== 'object' || Array.isArray(rawReminders)) {
    return settings;
  }

  const reminders = { ...(rawReminders as ReminderSettings) };
  delete reminders.smtpPass;
  const rawSmtpConfig = reminders.smtpConfig;
  if (rawSmtpConfig && typeof rawSmtpConfig === 'object' && !Array.isArray(rawSmtpConfig)) {
    const smtpConfig = { ...rawSmtpConfig };
    delete smtpConfig.pass;
    reminders.smtpConfig = smtpConfig;
  }

  return { ...settings, reminders };
}

export function serializeSettingsWithoutSmtpSecrets(settings: AppSettings): string {
  return JSON.stringify(removeSmtpPasswordsFromSettings(settings));
}

/** Parse both current and legacy persisted settings, dropping any old plaintext SMTP password. */
export function parsePersistedSettings(
  raw: unknown,
  fallback: AppSettings
): AppSettings {
  return removeSmtpPasswordsFromSettings(
    parseWorkspaceObject<AppSettings>(raw, fallback, 'settingsJson')
  );
}

/** Sanitize an existing local workspace cache without dropping its other fields. */
export function sanitizeStoredWorkspaceSnapshot(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const snapshot = parsed as Record<string, unknown>;
    if (!snapshot.settings || typeof snapshot.settings !== 'object' || Array.isArray(snapshot.settings)) {
      return null;
    }
    return JSON.stringify({
      ...snapshot,
      settings: removeSmtpPasswordsFromSettings(snapshot.settings as AppSettings),
    });
  } catch {
    return null;
  }
}
