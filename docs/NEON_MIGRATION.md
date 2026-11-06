# Corte de dados para Neon

## Arquitetura atual

- Firebase Auth continua como provedor de login e identidade.
- Neon PostgreSQL é o banco de dados operacional único do app: workspace, convites familiares e despesas compartilhadas.
- O frontend fala com o backend Express/Vercel; o servidor valida o Firebase ID token e acessa Neon com `DATABASE_URL` protegida.
- O app não importa o SDK do Firestore nem mantém listener, leitura, espelho ou gravação nessa base.
- Quando uma conta ainda não tem linha no Neon, o app cria um workspace inicial vazio diretamente no Neon.
- Firebase Auth permanece como provedor de identidade; nenhum dado financeiro depende do Firestore.

## Schema implantado

As migrations `001_neon_workspace.sql`, `002_neon_app_role_grants.sql` e `003_neon_family_sharing.sql` criam workspace JSONB com revisão otimista, recibo de migração, convites e transações compartilhadas. RLS restringe o workspace ao UID Firebase verificado e as tabelas familiares aos participantes autorizados.

## Criação e persistência

- `GET /api/workspace`: lê o workspace do titular.
- `POST /api/workspace`: cria o estado inicial usando insert idempotente, sem substituir dados concorrentes.
- `PUT /api/workspace`: grava a revisão seguinte apenas se `expectedRevision` estiver atual; conflito é 409.
- `/api/family/*`: persiste convites e despesas compartilhadas em tabelas próprias do Neon.

## Dados antigos e validação

Documentos legados no Firestore não são apagados por esta mudança, mas as regras do Firebase passam a negar leitura e escrita. A restauração JSON do usuário cobre o workspace, mas não substitui backup integral do banco; consulte `BACKUP_AND_RESTORE.md`.

Foi ensaiada a restauração de um snapshot Neon da branch raiz para uma nova branch isolada; schema e quatro tabelas operacionais foram conferidos, sem promover a branch restaurada. Depois do ensaio, as branches QA foram excluídas e apenas `production` permanece. Isso não exercita dump/restore independente nem recuperação após corrupção. A concorrência real entre abas e a indisponibilidade real do Neon continuam pendentes; o teste com segunda conta foi dispensado pelo usuário. A rotina diária está no Cron da Vercel: `GET /api/health` consulta `finance_workspaces`; o workflow GitHub é manual. Essa checagem acorda o compute durante a consulta, mas não garante atividade contínua. O projeto Neon Free tem histórico/PITR de seis horas e não tem snapshots agendados; a agenda de snapshots requer plano pago.
