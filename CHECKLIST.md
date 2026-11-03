# Checklist — Minhas Economias

## Hospedagem
- [x] Criar projeto `minhaseconomias` no plano gratuito Hobby da Vercel.
- [x] Conectar projeto ao repositório `cascaoconcurseiro/Minhas-` e branch `main`.
- [x] Publicar o painel na URL de produção e confirmar que abre.
- [x] Configurar `DATABASE_URL`, `FIREBASE_PROJECT_ID` e `FIREBASE_API_KEY` como variáveis de produção na Vercel.
- [x] Criar o segredo GitHub Actions `NEON_DATABASE_URL` com um papel separado.
- [x] Alinhar o CI ao `bun.lock` e ao Bun 1.4.3 usado pelo projeto.

## Integração Neon
- [x] Criar o projeto Neon em São Paulo e aplicar o schema inicial.
- [x] Criar credencial PostgreSQL restrita para a aplicação e guardá-la como variável secreta na Vercel.
- [x] Publicar a API de workspace e validar as credenciais Firebase no runtime de produção.
- [x] Autorizar o domínio de produção na Firebase Authentication, mantendo Firebase Auth.
- [x] Migrar a conta autenticada do Firestore para Neon; conferir migração, leitura e gravação no site publicado.
- [x] Executar manualmente o workflow GitHub `neon-daily-activity.yml` e confirmar `SELECT 1` com sucesso; essa execução é `workflow_dispatch`, não agenda diária.
- [x] Confirmar o Cron diário ativo na Vercel: `/api/health`, `15 12 * * *` UTC (09:15 America/Sao_Paulo). O primeiro disparo automático segue pendente até a janela programada.
- [x] Auditar o workspace Neon em produção; nenhum registro correspondeu aos marcadores de mock existentes.
- [x] Publicar limpeza automática apenas para marcadores explícitos de mock (`isMock`/`isDemo` e IDs `mock-`/`demo-`/`seed-`); IDs genéricos de banco, cartão e viagem devem ser preservados.
- [x] Deixar explícita na interface a diferença entre Firebase Auth, banco Neon e espelho Firestore.
- [x] Com autorização explícita do usuário, excluir os 4 lançamentos identificados como demonstração; preservar a conta.
- [x] Definir Neon como única persistência operacional do workspace; manter Firestore somente para importação inicial de snapshots legados.
- [x] Impedir gravação no espelho quando o salvamento principal no Neon falha; preservar o estado local e sinalizar a falha.
- [x] Manter Neon como autoridade quando o Firestore já existe; ignorar snapshots Firestore mais recentes em vez de promovê-los automaticamente.
- [x] Mostrar falha de sincronização como erro visível, sem a mensagem enganosa de nuvem ativa.
- [x] Marcar como erro uma falha ao atualizar o espelho Firestore durante a carga inicial ou limpeza.
- [x] Publicar essa correção no commit `697e05f` e confirmar o status Vercel `success`.
- [x] Aguardar a gravação do espelho na carga inicial para evitar que uma falha seja sobrescrita pelo status de sucesso; publicar em `8c46ba6` e confirmar a Vercel `success`.
- [ ] Validar concorrência em várias abas com workspace sintético isolado.
- [x] Criar diálogo para conflitos `409`: comparar resumos, baixar cópia JSON das duas versões e escolher explicitamente a versão local ou a do Neon.
- [x] Publicar o diálogo em `07cedd5`; Vercel `success`, bundle servido, APIs autenticadas (401 sem token).
- [x] Publicar a proteção final que mantém a resolução bloqueada até a conclusão do espelho Firestore (`e3fc388`); conferir bundle 200 e APIs 401 sem token.
- [x] Documentar escopo do JSON do app, limites do espelho Firestore e roteiro de recuperação integral do Neon; o ensaio real de restore continua pendente antes de desativar o espelho.
- [x] Criar estruturas isoladas no Neon para convites e lançamentos familiares; migrar convites e espelhos sem apagar os dados antigos.
- [x] Trocar os fluxos do app/API para ler e gravar compartilhamentos no Neon com verificação de Firebase Auth e RLS.
- [x] Publicar roteamento específico das rotas familiares na Vercel e confirmar que convites/compartilhamentos exigem autenticação (401 sem token).
- [x] Remover referências de tipos Vite não resolvidas pelo compilador de funções Vercel; tipagem local limpa.
- [x] Confirmar no deploy Vercel que os diagnósticos `TS2688` foram resolvidos.
- [x] Carregar telas pesadas sob demanda, reduzindo o chunk inicial para 1,25 MB (350 kB gzip), e remover o aviso de configuração do Vite.
- [x] Publicar a divisão em chunks na Vercel e confirmar o arquivo principal de 1.248.948 bytes.
- [x] Adiar modais e busca; chunk inicial local caiu para 568 kB (168 kB gzip), com Firestore em chunk separado de 454 kB (137 kB gzip). O aviso do limite 500 kB permanece visível e foi justificado pelo tamanho comprimido; não foi aumentado o limite.
- [x] Registrar que o usuário dispensou a validação ponta a ponta do compartilhamento com uma segunda conta.
- [x] Restringir leitura de `cloud_vaults` ao titular autenticado apenas para importação inicial e bloquear lista/criação/atualização/exclusão; regras publicadas no banco nomeado.
- [x] Remover listener, espelho e gravações Firestore do app; workspaces novos são criados diretamente no Neon.
- [x] Remover acesso cruzado entre workspaces Firestore do código cliente; os dados familiares novos ficam em tabelas Neon separadas.

