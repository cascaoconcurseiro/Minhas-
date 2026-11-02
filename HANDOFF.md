# Handoff — Minhas Economias

## Última sessão
**Data:** 2026-11-02
**O que foi feito:**
- Na auditoria do compartilhamento familiar, encontrei uma exposição crítica pendente: `firestore.rules` permite `get` em `cloud_vaults` sem autenticação quando o ID tem formato válido; IDs são derivados do e-mail e documentos contêm o workspace financeiro completo. Ainda não alterei nem publiquei as regras porque os fluxos atuais de convite e compartilhamento escrevem diretamente nos workspaces de outras pessoas; endurecer só as regras quebraria esse recurso. Próximo corte de segurança é mover convites e lançamentos espelhados para registros isolados e então restringir os cofres ao proprietário.
- Auditei a gravação do workspace: encontrei caminho que publicava no Firestore mesmo quando o Neon falhava/rejeitava uma revisão. Agora a cópia Firestore só é atualizada depois da confirmação do Neon; falhas mantêm os dados locais e exibem status de sincronização pendente.
- Corrigi a regra global de CSS que sobrescrevia `max-w-2xl` do formulário de lançamento e o expandia horizontalmente no desktop. A largura agora respeita o limite definido pelo modal e continua responsiva.
- Auditei o workspace Neon da conta autenticada: 1 conta e 4 lançamentos sem marcadores de mock conhecidos. O usuário confirmou que os quatro lançamentos eram dados de demonstração e autorizou sua exclusão.
- Excluí os 4 lançamentos pela interface autenticada da aplicação, mantendo a conta Nubank. O extrato de outubro e novembro mostrou zero lançamentos; a interface confirmou `Nuvem sincronizada - Neon + espelho Firestore`.
- `src/App.tsx` agora filtra registros identificados como mock ao ler snapshots do Firestore ou Neon e sincroniza a limpeza entre ambos. Publicado no commit `77c0cb0`.
- Atualizei os avisos da interface para explicar que Firebase Auth faz login, Neon é PostgreSQL e Firestore continua como espelho de contingência. Incluí a mesma distinção na tela de conta, login e documentação interna. Publicado no commit `edb2024`.
- `bun run lint`, `bun run build` e `git diff --check` passaram. O CI do commit `edb2024` concluiu com sucesso (run #9). A Vercel responde 200 e serve o bundle com os novos textos.
- A aba de navegador que já estava aberta ainda carregava um bundle anterior pelo service worker; atualize a página para ver o texto novo.

## Próximo passo
**Arquivos:** `src/App.tsx` (leitura do workspace), `src/utils/travelRules.ts` (marcadores de mock)
**Ação:** primeiro implementar dados de convite e transações familiares isolados no Neon e remover acessos cruzados ao workspace Firestore; publicar regras que autorizem somente o dono do cofre. Depois validar duas abas concorrentes e recuperação do Neon sem sobrescrita silenciosa.

## Bloqueios e limites
- A limpeza solicitada foi confirmada pela UI e pelo estado sincronizado; não executei consulta independente SQL pós-recarregamento.
- Firestore continua como espelho/contingência e para compatibilidade com o compartilhamento familiar.
- Não foi executado teste de concorrência ou falha real de conexão nesta sessão; a migração do compartilhamento familiar ainda depende de definir permissões entre contas.
- As regras Firestore abertas são um risco de produção não corrigido ainda; revisar/deployar `firestore.rules` assim que a migração segura do compartilhamento estiver pronta.
