# Estrutura do código

Mapa de pastas e regras de onde cada coisa deve ficar. Atualizado em 2026-11-15, depois da reorganização por áreas.

## Visão da raiz

```text
/
├── README.md · MASTER_BLUEPRINT.md · HANDOFF.md · CHECKLIST.md   # documentos vivos do projeto
├── docs/                    # documentação oficial (ver docs/README.md)
├── src/                     # aplicativo (React + TypeScript)
├── backend/                 # servidor Express (rotas, sessão, banco)
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
├── App.tsx                  # orquestrador: estado do workspace, handlers, navegação entre telas
├── App.test.tsx             # testes de orquestração do App (usa test-utils)
├── index.css                # estilos globais (Tailwind v4)
├── types/finance.ts         # contratos TypeScript de todas as entidades
│
├── domain/                  # REGRAS DE NEGÓCIO PURAS (sem React, sem rede). Cada .test.ts fica ao lado.
│   ├── finance/             # lançamentos, contas, faturas, resultado, patrimônio (financeRules.ts), formatação de R$ e datas (formatting.ts) e afins
│   ├── cards/               # comprometimento do cartão, inteligência de cartão
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
- **Regra de dinheiro mora em `financeRules.ts`** (ou no módulo de domínio do assunto). Tela nunca recalcula regra por conta própria.
- Nome de arquivo em inglês técnico (`financeRules.ts`), textos de tela em português do Brasil.

## Arquivos grandes (dívida técnica conhecida)

| Arquivo | Linhas | Observação |
|---|---|---|
| `src/components/transactions/TransactionModal.tsx` | ~4.600 | Modal único de lançamento; candidato a ser dividido por tipo (despesa/receita/transferência) |
| `src/App.tsx` | ~4.600 | Estado e handlers; candidato a extrair hooks por área (ex.: valores a receber, cartões) |
| `src/domain/finance/financeRules.ts` | ~3.300 | Regras centrais; candidato a dividir por assunto mantendo um índice de reexportação |
| `src/components/trips/TripsTab.tsx` | ~3.000 | Tela de viagens |
| `backend/app.ts` | ~1.500 | Rotas Express; candidato a dividir por rota |

Itens registrados em `CHECKLIST.md` (seção Dívida técnica). Dividir só com testes passando antes e depois e **sem mudar comportamento**.
