# Handoff — Minhas Economias

## Estado atual — 2026-11-03
Meta ativa: concluir auditoria funcional ponta a ponta com Neon como banco operacional e Firebase Auth. Correção `af97e14` e teste HTTP de isolamento `025b18b` publicados; CI do último commit `success`, Vercel `READY`, health público 200 com Neon `ok`, rotas privadas 401 sem token e cron diário configurado.

## Trabalho desta sessão
- Revalidei a produção: Vercel `READY`, alias `minhaseconomias-blue.vercel.app`, health 200/Neon `ok`; a branch `production` é a única branch Neon e o snapshot temporário ainda expira em `2026-11-04T22:00:00Z`.
- Consulta agregada somente de contagens à produção retornou 3 workspaces, 0 contas e 0 lançamentos no total. Nenhum valor, nome ou email foi lido. O usuário confirmou que todas as contas eram demonstrações; esse estado vazio é esperado, não restaurar Nubank ou saldo.
- A origem específica da ausência da conta ainda não está provada. O filtro antigo classificava IDs genéricos `acc-nubank`, `acc-itau`, cartões com IDs genéricos, `trip-eurotrip` e FITIDs `NUBANK-*` como mock; a correção que remove esses falsos positivos já foi publicada.
- Corrigi o filtro para só remover sinalizadores explícitos (`isMock`, `isDemo`, IDs mock/demo/seed e FITID MOCK/DEMO); testes regressivos cobrem os IDs de conta/cartão/viagem e FITID genéricos. Testes, lint e build passaram localmente.
- CI passou, Vercel está `READY`; smoke no alias confirmou `status: ok`, `services.neon: ok`; o bundle servido já não inclui os filtros `acc-nubank` ou `NUBANK-SAL-`.
- Auditoria de segurança verificou RLS habilitado e forçado nas quatro tabelas operacionais, com políticas baseadas em `app.firebase_uid`. Porém `minhas_app` e `minhas_daily` têm membership `neon_superuser` e atributos `CREATEROLE`, `CREATEDB`, `BYPASSRLS`, `REPLICATION`.
- Tentei revogar membership e reduzir atributos pelo Neon MCP; o banco negou `REVOKE neon_superuser FROM minhas_app` e `ALTER ROLE`. As transações falharam sem alteração. A redução de privilégio precisa de acesso administrativo de roles não disponível pelo atual `neondb_owner`/MCP.
- Não há necessidade de recuperação: o usuário confirmou que todas as contas eram de demonstração.
- Investigação de segurança confirmou risco no convite por e-mail: Firebase permite token válido de conta ainda sem e-mail verificado, que poderia reivindicar um convite dirigido àquele endereço. A API agora exige `email_verified=true` para todas as rotas familiares; o teste HTTP cobre 403 sem consulta ao Neon e sucesso com identidade verificada.
- A interface mostra faixa para conta não verificada, permite reenviar a confirmação e atualizar o estado; o cadastro informa que compartilhar requer confirmação. Suíte completa (94), lint, build e diff check passaram localmente. Commit `af97e14` publicado em `main`; CI GitHub `success`, Vercel deploy `READY` e smoke no alias: homepage 200, health 200/Neon `ok`, JS servido contém a faixa e botões de verificação.
- Nesta continuação confirmei novamente roles de produção no Neon; as roles `minhas_app`/`minhas_daily` seguem com `BYPASSRLS` e membership `neon_superuser`, e o usuário de conexão não tem direito para alterar/revogar. O acesso administrativo de roles ainda é necessário.
- Auditei o uso do Firebase: além de Auth, Firestore só aparece em `legacyFirestoreMigration` e é consultado no importador legado quando o workspace Neon está ausente; as gravações do app passam pela API Neon.
- Adicionei teste HTTP que simula dois UIDs: o proprietário recebe o próprio workspace e o segundo UID recebe 404; a query é explicitamente filtrada pelo UID autenticado. Agora 95 testes, lint, build e `git diff --check` passam; bundle principal continua acima de 500 kB.
- Re-vinculei a CLI Vercel ao projeto (metadado local `.vercel/`, ignorado pelo Git) e confirmei por `vercel crons list` o job real `/api/health` `15 12 * * *`. A primeira execução agendada ainda não ocorreu; hoje é 3/nov UTC e o próximo disparo será 4/nov às 12:15 UTC.
- Smoke público: sete rotas privadas de workspace/migração/família/serviços retornaram 401 sem token. O asset publicado não contém `Guia Rápido` nem `tx-demo`; health 200 com `services.neon=ok`.
- Commit `025b18b` está na `main`; GitHub check `Vercel` `success`, deploy `dpl_FzMQzZLf3RkVes1PjScumzt2JpAx` `READY`. Depois do deploy, homepage 200, bundle manteve a faixa de verificação e não contém Guia Rápido ou marcador `tx-demo`; health segue `ok` no Neon.
- `vercel crons list` mostrou `/api/health` `15 12 * * *`; `vercel crons run /api/health` foi aceito em `2026-11-03T22:53:50.160Z`. Isso confirma que a invocação manual funciona; o disparo automático de `2026-11-04T12:15:00Z` ainda não ocorreu.
- Pesquisa da documentação Neon atual confirmou que agendas automáticas de snapshots exigem plano pago; Neon Free continua em PITR de 6h e limite de snapshot manual, então não alterei o plano nem configurei custo. O snapshot de QA anterior expira 4/nov às 22:00 UTC.
- Depois disso, `adf3897` terminou com GitHub Vercel `success` e Vercel `READY` (`https://minhaseconomias-7609s170y-wesleys-projects-de111a83.vercel.app`).
- BrowserOS MCP ficou acessível após iniciar o app instalado. Na sessão autenticada, abri a Visão Geral, confirmei workspace vazio e sem sincronização pendente, abri/fechei o formulário e naveguei sem gravar pelos módulos principais; os modos Despesa/Cartão/Receita/Transferência exibiram controles específicos. Isso é validação DOM/fluxo; screenshot foi bloqueado pela permissão `activeTab`/`<all_urls>`, portanto visual desktop/mobile continua incompleto.
- A inspeção estatística do código do modal mostra `max-w-2xl`, `max-h-[90vh]`, rolagem interna e breakpoints `sm:`; sem viewport mobile renderizado não marco layout como validado.

