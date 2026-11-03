# Handoff — Minhas Economias

## Estado atual — 2026-11-03
Meta ativa: concluir auditoria funcional ponta a ponta com Neon como banco operacional e Firebase Auth. Última publicação: `21df8f7` em `main`; check Vercel `success`, deploy `dpl_HRHcWTH9BucsNwezxR2ZH4RNE8jz` `READY`, health 200/Neon `ok`.

## Trabalho desta sessão
- Revalidei a produção: Vercel `READY`, alias `minhaseconomias-blue.vercel.app`, health 200/Neon `ok`; a branch `production` é a única branch Neon e o snapshot temporário ainda expira em `2026-11-04T22:00:00Z`.
- Consulta agregada somente de contagens à produção retornou 3 workspaces, 0 contas e 0 lançamentos no total. Nenhum valor, nome ou email foi lido. Isso contradiz o registro anterior de que os quatro lançamentos foram removidos e a conta Nubank preservada.
- A origem específica da ausência da conta ainda não está provada. O filtro antigo classificava IDs genéricos `acc-nubank`, `acc-itau`, cartões com IDs genéricos, `trip-eurotrip` e FITIDs `NUBANK-*` como mock; a correção que remove esses falsos positivos já foi publicada.
- Corrigi o filtro para só remover sinalizadores explícitos (`isMock`, `isDemo`, IDs mock/demo/seed e FITID MOCK/DEMO); testes regressivos cobrem os IDs de conta/cartão/viagem e FITID genéricos. Testes, lint e build passaram localmente.
- CI passou, Vercel está `READY`; smoke no alias confirmou `status: ok`, `services.neon: ok`; o bundle servido já não inclui os filtros `acc-nubank` ou `NUBANK-SAL-`.
- A busca local não encontrou backup JSON/CSV/OFX do usuário no repositório. Não recriar valores financeiros manualmente. Recuperação depende de localizar uma cópia legada Firestore autenticada, exportação do usuário ou outra cópia verificável.

## Próximo passo concreto
Para recuperar a conta, usar a sessão BrowserOS autenticada para verificar se há snapshot legado disponível, ou pedir ao titular um JSON/backup. Não substituir o estado Neon até validar a origem e os campos. Em 4/nov, verificar a execução automática do Vercel Cron em `15 12 * * *` UTC.

## Pendências e limites
- A conta Nubank antes registrada como preservada não está presente nas contagens agregadas atuais do Neon. Essa divergência é prioritária; o registro anterior por UI não basta para confirmar persistência.
- BrowserOS Neo não está exposto como ferramenta nesta sessão. Não trocar por outro navegador; a verificação autenticada Firestore e a revisão visual desktop/mobile seguem pendentes.
- A validação com segunda conta foi dispensada pelo usuário. O teste HTTP local usa identidade controlada e pool simulado; não é uma sessão real nem corrida API contra Neon real.
- Restore snapshot em branch e corrida SQL sintética no Neon foram ensaiados; dump/restore independente, falha/recuperação real e corrida pela API com sessões autenticadas ainda pendem.
- Vercel Cron `/api/health` está configurado para `15 12 * * *` UTC; primeira execução automática será após 4/nov 12:15 UTC e ainda não ocorreu nesta sessão.
- Neon Free tem PITR de 6 horas e sem agenda automática de snapshots. O cron acorda o compute por uma checagem diária; não o mantém ativo continuamente nem oferece backup de longo prazo.
- SMTP autenticado requer servidor de teste; Gemini não está configurado em produção; branch production sem proteção contra reset/exclusão no plano atual.
