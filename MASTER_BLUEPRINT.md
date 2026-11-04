# Master Blueprint — Minhas Economias

## Visão geral
Aplicativo web de finanças pessoais com autenticação Firebase e armazenamento em nuvem.

## Stack
- Frontend: React, TypeScript e Vite
- Autenticação: Firebase Auth
- Banco de dados operacional único: PostgreSQL no Neon, acessado apenas pelo backend
- Firebase: Auth; Firestore apenas como origem de leitura única para importação de snapshots legados
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
| 2026-11-04 | Identificar e localizar o workspace por uma chave estável derivada do UID Firebase, nunca pelo e-mail mutável | Evitar colisões de normalização e perda aparente de acesso quando o titular troca de e-mail |
| 2026-11-02 | Tratar Neon como escrita principal do workspace e atualizar Firestore somente após confirmação do Neon | Evitar que uma gravação concorrente ou rejeitada pelo Neon publique um snapshot local antigo como cópia mais recente |
| 2026-11-02 | Iniciar a leitura do workspace diretamente no Neon após Firebase Auth; consultar Firestore apenas para migração inicial e como espelho/contingência | A autoridade e a carga principal não podem depender do listener Firestore estar disponível |
| 2026-11-02 | Usar Neon como persistência exclusiva; remover gravações, listener e contingência Firestore | Evitar dois bancos operacionais divergentes; Firebase permanece apenas como provedor de identidade |
| 2026-11-02 | Preservar somente importação inicial do snapshot próprio e negar qualquer gravação/listagem no Firestore | Contas ainda não migradas preservam seus dados enquanto Neon segue como persistência operacional |

## Regras do projeto
- Nunca expor `DATABASE_URL` no frontend.
- Toda operação de workspace deve validar o ID token Firebase e restringir a linha ao UID autenticado.
- Tratar a migração financeira como operação idempotente e não substituir silenciosamente dados existentes.
- Não enviar credenciais Neon ao frontend; o ID token Firebase identifica o titular nas rotas do backend.
