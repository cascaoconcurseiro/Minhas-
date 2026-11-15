# Visão geral do produto

**Minhas Economias** é um aplicativo web instalável (PWA) de finanças pessoais e familiares para o público brasileiro. Os dados são lançados manualmente ou importados de extratos; nada é lido do banco automaticamente. Cada pessoa entra com e-mail e senha (ou Face ID) e tem **um espaço de trabalho (workspace)** próprio, guardado no banco Neon.

## Para quem é

Uma pessoa ou casal que quer enxergar com clareza: quanto tem em cada conta, quanto deve em cada cartão, para onde vai o dinheiro, quanto vai sobrar nos próximos meses e quanto outras pessoas lhe devem.

## O que o sistema faz (telas)

| Tela (menu) | Função |
|---|---|
| **Visão Geral** | Saldo atual, previsão de caixa, resultado do mês, alertas, gastos que se repetem, score de saúde financeira. |
| **Lançamentos (Extrato)** | Lista e busca de movimentos; criar, editar, duplicar, apagar; ações em lote; calendário mensal; importar extrato OFX/CSV. |
| **Contas & Carteiras** | Contas nacionais e internacionais (várias moedas), saldo corrido, conciliação de saldo inicial. |
| **Cartões de Crédito** | Cartões, faturas por mês, pagamento total ou parcial, antecipação de parcelas, comprometimento do limite mês a mês, melhor dia de compra. |
| **Orçamentos** | Teto por categoria, regra 50/30/20, ritmo do mês (burn rate), sugestões. |
| **Viagens & Câmbio** | Viagens multi-moeda, lotes de câmbio (VET médio), divisão de gastos entre viajantes e quitação. |
| **Compartilhado** | Despesas divididas com familiares, encontro de contas, convites entre contas. |
| **A Receber** | Dinheiro que outras pessoas devem: fatura de cartão adicional cobrada por inteiro e empréstimos, com recebimentos parciais. |
| **Investimentos** | Carteira (renda fixa, FIIs, ações B3, exterior), aportes e resgates ligados à conta, cotações, rebalanceamento. |
| **Metas & Reservas** | Metas com simulador de renda fixa (CDI, Selic, LCI/LCA, poupança). |
| **Relatórios & DRE** | DRE pessoal, gráficos por período, patrimônio consolidado, exportação PDF/CSV/JSON. |
| **Configurações** | Conta e nuvem, Face ID, lembretes, categorias e divisão automática, backup, tema. |

Detalhes de cada regra estão em [regras-de-negocio.md](./regras-de-negocio.md); o passo a passo de cada operação em [fluxos.md](./fluxos.md).

## Princípios do produto

1. **Uma fonte de verdade**: o Neon. O aparelho guarda só uma cópia de leitura para abrir rápido; ela é substituída em silêncio pela versão do Neon.
2. **Sem surpresas**: o app não escolhe por você forma de pagamento, categoria ou conta quando há mais de uma opção — você precisa escolher (se só existe uma opção, ela já vem escolhida).
3. **Tempo real silencioso**: atualizações chegam sem avisos de "sincronizando" e sem a tela piscar.
4. **Dinheiro em centavos**: valores digitados seguem a máscara financeira (digitar `6027` vira `60,27`).
5. **Resultado pessoal limpo**: dinheiro que é de outra pessoa (fatura do cartão adicional da esposa, empréstimo) não vira despesa nem receita sua.
6. **Mobile primeiro**: tudo precisa funcionar bem no celular (PWA) e no computador.

## Limites conhecidos

- Não há leitura automática do banco (Open Finance), de fatura em PDF ou de foto de nota. Importação é por OFX/CSV de conta corrente.
- Não verificado em iPhone/Safari real: campo de data, instalação do PWA, Face ID. Não verificado: envio real de e-mail (SMTP).
- O workspace é um documento único por usuário (JSON). Não há tabelas por lançamento.