## Interface
- [x] Corrigir largura do modal de novo lançamento no desktop para respeitar o limite visual do componente.
- [x] Remover a seção “Guia Rápido de Ativação” da visão geral.

## Sessão 2026-11-02 — continuidade
- [x] Remover listener e escrita de rotina no Firestore; manter leitura legada do próprio cofre somente quando o Neon retornar 404.
- [x] Adicionar criação Neon idempotente para contas sem snapshot legado e manter conflito sem sobrescrita.
- [x] Publicar regras Firestore com leitura de cofre restrita ao titular e todas as gravações/listagens negadas.
- [x] Publicar commit `969172f` na `main`; GitHub Actions e Vercel concluíram com sucesso.
- [x] Confirmar produção na URL Vercel: página/bundles 200 e APIs workspace, migração e familiares 401 sem token.
- [x] Iniciar leitura Neon diretamente após autenticação; Firestore deixa de ser pré-requisito para carregar o workspace.
- [x] Lazy-load do Firebase Firestore e dos modais/busca; remover e-mail/nome pessoal pré-preenchidos no login.
- [x] Remover script inline e `unsafe-inline` de `script-src`; validar scripts externos no HTML de build.
- [x] Validar formato do backup JSON antes de aplicar estado e esclarecer que sucesso de importação local não confirma gravação no Neon.
- [x] Atualizar passo de testes do CI para não exibir contagem fixa obsoleta.
- [x] Publicar `d1a545d` em `main`; check Vercel `success` e smoke de produção: HTML/CSP/guard/bundle 200 e API protegida 401 sem token.
- [x] Confirmar CI run `41525311897` concluído com sucesso e check Vercel `success` para `1b05c89`.
- [x] Reconsultar histórico do workflow Neon em 2/nov: execução manual bem-sucedida existe; execução automática `schedule` ainda não existe, pois a primeira janela agendada depois da publicação é 3/nov às 09:15 BRT.
- [x] Confirmar que o GitHub Actions não tem mais cron diário; atividade foi migrada para Vercel Cron, cuja primeira execução automática ainda aguarda a janela de 4/nov.
- [ ] Validar recuperação após indisponibilidade real do Neon.
- [x] Ensaiar restore de snapshot da raiz em branch Neon isolada, sem promoção; dump/restore independente permanece pendente.
- [x] Revalidar em 2/nov: `bun test` (78 testes), `bun run lint` e `bun run build` passaram; isso não substitui os ensaios reais pendentes no Neon.

