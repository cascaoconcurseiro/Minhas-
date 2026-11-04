# Handoff — Minhas Economias

## Estado atual — continuação após 2026-11-04 00:58 UTC

Meta ativa: concluir a validação ponta a ponta com Neon como banco operacional e Firebase Auth para identidade. A migração de roles está publicada em `08337df`; o deploy `dpl_AWTr5384tMr9W2cJDgt4XPPQnA2s` está Ready no domínio de produção. O smoke às 00:42 UTC confirmou homepage 200, health 200/Neon `ok`, seis APIs protegidas em 401 sem token e bundle sem o Guia Rápido, `tx-demo` ou URL PostgreSQL.

## Feito nesta sessão

- Ampliei `backend/familyApi.test.ts` com os fluxos locais de criação e listagem de convite, normalização de e-mail, autenticação/verificação, identidade errada, resposta inválida, aceitação, compartilhamento e revogação.
- Validei `bun test backend/familyApi.test.ts`: 8 passaram; `bun test`: 106 em 19 arquivos; `bun run lint` e `bun run build` passaram. O build ainda avisa sobre o bundle inicial de 566 kB (167 kB gzip).
- Essa cobertura familiar é de contrato HTTP com identidade Firebase simulada e banco mockado. Não valida o fluxo entre duas contas reais; o usuário dispensou essa validação.

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

- Roles `minhas_app` e `minhas_daily` de produção ainda herdam `neon_superuser`. A migração está pronta e ensaiada em QA, mas falta ativar as credenciais limitadas na produção: criar/definir senhas fora do Git, atualizar Vercel `DATABASE_URL` e GitHub `NEON_DATABASE_URL`, validar health/fluxos e só então desativar os logins antigos. Manter rollback possível durante o corte.
- A mudança de credenciais na produção é externa e de alto impacto; executar após aprovação explícita do usuário. Nunca registrar senhas em arquivos ou mensagens.
- Cron Vercel `/api/health` está agendado para `15 12 * * *` UTC (09:15 São Paulo). Confirmar a primeira execução automática após `2026-11-04T12:15:00Z`; execução manual não prova o agendamento.
- Restore/importação autenticados de UI até Neon e recovery após indisponibilidade continuam sem prova. BrowserOS não está conectado às ferramentas e não há `.env` local.
- Corrida simultânea por API foi validada com pool mock; corrida real SQL ocorreu em QA anterior, mas não por API autenticada. Backup portátil/restore independente e inspeção pixel-level desktop/mobile seguem pendentes. Compartilhamento entre duas contas foi dispensado pelo usuário; SMTP/Gemini não estão configurados.
- No Neon Free, `suspend_timeout_seconds: 0` usa o padrão de 300 segundos e não é possível desativar o autosuspend. A chamada diária do Cron ativa o banco para a consulta e depois ele pode suspender novamente: https://neon.com/docs/introduction/scale-to-zero.

## Próximo passo concreto

Confirmar o disparo automático do Cron depois de `2026-11-04T12:15:00Z`. A substituição de credenciais privilegiadas em produção permanece pendente de aprovação explícita; depois dela, aplicar `004_restricted_runtime_roles.sql`, trocar Vercel/GitHub, validar health e fluxos, e desabilitar os logins antigos. Restore/recovery autenticados e inspeção visual continuam pendentes de sessão BrowserOS; não há `.env` local. Compartilhamento entre duas contas foi dispensado pelo usuário.
