# Handoff — Minhas Economias

## Última sessão
**Data:** 2026-11-02
**O que foi feito:**
- Continuidade: o app agora dispara a leitura do workspace no Neon assim que Firebase Auth fica pronto; Firestore é carregado sob demanda para migração legada e espelho/contingência. Foi removido o teste Firestore que rodava na inicialização do módulo.
- Dividi os modais e a busca global em chunks sob demanda e removi e-mail/nome pessoal pré-preenchidos na tela de login. Build local: entrada 568 kB (168 kB gzip) e Firestore 454 kB (137 kB gzip); o alerta Vite de 500 kB continua ativo, sem aumento artificial do limite.
- Removi `unsafe-inline` de `script-src`, movendo o guard de compatibilidade do HMR para `public/vite-websocket-guard.js`; o HTML gerado referencia scripts externos, incluindo o registro PWA externo.
- Importação JSON agora valida versão 1–5, coleções e esquema de categorias antes de aplicar qualquer setter. A mensagem distingue arquivo carregado na sessão de confirmação posterior do Neon.
- Adicionei `docs/BACKUP_AND_RESTORE.md`: diferencia exportação do workspace, espelho Firestore e backup integral do Neon que também inclui tabelas familiares. Nenhum restore de produção foi executado.
- Atualizei o blueprint pela decisão de carregar Neon diretamente e o checklist/CI para não manter contagem fixa de testes.
- Verificações locais executadas após essas mudanças: lint, 78 testes unitários, build e `git diff --check` passaram. Pendente publicação e confirmação de CI/deploy desta revisão.
- Migrei o desenho do compartilhamento familiar para tabelas isoladas no Neon (`finance_family_invitations` e `finance_shared_transactions`). A migration `003_neon_family_sharing.sql` foi aplicada no projeto de produção; verificação agregada mostrou 3 convites (2 aceitos, 1 pendente), 0 espelhos migrados e RLS nas duas tabelas. Os snapshots antigos não foram apagados.
- Substituí os fluxos que liam/escreviam o workspace Firestore de outra pessoa por endpoints autenticados no backend Neon. O espelho Firestore passa a omitir `tx-mirror-*`; a sincronização familiar usa as tabelas separadas.
- Preparei regras owner-only para `cloud_vaults` e adicionei `ownerFirebaseUid` aos snapshots. As regras ainda não foram publicadas; enquanto isso, a regra de leitura sem autenticação continua ativa em produção.
- Corrigi a troca de e-mail do convite para só atualizar a interface depois que a revogação do vínculo anterior confirmar no servidor.
- O deploy `af99151` está Ready e inclui a função `api/family/[...path]`. Após o primeiro deploy, o prefixo `/api/family` respondia 401 mas rotas aninhadas davam 404; a função mais específica resolveu isso. Agora `/api/family/invitations` e `/api/family/shared` respondem 401 sem token, como `/api/workspace`.
- Corrigi os dois erros de tipagem reportados pela Vercel ao remover referências ambientais não usadas do Vite e declarar somente o import de CSS usado pelo app. `bun run lint` e `bun run build` passaram; o deploy `1752571` está Ready e não mostra mais erros de build. Permanecem avisos sobre o chunk principal de 2,59 MB e a configuração Vite.
- Dividi as telas de recursos em chunks sob demanda e troquei `__dirname` no Vite por resolução via `import.meta.url`. `bun run lint` e `bun run build` passam; o chunk de entrada caiu de 2,59 MB (695 kB gzip) para 1,25 MB (350 kB gzip), e o aviso de configuração desapareceu. Continua um aviso porque o chunk inicial ainda passa de 500 kB.
- O deploy `c876d75` está ativo na URL principal e publica o novo chunk `index-C62ftcdX.js` com 1.248.948 bytes. `/api/family/invitations` e `/api/family/shared` continuam respondendo 401 sem token.
- Removi a promoção automática Firestore→Neon baseada apenas em `updatedAt`: quando Neon já tem workspace, ele é a autoridade e o Firestore volta a ser espelho. A tela de conta agora mostra falha de sincronização em vermelho em vez de afirmar que a nuvem continua ativa. `bun run lint` e `bun run build` passaram.
- Corrigi também os erros da escrita inicial/limpeza do espelho: uma falha Firestore agora altera o status para erro mesmo se a leitura do Neon tiver funcionado. `bun run lint` e `bun run build` passaram; o commit `697e05f` está publicado e o status da Vercel concluiu com sucesso.
- Em uma revisão posterior, eliminei a corrida desse status: a carga inicial agora aguarda a escrita do espelho e conserva o estado de erro até o fim da leitura familiar. `bun run lint` e `bun run build` passaram; o commit `8c46ba6` está Ready na Vercel. A página serve `index-CPcasHdQ.js` e as rotas de workspace/compartilhamento continuam exigindo autenticação (401 sem token).
- Implementei um fluxo para conflitos `409`: congela novas tentativas, mostra resumo das duas versões, exige baixar um backup JSON de ambas e deixa o usuário escolher entre gravar a versão local no Neon ou recarregar a versão do Neon. O commit `e3fc388` está ativo e serve `index-Dt-MM7ua.js`; página 200 e APIs 401 sem token. A escolha local mantém o diálogo bloqueando novas edições até o espelho Firestore terminar de gravar. Lint e build passaram. Não rodei teste real de concorrência.
- `bun run lint`, `bun run build` e `git diff --check` passaram após a migração; o build ainda avisa apenas que o chunk inicial está acima de 500 kB.
- Na auditoria do compartilhamento familiar, encontrei uma exposição crítica pendente: as regras de produção permitem `get` em `cloud_vaults` sem autenticação quando o ID tem formato válido; IDs são derivados do e-mail e documentos contêm o workspace financeiro completo. Preparei em `firestore.rules` a restrição do cofre ao dono e acrescentei `ownerFirebaseUid` aos snapshots do app, mas ainda não publiquei as regras. Os novos fluxos familiares usam tabelas Neon separadas; validação com duas contas ainda falta.
- Em 2/nov, o usuário dispensou explicitamente a validação ponta a ponta do compartilhamento com uma segunda conta; os fluxos permanecem não testados nessa configuração.
- Em 2/nov, confirmei o check Vercel `success` para `fadab7d` e HTTP 200 na página de produção. A consulta ao Actions encontrou apenas a execução manual diária, ainda sem execução automática do cron.
- A rota Segurança do banco Firestore abriu, mas o console exibiu somente conteúdo parcial do editor; não obtive confirmação independente das regras completas publicadas. Mantenho a evidência da auditoria anterior: o risco de leitura pública continua até o deploy owner-only. Não alterei regras nesta sessão.
- Auditei a gravação do workspace: encontrei caminho que publicava no Firestore mesmo quando o Neon falhava/rejeitava uma revisão. Agora a cópia Firestore só é atualizada depois da confirmação do Neon; falhas mantêm os dados locais e exibem status de sincronização pendente.
- Corrigi a regra global de CSS que sobrescrevia `max-w-2xl` do formulário de lançamento e o expandia horizontalmente no desktop. A largura agora respeita o limite definido pelo modal e continua responsiva.
- Auditei o workspace Neon da conta autenticada: 1 conta e 4 lançamentos sem marcadores de mock conhecidos. O usuário confirmou que os quatro lançamentos eram dados de demonstração e autorizou sua exclusão.
- Excluí os 4 lançamentos pela interface autenticada da aplicação, mantendo a conta Nubank. O extrato de outubro e novembro mostrou zero lançamentos; a interface confirmou `Nuvem sincronizada - Neon + espelho Firestore`.
- `src/App.tsx` agora filtra registros identificados como mock ao ler snapshots do Firestore ou Neon e sincroniza a limpeza entre ambos. Publicado no commit `77c0cb0`.
- Atualizei os avisos da interface para explicar que Firebase Auth faz login, Neon é PostgreSQL e Firestore continua como espelho de contingência. Incluí a mesma distinção na tela de conta, login e documentação interna. Publicado no commit `edb2024`.
- `bun run lint`, `bun run build` e `git diff --check` passaram. O CI do commit `edb2024` concluiu com sucesso (run #9). A Vercel responde 200 e serve o bundle com os novos textos.
- A aba de navegador que já estava aberta ainda carregava um bundle anterior pelo service worker; atualize a página para ver o texto novo.

## Próximo passo
**Arquivos:** `src/App.tsx`, `backend/app.ts`, `firestore.rules`
**Ação:** aguardar confirmação explícita antes de publicar as regras owner-only. O usuário autorizou encerrar sem teste com segunda conta; os fluxos familiares permanecem sem validação ponta a ponta. Ainda faltam teste real de concorrência/indisponibilidade, procedimento de contingência/restore antes de retirar o espelho e reduzir ou justificar o chunk inicial de 1,25 MB.

## Bloqueios e limites
- A limpeza solicitada foi confirmada pela UI e pelo estado sincronizado; não executei consulta independente SQL pós-recarregamento.
- Firestore continua como espelho/contingência do workspace principal; compartilhamentos familiares novos usam Neon.
- A migration Neon está aplicada e os commits `f457e68` e `af99151` foram publicados. As rotas familiares chegam à autenticação, mas o fluxo real com duas contas ainda não foi validado.
- `.github/workflows/neon-daily-activity.yml` está ativo com cron `15 12 * * *` (09:15 em São Paulo). A execução manual de 2/nov terminou em sucesso; os logs mostram `SELECT 1` retornando uma linha. O workflow foi criado depois do cron de hoje, então a primeira execução automática ainda está pendente.
- As regras Firestore abertas são risco de produção: `cloud_vaults` ainda permite leitura pública até a publicação do patch em `firestore.rules`.
- A resolução 409 foi publicada: compara resumos, exige backup JSON e aguarda o espelho antes de liberar edição. Não foi submetida a uma colisão real entre abas.
- Não foi executado teste de concorrência ou de falha real de conexão nesta sessão.
- As regras owner-only não foram publicadas; mantenho a confirmação explícita pendente para essa alteração de segurança em produção.
