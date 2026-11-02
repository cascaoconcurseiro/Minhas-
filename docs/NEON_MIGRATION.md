# Corte de dados para Neon

## Arquitetura atual

- Firebase Auth continua como provedor de login e identidade.
- Neon PostgreSQL é o banco de dados operacional único do app: workspace, convites familiares e despesas compartilhadas.
- O frontend fala com o backend Express/Vercel; o servidor valida o Firebase ID token e acessa Neon com `DATABASE_URL` protegida.
- O app não mantém listener, espelho, fallback nem gravações de rotina no Firestore.
- Firestore não participa da operação normal nem recebe gravações. Se uma conta ainda sem linha Neon tiver um snapshot legado próprio, o app lê e importa esse snapshot uma vez; sem documento legado, cria um workspace inicial direto no Neon.

## Schema implantado

As migrations `001_neon_workspace.sql`, `002_neon_app_role_grants.sql` e `003_neon_family_sharing.sql` criam workspace JSONB com revisão otimista, recibo de migração, convites e transações compartilhadas. RLS restringe o workspace ao UID Firebase verificado e as tabelas familiares aos participantes autorizados.

## Criação e persistência

- `GET /api/workspace`: lê o workspace do titular.
- `POST /api/workspace`: cria o estado inicial usando insert idempotente, sem substituir dados concorrentes.
- `PUT /api/workspace`: grava a revisão seguinte apenas se `expectedRevision` estiver atual; conflito é 409.
- `/api/family/*`: persiste convites e despesas compartilhadas em tabelas próprias do Neon.

## Dados antigos e validação

Documentos legados no Firestore não são apagados por esta mudança. As regras permitem somente leitura do documento próprio para importação inicial; todas as escritas estão bloqueadas. A restauração JSON do usuário cobre o workspace, mas não substitui backup integral do banco; consulte `BACKUP_AND_RESTORE.md`.

Não foram ensaiados restauração integral do Neon, concorrência real entre abas, indisponibilidade real do Neon nem compartilhamento ponta a ponta com duas contas. O último teste foi dispensado pelo usuário. O workflow diário `SELECT 1` é uma rotina de atividade, não uma garantia de compute continuamente ativo.
