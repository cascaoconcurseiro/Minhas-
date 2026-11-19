# Auditoria técnica e limpeza — 2026-11-19

Pedido do dono: procurar bugs, erros e qualquer problema no projeto e no banco Neon e deixar o código limpo e organizado, em padrão profissional.

Base auditada: commit `888ed39` (`main`). Linha de base antes de mexer: tipagem ok, **809 testes** passando, build ok com aviso de pacote acima de 500 kB.

## 1. Banco Neon (produção, somente leitura)

Projeto `minhas-economias-br` (PostgreSQL 18, São Paulo), branch única `production`. Nenhum dado foi alterado.

| Verificação | Resultado |
|---|---|
| Esquema × migrações 001–010 | Coincidem (tabelas, colunas, restrições, índices). |
| RLS | Ligado e forçado em `finance_workspaces`, `finance_workspace_migrations`, `finance_family_invitations`, `finance_shared_transactions`. `app_users` e `app_user_passkeys` sem RLS **por projeto** (o login acontece antes de existir sessão). |
| Papéis | `minhas_app_runtime` sem superusuário/BYPASSRLS; `minhas_daily_runtime` só conecta (usado pelo `SELECT 1` diário); `minhas_backup_reader` só leitura com BYPASSRLS (backup). Correto. |
| Lançamentos (367 nas 2 contas) | 0 ids duplicados, 0 valores não numéricos, 0 valores com mais de 2 casas, 0 negativos, 0 datas inválidas. |
| Referências internas | 0 lançamentos apontando para conta, cartão, categoria, viagem, pessoa ou A Receber inexistente; 0 compra no cartão sem cartão. |
| Compartilhados (131) | Remetente e destinatária existem; convite aceito; 130 de cartão com vencimento da fatura; 1 Pix sem vencimento (correto). |
| Convites | 1, aceito, ligado às duas contas. |

**Achados do banco**

- **N1 — Sem chave estrangeira para `app_users`.** Workspace, convites e compartilhados guardam o id da conta, mas o banco não impede um id inexistente. Hoje não há nenhum órfão. **Correção preparada:** migração `011_app_users_foreign_keys.sql` (sem exclusão em cascata), testada em PostgreSQL 16 descartável com o roteiro de QA completo. **Não aplicada em produção**: depende de autorização do dono.
- **N2 — Resto do Neon Auth.** O schema `neon_auth` (1 usuário, 4 sessões) é do login antigo, anterior à migração 008. O app não o usa. Desligar no painel do Neon depende do dono.
- **N3 — Histórico de importação do Firebase.** `finance_workspace_migrations` tem 3 linhas com ids antigos que não existem mais. Inofensivo; mantido como histórico.
- **N4 — Não há tabela que registre quais migrações rodaram.** A conferência foi feita comparando o esquema. Recomendado manter o hábito de anotar no HANDOFF cada migração aplicada.

## 2. Servidor (`backend/`)

Autenticação, sessão, passkeys, RLS por transação, revisão otimista do workspace e convites estão sólidos. Achados:

| # | Problema | Efeito | Correção |
|---|---|---|---|
| B1 | Rotas curinga escritas no formato do Express 5 (`'*all'`), mas o projeto usa Express 4, onde isso só casa com caminhos terminados em "all". | No modo produção local (`NODE_ENV=production`), abrir qualquer endereço do app que não fosse `/` dava 404. Não afeta a Vercel. | Troca para `'*'`; conferido com o servidor real (`/despesas` → 200). |
| B2 | `/api/reminders/send-email` sem limite de uso. | Uma conta poderia usar o servidor para disparar e-mails em massa. | 20 envios/hora por conta (`429`), assunto em uma linha com até 200 caracteres, corpo limitado (`413`). |
| B3 | Erros inesperados de câmbio, cotações e e-mail devolviam a mensagem técnica interna; o câmbio devolvia o texto bruto da IA (`rawResponse`). | Vazamento de detalhe técnico para a tela. | Mensagem genérica em português; detalhe só no log. |
| B4 | Caminho `/api/...` inexistente respondia página HTML do Express. | O app lê toda resposta da API como JSON. | `404` em JSON. |
| B5 | Cabeçalho `User-Agent: aistudio-build` (resto da ferramenta usada no começo do projeto). | Cosmético. | `minhas-economias`. |

## 3. Aplicativo (`src/`)

Varreduras: somas de dinheiro sem centavos, datas em UTC, `console.log`, `any`, `@ts-ignore`, HTML injetado, TODO/FIXME, arquivos sem uso, links quebrados na documentação.

- Somas de dinheiro: as regras de domínio arredondam em centavos na saída; nenhum erro encontrado.
- Datas: todas as validações usam UTC de forma consistente; nenhuma data "de hoje" calculada em UTC.
- Higiene: nenhum `console.log` no app, nenhum TODO, nenhum HTML injetado, 6 usos de `any`.

| # | Problema | Correção |
|---|---|---|
| F1 | **Código morto**: 7 arquivos (~800 linhas + testes) que nenhuma tela usa: `MonthlyInsightsCard`, `CardInsightsCard` (removidos da Visão Geral a pedido do dono), `monthlyNarrative.ts`, `cardIntelligence.ts`, `ExpertSystemReviewModal` (606 linhas), `UpdateAvailableBanner` (substituído pela atualização silenciosa) e `skeletonRules.ts`. | Apagados com os testes; recuperáveis pelo Git. |
| F2 | A mesma validação de data copiada em 8 lugares. | Todos usam `isValidISODate` (`domain/finance/formatting.ts`). |
| F3 | Campo sem uso `AppSettings.financialMonthStartDay` e mecanismo `ReceivablesIntent` que nunca era acionado (item do CHECKLIST). Conferido no Neon: nenhum workspace tem o campo. | Removidos. |
| F4 | Títulos de testes ainda citavam Firebase (item do CHECKLIST). | Renomeados. |
| F5 | Pacote principal com 514 kB (aviso no build). | React em pacote próprio (`react-vendor`, 219 kB); principal com 294 kB; sem aviso. App conferido em navegador (375 px, sem erros). |
| F6 | Documentação: referência a `docs/BACKUP_AND_RESTORE.md` (não existe) e texto dizendo que a senha SMTP fica no Neon (não fica). | Corrigidos. |

## 4. Itens que precisam de decisão do dono (não alterados)

- **D1** — Aplicar a migração 011 no Neon de produção (recomendado; dados já conferidos).
- **D2** — Desligar o Neon Auth antigo (`neon_auth`).
- **D3** — O item do CHECKLIST "Compartilhado usa a competência da fatura em vez do mês da compra" conflita com a decisão de 15/11 ("compartilhado só é cobrado no vencimento da fatura"). Precisa ser confirmado antes de qualquer mudança.

## 5. Verificação

- `bun run lint`, `bun run test` (**785 testes**: saíram os 26 testes dos arquivos mortos e entraram 2 novos) e `bun run build` sem aviso.
- Os 4 testes novos/alterados do servidor **falham no código antigo** e passam no novo.
- `scripts/qa-postgres.ts` completo em PostgreSQL 16 local descartável com as 11 migrações, incluindo a prova nova de que o banco recusa workspace e compartilhado de conta inexistente.
- Servidor real em modo produção local: `/`, `/despesas`, `/cartoes/install` → 200 HTML; `/api/nada` → 404 JSON.
- Navegador (Chromium, 375 px): tela de login abre, sem erros no console, sem rolagem horizontal.

**Não verificado:** produção na Vercel com esta versão; migração 011 no Neon real; iPhone/Safari.
