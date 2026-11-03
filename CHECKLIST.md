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
- [x] Executar manualmente o workflow diário e confirmar `SELECT 1` com sucesso.
- [x] Confirmar workflow ativo com agendamento diário às 09:15 (America/Sao_Paulo); a primeira execução automática está pendente porque o workflow entrou na branch após o cron de hoje.
- [x] Auditar o workspace Neon em produção; nenhum registro correspondeu aos marcadores de mock existentes.
- [x] Publicar a limpeza de registros mock reconhecidos ao carregar snapshots remotos.
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
- [ ] Confirmar execução automática diária do GitHub Actions; execução manual já foi validada.
- [ ] Validar recuperação após indisponibilidade real do Neon.
- [ ] Ensaiar restauração integral do Neon em ambiente isolado.
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
- [ ] Confirmar execução automática diária: consulta em 3/nov às 14:47 BRT encontrou somente o run manual de 2/nov; não há evento `schedule` comprovado.
- [ ] Validar concorrência real entre abas/workspaces com dados sintéticos isolados.
- [ ] Ensaiar restore integral em branch Neon isolada e validar indisponibilidade/recuperação com banco controlado.
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
- [ ] Ensaiar a corrida entre sincronizar e revogar com duas sessões em branch Neon isolada.
- [x] Remover o agendamento do GitHub Actions (histórico só mostrava execuções manuais) e transferir a checagem diária para Vercel Cron; a primeira execução automática Vercel permanece pendente.
- [x] Mover a agenda diária para Cron da Vercel: `GET /api/health` às 12:15 UTC consulta `finance_workspaces`; remover o cron duplicado do GitHub e manter `workflow_dispatch` manual.
- [x] Publicar em `5a701df`; CI `41693460673` e Vercel `success`. `vercel inspect` mostra Cron `/api/health` com schedule `15 12 * * *`; health de produção 200 com Neon `ok`.
- [x] Conectar o Neon MCP e criar a branch isolada `qa-synthetic-2026-11-03` (`br-round-surf-b6rbhdmk`) a partir da produção; comparar schema sem diferenças.
- [x] Criar compute temporário de QA de 0,25 CU, testar duas atualizações SQL concorrentes em tabela sintética e confirmar valor final `2`; suspender o compute após o teste. Nenhuma tabela financeira foi consultada ou alterada.
- [x] Corrigir proteção SMTP contra SSRF: permitir somente hostname DNS público e portas `25/465/587/2525`, rejeitar DNS misto/privado, fixar IP validado, exigir TLS e aplicar timeout de DNS; documentar que credenciais fornecidas pelo usuário podem integrar o snapshot Neon.
- [x] Revalidar `bun test` (93 testes), `bun run lint` e `bun run build`; todos passaram. O build ainda alerta sobre o bundle principal acima de 500 kB.
- [x] Publicar a proteção SMTP em `5f8f6d2`; CI `41694953882` passou. A implantação Vercel de produção foi iniciada e ainda está em build nesta atualização.
- [ ] Validar revogação e sincronização familiar concorrentes usando a branch isolada; o incremento SQL sintético não cobre essa lógica de API.
- [ ] Validar SMTP autenticado com servidor de teste, sem entrega real de e-mail.
- [ ] Observar a primeira execução automática Vercel após a implantação; Hobby executa uma vez por dia com precisão horária.


