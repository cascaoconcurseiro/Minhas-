import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CreditCard,
  Eye,
  FastForward,
  Layers,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  Sparkles,
  Workflow,
  Wrench,
  X,
} from 'lucide-react';
import {
  BankAccount,
  Category,
  CreditCard as CreditCardType,
  InvestmentAsset,
  SavingsGoal,
  Transaction,
  Trip,
} from '../types/finance';
import { runFinancialIntegrityAudit } from '../utils/travelRules';
import { summarizeBackendHealth } from '../utils/backendHealth';

interface ExpertSystemReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewClarityMode: 'complete' | 'essential';
  onChangeClarityMode: (mode: 'complete' | 'essential') => void;
  onNavigateTab: (
    tab:
      | 'overview'
      | 'accounts'
      | 'investments'
      | 'transactions'
      | 'cards'
      | 'shared'
      | 'trips'
      | 'budgets'
      | 'goals'
      | 'reports'
      | 'cloud'
  ) => void;
  accounts?: BankAccount[];
  cards?: CreditCardType[];
  categories?: Category[];
  transactions?: Transaction[];
  investments?: InvestmentAsset[];
  goals?: SavingsGoal[];
  trips?: Trip[];
  cloudSyncStatus?: 'local' | 'syncing' | 'synced' | 'error';
  lastSyncedAt?: string | null;
  onRunDiagnosticAndRepair?: () => { repairedCount: number; repairedLog: string[] };
}

