# HANDOFF e CHECKLIST — como registramos o trabalho

Objetivo: em qualquer dia, qualquer pessoa (ou assistente de IA) consegue abrir o projeto e saber **onde estamos, o que mudou e o que falta**, sem depender de memória.

## Os dois arquivos (na raiz)

| Arquivo | Pergunta que responde | Quem atualiza |
|---|---|---|
| `HANDOFF.md` | "Onde estamos? O que mudamos? O que fazer agora?" | **Toda entrega** (obrigatório) |
| `CHECKLIST.md` | "O que ainda está aberto?" | Quando abrir, concluir ou decidir um item |

`MASTER_BLUEPRINT.md` guarda a visão resumida da arquitetura, as decisões permanentes e as regras do projeto; muda só quando uma decisão de arquitetura muda.

## Estrutura do HANDOFF.md

1. **Estado atual** — data, produção, resumo e última verificação (tsc/testes/build).
2. **Em andamento** — o que está sendo feito agora.
3. **Próximos passos** — em ordem de prioridade.
4. **Pendências do dono** — ações e decisões que dependem do Wesley.
5. **Nunca verificado / riscos** — o que **não** foi testado em ambiente real (iPhone/Safari, Face ID, SMTP, cron agendado, restore real…). Honestidade obrigatória: nunca declarar que funciona sem evidência.
6. **Decisões vigentes** — resumo; a lista completa está no `MASTER_BLUEPRINT.md`.
7. **Registro de entregas** — uma entrada por entrega, mais recente primeiro.

### Entrada do registro (modelo fixo)

```markdown
### AAAA-MM-DD — Título curto da entrega
- **O que mudou:**
- **Por quê:**
- **Arquivos/áreas:**
- **Como foi verificado:**
- **Não verificado:**
- **Impacto em dados/Neon:**
- **Documentação atualizada:**
- **Próximo passo:**
```
Os oito campos são obrigatórios e não podem ficar vazios. Se algo não se aplica, escreva "nenhum" ou "não necessário: motivo".

## Regra obrigatória (e como é imposta)

> Mudou `src/`, `backend/`, `api/`, `db/`, `shared/` ou `package.json`? Então o `HANDOFF.md` muda na mesma entrega.

- **Local**: `bun run check:handoff` (ou `bun run check`, que roda lint, testes, build e a checagem).
- **CI** (`.github/workflows/ci.yml`): o passo "Verificar HANDOFF atualizado" **falha** se o código mudou sem mudar o `HANDOFF.md`, se faltar alguma seção, ou se a entrada mais recente tiver campo ausente ou vazio.
- **Aviso** (não falha): se `src/domain/` mudou sem mudar `docs/produto/regras-de-negocio.md`. Se a regra mudou, atualize o documento; se não, escreva o motivo no campo "Documentação atualizada".
- O script e seus testes: `scripts/check-handoff.ts`, `scripts/check-handoff.test.ts`.

## Rotina de cada entrega (checklist de quem trabalha)

1. Ler `HANDOFF.md` (seções 1–5) e `CHECKLIST.md` antes de começar.
2. Fazer a menor mudança que resolve o problema, seguindo `guia-de-contribuicao.md`.
3. Rodar `bun run lint`, `bun run test`, `bun run build`.
4. Atualizar os documentos afetados em `docs/` (regras, fluxos, API, banco…).
5. Adicionar a entrada no `HANDOFF.md` e ajustar as seções 1–6.
6. Atualizar o `CHECKLIST.md` (abrir/fechar itens).
7. Rodar `bun run check:handoff`.
8. Commit e publicação em `main`.

## Arquivamento

Quando o `HANDOFF.md` passar de ~400 linhas, mover as entradas mais antigas (mantendo as 10 mais recentes) para `docs/arquivo/handoff/historico-<periodo>.md`, sem editar o conteúdo. O mesmo vale para itens concluídos do `CHECKLIST.md`: eles saem do arquivo da raiz e ficam registrados no HANDOFF.
