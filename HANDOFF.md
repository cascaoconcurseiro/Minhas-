# Handoff — Minhas Economias

## Retomada do backup cifrado — 2026-11-07

Em `b2bd9e7` foi removido o `age-inspect` inexistente no runner. O workflow de backup PostgreSQL passou em produção na execução manual GitHub Actions `42320784685`: role `minhas_backup_reader` no Neon production, connection string direta sem pooler, artifact age cifrado, retenção de 30 dias. A role tem apenas leitura, `BYPASSRLS` para as tabelas com RLS forçado e `SELECT` em sequências; não tem superuser nem privilégios de escrita/criação. O secret `NEON_BACKUP_DATABASE_URL` foi atualizado para a URL dessa role de produção.

O artifact foi baixado e descriptografado fora do repositório. `pg_restore --list` reconheceu o custom dump PostgreSQL 18.6; a restauração com `--single-transaction` passou na branch QA `qa-neon-backup-20261107`. Os agregados production/QA coincidiram: 4 workspaces, 0 convites, 0 transações compartilhadas e 5 objetos públicos. A branch QA foi removida e o dump local em texto aberto foi apagado. Nenhuma escrita foi feita em production.

Ainda pendentes: primeira execução automática `schedule` às 13:00 UTC; o titular precisa guardar uma cópia segura de `C:\Users\Wesley\Documents\Minhas Economias Backup\neon-backup.agekey` fora do computador e conferir que consegue acessá-la noutro dispositivo; continuam pendentes os itens de interface autenticada, mobile e cobertura de todos os módulos listados no checklist.

Próximo passo concreto: depois de 13:00 UTC em 2026-11-07, verificar se o workflow `Neon — backup PostgreSQL cifrado` executou com `event=schedule` e artifact cifrado. Se falhar, corrigir apenas a automação/credencial, sem relaxar o escopo da role.

## Auditoria de segurança e fluxos — 2026-11-07

Nesta continuação corrigi um risco de privacidade: `smtpPass` e `smtpConfig.pass` não são mais persistidos no Neon nem no cache local, nem incluídos em backup/exportação/importação. Cache local legado é sanitizado no boot; a senha permanece na memória da sessão corrente e o formulário informa que será necessário redigitá-la após recarga/importação. Uma consulta agregada ao Neon encontrou zero dos quatro workspaces com senha SMTP persistida. Também removi um endereço de e-mail pessoal de fixtures públicos de teste.

A auditoria financeira encontrou que o pagamento parcial de fatura duplicava o `sharedAmount` e o estorno não recompunha essa cota. Corrigi o rateio proporcional em centavos e acrescentei regressão. A aba de lançamentos agora confirma exclusão de item, série parcelada e pagamento de fatura; testes DOM cobrem edição, cancelamento e confirmação. Os testes de configurações cobrem upload/restore JSON sintético e cancelamento. Testes de API usam somente mocks para Gemini/Google Finance e SMTP, sem egress nem envio real.

Validação local atual: `bun test` 161/161 em 32 arquivos; `bun run lint`, `bun run build` e `git diff --check` passaram. O build continua com aviso para chunk principal acima de 500 kB. Health de produção respondeu `ok`, `services.neon=ok`, `services.neonLeastPrivilegeRole=true`; as quatro rotas autenticadas retornaram 401 sem Bearer. Cabeçalhos CSP, HSTS, X-Content-Type-Options, Referrer-Policy e Permissions-Policy estão presentes. `GEMINI_API_KEY` não está configurada na Vercel, então `liveFxSearch` fica desativado; as cotações B3 usam Google Finance. A verificação visual em Brave continua pendente: a conexão da extensão substituiu a conexão ativa ao tentar abrir uma aba, e a tela desktop/mobile não foi observada nesta continuação.

Removi o artifact cifrado QA `neon-backup-42320249250`; permanece o artifact cifrado de produção `neon-backup-42320784685` com expiração em 7/dez. Publiquei o conjunto no commit `be9fed4`; CI `42322323802` passou e Vercel `dpl_AV4EZmVhVtNsiCFVQv628FYUbUHU` está Ready no domínio principal. Health pós-deploy está `ok`/Neon `ok`/role restrita; `/api/workspace`, `/api/reminders/send-email`, `/api/fx/live-rate` e `/api/investments/sync-quotes` retornam 401 sem token. Bundle publicado não contém Firebase nem Guia Rápido e os chunks de configurações/lembretes mostram o aviso de que senha SMTP não é persistida.

Próximo passo concreto: após 12:23 UTC, verificar `neon-daily-activity.yml` com `event=schedule`; após 13:00 UTC verificar `neon-backup.yml` com `event=schedule`. Depois publicar as alterações locais e validar o deployment. Aceites ainda abertos: sessão real Neon Auth/OTP e CRUD, restore do arquivo pelo fluxo autenticado de interface, viewport desktop/mobile em Brave, segunda conta familiar (dispensada pelo usuário), chave `age` fora do computador e testes visuais dos módulos restantes.

