# Persistência financeira no Neon

## Arquitetura atual

- O backend Express/Vercel autentica e-mail e senha contra `app_users` no Neon; senhas usam hash scrypt e sessões usam tokens HS256 de até 30 dias (`backend/authSession.ts`).
- A cada requisição autenticada, o servidor confere a assinatura e a versão de sessão no banco. O logout incrementa `token_version`, invalidando tokens anteriores. O acesso PostgreSQL usa `DATABASE_URL` protegida no servidor.
- Firebase (Auth, Firestore e Storage) foi removido por completo e não participa do runtime.
- Quando uma conta ainda não tem linha no Neon, o app cria um workspace inicial vazio diretamente no Neon.

## Schema implantado

As migrations `001_neon_workspace.sql` a `009_app_users_token_version.sql` definem workspace JSONB com revisão otimista, recibo histórico, convites, transações compartilhadas, autenticação própria e versão de sessão. A migration 006 normalizou os nomes das colunas para `owner_user_id`/`invited_user_id` e `app.user_id`; ela não mudou os valores armazenados. A identidade corrente é o ID de `app_users` verificado pelo backend. Esta seção descreve os arquivos do repositório; a aplicação de cada migration no banco precisa de verificação remota independente.

## Criação e persistência

- `GET /api/workspace`: lê o workspace do titular.
- `POST /api/workspace`: cria o estado inicial usando insert idempotente, sem substituir dados concorrentes.
- `PUT /api/workspace`: grava a revisão seguinte apenas se `expectedRevision` estiver atual; conflito é 409.
- `/api/family/*`: persiste convites e despesas compartilhadas em tabelas próprias do Neon.

## Dados antigos e validação

O workspace é localizado pelo ID autenticado de `app_users`. Identidades legadas precisam manter o vínculo com `owner_user_id`; cadastrar uma nova conta não comprova vínculo com um workspace antigo. Se uma conta não tiver workspace, o app cria um vazio no Neon. A restauração JSON do app cobre o workspace pessoal, mas não substitui backup integral do banco; consulte `BACKUP_AND_RESTORE.md`.

Foi ensaiada a restauração de um snapshot Neon da branch raiz para uma nova branch isolada; schema e quatro tabelas operacionais foram conferidos, sem promover a branch restaurada. Depois do ensaio, as branches QA foram excluídas e apenas `production` permanece. Um dump integral independente também foi cifrado, baixado e restaurado em QA, com contagens agregadas iguais; detalhes estão em `docs/BACKUP_AND_RESTORE.md`. O workflow de atividade diária executou por `schedule` em 2026-11-07 (`42397967500`) e `SELECT 1` passou. Um backup cifrado foi concluído manualmente em `42413305298`; ainda falta comprovar o evento agendado de backup. A chamada diária acorda o compute durante a consulta, mas não garante atividade contínua. A execução do Cron Vercel dentro de sua janela ainda não foi comprovada. A concorrência real entre abas e a indisponibilidade real do Neon continuam pendentes; o teste com segunda conta foi dispensado pelo usuário. O projeto Neon Free tem histórico/PITR de seis horas e não tem snapshots agendados; a agenda de snapshots requer plano pago.
