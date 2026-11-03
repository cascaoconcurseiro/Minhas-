# Handoff — Minhas Economias

## Estado atual — 2026-11-03
Meta ativa: concluir auditoria funcional ponta a ponta com Neon como banco operacional e Firebase Auth. Última publicação conhecida: `1a9c726` em `main`; CI/deploy passaram e o health da Vercel confirmou Neon `ok`. A correção do sanitizador passou nos testes locais e aguarda publicação.

## Trabalho desta sessão
- Revalidei a produção: Vercel `READY`, alias `minhaseconomias-blue.vercel.app`, health 200/Neon `ok`; a branch `production` é a única branch Neon e o snapshot temporário ainda expira em `2026-11-04T22:00:00Z`.
- Consulta agregada somente de contagens à produção retornou 3 workspaces, 0 contas e 0 lançamentos no total. Nenhum valor, nome ou email foi lido. Isso contradiz o registro anterior de que os quatro lançamentos foram removidos e a conta Nubank preservada.
- A origem específica ainda não está provada, mas o código classifica IDs genéricos `acc-nubank`, `acc-itau`, cartões com IDs genéricos, `trip-eurotrip` e certos FITIDs `NUBANK-*` como mock. Esse critério pode apagar dados reais; vou restringir o filtro a marcadores explícitos.
- Corrigi o filtro para só remover sinalizadores explícitos (`isMock`, `isDemo`, IDs mock/demo/seed e FITID MOCK/DEMO); testes regressivos cobrem os IDs de conta/cartão/viagem e FITID genéricos. Testes, lint e build passaram localmente.
- A busca local não encontrou backup JSON/CSV/OFX do usuário no repositório. Não recriar valores financeiros manualmente. Recuperação depende de localizar uma cópia legada Firestore autenticada, exportação do usuário ou outra cópia verificável.

## Próximo passo concreto
Publicar a correção do sanitizador em `main` e validar CI/deploy/health. Para recuperar a conta, usar a sessão BrowserOS autenticada para verificar se há snapshot legado disponível, ou pedir ao titular um JSON/backup. Não substituir o estado Neon até validar a origem e os campos.

## Pendências e limites
- A conta Nubank antes registrada como preservada não está presente nas contagens agregadas atuais do Neon. Essa divergência é prioritária; o registro anterior por UI não basta para confirmar persistência.
- BrowserOS Neo não está exposto como ferramenta nesta sessão. Não trocar por outro navegador; a verificação autenticada Firestore e a revisão visual desktop/mobile seguem pendentes.
- A validação com segunda conta foi dispensada pelo usuário. O teste HTTP local usa identidade controlada e pool simulado; não é uma sessão real nem corrida API contra Neon real.
- Restore snapshot em branch e corrida SQL sintética no Neon foram ensaiados; dump/restore independente, falha/recuperação real e corrida pela API com sessões autenticadas ainda pendem.
- Vercel Cron `/api/health` está configurado para `15 12 * * *` UTC; primeira execução automática será após 4/nov 12:15 UTC e ainda não ocorreu nesta sessão.
- Neon Free tem PITR de 6 horas e sem agenda automática de snapshots. O cron acorda o compute por uma checagem diária; não o mantém ativo continuamente nem oferece backup de longo prazo.
- SMTP autenticado requer servidor de teste; Gemini não está configurado em produção; branch production sem proteção contra reset/exclusão no plano atual.
