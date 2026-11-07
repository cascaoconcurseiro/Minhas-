import React, { useState } from 'react';
import {
  BookOpen,
  Check,
  Code2,
  Copy,
  Database,
  Download,
  FileCode2,
  GitBranch,
  Layers,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

interface ProjectAndDatabaseDocsPanelProps {
  autoVaultId: string;
  userEmail: string | null;
}

export const ProjectAndDatabaseDocsPanel: React.FC<ProjectAndDatabaseDocsPanelProps> = ({
  autoVaultId,
  userEmail,
}) => {
  const [activeDocTab, setActiveDocTab] = useState<'overview' | 'database' | 'api' | 'github'>(
    'database'
  );
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [repoUrlInput, setRepoUrlInput] = useState(
    'https://github.com/cascaoconcurseiro/Minhas-economias.git'
  );

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(id);
    setTimeout(() => setCopiedCommand(null), 2200);
  };

  const fullMarkdownDoc = `# Documentação Técnica e Banco de Dados — Minhas Economias BR

## 1. Arquitetura do Projeto
- **Frontend**: React 19 + TypeScript 7 + Vite 8 + Tailwind CSS v4 + Recharts
- **Backend**: Node.js + Express 4 (backend/app.ts; servidor local ou Function Vercel)
- **Autenticação**: Firebase Auth (e-mail e senha)
- **Banco de Dados**: PostgreSQL no Neon, acessado pelo backend Express na Vercel
- **Dados e identidade**: Firebase Auth fornece UID e token; o Neon PostgreSQL é a única persistência operacional do app.
- **Projeto Neon**: minhas-economias-br / production / neondb
- **Cofre Ativo do Usuário**: ${autoVaultId} (${userEmail || 'Sessão Local'})
- **Testes**: node:test em src/utils/*.test.ts

## 2. Esquema do Workspace e Compartilhamento Familiar no Neon
Tabelas PostgreSQL:
1. \`finance_workspaces\`: um snapshot JSONB por cofre, protegido pelo UID Firebase validado no backend.
2. \`finance_workspace_migrations\`: recibo da importação legada, com hash e contagens de entidades.
3. \`finance_family_invitations\`: convites e estado de aceite, consultáveis apenas pelo proprietário ou pelo e-mail convidado.
4. \`finance_shared_transactions\`: registros das despesas explicitamente compartilhadas; somente participantes autorizados podem consultá-los.

O workspace e o compartilhamento familiar são persistidos no Neon. O backend valida o token Firebase e aplica o UID autenticado em RLS.

### Campos do snapshot JSONB do workspace no Neon:
- \`uid\` (string, obrigatório, imutável, igual ao ID do documento)
- \`email\` (string, opcional)
- \`displayName\` (string, opcional)
- \`updatedAt\` (string ISO-8601, obrigatório)
- \`accountsJson\` (string JSON de BankAccount[], obrigatório)
- \`cardsJson\` (string JSON de CreditCard[], obrigatório)
- \`categoriesJson\` (string JSON de Category[], obrigatório)
- \`transactionsJson\` (string JSON de Transaction[], obrigatório)
- \`goalsJson\` (string JSON de SavingsGoal[], obrigatório)
- \`investmentsJson\` (string JSON de InvestmentAsset[], obrigatório)
- \`familyMembersJson\` (string JSON de FamilyMember[], opcional)
- \`investmentTargetsJson\` (string JSON de InvestmentTargetMap, opcional)
- \`tripsJson\` (string JSON de Trip[], opcional)
- \`settingsJson\` (string JSON de AppSettings, opcional)

## 3. Entidades Principais (src/types/finance.ts)
- **BankAccount**: Contas correntes, poupança, espécie, investimentos e contas internacionais multi-moeda (Wise, Nomad, Avenue, C6 Global).
- **CreditCard**: Limite, dia de fechamento (closingDay), dia de vencimento (dueDay) e conta padrão de débito.
- **Category & Subcategory**: Categorias de receita/despesa classificadas nos blocos 50/30/20 (essential, lifestyle, financial).
- **Transaction**: Lançamentos únicos, parcelados (até 48x) ou fixos, com suporte a conciliação OFX (fitid), antecipação de parcelas, rateio familiar bilateral e câmbio de viagens (VET + IOF).
- **InvestmentAsset**: Renda Fixa Pós, IPCA+, FIIs, Ações B3 e ETFs com sincronização Google Finance.
- **Trip, TripExchangeLot & TripSettlement**: Gestão de viagens internacionais com carteira de câmbio (VET médio ponderado) e divisão Splitwise.

## 4. Endpoints da API Backend (backend/app.ts)
- \`GET /api/status\`: Status público e leve da API/configuração, sem consultar o Neon.
- \`GET /api/readiness\`: Readiness diário do Neon, protegido por \`Authorization: Bearer CRON_SECRET\`.
- \`POST /api/fx/live-rate\`: Cotação comercial ao vivo via Gemini Google Search Grounding.
- \`POST /api/investments/sync-quotes\`: Cotações e variação diária do Google Finance / B3.
- \`POST /api/reminders/send-email\`: Disparo autenticado de resumos via SMTP; retorna erro se a entrega falhar.

## 5. Sincronização com GitHub
\`\`\`bash
bash scripts/sync-github.sh ${repoUrlInput}
\`\`\`
`;

  const handleDownloadDocumentation = () => {
    const blob = new Blob([fullMarkdownDoc], {
      type: 'text/markdown;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DOCUMENTACAO-COMPLETA-MINHAS-ECONOMIAS-BR.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const gitSyncCommands = `git branch -M main
git remote add origin ${repoUrlInput} || git remote set-url origin ${repoUrlInput}
git add -A
git commit -m "feat: versão completa Minhas Economias BR com documentação e banco de dados" || true
git push -u origin main`;

  return (
    <div
      data-testid="project-and-db-docs-panel"
      className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden"
    >
      {/* Header */}
      <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-indigo-600 p-2 text-white">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Documentação Oficial do Projeto, Banco de Dados & Sincronização GitHub
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Arquitetura Full-Stack, schema Neon, Firebase Auth e comandos Git
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownloadDocumentation}
          data-testid="download-full-docs-btn"
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 text-xs font-bold text-white transition-colors shrink-0 self-start sm:self-auto"
        >
          <Download className="h-3.5 w-3.5" />
          Baixar Documentação (.MD)
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 px-5 py-2.5 bg-white dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setActiveDocTab('database')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
            activeDocTab === 'database'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Database className="h-3.5 w-3.5" />
          Banco de Dados (Neon)
        </button>

        <button
          type="button"
          onClick={() => setActiveDocTab('overview')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
            activeDocTab === 'overview'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Arquitetura & Módulos
        </button>

        <button
          type="button"
          onClick={() => setActiveDocTab('api')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
            activeDocTab === 'api'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Code2 className="h-3.5 w-3.5" />
          API REST & Motores Puros
        </button>

        <button
          type="button"
          onClick={() => setActiveDocTab('github')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
            activeDocTab === 'github'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <GitBranch className="h-3.5 w-3.5" />
          Sincronização GitHub
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-5 space-y-4 text-xs">
        {activeDocTab === 'database' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Banco PostgreSQL no Neon
                </span>
                <p className="mt-1 font-mono font-bold text-slate-900 dark:text-white break-all">
                  minhas-economias-br / production / neondb
                </p>
                <span className="mt-1 inline-block text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  PostgreSQL • API protegida na Vercel
                </span>
              </div>

              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Login e banco de dados
                </span>
                <p className="mt-1 font-mono font-bold text-slate-900 dark:text-white">
                  Firebase Auth
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Firebase Auth armazena a identidade; Neon PostgreSQL armazena os dados do app.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Arquivos de Especificação no Repo
                </span>
                <p className="mt-1 font-mono font-semibold text-slate-800 dark:text-slate-200">
                  • docs/DATABASE_DOCUMENTATION.md
                </p>
                <p className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  • db/migrations/006_neon_auth_identity.sql (normaliza nomes; a identidade atual usa UID Firebase)
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <th className="py-2.5 px-3">Campo (snapshot JSONB)</th>
                    <th className="py-2.5 px-3">Tipo / Entidade</th>
                    <th className="py-2.5 px-3">Contrato no Neon</th>
                    <th className="py-2.5 px-3">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  <tr>
                    <td className="py-2 px-3 font-bold text-indigo-700 dark:text-indigo-400">uid</td>
                    <td className="py-2 px-3">string</td>
                    <td className="py-2 px-3">Obrigatório • igual à chave estável derivada do UID Firebase</td>
                    <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">
                      Chave do workspace definida pelo servidor a partir do UID autenticado
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-indigo-700 dark:text-indigo-400">updatedAt</td>
                    <td className="py-2 px-3">string (ISO-8601)</td>
                    <td className="py-2 px-3">Obrigatório</td>
                    <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">
                      Timestamp da última sincronização em nuvem
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">accountsJson</td>
                    <td className="py-2 px-3">BankAccount[]</td>
                    <td className="py-2 px-3">Obrigatório</td>
                    <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">
                      Contas correntes, poupança, investimentos e contas globais (EUR/USD)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">cardsJson</td>
                    <td className="py-2 px-3">CreditCard[]</td>
                    <td className="py-2 px-3">Obrigatório</td>
                    <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">
                      Cartões de crédito, limites, dia de fechamento e vencimento
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">categoriesJson</td>
                    <td className="py-2 px-3">Category[]</td>
                    <td className="py-2 px-3">Obrigatório</td>
                    <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">
                      Categorias, subcategorias, tetos mensais e blocos 50/30/20
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">transactionsJson</td>
                    <td className="py-2 px-3">Transaction[]</td>
                    <td className="py-2 px-3">Obrigatório</td>
                    <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">
                      Razão geral (contas, parcelas de cartão, OFX, rateios e câmbio)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">investmentsJson</td>
                    <td className="py-2 px-3">InvestmentAsset[]</td>
                    <td className="py-2 px-3">Obrigatório</td>
                    <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">
                      Carteira de Renda Fixa, FIIs, Ações B3 e ETFs com sync Google Finance
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">tripsJson</td>
                    <td className="py-2 px-3">Trip[]</td>
                    <td className="py-2 px-3">Opcional</td>
                    <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">
                      Viagens internacionais, lotes de câmbio (VET) e acertos Splitwise
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeDocTab === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <FileCode2 className="h-4 w-4 text-indigo-600" />
                Documentação Gerada no Projeto
              </div>
              <ul className="space-y-1 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                <li>• /README.md (Manual Completo do Projeto)</li>
                <li>• /docs/DATABASE_DOCUMENTATION.md (Banco & ER)</li>
                <li>• /docs/ARCHITECTURE_AND_API.md (API & Regras)</li>
                <li>• /security_spec.md (Invariantes Zero-Trust)</li>
                <li>• /.github/workflows/ci.yml (Pipeline CI GitHub)</li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Qualidade & Testes Automatizados
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                O projeto mantém testes unitários determinísticos cobrindo parcelamentos, baixa de faturas, regra 50/30/20, câmbio VET + IOF, Splitwise de viagens, conciliação OFX, predição inteligente de categorias e relatórios.
              </p>
            </div>
          </div>
        )}

        {activeDocTab === 'api' && (
          <div className="space-y-2.5">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="inline-block rounded bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800 dark:text-emerald-300 mr-2">
                  GET /api/status (público) · /api/readiness (cron protegido)
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  Status público da API e configuração; sincronização do Neon abaixo
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-500">backend/app.ts</span>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="inline-block rounded bg-sky-100 dark:bg-sky-950 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-800 dark:text-sky-300 mr-2">
                  POST /api/fx/live-rate
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  Cotação Comercial em Tempo Real (Gemini Google Search Grounding)
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-500">EUR, USD, GBP, CAD, CHF...</span>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="inline-block rounded bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 font-mono text-[10px] font-bold text-indigo-800 dark:text-indigo-300 mr-2">
                  POST /api/investments/sync-quotes
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  Sincronização de Cotações B3 / Google Finance (Ações, FIIs e ETFs)
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-500">Até 20 ativos/lote</span>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="inline-block rounded bg-amber-100 dark:bg-amber-950 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800 dark:text-amber-300 mr-2">
                  POST /api/reminders/send-email
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  Disparo de Resumo Financeiro por E-mail via SMTP Personalizado
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-500">Nodemailer TLS</span>
            </div>
          </div>
        )}

        {activeDocTab === 'github' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 text-emerald-950 dark:text-emerald-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                Repositório Git Local Inicializado e Comitado na Branch `main`
              </p>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                O código-fonte, testes, backend Neon, regras legadas de migração, workflow de CI e documentação estão versionados no GitHub.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                URL do seu Repositório no GitHub
              </label>
              <input
                type="text"
                value={repoUrlInput}
                onChange={(e) => setRepoUrlInput(e.target.value)}
                placeholder="https://github.com/SEU_USUARIO/minhas-economias-br.git"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 font-mono text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="rounded-xl bg-slate-900 text-slate-100 p-4 space-y-2.5 font-mono text-[11px]">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="inline-flex items-center gap-1.5 text-slate-400 font-sans text-xs font-semibold">
                  <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                  Comandos Prontos para Sincronizar com o GitHub
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyText(gitSyncCommands, 'git-cmds')}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-sans font-semibold text-white transition-colors"
                >
                  {copiedCommand === 'git-cmds' ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copiar Comandos
                    </>
                  )}
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed text-emerald-300">
                {gitSyncCommands}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
