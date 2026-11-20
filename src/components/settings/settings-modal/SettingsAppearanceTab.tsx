/** Aba Aparência. Parte de SettingsModal (ver SettingsModal.tsx). */
import { Check, Eye, EyeOff, LayoutGrid, Moon, Sun } from 'lucide-react';
import type { SettingsModalContext } from './settingsModalContext';

export function SettingsAppearanceTab({ form }: { form: SettingsModalContext }) {
  const {
    activeTab,
    onUpdateSettings,
    settings,
  } = form;
  return (
    <>
{activeTab === 'appearance' && (
            <div className="space-y-6">
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Tema Visual do Aplicativo
                  </label>
                  <span className="text-xs font-semibold text-emerald-700">
                    {settings.theme === 'dark' ? 'Modo Escuro Ativo' : 'Modo Claro Ativo'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ theme: 'light' })}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                      settings.theme === 'light'
                        ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`mt-0.5 rounded-lg p-2 ${
                        settings.theme === 'light'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Sun className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Modo Claro Editorial
                        </span>
                        {settings.theme === 'light' && (
                          <Check className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                        Superfícies claras de alto contraste ideais para leitura diurna e análise de tabelas.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ theme: 'dark' })}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                      settings.theme === 'dark'
                        ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`mt-0.5 rounded-lg p-2 ${
                        settings.theme === 'dark'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Moon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Modo Escuro Noturno
                        </span>
                        {settings.theme === 'dark' && (
                          <Check className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                        Paleta grafite profunda que reduz o cansaço visual com indicadores verde-esmeralda.
                      </p>
                    </div>
                  </button>
                </div>
              </section>

              <section className="space-y-3 pt-4 border-t border-slate-200">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  2. Privacidade e Densidade das Tabelas
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white border border-slate-200 p-2 text-slate-700 mt-0.5">
                      {settings.privacyMode ? (
                        <EyeOff className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        Modo Privacidade (Ocultar Saldos R$)
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Aplica desfoque nos valores monetários para usar o app em locais públicos com segurança.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.privacyMode}
                    aria-label="Modo discreto (ocultar valores)"
                    onClick={() =>
                      onUpdateSettings({ privacyMode: !settings.privacyMode })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      settings.privacyMode ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                        settings.privacyMode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white border border-slate-200 p-2 text-slate-700 mt-0.5">
                      <LayoutGrid className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        Densidade de Exibição (Tabelas & Extratos)
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Escolha entre espaçamento confortável ou modo compacto de alta densidade.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ density: 'comfortable' })}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                        settings.density === 'comfortable'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Confortável
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ density: 'compact' })}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                        settings.density === 'compact'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Compacta
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}
    </>
  );
}
