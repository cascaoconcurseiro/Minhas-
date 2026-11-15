# AGENTS.md — leia isto primeiro (vale para qualquer IA ou pessoa)

**Projeto:** Minhas Economias — app web (PWA) de finanças pessoais e familiares do Wesley, que **não programa**. Quem trabalha aqui assume a parte técnica, explica em português simples e entrega verificado. Responda ao dono em português do Brasil, direto, sem inventar: diga o que foi **verificado**, o que é hipótese e o que **nunca foi verificado**.

Stack: React 19 + TypeScript + Vite (front), Express na Vercel (API), **Neon PostgreSQL** (banco). Um workspace JSON por usuário. Login próprio.

## 1. Antes de qualquer trabalho (obrigatório, nesta ordem)
1. `HANDOFF.md` — seções 1 a 5: onde estamos, o que está em andamento, próximos passos, pendências do dono, o que nunca foi verificado.
2. `CHECKLIST.md` — o que está aberto.
3. `docs/README.md` — índice da documentação. Leia o que se aplica à tarefa:
   - regras de cálculo e negócio: `docs/produto/regras-de-negocio.md`
   - passo a passo das operações: `docs/produto/fluxos.md`
   - onde fica cada código: `docs/tecnico/estrutura-do-codigo.md`
   - regras para mexer no código: `docs/processo/guia-de-contribuicao.md`
4. O código da área que vai mexer (e os testes ao lado dele).

## 2. Ao terminar qualquer trabalho que mude o sistema (obrigatório)
1. Rodar `bun run check` (tipos, testes, build e verificação do HANDOFF). Nunca declarar que funciona sem evidência.
2. **Atualizar `HANDOFF.md`**: nova entrada no topo da seção 7 com os 8 campos do modelo (preencher todos), e ajustar as seções 1–6 se mudaram.
3. Atualizar os documentos de `docs/` afetados (principalmente `docs/produto/regras-de-negocio.md` quando uma regra muda).
4. Atualizar `CHECKLIST.md` (abrir/fechar itens).
5. Só então commitar e publicar em `main` (publica sozinho na Vercel).

Isto é **imposto**: o CI falha, o gancho `pre-push` barra o push e, no Claude Code, um gancho de parada impede encerrar a tarefa com código alterado e HANDOFF desatualizado. Não tente contornar; preencha o HANDOFF.

## 3. Regras que não se quebram
- Dinheiro em **centavos** ao somar; regra de negócio só em `src/domain/` (telas não recalculam).
- Gasto de cartão conta no mês da **compra**; caixa no pagamento da fatura. Dinheiro de terceiros (a receber, acompanhante) fica **fora** do resultado pessoal.
- Forma de pagamento, categoria e conta **nada pré-selecionado** quando há mais de uma opção.
- Sincronização **silenciosa**; Neon é a única fonte de verdade; nunca gravar antes de ler o Neon.
- **Backend e imports:** todo import relativo executado pela API precisa de extensão `.ts`, senão a Vercel dá erro 500 (teste: `backend/runtimeImports.test.ts`).
- Migração SQL: nunca editar antiga; criar a próxima em `db/migrations/`.
- Segredos nunca no front nem no repositório. Texto para o usuário em português simples; nada pode estourar a largura em 360–390 px.
- Fazer a **menor mudança** que resolve; preservar o trabalho alheio; refatorar só com testes verdes antes e depois e sem mudar comportamento.
- Não publicar nem enviar nada externo sem pedido do dono.

## 4. Comandos
```bash
bun install --frozen-lockfile   # instala (também ativa o gancho pre-push)
bun run dev                     # servidor local
bun run lint | bun run test | bun run build
bun run check:handoff           # confere o HANDOFF
bun run check                   # tudo, antes de publicar
```

## 5. Mapa rápido
`src/components/<área>/` telas · `src/domain/<assunto>/` regras puras · `src/services/` dados locais, backup, OFX/CSV · `src/lib/` clientes da API · `backend/` API · `db/migrations/` banco · `docs/` documentação · `HANDOFF.md`/`CHECKLIST.md`/`MASTER_BLUEPRINT.md` na raiz.