## Retomada atual — 2026-11-07, Neon Auth + Neon PostgreSQL

O commit `a887df7` foi publicado em `main`. CI `42317905521` passou e o Vercel deployment `dpl_GoeZ9DQEmLyer1F5nWzhsD31VRQ2` está Ready, com alias de produção. Health público retorna `status=ok`, `neon=ok` e `neonLeastPrivilegeRole=true`; `/api/workspace` sem sessão retorna 401. O bundle ativo contém `X-Force-Fetch` e o erro seguro de sessão desatualizada, sem marcadores do SDK Firebase. A varredura atual em `src`, `backend`, `api` e `shared` não encontrou SDK, chamadas ou persistência Firebase; referências em migrations antigas preservam a história da conversão do schema.

Nesta sessão foram adicionados testes DOM sintéticos para criação de lançamento e exigência de autenticação nas rotas de câmbio/cotações/lembretes; os endpoints retornam 401 sem Bearer e não chamam serviços externos. A auditoria de OTP encontrou cache de sessão no SDK Neon Auth: após validar o código, `getJWTToken()` podia devolver token ainda não verificado. O patch local força a renovação da sessão, exige mesmo UID e `emailVerified=true` antes de liberar JWT à API e impede downgrade da UI por atualização atrasada do hook. `bun test` passou 143/143 em 29 arquivos; lint, build e diff-check passaram. O build ainda alerta o chunk principal de 621,82 kB. Os testes de OTP são de helper/contrato local; não houve sessão remota real.

As coleções antigas de demonstração `cloud_vaults` e `workspaces` estão registradas como apagadas e verificadas em sessão anterior, após autorização do usuário. Esta sessão não possui conector Firebase para repetir a verificação diretamente.

O projeto ainda não está pronto para aceite ponta a ponta: falta observar as execuções agendadas (Neon atividade às 12:23 UTC e backup PostgreSQL às 13:00 UTC de 2026-11-07), validar login/OTP e CRUD com conta controlada, completar restore pela interface autenticada, revisar desktop/mobile e fechar a cobertura visual/funcional dos módulos. O backup PostgreSQL independente já passou em execução manual e restauração em QA; isso não prova ainda o agendamento diário nem substitui os aceites de produto.

Próximo passo concreto: após 12:23 UTC, verificar `neon-daily-activity.yml` com `event=schedule`; após 13:00 UTC, verificar `neon-backup.yml` com `event=schedule` e artifact cifrado. Depois retomar restore pela interface autenticada e cobertura dos módulos.

O login em produção foi observado no Brave e o workspace apresentou valores financeiros zerados, indicador Neon PostgreSQL e banner de verificação familiar. A tela também mostrava o aviso antigo “Código aceito, mas a sessão ainda não refletiu a confirmação”, que motivou a correção local. Nenhuma conta, senha ou novo código foi submetido. A automação CUA parou quando a ferramenta não conseguiu identificar a URL atual da janela com confiança suficiente; viewport mobile e demais interações visuais seguem pendentes.

Executei manualmente o workflow GitHub `42316121492` (`workflow_dispatch`); o log mostra `psql` executando `SELECT 1` contra Neon com sucesso. A agenda diária está configurada para 12:23 UTC, mas Actions ainda não registra `event=schedule`; não chamar a execução manual de prova automática. A Vercel tem fallback `VITE_NEON_AUTH_URL` em produção, portanto validar `iss` não depende de cadastrar uma nova variável antes do deploy.

O worktree está limpo após a publicação. Próximo passo concreto: após a janela de 12:23 UTC de 7/nov, consultar o workflow `Neon — verificação diária` e exigir `event=schedule`; conferir o Vercel Cron separado. Depois seguir com signup/login/OTP real com caixa controlada, restore autenticado, backup PostgreSQL integral independente, interface mobile e cobertura visual dos demais módulos. A execução manual `42316121492` e o smoke HTTP são provas de execução manual, não do agendamento diário.

Adicionei e publiquei um teste DOM sintético para a criação de cartão de crédito no estado vazio: valida campos, nome obrigatório, limite maior que zero, conversão BRL e fechamento do formulário no salvamento. `bun test` passou 136/136, lint, build e diff-check passaram; o erro reportado não foi reproduzido neste caminho. Commit `6a4c78c`, CI `42316817588` aprovado, deployment `dpl_Et8ufk4zDp2a69XU7qaD2TeFf3T3` Ready. A cobertura não chega à API/Neon; para fechar a falha do usuário, retomar por teste autenticado em ambiente descartável ou registrar a limitação se faltar controle do navegador.

