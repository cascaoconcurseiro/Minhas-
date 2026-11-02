# Checklist — Minhas Economias

## Hospedagem
- [x] Criar projeto `minhaseconomias` no plano gratuito Hobby da Vercel.
- [x] Conectar projeto ao repositório `cascaoconcurseiro/Minhas-` e branch `main`.
- [x] Publicar o commit existente e confirmar que o painel abre na URL de produção.
- [x] Configurar `DATABASE_URL`, `FIREBASE_PROJECT_ID` e `FIREBASE_API_KEY` como variáveis de produção na Vercel.
- [x] Criar o segredo GitHub Actions `NEON_DATABASE_URL` com um papel de conexão separado.
- [x] Alinhar o CI ao `bun.lock` e ao Bun 1.4.3 usado pelo projeto.

## Integração Neon
- [x] Criar projeto e schema inicial no Neon.
- [ ] Criar credencial PostgreSQL restrita para a aplicação e armazená-la como variável secreta na Vercel.
- [ ] Publicar a API de workspace e validar as credenciais Firebase no runtime de produção.
- [ ] Migrar e conferir os dados Firestore do usuário, mantendo autenticação Firebase.
- [ ] Definir e validar a fonte de verdade e o plano de contingência antes de desativar o espelho Firestore.
- [ ] Criar segredo GitHub `NEON_DATABASE_URL` e validar a rotina diária do banco.
- [ ] Validar autenticação, leitura, gravação, concorrência e recuperação no site publicado.
