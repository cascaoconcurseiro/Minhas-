import React, { useEffect, useId, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  ScanFace,
  ShieldCheck,
  TrendingUp,
  User as UserIcon,
  Wallet,
} from 'lucide-react';
import {
  forgetRememberedEmail,
  getAuthErrorMessage,
  getKeepSignedIn,
  getRememberedEmail,
  rememberEmail,
  setKeepSignedIn,
} from '../lib/authClient';
import {
  describePasskeyFailure,
  getPasskeyErrorMessage,
  isPasskeyEnabledHere,
  isPasskeySupported,
  waitPasskeyLoginReady,
} from '../lib/passkeyClient';
import { BrandMark } from './BrandMark';

interface LoginPageProps {
  defaultEmail?: string;
  defaultName?: string;
  onSignInEmail: (email: string, pass: string) => Promise<void>;
  onRegisterEmail: (name: string, email: string, pass: string) => Promise<void>;
  /** Entrar com Face ID (passkey). Sem esta função o botão não aparece. */
  onSignInPasskey?: () => Promise<void>;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  defaultEmail = '',
  defaultName = '',
  onSignInEmail,
  onRegisterEmail,
  onSignInPasskey,
}) => {
  const inputId = useId();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(() => defaultEmail || getRememberedEmail());
  const [keepSignedIn, setKeepSignedInState] = useState(() => getKeepSignedIn());
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyReady, setPasskeyReady] = useState(false);
  const [passkeyDetail, setPasskeyDetail] = useState<string | null>(null);
  const [passkeyEnabledHere] = useState(() => isPasskeyEnabledHere());

  const handlePasskey = async () => {
    if (!onSignInPasskey) return;
    setErrorMsg(null);
    setPasskeyDetail(null);
    setIsLoading(true);
    try {
      await onSignInPasskey();
    } catch (error) {
      setErrorMsg(
        error instanceof Error && error.name === 'AuthError' ? getAuthErrorMessage(error) : getPasskeyErrorMessage(error)
      );
      setPasskeyDetail(describePasskeyFailure(error));
      // O desafio usado não vale mais: prepara outro e liga o botão de novo quando estiver pronto.
      setPasskeyReady(false);
      void waitPasskeyLoginReady().then((ready) => setPasskeyReady(ready));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!onSignInPasskey) return;
    let cancelled = false;
    void isPasskeySupported().then((supported) => {
      if (cancelled || !supported) return;
      setPasskeyAvailable(true);
      // Busca o desafio e a biblioteca já na abertura: o iPhone só abre o Face ID logo depois do toque.
      void waitPasskeyLoginReady().then((ready) => {
        if (!cancelled) setPasskeyReady(ready);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [onSignInPasskey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Informe um endereço de e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setIsLoading(true);
    try {
      // Define antes de entrar: decide se o login fica guardado neste aparelho ou só até fechar o app.
      setKeepSignedIn(keepSignedIn);
      if (mode === 'login') {
        await onSignInEmail(email.trim(), password);
      } else {
        const cleanName = name.trim() || email.split('@')[0];
        await onRegisterEmail(cleanName, email.trim(), password);
      }
      if (keepSignedIn) rememberEmail(email);
      else forgetRememberedEmail();
    } catch (error) {
      setErrorMsg(getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="dedicated-login-page"
      className="min-h-screen w-full bg-[var(--app-canvas)] dark:bg-slate-950 flex flex-col lg:flex-row"
    >
      {/* Left Column: Financial Value Proposition & Brand Identity */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 bg-gradient-to-br from-blue-50 via-white to-white dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900 text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-800 p-12 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-3">
          <BrandMark />
          <div>
            <span className="text-lg font-extrabold tracking-tight block leading-none">
              Minhas Economias
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Gestão Patrimonial, Fluxo de Caixa & Viagens
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-6 my-auto">
          <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight text-slate-900 dark:text-white">
            Controle absoluto do seu patrimônio e das suas viagens em um só lugar.
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Acompanhe contas bancárias, faturas de cartão de crédito, câmbio médio ponderado em viagens internacionais e lembretes diários.
          </p>

          <div className="space-y-3.5 pt-2">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-500/20 p-2 text-blue-700 dark:text-blue-300 shrink-0 mt-0.5">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Fluxo de Caixa & Faturas de Cartão
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Previsibilidade mensal com baixa rápida de pendências e controle de parcelamentos.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-500/20 p-2 text-blue-700 dark:text-blue-300 shrink-0 mt-0.5">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Viagens com Câmbio Médio Automático
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Conversão automática das despesas pela cotação média ponderada das moedas que você comprou.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-500/20 p-2 text-blue-700 dark:text-blue-300 shrink-0 mt-0.5">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Seus dados sempre à mão
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Entre na sua conta para acessar seus dados, com salvamento automático das alterações.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-6">
          <span>Minhas Economias</span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Acesso protegido por autenticação
          </span>
        </div>
      </div>

      {/* Right Column: Clean Login / Register Card */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Brand Header */}
          <div className="flex lg:hidden items-center justify-center gap-2.5 mb-2">
            <BrandMark size="sm" />
            <div>
              <span className="text-base font-extrabold text-slate-900 dark:text-white block leading-none">
                Minhas Economias
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Controle Financeiro & Viagens
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="space-y-1 text-center sm:text-left">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
                {mode === 'login' ? 'Acesse sua conta' : 'Crie sua conta gratuita'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === 'login'
                  ? 'Entre para acompanhar seus lançamentos e seu patrimônio'
                  : 'Comece cadastrando suas contas e seus primeiros lançamentos.'}
              </p>
          <p className="pt-2 text-[11px] leading-relaxed text-blue-700 dark:text-blue-300">
                Acesse suas finanças com seu e-mail e sua senha.
              </p>
            </div>

            {/* Segmented Mode Selector */}
            <div className="grid grid-cols-2 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                  aria-pressed={mode === 'login'}
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                }}
                className={`rounded-lg py-2 text-xs font-bold transition-all ${
                  mode === 'login'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Entrar na Conta
              </button>
              <button
                type="button"
                  aria-pressed={mode === 'register'}
                onClick={() => {
                  setMode('register');
                  setName('');
                  setEmail('');
                  setPassword('');
                  setErrorMsg(null);
                }}
                className={`rounded-lg py-2 text-xs font-bold transition-all ${
                  mode === 'register'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Criar Nova Conta
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
              >
                {errorMsg}
                {passkeyDetail && (
                  <span data-testid="passkey-error-detail" className="mt-1 block break-words font-mono text-[10px] font-normal opacity-80">
                    Detalhe: {passkeyDetail}
                  </span>
                )}
              </div>
            )}

            {mode === 'login' && passkeyAvailable && (
              <div className="space-y-3">
                <button
                  type="button"
                  data-testid="passkey-login-btn"
                  onClick={() => void handlePasskey()}
                  disabled={isLoading || !passkeyReady}
                  className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors disabled:opacity-60 ${
                    passkeyEnabledHere
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                      : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <ScanFace className="h-5 w-5" />
                  {passkeyReady ? 'Entrar com Face ID' : 'Preparando o Face ID…'}
                </button>
                {!passkeyEnabledHere && (
                  <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                    Ainda não ativou? Entre com e-mail e senha e ative o Face ID dentro do app.
                  </p>
                )}
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  ou use e-mail e senha
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label htmlFor={`${inputId}-name`} className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Seu Nome
                  </label>
                  <div className="relative">
                    <UserIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      id={`${inputId}-name`}
                      name="name"
                      autoComplete="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Como deseja ser chamado"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 pl-9 pr-3.5 py-3 sm:py-2.5 text-base sm:text-xs font-semibold text-slate-900 dark:text-white focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor={`${inputId}-email`} className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id={`${inputId}-email`}
                    data-testid="login-email-input"
                    name="email"
                    autoComplete="username"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 pl-9 pr-3.5 py-3 sm:py-2.5 text-base sm:text-xs font-semibold text-slate-900 dark:text-white focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor={`${inputId}-password`} className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Senha de Acesso
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id={`${inputId}-password`}
                    data-testid="login-password-input"
                    name="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 pl-9 pr-3.5 py-3 sm:py-2.5 text-base sm:text-xs font-semibold text-slate-900 dark:text-white focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <label htmlFor={`${inputId}-keep`} className="flex cursor-pointer items-start gap-3 rounded-xl py-1 text-xs text-slate-700 dark:text-slate-300">
                <input
                  id={`${inputId}-keep`}
                  type="checkbox"
                  data-testid="keep-signed-in"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedInState(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 accent-blue-600"
                />
                <span>
                  <span className="block font-bold">Manter conectado</span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    {keepSignedIn
                      ? 'Neste aparelho você entra direto, sem digitar de novo, por até 30 dias.'
                      : 'Você sai ao fechar o app e terá de entrar de novo.'}
                  </span>
                </span>
              </label>

              <button
                type="submit"
                data-testid="login-submit-btn"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-4 py-3 text-xs font-bold text-white shadow-sm transition-colors cursor-pointer"
              >
                <span>
                  {isLoading
                    ? 'Autenticando...'
                    : mode === 'login'
                    ? 'Entrar no Sistema'
                    : 'Criar Conta e Acessar'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
            Suas alterações são salvas automaticamente após entrar.
          </p>
        </div>
      </div>
    </div>
  );
};