O commit `deef507` implementou e publicou o backup JSON v6 vinculado ao UID Neon Auth: exportação omite espelhos recebidos e contatos vinculados a convite; ao importar em outra conta, remove vínculos e metadados de compartilhamento; na mesma conta, mantém relações atuais vindas do Neon e sincroniza compartilhamentos somente por vínculos aceitos. CI `42315044261` passou e Vercel `dpl_Gp84YP8myPFaJ5BkhLUfgTmN4fdz` ficou Ready. Produção respondeu health `ok`/Neon `ok`/role restrita; bundle dinâmico do backup mostra o rótulo correto e não contém Firebase nem Guia Rápido. `bun test` passou 129/129 em 24 arquivos, lint e build passaram; o build avisa que o chunk principal tem cerca de 621 kB. Ainda não foi validado o restore pela UI com sessão autenticada.

Um follow-up local endurece a importação para remover também metadados familiares residuais em transações com `isShared=false`; suíte completa, lint e build passaram novamente. Publicado no commit `b6cf3f2`; CI `42315381945` passou e deploy `dpl_B636QbVhEWdgv8r5dx7GnC1DFmWM` está Ready. Health da URL pública continua `ok`/Neon `ok`/role restrita.

Última verificação em 2026-11-06: o deployment `dpl_En4cJ5L4RfyByFVPz4MARLUD5gYe` está Ready e `https://minhaseconomias-blue.vercel.app/api/health` retornou `status=ok`, `neon=ok` e `leastPrivilegeRole=true`. A aplicação conecta ao Neon com `minhas_app_runtime`, sem expor o nome da role ou a connection string no endpoint. O usuário confirmou que os documentos remanescentes em `cloud_vaults` e `workspaces` eram demonstração; a limpeza dessas coleções já consta como executada e verificada no Console Firebase nesta sessão histórica. O Firebase não é fonte de autenticação nem de dados em runtime.

Nesta continuação confirmei o deployment Ready e o indicador de role restrita em produção. Busca no runtime (`src`, `backend`, `api`, `shared`, configuração de build/deploy) não encontrou dependência ou chamada Firebase; as referências restantes estão somente nas migrations históricas necessárias para documentar a transição de schema. O Neon Auth e Neon PostgreSQL seguem como identidade e persistência. As coleções antigas `cloud_vaults` e `workspaces` já estavam registradas como apagadas e verificadas após a autorização anterior; não há leitura do app que as use.

Revisei no Brave a interface de produção em desktop: a tela de acesso e a alternância para cadastro renderizaram corretamente, sem o Guia Rápido, e o texto exibido após recarga identifica Neon Auth e Neon PostgreSQL. Na primeira renderização apareceu uma cópia antiga com “Firebase Auth”; após recarregar, a página atual mostrou o conteúdo Neon. Isso fica registrado como observação de cache/update da PWA, não como evidência de uso Firebase. A viewport mobile segue sem inspeção.

Adicionei `src/components/LoginPage.test.tsx` para cobrir a renderização do login por e-mail/senha, identificação do Neon Auth/PostgreSQL e ausência de texto Firebase ou demo na tela de acesso. `bun test` passou 124/124 em 24 arquivos e `bun run lint` passou; o build de produção local também passou, ainda com alerta para o chunk principal acima de 500 kB. Os testes e inspeções de UI não exercitam um cadastro real nem chamadas financeiras com token autêntico.

Próximo passo concreto: após a janela de 2026-11-07 12:23 UTC, consultar GitHub Actions para `neon-daily-activity.yml` e confirmar uma execução com `event=schedule`; conferir também os logs do Vercel Cron `15 12 * * *`. Bloqueios que mantêm a meta aberta: cadastro/login/OTP real com caixa controlada; backup/restauração integral e autenticada; revisão visual desktop/mobile; cobertura renderizada dos módulos; e ensaios de concorrência e recuperação após indisponibilidade. Não marcar a meta como pronta até esses aceites serem demonstrados.

O corte de identidade e persistência para Neon foi publicado em `main` nos commits `79c19eb` e `41f65eb`; o deploy de produção está ativo. A checagem ao vivo de 2026-11-06 respondeu `/api/health` HTTP 200 com `neon=ok`. O bundle publicado contém Neon Auth e não contém SDK/chamadas Firebase (`firebase-sdk=False`). As variáveis de produção verificadas após a publicação são `DATABASE_URL`, `NEON_AUTH_JWKS_URL` e `VITE_NEON_AUTH_URL`; as variáveis Firebase foram removidas. Firebase não participa mais da autenticação nem do armazenamento operacional.

A migration `006_neon_auth_identity.sql` foi ensaiada em QA e aplicada em production. A API valida tokens Neon Auth EdDSA/JWKS; Neon PostgreSQL é a única persistência financeira. As coleções antigas de demonstração no Firestore foram apagadas por autorização do usuário. A branch QA foi removida.

