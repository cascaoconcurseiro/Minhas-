# Avaliação da lógica financeira — 2026-11-19

Pedido do dono: o que falta na **lógica financeira e nas regras de negócio** (não em telas) para o app funcionar como um app profissional (Organizze, Mobills), sem Open Finance. Base: `docs/produto/regras-de-negocio.md` e o código de `src/domain/`.

## 1. O que já está no nível profissional

| Área | Situação |
|---|---|
| Dinheiro | Somas em centavos inteiros; parcelas fecham o total exato (diferença na 1ª). |
| Cartão | Fatura pelo fechamento/vencimento, opção "dia do fechamento vai para a próxima", pagamento total e parcial, estorno do pagamento, antecipação com desconto. |
| Competência × caixa | Gasto do cartão conta no mês da compra; o dinheiro sai no pagamento da fatura. |
| Resultado pessoal | Dinheiro de terceiros (A Receber, acompanhante, familiar que pagou) fica fora de despesas, orçamento e DRE, mas mexe no saldo e no limite. |
| Contabilidade protegida | Pagamento de fatura, acerto e aporte só se corrigem pela operação inversa. |
| Concorrência | Gravação com revisão (dois aparelhos não se sobrescrevem). |
| Investimentos | Preço médio ponderado, venda mantém o preço médio (regra da Receita), IR regressivo no simulador. |

## 2. Corrigido nesta entrega

| # | Problema de lógica | Correção |
|---|---|---|
| L1 | **Crédito no cartão somava como dívida**: um estorno de R$ 100 numa fatura de R$ 300 virava R$ 400. A tela não criava esse caso, mas a regra estava errada na base. | Fatura e limite só somam despesas; servidor e app recusam entrada ligada a cartão até existir a operação de estorno (L5). |
| L2 | **Resgate de investimento sumia do DRE**: comprar e vender R$ 200 no mesmo mês deixava o banco igual, mas o DRE mostrava caixa retido de −R$ 200. | Resgates entram no caixa do mês. |
| L3 | **Lucro/prejuízo na venda de ativo não era registrado.** | A venda grava `realizedGain` (preço de venda − preço médio) e o DRE mostra o valor. |
| L4 | **Vencimento em fim de semana/feriado aparecia como atraso** (ex.: fatura de 05/12/2026, um sábado, ficava "atrasada" no domingo). | Dia útil bancário com feriados nacionais e de Páscoa; aplicado a faturas, boletos e cobrança de compartilhado no cartão. |
| R1 | `financeRules.ts` com 3.542 linhas e 13 assuntos misturados. | Dividido em 14 arquivos por assunto, conteúdo idêntico linha a linha; o nome antigo continua funcionando. |

## 3. O que ainda falta (por prioridade)

### Precisa de decisão do dono
- **L5 — Estorno/crédito no cartão** (devolução de compra, cashback, IOF devolvido). Hoje não existe. Recomendação: lançar como "Estorno" no cartão, que **reduz a fatura e libera limite**, e **reduz a despesa da categoria** no mês do estorno (assim uma compra devolvida não aparece como gasto + receita). A alternativa (contar como receita) é mais simples, mas infla receitas e despesas no DRE e no 50/30/20.
- **L6 — Pagamento parcial de fatura.** Hoje o que sobra fica na fatura antiga e aparece como atrasado. No banco, o saldo vai para a **próxima fatura** com juros do rotativo e IOF. Recomendação: ao pagar parcial, oferecer "levar o restante para a próxima fatura" com campo opcional de juros/encargos (despesa financeira).
- **L7 — Saldo inicial com data.** O saldo inicial não tem data; conciliar hoje muda todo o passado. Apps profissionais guardam "saldo em DD/MM/AAAA". Recomendação: data de abertura por conta; lançamentos anteriores não mexem no saldo.

### Trabalho técnico já decidido (no CHECKLIST)
- **A19 — Câmbio sem conta internacional** ainda vira despesa; falta a operação única de câmbio com duas pernas.
- **A14 — IOF**: confirmar a alíquota vigente antes de mudar os padrões (3,38% hoje).
- **A21/A22/A23** — patrimônio histórico, orçamento com vigência, reserva exclusiva de ativo por meta.
- **Investimentos**: quantidade fracionária, ativo sem cotação, possível dupla contagem em metas.

### Estrutural (para durar anos)
- **Valores guardados como número decimal (reais)**. O cálculo usa centavos, mas o armazenamento não. Migrar para centavos inteiros elimina de vez o risco de arredondamento. Exige migração cuidadosa dos dados.
- **Lançamentos como linhas no banco** em vez de um documento por pessoa: permite histórico de alterações (quem mudou o quê), lixeira e consultas no servidor.
- **Telas grandes** (`App.tsx` e `TransactionModal.tsx`, cerca de 4.700 linhas cada): dividir **depois** de criar testes de ponta a ponta, porque hoje os testes cobrem bem as regras, mas pouco a tela inteira.

## 4. Verificação desta entrega
`bun run check` (791 testes). Cada correção L1–L4 tem teste que **falha no código antigo** e passa no novo; a divisão do arquivo foi conferida linha a linha (nenhuma linha a mais ou a menos). Dados reais no Neon: nenhum crédito no cartão (0 de 345 compras); nenhuma venda de investimento registrada até hoje, então L2/L3 valem para as próximas.
