# Handoff — Minhas Economias

## Estado atual — 2026-11-03
Meta ativa: concluir auditoria funcional ponta a ponta com Neon como banco operacional e Firebase Auth. Correção funcional `21df8f7` e atualizações documentais `e0943cc`/`bd0be42` estão na `main`; implantações ficaram `READY`, health 200/Neon `ok`.

## Trabalho desta sessão
- Revalidei a produção: Vercel `READY`, alias `minhaseconomias-blue.vercel.app`, health 200/Neon `ok`; a branch `production` é a única branch Neon e o snapshot temporário ainda expira em `2026-11-04T22:00:00Z`.
- Consulta agregada somente de contagens à produção retornou 3 workspaces, 0 contas e 0 lançamentos no total. Nenhum valor, nome ou email foi lido. O usuário confirmou que todas as contas eram demonstrações; esse estado vazio é esperado, não restaurar Nubank ou saldo.
- A origem específica da ausência da conta ainda não está provada. O filtro antigo classificava IDs genéricos `acc-nubank`, `acc-itau`, cartões com IDs genéricos, `trip-eurotrip` e FITIDs `NUBANK-*` como mock; a correção que remove esses falsos positivos já foi publicada.
- Corrigi o filtro para só remover sinalizadores explícitos (`isMock`, `isDemo`, IDs mock/demo/seed e FITID MOCK/DEMO); testes regressivos cobrem os IDs de conta/cartão/viagem e FITID genéricos. Testes, lint e build passaram localmente.
- CI passou, Vercel está `READY`; smoke no alias confirmou `status: ok`, `services.neon: ok`; o bundle servido já não inclui os filtros `acc-nubank` ou `NUBANK-SAL-`.
- Auditoria de segurança verificou RLS habilitado e forçado nas quatro tabelas operacionais, com políticas baseadas em `app.firebase_uid`. Porém `minhas_app` e `minhas_daily` têm membership `neon_superuser` e atributos `CREATEROLE`, `CREATEDB`, `BYPASSRLS`, `REPLICATION`.
- Tentei revogar membership e reduzir atributos pelo Neon MCP; o banco negou `REVOKE neon_superuser FROM minhas_app` e `ALTER ROLE`. As transações falharam sem alteração. A redução de privilégio precisa de acesso administrativo de roles não disponível pelo atual `neondb_owner`/MCP.
- Não há necessidade de recuperação: o usuário confirmou que todas as contas eram de demonstração.

## Próximo passo concreto
Próxima ação: resolver via Neon Console/API administrativa o excesso de privilégios de `minhas_app` e `minhas_daily`; depois testar a API e health. Em 4/nov, verificar a execução automática do Vercel Cron em `15 12 * * *` UTC.

## Pendências e limites
- O usuário confirmou que todas as contas existentes eram demos; nenhuma conta precisa ser recuperada.
- A correção dos privilégios de roles está pendente: o Neon MCP conectado como `neondb_owner` não tem admin option para revogar membership nem permissão para alterar role. API com RLS estática continua filtrando por Firebase UID, mas BYPASSRLS reduz a defesa em profundidade.
- BrowserOS Neo não está exposto como ferramenta nesta sessão. Não trocar por outro navegador; a verificação autenticada Firestore e a revisão visual desktop/mobile seguem pendentes.
- A validação com segunda conta foi dispensada pelo usuário. O teste HTTP local usa identidade controlada e pool simulado; não é uma sessão real nem corrida API contra Neon real.
- Restore snapshot em branch e corrida SQL sintética no Neon foram ensaiados; dump/restore independente, falha/recuperação real e corrida pela API com sessões autenticadas ainda pendem.
- Vercel Cron `/api/health` está configurado para `15 12 * * *` UTC; primeira execução automática será após 4/nov 12:15 UTC e ainda não ocorreu nesta sessão.
- Neon Free tem PITR de 6 horas e sem agenda automática de snapshots. O cron acorda o compute por uma checagem diária; não o mantém ativo continuamente nem oferece backup de longo prazo.
- SMTP autenticado requer servidor de teste; Gemini não está configurado em produção; branch production sem proteção contra reset/exclusão no plano atual.
