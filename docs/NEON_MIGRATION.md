# Corte de dados para Neon

## Arquitetura atual

- Neon Auth provê login, identidade e sessões; Neon PostgreSQL armazena os dados financeiros e familiares.
- O frontend fala com o backend Express/Vercel; o servidor valida JWTs Neon Auth por JWKS e acessa PostgreSQL com `DATABASE_URL` protegida.
- Firebase Auth e Firestore foram removidos do runtime e das dependências do app.
- Quando uma conta ainda não tem linha no Neon, o app cria um workspace inicial vazio diretamente no Neon.

## Schema implantado

As migrations `001_neon_workspace.sql` a `006_neon_auth_identity.sql` criam workspace JSONB com revisão otimista, recibo histórico, convites e transações compartilhadas. A migration 006 troca os nomes herdados de UID do provedor antigo por IDs do usuário Neon Auth e ajusta as políticas RLS.

## Criação e persistência

- `GET /api/workspace`: lê o workspace do titular.
- `POST /api/workspace`: cria o estado inicial usando insert idempotente, sem substituir dados concorrentes.
- `PUT /api/workspace`: grava a revisão seguinte apenas se `expectedRevision` estiver atual; conflito é 409.
- `/api/family/*`: persiste convites e despesas compartilhadas em tabelas próprias do Neon.

## Dados antigos e validação

Contas antigas e senhas não podem ser transferidas do provedor anterior; os usuários devem criar conta Neon Auth. A restauração JSON do app cobre o workspace pessoal, mas não substitui backup integral do banco; consulte `BACKUP_AND_RESTORE.md`.

Foi ensaiada a restauração de um snapshot Neon da branch raiz para uma nova branch isolada; schema e quatro tabelas operacionais foram conferidos, sem promover a branch restaurada. Depois do ensaio, as branches QA foram excluídas e apenas `production` permanece. Isso não exercita dump/restore independente nem recuperação após corrupção. A concorrência real entre abas e a indisponibilidade real do Neon continuam pendentes; o teste com segunda conta foi dispensado pelo usuário. A rotina diária está no Cron da Vercel: `GET /api/health` consulta `finance_workspaces`; o workflow GitHub é manual. Essa checagem acorda o compute durante a consulta, mas não garante atividade contínua. O projeto Neon Free tem histórico/PITR de seis horas e não tem snapshots agendados; a agenda de snapshots requer plano pago.
