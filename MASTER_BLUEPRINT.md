# Master Blueprint — Minhas Economias

## Visão geral
Aplicativo web de finanças pessoais com autenticação Firebase e armazenamento em nuvem.

## Stack
- Frontend: React, TypeScript e Vite
- Autenticação: Firebase Auth
- Banco principal do workspace: PostgreSQL no Neon, acessado apenas pelo backend
- Firestore: espelho de contingência do workspace; convites e despesas familiares isolados em tabelas Neon
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
| 2026-11-02 | Manter Firebase Auth e mover o workspace para PostgreSQL/Neon via API Express na Vercel | Preservar os logins existentes e restringir acesso ao banco ao servidor |
| 2026-11-02 | Tratar Neon como escrita principal do workspace e atualizar Firestore somente após confirmação do Neon | Evitar que uma gravação concorrente ou rejeitada pelo Neon publique um snapshot local antigo como cópia mais recente |

## Regras do projeto
- Nunca expor `DATABASE_URL` no frontend.
- Toda operação de workspace deve validar o ID token Firebase e restringir a linha ao UID autenticado.
- Tratar a migração financeira como operação idempotente e não substituir silenciosamente dados existentes.
- Manter backup/contingência Firestore até validar integralidade e comportamento em produção.