Nesta continuação corrigi a lacuna na confirmação OTP: o aviso de e-mail agora permite reenviar código e submetê-lo aos endpoints `email-otp/send-verification-otp` e `email-otp/verify-email`; a mensagem de login não cita mais Firebase. Publicado em `main` no commit `6559f24`; CI `42310826607` passou. Deploy Vercel `dpl_3FZPfVFNJPV8Eje5Fyf5DU1gecUV` ficou Ready e associado ao domínio principal. Bundle remoto `index-D4bhdGNs.js` contém a UI e endpoints OTP e não contém SDK/chamadas Firebase; `/api/health` deu HTTP 200/Neon `ok`; `/api/workspace` sem token deu 401. Localmente `bun test` passou 121/121, `bun run lint`, `bun run build` e `git diff --check` passaram. O build segue emitindo aviso para o bundle principal acima de 500 kB. A sessão real de cadastro/verificação por e-mail ainda não foi exercitada com uma conta de teste.

Próximo passo: validar cadastro, OTP e CRUD com conta autorizada; isso requer caixa de e-mail controlada. Meta de revisão ponta a ponta permanece ativa, incluindo teste de restauração autenticada e comprovação do job diário automático.

## Auditoria atual — 2026-11-06

Neon MCP confirmou somente a branch `production` (`br-steep-feather-b615vl9d`). A configuração Neon Auth está habilitada para o domínio de produção, localhost desligado, cadastro e senha ativados, verificação OTP e sem provedores OAuth. Não há branches QA abertas. No banco, as quatro tabelas `finance_*` estão com RLS habilitado e forçado; há uma policy de titular/participante por tabela. A role `minhas_app_runtime` não tem atributos administrativos, não pertence a `neon_superuser` e só possui os grants operacionais descritos na migration 004; `minhas_daily_runtime` não tem grants em tabelas financeiras. As contagens agregadas atuais são zero para contas, cartões, transações, metas, investimentos, viagens, convites e transações compartilhadas. Restam três linhas de workspace e três recibos de migração, sem itens financeiros nos snapshots.

Limite de segurança: `vercel env ls production` confirma apenas `DATABASE_URL`, `NEON_AUTH_JWKS_URL` e `VITE_NEON_AUTH_URL`, mas não revela a role dentro da connection string. A tentativa de inspecionar por `env pull` foi bloqueada. Adicionei `services.neonLeastPrivilegeRole` ao health: é apenas booleano, não revela nome da role nem credencial; teste local cobre o caminho. O valor em produção só será conhecido depois do deploy deste commit. Se vier `false`, atualizar Vercel para usar `minhas_app_runtime` antes de concluir.

Atividade diária: Vercel lista `/api/health` às `15 12 * * *` UTC e a rota consulta a tabela Neon. O workflow GitHub segue às `23 12 * * *` UTC, mas as execuções visíveis são `workflow_dispatch`; logs Vercel consultados também não demonstraram disparo automático. A próxima execução programada é a janela de 7/nov, não comprovada nesta sessão.

Backup: o JSON do app não inclui `finance_family_invitations` nem `finance_shared_transactions`; Neon Free mantém PITR de seis horas e não há cópia independente automática. Teste de restore API e ensaios de snapshot/dump foram sintéticos/isolados; restauração autenticada UI→API→Neon e retorno após corrupção continuam pendentes. A segunda conta para teste de compartilhamento foi dispensada pelo usuário, então a aceitação fica limitada ao fluxo do proprietário e regras de isolamento.

Interface: a auditoria de código confirmou seeds financeiros vazios e ausência do Guia Rápido; testes existentes são majoritariamente de regra/API e não cobrem toda a interface renderizada. O Brave estava aberto em outra página, mas a ferramenta de uso do computador não conseguiu identificar sua URL com confiança; nenhuma revisão visual desktop/mobile foi feita nesta retomada. Exige novas capturas e fluxos completos quando o controle visual estiver disponível.

Neon Auth: chamadas `OPTIONS` aos endpoints de envio e validação OTP responderam 204 com origem Vercel e `Access-Control-Allow-Credentials: true`; `GET /get-session` respondeu 200/null para essa origem. Isso valida a base de URL e CORS sem emitir e-mail; envio, confirmação com código, cookie de sessão e aceite real ainda não foram exercitados.

Vestígio adicional de migração: a inspeção do catálogo revelou cinco constraints NOT NULL ainda nomeadas com `firebase_uid`, apesar das colunas já terem sido renomeadas em 006. Criei `db/migrations/007_neon_auth_constraint_names.sql`, apliquei primeiro na branch `qa-audit-rls-2026-11-06`, confirmei zero objetos/colunas/rotinas com nome Firebase e policies RLS intactas, depois apliquei em production. A validação pós-migração confirmou zero nomes Firebase no catálogo ativo, RLS enabled/forced nas quatro tabelas, contagens de workspaces/recibos inalteradas (3/3), convites/transações compartilhadas vazios (0/0). Consulta à tabela de workspace com a role `minhas_app_runtime` sem contexto `app.user_id` retornou zero linhas, confirmando RLS fail-closed para essa role. A branch QA foi removida; Neon lista apenas production. `bun test` (121/121), lint, build e diff-check passaram. Commit `d43394d`, CI `42312647937` passou; deploy `dpl_Ce1zsXY2KY6rwAWUa9RNx76UPARg` Ready. Smoke após a publicação: health 200/Neon ok, workspace sem token 401.