## Sessão 2026-11-03 — auditoria e correções locais
- [x] Corrigir `/api/health` para executar consulta real no Neon, responder `503` sem banco e não afirmar prontidão sem conexão.
- [x] Remover login rápido com senha fixa e retirar nome/e-mail pessoal pré-preenchidos; alinhar validação de senha a 6 caracteres.
- [x] Restringir remoção de dados de demonstração a marcadores/IDs explícitos para preservar registros legítimos com nomes ou descrições coincidentes.
- [x] Manter registros com IDs curtos válidos e testar a remoção somente de IDs de demonstração explícitos.
- [x] Exigir confirmação de duas etapas antes de zerar a base pela tela de relatórios.
- [x] Corrigir saudação pessoal fixa, datas padrão de relatório e virada do mês local.
- [x] Atualizar documentos de segurança/API e indicadores para separar Firebase Auth, estado real do Neon e auditoria local.
- [x] Validar falha isolada do Neon: endpoint local respondeu HTTP 503 e `services.neon=error` com conexão deliberadamente inválida em localhost.
- [x] Consultar produção: `/api/health` respondeu 200, mas o bundle/API publicada ainda usa resposta antiga sem campo `services.neon`; portanto esse 200 não prova conectividade atual com o Neon.
- [x] Publicar `90aeccb` na `main`; CI `41688048038` e implantação Vercel concluíram com sucesso.
- [x] Reconsultar produção após o deploy: `/api/health` retorna `services.neon: ok` e `status: ok` após consulta ao banco; assets publicados incluem a nova auditoria e não incluem o login rápido nem o Guia Rápido.
- [x] Confirmar `/api/workspace`, `/api/workspace/migrate`, `/api/family/invitations` e `/api/family/shared` retornam 401 sem token.
- [x] Executar a checagem Neon manualmente hoje: GitHub Actions run `41688417355` concluiu com sucesso no commit `90aeccb`.
- [x] Revalidar `bun test` (83 testes), `bun run lint`, `bun run build` e `git diff --check`; o build ainda alerta para o chunk principal acima de 500 kB.
- [x] Confirmar em 3/nov que o workflow GitHub não tinha evento `schedule`; foi substituído pelo Vercel Cron. Execução automática Vercel ainda pendente.
- [ ] Validar concorrência real entre abas/workspaces com dados sintéticos isolados.
- [x] Ensaiar snapshot Neon da branch raiz restaurado em nova branch isolada; schema e quatro tabelas operacionais conferidos, produção preservada. O snapshot temporário expira em 4/nov.
- [ ] Ensaiar dump/restore independente e validar indisponibilidade/recuperação real do Neon.
- [ ] Validar fluxos visuais e responsivos completos no navegador; ferramenta BrowserOS Neo não está disponível nesta sessão.
- [x] Publicar a correção de health-check e UI em `main`; confirmar o novo payload `services.neon` na URL de produção.
- [x] Corrigir a exclusão do workspace pessoal para explicar que convites e lançamentos compartilhados em tabelas Neon separadas são preservados; renomear callback sem referência a dados demo.
- [x] Exigir Firebase ID token nas rotas de lembrete SMTP, câmbio ao vivo e sincronização de cotações; encaminhar token pelos fluxos da interface.
- [x] Retornar `502` se Nodemailer falhar, em vez de anunciar um e-mail enviado; atualizar a data de envio agendado somente após sucesso e limitar retentativas automáticas a 15 minutos.
- [x] Testar localmente as três rotas externas sem token: todas responderam 401; testes utilitários confirmam cabeçalhos Bearer em lembretes e cotações.
- [x] Revalidar 83 testes, lint, build e `git diff --check` depois das mudanças acima.
- [x] Publicar as proteções de API/SMTP e cópia da limpeza pessoal em `5b97901`; smoke posterior confirmou que a Vercel inicialmente devolvia 404 nas três rotas novas. Smoke autenticado ainda pendente.
- [x] Publicar `5b97901`; CI `41689898684` e Vercel `success`, mas o smoke descobriu HTTP 404 de plataforma para rotas aninhadas novas de FX, investimentos e lembretes.
- [x] Identificar que a Vercel precisa de adaptadores `api/<grupo>/[...path].ts` dedicados; criar os três adaptadores localmente.
- [x] Publicar adaptadores em `a36f95f`; CI `41690481583` passou. Produção: health 200 com Neon `ok`; POST sem token a `/api/fx/live-rate`, `/api/investments/sync-quotes` e `/api/reminders/send-email` retornou 401 (corrigido o 404).
- [ ] Validar os três fluxos autenticados com sessão Firebase controlada; testar envio apenas com SMTP de teste.


