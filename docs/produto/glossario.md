# Glossário

| Termo | Significado |
|---|---|
| **Workspace** | O documento único (JSON) com todos os dados de um usuário, guardado no Neon (`finance_workspaces`). |
| **Revisão** | Número que sobe a cada gravação do workspace; evita que uma tela sobrescreva a outra (revisão otimista). |
| **Competência** | Mês ao qual um lançamento pertence. Para cartão, o mês de **vencimento** da fatura. |
| **Mês de consumo** | Mês em que o gasto "conta" no resultado: para cartão, o mês da compra (cada parcela no seu mês). |
| **Fatura** | Soma das compras de um cartão que vencem num mês. |
| **Fechamento** | Dia em que o banco fecha a fatura; compras depois dele vão para a próxima. |
| **Vencimento** | Dia em que a fatura deve ser paga. |
| **Melhor dia de compra** | Primeiro dia do ciclo novo, quando a compra demora mais para vencer. |
| **Limite usado / livre** | Total em aberto nas faturas / limite menos usado. |
| **Pagamento de fatura** | Saída de dinheiro da conta que quita compras do cartão; não é despesa (a despesa foi a compra). |
| **Estorno de fatura** | Desfaz o pagamento: devolve o dinheiro à conta e reabre as compras. |
| **Parcela antecipada** | Parcela futura trazida para a fatura atual com desconto; reversível. |
| **Cascata** | Alcance de edição/exclusão numa série: só este, este e os próximos, ou toda a série. |
| **Resultado pessoal** | Despesas e receitas que são suas de fato. Fora dele ficam dinheiro de terceiros (a receber) e gastos só de acompanhantes. |
| **A Receber** | Dinheiro que outra pessoa deve: fatura de cartão adicional ou empréstimo. |
| **Cartão adicional** | Cartão extra ligado ao seu, usado por outra pessoa, cuja fatura você cobra por inteiro. |
| **Recebimento parcial** | Pagamento de parte do valor a receber, em qualquer data, para uma conta sua. |
| **Compartilhado** | Despesa dividida com um familiar. **Acerto** é a compensação entre vocês. |
| **Espelho** | Cópia de uma despesa compartilhada na conta do outro usuário (`tx-mirror-*`). |
| **Convite** | Pedido para vincular outra conta como familiar (`fam-inv-*`). |
| **50/30/20** | Regra de orçamento: 50% essenciais, 30% estilo de vida, 20% futuro. |
| **Burn rate (ritmo do mês)** | % do orçamento gasto comparado com % dos dias do mês já passados. |
| **DRE pessoal** | Demonstração do resultado do período, adaptada a finanças pessoais. |
| **Patrimônio líquido** | Contas + investimentos + a receber − dívida dos cartões. |
| **Score 360** | Nota de 0 a 1000 da saúde financeira (poupança, liquidez, crédito, disciplina). |
| **VET** | Valor Efetivo Total do câmbio (cotação com IOF e taxas). **VET médio** pondera os lotes. |
| **Lote de câmbio** | Uma compra de moeda estrangeira para viagem. |
| **OFX** | Formato de extrato bancário baixado no banco. **FITID** é o ID único de cada linha. |
| **PWA** | Site instalável no celular como aplicativo. |
| **Passkey / Face ID** | Entrada por biometria (WebAuthn), cadastrada por aparelho. |
| **RLS** | Row-Level Security: o banco só mostra a cada usuário as próprias linhas. |
| **Neon** | Serviço de banco PostgreSQL onde ficam todos os dados. |
| **Vercel** | Serviço que hospeda o site e o servidor. |
| **HANDOFF** | Diário de bordo obrigatório do projeto (onde estamos, o que mudou, o que falta). |
