import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  UserCheck,
  UserPlus,
  Wrench,
} from 'lucide-react';
import {
  AppSettings,
  BankAccount,
  Category,
  CreditCard,
  InvestmentAsset,
  SavingsGoal,
  Transaction,
  Trip,
} from '../types/finance';
import { runFinancialIntegrityAudit } from '../utils/travelRules';
import { summarizeBackendHealth } from '../utils/backendHealth';
import { getFirebaseAuthErrorMessage } from '../utils/firebaseAuthErrors';
import { ProjectAndDatabaseDocsPanel } from './ProjectAndDatabaseDocsPanel';

interface AuthAndCloudTabProps {
  userEmail: string | null;
  userDisplayName: string | null;
  isAnonymousUser: boolean;
  autoVaultId: string;
  cloudSyncStatus: 'local' | 'syncing' | 'synced' | 'error';
  lastSyncedAt: string | null;
  settings: AppSettings;
  accounts: BankAccount[];
  cards: CreditCard[];
  categories?: Category[];
  transactions: Transaction[];
  investments: InvestmentAsset[];
  goals: SavingsGoal[];
  trips: Trip[];
  onSignInEmail: (email: string, pass: string) => Promise<void>;
  onRegisterEmail: (name: string, email: string, pass: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onForceCloudSync: () => Promise<void>;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onRunDiagnosticAndRepair?: () => { repairedCount: number; repairedLog: string[] };
}

export const AuthAndCloudTab: React.FC<AuthAndCloudTabProps> = ({
  userEmail,
  userDisplayName,
  isAnonymousUser,
  autoVaultId,
  cloudSyncStatus,
  lastSyncedAt,
  settings,
  accounts,
  cards,
  categories = [],
  transactions,
  investments,
  goals,
  trips,
  onSignInEmail,
  onRegisterEmail,
  onSignOut,
  onForceCloudSync,
  onUpdateSettings,
  onRunDiagnosticAndRepair,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [nameInput, setNameInput] = useState(userDisplayName || settings.userName || '');
  const [emailInput, setEmailInput] = useState(userEmail || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [pixInput, setPixInput] = useState(settings.userPixKey || '');
  const [authFeedback, setAuthFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real-time backend API health state
  const [apiHealth, setApiHealth] = useState<{
    status: 'checking' | 'ok' | 'error';
    neonStatus: 'checking' | 'ok' | 'error';
    firebaseAuthConfigured: boolean;
    geminiConfigured: boolean;
    checkedAt: string | null;
  }>({
    status: 'checking',
    neonStatus: 'checking',
    firebaseAuthConfigured: false,
    geminiConfigured: false,
    checkedAt: null,
  });
  const [repairFeedback, setRepairFeedback] = useState<string | null>(null);
  const cloudStatusTone = apiHealth.neonStatus === 'checking'
    ? 'checking'
    : apiHealth.neonStatus === 'error' || !apiHealth.firebaseAuthConfigured || apiHealth.status === 'error' || cloudSyncStatus === 'error'
    ? 'error'
    : cloudSyncStatus;

  useEffect(() => {
    setEmailInput(userEmail || '');
  }, [userEmail]);

  useEffect(() => {
    setNameInput(userDisplayName || settings.userName || '');
  }, [userDisplayName, settings.userName]);

  const checkBackendHealth = async (): Promise<boolean> => {
    setApiHealth((prev) => ({ ...prev, status: 'checking', neonStatus: 'checking' }));
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      const summary = summarizeBackendHealth(res.ok, data);
      setApiHealth({
        ...summary,
        checkedAt: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });
      return summary.status === 'ok';
    } catch {
      setApiHealth({
        status: 'error',
        neonStatus: 'error',
        firebaseAuthConfigured: false,
        geminiConfigured: false,
        checkedAt: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });
      return false;
    }
  };

  useEffect(() => {
    void checkBackendHealth();
  }, []);

  const isNamedAccountLoggedIn = Boolean(userEmail && !isAnonymousUser);

  const auditReport = useMemo(
    () =>
      runFinancialIntegrityAudit({
        accountsCount: accounts.length,
        cardsCount: cards.length,
        accounts,
        cards,
        categories,
        transactions,
        investments,
        goals,
        trips,
      }),
    [accounts, cards, categories, transactions, investments, goals, trips]
  );

  const handleRunFullScanAndRepair = async () => {
    setRepairFeedback(null);
    const backendHealthy = await checkBackendHealth();
    let repairedCount = 0;
    let repairedLog: string[] = [];
    if (onRunDiagnosticAndRepair) {
      const result = onRunDiagnosticAndRepair();
      repairedCount = result.repairedCount;
      repairedLog = result.repairedLog;
    }
    await onForceCloudSync();
    const localResult = repairedCount > 0
      ? `${repairedCount} inconsistência(s) local(is) corrigida(s): ${repairedLog.join(' ')}`
      : 'Nenhuma inconsistência local encontrada.';
    setRepairFeedback(
      backendHealthy
        ? `Auditoria local concluída. ${localResult} A API e o Neon responderam; confira abaixo o estado da última sincronização do workspace.`
        : `Auditoria local concluída. ${localResult} O Neon não confirmou disponibilidade; os dados locais foram preservados e a sincronização pode estar pendente.`
    );
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthFeedback(null);
    if (!emailInput.trim() || passwordInput.length < 6) {
      setAuthFeedback({
        type: 'error',
        message: 'Informe um e-mail válido e uma senha com pelo menos 6 caracteres.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMode === 'login') {
        await onSignInEmail(emailInput.trim(), passwordInput);
        setAuthFeedback({
          type: 'success',
          message: `Sessão iniciada como ${emailInput.trim()}. O workspace será carregado do Neon.`,
        });
      } else {
        const cleanName = nameInput.trim() || emailInput.split('@')[0];
        await onRegisterEmail(cleanName, emailInput.trim(), passwordInput);
        onUpdateSettings({ userName: cleanName });
        setAuthFeedback({
          type: 'success',
          message: `Conta criada para ${emailInput.trim()} com Firebase Auth. O workspace será conectado ao Neon.`,
        });
      }
      setPasswordInput('');
    } catch (error) {
      setAuthFeedback({
        type: 'error',
        message: getFirebaseAuthErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoutClick = async () => {
    await onSignOut();
    setAuthFeedback({
      type: 'success',
      message:
        'Você saiu da conta com sucesso! Para entrar novamente ou trocar de usuário, utilize o formulário abaixo.',
    });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      userName: nameInput.trim() || settings.userName,
      userPixKey: pixInput.trim() || settings.userPixKey,
    });
    setAuthFeedback({
      type: 'success',
      message: 'Perfil salvo nesta sessão. Confira o indicador do Neon para confirmar a sincronização.',
    });
  };

  return (
    <div className="space-y-5">
      {/* Top Banner: Automatic Cloud Status + Prominent Login/Logout State */}
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white p-5 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${cloudStatusTone === 'error' ? 'bg-rose-500/20 border-rose-400/30 text-rose-200' : cloudStatusTone === 'synced' ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300' : 'bg-amber-500/20 border-amber-400/30 text-amber-200'}`}>
                <span className={`h-2 w-2 rounded-full ${cloudStatusTone === 'syncing' || cloudStatusTone === 'checking' ? 'animate-pulse' : ''} ${cloudStatusTone === 'error' ? 'bg-rose-400' : cloudStatusTone === 'synced' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {cloudStatusTone === 'checking'
                  ? 'Verificando Neon...'
                  : cloudStatusTone === 'synced'
                  ? 'Dados sincronizados com Neon'
                  : cloudStatusTone === 'syncing'
                  ? 'Sincronizando em Tempo Real...'
                  : cloudStatusTone === 'error'
                  ? 'Firebase Auth, API ou Neon indisponível'
                  : 'Cofre local — aguardando sincronização'}
              </span>
              <span
                data-testid="auth-status-badge"
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                  isNamedAccountLoggedIn
                    ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
                    : 'bg-amber-500/25 text-amber-200 border border-amber-400/40'
                }`}
              >
                {isNamedAccountLoggedIn
                  ? `Logado: ${userEmail}`
                  : 'Sessão Desconectada (Visitante)'}
              </span>
              <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-mono text-slate-300">
                Cofre ID: {autoVaultId.slice(0, 14)}
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-extrabold font-display tracking-tight">
              Central de Conta, Nuvem & Auditoria Local
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Firebase Auth protege o acesso. Contas, lançamentos e demais dados financeiros são persistidos no PostgreSQL do Neon.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              data-testid="run-full-system-scan-btn"
              onClick={() => void handleRunFullScanAndRepair()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors"
            >
              <Wrench className="h-4 w-4" />
              <span>Verificar & Corrigir Sistema Agora</span>
            </button>

            <button
              type="button"
              onClick={() => void onForceCloudSync()}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3.5 py-2.5 text-xs font-bold text-white transition-colors"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  cloudSyncStatus === 'syncing' ? 'animate-spin text-emerald-400' : ''
                }`}
              />
              <span>Sincronizar Nuvem</span>
            </button>

            {isNamedAccountLoggedIn && (
              <button
                type="button"
                data-testid="banner-logout-btn"
                onClick={() => void handleLogoutClick()}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair da Conta (Logout)</span>
              </button>
            )}
          </div>
        </div>

        {lastSyncedAt && (
          <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
            <span>
              Última sincronização automática confirmada:{' '}
              <strong className="font-mono text-emerald-300">{lastSyncedAt}</strong>
            </span>
            <span>
              Autenticação: <strong>Firebase Auth</strong> · Banco de dados: <strong>Neon PostgreSQL</strong>
            </span>
          </div>
        )}
      </div>

      {repairFeedback && (
        <div
          role="status"
          data-testid="system-scan-feedback"
          className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            {repairFeedback}
          </span>
          <button
            type="button"
            onClick={() => setRepairFeedback(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:underline text-[11px]"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Main Grid: Left = Login / Account / Logout | Right = Local Data Audit & Service Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (5 cols): Login, Registration, Profile & Session Management */}
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

        {/* Right Column (7 cols): Local Financial Integrity & Service Health */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                    Auditoria Local e Estado dos Serviços
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Integridade dos dados carregados nesta sessão; conexão e sincronização são verificadas separadamente.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <span
                  data-testid="ssot-audit-status-badge"
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold ${
                    auditReport.isAllHealthy
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {auditReport.isAllHealthy ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  )}
                  {auditReport.passedChecks}/{auditReport.totalChecks} Verificações OK
                </span>
              </div>
            </div>

            {/* Live Infrastructure Status Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-sky-600 shrink-0" />
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-slate-400">
                      Servidor & API
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {apiHealth.status === 'ok'
                        ? 'Online (Pronto)'
                        : apiHealth.status === 'checking'
                        ? 'Verificando...'
                        : 'API indisponível'}
                    </span>
                  </div>
                </div>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    apiHealth.status === 'ok'
                      ? 'bg-emerald-500'
                      : apiHealth.status === 'checking'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-rose-500'
                  }`}
                />
              </div>

              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-slate-400">
                      Google Finance & Câmbio
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {apiHealth.status === 'checking'
                        ? 'Verificando...'
                        : apiHealth.geminiConfigured
                        ? 'Gemini configurado'
                        : 'Cotações Gemini indisponíveis'}
                    </span>
                  </div>
                </div>
                {apiHealth.status === 'checking' ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-amber-600 shrink-0" />
                ) : apiHealth.geminiConfigured ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                )}
              </div>

              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-violet-600 shrink-0" />
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-slate-400">
                      Neon PostgreSQL
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {apiHealth.neonStatus === 'checking'
                        ? 'Verificando Neon...'
                        : apiHealth.neonStatus === 'error'
                        ? 'Neon indisponível'
                        : cloudSyncStatus === 'synced'
                        ? 'Sincronizado'
                        : cloudSyncStatus === 'syncing'
                        ? 'Sincronizando...'
                        : cloudSyncStatus === 'error'
                        ? 'Falha na sincronização'
                        : 'Aguardando sincronização'}
                    </span>
                  </div>
                </div>
                {apiHealth.neonStatus === 'checking' ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-amber-600 shrink-0" />
                ) : apiHealth.neonStatus === 'ok' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                )}
              </div>
            </div>

            {/* SSOT Data Volume Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2.5 border border-slate-200/60 dark:border-slate-800">
                <span className="block text-[10px] font-bold uppercase text-slate-400">
                  Contas
                </span>
                <span className="text-sm font-extrabold font-mono text-slate-900 dark:text-white">
                  {accounts.length}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2.5 border border-slate-200/60 dark:border-slate-800">
                <span className="block text-[10px] font-bold uppercase text-slate-400">
                  Cartões
                </span>
                <span className="text-sm font-extrabold font-mono text-slate-900 dark:text-white">
                  {cards.length}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2.5 border border-slate-200/60 dark:border-slate-800">
                <span className="block text-[10px] font-bold uppercase text-slate-400">
                  Lançamentos
                </span>
                <span className="text-sm font-extrabold font-mono text-slate-900 dark:text-white">
                  {transactions.length}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2.5 border border-slate-200/60 dark:border-slate-800">
                <span className="block text-[10px] font-bold uppercase text-slate-400">
                  Ativos & Metas
                </span>
                <span className="text-sm font-extrabold font-mono text-slate-900 dark:text-white">
                  {investments.length + goals.length}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2.5 border border-slate-200/60 dark:border-slate-800">
                <span className="block text-[10px] font-bold uppercase text-slate-400">
                  Viagens
                </span>
                <span className="text-sm font-extrabold font-mono text-slate-900 dark:text-white">
                  {trips.length}
                </span>
              </div>
            </div>

            {/* 7 Core Financial & Production Rules Checklist */}
            <div className="space-y-2.5">
              {auditReport.checks.map((chk) => (
                <div
                  key={chk.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border p-3.5 ${
                    chk.passed
                      ? 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                      : 'border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {chk.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {chk.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                        {chk.description}
                      </p>
                      {!chk.passed && chk.issueDetails && chk.issueDetails.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                          {chk.issueDetails.slice(0, 3).map((detail, i) => (
                            <li key={i}>• {detail}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <span
                    className={`rounded-lg border px-2.5 py-1 text-[10px] font-mono font-bold shrink-0 self-start sm:self-center ${
                      chk.passed
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/60 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-900/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                    }`}
                  >
                    {chk.metricLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Complete Project, Database & GitHub Sync Documentation Panel */}
      <ProjectAndDatabaseDocsPanel
        autoVaultId={autoVaultId}
        userEmail={userEmail}
      />
    </div>
  );
};