export const ExpertSystemReviewModal: React.FC<ExpertSystemReviewModalProps> = ({
  isOpen,
  onClose,
  viewClarityMode,
  onChangeClarityMode,
  onNavigateTab,
  accounts = [],
  cards = [],
  categories = [],
  transactions = [],
  investments = [],
  goals = [],
  trips = [],
  cloudSyncStatus = 'local',
  lastSyncedAt = null,
  onRunDiagnosticAndRepair,
}) => {
  const [activeSection, setActiveSection] = useState<
    'live_verifier' | 'flow_guide' | 'modules_audit'
  >('live_verifier');

  const [apiHealth, setApiHealth] = useState<{
    status: 'checking' | 'ok' | 'error';
    neonStatus: 'checking' | 'configured' | 'error';
    geminiConfigured: boolean;
    checkedAt: string | null;
  }>({
    status: 'checking',
    neonStatus: 'checking',
    geminiConfigured: false,
    checkedAt: null,
  });
  const [scanResultMessage, setScanResultMessage] = useState<string | null>(null);
  const [scanResultTone, setScanResultTone] = useState<'success' | 'warning'>('success');

  const checkBackendHealth = async (): Promise<boolean> => {
    setApiHealth((prev) => ({ ...prev, status: 'checking', neonStatus: 'checking' }));
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
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
    if (!isOpen) return;
    void checkBackendHealth();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  if (!isOpen) return null;

  const handleRunVerifierNow = async () => {
    setScanResultMessage(null);
    const backendHealthy = await checkBackendHealth();
    if (!onRunDiagnosticAndRepair) {
      setScanResultTone('warning');
      setScanResultMessage('A auditoria local não foi executada porque o diagnóstico não está disponível nesta tela.');
      return;
    }
    const result = onRunDiagnosticAndRepair();
    const localResult = result.repairedCount > 0
      ? `${result.repairedCount} inconsistência(s) local(is) corrigida(s): ${result.repairedLog.join(' ')}`
      : 'Nenhuma inconsistência encontrada nos dados locais.';

    if (!backendHealthy || cloudSyncStatus === 'error') {
      setScanResultTone('warning');
      setScanResultMessage(
        `Auditoria local concluída. ${localResult} A API/Neon não confirmou disponibilidade; os dados locais foram preservados e a sincronização não está confirmada.`
      );
    } else if (result.repairedCount > 0 || cloudSyncStatus !== 'synced') {
      setScanResultTone('warning');
      setScanResultMessage(
        `Auditoria local concluída. ${localResult} Aguarde o indicador de sincronização confirmar a gravação no Neon.`
      );
    } else {
      setScanResultTone('success');
      setScanResultMessage(
        `Auditoria local concluída às ${new Date().toLocaleTimeString('pt-BR')}: nenhum problema encontrado. API, conexão Neon e último status de sincronização confirmados.`
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-6 overflow-y-auto modal-shell"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expert-review-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="expert-review-modal"
        className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden my-auto max-h-[90dvh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-900 px-5 sm:px-6 py-4 text-white shrink-0">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Auditoria Local & Estado dos Serviços
            </div>
            <h2
              id="expert-review-modal-title"
              className="text-base sm:text-lg font-bold tracking-tight"
            >
              Auditoria Contábil Automática, Auto-Reparo & Guia de Clareza do Sistema
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar diagnóstico"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 sm:px-6 py-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-testid="verifier-tab-live-btn"
              onClick={() => setActiveSection('live_verifier')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                activeSection === 'live_verifier'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              1. Auditoria de Dados Locais ({auditReport.passedChecks}/{auditReport.totalChecks} OK)
            </button>
            <button
              type="button"
              data-testid="verifier-tab-guide-btn"
              onClick={() => setActiveSection('flow_guide')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                activeSection === 'flow_guide'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Workflow className="h-3.5 w-3.5" />
              2. Como Entender os Números & Cascata
            </button>
            <button
              type="button"
              data-testid="verifier-tab-modules-btn"
              onClick={() => setActiveSection('modules_audit')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                activeSection === 'modules_audit'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              3. Módulos do Aplicativo
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">Modo de Leitura:</span>
            <button
              type="button"
              onClick={() =>
                onChangeClarityMode(
                  viewClarityMode === 'essential' ? 'complete' : 'essential'
                )
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
                viewClarityMode === 'essential'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-slate-300 bg-white text-slate-800'
              }`}
            >
              <Eye className="h-3.5 w-3.5 text-emerald-600" />
              {viewClarityMode === 'essential'
                ? 'Modo Foco (Essencial) Ativo'
                : 'Visão Completa Ativa'}
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-800 flex-1">
          {activeSection === 'live_verifier' && (
            <div className="space-y-4">
              {/* Top Action & Status Bar */}
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 ${auditReport.isAllHealthy ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70'}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold text-white ${auditReport.isAllHealthy ? 'bg-emerald-600' : 'bg-amber-700'}`}>
                      {auditReport.isAllHealthy ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {auditReport.isAllHealthy
                        ? 'Dados locais sem pendências'
                        : `${auditReport.totalIssuesFound} Pendência(s) Detectada(s)`}
                    </span>
                    {apiHealth.checkedAt && (
                      <span className="text-[11px] font-mono text-slate-700">
                        Checagem API/Neon às {apiHealth.checkedAt}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-800 mt-1">
                    A auditoria examina os dados carregados nesta sessão. A conexão do banco e a sincronização aparecem em estados separados.
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="modal-run-verifier-btn"
                  onClick={() => void handleRunVerifierNow()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-colors shrink-0"
                >
                  <Wrench className="h-4 w-4" />
                  <span>Verificar & Auto-Reparar Agora</span>
                </button>
              </div>

              {scanResultMessage && (
                <div
                  role={scanResultTone === 'warning' ? 'alert' : 'status'}
                  data-testid="modal-verifier-result"
                  className={`rounded-xl border px-4 py-2.5 text-xs font-bold flex items-center gap-2 ${scanResultTone === 'warning' ? 'border-amber-300 bg-amber-100/70 text-amber-950' : 'border-emerald-300 bg-emerald-100/70 text-emerald-950'}`}
                >
                  <Sparkles className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>{scanResultMessage}</span>
                </div>
              )}

              {/* Live Services Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 p-3.5 flex items-center justify-between bg-slate-50/70">
                  <div className="flex items-center gap-2.5">
                    <Server className="h-4 w-4 text-sky-600 shrink-0" />
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-400">
                        Servidor Express & APIs
                      </span>
                      <span className="font-bold text-slate-900">
                        {apiHealth.status === 'ok'
                          ? 'API ativa; Neon configurado'
                          : apiHealth.status === 'checking'
                          ? 'Verificando...'
                          : 'API ou configuração indisponível'}
                      </span>
                    </div>
                  </div>
                  {apiHealth.status === 'ok' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 p-3.5 flex items-center justify-between bg-slate-50/70">
                  <div className="flex items-center gap-2.5">
                    <RefreshCw className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-400">
                        Google Finance & Câmbio
                      </span>
                      <span className="font-bold text-slate-900">
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

                <div className="rounded-xl border border-slate-200 p-3.5 flex items-center justify-between bg-slate-50/70">
                  <div className="flex items-center gap-2.5">
                    <Cloud className="h-4 w-4 text-violet-600 shrink-0" />
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-400">
                        Neon PostgreSQL
                      </span>
                      <span className="font-bold text-slate-900">
                        {apiHealth.neonStatus === 'checking'
                          ? 'Verificando Neon...'
                          : apiHealth.neonStatus === 'error'
                          ? 'Neon indisponível'
                          : cloudSyncStatus === 'synced'
                          ? 'Sincronizado em Nuvem'
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

              {/* 7 Deep Production Integrity Checks */}
              <div className="space-y-2.5">
                {auditReport.checks.map((chk) => (
                  <div
                    key={chk.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border p-3.5 ${
                      chk.passed
                        ? 'border-slate-200 bg-white'
                        : 'border-amber-300 bg-amber-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {chk.passed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{chk.title}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {chk.description}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-lg border px-2.5 py-1 text-[10px] font-mono font-bold shrink-0 self-start sm:self-center ${
                        chk.passed
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-amber-100 border-amber-300 text-amber-900'
                      }`}
                    >
                      {chk.metricLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'flow_guide' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <h3 className="text-sm font-bold text-emerald-950">
                  Como ler o painel em 10 segundos (Regime de Caixa vs. Competência):
                </h3>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-white p-3 border border-emerald-200">
                    <span className="font-bold text-slate-900 block">
                      1. Saldo em Contas (Hoje / Realizado)
                    </span>
                    <span className="text-slate-600 mt-0.5 block">
                      É o dinheiro disponível no banco agora. Só muda quando um lançamento bancário está marcado como <strong>Efetivado (Pago/Recebido)</strong>. Compras no cartão abertas não descontam daqui até você pagar a fatura.
                    </span>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-emerald-200">
                    <span className="font-bold text-slate-900 block">
                      2. Previsto Fim do Mês (Sua Bússola)
                    </span>
                    <span className="text-slate-600 mt-0.5 block">
                      Pega o seu <strong>Saldo em Contas</strong> + <strong>Receitas Pendentes</strong> − <strong>Contas a Pagar Pendentes</strong> − <strong>Faturas Abertas de Cartão</strong> no mês.
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-violet-950 font-bold text-xs">
                    <CreditCard className="h-4 w-4 text-violet-700 shrink-0" />
                    <span>Pagamento de Fatura & Cascata Reversa</span>
                  </div>
                  <p className="text-xs text-violet-900 leading-relaxed">
                    Ao pagar uma fatura (total ou parcial), o sistema debita sua conta corrente e baixa as compras do cartão. Se você apagar ou estornar esse pagamento, o sistema refaz todo o efeito cascata automaticamente.
                  </p>
                </div>

                <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sky-950 font-bold text-xs">
                    <FastForward className="h-4 w-4 text-sky-700 shrink-0" />
                    <span>Central de Adiantar Parcelas</span>
                  </div>
                  <p className="text-xs text-sky-900 leading-relaxed">
                    Na aba Cartões de Crédito → Adiantar Parcelas, você escolhe quantas parcelas futuras quer puxar para o mês atual e aplica desconto em R$ ou %.
                  </p>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                    <RotateCcw className="h-4 w-4 text-amber-700 shrink-0" />
                    <span>Botão Desfazer Universal (Ctrl+Z)</span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Todas as ações do sistema possuem histórico de reversão. Basta clicar em Desfazer no topo da tela ou pressionar Ctrl+Z.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'modules_audit' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  {
                    title: 'Visão Geral & Fluxo Mensal',
                    tab: 'overview' as const,
                    status: 'Requer validação',
                    desc: 'Saldos reais vs projetados, contas a pagar/receber com reversão rápida, termômetro de orçamento e Modo Foco.',
                  },
                  {
                    title: 'Contas Nacionais & Globais (Wise/Nomad)',
                    tab: 'accounts' as const,
                    status: 'Multi-Moeda Independente',
                    desc: 'Contas em BRL ou moeda estrangeira (USD, EUR, GBP) funcionando de forma independente, sem vínculo obrigatório com viagens.',
                  },
                  {
                    title: 'Cartões de Crédito & Faturas',
                    tab: 'cards' as const,
                    status: 'Cascata Reversa + Antecipação',
                    desc: 'Pagamento total/parcial de fatura, estorno automático em cascata e Central de Antecipação seletiva com desconto.',
                  },
                  {
                    title: 'Investimentos + Google Finance Sync',
                    tab: 'investments' as const,
                    status: 'Cotações externas',
                    desc: 'Sincronização automática de Ações, FIIs e ETFs com o Google Finance, cálculo de dividendos e rebalanceamento.',
                  },
                  {
                    title: 'Viagens & Câmbio (TravelSpend)',
                    tab: 'trips' as const,
                    status: 'Conversor Interno + VET + Grupo',
                    desc: 'Conversor rápido exclusivo dentro de cada viagem, lotes de câmbio ponderado (VET) e acerto de quem deve a quem.',
                  },
                  {
                    title: 'Conta, Nuvem & Auditoria SSOT',
                    tab: 'cloud' as const,
                    status: 'Neon PostgreSQL',
                    desc: 'O login próprio controla o acesso; o workspace e os dados familiares persistem no Neon PostgreSQL.',
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-xl border border-slate-200 p-3.5 flex flex-col justify-between gap-2 bg-slate-50/50"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{item.title}</span>
                        <span className="inline-flex items-center rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                          {item.status}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateTab(item.tab);
                        onClose();
                      }}
                      className="self-start text-[11px] font-bold text-emerald-700 hover:underline"
                    >
                      Ir para {item.title} →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 sm:px-6 py-3.5 shrink-0">
          <span className="text-xs text-slate-500">
            Auditoria local: <strong>{auditReport.passedChecks}/{auditReport.totalChecks} verificações aprovadas</strong> • Neon verificado separadamente
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
          >
            Fechar Verificador
          </button>
        </div>
      </div>
    </div>
  );
};
