# Handoff — Minhas Economias

## Estado atual — 2026-11-06, migração Firestore → Neon

Meta de conclusão ponta a ponta ainda ativa. Neon é o único banco operacional do app. Firebase Auth continua como provedor de identidade e emissão do token que o backend valida; conforme pedido anterior, esta tarefa migra a persistência, não o login.

Nesta sessão, removi o importador, a rota do backend e a leitura Firestore de inicialização; usuário autenticado sem workspace passa a criar um vazio diretamente no Neon. A revisão do artefato Vercel revelou que `api/workspace/migrate.ts` ainda publicava uma função dedicada mesmo exportando o app Express, então removi esse adaptador no commit `88f0824`. CI `42305119471` passou; deployment `dpl_7Uzq7UXeRsfD29ZxhVernRFNkQWs` ficou Ready e não lista mais a função de migração. Pós-deploy `/api/workspace/migrate` retornou 404, `/api/workspace` sem token 401 e `/api/health` confirmou `Neon=ok`. Nenhum código de consulta Firestore permanece no fluxo/bundle do cliente. As regras foram publicadas no Console Firebase em modo deny-all. Ainda há documentos legados em `cloud_vaults` e `workspaces`; o app não os acessa e eles não foram copiados nem apagados porque a propriedade/conteúdo dos registros não foi confirmada.

No Neon production, uma consulta agregada após limpar o cartão temporário de QA confirmou 3 workspaces, 0 contas, 0 cartões, 0 lançamentos e 0 metas/investimentos. O cartão QA foi criado pela UI, persistiu após recarga e foi removido; nenhum dado de demonstração ficou no Neon.

Publicado em `main` no commit `bdaf318` (`fix: make Neon the only financial data store`). CI GitHub `42304154567` passou. Deployment Vercel `dpl_DYGLyJ3kvBn4YeGYVeiG79ZVxw97` ficou Ready com alias `minhaseconomias-blue.vercel.app`. Pós-deploy: `/api/health` respondeu `status=ok` e `Neon=ok`; `/api/workspace` sem token respondeu 401; o bundle principal publicado (`index-DOQJihoW.js`) não contém `getFirestore`, `cloud_vaults`, a rota de migração nem endpoint do Firestore. Localmente `bun test` passou 119/119, `bun run lint`, `bun run build` e `git diff --check` passaram. Build mantém aviso de chunk principal acima de 500 kB.

Autenticação: Email/Password foi habilitado no Console Firebase. Google continua habilitado porque as três identidades existentes são Google-only e desabilitá-lo sem conversão as bloquearia. O cadastro Firebase ainda não foi validado ponta a ponta.

Atividade diária: workflow GitHub `neon-daily-activity.yml` teve execução manual bem-sucedida com `SELECT 1`; falta confirmar o primeiro evento automático previsto para 2026-11-07 12:23 UTC. O Vercel Cron diário `/api/health` continua listado em `15 12 * * *`; a consulta dos logs de produção às 2026-11-06 22:25 UTC retornou apenas chamadas manuais recentes e nenhuma execução programada identificável. A próxima ação é confirmar o evento automático do GitHub na janela de 7/nov e reavaliar o cron Vercel.

Próximo passo concreto: confirmar com os titulares se os documentos antigos do Firestore são todos demonstração e podem ser apagados, ou se algum precisa de exportação/importação individual; então executar a ação autorizada sem abrir acesso Firestore no app. Depois validar cadastro/login real e restore autenticado UI→API→Neon.

Revisão visual: a página de login de produção foi observada no Brave em desktop (viewport 1920×917); a inspeção mobile não foi concluída porque o controle encerrou ao não conseguir determinar a URL atual da janela. Isso não comprova os demais fluxos visuais.

Bloqueios pendentes: decisão segura sobre dados legados Firestore de múltiplos titulares; aceite real de cadastro/login; restore autenticado UI→API→Neon; verificação da agenda diária automática; cobertura visual desktop/mobile e testes dos demais módulos.

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