- [x] Corrigir parsing do snapshot Neon: JSON inválido, coleção/objeto no formato errado ou item sem id não é convertido em estado vazio; a tela mantém erro de sync e informa que os dados remotos foram preservados.
- [x] Testar parser do snapshot: bun test (87), bun run lint, bun run build e git diff --check passaram.
- [x] Publicar em `main` no commit `f66e89a`; CI `41691329025` e Vercel `success`. Smoke: homepage 200; bundle `index-DqXs8zaw.js` contém a mensagem de preservação; health 200/Neon `ok`; três rotas de serviço 401 sem token.
- [x] Validar integridade de cota compartilhada: rejeitar valor negativo, não finito, acima do total ou fora do limite seguro em centavos antes de gravar; adicionar testes de borda para 0, centavos, NaN e overflow.
- [x] Serializar sincronização de despesas e revogação familiar bloqueando a linha do convite aceito durante a escrita; ensaio concorrente real continua pendente em branch Neon isolada.
- [x] Publicar a serialização entre sincronizar e revogar em `6789504`; CI `41692724273` e Vercel `success`. Health 200/Neon `ok` e endpoints familiares 401 sem token.
- [x] Ensaiar no Neon isolado as duas ordens SQL sintéticas de sincronização/revogação; final sem espelho. A corrida pela API real com duas sessões autenticadas continua pendente.
- [x] Remover o agendamento do GitHub Actions (histórico só mostrava execuções manuais) e transferir a checagem diária para Vercel Cron; a primeira execução automática Vercel permanece pendente.
- [x] Mover a agenda diária para Cron da Vercel: `GET /api/health` às 12:15 UTC consulta `finance_workspaces`; remover o cron duplicado do GitHub e manter `workflow_dispatch` manual.
- [x] Publicar em `5a701df`; CI `41693460673` e Vercel `success`. `vercel inspect` mostra Cron `/api/health` com schedule `15 12 * * *`; health de produção 200 com Neon `ok`.
- [x] Conectar o Neon MCP e criar a branch isolada `qa-synthetic-2026-11-03` (`br-round-surf-b6rbhdmk`) a partir da produção; comparar schema sem diferenças.
- [x] Criar compute temporário de QA de 0,25 CU, testar duas atualizações SQL concorrentes em tabela sintética e confirmar valor final `2`; suspender o compute após o teste. Nenhuma tabela financeira foi consultada ou alterada.
- [x] Corrigir proteção SMTP contra SSRF: permitir somente hostname DNS público e portas `25/465/587/2525`, rejeitar DNS misto/privado, fixar IP validado, exigir TLS e aplicar timeout de DNS; documentar que credenciais fornecidas pelo usuário podem integrar o snapshot Neon.
- [x] Revalidar `bun test` (93 testes), `bun run lint` e `bun run build`; todos passaram. O build ainda alerta sobre o bundle principal acima de 500 kB.
- [x] Publicar a proteção SMTP em `5f8f6d2`; CI `41694953882` passou e Vercel ficou `READY`. Smoke pós-deploy: health 200 com Neon `ok`; `/api/reminders/send-email` sem token retornou 401.
- [x] Validar localmente por HTTP as rotas de sincronização `/api/family/shared` e revogação com identidade Firebase simulada e pool Neon simulado. A concorrência da API contra Neon real continua pendente.
- [ ] Validar SMTP autenticado com servidor de teste, sem entrega real de e-mail.
- [ ] Observar a primeira execução automática Vercel após a implantação; Hobby executa uma vez por dia com precisão horária.

