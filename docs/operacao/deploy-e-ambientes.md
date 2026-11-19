# Deploy e ambientes

## Onde roda
| Peça | Serviço | Observação |
|---|---|---|
| Site (PWA) e API | **Vercel** (plano Hobby), projeto `minhaseconomias` | Cada push em `main` publica em produção |
| Banco | **Neon** PostgreSQL (plano Free), projeto `minhas-economias-br`, região `aws-sa-east-1` | Autosuspend ligado; janela de recuperação de 6 h |
| Código | GitHub `cascaoconcurseiro/Minhas-` | Branch de produção: `main` |

## Variáveis de ambiente (servidor; Vercel e `.env` local)
| Variável | Obrigatória | Função |
|---|---|---|
| `DATABASE_URL` | Sim | Conexão Neon (role de runtime restrita). Nunca no frontend |
| `AUTH_SESSION_SECRET` | Recomendada | Assina sessões (mín. 32 caracteres). Se ausente, é derivada de `DATABASE_URL` |
| `CRON_SECRET` | Sim | Protege `GET /api/readiness` (a Vercel Cron envia como Bearer) |
| `PASSKEY_RP_ID` e `PASSKEY_ORIGIN` | Não | Domínio e endereço em que o Face ID vale. Sem elas o servidor usa o endereço do próprio pedido; defina as duas se o site responder por mais de um endereço (a passkey fica presa ao domínio) |
| `GEMINI_API_KEY` | Opcional | Câmbio ao vivo e fallback de cotações internacionais |

Segredos do GitHub Actions: `NEON_DATABASE_URL` (atividade diária), `NEON_BACKUP_DATABASE_URL` e variável `NEON_BACKUP_AGE_RECIPIENT` (backup cifrado).

## Rodar localmente
```bash
bun install --frozen-lockfile
cp .env.example .env        # preencher DATABASE_URL etc.
bun run dev                 # http://localhost:3000 (Express + Vite)
```

## Publicar
1. `bun run check` (tipos, testes, build, HANDOFF) verde.
2. Push em `main`. A Vercel faz o deploy sozinha.
3. Conferir o CI no GitHub e abrir o app: Conta, Login & Nuvem → **Buscar atualização agora**.

Cabeçalhos de segurança e cache estão em `vercel.json` (CSP, `sw.js` sem cache, `/assets` imutável, `/api` sem cache).

## Agendamentos
| O quê | Quando | Onde | Estado |
|---|---|---|---|
| `GET /api/readiness` | 12:15 UTC diário | Vercel Cron (`vercel.json`) | Cadastrado; execução automática **não comprovada** |
| `SELECT 1` no Neon | 12:23 UTC diário | `.github/workflows/neon-daily-activity.yml` | Execução agendada comprovada em 2026-11-07 |
| Backup cifrado (dump + `age`, retenção 30 dias) | 13:17 UTC diário | `.github/workflows/neon-backup.yml` | Só execução manual comprovada |

Agendar não prova que rodou: a prova é um evento automático registrado. Ver `CHECKLIST.md`, seção C.

## Migrações do banco
Arquivos `db/migrations/001…011` aplicados em ordem. Nova alteração = nova migração com o próximo número; aplicar primeiro em um branch de teste do Neon, conferir schema e só então em produção. Detalhes em [../tecnico/banco-de-dados.md](../tecnico/banco-de-dados.md).

## Em caso de problema
- API fora do ar: `GET /api/status` (público, não consulta o banco) e `GET /api/readiness` (com `Authorization: Bearer <CRON_SECRET>`) dizem o que falhou; erros de produção: logs da Vercel.
- Dados perdidos ou errados: ver [backup-e-restauracao.md](./backup-e-restauracao.md).
