# Estrutura do código

Mapa de pastas e regras de onde cada coisa deve ficar. Atualizado em 2026-11-19, depois de dividir os arquivos grandes (App, formulário de lançamento, viagens, servidor e regras financeiras).

## Visão da raiz

```text
/
├── README.md · MASTER_BLUEPRINT.md · HANDOFF.md · CHECKLIST.md   # documentos vivos do projeto
├── docs/                    # documentação oficial (ver docs/README.md)
├── src/                     # aplicativo (React + TypeScript)
├── backend/                 # servidor Express (rotas, sessão, banco)
│   ├── app.ts               # monta o servidor: registra as rotas em ordem, 404 da API, páginas e erros
│   ├── routes/              # uma rota por assunto: authRoutes (login, passkeys), guards (proteção e limites),
│   │                        #   workspaceRoutes, familyRoutes, healthRoutes, marketDataRoutes, reminderRoutes
│   └── database.ts · authUser.ts · workspaceRequest.ts · familyHelpers.ts · marketData.ts   # apoio das rotas
├── api/                     # adaptadores finos que expõem o servidor como funções da Vercel
├── shared/                  # código usado pelo front e pelo servidor (identidade do workspace)
├── db/migrations/           # migrações SQL do Neon (001…011), em ordem
├── scripts/                 # utilitários de QA (qa-postgres.ts)
├── public/                  # ícones e arquivos estáticos do PWA
├── .github/workflows/       # CI, backup diário e atividade diária do Neon
├── index.html · vite.config.ts · tsconfig.json · vercel.json · package.json · bun.lock · .env.example
```

## `src/` por dentro

```text
src/
├── main.tsx                 # ponto de entrada do navegador
├── App.tsx                  # raiz: chama os hooks de src/app/ em ordem e monta a moldura da tela
├── app/                     # o App dividido por área (sem mudar comportamento, 2026-11-19)
│   ├── appConfig.ts / lazyScreens.ts / appContext.ts   # constantes, telas sob demanda, tipo do contexto
│   ├── useAppState.ts               # estado, navegação, avisos e desfazer
│   ├── useWorkspaceSync.ts          # login, leitura/gravação no Neon, conflito, tempo real, convites
│   ├── useReceivables.ts · useFinancialSnapshot.ts · useSharedSync.ts
│   ├── useTransactionActions.ts · useCardActions.ts · useTripActions.ts
│   ├── useCategoryAndGoalActions.ts · useFamilyActions.ts · useAccountAndInvestmentActions.ts
│   ├── useImportAndBackupActions.ts · useNoticesAndInsights.ts · useOsNotifications.ts
│   └── AppHeader.tsx · AppBanners.tsx · AppTabContent.tsx · AppModals.tsx   # partes da tela
├── App.test.tsx             # testes de orquestração do App (usa test-utils)
├── index.css                # estilos globais (Tailwind v4)
├── types/finance.ts         # contratos TypeScript de todas as entidades
│
├── domain/                  # REGRAS DE NEGÓCIO PURAS (sem React, sem rede). Cada .test.ts fica ao lado.
│   ├── finance/             # regras financeiras, um arquivo por assunto (financeRules.ts só reexporta tudo):
│   │   ├── transactionClassification.ts  # o que é gasto pessoal, mês de consumo × mês de caixa
│   │   ├── transactionBatch.ts           # criar lançamentos, parcelas e fixos (centavos)
│   │   ├── transactionTags.ts            # etiquetas
│   │   ├── transactionOperations.ts      # pago/pendente, bloqueios, edição/exclusão em cascata, séries
│   │   ├── transactionSearch.ts          # busca global
│   │   ├── accountBalances.ts            # saldo de contas
│   │   ├── pendingMovements.ts           # contas a pagar/receber e faturas em aberto
│   │   ├── creditCardInvoices.ts         # fatura, limite, mês da fatura, pagar e estornar fatura
│   │   ├── bankReconciliation.ts         # aplicar extrato importado
│   │   ├── monthlyReports.ts             # resumo do mês, categorias, orçamento, 50/30/20, períodos
│   │   ├── cashFlowCalendar.ts           # fluxo diário e calendário
│   │   ├── wealthAndHealth.ts            # posição de hoje, patrimônio, score 360
│   │   ├── personalDre.ts                # DRE pessoal e rendimentos de investimento
│   │   ├── fixedIncomeSimulator.ts       # simulador de renda fixa e IR regressivo
│   │   ├── businessDays.ts               # dia útil bancário (fim de semana e feriados)
│   │   └── formatting.ts                 # R$, datas e meses
│   ├── cards/               # comprometimento do cartão
│   ├── budgets/             # orçamentos, previsão de caixa, aprendizado, recorrência, saúde dos dados
│   ├── receivables/         # A Receber (fatura de cartão adicional, empréstimos)
│   ├── family/              # compartilhamento e acertos
│   ├── trips/               # viagens e câmbio
│   ├── investments/         # carteira, aportes, cotações
│   └── reminders/           # lembretes e avisos do sino
│
├── services/                # PLUMBING de dados (entrada/saída de dados do app)
│   ├── workspace/           # cópia local, payload, sessão, recuperação de sincronização, backup JSON
│   └── import-export/       # OFX, CSV, PDFs de relatório e de viagem
│
├── lib/                     # clientes HTTP do navegador (login, passkey, workspace no Neon)
├── components/              # TELAS e peças visuais, uma pasta por área
│   ├── layout/              # menus, error boundary, esqueletos, avisos de configuração
│   ├── ui/                  # peças reutilizáveis (campo de moeda, ícone de categoria)
│   ├── overview/ · transactions/ · accounts/ · cards/ · budgets/
│   ├── receivables/ · family/ · trips/ · investments/ · reports/
│   ├── settings/ · auth/
├── hooks/                   # hooks React reutilizáveis (mobile, acessibilidade de janelas, instalar PWA)
├── pwa/                     # atualização automática do app instalado
├── utils/                   # auxiliares pequenos de interface e infraestrutura
└── test-utils/              # ambiente de teste (happy-dom) e harness do App
```

