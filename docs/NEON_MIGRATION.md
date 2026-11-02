# Migração do Firestore para Neon

## Estado atual

- O projeto `minhas-economias-br` foi criado na região AWS São Paulo
  (`bitter-cake-49147773`), branch `production`, banco `neondb`.
- A migration `001_neon_workspace.sql` foi aplicada e verificada no SQL Editor:
  `finance_workspaces` e `finance_workspace_migrations` existem.
- Nenhum workspace Firestore foi importado ainda.
- O papel PostgreSQL `minhas_app` foi criado sem ownership e recebeu apenas os
  grants necessários nas tabelas do workspace e na sequência de auditoria. Sua
  `DATABASE_URL` está salva como secret no projeto de produção da Vercel.
- `FIREBASE_PROJECT_ID` e `FIREBASE_API_KEY` estão configuradas em produção na
  Vercel para validar tokens pelo endpoint Firebase Identity Toolkit.
- O segredo GitHub Actions `NEON_DATABASE_URL` está configurado usando o papel
  separado `minhas_daily`, que executa apenas `SELECT 1`.
- O workflow diário está no checkout local e começará a executar após o push.
  O código de integração ainda não foi publicado na Vercel.

- Firebase Authentication continua sendo o provedor de login.
- O código local carrega dados do Neon quando a conta Firebase está autenticada.
  Firestore continua como espelho e contingência; os recursos de família ainda
  dependem de Firestore.
- `db/migrations/001_neon_workspace.sql` cria a tabela de compatibilidade e o
  registro de auditoria da importação.
- `backend/app.ts` oferece rotas próprias autenticadas para ler, importar uma única
  vez e atualizar o workspace da conta Firebase autenticada. `App.tsx` agora
  chama essas rotas e grava no Neon antes de atualizar o espelho Firestore.
- A importação aceita apenas o `vaultId` derivado do e-mail do token validado.
  Ela não sobrescreve uma linha Neon existente. Atualizações exigem a revisão
  corrente e recusam gravações concorrentes.
- `.github/workflows/neon-daily-activity.yml` executa `SELECT 1` diariamente às
  09:15 no horário de Brasília e também pode ser disparada manualmente.

## Modelo escolhido para o primeiro corte

O app calcula dashboards, faturas, rateios, conciliação e relatórios no cliente
a partir de arrays carregados como um único workspace. A primeira tabela guarda
esse contrato em `jsonb`, preservando valores, IDs e campos desconhecidos durante
a migração. Isso reduz o risco do corte; não é o modelo relacional final para
consultas analíticas nem transforma os arrays em relações SQL.

`finance_workspaces` isola cada registro por `owner_firebase_uid`, usa revisão
monotônica para detectar gravações concorrentes e RLS com `app.firebase_uid`.
O servidor deve abrir a transação, definir esse contexto e sempre filtrar por
UID e pelo cofre derivado da identidade verificada. A URL Neon nunca deve ir
para o frontend.

## Etapas para completar o corte

1. Projeto e schema já criados como indicado acima.
2. As variáveis de produção foram configuradas na Vercel. Publicar o backend e
   validar `/api/health` e o acesso autenticado ao banco.
3. Importar cada cofre com a conta Firebase correspondente. Conferir SHA-256 e
   contagens de contas, cartões, categorias, lançamentos, metas, membros,
   investimentos e viagens na resposta e em `finance_workspace_migrations`.
4. A migração automática inicia quando cada titular abre o app autenticado;
   snapshots de família mais novos são aplicados com revisão.
5. Migrar o fluxo familiar. Ele hoje cria convites, lê e grava cofres de outras
   pessoas no Firestore. Não liberar escrita cross-account no Neon por ID ou
   e-mail: criar convites verificáveis e autorização explícita para cada vínculo.
6. Conferir SHA-256 e contagens por titular, validar convites e sincronização
   familiar, e só então desativar a escrita Firestore. Manter export/backup do
   Firestore até a validação pós-corte.
7. O segredo GitHub Actions `NEON_DATABASE_URL` está criado. Enviar o workflow e
   validar uma execução. `SELECT 1` acorda o compute durante a consulta, mas não
   desativa autosuspend nem mantém o compute ligado continuamente.

## Segredos e operação

- `DATABASE_URL`: somente no servidor e nas Actions secrets do repositório.
- `FIREBASE_PROJECT_ID`: identificação não secreta do projeto Firebase.
- `FIREBASE_API_KEY`: chave pública de configuração Firebase, também definida no
  backend para consultar a validade e os dados da conta pelo Identity Toolkit.
- A execução diária pode consumir compute e storage/egress conforme o plano. Um
  ping diário não é garantia de disponibilidade contínua.

## Limitação conhecida do estado atual

As regras Firestore de `cloud_vaults` permitem `get`, `create` e `update` sem
comprovar que a identidade autenticada é dona daquele cofre. A nova API não deve
replicar essa política. A tabela e as rotas atuais só permitem a identidade
Firebase verificada gravar o próprio workspace; o sistema de compartilhamento
precisa ser redesenhado antes da migração funcional dessa parte.
