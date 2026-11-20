/** Aba Perfil, backup e dados. Parte de SettingsModal (ver SettingsModal.tsx). */
import { Download, LogOut, RotateCcw, ShieldCheck, Upload } from 'lucide-react';
import type { SettingsModalContext } from './settingsModalContext';

export function SettingsProfileTab({ form }: { form: SettingsModalContext }) {
  const {
    activeTab,
    confirmReset,
    fileInputRef,
    handleFileUpload,
    importError,
    importSuccess,
    isImporting,
    isUserLoggedIn,
    onClose,
    onExportFullBackupJson,
    onResetWorkspaceData,
    onSignOut,
    onUpdateSettings,
    setConfirmReset,
    settings,
    userEmail,
  } = form;
  return (
    <>
{activeTab === 'profile' && (
            <div className="space-y-6">
              <section className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  1. Perfil do Titular & Chave PIX
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="settings-profile-name" className="block text-xs font-semibold text-slate-700 mb-1">
                        Seu Nome de Exibição
                      </label>
                      <input
                        type="text"
                        id="settings-profile-name"
                        value={settings.userName || ''}
                        onChange={(e) =>
                          onUpdateSettings({ userName: e.target.value })
                        }
                        placeholder="Seu nome completo"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="settings-profile-pix" className="block text-xs font-semibold text-slate-700 mb-1">
                        Sua Chave PIX Padrão (Reembolsos & Viagens)
                      </label>
                      <input
                        type="text"
                        id="settings-profile-pix"
                        value={settings.userPixKey || ''}
                        onChange={(e) =>
                          onUpdateSettings({ userPixKey: e.target.value })
                        }
                        placeholder="E-mail, CPF, telefone ou chave aleatória"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900"
                      />
                    </div>
                  </div>

                  {isUserLoggedIn && onSignOut && (
                    <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-slate-800">
                          Sessão Conectada: {userEmail || 'Conta autenticada'}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          Sessão autenticada. Consulte Conta e Nuvem para ver o estado do Neon.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await onSignOut();
                          onClose();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors shrink-0"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sair da Conta</span>
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-3 pt-4 border-t border-slate-200">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  2. Portabilidade & backup do workspace (JSON)
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white border border-slate-200 p-2 text-emerald-700 mt-0.5">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        Backup local e restauração
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        O arquivo guarda o workspace pessoal no seu dispositivo, vinculado à conta que o exportou. Não inclui convites nem despesas espelhadas recebidas. Ao restaurar em outra conta, os marcadores de compartilhamento são removidos. Antes de restaurar, baixe a versão atual e confira a sincronização com o Neon.
                      </p>
                    </div>
                  </div>

                  {importError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                      {importError}
                    </div>
                  )}

                  {importSuccess && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                        Backup restaurado na sessão. Confira o status da nuvem para confirmar o Neon.
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={onExportFullBackupJson}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Baixar backup do workspace (.JSON)</span>
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isImporting}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>{isImporting ? 'Restaurando backup…' : 'Restaurar de Arquivo .JSON'}</span>
                    </button>

                    {!confirmReset ? (
                      <button
                        type="button"
                        onClick={() => setConfirmReset(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors ml-auto"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Apagar dados do workspace pessoal</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 ml-auto">
                        <span className="text-[11px] font-semibold text-rose-700">
                          Apaga dados pessoais. Convites e lançamentos compartilhados ficam preservados. Confirmar?
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onResetWorkspaceData();
                            setConfirmReset(false);
                          }}
                          className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                        >
                          Sim, apagar dados pessoais
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmReset(false)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}
    </>
  );
}