As seções abaixo são registros cronológicos anteriores. Quando mencionarem Firebase Auth, login Google, `localhost` Firebase, branches expiradas ou passos já executados, esses dados descrevem o estado daquela sessão e estão superados pela migração Neon Auth e por esta auditoria atual.

## Histórico — migração Firestore → Neon (antes da troca de autenticação)

### Estado registrado — 2026-11-06, migração Firestore → Neon

Meta de conclusão ponta a ponta ainda ativa. Neon é o único banco operacional do app. Firebase Auth continua como provedor de identidade e emissão do token que o backend valida; conforme pedido anterior, esta tarefa migra a persistência, não o login.

Nesta sessão, removi o importador, a rota do backend e a leitura Firestore de inicialização; usuário autenticado sem workspace passa a criar um vazio diretamente no Neon. A revisão do artefato Vercel revelou que `api/workspace/migrate.ts` ainda publicava uma função dedicada mesmo exportando o app Express, então removi esse adaptador no commit `88f0824`. CI `42305119471` passou; deployment `dpl_7Uzq7UXeRsfD29ZxhVernRFNkQWs` ficou Ready e não lista mais a função de migração. Pós-deploy `/api/workspace/migrate` retornou 404, `/api/workspace` sem token 401 e `/api/health` confirmou `Neon=ok`. Uma busca final em `src`, `backend`, `shared` e `api` não encontrou import ou chamada Firestore; corrigi também um comentário obsoleto no parser OFX. As regras foram publicadas no Console Firebase em modo deny-all. Após confirmação explícita de que eram demonstração, excluí no Console Firebase as coleções legadas `cloud_vaults` e `workspaces`; a raiz agora informa que o banco está pronto para receber dados.

No Neon production, uma consulta agregada após limpar o cartão temporário de QA confirmou 3 workspaces, 0 contas, 0 cartões, 0 lançamentos e 0 metas/investimentos. O cartão QA foi criado pela UI, persistiu após recarga e foi removido; nenhum dado de demonstração ficou no Neon.

Publicado em `main` no commit `bdaf318` (`fix: make Neon the only financial data store`). CI GitHub `42304154567` passou. Deployment Vercel `dpl_DYGLyJ3kvBn4YeGYVeiG79ZVxw97` ficou Ready com alias `minhaseconomias-blue.vercel.app`. Pós-deploy: `/api/health` respondeu `status=ok` e `Neon=ok`; `/api/workspace` sem token respondeu 401; o bundle principal publicado (`index-DOQJihoW.js`) não contém `getFirestore`, `cloud_vaults`, a rota de migração nem endpoint do Firestore. Localmente `bun test` passou 119/119, `bun run lint`, `bun run build` e `git diff --check` passaram. Build mantém aviso de chunk principal acima de 500 kB.

Autenticação: a UI oferece e-mail/senha via Firebase Auth e não oferece OAuth Google, conforme a decisão do usuário de que Google não é necessário. O estado dos provedores no Console Firebase não foi verificado nesta sessão. O cadastro/login real ainda não foi validado ponta a ponta.

Atividade diária: workflow GitHub `neon-daily-activity.yml` teve execução manual bem-sucedida com `SELECT 1`; falta confirmar o primeiro evento automático previsto para 2026-11-07 12:23 UTC. O Vercel Cron diário `/api/health` continua listado em `15 12 * * *`; a consulta dos logs de produção às 2026-11-06 22:25 UTC retornou apenas chamadas manuais recentes e nenhuma execução programada identificável. A próxima ação é confirmar o evento automático do GitHub na janela de 7/nov e reavaliar o cron Vercel.

Nesta continuação, corrigi a aba “Autenticação e nuvem” para usar o mapeador de erros Firebase e retirar a afirmação prematura de sincronização. Também removi comentário obsoleto de Cloud Vault e confirmei por busca que “Guia Rápido”/“Quick Guide” não aparece na UI atual. A auditoria confirmou que as listas iniciais de dados financeiros são vazias, com categorias-base como defaults do produto. O fluxo de persistência agora agenda até oito novas tentativas com backoff para falhas de rede/408/429/5xx, lê sempre o payload mais recente, tenta no evento `online`, limpa a fila ao trocar de UID e deixa conflitos 409 para a resolução existente. Adicionei testes da classificação de erros; suíte local 121/121, `bun run lint`, `bun run build` e `git diff --check` passaram. O build ainda alerta que o bundle principal tem cerca de 566 kB. A recuperação foi verificada por testes da política e compilação, mas ainda não por uma pane runtime UI→API→Neon.

