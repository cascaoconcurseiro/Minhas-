# Minhas Economias BR — Controle Financeiro Pessoal, Investimentos, Câmbio & Viagens

Aplicação web progressiva (**PWA Full-Stack**) de gestão financeira pessoal e familiar adaptada à realidade brasileira, com controle de contas bancárias, conciliação de extratos **OFX/CSV**, faturas de cartão de crédito com efeito cascata e antecipação de parcelas, carteira de investimentos integrada ao **Google Finance / B3**, rateio familiar bilateral via PIX e gestão de viagens internacionais multi-moeda (**TravelSpend + Splitwise**). Firebase Auth cuida do login; os dados persistentes da aplicação são salvos no PostgreSQL do Neon por uma API autenticada.

---

## Sumário da Documentação

1. **[Visão Geral e Arquitetura (`README.md`)](./README.md)** — Visão executiva, módulos do sistema, stack tecnológica, instalação e testes.
2. **[Documentação do Banco de Dados e Persistência (`docs/DATABASE_DOCUMENTATION.md`)](./docs/DATABASE_DOCUMENTATION.md)** — Esquema Neon, tabelas, isolamento por usuário e fluxo de migração legado.
3. **[Arquitetura Técnica, Motores de Regras e API REST (`docs/ARCHITECTURE_AND_API.md`)](./docs/ARCHITECTURE_AND_API.md)** — Especificação das rotas do servidor Express (`backend/app.ts`), motores matemáticos puros (`src/utils/*.ts`) e pipeline de CI/CD.
4. **[Especificação de Segurança (`security_spec.md`)](./security_spec.md)** — Invariantes do modelo de identidade e dados, incluindo as regras históricas do Firestore.

---

## Stack Tecnológica

| Camada | Tecnologia | Finalidade |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript 7 + Vite 8 | Interface reativa SPA e PWA instalável |
| **Estilização** | Tailwind CSS v4 + Lucide Icons | Design system responsivo (Light / Dark Mode) |
| **Visualização de Dados** | Recharts + SVG Custom Charts | Gráficos comparativos de 6 meses, rosca, curvas e progresso |
| **Backend / API** | Node.js + Express 4 (`backend/app.ts`, exposto em `/api/*`) | Proxy seguro para cotações B3/Google Finance, câmbio ao vivo, SMTP e workspace Neon |
| **Banco de Dados & Auth** | Firebase Authentication + Neon PostgreSQL | Firebase apenas autentica; workspace, convites e lançamentos compartilhados persistem no Neon |
| **Inteligência & Cotações** | `@google/genai` (Google Search Grounding) | Consulta de câmbio comercial ao vivo e cotações internacionais |
| **Relatórios Executivos** | `jspdf` | Exportação de relatórios financeiros mensais e de viagens em PDF |
| **Testes Automatizados** | `node:test` + `tsx` | Testes unitários determinísticos das regras financeiras e validações de dados |

---

## Módulos do Sistema

### 1. Visão Geral (Dashboard Executivo)
- Indicadores de **Saldo Atual em Caixa**, **Saldo Projetado no Mês**, **Receitas Realizadas/Previstas**, **Despesas do Mês** e **Taxa de Poupança (%)**.
- **Pulso de Caixa Semanal**: Divisão do mês em 5 semanas com identificação automática da semana de pico de gastos.
- **Alertas Inteligentes**: Contas atrasadas, vencimentos do dia, faturas próximas do fechamento/vencimento e categorias próximas do teto orçamentário.

### 2. Lançamentos, Extrato e Calendário Mensal
- **Central de Lançamento Unificado (`TransactionModal`)**:
  - **Despesa em Conta** (PIX, Débito, Boleto, Dinheiro)
  - **Cartão de Crédito** (À vista, Parcelado em até 48x com ajuste de centavos na 1ª parcela, ou Assinatura Fixa)
  - **Receitas** (Salário, Pró-Labore, Dividendos, Projetos Extras)
  - **Transferências & Pagamento de Fatura** (Entre contas, aporte direto em ativo de investimento ou baixa em cascata de fatura de cartão)
- **Predição Inteligente de Categoria**: Sugere automaticamente a categoria e subcategoria com percentual de confiança com base no histórico de descrições digitadas.
- **Efeito Cascata (`single`, `this_and_future`, `all_series`)**: Edição ou exclusão em lote de séries parceladas ou fixas.

### 3. Contas Bancárias & Conciliação OFX
- Suporte a contas nacionais (`BRL`) e contas globais internacionais (`USD`, `EUR`, `GBP`, `CAD`, `CHF`, etc. — Wise, Nomad, C6 Global, Inter Global, Avenue).
- **Extrato com Saldo Corrido (`Running Balance`)**: Abertura do mês, saldo realizado e saldo projetado após cada movimentação.
- **Importação e Conciliação Bancária (`OFX` / `CSV`)**: Detecção de duplicidades por `FITID`, data e valor com pareamento inteligente.

