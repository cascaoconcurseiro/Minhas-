# Persistência financeira no Neon

## Arquitetura atual

- Firebase Auth provê login, identidade e sessões; Neon PostgreSQL armazena os dados financeiros e familiares.
- O frontend fala com o backend Express/Vercel; o servidor verifica localmente ID tokens Firebase (RS256, claims e certificados públicos rotativos em cache) e acessa PostgreSQL com `DATABASE_URL` protegida. A verificação não consulta revogação imediata; tokens emitidos podem permanecer válidos até expirar.
- Firebase Firestore não participa do runtime nem recebe dados financeiros.
- Quando uma conta ainda não tem linha no Neon, o app cria um workspace inicial vazio diretamente no Neon.

## Schema implantado

As migrations `001_neon_workspace.sql` a `007_neon_auth_constraint_names.sql` criam workspace JSONB com revisão otimista, recibo histórico, convites e transações compartilhadas. A migration 006 normalizou os nomes das colunas para `owner_user_id`/`invited_user_id` e `app.user_id`; ela não mudou os valores armazenados. A identidade corrente é o UID Firebase verificado no backend.

## Criação e persistência

- `GET /api/workspace`: lê o workspace do titular.
- `POST /api/workspace`: cria o estado inicial usando insert idempotente, sem substituir dados concorrentes.
- `PUT /api/workspace`: grava a revisão seguinte apenas se `expectedRevision` estiver atual; conflito é 409.
- `/api/family/*`: persiste convites e despesas compartilhadas em tabelas próprias do Neon.

## Dados antigos e validação

As contas Firebase Auth existentes continuam usando o mesmo UID para localizar o workspace Neon associado. Se uma conta não tiver workspace, o app cria um vazio no Neon. A restauração JSON do app cobre o workspace pessoal, mas não substitui backup integral do banco; consulte `BACKUP_AND_RESTORE.md`.

Foi ensaiada a restauração de um snapshot Neon da branch raiz para uma nova branch isolada; schema e quatro tabelas operacionais foram conferidos, sem promover a branch restaurada. Depois do ensaio, as branches QA foram excluídas e apenas `production` permanece. Um dump integral independente também foi cifrado, baixado e restaurado em QA, com contagens agregadas iguais; detalhes estão em `docs/BACKUP_AND_RESTORE.md`. O workflow de atividade diária executou por `schedule` em 2026-11-07 (`42397967500`) e `SELECT 1` passou. Um backup cifrado foi concluído manualmente em `42413305298`; ainda falta comprovar o evento agendado de backup. A chamada diária acorda o compute durante a consulta, mas não garante atividade contínua. A execução do Cron Vercel dentro de sua janela ainda não foi comprovada. A concorrência real entre abas e a indisponibilidade real do Neon continuam pendentes; o teste com segunda conta foi dispensado pelo usuário. O projeto Neon Free tem histórico/PITR de seis horas e não tem snapshots agendados; a agenda de snapshots requer plano pago.
