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
├── db/migrations/          # Migrações SQL do Neon
├── src/                    # Aplicação React
├── docs/                   # Arquitetura e plano de migração
└── .github/workflows/      # Atividade diária e backup cifrado; schedule precisa de prova de execução
```

## Decisões de arquitetura
| Data | Decisão | Motivo |
|------|---------|--------|
| 2026-11-12 | Saldo total, investimentos e patrimônio partem da posição de hoje (`calculateCurrentPosition`); avisos usam só a data de hoje; Neon é a única fonte (sem cópia financeira em localStorage) | O mês navegado não pode alterar patrimônio nem sumir com atrasos; evitar cópia duplicada de dados financeiros no navegador |
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
- Tratar a migração financeira como operação idempotente e não substituir silenciosamente dados existentes.
- Não enviar credenciais PostgreSQL ao frontend; o ID token Firebase identifica o titular nas rotas do backend.
- Não inicializar nem usar Firestore ou Firebase Storage no runtime.
- A existência de `schedule` no workflow ou Vercel config não prova execução diária; exige evento automático comprovado.
