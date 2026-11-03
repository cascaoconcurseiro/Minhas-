# Banco de dados e persistência — Minhas Economias

## Fonte de verdade

O PostgreSQL no Neon é o único banco de dados operacional do aplicativo. O frontend acessa o banco exclusivamente pela API Express na Vercel. Firebase Authentication autentica o usuário e fornece o ID token; Firebase/Firestore não participa de leituras, gravações, sincronização ou contingência normais.

Os campos persistidos do workspace são validados antes de aplicar o snapshot à interface. JSON inválido, coleção que não seja array, item sem `id` ou objeto corrompido deixa a sincronização em erro e informa que os dados remotos foram preservados; o app não substitui esses campos por listas vazias e não os grava de volta automaticamente.

O deploy Vercel agenda uma chamada diária a `GET /api/health` às 12:15 UTC. Essa rota consulta a tabela operacional `finance_workspaces` e não altera dados. No plano Hobby, a invocação pode ocorrer em qualquer momento dentro da hora programada; o primeiro disparo automático após a configuração ainda precisa ser observado. O workflow GitHub Actions fica disponível para execução manual de diagnóstico.

O app não usa Firestore para operação normal: não mantém listener, espelho, contingência nem gravação. Se o workspace ainda não existir no Neon, o app consulta uma vez o snapshot legado do próprio titular e importa-o sem substituir dados existentes. Documentos antigos não são apagados por esta mudança.

## Modelo Neon

As migrations em `db/migrations/` são a referência do schema:

| Tabela | Conteúdo | Proteção |
|---|---|---|
| `finance_workspaces` | Um snapshot JSONB por usuário, com contas, cartões, categorias, lançamentos, metas, investimentos, viagens e preferências | RLS por `owner_firebase_uid`; cada gravação exige revisão esperada monotônica |
| `finance_workspace_migrations` | Hash SHA-256, origem histórica, data e contagens da importação inicial | RLS pelo UID do proprietário; não armazena outro workspace |
| `finance_family_invitations` | Convites, participantes e estado de aceite/recusa/revogação | RLS para proprietário e e-mail convidado autenticado |
| `finance_shared_transactions` | Apenas despesas explicitamente compartilhadas entre participantes | RLS pelos UIDs remetente/destinatário |

`finance_workspaces.payload` mantém o contrato atual da interface como JSONB para reduzir risco de migração. Os lançamentos ainda não são linhas individualizadas em uma tabela relacional.

## Caminho de acesso

1. Firebase Auth entrega um ID token ao frontend.
2. A API verifica token, UID e e-mail. Nunca confia em UID fornecido pelo corpo da requisição.
3. Cada operação PostgreSQL define `app.firebase_uid` (e, quando necessário, `app.firebase_email`) dentro da transação.
4. As políticas RLS restringem os registros ao usuário ou participante autorizado.
5. `GET /api/workspace` lê o snapshot; `POST /api/workspace` cria uma linha inicial sem sobrescrever uma linha concorrente; `PUT /api/workspace` atualiza somente se `expectedRevision` ainda for a atual.
6. As rotas `/api/family/*` leem e escrevem convites e despesas compartilhadas nas tabelas Neon dedicadas.

`DATABASE_URL` e a credencial com privilégios de migração ficam somente no servidor. O frontend não conecta diretamente ao Neon.

## Operação e backup

O Cron da Vercel chama `GET /api/health` diariamente às 12:15 UTC. A rota consulta `finance_workspaces` e retorna 200/503 conforme o Neon responde; isso acorda o compute durante a consulta, mas não o mantém ligado continuamente. O workflow `.github/workflows/neon-daily-activity.yml` é apenas manual (`workflow_dispatch`).

O projeto está no plano Neon Free; a configuração atual informa janela de histórico de 21.600 segundos (6 horas), suficiente para recuperação pontual recente. No início da auditoria não havia snapshots nem agenda de backup configurados. A agenda automática de snapshots do Neon exige plano pago; por isso, o PITR disponível no plano atual não equivale a backup independente de longo prazo. Nesta sessão, um snapshot da branch raiz foi restaurado em uma nova branch de QA, sem substituir a produção; o schema restaurado coincidiu com a origem e as quatro tabelas operacionais estavam presentes. As branches de teste foram excluídas após o ensaio autorizado; a produção continua a única branch. A exportação JSON do app cobre apenas o workspace pessoal. Veja `docs/BACKUP_AND_RESTORE.md` para cobertura das tabelas familiares.
