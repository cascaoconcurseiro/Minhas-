/** Aba Lembretes e e-mail. Parte de SettingsModal (ver SettingsModal.tsx). */
import { DEFAULT_REMINDER_SETTINGS, requestBrowserNotificationPermission, sendBrowserNotification } from '../../../domain/reminders/reminderRules';
import { Eye, EyeOff } from 'lucide-react';
import type { SettingsModalContext } from './settingsModalContext';

export function SettingsRemindersTab({ form }: { form: SettingsModalContext }) {
  const {
    activeTab,
    onUpdateSettings,
    setShowSmtpPassword,
    setTestNotificationSent,
    settings,
    showSmtpPassword,
    testNotificationSent,
    userEmail,
  } = form;
  return (
    <>
{activeTab === 'reminders' && (
            <div className="space-y-6">
              {/* Section 1: Ativação e Horário */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Sistema de Lembretes Diários
                  </label>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      (settings.reminders?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled)
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {(settings.reminders?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled)
                      ? 'Lembretes Ativos'
                      : 'Lembretes Desativados'}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Ativar Alertas Diários Automáticos
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        O sistema verifica pendências e envia lembretes sobre contas a pagar e faturas a vencer.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.reminders?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled}
                    aria-label="Lembretes ativados"
                      onClick={() =>
                        onUpdateSettings({
                          reminders: {
                            ...DEFAULT_REMINDER_SETTINGS,
                            ...settings.reminders,
                            enabled: !(settings.reminders?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled),
                          },
                        })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        (settings.reminders?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled)
                          ? 'bg-emerald-600'
                          : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          (settings.reminders?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled)
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-200/80 dark:border-slate-700">
                    <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Horário Preferencial (Navegador)
                      </label>
                      <select
                        value={settings.reminders?.preferredTime ?? DEFAULT_REMINDER_SETTINGS.preferredTime}
                        onChange={(e) =>
                          onUpdateSettings({
                            reminders: {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                              preferredTime: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                      >
                        <option value="07:00">07:00 (Início da manhã)</option>
                        <option value="08:00">08:00 (Manhã cedo)</option>
                        <option value="09:00">09:00 (Início do dia - Recomendado)</option>
                        <option value="12:00">12:00 (Almoço / Meio-dia)</option>
                        <option value="18:00">18:00 (Final do expediente)</option>
                        <option value="20:00">20:00 (Noite)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Recorrência dos Alertas
                      </label>
                      <select
                        id="settings-browser-recurrence"
                        value={settings.reminders?.recurrence ?? DEFAULT_REMINDER_SETTINGS.recurrence ?? 'daily'}
                        onChange={(e) =>
                          onUpdateSettings({
                            reminders: {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                              recurrence: e.target.value as any,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                      >
                        <option value="daily">Diário (Todos os dias)</option>
                        <option value="weekly">Semanal (Toda Segunda)</option>
                        <option value="monthly">Mensal (Dia 1º do mês)</option>
                        <option value="weekdays">Dias Úteis (Seg a Sex)</option>
                        <option value="urgent_only">Apenas Urgentes (Vencendo / Atrasados)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Antecedência para Faturas de Cartão
                      </label>
                      <select
                        value={settings.reminders?.daysBeforeInvoiceDue ?? DEFAULT_REMINDER_SETTINGS.daysBeforeInvoiceDue}
                        onChange={(e) =>
                          onUpdateSettings({
                            reminders: {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                              daysBeforeInvoiceDue: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                      >
                        <option value={1}>1 dia antes do vencimento</option>
                        <option value={2}>2 dias antes do vencimento</option>
                        <option value={3}>3 dias antes (Padrão ouro)</option>
                        <option value={5}>5 dias antes do vencimento</option>
                        <option value={7}>7 dias antes (1 semana)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 2: Tipos de Notificação */}
              <section className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  2. Quais pendências devem gerar lembretes?
                </label>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Faturas de Cartão de Crédito
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Notifica quando a fatura fecha ou aproxima do dia do vencimento.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.reminders?.notifyInvoiceDue ?? DEFAULT_REMINDER_SETTINGS.notifyInvoiceDue}
                      onChange={(e) =>
                        onUpdateSettings({
                          reminders: {
                            ...DEFAULT_REMINDER_SETTINGS,
                            ...settings.reminders,
                            notifyInvoiceDue: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-200/60 dark:border-slate-700">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Despesas e Boletos Pendentes
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Contas pontuais cadastradas com status &quot;Pendente&quot; no mês.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.reminders?.notifyPendingBills ?? DEFAULT_REMINDER_SETTINGS.notifyPendingBills}
                      onChange={(e) =>
                        onUpdateSettings({
                          reminders: {
                            ...DEFAULT_REMINDER_SETTINGS,
                            ...settings.reminders,
                            notifyPendingBills: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-200/60 dark:border-slate-700">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Transações Recorrentes (Contas Fixas)
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Aluguel, condomínio, internet, salário ou mensalidades fixas.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.reminders?.notifyRecurringEntries ?? DEFAULT_REMINDER_SETTINGS.notifyRecurringEntries}
                      onChange={(e) =>
                        onUpdateSettings({
                          reminders: {
                            ...DEFAULT_REMINDER_SETTINGS,
                            ...settings.reminders,
                            notifyRecurringEntries: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-200/60 dark:border-slate-700">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Rateios Familiares a Receber
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Lembrete de despesas compartilhadas ainda não reembolsadas.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.reminders?.notifySharedReimbursements ?? DEFAULT_REMINDER_SETTINGS.notifySharedReimbursements}
                      onChange={(e) =>
                        onUpdateSettings({
                          reminders: {
                            ...DEFAULT_REMINDER_SETTINGS,
                            ...settings.reminders,
                            notifySharedReimbursements: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                  </label>
                </div>
              </section>

              {/* Section 3: Notificações por E-mail */}
              <section className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  3. Envio de Lembretes por E-mail
                </label>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Ativar Notificações por E-mail
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Receba um boletim automático com faturas e boletos pendentes no horário e recorrência escolhidos.
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.reminders?.emailNotificationsEnabled ?? false}
                    aria-label="Lembretes por e-mail"
                      onClick={() =>
                        onUpdateSettings({
                          reminders: {
                            ...DEFAULT_REMINDER_SETTINGS,
                            ...settings.reminders,
                            emailNotificationsEnabled: !(settings.reminders?.emailNotificationsEnabled ?? false),
                            notificationEmail:
                              settings.reminders?.notificationEmail || userEmail || '',
                          },
                        })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        (settings.reminders?.emailNotificationsEnabled ?? false)
                          ? 'bg-emerald-600'
                          : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          (settings.reminders?.emailNotificationsEnabled ?? false)
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200/80 dark:border-slate-700">
                    <div>
                      <label htmlFor="settings-reminder-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        E-mail Destinatário
                      </label>
                      <input
                        type="email"
                        id="settings-reminder-email"
                        placeholder="seuemail@exemplo.com"
                        value={settings.reminders?.notificationEmail ?? userEmail ?? ''}
                        onChange={(e) =>
                          onUpdateSettings({
                            reminders: {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                              notificationEmail: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="settings-reminder-email-time" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Horário do E-mail
                      </label>
                      <select
                        id="settings-reminder-email-time"
                        value={settings.reminders?.emailPreferredTime ?? DEFAULT_REMINDER_SETTINGS.emailPreferredTime ?? '08:00'}
                        onChange={(e) =>
                          onUpdateSettings({
                            reminders: {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                              emailPreferredTime: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                      >
                        <option value="07:00">07:00 (Início da manhã)</option>
                        <option value="08:00">08:00 (Manhã - Recomendado)</option>
                        <option value="09:00">09:00 (Horário comercial)</option>
                        <option value="12:00">12:00 (Meio-dia)</option>
                        <option value="18:00">18:00 (Fim de tarde)</option>
                        <option value="20:00">20:00 (Noite)</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="settings-email-recurrence"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        Recorrência de Envio por E-mail
                      </label>
                      <select
                        id="settings-email-recurrence"
                        data-testid="settings-email-recurrence-select"
                        value={settings.reminders?.emailRecurrence ?? DEFAULT_REMINDER_SETTINGS.emailRecurrence ?? 'daily'}
                        onChange={(e) =>
                          onUpdateSettings({
                            reminders: {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                              emailRecurrence: e.target.value as any,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                      >
                        <option value="daily">Diário (Todos os dias)</option>
                        <option value="weekly">Semanal (Toda Segunda)</option>
                        <option value="monthly">Mensal (Dia 1º do mês)</option>
                        <option value="weekdays">Dias Úteis (Seg a Sex)</option>
                        <option value="urgent_only">Apenas Urgentes (Vencendo / Atrasados)</option>
                      </select>
                    </div>
                  </div>

                  {/* Subsection: Credenciais do Servidor SMTP Próprio */}
                  <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                          Credenciais do Servidor SMTP Próprio
                        </h5>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Utilize seu próprio servidor SMTP (Gmail, Outlook, Zoho ou corporativo) para disparo dos lembretes.
                        </p>
                        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                          Por segurança, a senha não é salva no Neon nem nos backups. Redigite-a após recarregar o app ou importar um backup; durante esta sessão, os envios usam a senha informada.
                        </p>
                      </div>
                      <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                        Envio via SMTP do Usuário
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-5">
                        <label
                          htmlFor="settings-smtp-host"
                          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                        >
                          Host SMTP
                        </label>
                        <input
                          id="settings-smtp-host"
                          data-testid="settings-smtp-host-input"
                          type="text"
                          placeholder="ex: smtp.gmail.com"
                          value={settings.reminders?.smtpHost ?? settings.reminders?.smtpConfig?.host ?? ''}
                          onChange={(e) => {
                            const nextHost = e.target.value;
                            const currentRem = {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                            };
                            const portNum = Number(currentRem.smtpPort ?? 587) || 587;
                            onUpdateSettings({
                              reminders: {
                                ...currentRem,
                                smtpHost: nextHost,
                                smtpConfig: {
                                  host: nextHost.trim(),
                                  port: portNum,
                                  user: (currentRem.smtpUser || '').trim(),
                                  pass: currentRem.smtpPass || '',
                                  secure: portNum === 465,
                                },
                              },
                            });
                          }}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label
                          htmlFor="settings-smtp-port"
                          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                        >
                          Porta SMTP
                        </label>
                        <input
                          id="settings-smtp-port"
                          data-testid="settings-smtp-port-input"
                          type="number"
                          min={1}
                          max={65535}
                          placeholder="587"
                          value={settings.reminders?.smtpPort ?? settings.reminders?.smtpConfig?.port ?? 587}
                          onChange={(e) => {
                            const nextPort = Number(e.target.value) || 587;
                            const currentRem = {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                            };
                            onUpdateSettings({
                              reminders: {
                                ...currentRem,
                                smtpPort: nextPort,
                                smtpSecure: nextPort === 465,
                                smtpConfig: {
                                  host: (currentRem.smtpHost || '').trim(),
                                  port: nextPort,
                                  user: (currentRem.smtpUser || '').trim(),
                                  pass: currentRem.smtpPass || '',
                                  secure: nextPort === 465,
                                },
                              },
                            });
                          }}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="sm:col-span-5">
                        <label
                          htmlFor="settings-smtp-user"
                          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                        >
                          Usuário SMTP
                        </label>
                        <input
                          id="settings-smtp-user"
                          data-testid="settings-smtp-user-input"
                          type="text"
                          placeholder="seuemail@dominio.com"
                          value={settings.reminders?.smtpUser ?? settings.reminders?.smtpConfig?.user ?? ''}
                          onChange={(e) => {
                            const nextUser = e.target.value;
                            const currentRem = {
                              ...DEFAULT_REMINDER_SETTINGS,
                              ...settings.reminders,
                            };
                            const portNum = Number(currentRem.smtpPort ?? 587) || 587;
                            onUpdateSettings({
                              reminders: {
                                ...currentRem,
                                smtpUser: nextUser,
                                smtpConfig: {
                                  host: (currentRem.smtpHost || '').trim(),
                                  port: portNum,
                                  user: nextUser.trim(),
                                  pass: currentRem.smtpPass || '',
                                  secure: portNum === 465,
                                },
                              },
                            });
                          }}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="sm:col-span-12">
                        <label
                          htmlFor="settings-smtp-pass"
                          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                        >
                          Senha SMTP / Senha de Aplicativo (App Password)
                        </label>
                        <div className="relative flex items-center">
                          <input
                            id="settings-smtp-pass"
                            data-testid="settings-smtp-pass-input"
                            type={showSmtpPassword ? 'text' : 'password'}
                            placeholder="Digite sua senha SMTP ou App Password de 16 dígitos"
                            value={settings.reminders?.smtpPass ?? settings.reminders?.smtpConfig?.pass ?? ''}
                            onChange={(e) => {
                              const nextPass = e.target.value;
                              const currentRem = {
                                ...DEFAULT_REMINDER_SETTINGS,
                                ...settings.reminders,
                              };
                              const portNum = Number(currentRem.smtpPort ?? 587) || 587;
                              onUpdateSettings({
                                reminders: {
                                  ...currentRem,
                                  smtpPass: nextPass,
                                  smtpConfig: {
                                    host: (currentRem.smtpHost || '').trim(),
                                    port: portNum,
                                    user: (currentRem.smtpUser || '').trim(),
                                    pass: nextPass,
                                    secure: portNum === 465,
                                  },
                                },
                              });
                            }}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-3 pr-9 py-2 text-xs font-mono text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSmtpPassword((prev) => !prev)}
                            aria-label={
                              showSmtpPassword
                                ? 'Ocultar senha SMTP'
                                : 'Mostrar senha SMTP'
                            }
                            className="absolute right-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            {showSmtpPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: Notificações do Navegador & Teste */}
              <section className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  4. Integração com o Navegador / Sistema Operacional
                </label>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Notificações Nativas do Sistema
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Receba alertas na área de trabalho ou tela de bloqueio mesmo em segundo plano.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await requestBrowserNotificationPermission();
                          if (res === 'granted') {
                            onUpdateSettings({
                              reminders: {
                                ...DEFAULT_REMINDER_SETTINGS,
                                ...settings.reminders,
                                browserNotificationsEnabled: true,
                              },
                            });
                            sendBrowserNotification(
                              'Notificações Ativadas! 🔔',
                              'Você receberá lembretes das suas faturas e contas pendentes.'
                            );
                          }
                        }}
                        className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 text-xs font-bold transition-colors"
                      >
                        Ativar no Navegador
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          sendBrowserNotification(
                            'Lembrete de Teste 🔔',
                            'Seu sistema de lembretes diários do Minhas Economias BR está funcionando perfeitamente!'
                          );
                          setTestNotificationSent(true);
                          setTimeout(() => setTestNotificationSent(false), 3500);
                        }}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                      >
                        {testNotificationSent ? 'Disparado!' : 'Testar Agora'}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
    </>
  );
}
