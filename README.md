# Minhas Economias

Aplicativo web instalável (PWA) de finanças pessoais e familiares para o público brasileiro: contas, cartões de crédito com faturas, orçamentos, valores a receber, compartilhamento familiar, investimentos, viagens com câmbio, relatórios e DRE pessoal. Login próprio (e-mail e senha, ou Face ID); todos os dados ficam no **Neon PostgreSQL**, acessados por uma API autenticada.

## Documentação

Tudo está em [`docs/`](./docs/README.md) (índice completo lá). Atalhos:

| Quero | Arquivo |
|---|---|
| Saber **onde estamos** e o que falta | [`HANDOFF.md`](./HANDOFF.md) · [`CHECKLIST.md`](./CHECKLIST.md) |
| Entender o produto e as regras de cálculo | [`docs/produto/`](./docs/produto/visao-geral.md) |
| Entender como o código é organizado | [`docs/tecnico/estrutura-do-codigo.md`](./docs/tecnico/estrutura-do-codigo.md) |
| Publicar, configurar e fazer backup | [`docs/operacao/`](./docs/operacao/deploy-e-ambientes.md) |
| Saber como trabalhar no projeto | [`docs/processo/`](./docs/processo/handoff-e-checklist.md) |
| Decisões e regras permanentes | [`MASTER_BLUEPRINT.md`](./MASTER_BLUEPRINT.md) |

## Tecnologias

React 19 · TypeScript 7 · Vite 8 · Tailwind v4 · Recharts · jsPDF · Express 4 · PostgreSQL (Neon) · WebAuthn · testes com `bun test` + happy-dom. Hospedagem na Vercel.

## Como rodar

```bash
bun install --frozen-lockfile
cp .env.example .env     # preencher DATABASE_URL, AUTH_SESSION_SECRET, CRON_SECRET
bun run dev              # http://localhost:3000
```

## Comandos

| Comando | O que faz |
|---|---|
| `bun run dev` | Servidor local (API + site) |
| `bun run lint` | Checagem de tipos |
| `bun run test` | Suíte de testes |
| `bun run build` | Build de produção (PWA) |
| `bun run check:handoff` | Confere se o HANDOFF foi atualizado junto com o código |
| `bun run check` | Tudo acima, em sequência, antes de publicar |

## Estrutura (resumo)

```text
src/components/   telas, uma pasta por área        src/domain/     regras de negócio puras
src/services/     dados locais, backup, OFX/CSV     src/lib/        clientes da API
backend/          servidor Express                  db/migrations/  banco (SQL)
docs/             documentação oficial              scripts/        QA e verificação do HANDOFF
```
Mapa completo: [`docs/tecnico/estrutura-do-codigo.md`](./docs/tecnico/estrutura-do-codigo.md).

## Publicação

Push em `main` → Vercel publica em produção. Antes: `bun run check`. Detalhes, variáveis e agendamentos em [`docs/operacao/deploy-e-ambientes.md`](./docs/operacao/deploy-e-ambientes.md).

## Licenças de terceiros

Ver [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
