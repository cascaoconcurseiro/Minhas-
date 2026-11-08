import React, { useId, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  ShieldCheck,
  TrendingUp,
  User as UserIcon,
  Wallet,
} from 'lucide-react';
import { getAuthErrorMessage } from '../lib/authClient';

interface LoginPageProps {
  defaultEmail?: string;
  defaultName?: string;
  onSignInEmail: (email: string, pass: string) => Promise<void>;
  onRegisterEmail: (name: string, email: string, pass: string) => Promise<void>;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  defaultEmail = '',
  defaultName = '',
  onSignInEmail,
  onRegisterEmail,
}) => {
  const inputId = useId();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      if (mode === 'login') {
        await onSignInEmail(email.trim(), password);
      } else {
        const cleanName = name.trim() || email.split('@')[0];
        await onRegisterEmail(cleanName, email.trim(), password);
      }
    } catch (error) {
      setErrorMsg(getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="dedicated-login-page"
      className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row"
    >
      {/* Left Column: Financial Value Proposition & Brand Identity */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 bg-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-lg shadow-sm">
            R$
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-tight block leading-none">
              Minhas Economias BR
            </span>
            <span className="text-xs text-slate-400">
              Gestão Patrimonial, Fluxo de Caixa & Viagens
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-6 my-auto">
          <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight text-white">
            Controle absoluto do seu patrimônio e das suas viagens em um só lugar.
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Acompanhe contas bancárias, faturas de cartão de crédito, câmbio médio ponderado em viagens internacionais e lembretes diários. Após entrar, confira o estado da sincronização com o Neon.
          </p>

          <div className="space-y-3.5 pt-2">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400 shrink-0 mt-0.5">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">
                  Fluxo de Caixa & Faturas de Cartão
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Previsibilidade mensal com baixa rápida de pendências e controle de parcelamentos.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-sky-500/20 p-2 text-sky-400 shrink-0 mt-0.5">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">
                  Viagens com Câmbio Médio Automático
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Conversão automática das despesas pela cotação média ponderada das moedas que você comprou.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-500/20 p-2 text-amber-400 shrink-0 mt-0.5">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">
                  Banco de Dados Neon
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  O login protege o acesso; o workspace é salvo no Neon PostgreSQL após a autenticação.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800 pt-6">
          <span>Minhas Economias BR</span>
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white font-extrabold text-base shadow-xs">
              R$
            </div>
            <div>
              <span className="text-base font-extrabold text-slate-900 dark:text-white block leading-none">
                Minhas Economias BR
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
                  ? 'Entre para acessar seus lançamentos e sincronizar na nuvem'
                  : 'Sua conta começa sem lançamentos. A sincronização é confirmada após o login e a conexão com o Neon.'}
              </p>
              <p className="pt-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                Entre com sua conta ou crie uma nova. Os dados financeiros permanecem no Neon.
              </p>
            </div>

            {/* Segmented Mode Selector */}
            <div className="grid grid-cols-2 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                }}
                className={`rounded-lg py-2 text-xs font-bold transition-all ${
                  mode === 'login'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Entrar na Conta
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setName('');
                  setEmail('');
                  setPassword('');
                  setErrorMsg(null);
                }}
                className={`rounded-lg py-2 text-xs font-bold transition-all ${
                  mode === 'register'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
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
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Como deseja ser chamado"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 pl-9 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-600 focus:bg-white focus:outline-none"
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
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 pl-9 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-600 focus:bg-white focus:outline-none"
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
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 pl-9 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                data-testid="login-submit-btn"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-4 py-3 text-xs font-bold text-white shadow-sm transition-colors cursor-pointer"
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
            Entre para sincronizar seu workspace no Neon PostgreSQL.
          </p>
        </div>
      </div>
    </div>
  );
};
