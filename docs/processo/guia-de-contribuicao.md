# Guia de contribuição

Regras para mexer no código sem quebrar o que funciona. Vale para pessoas e para assistentes de IA.

## Antes de mudar
1. Leia `HANDOFF.md`, `CHECKLIST.md` e o documento da área em `docs/`.
2. Entenda o padrão existente na pasta e siga-o.
3. Faça a **menor mudança** que resolve o problema. Preserve alterações de outras pessoas.

## Onde colocar o código
Veja a tabela em [../tecnico/estrutura-do-codigo.md](../tecnico/estrutura-do-codigo.md). Resumo: regra de negócio em `src/domain/`, tela em `src/components/<área>/`, dados em `src/services/`, rota em `backend/`, tabela nova em `db/migrations/`.

## Regras de ouro
- **Dinheiro**: sempre em centavos inteiros ao somar; nunca recalcular regra dentro de tela.
- **Competência**: gasto de cartão conta no mês da compra; caixa no pagamento da fatura (ver regras de negócio).
- **Dinheiro de terceiros** (a receber, acompanhante) fica fora do resultado pessoal (`isOutsidePersonalResult`).
- **Nada pré-selecionado** em forma de pagamento, categoria e conta quando há mais de uma opção.
- **Sem avisos de sincronização**: atualizações chegam em silêncio.
- **Migração SQL**: nunca editar uma migração antiga; criar a próxima numeração. Campo opcional novo no workspace não precisa de migração.
- **Backend e extensões**: todo import relativo de código que a API executa (`backend/` e o que ele importa de `src/` e `shared/`) precisa ter extensão explícita (`.ts`). Sem isso a função da Vercel dá erro 500. O teste `backend/runtimeImports.test.ts` barra isso.
- **Segredos**: nunca no frontend (nada de `VITE_` em credencial), nunca no repositório.
- **Texto para o usuário**: português do Brasil, simples.
- **Celular**: nada pode estourar a largura em 360–390 px; alvos de toque grandes.

## Testes
Toda mudança de regra tem teste na mesma entrega. Rode `bun run check` antes de publicar. Detalhes em [../tecnico/testes-e-qualidade.md](../tecnico/testes-e-qualidade.md).

## Publicação
Fluxo atual: commit direto em `main` (a Vercel publica a cada push) depois de tipos, testes e build verdes. Mensagem de commit curta, em português, dizendo o efeito. Depois do push, conferir o CI.

## Refatoração
Dividir arquivos grandes só com a suíte verde antes e depois, **sem mudar comportamento**, e em entregas separadas das mudanças de regra.
