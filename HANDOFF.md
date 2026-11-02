# Handoff — Minhas Economias

## Última sessão
**Data:** 2026-11-02
**O que foi feito:**
- Auditei o workspace Neon da conta autenticada sem expor os lançamentos. Ele contém 1 conta e 4 lançamentos; nenhum registro correspondeu aos marcadores de mock conhecidos pelo projeto. Não apaguei esses dados financeiros por não haver evidência de que sejam fictícios.
- `src/App.tsx` agora filtra registros identificados como mock ao ler snapshots do Firestore ou Neon e sincroniza a limpeza entre ambos. Publicado no commit `77c0cb0`.
- Atualizei os avisos da interface para explicar que Firebase Auth faz login, Neon é PostgreSQL e Firestore continua como espelho de contingência. Incluí a mesma distinção na tela de conta, login e documentação interna. Publicado no commit `edb2024`.
- `bun run lint`, `bun run build` e `git diff --check` passaram. O CI do commit `edb2024` concluiu com sucesso (run #9). A Vercel responde 200 e serve o bundle com os novos textos.
- A aba de navegador que já estava aberta ainda carregava um bundle anterior pelo service worker; atualize a página para ver o texto novo.

## Próximo passo
**Arquivos:** `src/App.tsx` (leitura do workspace), `src/utils/travelRules.ts` (marcadores de mock)
**Ação:** revisar com o usuário se a conta e os quatro lançamentos atuais são registros de demonstração ou dados reais. Só remover os registros não marcados depois de identificá-los com segurança.

## Bloqueios e limites
- A limpeza automática usa os marcadores existentes no projeto; auditoria não encontrou registros assim na conta atual.
- O workspace contém uma conta e quatro lançamentos ainda não classificados como mock. Eles foram preservados para evitar apagar dados reais.
- Firestore continua como espelho/contingência e para compatibilidade com o compartilhamento familiar.
