# Handoff — Minhas Economias

## Última sessão
**Data:** 2026-11-02
**O que foi feito:**
- Projeto Vercel Hobby `minhaseconomias` conectado a `cascaoconcurseiro/Minhas-` na branch `main`; o painel publicado abriu com a interface atual.
- Neon São Paulo com schema inicial. Credencial runtime `minhas_app` criada com grants mínimos; `DATABASE_URL` guardada como secret de produção na Vercel.
- `FIREBASE_PROJECT_ID` e `FIREBASE_API_KEY` configuradas na Vercel. O segredo GitHub `NEON_DATABASE_URL` usa uma role separada `minhas_daily` para o ping diário.
- Código da API Express/Vercel, migração Firestore → Neon, rotina diária, cabeçalhos de segurança e documentação sincronizado no commit `5514533`.
- A implantação iniciou automaticamente e o site estático publicou. A primeira chamada a `/api/health` falhou com `FUNCTION_INVOCATION_FAILED`; o log apontou import ESM local sem extensão. Corrigi a resolução e alinhei o CI ao Bun localmente; a correção aguarda push.
- `bun run lint`, `bun run build` e `git diff --check` passaram após a correção local.
- As credenciais não foram adicionadas a arquivos do projeto. Uma senha de role foi revelada por engano durante uma inspeção e imediatamente substituída antes de ser usada.
- Nenhuma cópia Firestore foi migrada ainda. A Vercel publicou o commit `5514533`, mas `/api/health` falha até o patch local de import ESM ser publicado.

## Próximo passo
**Arquivo:** `api/[...path].ts`, `backend/app.ts`, `.github/workflows/neon-daily-activity.yml`
**Ação:** enviar a correção para `main`, aguardar Vercel/CI, confirmar `/api/health`, testar a autenticação e leitura/gravação de um workspace Firebase no Neon, e disparar manualmente o workflow diário para validar `NEON_DATABASE_URL`.

## Bloqueios
- O código local está pendente de push e implantação.
- Ainda não foi validado um ciclo real de migração/gravação com uma conta Firebase autenticada; a política de espelho Firestore permanece ativa.
- Compartilhamento entre familiares ainda usa Firestore e precisa de desenho de autorização antes de migrar.
- O workflow diário executa uma consulta breve que acorda Neon, mas o plano gratuito ainda pode suspender o compute entre execuções.
