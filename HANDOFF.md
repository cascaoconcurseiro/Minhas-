# Handoff — Minhas Economias

## Última sessão
**Data:** 2026-11-02
**O que foi feito:**
- Corrigi a regra global de CSS que sobrescrevia `max-w-2xl` do formulário de lançamento e o expandia horizontalmente no desktop. A largura agora respeita o limite definido pelo modal e continua responsiva.
- Auditei o workspace Neon da conta autenticada: 1 conta e 4 lançamentos sem marcadores de mock conhecidos. O usuário confirmou que os quatro lançamentos eram dados de demonstração e autorizou sua exclusão.
- Excluí os 4 lançamentos pela interface autenticada da aplicação, mantendo a conta Nubank. O extrato de outubro e novembro mostrou zero lançamentos; a interface confirmou `Nuvem sincronizada - Neon + espelho Firestore`.
- `src/App.tsx` agora filtra registros identificados como mock ao ler snapshots do Firestore ou Neon e sincroniza a limpeza entre ambos. Publicado no commit `77c0cb0`.
- Atualizei os avisos da interface para explicar que Firebase Auth faz login, Neon é PostgreSQL e Firestore continua como espelho de contingência. Incluí a mesma distinção na tela de conta, login e documentação interna. Publicado no commit `edb2024`.
- `bun run lint`, `bun run build` e `git diff --check` passaram. O CI do commit `edb2024` concluiu com sucesso (run #9). A Vercel responde 200 e serve o bundle com os novos textos.
- A aba de navegador que já estava aberta ainda carregava um bundle anterior pelo service worker; atualize a página para ver o texto novo.

## Próximo passo
**Arquivos:** `src/App.tsx` (leitura do workspace), `src/utils/travelRules.ts` (marcadores de mock)
**Ação:** validar visualmente o modal de lançamento no site publicado após a conclusão do deploy da alteração de CSS.

## Bloqueios e limites
- A limpeza solicitada foi confirmada pela UI e pelo estado sincronizado; não executei consulta independente SQL pós-recarregamento.
- Firestore continua como espelho/contingência e para compatibilidade com o compartilhamento familiar.
