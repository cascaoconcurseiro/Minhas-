# Banco de dados e persistência — Minhas Economias

## Fonte de verdade

Neon PostgreSQL é o banco operacional exclusivo e também guarda as contas de login (`app_users`: e-mail, hash scrypt, nome, `email_verified`, `token_version`). O frontend envia o token de sessão (HS256, 30 dias) à API Express na Vercel; a API confere assinatura, expiração e `token_version` no banco antes de consultar os dados. Firebase foi removido por completo.

O app guarda no `localStorage` (chave `minhas_economias_br_state_v6_<vault>`) a última versão do workspace, usada só para abrir na hora (`src/utils/workspaceCache.ts`, somente leitura). O Neon continua sendo a única fonte: ao responder, substitui a cópia em silêncio; nada é gravado no Neon nem na cópia antes de o Neon ser lido, e a cópia é apagada ao sair da conta. A senha SMTP é removida da cópia.

Os campos persistidos do workspace são validados antes de aplicar o snapshot à interface. JSON inválido, coleção que não seja array, item sem `id` ou objeto corrompido deixa a sincronização em erro e informa que os dados remotos foram preservados; o app não substitui esses campos por listas vazias e não os grava de volta automaticamente.

O deploy Vercel agenda uma chamada diária a `GET /api/readiness` às 12:15 UTC. Essa rota exige `Authorization: Bearer <CRON_SECRET>`, consulta a tabela operacional `finance_workspaces` e não altera dados. O endpoint público `GET /api/status` não consulta o banco e não representa uma medição de disponibilidade do Neon. No plano Hobby, a invocação pode ocorrer em qualquer momento dentro da hora programada; a execução automática dentro dessa janela ainda precisa ser comprovada. O workflow GitHub de atividade executou por `schedule` em 2026-11-07 (`42397967500`), fazendo `SELECT 1` no Neon.

Se o workspace ainda não existir no Neon, o app cria um workspace vazio diretamente no Neon. O Neon guarda as credenciais (hash), os workspaces e os dados familiares.

## Modelo Neon

As migrations em `db/migrations/` são a referência do schema:

| Tabela | Conteúdo | Proteção |
|---|---|---|
| `app_users` | Conta de login: `id` (`usr_…`), e-mail único em minúsculas, hash scrypt, nome, `email_verified`, `token_version` | Acesso só pelo backend (role de runtime com SELECT/INSERT/UPDATE) |
| `finance_workspaces` | Um snapshot JSONB por usuário, com contas, cartões, categorias, lançamentos, metas, investimentos, viagens e preferências | RLS por `owner_user_id`; cada gravação exige revisão esperada monotônica |
| `finance_workspace_migrations` | Hash SHA-256, origem histórica, data e contagens da importação inicial | RLS pelo UID do proprietário; não armazena outro workspace |
| `finance_family_invitations` | Convites, participantes e estado de aceite/recusa/revogação | RLS para proprietário e e-mail convidado autenticado |
| `finance_shared_transactions` | Apenas despesas explicitamente compartilhadas entre participantes | RLS pelos IDs de remetente/destinatário |

`finance_workspaces.payload` mantém o contrato atual da interface como JSONB para reduzir risco de migração. Os lançamentos ainda não são linhas individualizadas em uma tabela relacional.

## Caminho de acesso

1. `POST /api/auth/register` ou `/login` devolve o token de sessão ao frontend, que o guarda em `localStorage`.
2. A API valida assinatura HS256, expiração e `token_version` (consulta a `app_users` a cada requisição); nunca confia em ID fornecido pelo corpo. Token inválido/expirado/revogado retorna 401; falha ao consultar o banco ou segredo ausente retorna 503.
3. Cada operação PostgreSQL define `app.user_id` e `app.user_email` dentro da transação.
4. As políticas RLS restringem os registros ao usuário ou participante autorizado.
5. `GET /api/workspace` lê o snapshot; `POST /api/workspace` cria uma linha inicial sem sobrescrever uma linha concorrente; `PUT /api/workspace` atualiza somente se `expectedRevision` ainda for a atual.
6. As rotas `/api/family/*` leem e escrevem convites e despesas compartilhadas nas tabelas Neon dedicadas.

`DATABASE_URL`, `AUTH_SESSION_SECRET` (opcional; sem ela a chave é derivada de `DATABASE_URL`) e `CRON_SECRET` ficam configurados no servidor. O frontend nunca conecta diretamente ao PostgreSQL nem recebe `DATABASE_URL`. O logout incrementa `token_version`, invalidando todos os tokens anteriores da conta.

## Operação e backup

O Cron da Vercel chama `GET /api/readiness` diariamente às 12:15 UTC com o bearer secret `CRON_SECRET`. A rota consulta `finance_workspaces` e retorna 200/503 conforme o Neon responde; isso acorda o compute durante a consulta, mas não o mantém ligado continuamente. O workflow `.github/workflows/neon-daily-activity.yml` executou automaticamente por `schedule` em `42397967500`. O workflow `.github/workflows/neon-backup.yml` tem schedule diário separado às 13:17 UTC; a execução mais recente `42413305298` foi manual (`workflow_dispatch`), logo o agendamento de backup ainda precisa de comprovação.

O projeto está no plano Neon Free; a configuração atual informa janela de histórico de 21.600 segundos (6 horas), suficiente para recuperação pontual recente. No início da auditoria não havia snapshots nem agenda de backup configurados. A agenda automática de snapshots do Neon exige plano pago; por isso, o PITR disponível no plano atual não equivale a backup independente de longo prazo. Nesta sessão, um snapshot da branch raiz foi restaurado em uma nova branch de QA, sem substituir a produção; o schema restaurado coincidiu com a origem e as quatro tabelas operacionais estavam presentes. As branches de teste foram excluídas após o ensaio autorizado; a produção continua a única branch. A exportação JSON do app cobre apenas o workspace pessoal. Veja `docs/BACKUP_AND_RESTORE.md` para cobertura das tabelas familiares.