## Sessão 2026-11-03 — restore e revisão de retenção
- [x] Consultar o projeto Neon atual: plano `free_v3`, branch production primária, `history_retention_seconds=21600` (6h), sem agenda de snapshots e sem snapshots existentes antes do ensaio.
- [x] Criar snapshot manual somente da branch raiz e restaurá-lo como `qa-restore-branch-2026-11-03` (`br-bold-fog-b6cn368o`), sem promoção; confirmar restore concluído, schema sem diferenças e presença das tabelas operacionais; compute suspenso após leitura.
- [x] Configurar expiração do snapshot temporário para `2026-11-04T22:00:00Z`.
- [x] Testar duas ordens concorrentes na tabela sintética `codex_qa_20261103.family_race_fixture`: sync primeiro seguido de revogação termina sem espelho; revogação primeiro impede criação do espelho.
- [x] Corrigir `DATABASE_DOCUMENTATION.md`, `NEON_MIGRATION.md` e `README.md`: atividade diária ocorre no Vercel Cron; GitHub Actions é manual; janela de seis horas não é backup independente de longo prazo.
- [x] Publicar documentação de restore/PITR em `9715661`; CI `41728982501` passou, Vercel `dpl_FA9yTHsdvyQZgv9j3vvzvjFN3L8k` ficou `READY` e `/api/health` respondeu 200 com Neon `ok`.
- [x] Validar localmente `/api/family/shared` por HTTP com identidade Firebase controlada e pool Neon simulado; cobre middleware/API e upsert/revogação, mas não substitui concorrência real pela API nem navegador autenticado.
- [x] Com autorização explícita do usuário, excluir as duas branches QA; confirmar que só `production` permanece e que health de produção segue 200/Neon `ok`.
- [x] Adicionar teste HTTP local para `/api/family/shared` e revogação: 401 sem token; identidade Firebase controlada alcança a rota, grava espelho e a revogação remove o espelho via pool Neon simulado. O teste comprova integração HTTP/middleware/SQL esperado, não concorrência do banco real.
- [x] Incluir o teste HTTP familiar no CI e executar localmente os testes da aplicação/backend, `bun run lint` e `bun run build`; tudo passou. Build ainda alerta para chunk principal acima de 500 kB.

## Sessão 2026-11-03 — verificação de e-mail no compartilhamento
- [x] Exigir e-mail Firebase verificado antes de qualquer endpoint `/api/family`; teste HTTP local comprova 403 e zero consultas para token não verificado, e acesso normal com identidade verificada.
- [x] Adicionar faixa na interface para contas não verificadas, com reenvio do link e atualização do estado; informar no cadastro que a verificação libera o compartilhamento.
- [x] Revalidar suíte completa (94 testes), lint, build e `git diff --check`; todos passaram. Build ainda mostra aviso de chunk principal acima de 500 kB.
- [x] Publicar em `af97e14`; CI GitHub `success`, Vercel `READY` (`dpl_EsqemzuHuCMko1vvCRmXMtYxC5ZH`); alias de produção entrega a faixa nova e health 200 com Neon `ok`.

