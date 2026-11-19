# Master Blueprint — Minhas Economias

## Visão geral
Aplicativo web de finanças pessoais e familiares; login próprio (e-mail e senha, tabela app_users no Neon) fornece identidade e Neon PostgreSQL armazena todos os dados do app. Sem Firebase.

## Stack
- Frontend: React, TypeScript e Vite
- Autenticação: login próprio no backend (senha com hash scrypt em app_users; sessão assinada HS256 de 30 dias; limite de tentativas; logout revoga tokens via token_version). Sem verificação de e-mail: família só por convite dentro do sistema
- Banco de dados operacional único: PostgreSQL no Neon, acessado apenas pelo backend
- Firebase foi removido por completo (código, dependência e configuração)
- Workspaces, convites, lançamentos compartilhados e dados financeiros ficam no Neon
- Backend: Express, publicado como função na Vercel
- Hospedagem: Vercel Hobby, conectada ao GitHub

## Estrutura relevante
```
/
├── api/                    # Entrada das funções da Vercel
├── backend/                # Rotas Express e integração PostgreSQL
├── db/migrations/          # Migrações SQL do Neon (001–011)
├── shared/                 # Código usado por front e servidor
├── src/
│   ├── components/         # Telas, uma pasta por área (layout, ui, overview, transactions, accounts, cards, budgets, receivables, family, trips, investments, reports, settings, auth)
│   ├── domain/             # Regras de negócio puras (finance, cards, budgets, receivables, family, trips, investments, reminders)
│   ├── services/           # Dados: workspace (cópia local, payload, backup) e import-export (OFX/CSV/PDF)
│   ├── lib/ · hooks/ · pwa/ · utils/ · types/ · test-utils/
├── docs/                   # Documentação oficial (índice em docs/README.md): produto, tecnico, operacao, processo, arquivo
├── scripts/                # QA com PostgreSQL real e verificação obrigatória do HANDOFF
└── .github/workflows/      # CI (inclui check:handoff), atividade diária e backup cifrado do Neon
```
Mapa detalhado e regras de onde colocar código: `docs/tecnico/estrutura-do-codigo.md`.

## Decisões de arquitetura
| Data | Decisão | Motivo |
|------|---------|--------|
| 2026-11-16 | O servidor projeta os espelhos de compartilhamento a partir da revisão de workspace já confirmada no Neon; a revisão aceita também reconcilia remoções e impede que uma gravação atrasada ressuscite itens excluídos | Manter o workspace como fonte de verdade e tornar a sincronização coerente entre cliente antigo, cliente atual e restauração de backup, sem um segundo estado editável pelo cliente |
| 2026-11-15 | Código organizado por áreas (`components/` em pastas, `src/domain/` para regras puras, `src/services/` para dados); `domain` não importa telas nem clientes de API; documentação refeita em `docs/` (produto, técnico, operação, processo, arquivo) e HANDOFF/CHECKLIST com modelo fixo e verificação obrigatória em CI (`scripts/check-handoff.ts`) | Pedido do dono: organização de nível sênior, documentação completa e handoff sempre preenchido para saber onde estamos, o que mudou e o que falta |
| 2026-11-14 | Dinheiro de terceiros (valores a receber e gastos só de acompanhantes) fica fora do resultado pessoal (`isOutsidePersonalResult`) mas conta em saldo, fatura e limite; o patrimônio inclui o a receber em aberto como ativo | A fatura do cartão adicional entra na dívida do cartão e não pode virar despesa nem perda de patrimônio |
| 2026-11-14 | Forma de pagamento, categoria e conta não vêm pré-selecionadas quando há mais de uma opção; sincronização silenciosa (primeiro a gravar vence) | Evitar lançamentos salvos com opção errada e remover avisos de sincronização |
| 2026-11-12 | Documentação (README, security_spec, docs/*, `.env.example`) reescrita para o login próprio no Neon; variáveis do servidor: `DATABASE_URL`, `AUTH_SESSION_SECRET` (opcional, derivada de `DATABASE_URL` se ausente), `CRON_SECRET`, `GEMINI_API_KEY` (opcional) | Os documentos ainda descreviam Firebase e ID tokens, removidos em 2026-11-08 |
| 2026-11-12 | Saldo total, investimentos e patrimônio partem da posição de hoje (`calculateCurrentPosition`); avisos usam só a data de hoje. O app abre na hora com a última versão salva no aparelho (`workspaceCache.ts`, somente leitura) e o Neon, que segue sendo a única fonte, a substitui em silêncio; nada é gravado no Neon nem na cópia local antes de o Neon ser lido, e a cópia é apagada ao sair da conta | O mês navegado não pode alterar patrimônio nem sumir com atrasos; abrir instantaneamente sem tela de carregamento, como os grandes apps, sem criar uma segunda fonte de verdade |
| 2026-11-11 | Separar dados de compra compartilhada de recibos bancários locais em `sharedSettlementReceiptsJson` no workspace do titular | Espelhos são atualizados pelo servidor; conta/grupo/status da baixa local precisam sobreviver ao reload sem vazar identidade bancária para outro usuário. Campo JSON opcional, sem migration SQL |
| 2026-11-11 | Centralizar regras monetárias em `financeRules.ts` e seleção/resumo/liquidação/reabertura de compartilhamentos em `sharedFinanceRules.ts`; App e telas consomem essas funções | Evitar filtros, somas e cascatas divergentes entre tela e gravação. Cada novo acerto recebe `sharedSettlementId` no JSON do workspace, incluindo compensações de saldo zero; sem migration SQL |
| 2026-11-07 (superada em 2026-11-08) | Usar Firebase Auth somente para identidade e Neon PostgreSQL para toda persistência operacional | Manter o login Firebase sem devolver dados financeiros ao Firestore |
| 2026-11-07 | Derivar o workspace do UID estável Firebase, nunca do e-mail | Preservar associações UID e permitir mudança de e-mail sem trocar o titular |
| 2026-11-07 (superada em 2026-11-08) | Validar o ID token Firebase contra o projeto esperado e aplicar o UID verificado às políticas RLS Neon | Impedir que o cliente escolha a identidade usada em consultas ou gravações |
| 2026-11-06 (superada em 2026-11-07) | Neon Auth foi adotado temporariamente para identidade | A arquitetura foi revertida para Firebase Auth; variáveis Neon Auth foram removidas da Vercel |
| 2026-11-08 | Trocar Firebase Auth por login próprio no Neon (tabela app_users, sessão HS256 em AUTH_SESSION_SECRET) | Pedido do dono: não ter mais nada no Firebase; só há usuários de teste, sem migração de contas |

## Regras do projeto
- Nunca expor `DATABASE_URL` no frontend.
- Toda operação de workspace deve validar a sessão própria e sua versão no banco, restringindo a linha Neon ao ID de usuário autenticado.
- O servidor deriva os espelhos familiares do workspace confirmado e reconcilia exclusões na mesma revisão; o marcador da projeção preserva compatibilidade com clientes antigos.
- Tratar a migração financeira como operação idempotente e não substituir silenciosamente dados existentes.
- Não enviar credenciais PostgreSQL ao frontend; o token de sessão próprio (HS256) identifica o titular nas rotas do backend.
- Firebase não existe mais no projeto: não reintroduzir Auth, Firestore ou Storage.
- Toda entrega que muda código atualiza o `HANDOFF.md` (barrado pelo CI: `bun run check:handoff`) e, se a regra mudou, `docs/produto/regras-de-negocio.md`.
- A existência de `schedule` no workflow ou Vercel config não prova execução diária; exige evento automático comprovado.