### 4. Cartões de Crédito & Gestão de Faturas
- Cálculo automático da competência da fatura conforme o **Dia de Fechamento (`closingDay`)** e **Dia de Vencimento (`dueDay`)**.
- **Pagamento Total ou Parcial de Fatura**: Baixa em cascata das parcelas do mês e rolagem automática de saldo residual quando parcial.
- **Antecipação de Parcelas com Desconto**: Antecipa parcelas futuras para a fatura atual aplicando desconto financeiro e preservando metadados para reversão em 1 clique.

### 5. Carteira de Investimentos & Sincronização Google Finance / B3
- Classes de ativos: Renda Fixa Pós-Fixada (CDI/Selic), Renda Fixa IPCA+, Fundos Imobiliários (FIIs), Ações B3 e Exterior / ETFs.
- **Sincronização em Tempo Real (`/api/investments/sync-quotes`)**: Atualiza cotações e variação diária (`%`) diretamente do Google Finance / B3.
- **Rebalanceamento de Carteira**: Compara a alocação atual com o percentual-alvo definido para cada classe de ativo.

### 6. Despesas Compartilhadas & Encontro de Contas Familiar
- Divisão de despesas domésticas (`50/50`, percentual customizado ou valor fixo) indicando quem pagou (`Eu paguei` vs. `Familiar pagou`).
- **Compensação Bilateral Automática**: Abate créditos e débitos recíprocos com o familiar e liquida o saldo líquido em um único lançamento bancário com rastreabilidade (`[ref:id]`).
- **Sincronização Entre Contas (`Cloud Vaults`)**: Espelhamento automático de convites (`fam-inv-*`) e despesas compartilhadas (`tx-mirror-*`) entre contas vinculadas.

### 7. Viagens & Multi-Moeda (TravelSpend + Splitwise)
- Carteira de câmbio por lotes (`TripExchangeLot`) com cálculo automático do **VET Médio Ponderado** (Valor Efetivo Total incluindo IOF de 1,1% para Conta Global ou 3,38% para Cartão Internacional).
- **Gráfico de Economia Cambial (`TripSavingsChart`)**: Compara o VET médio dos lotes comprados com a cotação comercial em tempo real obtida via Google Search Grounding (`/api/fx/live-rate`).
- **Divisão de Gastos em Grupo (Splitwise)**: Rateio igualitário, exato, percentual ou por cotas/pesos entre participantes da viagem, com simplificação de dívidas e quitação.

### 8. Orçamentos (Regra 50/30/20) & Ritmo do Mês (Burn Rate)
- Alocação em **Essenciais (50%)**, **Estilo de Vida (30%)** e **Futuro & Quitações (20%)**.
- Marcador de **Ritmo do Mês (`Burn Rate`)** que compara o percentual consumido do orçamento com o percentual de dias corridos do mês.

### 9. Metas Financeiras & Simulador de Renda Fixa Brasileira
- Vinculação opcional de metas a ativos reais da carteira de investimentos.
- Simulador de juros compostos para **100% CDI**, **110% CDI**, **Tesouro Selic**, **LCI/LCA Isento (92% CDI)** e **Poupança**, já descontando a tabela regressiva de Imposto de Renda.

### 10. Relatórios Visuais, Recharts & Exportação PDF/CSV/JSON
- **Gráfico de Barras Comparativo Recharts (Últimos 6 Meses)**: Evolução mensal de Receitas vs. Despesas nos últimos 6 meses com diagnóstico de saúde financeira semestral.
- **DRE Pessoal Mensal**, gráficos de distribuição por categoria/fonte, evolução do patrimônio líquido e fluxo de caixa diário acumulado.
- Exportação em **PDF Executivo**, **CSV compatível com Excel** e **Backup JSON completo**.

---

## Estrutura de Diretórios