## Sessão 2026-11-03 — isolamento de API e agenda Vercel
- [x] Confirmar roles da produção por API Neon e catálogo SQL: `minhas_app` e `minhas_daily` continuam com `BYPASSRLS`, `CREATEROLE`, `CREATEDB`, `REPLICATION` e membership em `neon_superuser`; conexão atual não tem grant/admin para corrigir.
- [x] Auditar persistência: Firestore só é lido no fluxo pontual de importação quando Neon responde workspace ausente; gravações operacionais permanecem no Neon. Queries de workspace e compartilhamento usam UID/email autenticados explicitamente.
- [x] Adicionar teste HTTP para isolamento de workspace entre dois UIDs simulados; dono recebe seu estado e outro UID recebe 404, com UID do chamador ligado aos parâmetros SQL.
- [x] Revalidar suíte completa (95 testes), lint, build e `git diff --check`; passou. Build segue com alerta de chunk principal >500 kB.
- [x] Confirmar no Vercel `crons list` o job de produção `/api/health` em `15 12 * * *` UTC e dispará-lo manualmente em `2026-11-03T22:53:50Z`; a invocação foi aceita. A execução programada de 4/nov 12:15 UTC ainda está no futuro.
- [x] Smoke de produção sem token: workspace, migração, rotas familiares, câmbio, investimentos e lembretes retornam 401; bundle publicado não contém Guia Rápido nem `tx-demo`; health responde 200/Neon `ok`.
- [x] Publicar teste/documentação em `025b18b`; GitHub CI `success`, Vercel `dpl_FzMQzZLf3RkVes1PjScumzt2JpAx` `READY`, homepage/health e bundle de produção verificados depois da publicação.
- [ ] Corrigir privilégios das roles Neon com acesso que possa administrar role membership/attributes; não tentar upgrade de plano nem girar credenciais sem avaliar custo e impacto.
- [ ] Fazer backup/dump portátil e restore independente; o Neon Free atual não permite agenda de snapshots automáticos e PITR está em 6h. O snapshot manual de QA existente expira 4/nov 22:00 UTC.
- [ ] Confirmar a primeira execução automática do cron depois de 4/nov 12:15 UTC.
- [ ] Concluir revisão visual desktop/mobile e ações autenticadas que gravam dados; a sessão BrowserOS carregou autenticada, mas screenshot e teste mobile não foram possíveis.

## Sessão 2026-11-03 — inspeção no BrowserOS
- [x] Confirmar que o deploy documental `adf3897` terminou em Vercel `READY` e o status GitHub Vercel ficou `success`; `vercel crons list` continua mostrando `/api/health` em `15 12 * * *`.
- [x] Abrir o site no BrowserOS com sessão autenticada; confirmar a Visão Geral, workspace sem contas/cartões/lançamentos e ausência de indicador de sincronização pendente após carregar.
- [x] Abrir e fechar o formulário de novo lançamento; alternar Despesa, Cartão, Receita e Transferência; conferir labels, datas, seleção de categoria/cartão e mudança dos campos sem submeter/gravar.
- [x] Navegar pelos módulos Lançamentos, Contas, Cartões, Orçamentos, Viagens, Compartilhado, Investimentos, Metas e Relatórios; os controles e estados DOM correspondentes foram carregados sem erro de navegação.
- [ ] Capturar revisão visual desktop/mobile: BrowserOS screenshot foi negado por permissão `activeTab`/`<all_urls>` e não há leitura pixel-level disponível; a fonte mostra modal responsivo `max-w-2xl` com regras `sm:`/`lg:`, mas isso não prova layout mobile renderizado.
- [ ] Confirmar a execução cron automática prevista para `2026-11-04T12:15:00Z`; a chamada manual foi aceita em 3/nov.

