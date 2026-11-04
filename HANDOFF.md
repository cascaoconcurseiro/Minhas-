# Handoff — Minhas Economias

## Estado atual — 2026-11-04 00:55 UTC

Meta ativa: concluir a validação ponta a ponta com Neon como banco operacional e Firebase Auth para identidade. `main` está em `fdb7eca`; o deploy `dpl_5r9VsLfvpaYwXweNysT1U9RzK4aA` está Ready no domínio de produção. O smoke às 00:42 UTC confirmou homepage 200, health 200/Neon `ok`, seis APIs protegidas em 401 sem token e bundle sem o Guia Rápido, `tx-demo` ou URL PostgreSQL.

## Feito nesta sessão

- Excluí com autorização os 3 convites familiares de demonstração; Neon confirmou zero convites e zero transações compartilhadas. Só a branch `production` permanece.
- Reexecutei `bun test`: 106 passaram em 19 arquivos; `bun run lint` e `bun run build` passaram. O build ainda avisa sobre o bundle inicial de 566 kB.
- Busca estática confirma chamadas Firestore apenas em `src/lib/legacyFirestoreMigration.ts`, para leitura/migração legada; sem listeners ou gravações rotineiras do workspace no Firestore.
- Criei [004_restricted_runtime_roles.sql](db/migrations/004_restricted_runtime_roles.sql), que define roles limitadas criadas por SQL (NOLOGIN), grants necessários ao app e CONNECT apenas para a rotina manual diária.
- Em branch Neon QA, executei o bloco de criação e os grants da migração e conferi a matriz de permissões: sem associação a `neon_superuser`, `BYPASSRLS`, `CREATEROLE`, `CREATEDB`, `REPLICATION` ou DDL; privilégios de DML restritos por tabela.
- Testei uma role limitada de QA com conexão real via `pg`: `current_user` foi a role limitada; ela leu só o workspace de UID teste, atualizou o próprio workspace, não atualizou o workspace de outro UID e inseriu um recibo com sequence identity. A transação foi revertida.
- Removi as branches QA e confirmei a listagem contendo somente `production`. Nenhum segredo ou role de produção foi alterado nesta rodada.

## Pendências e limites

- Roles `minhas_app` e `minhas_daily` de produção ainda herdam `neon_superuser`. A migração está pronta e ensaiada em QA, mas falta ativar as credenciais limitadas na produção: criar/definir senhas fora do Git, atualizar Vercel `DATABASE_URL` e GitHub `NEON_DATABASE_URL`, validar health/fluxos e só então desativar os logins antigos. Manter rollback possível durante o corte.
- A mudança de credenciais na produção é externa e de alto impacto; executar após aprovação explícita do usuário. Nunca registrar senhas em arquivos ou mensagens.
- Cron Vercel `/api/health` está agendado para `15 12 * * *` UTC (09:15 São Paulo). Confirmar a primeira execução automática após `2026-11-04T12:15:00Z`; execução manual não prova o agendamento.
- Restore/importação autenticados de UI até Neon e recovery após indisponibilidade continuam sem prova. BrowserOS não está conectado às ferramentas e não há `.env` local.
- Corrida simultânea por API foi validada com pool mock; corrida real SQL ocorreu em QA anterior, mas não por API autenticada. Backup portátil/restore independente e inspeção pixel-level desktop/mobile seguem pendentes. Compartilhamento entre duas contas foi dispensado pelo usuário; SMTP/Gemini não estão configurados.
- No Neon Free, `suspend_timeout_seconds: 0` usa o padrão de 300 segundos e não é possível desativar o autosuspend. A chamada diária do Cron ativa o banco para a consulta e depois ele pode suspender novamente: https://neon.com/docs/introduction/scale-to-zero.

## Próximo passo concreto

Após aprovação da troca de credenciais, aplicar `004_restricted_runtime_roles.sql` em produção, definir senhas seguras sem registrá-las, atualizar Vercel/GitHub, verificar health e os fluxos de workspace/migração, e então desabilitar os logins privilegiados antigos. Em paralelo, verificar o Cron após `12:15 UTC` e retomar restore/recovery autenticados quando BrowserOS estiver conectado.
