# Handoff — Minhas Economias

## Última sessão
**Data:** 2026-11-02
**O que foi feito:**
- Vercel Hobby `minhaseconomias` segue conectado ao repositório `cascaoconcurseiro/Minhas-`, branch `main`; produção em https://minhaseconomias-blue.vercel.app/.
- O login Google falhava porque o domínio de produção não estava autorizado no Firebase Auth. Adicionei somente `minhaseconomias-blue.vercel.app`; login autenticado validado.
- A API `/api/workspace/migrate` retornava 404 na Vercel. Criei `api/workspace/migrate.ts` e publiquei no commit `30bb213`.
- Migrei o workspace Firestore da conta autenticada para Neon: 1 conta, 16 categorias, 4 lançamentos, 1 membro de família; sem cartões, metas, investimentos ou viagens. Neon confirmou 1 linha de workspace e 1 recibo de migração com as contagens esperadas; a API confirmou migração e leitura.
- Validei escrita sem alterar o conteúdo financeiro: gravei o mesmo snapshot com controle de revisão; API respondeu 200 e revisão avançou para 2. O painel mostrou “Nuvem sincronizada”.
- Disparei o workflow manual `Neon — atividade diária` no GitHub Actions; execução `41478873917` terminou com sucesso e executou `SELECT 1`.
- `bun run lint`, `bun run build` e `git diff --check` passaram. O CI automático do commit `30bb213` também terminou com sucesso.

## Próximo passo
**Arquivos:** `src/App.tsx` (sincronização e compartilhamento), `firestore.rules`, `backend/app.ts`
**Ação:** decidir e documentar a fonte de verdade e a recuperação antes de remover o espelho Firestore; em seguida desenhar a autorização multi-conta para compartilhar dados familiares. Manter a rotina diária e acompanhar o próximo ciclo agendado.

## Bloqueios e limites
- Firestore continua como espelho/contingência; ainda não foi definido um corte seguro para torná-lo não autoritativo.
- Compartilhamento familiar permanece no Firestore; a migração exige autorização explícita por membro e não deve herdar automaticamente o escopo privado do dono.
- Concorrência entre clientes e recuperação após indisponibilidade do Neon ainda não foram validadas.
- O ping diário acorda o compute uma vez ao dia, mas o plano gratuito pode suspender o compute entre execuções; ele não mantém o banco continuamente ativo.
- Gemini não está configurado na Vercel; recursos que dependem da chave continuam indisponíveis.
