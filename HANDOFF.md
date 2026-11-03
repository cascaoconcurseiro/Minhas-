# Handoff — Minhas Economias

## Estado atual — 2026-11-03
Meta ativa: concluir auditoria integral com Neon como banco operacional e Firebase Auth. `dccb2c0` foi publicado; CI passou, Vercel ficou `READY` e o health pós-deploy segue 200/Neon `ok`.

## Trabalho concluído nesta etapa
- Neon MCP conectado; branch isolada `qa-synthetic-2026-11-03` (`br-round-surf-b6rbhdmk`) criada da produção e schema comparado sem diferenças.
- Compute temporário de QA (0,25 CU) executou duas atualizações SQL simultâneas sobre tabela sintética `codex_qa_20261103.concurrent_counter`; valor final `2`. Compute foi suspenso. Nenhuma tabela financeira foi consultada ou alterada.
- Corrigida a fronteira SMTP contra SSRF: apenas DNS público e portas `25`, `465`, `587` e `2525`; DNS privado/misto rejeitado, IP aprovado fixado na conexão, TLS obrigatório e timeout de resolução.
- Documentado que as credenciais SMTP são fornecidas pelo usuário e podem fazer parte do snapshot de configurações persistido no Neon.
- Verificação local: `bun test` 93/93, `bun run lint` e `bun run build` passaram. Aviso de bundle principal >500 kB permanece.
- CI `41694953882` e `41695126416` passaram; deploy Vercel `dpl_6b8SfZ3ryTXNtET9H5Sgw3H1rNi7` ficou `READY` e inclui o alias `minhaseconomias-blue.vercel.app`. Smoke pós-deploy: health 200/Neon `ok`; `/api/reminders/send-email` sem token retornou 401.
- A agenda diária Vercel Cron `/api/health` está publicada e configurada para `15 12 * * *`; primeira execução automática ainda precisa ser confirmada após a janela de 4/nov.
- Auditoria do Neon: plano Free (`free_v3`), retenção PITR de 21.600 segundos (6h), sem agenda de snapshots configurada; a configuração de snapshot automático requer plano pago. A checagem diária mantém atividade periódica, não fornece backup longo.
- Snapshot manual `snap-dawn-dream-b6672ety` restaurado com sucesso em `qa-restore-branch-2026-11-03`; schema coincide com produção e as quatro tabelas operacionais estavam presentes. Depois do ensaio, as duas branches QA foram excluídas com autorização explícita. Neon confirma que só `production` permanece primária/padrão. O snapshot temporário expira em 4/nov às 22:00 UTC.
- Corrigidas as referências de documentação à rotina: Vercel Cron chama `/api/health`; workflow GitHub é manual.
- Nas duas ordens concorrentes sobre `codex_qa_20261103.family_race_fixture`, revogação e sincronização serializaram como esperado; ambos os estados finais ficaram revogados e sem espelho sintético. É um ensaio de locks/estado no PostgreSQL, não uma execução autenticada da API.
- Smoke após publicação `9715661`: `/api/health` respondeu 200 com `services.neon: ok`; o compute da branch restaurada está idle.

## Próximo passo concreto
**Arquivo:** `backend/app.ts`, `api/family/[...path].ts`, testes de integração
**Ação:** exercitar a corrida pelo endpoint real `/api/family/shared` com uma fixture local/mockada e autenticação controlada; em paralelo, confirmar o primeiro disparo Cron em 4/nov às 12:15 UTC.

## Bloqueios e pendências
- BrowserOS ainda não foi observado aberto nesta sessão; testes autenticados e inspeção desktop/mobile aguardam essa sessão. A validação com segunda conta foi dispensada pelo usuário.
- Dump/restore independente e indisponibilidade/recuperação real do Neon continuam pendentes; o ensaio feito valida o caminho de snapshot Neon para uma nova branch.
- A branch production segue sem proteção contra reset/exclusão; a proteção avançada de branches Neon não está disponível no plano Free atual.
- SMTP autenticado requer serviço de teste apropriado; não enviar e-mail real durante testes.
- Confirmar logs da primeira execução automática do Cron em 4/nov; configuração do deploy foi confirmada, execução ainda não.
- Gemini não está configurado em produção (`geminiConfigured: false`), mantendo busca de câmbio ao vivo desativada.
