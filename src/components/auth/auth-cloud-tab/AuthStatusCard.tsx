/** Situação da conta e da nuvem. Parte de AuthAndCloudTab (ver AuthAndCloudTab.tsx). */
import { LogOut, RefreshCw, Wrench } from 'lucide-react';
import type { AuthAndCloudTabContext } from './authCloudTabContext';

export function AuthStatusCard({ form }: { form: AuthAndCloudTabContext }) {
  const {
    autoVaultId,
    cloudStatusTone,
    cloudSyncStatus,
    handleLogoutClick,
    handleRunFullScanAndRepair,
    isNamedAccountLoggedIn,
    lastSyncedAt,
    onForceCloudSync,
    userEmail,
  } = form;
  return (
    <>
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
                  ? 'Login, API ou Neon indisponível'
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
              O login protege o acesso. Contas, lançamentos e demais dados financeiros são persistidos no PostgreSQL do Neon.
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
              Autenticação: <strong>Login próprio (Neon)</strong> · Banco de dados: <strong>Neon PostgreSQL</strong>
            </span>
          </div>
        )}
      </div>
    </>
  );
}
