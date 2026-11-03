# Handoff — Minhas Economias

## Estado atual — 2026-11-03
Meta ativa: tornar o sistema funcional ponta a ponta com Neon operacional e Firebase Auth. Commit publicado mais recente antes desta etapa: `5b97901`; o smoke de produção encontrou 404 de plataforma em três novas rotas aninhadas.

## Trabalho desta etapa
- Corrigi o roteamento da Vercel adicionando funções catch-all para `/api/fx/*`, `/api/investments/*` e `/api/reminders/*`, seguindo o padrão já usado em `api/family/[...path].ts`.
- Revalidei localmente: `bun test` (83/83), `bun run lint` e `bun run build` passaram. Build mantém aviso de chunk principal acima de 500 kB.
- Ainda falta commit/push desta correção e confirmação de 401 sem token em produção.

## Evidência de produção conhecida
- `/api/health` indicou Neon `ok`; workspace e endpoints familiares exigem autenticação (401 sem token).
- Em produção, antes dos adaptadores, FX, sync de cotações e SMTP retornaram 404 de plataforma.
- Workflow diário do Neon teve execução manual bem-sucedida em 3/nov; ainda não foi observado run automático `schedule`.

## Próximos passos concretos
1. Publicar os três adaptadores; aguardar GitHub Actions/Vercel e verificar os três endpoints com POST sem token (esperado 401) mais `/api/health` (Neon `ok`).
2. Validar operações autenticadas com sessão Firebase controlada e testar e-mail apenas com SMTP de teste.
3. Verificar execução automática do cron diário no próximo ciclo.
4. Com conector Neon conectado, criar branch de teste para concorrência, indisponibilidade/recuperação e restore integral.
5. Fazer validação visual responsiva com navegador autorizado disponível.

## Pendências e limites
- Não há credencial Firebase de teste nesta sessão; usuário dispensou E2E familiar com segunda conta.
- Neon plugin/conector não está conectado; branch, restore e concorrência reais não foram executados.
- BrowserOS Neo não está disponível nesta sessão, então falta validação visual completa.
- Não foi observada execução automática do cron; execução manual diária não prova recorrência futura.
- O build continua emitindo aviso de chunk principal acima de 500 kB.
