# Master Blueprint — Minhas Economias

## Visão geral
Aplicativo web de finanças pessoais e familiares; Firebase Auth fornece identidade e Neon PostgreSQL armazena os dados operacionais do app.

## Stack
- Frontend: React, TypeScript e Vite
- Autenticação: Firebase Auth (e-mail e senha; verificação de e-mail por link)
- Banco de dados operacional único: PostgreSQL no Neon, acessado apenas pelo backend
- Firebase Auth mantém credenciais e sessões; Firebase Firestore e Storage não são usados pelo runtime
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
| 2026-11-07 | Usar Firebase Auth somente para identidade e Neon PostgreSQL para toda persistência operacional | Manter o login Firebase sem devolver dados financeiros ao Firestore |
| 2026-11-07 | Derivar o workspace do UID estável Firebase, nunca do e-mail | Preservar associações UID e permitir mudança de e-mail sem trocar o titular |
| 2026-11-07 | Validar o ID token Firebase contra o projeto esperado e aplicar o UID verificado às políticas RLS Neon | Impedir que o cliente escolha a identidade usada em consultas ou gravações |
| 2026-11-06 (superada em 2026-11-07) | Neon Auth foi adotado temporariamente para identidade | A arquitetura foi revertida para Firebase Auth; variáveis Neon Auth foram removidas da Vercel |

## Regras do projeto
- Nunca expor `DATABASE_URL` no frontend.
- Toda operação de workspace deve validar o ID token Firebase e restringir a linha Neon ao UID autenticado.
- Tratar a migração financeira como operação idempotente e não substituir silenciosamente dados existentes.
- Não enviar credenciais PostgreSQL ao frontend; o ID token Firebase identifica o titular nas rotas do backend.
- Não inicializar nem usar Firestore ou Firebase Storage no runtime.
- A existência de `schedule` no workflow ou Vercel config não prova execução diária; exige evento automático comprovado.
