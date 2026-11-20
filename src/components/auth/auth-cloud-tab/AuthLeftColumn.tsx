/** Entrar, criar conta e perfil. Parte de AuthAndCloudTab (ver AuthAndCloudTab.tsx). */
import { KeyRound, Lock, LogIn, LogOut, Mail, User as UserIcon, UserCheck, UserPlus } from 'lucide-react';
import type { AuthAndCloudTabContext } from './authCloudTabContext';

export function AuthLeftColumn({ form }: { form: AuthAndCloudTabContext }) {
  const {
    authFeedback,
    authMode,
    emailInput,
    handleEmailSubmit,
    handleLogoutClick,
    handleSaveProfile,
    isNamedAccountLoggedIn,
    isSubmitting,
    nameInput,
    passwordInput,
    pixInput,
    setAuthMode,
    setEmailInput,
    setNameInput,
    setPasswordInput,
    setPixInput,
    settings,
    userDisplayName,
    userEmail,
  } = form;
  return (
    <>
<div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    isNamedAccountLoggedIn
                      ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                      : 'bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300'
                  }`}
                >
                  {isNamedAccountLoggedIn ? (
                    <UserCheck className="h-5 w-5" />
                  ) : (
                    <LogIn className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                    {isNamedAccountLoggedIn
                      ? 'Conta Conectada & Sessão Ativa'
                      : 'Entrar ou Criar Conta na Nuvem'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isNamedAccountLoggedIn
                      ? 'Sessão autenticada. Confira abaixo o estado do Neon e da sincronização.'
                      : 'Entre com e-mail e senha para sincronizar com o Neon'}
                  </p>
                </div>
              </div>
            </div>

            {authFeedback && (
              <div
                role="status"
                className={`rounded-xl p-3 text-xs font-semibold border ${
                  authFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200'
                }`}
              >
                {authFeedback.message}
              </div>
            )}

            {isNamedAccountLoggedIn ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                      Titular Autenticado
                    </span>
                    <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      Sessão Ativa
                    </span>
                  </div>
                  <p className="text-base font-extrabold text-slate-900 dark:text-white">
                    {userDisplayName || settings.userName}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                    {userEmail}
                  </p>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
                  <div>
                    <label htmlFor="cloud-profile-name" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Seu Nome de Exibição
                    </label>
                    <input
                      type="text"
                      id="cloud-profile-name"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-semibold"
                    />
                  </div>
                  <div>
                    <label htmlFor="cloud-profile-pix" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Sua Chave PIX Padrão (para Reembolsos & Viagens)
                    </label>
                    <input
                      type="text"
                      id="cloud-profile-pix"
                      value={pixInput}
                      onChange={(e) => setPixInput(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <button
                      type="submit"
                      className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
                    >
                      Salvar Perfil
                    </button>
                    <button
                      type="button"
                      data-testid="card-logout-btn"
                      onClick={() => void handleLogoutClick()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sair da Conta (Logout)</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 font-bold transition-all ${
                      authMode === 'login'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>Entrar (Login)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 font-bold transition-all ${
                      authMode === 'register'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Criar Conta</span>
                  </button>
                </div>

                <form onSubmit={handleEmailSubmit} className="space-y-3 text-xs">
                  {authMode === 'register' && (
                    <div>
                      <label htmlFor="cloud-register-name" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Seu Nome Completo
                      </label>
                      <div className="relative">
                        <UserIcon className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          id="cloud-register-name"
                          required
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          placeholder="Seu nome completo"
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label htmlFor="cloud-auth-email" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      E-mail
                    </label>
                    <div className="relative">
                      <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        id="cloud-auth-email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="seu.email@exemplo.com.br"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="cloud-auth-password" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Senha
                    </label>
                    <div className="relative">
                      <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        id="cloud-auth-password"
                        required
                        minLength={6}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Digite sua senha (mín. 6 caracteres)"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    data-testid="email-login-submit-btn"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-4 py-2.5 text-xs font-bold text-white transition-colors"
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>
                      {isSubmitting
                        ? 'Autenticando...'
                        : authMode === 'login'
                        ? 'Entrar na Conta e Sincronizar Nuvem'
                        : 'Criar Conta e Ativar Backup Cloud'}
                    </span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
    </>
  );
}
