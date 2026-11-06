# Master Blueprint — Minhas Economias

## Visão geral
Aplicativo web de finanças pessoais com autenticação e armazenamento no Neon.

## Stack
- Frontend: React, TypeScript e Vite
- Autenticação: Neon Auth (Managed Better Auth, e-mail e senha)
- Banco de dados operacional único: PostgreSQL no Neon, acessado apenas pelo backend
- Identidades, sessões e dados financeiros ficam no projeto Neon
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
└── .github/workflows/      # Rotina diária planejada para o Neon
```

## Decisões de arquitetura
| Data | Decisão | Motivo |
|------|---------|--------|
| 2026-11-06 | Usar Neon Auth para identidade e Neon PostgreSQL para todos os dados do app | Eliminar dependência operacional do Firebase; autenticação e dados ficam no mesmo provedor |
| 2026-11-06 | Derivar o workspace do ID imutável do usuário Neon Auth; nunca do e-mail | Evitar colisões e preservar a identidade se o e-mail mudar |
| 2026-11-06 | Validar JWT Neon Auth por JWKS na API e aplicar o ID autenticado nas políticas RLS | Impedir que o cliente escolha a identidade usada em consultas ou gravações |

## Regras do projeto
- Nunca expor `DATABASE_URL` no frontend.
- Toda operação de workspace deve validar o JWT Neon Auth e restringir a linha ao ID autenticado.
- Tratar a migração financeira como operação idempotente e não substituir silenciosamente dados existentes.
- Não enviar credenciais PostgreSQL ao frontend; o JWT Neon Auth identifica o titular nas rotas do backend.
- Contas do provedor anterior não transferem senha; após o corte, usuários precisam criar nova conta Neon Auth.
