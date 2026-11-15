# Testes e qualidade

## Comandos

```bash
bun install --frozen-lockfile   # instala dependências exatamente como no bun.lock
bun run lint                    # checagem de tipos (tsc --noEmit)
bun test                        # suíte completa (713 testes em 98 arquivos em 2026-11-15)
bun run build                   # build de produção (Vite + PWA)
bun run check:handoff           # confere se o HANDOFF foi atualizado junto com o código
```

Antes de qualquer entrega: **lint + testes + build** verdes **e** HANDOFF atualizado.

## O que é testado

| Tipo | Onde | Exemplo |
|---|---|---|
| Regras de negócio | `src/domain/**/*.test.ts` | competência da fatura, a receber, patrimônio |
| Telas | `src/components/**/*.test.tsx` | formulários, validações, textos |
| Orquestração do App | `src/App.test.tsx` | carga, sincronização, conflito, desfazer |
| Servidor/API | `backend/*.test.ts` | auth, família, saúde, SMTP, passkeys |
| PostgreSQL real | `scripts/qa-postgres.ts` (CI) | RLS, acertos, concorrência |
| Propriedades (fuzz) | `src/domain/finance/propertyFuzz.test.ts` | rateio de viagem, dívidas, saldos |

Ambiente de teste: `node:test` via `bun test`, DOM simulado com happy-dom (`src/test-utils`).

## Verificação além dos testes

Telas novas são conferidas num navegador de teste (Chromium/Playwright) em 390 px (celular) e desktop. **Nunca verificado**: iPhone/Safari reais, Face ID real, envio real de SMTP, Neon de produção fora de leituras pontuais. Esses itens ficam listados em `HANDOFF.md`.

## Integração contínua (`.github/workflows/ci.yml`)
- Job `postgres`: sobe PostgreSQL 17 e roda `scripts/qa-postgres.ts`.
- Job `verify`: `bun install --frozen-lockfile`, `lint`, `test`, `build` e `check:handoff`.

## Padrões de qualidade
- Mudança de regra → teste novo ou ajustado na mesma entrega.
- Nada de `any` novo sem motivo; tipos em `src/types/finance.ts`.
- Mensagens para o usuário em português simples, sem jargão.
- Acessibilidade: janelas com `role="dialog"`/`aria-modal`, foco controlado (`useModalAccessibility`), alvos de toque grandes em telas de toque.
- Interface: nada deve estourar a largura em 360–390 px.
