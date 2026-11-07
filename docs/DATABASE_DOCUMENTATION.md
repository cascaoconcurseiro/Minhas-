# Banco de dados e persistência — Minhas Economias

## Fonte de verdade

Firebase Auth fornece a identidade (Firebase UID) e Neon PostgreSQL é o banco operacional exclusivo. O frontend envia o ID token Firebase à API Express na Vercel; a API verifica localmente sua assinatura RS256 e claims usando os certificados públicos rotativos do Firebase antes de consultar o Neon. Firebase Auth é usado somente para autenticação: o runtime não inicializa Firestore nem persiste dados financeiros no Firebase.

Os campos persistidos do workspace são validados antes de aplicar o snapshot à interface. JSON inválido, coleção que não seja array, item sem `id` ou objeto corrompido deixa a sincronização em erro e informa que os dados remotos foram preservados; o app não substitui esses campos por listas vazias e não os grava de volta automaticamente.

O deploy Vercel agenda uma chamada diária a `GET /api/health` às 12:15 UTC. Essa rota consulta a tabela operacional `finance_workspaces` e não altera dados. No plano Hobby, a invocação pode ocorrer em qualquer momento dentro da hora programada; o primeiro disparo automático após a configuração ainda precisa ser observado. O workflow GitHub Actions fica disponível para execução manual de diagnóstico.

Se o workspace ainda não existir no Neon, o app cria um workspace vazio diretamente no Neon. Firebase mantém as credenciais e a sessão de autenticação; Neon guarda os workspaces e dados familiares.

## Modelo Neon

As migrations em `db/migrations/` são a referência do schema:

| Tabela | Conteúdo | Proteção |
|---|---|---|
| `finance_workspaces` | Um snapshot JSONB por usuário, com contas, cartões, categorias, lançamentos, metas, investimentos, viagens e preferências | RLS por `owner_user_id`; cada gravação exige revisão esperada monotônica |
| `finance_workspace_migrations` | Hash SHA-256, origem histórica, data e contagens da importação inicial | RLS pelo UID do proprietário; não armazena outro workspace |
| `finance_family_invitations` | Convites, participantes e estado de aceite/recusa/revogação | RLS para proprietário e e-mail convidado autenticado |
| `finance_shared_transactions` | Apenas despesas explicitamente compartilhadas entre participantes | RLS pelos IDs de remetente/destinatário |

`finance_workspaces.payload` mantém o contrato atual da interface como JSONB para reduzir risco de migração. Os lançamentos ainda não são linhas individualizadas em uma tabela relacional.

## Caminho de acesso

1. Firebase Auth entrega um ID token ao frontend.
2. A API valida localmente a assinatura RS256 e as claims de projeto, emissor, UID, e-mail, verificação e validade do ID token usando os certificados públicos rotativos do Firebase; nunca confia em ID fornecido pelo corpo da requisição. As chaves são mantidas em cache conforme `Cache-Control` do endpoint de certificados e uma falha de atualização é fechada com 503.
3. Cada operação PostgreSQL define `app.user_id` e `app.user_email` dentro da transação.
4. As políticas RLS restringem os registros ao usuário ou participante autorizado.
5. `GET /api/workspace` lê o snapshot; `POST /api/workspace` cria uma linha inicial sem sobrescrever uma linha concorrente; `PUT /api/workspace` atualiza somente se `expectedRevision` ainda for a atual.
6. As rotas `/api/family/*` leem e escrevem convites e despesas compartilhadas nas tabelas Neon dedicadas.

`DATABASE_URL` e `FIREBASE_PROJECT_ID` ficam no servidor. O backend não exige `FIREBASE_API_KEY` nem conta de serviço para verificar tokens; a chave API Firebase aparece apenas na configuração pública do SDK web e não é uma senha de banco. O frontend nunca conecta diretamente ao PostgreSQL nem recebe `DATABASE_URL`.

Como a verificação de ID tokens é stateless, este modo não consulta revogação nem desativação imediata de usuário. Tokens já emitidos continuam aceitos até expirar; o prazo normal de ID tokens Firebase é de aproximadamente uma hora. Verificação imediata de revogação exige uma checagem remota/estado administrativo e não está habilitada neste projeto.

## Operação e backup

O Cron da Vercel chama `GET /api/health` diariamente às 12:15 UTC. A rota consulta `finance_workspaces` e retorna 200/503 conforme o Neon responde; isso acorda o compute durante a consulta, mas não o mantém ligado continuamente. O workflow `.github/workflows/neon-daily-activity.yml` é apenas manual (`workflow_dispatch`).

O projeto está no plano Neon Free; a configuração atual informa janela de histórico de 21.600 segundos (6 horas), suficiente para recuperação pontual recente. No início da auditoria não havia snapshots nem agenda de backup configurados. A agenda automática de snapshots do Neon exige plano pago; por isso, o PITR disponível no plano atual não equivale a backup independente de longo prazo. Nesta sessão, um snapshot da branch raiz foi restaurado em uma nova branch de QA, sem substituir a produção; o schema restaurado coincidiu com a origem e as quatro tabelas operacionais estavam presentes. As branches de teste foram excluídas após o ensaio autorizado; a produção continua a única branch. A exportação JSON do app cobre apenas o workspace pessoal. Veja `docs/BACKUP_AND_RESTORE.md` para cobertura das tabelas familiares.