## Sessão 2026-11-03 — correção do cadastro do primeiro cartão
- [x] Reproduzir o cadastro no navegador autenticado: ao salvar o primeiro cartão, a tela quebrava e o workspace Neon permanecia sem cartão.
- [x] Localizar violação da ordem de hooks React: um `useMemo` era executado só depois do retorno de estado vazio. Mover o hook para antes do retorno.
- [x] Adicionar regressão verificando que nenhum hook React é declarado abaixo do retorno antecipado de workspace sem cartão.
- [x] Validar o teste de regressão, `bun run lint` e `bun run build`; sem erros. O aviso do bundle acima de 500 kB segue existente.
- [x] Executar suíte completa (`bun test`: 96 testes), `bun run lint` e `bun run build`; todos passaram localmente.
- [x] Publicar correção no commit `37581c0`; GitHub CI `41737033530` concluiu `success` e Vercel `dpl_HpibZX4zWSTkGBtrN2k665nqe7EC` ficou `READY`, com alias de produção.
- [x] Repetir cadastro com sessão autenticada após recarregar o app atualizado: cartão teste apareceu na interface, sincronizou para Neon (revisão `125`) e foi removido pelo próprio fluxo de exclusão.
- [x] Confirmar na produção UI vazia, status `Nuvem sincronizada` e zero cartões de teste no Neon após a exclusão; console do navegador sem erros.
- [x] Fazer smoke autenticado dos módulos Lançamentos, Contas, Orçamentos, Viagens, Compartilhado, Investimentos, Metas e Relatórios; todos carregaram. Alternar Despesa, Cartão, Receita e Transferência no formulário sem criar lançamento.
- [x] Criar e excluir conta sintética com saldo zero e despesa pendente de R$ 1; o extrato mostrou pendência, a exclusão zerou o previsto e o Neon confirmou ambos ausentes.
- [x] Editar o teto de orçamento temporariamente para R$ 100 e restaurá-lo para R$ 0; criar/excluir meta sintética, viagem sem despesas e ativo de renda fixa sem cotação externa.
- [x] Abrir a central de lembretes, auditoria local (`7/7`), configurações e seção de backup sem alterar preferências nem enviar notificações; auditoria informou API/Neon respondendo e Google Finance disponível, Gemini não configurado.
- [x] Consulta agregada após limpeza confirmou zero resíduos de teste em contas, cartões, lançamentos, metas, investimentos e viagens; console sem erros e nuvem sincronizada.
- [ ] Concluir os fluxos ainda não aceitos no navegador: convite/aceite familiar com segunda conta (dispensado anteriormente), e-mail SMTP de teste, cotações externas, restauração de arquivo e operações completas de FX/rateio. SMTP/Gemini não estão configurados; compartilhar o estado real sem segunda conta permanece indisponível para este teste.
- [ ] Fazer inspeção visual mobile e confirmar cron automático na janela de 4/nov 12:15 UTC; screenshot segue bloqueado no BrowserOS e a primeira janela cron ainda é futura.

## Sessão 2026-11-03 — integridade do workspace
- [x] Consultar somente contagens agregadas da branch Neon production: 3 workspaces, 0 contas e 0 lançamentos no total. A leitura não trouxe valores, nomes ou emails.
- [x] Confirmar com o usuário que todas as contas eram demonstrações; portanto, zero contas/lançamentos é o estado esperado e não se deve restaurar conta Nubank nem saldo.
- [x] Identificar risco no sanitizador: IDs genéricos `acc-nubank`, `acc-itau`, `card-*`, `trip-eurotrip` e FITIDs Nubank eram classificados automaticamente como mock, embora possam ser registros reais; remover esses falsos positivos e adicionar regressões.
- [x] Revalidar testes utilitários/backend, `bun run lint` e `bun run build` após a correção do sanitizador; todos passaram, com aviso de chunk principal >500 kB.
- [x] Publicar a correção do sanitizador em `21df8f7`; CI Vercel `success`, deploy `dpl_HRHcWTH9BucsNwezxR2ZH4RNE8jz` `READY`, health 200/Neon `ok`; bundle servido não contém os filtros `acc-nubank`/`NUBANK-SAL-`.
- [ ] Restringir privilégios de `minhas_app` e `minhas_daily`: a consulta encontrou membership em `neon_superuser` e `CREATEROLE`, `CREATEDB`, `BYPASSRLS`, `REPLICATION`; `neon_run_sql` negou tanto `REVOKE neon_superuser FROM minhas_app` quanto `ALTER ROLE ...`. Nenhuma alteração foi aplicada; requer ferramenta/credencial com administração de roles.
- [x] Verificar nas quatro tabelas operacionais que RLS está habilitado/forçado e há policy baseada em `app.firebase_uid`; registrar que as roles com `BYPASSRLS` ainda podem contornar essa proteção.