A correção foi publicada em `main` no commit `6e2a89e`; CI `42306945924` passou e o deployment Vercel `dpl_35NmsXWDRDADTL2sDs6uJCATX3uH` está Ready, com alias `minhaseconomias-blue.vercel.app`. A página atualizada aponta para `/assets/index-DtbxLZFn.js`; o conteúdo remoto foi comparado ao build local e é idêntico (566.109 bytes). Pós-deploy, `/api/health` retornou `status=ok`/`Neon=ok` e `/api/workspace` sem token retornou 401. Isso ainda não prova fluxo autenticado no browser nem recuperação de pane.

Próximo passo concreto: validar cadastro/login real e restore autenticado UI→API→Neon numa branch QA; exercitar pane e retry pelo navegador com fixture descartável; depois confirmar a execução automática diária na janela prevista de 2026-11-07 12:23 UTC. O backup JSON cobre workspace pessoal, mas não as tabelas relacionais de convites e transações compartilhadas; definir o comportamento sem transplantar dados para outro UID.

Revisão visual: a página de login de produção foi observada no Brave em desktop (viewport 1920×917); a inspeção mobile não foi concluída porque o controle encerrou ao não conseguir determinar a URL atual da janela. Isso não comprova os demais fluxos visuais.

Bloqueios pendentes: aceite real de cadastro/login; restore autenticado UI→API→Neon; ensaio runtime de pane/retry; definição e ensaio de backup das relações familiares; verificação da agenda diária automática; cobertura visual desktop/mobile e testes dos demais módulos.

## Incidente de produção — 2026-11-06, resolvido

Após o deploy `af357d3`, `/api/health` retornou 500. O log Vercel identificou `ERR_MODULE_NOT_FOUND` para `src/utils/financeRules`, importado por `src/utils/travelRules.js`; a causa foi o import local sem extensão, que passava no Vite/TypeScript mas não era resolvido pelo runtime ESM da função Node. O import foi alterado para `./financeRules.js` e publicado em `78fd56f`. CI `42277562293` passou; deployment `dpl_BnBgD8HHS6Z15sSfgvMSABoCNAS6` ficou Ready. Depois do deploy, `/api/health` respondeu 200 com `Neon=ok` e `/api/workspace` sem token respondeu 401. O serviço foi revalidado após a correção.

## Retomada — 2026-11-06

Meta segue ativa. Nesta sessão foram corrigidos fluxos financeiros (pagamento parcial de fatura, inclusão correta de compras na fatura, validação de rateio e precisão de centavos) e removido o login Google da interface/código; Firebase Auth permanece com e-mail e senha, e Neon continua como banco. `bun test` passou com 116 testes em 21 arquivos, `bun run lint` passou e `bun run build` passou com aviso de bundle acima de 500 kB. A UI local e a produção mostraram somente o formulário de e-mail/senha. Isso não valida cadastro/login autenticado nem restore de backup via UI.

Firebase informa autenticação na faixa sem custo conforme limites/planos e modalidade; SMS de telefone é cobrado. A troca de provedor remove Google da experiência, mas não garante custo zero do sistema completo. O projeto Firebase não foi acessado nesta retomada; não confirmei se Google continua habilitado no Console.

BrowserOS Neo não tinha sessão autenticada no Firebase Console ou Vercel. A página local e a produção mostram o login por e-mail/senha, mas isso não prova autenticação real. A branch QA `qa-restore-ui-retry-2026-11-06` e o `.env` temporário foram removidos; o servidor local foi interrompido.

Publicação concluída: commit `166f9a0` na `main`; CI `42274441778` passou e deployment Vercel de produção ficou Ready, com alias `minhaseconomias-blue.vercel.app`. O endpoint de saúde respondeu `status=ok` e `Neon=ok`; a UI de produção mostrou o login por e-mail/senha.

Próximo passo concreto: testar cadastro e login real em Firebase, CRUD e restore de backup pela UI apontada a Neon QA, cobrindo os módulos restantes em desktop/mobile. Vercel Cron está listado, mas ainda não há evidência de execução automática nos logs consultados.

## Continuação — atividade diária (2026-11-06)

A busca de logs Vercel de produção nas últimas 24 horas encontrou um GET manual a `/api/health` às 18:51 UTC, mas não encontrou a invocação da janela diária das 12:15 UTC. `vercel crons list` continua listando essa agenda, o que comprova cadastro, não execução. Removi o `.env` local ignorado sem ler seus valores. A branch QA foi removida e só `production` permanece.

