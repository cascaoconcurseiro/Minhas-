import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppSettings } from '../types/finance';
import { DEFAULT_REMINDER_SETTINGS, resolveSmtpCredentials } from './reminderRules';
import {
  parsePersistedSettings,
  removeSmtpPasswordsFromSettings,
  sanitizeStoredWorkspaceSnapshot,
  serializeSettingsWithoutSmtpSecrets,
} from './secureSettings';

const secret = 'synthetic-smtp-app-password';

function createSettings(): AppSettings {
  return {
    theme: 'light',
    density: 'comfortable',
    privacyMode: false,
    showOverviewAlerts: true,
    alertsExpandedByDefault: true,
    budgetWarningPercent: 80,
    userName: 'Pessoa sintética',
    userPixKey: '',
    reminders: {
      ...DEFAULT_REMINDER_SETTINGS,
      smtpHost: 'smtp.example.test',
      smtpUser: 'user@example.test',
      smtpPass: secret,
      smtpConfig: {
        host: 'smtp.example.test',
        port: 587,
        user: 'user@example.test',
        pass: secret,
      },
    },
  };
}

test('settings serializados para Neon ou cache local omitem passwords SMTP planas e aninhadas', () => {
  const activeSettings = createSettings();
  const persistedSettings = removeSmtpPasswordsFromSettings(activeSettings);
  const settingsJson = serializeSettingsWithoutSmtpSecrets(activeSettings);

  assert.equal(activeSettings.reminders?.smtpPass, secret, 'a sanitização não deve limpar o estado ativo da sessão');
  assert.equal(resolveSmtpCredentials(activeSettings.reminders)?.pass, secret, 'o envio ainda pode resolver a senha em memória');
  assert.equal(resolveSmtpCredentials({
    ...activeSettings.reminders,
    smtpPass: undefined,
  })?.pass, secret, 'a credencial aninhada ainda funciona durante a sessão');
  assert.equal(persistedSettings.reminders?.smtpPass, undefined);
  assert.equal(persistedSettings.reminders?.smtpConfig?.pass, undefined);
  assert.doesNotMatch(settingsJson, /synthetic-smtp-app-password/);
  assert.match(settingsJson, /smtp\.example\.test/, 'host/porta/usuário continuam disponíveis após reload');
});

test('settings legados carregados do Neon têm secrets removidos antes de entrar no estado do app', () => {
  const legacyPayload = JSON.stringify(createSettings());
  const restored = parsePersistedSettings(legacyPayload, createSettings());

  assert.equal(restored.reminders?.smtpPass, undefined);
  assert.equal(restored.reminders?.smtpConfig?.pass, undefined);
  assert.equal(restored.reminders?.smtpHost, 'smtp.example.test');
  assert.equal(restored.reminders?.smtpUser, 'user@example.test');
});

test('cache local legado remove SMTP secrets sem descartar dados financeiros', () => {
  const raw = JSON.stringify({
    accounts: [{ id: 'account-1', name: 'Conta sintética' }],
    transactions: [{ id: 'tx-1', description: 'Compra sintética' }],
    settings: createSettings(),
  });
  const sanitized = sanitizeStoredWorkspaceSnapshot(raw);
  assert.ok(sanitized);
  assert.doesNotMatch(sanitized, /synthetic-smtp-app-password/);
  assert.match(sanitized, /Compra sintética/);
  assert.equal(JSON.parse(sanitized).settings.reminders.smtpConfig.pass, undefined);
  assert.equal(sanitizeStoredWorkspaceSnapshot('{invalid'), null);
});
