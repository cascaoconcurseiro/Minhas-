# Handoff — Minhas Economias

## Estado atual — 2026-11-04 00:39 UTC

Meta ativa: tornar o sistema confiável e funcional de ponta a ponta, com Neon como banco operacional e Firebase Auth para identidade. A validação está avançada, mas não concluída. `main` está no commit `7cb494e` e a última implantação conhecida está Ready no domínio principal. Hoje às 00:35 UTC, `/api/health` respondeu HTTP 200, ambiente `production`, Neon `ok`; Gemini e busca FX ao vivo não estão configurados, Google Finance está disponível.

## Feito nesta continuação

- O usuário confirmou que os três convites familiares eram demonstração e autorizou apagar todos. O Neon confirmou `deleted_count = 3`; consulta agregada posterior confirmou 0 convites e 0 lançamentos compartilhados.
- Reconfirmei em produção: somente a branch `production` existe; workspace agregado permanece sem contas, cartões e lançamentos de demonstração, conforme decisões anteriores do usuário.
- Smoke atual do site: `/api/health` 200; Neon ok.
- Nesta continuação reexecutei `bun test`: 106 passaram, 0 falharam, em 19 arquivos; `bun run lint` e `bun run build` passaram. O build ainda avisa sobre o chunk inicial de 566 kB. Cobertura nova inclui roundtrip de payload, inicialização e importação idempotentes, entradas inválidas rejeitadas antes do SQL e duas requisições HTTP concorrentes com a mesma revisão (mock de Firebase/Neon).
- As mudanças de teste foram publicadas em `e447706`, `4722e1a` e `848bcca`; o último deploy Ready conhecido é `dpl_FE6ys2bk2cFe8LhPMEL5mwJdyCPb`.

## Pendências e limites

- Cron Vercel `/api/health` está configurado em `15 12 * * *` UTC (09:15 São Paulo). A primeira execução automática de hoje ainda precisa ser confirmada após 12:15 UTC; chamada manual não serve como prova.
- Restore/importação ainda não foram percorridos autenticados de UI até Neon em branch QA; não há `.env` local e BrowserOS não está disponível para controlar a sessão autenticada. Compartilhamento entre duas contas foi dispensado pelo usuário.
- Concorrência e falha/retry foram exercitadas com pool mock na API. A corrida SQL real Neon ocorreu anteriormente em branch QA, removida depois; falta aceitação autenticada por API. A tela de retry após indisponibilidade ainda não foi validada.
- Dump portátil e restauração independente ainda não foram demonstrados.
- `minhas_app` e `minhas_daily` mantêm membership em `neon_superuser` e privilégios elevados (`BYPASSRLS`, `CREATEROLE`, `CREATEDB`, `REPLICATION`). O acesso atual não permitiu revogá-los; nenhuma mudança foi feita em produção.
- Revisão visual pixel-level segue pendente porque a captura BrowserOS falhou. SMTP real e Gemini não estão configurados.
- Endpoint Neon informa `suspend_timeout_seconds: 0`, que usa o padrão de 300 segundos. O plano Free não permite desabilitar autosuspend; o Cron diário faz uma consulta e o compute pode voltar a suspender após inatividade. Não alterei a configuração. Ainda falta comprovar a execução agendada real. Veja https://neon.com/docs/introduction/scale-to-zero.
- Busca estática atual: as chamadas do SDK Firestore aparecem apenas em `src/lib/legacyFirestoreMigration.ts` para migração legada; não encontrei listeners ou gravações de rotina no workspace. Dados de sessão/cópia local continuam em `localStorage`.

## Próximo passo concreto

Após `2026-11-04T12:15:00Z`, conferir a execução automática do Cron nos logs da Vercel e consultar novamente `/api/health`. Depois, retomar restore/importação e recovery autenticados em ambiente isolado assim que houver sessão BrowserOS utilizável. Manter a meta aberta até fechar essas evidências ou registrar um limite externo que não possa ser resolvido.