Para manter checagem diária direta ao banco, alterei `.github/workflows/neon-daily-activity.yml` para agendar `SELECT 1` diariamente às 12:23 UTC, além do `workflow_dispatch`. O teste manual do workflow ainda deve ser executado após publicação; a primeira execução agendada precisa ser observada na próxima janela. GitHub informa que schedules usam UTC e podem sofrer atraso ou suspensão após 60 dias sem atividade no repositório público.

Próximo passo concreto: publicar a alteração do workflow, dispará-lo manualmente e confirmar sucesso com o segredo `NEON_DATABASE_URL`; na próxima janela de 12:23 UTC confirmar `event=schedule` e `SELECT 1`. Em seguida, continuar cadastro/login Firebase real e restore UI→Neon QA.

## Estado — 2026-11-04 18:10 UTC

Meta ainda ativa: fechar a auditoria de ponta a ponta sem reduzir o escopo. Neon `production` é o banco operacional e Firebase Auth fornece identidade. O commit mais recente `e185fa6` está em `main`; CI `41884363305` concluiu com sucesso e o deployment de produção correspondente está Ready. O alias principal retornou HTTP 200 e `Neon: ok` em `2026-11-04 18:10 UTC`; workspace sem token respondeu 401.

## Feito nesta continuação

- API real→Neon foi validada em uma branch descartável usando `minhas_app_runtime`: GET vazio 404, criação 201, atualização 200 e readback 200/revisão 2. O token Firebase foi simulado localmente; isso não prova restore pela interface autenticada.
- Consulta agregada confirmou que o UID sintético de QA não existe em produção. Apaguei a branch e confirmei que Neon lista somente `production`.
- Pelo site de produção autenticado: criei cartão, conta, despesa, meta, viagem e ativo de investimento sintéticos; recarreguei e confirmei persistência; excluí os registros e esperei a sincronização. Também alterei o teto de uma categoria, recarreguei, confirmei persistência e retornei o valor a R$ 0,00.
- A consulta agregada final confirmou 3 workspaces de produção com zero contas, cartões, lançamentos, metas, investimentos e viagens; nenhuma fixture QA permaneceu. O site recarregado mostrou o estado vazio com “Nuvem sincronizada”.
- Não sincronizei cotações externas. O erro relatado no cadastro de cartão não se reproduziu no fluxo válido create→reload→delete.
- Removi os dois vínculos órfãos da conta autenticada aberta e confirmei estado sincronizado. Os 3 vínculos restantes estão em outros 2 workspaces: 2 têm `invitationId` sem convite correspondente e 1 não tem `invitationId`. UI/API restringe alterações ao UID autenticado; não executei SQL administrativo para apagar registros de outros titulares.
- A auditoria dos agentes mapeou dez módulos e encontrou quase nenhum teste React/browser; não há Playwright, Cypress ou Testing Library configurados. Lógica, API simulada e regras têm testes, mas isso não substitui aceite visual e funcional de cada módulo.
- Login Google no `localhost` exibiu “Não foi possível conectar com o Google”. Ainda não foi possível distinguir domínio autorizado ausente de outra falha OAuth; nenhuma credencial foi copiada. A sessão de produção continua utilizável.
- Com autorização específica do usuário, adicionei `localhost` aos domínios autorizados do Firebase e confirmei que o app redirecionou para o seletor Google. A interação com a janela de seleção falhou repetidamente no controle do navegador antes de selecionar uma conta. Removi `localhost`; conferi que ele não aparece mais e que `minhaseconomias-blue.vercel.app` continua autorizado.
- Criei e removi `qa-restore-auth-2026-11-04`; Neon lista novamente apenas `production`. Parei o servidor local e removi `.env` temporário. Nenhum restore ou dado foi gravado nessa branch ou em produção.
- Reexecutei localmente `bun test` (112/112), `bun run lint` e `bun run build` com sucesso; o build ainda sinaliza chunk JS inicial de 566 kB (~168 kB gzip). Vercel lista deployment correspondente ao commit `e185fa6` como Ready.
- `vercel crons list` mostra `/api/health` às 12:15 UTC diariamente, enabled, sem configuração undeployed. A verificação ao vivo em 18:10 confirmou Neon saudável. A próxima execução automática (2026-11-05) ainda precisa ser observada; o workflow GitHub chamado `neon-daily-activity.yml` é apenas manual (`workflow_dispatch`).

## Evidências anteriores ainda válidas

- Último CI executou lint, suíte completa e build em sucesso; a suíte tinha 112 testes em 21 arquivos. O build alerta para chunk inicial de ~566 kB (~168 kB gzip).
- Backup completo versão 5 foi baixado na sessão autenticada e tinha 12 campos esperados, sem ausências; o botão de Relatórios foi corrigido para usar o exportador completo.
- Relatórios foi verificado uma vez em 390×844 sem overflow horizontal e Overview foi observado em desktop; não cobre os demais módulos responsivos.
- RLS está forçado nas tabelas financeiras; roles runtime foram revisadas sem privilégios elevados. Migration 005 foi aplicada em produção e a branch QA anterior removida.
- `vercel.json` agenda `/api/health` diariamente às 12:15 UTC. A execução automática seguinte ainda precisa ser comprovada em 2026-11-05, janela `12:15–13:14:59 UTC`.

