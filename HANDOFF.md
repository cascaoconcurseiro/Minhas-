# Handoff — Minhas Economias

## Estado atual — 2026-11-04 01:17 UTC

Meta ativa: concluir a validação ponta a ponta com Neon como banco operacional e Firebase Auth para identidade. O commit atual de docs é `0a80d16`; CI `41752694921` passou e deploy `dpl_4JfcUPPqqRoruvYq8RswM4a2ujwJ` está Ready no domínio de produção. Às 01:16 UTC, homepage respondeu 200, health 200/Neon `ok` e sete APIs protegidas responderam 401 sem token.

## Feito nesta sessão

- Ampliei `backend/familyApi.test.ts` com os fluxos locais de criação e listagem de convite, normalização de e-mail, autenticação/verificação, identidade errada, resposta inválida, aceitação, compartilhamento e revogação.
- Validei `bun test backend/familyApi.test.ts`: 8 passaram; `bun test`: 106 em 19 arquivos; `bun run lint` e `bun run build` passaram. O build ainda avisa sobre o bundle inicial de 566 kB (167 kB gzip).
- Essa cobertura familiar é de contrato HTTP com identidade Firebase simulada e banco mockado. Não valida o fluxo entre duas contas reais; o usuário dispensou essa validação.
- O usuário delegou a decisão sobre a troca de credenciais em produção. Ativei as roles SQL `minhas_app_runtime` (DML apenas nas tabelas necessárias e sequence) e `minhas_daily_runtime` (CONNECT apenas), ambas sem `neon_superuser` e sem atributos administrativos/RLS bypass.
- Atualizei Vercel `DATABASE_URL` e GitHub `NEON_DATABASE_URL` com credenciais distintas para as roles limitadas. Validei ambas por conexão direta; health de produção segue 200/Neon ok; a rotina manual Actions `41752365265` passou; sete rotas protegidas continuam 401 sem token.
- A Neon negou `ALTER ROLE ... NOLOGIN` para `neondb_owner`. Como contingência, usei a API Neon para redefinir as senhas de `minhas_app` e `minhas_daily`; as senhas anteriores agora falham na autenticação. Limite restante: as roles antigas ainda aparecem com `LOGIN` e atributos elevados no catálogo, embora as credenciais publicadas tenham sido substituídas e as senhas antigas invalidadas.
- Publiquei os testes e docs em `5674d66` na `main`; CI `41751616349` passou e Vercel deployment `dpl_FDc4SDYbLjH1rULCwFWNBoMF1aNM` ficou Ready e recebeu os aliases, incluindo `minhaseconomias-blue.vercel.app`.

## Feito em sessões anteriores

- Excluí com autorização os 3 convites familiares de demonstração; Neon confirmou zero convites e zero transações compartilhadas. Só a branch `production` permanece.
- A suíte de workspace já cobre restauração HTTP, criação/importação idempotentes, migração inválida e conflito de gravações simultâneas.
- Reexecutei `bun test`: 106 passaram em 19 arquivos; `bun run lint` e `bun run build` passaram. O build ainda avisa sobre o bundle inicial de 566 kB.
- Busca estática confirma chamadas Firestore apenas em `src/lib/legacyFirestoreMigration.ts`, para leitura/migração legada; sem listeners ou gravações rotineiras do workspace no Firestore.
- Criei [004_restricted_runtime_roles.sql](db/migrations/004_restricted_runtime_roles.sql), que define roles limitadas criadas por SQL (NOLOGIN), grants necessários ao app e CONNECT apenas para a rotina manual diária.
- Em branch Neon QA, executei o bloco de criação e os grants da migração e conferi a matriz de permissões: sem associação a `neon_superuser`, `BYPASSRLS`, `CREATEROLE`, `CREATEDB`, `REPLICATION` ou DDL; privilégios de DML restritos por tabela.
- Testei uma role limitada de QA com conexão real via `pg`: `current_user` foi a role limitada; ela leu só o workspace de UID teste, atualizou o próprio workspace, não atualizou o workspace de outro UID e inseriu um recibo com sequence identity. A transação foi revertida.
- Removi as branches QA e confirmei a listagem contendo somente `production`. Nenhum segredo ou role de produção foi alterado nesta rodada. O novo deploy de produção também confirmou health 200/Neon ok.

## Pendências e limites

- `minhas_app` e `minhas_daily` ainda são roles administrativas com `LOGIN`; o `neondb_owner` não conseguiu desativá-las via SQL. Suas senhas antigas foram rotacionadas e falham em autenticação; app e cron usam credenciais separadas das roles limitadas. Para remover também os atributos e membership das roles antigas, será necessário um mecanismo Neon com autoridade para editar ou eliminar esses papéis.
- Nenhuma senha foi registrada no repositório, checklist, handoff ou resposta. As senhas novas foram transmitidas diretamente aos destinos de segredo Vercel/GitHub.
- Cron Vercel `/api/health` está agendado para `15 12 * * *` UTC (12:15 nominal; 09:15 São Paulo). No Hobby a Vercel pode chamar em qualquer minuto da hora agendada; confirmar a primeira execução automática após `2026-11-04T13:15:00Z`, e não contar chamadas manuais como evidência do agendamento. [A Vercel documenta precisão horária de ±59 min no Hobby](https://vercel.com/docs/cron-jobs/usage-and-pricing).
- Restore/importação autenticados de UI até Neon e recovery após indisponibilidade continuam sem prova. BrowserOS não está conectado às ferramentas e não há `.env` local.
- Corrida simultânea por API foi validada com pool mock; corrida real SQL ocorreu em QA anterior, mas não por API autenticada. Backup portátil/restore independente e inspeção pixel-level desktop/mobile seguem pendentes. Compartilhamento entre duas contas foi dispensado pelo usuário; SMTP/Gemini não estão configurados.
- No Neon Free, `suspend_timeout_seconds: 0` usa o padrão de 300 segundos e não é possível desativar o autosuspend. A chamada diária do Cron ativa o banco para a consulta e depois ele pode suspender novamente: https://neon.com/docs/introduction/scale-to-zero.

## Próximo passo concreto

Confirmar a primeira execução automática do Cron depois de `2026-11-04T13:15:00Z`. Depois, obter autoridade Neon apropriada para remover `LOGIN`/membership/atributos das roles antigas, se suportado, sem interromper rollback. Restore/recovery autenticados e inspeção visual continuam pendentes de sessão BrowserOS; não há `.env` local. Compartilhamento entre duas contas foi dispensado pelo usuário.