## Sessão 2026-11-03 — regressão geral e backup/câmbio
- [x] Reexecutar `bun test`: 96 testes passaram em 18 arquivos; inclui parser de backup, regras de viagem/câmbio, conversão, VET, rateio e integridade financeira.
- [x] Reexecutar `bun run lint` e `bun run build`; ambos passaram. O build ainda avisa que o chunk principal excede 500 kB.
- [x] Confirmar deploy de produção `dpl_2pj8gvrFdpf2VHnxCnKepTqSCieu` como `Ready`, alias `minhaseconomias-blue.vercel.app`, e endpoint `/api/health` 200 com Neon `ok`.
- [ ] Validar a restauração completa com arquivo sintético pela interface e confirmar persistência/releitura no Neon; os testes existentes validam o parser/regras, não o fluxo UI→estado→API→Neon.
- [ ] Validar visualmente desktop e mobile; captura BrowserOS permanece sem permissão e não houve leitura de pixels/viewport móvel nesta rodada.
- [ ] Confirmar execução cron automática (não manual) após `2026-11-04T12:15:00Z`.
- [x] Conferir o arquivo `.github/workflows/neon-daily-activity.yml` e o histórico GitHub: workflow manual (`workflow_dispatch`) com `SELECT 1`; separar sua execução `41688417355` do Cron diário Vercel, que permanece agendado mas ainda não disparou automaticamente.
- [x] Acrescentar testes HTTP locais de workspace: revisão 2 salva uma vez e avança para 3; segunda gravação concorrente com revisão 2 recebe `409` e não altera a revisão; erro simulado no banco retorna `503` sem avançar revisão.
- [x] Reexecutar suíte completa (`bun test`: 98 testes), lint e build após ampliar os testes; passou. Os mocks não representam uma corrida concorrente ou pane reais no Neon.

## Sessão 2026-11-03 — pane no carregamento inicial e branch QA Neon
- [x] Identificar que uma falha inicial do Neon deixava a UI financeira disponível após 240 ms, sem carregar cache local, e a gravação inicial podia substituir esse cache por estado vazio.
- [x] Bloquear a área do app até o workspace Neon carregar, mostrar erro com botão de nova tentativa e repetir a carga automaticamente quando o navegador voltar a ficar online.
- [x] Proteger o cache local para que somente seja sobrescrito depois da primeira carga bem-sucedida do Neon.
- [x] Acrescentar regressões locais para tela bloqueante, ação de retry, evento `online` e proteção do cache; suíte completa `bun test` passou com 100 testes, lint e build passaram.
- [x] Com autorização do usuário, criar branch QA Neon `br-rough-smoke-b6fhm3lh` a partir de `production`; manter os testes apenas nessa branch.
- [x] Na branch QA, inserir workspace sintético com papel `minhas_app`, gravar transação sintética como restore de payload, avançar revisão de 1 para 2, confirmar gravação obsoleta com revisão 1 sem update e ler payload de volta.
- [x] Disparar duas atualizações Neon reais em paralelo com expectedRevision 2; exatamente uma avançou para revisão 3 e a outra retornou zero linhas, sem sobrescrever o payload restaurado.
- [ ] Simular perda da API no navegador após publicar a correção; confirmar erro bloqueante, tentativa de retry e reabertura do workspace depois de restabelecer a rede.
- [x] Publicar `583d91a` no `main`; Vercel deployment `dpl_DHiUDhgAvLADaGY652nudZdTFcSu` ficou `Ready` e recebeu o alias de produção.
- [x] Recarregar o site na sessão autenticada e confirmar workspace vazio carregado normalmente pelo Neon, sem tela de carregamento bloqueada.
- [x] Excluir a branch QA após os ensaios e listar branches; só `production` permanece.
- [ ] Validar restore UI→API→Neon ponta a ponta; o ensaio atual cobre frontend por regressão local e contrato/revisão do DB por Neon SQL, mas não a integração autenticada browser/API contra a branch.
- [x] Inspecionar DOM/layout renderizado em viewport desktop 1920×921 e móvel 390×844; dashboard e formulário não apresentaram overflow horizontal; no modal, scroller interno de 504 px percorreu 1.293 px até o rodapé, e overlay `z-50` permanece acima da navegação móvel `z-40`.
- [ ] Capturar e revisar imagem pixel-level do desktop/mobile; captura via CDP/BrowserOS expirou, portanto medições DOM não encerram a revisão visual.