## Regras para colocar código

| Pergunta | Onde vai |
|---|---|
| É um **cálculo ou decisão de negócio** (sem React)? | `src/domain/<assunto>/` com teste ao lado |
| É uma **tela ou pedaço de tela**? | `src/components/<área>/` |
| Fala com a **API** do servidor a partir do navegador? | `src/lib/` |
| Lê/grava dados locais, importa/exporta arquivos, monta o payload do workspace? | `src/services/` |
| Serve a mais de uma área e é só interface? | `src/components/ui/` |
| Pequeno auxiliar de interface sem regra de negócio? | `src/utils/` |
| É uma rota ou regra do servidor? | `backend/` |
| Muda o banco? | nova migração em `db/migrations/` (nunca editar uma antiga) |

Convenções:
- **Teste ao lado do arquivo**: `foo.ts` ↔ `foo.test.ts`.
- **Imports relativos** (`../../types/finance`). Regra de dependência: `components` pode importar `domain`, `services`, `lib`, `hooks`, `utils`; `domain` **não** importa `components` nem `lib`; `domain` pode importar outro `domain`.
- **Regra de dinheiro mora em `src/domain/`**, no arquivo do assunto (ver a árvore acima). Código novo importa do arquivo do assunto; `financeRules.ts` continua reexportando tudo para os imports antigos. Tela nunca recalcula regra por conta própria.
- **Formulário de lançamento (`src/components/transactions/transaction-modal/`)**: `TransactionModal.tsx` (~250 linhas) só junta as partes. A lógica fica em 4 hooks (`useTransactionFormState` campos, `useTransactionFormEffects` abrir/editar e câmbio, `useTransactionFormHandlers` ações de viagem/moeda/familiar/modo, `useTransactionFormInsights` sugestões, avisos e impacto no orçamento) e numa função sem hooks (`buildTransactionFormActions`, roda depois do retorno antecipado de janela fechada). A tela fica em componentes: `TransactionModalHeader`, `TransactionFormNotices`, `TransactionAmountSection`, `TransactionCoreFields` (+ `TransactionTransferFields`, `TransactionCategoryAccountFields`, `TransactionRecurrenceFields`), `TransactionTagsSection`, `TransactionExtrasSection` (+ `TransactionTripCard`, `TransactionSharedCard`, `TransactionNotesCard`) e `TransactionModalFooter`. Mesma regra do App: hook novo só depois dos que ele usa, e nenhum hook depois do retorno antecipado.
- **Aba Viagens (`src/components/trips/trips-tab/`)**: `TripsTab.tsx` (~340 linhas) mantém as duas telas curtas (sem viagem e lista) e monta a página da viagem. Lógica em 4 hooks (`useTripsState`, `useTripsDerived`, `useTripsActions`, `useTripsModals`); tela em `TripTopBar`, `TripHeaderCard`, `TripConverterAndKpis`, `TripSubNav`, 4 subtelas (`TripSpendView`, `TripGroupSplitView`, `TripFxWalletView`, `TripHowItWorksView`) e duas partes de janelas. As subtelas recebem `TripPageContext`, onde viagem ativa e resumo nunca são nulos.
- **Servidor (`backend/routes/`)**: cada arquivo exporta `registerXxx(app, ctx)`; `backend/app.ts` os chama **na ordem certa** (autenticação → proteções → workspace → família → saúde → câmbio/cotações → e-mail → 404 da API). Mudar a ordem muda quem protege quem. Todo import relativo mantém a extensão `.ts` (teste `runtimeImports`) e import de tipo usa `import type`.
- **Hooks do App (`src/app/`)**: cada hook recebe tudo o que os anteriores devolveram e devolve só o que os seguintes ou a tela usam. Não chamar um hook dentro de `if`; não mudar a ordem das chamadas em `App.tsx` sem conferir a ordem dos efeitos (gravação no Neon depende dela). Ação nova vai para o hook da área; se precisar de algo de um hook posterior, mova a declaração para antes.
- Nome de arquivo em inglês técnico (`financeRules.ts`), textos de tela em português do Brasil.

## Arquivos grandes (dívida técnica conhecida)

| Arquivo | Linhas | Observação |
|---|---|---|
| `src/app/useWorkspaceSync.ts` | ~1.170 | Sincronização com o Neon; pode ser dividido de novo (login × gravação × convites) |

Itens registrados em `CHECKLIST.md` (seção Dívida técnica). Dividir só com testes passando antes e depois e **sem mudar comportamento**.
