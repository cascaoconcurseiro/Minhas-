# Handoff — Minhas Economias

## Estado atual — 2026-11-03
Meta ativa: concluir auditoria e validação ponta a ponta com Neon operacional e Firebase Auth. Produção está no commit `90aeccb`; novas correções desta etapa ainda estão locais e sem publicação.

## Correções locais desta etapa
- A ação destrutiva agora se chama `handleResetWorkspaceData`/`onResetWorkspaceData` e informa que apaga os dados pessoais do workspace, mas preserva convites e transações familiares que ficam nas tabelas Neon separadas.
- Exigi Firebase ID token para `/api/reminders/send-email`, `/api/fx/live-rate` e `/api/investments/sync-quotes`. Os fluxos de lembretes, câmbio e cotações encaminham o token obtido do Firebase Auth.
- SMTP agora retorna `502` se Nodemailer não entregar; não finge envio bem-sucedido. O envio diário só grava `lastEmailNotifiedDate` depois de resposta positiva e retenta após 15 minutos se falhar.
- Atualizei a especificação de segurança, a documentação da API e o painel interno sobre autenticação e falha SMTP.
- Verificação local: `bun test` 83 passou, `bun run lint`, `bun run build` e `git diff --check` passaram. O build ainda tem aviso de chunk inicial acima de 500 kB.
- Smoke local, sem credenciais: `/api/fx/live-rate`, `/api/investments/sync-quotes` e `/api/reminders/send-email` responderam 401 sem Bearer token. Antes de fechar o envio SMTP com auth, um teste controlado em `127.0.0.1:1` confirmou que falha SMTP retorna 502; não houve e-mail real.
- Ainda não criei commit nem fiz push para essas alterações locais.

## Evidência de produção anterior
- Commit `90aeccb` foi publicado em `main`; CI `41688048038` e Vercel concluíram com sucesso.
- `/api/health` em produção retorna `services.neon: ok`, e `/api/workspace`, `/api/workspace/migrate`, `/api/family/invitations` e `/api/family/shared` respondem 401 sem token.
- Workflow Neon tem execução manual bem-sucedida em 3/nov (`41688417355`). A execução automática `schedule` ainda não apareceu no histórico; a rotina de hoje foi acionada manualmente.

## Próximos passos concretos
1. Revisar/commitar e publicar as alterações locais; aguardar CI/Vercel e verificar que as novas rotas de serviço retornam 401 sem token na produção.
2. Fazer smoke com sessão Firebase autorizada para conferir cotação, envio SMTP e persistência sem enviar e-mail real/sem credencial de teste. O comportamento de envio SMTP real precisa de uma conta de teste controlada.
3. No próximo cron, consultar Actions e obter evidência de evento automático `schedule`.
4. Quando o plugin Neon estiver conectado, criar branch isolada e validar concorrência, falha/recuperação e restore integral com dados sintéticos; nunca restaurar produção.
5. Fazer validação visual desktop/mobile no navegador autorizado. O usuário dispensou fluxo familiar ponta a ponta com uma segunda conta.

## Pendências e limites
- O conector Neon ainda não está conectado; não é possível criar branch de teste ou executar restore/concorrência real.
- O cron automático ainda não tem run observado; hoje foi feita execução manual.
- Não houve teste visual completo no navegador nem aceitação autenticada em Vercel das alterações locais mais recentes.
- Compartilhamento familiar com segunda conta foi dispensado pelo usuário.
- O bundle principal segue acima de 500 kB no build local.