```text
/
├── .github/workflows/ci.yml           # Pipeline de CI (Testes, Typecheck e Build)
├── docs/
│   ├── DATABASE_DOCUMENTATION.md      # Schema Neon e persistência
│   └── ARCHITECTURE_AND_API.md        # Arquitetura full-stack, regras contábeis e API REST
├── scripts/
│   └── sync-github.sh                 # Script utilitário para sincronização com repositório GitHub
├── src/
│   ├── components/                    # Componentes React modulares por domínio
│   │   ├── AccountsTab.tsx            # Contas bancárias, saldo corrido e conciliação
│   │   ├── AuthAndCloudTab.tsx        # Autenticação, Cloud Sync, Auditoria SSOT e Docs
│   │   ├── BankReconciliationModal.tsx# Importação e conciliação OFX/CSV
│   │   ├── BudgetsTab.tsx             # Orçamentos por categoria, 50/30/20 e Burn Rate
│   │   ├── CreditCardsTab.tsx         # Cartões de crédito, faturas e antecipação
│   │   ├── GoalsAndSimulatorTab.tsx   # Metas financeiras e simulador CDI/Selic/LCI
│   │   ├── InvestmentsTab.tsx         # Carteira de investimentos e sync B3/Google Finance
│   │   ├── MonthlyCalendarView.tsx    # Calendário financeiro interativo por dia/semana
│   │   ├── MonthlyComparisonBarChart.tsx # Gráfico Recharts Receitas vs. Despesas (6 meses)
│   │   ├── OverviewTab.tsx            # Dashboard principal e KPIs executivos
│   │   ├── ReminderCenterModal.tsx    # Central de alertas push e agendamento SMTP
│   │   ├── ReportsAndDataTab.tsx      # DRE Pessoal, gráficos Recharts/SVG e exportações
│   │   ├── SharedExpensesTab.tsx      # Rateio familiar e encontro de contas bilateral
│   │   ├── TransactionModal.tsx       # Modal unificado de lançamento e predição inteligente
│   │   ├── TransactionsTab.tsx        # Extrato filtrável, agrupamento diário e ações em lote
│   │   └── TripsTab.tsx               # Viagens internacionais, câmbio VET e Splitwise
│   ├── types/
│   │   └── finance.ts                 # Contratos TypeScript de todas as entidades do sistema
│   ├── utils/                         # Motores de regras de negócio puros e testados
│   │   ├── financeRules.ts            # Cálculos contábeis, faturas, cascata, 6M e DRE
│   │   ├── travelRules.ts             # Câmbio VET, rateio Splitwise e auditoria SSOT
│   │   ├── investmentRules.ts         # Carteira, preço médio e parser Google Finance
│   │   ├── reconciliationRules.ts     # Parser OFX/CSV e pareamento de duplicidades
│   │   ├── uxEnhancementRules.ts      # Predição de categoria, burn rate e pulso semanal
│   │   ├── reminderRules.ts           # Motor de lembretes, notificações e disparo SMTP
│   │   ├── reportPdfGenerator.ts      # Gerador de relatório mensal em PDF
│   │   └── tripPdfGenerator.ts        # Gerador de relatório de viagem em PDF
│   ├── App.tsx                        # Orquestrador de estado SSOT; persistência Neon
│   ├── firebase.ts                    # Inicialização de Firebase Auth
├── firebase-blueprint.json            # Blueprint legado do Firestore
├── firestore.rules                    # Leitura do próprio snapshot para importação; bloqueia toda gravação
├── security_spec.md                   # Especificação de invariantes de segurança do banco
├── backend/app.ts                     # Rotas Express e integração Neon
├── api/[...path].ts                   # Adaptador das rotas Express para Vercel Functions
└── package.json                       # Dependências e scripts de execução
```

---

## Como Executar Localmente

### 1. Instalar dependências
```bash
bun install --frozen-lockfile
```

### 2. Configurar variáveis de ambiente
Copie o arquivo `.env.example` para `.env` e preencha as variáveis do servidor:
```bash
cp .env.example .env
```
`DATABASE_URL`, `FIREBASE_PROJECT_ID` e `FIREBASE_API_KEY` habilitam a API do workspace Neon com Firebase Auth. `GEMINI_API_KEY` é opcional e habilita consultas de câmbio e fallback internacional. Nunca use prefixo `VITE_` nas credenciais do servidor.

### 3. Executar em ambiente de desenvolvimento
```bash
bun run dev
```
O servidor Express + Vite iniciará em `http://localhost:3000`.

### 4. Verificar tipagem TypeScript e gerar build de produção
```bash
bun run lint
bun run build
```

---

## Publicação e sincronização

O projeto `minhaseconomias` usa o plano Vercel Hobby e está conectado ao repositório `cascaoconcurseiro/Minhas-`, branch `main`. Cada push aprovado para `main` dispara uma nova publicação de produção. Configure `DATABASE_URL`, `FIREBASE_PROJECT_ID` e `FIREBASE_API_KEY` nas variáveis de ambiente de produção da Vercel. O workflow GitHub manual usa o segredo `NEON_DATABASE_URL`; a checagem diária é feita pelo Cron Vercel.

O Neon usa autosuspend no plano gratuito. O Cron diário da Vercel chama `/api/health`, que consulta a tabela `finance_workspaces` e acorda o compute durante a consulta; isso não mantém o compute ligado continuamente. O projeto tem janela de recuperação pontual de 6 horas; não há agenda de snapshots configurada.
