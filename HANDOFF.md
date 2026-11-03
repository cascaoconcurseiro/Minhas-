# Handoff — Minhas Economias

## Estado atual — 2026-11-03
Meta ativa: concluir auditoria funcional ponta a ponta com Neon como banco operacional e Firebase Auth. Última publicação conhecida: `ad28c38` na `main`; CI e deploy Vercel passaram. Produção `minhaseconomias-blue.vercel.app` respondeu health 200 com Neon `ok`. Mudanças locais desta sessão ainda não foram publicadas.

## Trabalho concluído nesta sessão
- Usuário autorizou e foram excluídas as branches Neon `qa-synthetic-2026-11-03` e `qa-restore-branch-2026-11-03`; só a produção permanece. Snapshot temporário `snap-dawn-dream-b6672ety` expira em `2026-11-04T22:00:00Z`.
- Adicionado `backend/familyApi.test.ts`: testa por HTTP a rota de sincronização familiar com 401 sem token e, com identidade Firebase controlada e pool PostgreSQL simulado, faz upsert e revogação/remover espelho.
- Incluído o teste no workflow CI. Testes unitários e de backend, `bun run lint` e `bun run build` passaram. O build mantém alerta para chunk principal >500 kB.
- O teste local demonstra caminho de middleware/API e queries, mas não é concorrência real na API nem prova uma sessão de navegador Firebase. O ensaio SQL concorrente no Neon real foi feito anteriormente nas duas ordens e terminou sem espelho após revogação.

## Próximo passo concreto
Revisar `backend/familyApi.test.ts` e `.github/workflows/ci.yml`, depois publicar essa alteração autorizada na `main`; validar CI, deploy e health pós-deploy. Em 4/nov, consultar logs da Vercel para confirmar a primeira execução automática do cron `/api/health` (configuração `15 12 * * *` UTC).

## Pendências e limites
- BrowserOS Neo não está exposto como ferramenta nesta sessão. Não trocar por outro navegador: autenticação real e revisão visual desktop/mobile continuam pendentes até BrowserOS estar disponível.
- A validação com uma segunda conta foi dispensada pelo usuário.
- Snapshot/restore em branch Neon foi ensaiado e a branch QA foi removida; dump/restore independente e indisponibilidade/recuperação real permanecem pendentes.
- Neon Free tem PITR de 6 horas, sem agenda de snapshot automático; a rotina diária acorda o compute, mas não garante backup independente de longo prazo nem compute permanentemente ativo.
- SMTP autenticado precisa de servidor de teste, sem entrega real. Gemini não está configurado em produção (`geminiConfigured: false`), então busca de câmbio ao vivo permanece desativada.
- A branch de produção segue sem proteção contra reset/exclusão no plano atual.
