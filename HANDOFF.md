# Handoff — Minhas Economias

## Última sessão
**Data:** 2026-11-02
**O que foi feito:**
- Projeto Vercel Hobby `minhaseconomias` conectado a `cascaoconcurseiro/Minhas-` na branch `main`; o painel publicado abriu com a interface atual.
- Neon São Paulo com schema inicial. Credencial runtime `minhas_app` criada com grants mínimos; `DATABASE_URL` guardada como secret de produção na Vercel.
- `FIREBASE_PROJECT_ID` e `FIREBASE_API_KEY` configuradas na Vercel. O segredo GitHub `NEON_DATABASE_URL` usa uma role separada `minhas_daily` para o ping diário.
- Código local da API Express/Vercel, migração Firestore → Neon, rotina diária e documentação atualizado. `bun run lint`, `bun run build` e `git diff --check` passaram.
- As credenciais não foram adicionadas a arquivos do projeto. Uma senha de role foi revelada por engano durante uma inspeção e imediatamente substituída antes de ser usada.
- Nenhuma cópia Firestore foi migrada ainda. A produção segue no commit `c434138`; o código local ainda não foi enviado.

## Próximo passo
**Arquivo:** `backend/app.ts`, `src/App.tsx`, `api/[...path].ts`, `db/migrations/002_neon_app_role_grants.sql`
**Ação:** revisar o diff completo, sincronizar na branch `main`, aguardar a implantação automática da Vercel, executar a rotina diária manualmente e conferir `/api/health` e uma importação/leitura autenticada no Neon.

## Bloqueios
- O código local está pendente de push e implantação.
- Ainda não foi validado um ciclo real de migração/gravação com uma conta Firebase autenticada; a política de espelho Firestore permanece ativa.
- Compartilhamento entre familiares ainda usa Firestore e precisa de desenho de autorização antes de migrar.
- O workflow diário executa uma consulta breve que acorda Neon, mas o plano gratuito ainda pode suspender o compute entre execuções.