## Próximo passo concreto
Próxima ação: substituir a role de runtime por credencial de menor privilégio administrável, depois validar smoke e acesso RLS. Enquanto isso, em 4/nov às 12:15 UTC verificar a primeira execução cron; seguem pendentes backup/restore independente e navegador BrowserOS.

## Pendências e limites
- O usuário confirmou que todas as contas existentes eram demos; nenhuma conta precisa ser recuperada.
- A correção dos privilégios de roles está pendente: o Neon MCP conectado como `neondb_owner` não tem admin option para revogar membership nem permissão para alterar role. API com RLS estática continua filtrando por Firebase UID, mas BYPASSRLS reduz a defesa em profundidade.
- BrowserOS MCP está disponível agora e confirmou autenticação/sessão e navegação DOM no workspace vazio; captura visual foi bloqueada por permissão do BrowserOS, então a inspeção visual desktop/mobile segue pendente. O fluxo de importação Firestore legado permanece sem aceitação autenticada real.
- A validação com segunda conta foi dispensada pelo usuário. O teste HTTP local usa identidade controlada e pool simulado; não é uma sessão real nem corrida API contra Neon real.
- Restore snapshot em branch e corrida SQL sintética no Neon foram ensaiados; dump/restore independente, falha/recuperação real e corrida pela API com sessões autenticadas ainda pendem.
- Vercel Cron `/api/health` está configurado para `15 12 * * *` UTC; primeira execução automática será após 4/nov 12:15 UTC e ainda não ocorreu nesta sessão.
- Neon Free tem PITR de 6 horas e sem agenda automática de snapshots. O cron acorda o compute por uma checagem diária; não o mantém ativo continuamente nem oferece backup de longo prazo.
- SMTP autenticado requer servidor de teste; Gemini não está configurado em produção; branch production sem proteção contra reset/exclusão no plano atual.