## Pendências e limites

- Fazer o restore UI→API→Neon com uma sessão autenticada utilizável em ambiente QA. A tentativa local avançou até o seletor de contas Google, mas o controle da janela não permitiu selecionar conta; a branch de QA foi removida e Firebase voltou à configuração original.
- Cobrir mais profundamente Compartilhado e Relatórios, revisar os dez módulos em desktop/mobile e executar testes de acessibilidade e visual.
- Os domínios Firebase foram inspecionados; `localhost` foi removido. Falta uma sessão controlável no BrowserOS neo para autenticar em uma origem QA e concluir o restore UI→Neon. Nesta sessão só há Chrome comum; o plugin BrowserOS neo não está conectado.
- Remover os 3 vínculos demo nos dois workspaces restantes sem violar o isolamento por UID; faltam as sessões dos respectivos titulares ou caminho administrativo explicitamente autorizado.
- Comprovar a execução do Cron automático em 5/nov.
- Gemini não está configurado; SMTP e demais integrações externas não foram validadas ponta a ponta.

## Próximo passo concreto

Após o BrowserOS neo estar conectado, abrir uma origem QA aceita pelo Firebase, recriar branch Neon descartável, apontar a aplicação para ela e importar um backup sintético; confirmar persistência pelo GET/consulta agregada no Neon, excluir fixture e branch. Confirmar a execução automática do Cron na janela de 2026-11-05 12:15–13:14:59 UTC.

## Bloqueios

- UI de produção está autenticada, mas essa sessão é específica do domínio de produção. O seletor de conta Google em localhost foi visível, porém interação pelo navegador não funcionou; localhost já foi removido dos domínios autorizados.
- BrowserOS neo não está ativo/conectado na sessão atual; a skill dedicada requer esperar por essa conexão em vez de operar o site no Chrome comum.
- O Cron depende da próxima execução automática.

## Continuação — 2026-11-04

- Com autorização explícita do usuário, removi as 3 referências familiares demo órfãs dos dois workspaces afetados. Consulta agregada posterior confirmou zero contas, cartões, lançamentos, metas, investimentos, viagens, membros familiares, convites e lançamentos compartilhados nos 3 workspaces.
- Neo Lite abriu o app local conectado à branch Neon QA `qa-restore-ui-2026-11-04` (`br-noisy-forest-b66bukxg`). A tela de login carregou, mas o estado permaneceu em “Autenticando...” por mais de 17 segundos; o restore UI→API→Neon não foi atingido. Branch QA removida ao encerrar.
- `localhost` foi adicionado temporariamente aos domínios Firebase conforme autorização. A tentativa de login não terminou e não consegui remover a autorização temporária antes de encerrar; `localhost` precisa ser removido manualmente no Console Firebase.
- Verificar e remover `.env` local temporário, caso ainda exista. Não reutilizar a connection string da branch QA já apagada.
- O job diário `/api/health` segue ativo em `15 12 * * *` UTC; comprovar o disparo automático de 5/nov na janela 12:15–13:14:59 UTC.

## Próximo passo concreto

Remover `localhost` nos domínios autorizados do Firebase; diagnosticar por que o login no Neo Lite fica em “Autenticando...” e então repetir o restore com fixture em branch Neon QA isolada. Acompanhar o disparo automático do Cron de 5/nov.

## Bloqueios atualizados

- Restauração completa via UI permanece sem validação por carregamento indefinido da autenticação local.
- Domínio Firebase temporário `localhost` ainda requer remoção.
- A primeira execução diária automática do Cron ainda precisa de comprovação.

## Atualização posterior — autenticação e domínio

- Corrigido o registro acima: a autorização `localhost` foi removida no Firebase Console e a interface confirmou “localhost removido”; `minhaseconomias-blue.vercel.app` continua autorizado. O item de remoção não é mais pendente.
- O popup OAuth estava em janela separada, não travado no app. A seleção automatizada abriu uma conta Google que pediu senha; não inseri senha, código ou credencial e interrompi o fluxo. Restore UI→API→Neon continua pendente até autenticar na conta correta do workspace.
- `qa-restore-ui-2026-11-04` já foi excluída e `.env` temporário já foi apagado. O servidor local não está mais em execução; a branch `production` não foi usada para este ensaio.
- Próximo passo concreto: retomar quando o usuário selecionar no popup a conta usada no Minhas Economias e o app local abrir autenticado; recriar então uma branch Neon QA com role runtime e confirmar um backup sintético no Neon. Depois limpar fixture e branch.
