# Handoff — Minhas Economias

## Última sessão
**Data:** 2026-11-02
**O que foi feito:**
- Migrei o desenho do compartilhamento familiar para tabelas isoladas no Neon (`finance_family_invitations` e `finance_shared_transactions`). A migration `003_neon_family_sharing.sql` foi aplicada no projeto de produção; verificação agregada mostrou 3 convites (2 aceitos, 1 pendente), 0 espelhos migrados e RLS nas duas tabelas. Os snapshots antigos não foram apagados.
- Substituí os fluxos que liam/escreviam o workspace Firestore de outra pessoa por endpoints autenticados no backend Neon. O espelho Firestore passa a omitir `tx-mirror-*`; a sincronização familiar usa as tabelas separadas.
- Preparei regras owner-only para `cloud_vaults` e adicionei `ownerFirebaseUid` aos snapshots. As regras ainda não foram publicadas; enquanto isso, a regra de leitura sem autenticação continua ativa em produção.
- Corrigi a troca de e-mail do convite para só atualizar a interface depois que a revogação do vínculo anterior confirmar no servidor.
- `bun run lint`, `bun run build` e `git diff --check` passaram após a migração. O build ainda avisa sobre bundle principal acima de 500 kB e um aviso de compatibilidade da configuração Vite.
- Na auditoria do compartilhamento familiar, encontrei uma exposição crítica pendente: as regras de produção permitem `get` em `cloud_vaults` sem autenticação quando o ID tem formato válido; IDs são derivados do e-mail e documentos contêm o workspace financeiro completo. Preparei em `firestore.rules` a restrição do cofre ao dono e acrescentei `ownerFirebaseUid` aos snapshots do app, mas ainda não publiquei as regras. Os fluxos familiares atuais escrevem diretamente nos workspaces de outras pessoas; primeiro é preciso migrar convites e lançamentos compartilhados para registros isolados no Neon, para não quebrar o recurso ao restringir o acesso.
- Auditei a gravação do workspace: encontrei caminho que publicava no Firestore mesmo quando o Neon falhava/rejeitava uma revisão. Agora a cópia Firestore só é atualizada depois da confirmação do Neon; falhas mantêm os dados locais e exibem status de sincronização pendente.
- Corrigi a regra global de CSS que sobrescrevia `max-w-2xl` do formulário de lançamento e o expandia horizontalmente no desktop. A largura agora respeita o limite definido pelo modal e continua responsiva.
- Auditei o workspace Neon da conta autenticada: 1 conta e 4 lançamentos sem marcadores de mock conhecidos. O usuário confirmou que os quatro lançamentos eram dados de demonstração e autorizou sua exclusão.
- Excluí os 4 lançamentos pela interface autenticada da aplicação, mantendo a conta Nubank. O extrato de outubro e novembro mostrou zero lançamentos; a interface confirmou `Nuvem sincronizada - Neon + espelho Firestore`.
- `src/App.tsx` agora filtra registros identificados como mock ao ler snapshots do Firestore ou Neon e sincroniza a limpeza entre ambos. Publicado no commit `77c0cb0`.
- Atualizei os avisos da interface para explicar que Firebase Auth faz login, Neon é PostgreSQL e Firestore continua como espelho de contingência. Incluí a mesma distinção na tela de conta, login e documentação interna. Publicado no commit `edb2024`.
- `bun run lint`, `bun run build` e `git diff --check` passaram. O CI do commit `edb2024` concluiu com sucesso (run #9). A Vercel responde 200 e serve o bundle com os novos textos.
- A aba de navegador que já estava aberta ainda carregava um bundle anterior pelo service worker; atualize a página para ver o texto novo.

## Próximo passo
**Arquivos:** `firestore.rules`, `src/App.tsx`, `backend/app.ts`
**Ação:** depois da confirmação do usuário, publicar as regras owner-only; então validar convite/aceite/recusa/revogação e compartilhamento com duas contas reais. Em seguida verificar conflitos entre abas e recuperação após indisponibilidade do Neon.

## Bloqueios e limites
- A limpeza solicitada foi confirmada pela UI e pelo estado sincronizado; não executei consulta independente SQL pós-recarregamento.
- Firestore continua como espelho/contingência do workspace principal; compartilhamentos familiares novos usam Neon.
- A migration Neon e os endpoints/código foram preparados, mas o deploy de app/API e a validação com duas contas ainda estão pendentes.
- As regras Firestore abertas são risco de produção: `cloud_vaults` ainda permite leitura pública até a publicação do patch em `firestore.rules`.
- Não foi executado teste de concorrência ou de falha real de conexão nesta sessão.
