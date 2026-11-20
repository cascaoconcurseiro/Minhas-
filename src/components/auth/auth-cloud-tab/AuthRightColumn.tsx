/** Saúde do servidor, verificação e segurança. Parte de AuthAndCloudTab (ver AuthAndCloudTab.tsx). */
import { AlertTriangle, CheckCircle2, Cloud, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import type { AuthAndCloudTabContext } from './authCloudTabContext';

export function AuthRightColumn({ form }: { form: AuthAndCloudTabContext }) {
  const {
    accounts,
    apiHealth,
    auditReport,
    cards,
    cloudSyncStatus,
    goals,
    investments,
    transactions,
    trips,
  } = form;
  return (
    <>
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
                        ? 'Neon não configurado'
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
                ) : apiHealth.neonStatus === 'configured' ? (
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
    </>
  );
}
