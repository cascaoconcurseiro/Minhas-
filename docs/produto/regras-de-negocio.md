# Regras de negócio

Este documento descreve **como o sistema calcula e decide**. A fonte é o código em `src/domain/` (cada regra aponta o arquivo). Se o código mudar, este documento deve mudar junto (ver `../processo/handoff-e-checklist.md`).

Convenções: valores em reais com 2 casas, calculados em **centavos inteiros** para evitar erro de arredondamento. Datas no formato `AAAA-MM-DD`; meses (competência) no formato `AAAA-MM`.

---

## 1. Entidades principais

| Entidade | O que é | Campos que importam |
|---|---|---|
| **Conta** (`BankAccount`) | Conta corrente, poupança, dinheiro, investimento ou internacional | saldo inicial, "incluir no total", moeda (BRL ou estrangeira) |
| **Cartão** (`CreditCard`) | Cartão de crédito | limite, dia de fechamento, dia de vencimento (escolhidos numa lista de 1 a 31, sem digitar), conta padrão de pagamento, opção "compra no dia do fechamento vai para a próxima fatura" |
| **Categoria** (`Category`) | Classificação de despesa/receita | tipo, grupo (`essential` Essenciais, `lifestyle` Estilo de vida, `financial` Futuro), orçamento mensal |
| **Lançamento** (`Transaction`) | Qualquer movimento | tipo (`income`, `expense`, `transfer`), status (`paid`, `pending`), forma (`pix`, `credit_card`, `debit_card`, `boleto`, `cash`, `transfer`), recorrência (`single`, `installment`, `fixed`) |
| **Valor a receber** (`Receivable`) | Dinheiro que outra pessoa deve | tipo (`card_invoice`, `loan`), pessoa, valor, pagamentos parciais |
| **Meta** (`SavingsGoal`) | Objetivo de poupança | valor-alvo, prazo, indexador, ativo vinculado opcional |
| **Ativo** (`InvestmentAsset`) | Posição de investimento | classe, quantidade, preço atual, meta de alocação |
| **Viagem** (`Trip`) | Viagem com câmbio e participantes | lotes de câmbio, participantes, gastos |
| **Familiar** (`FamilyMember`) | Pessoa do compartilhamento | relação (cônjuge, filho…), e-mail, convite |

Tudo isso vive em um único documento por usuário (workspace). Tipos em `src/types/finance.ts`.

---

## 2. Lançamentos

### 2.1 Campos obrigatórios e escolhas
- **Forma de pagamento, categoria e conta** não vêm pré-selecionadas quando há mais de uma opção: a pessoa precisa escolher. Se só existe **uma** opção, ela já vem escolhida.
- Para o cartão: escolher o cartão é obrigatório quando houver mais de um.
- O sistema **aprende** hábitos: depois que você lança um estabelecimento algumas vezes, sugere categoria e de onde costuma sair o dinheiro (`decisionEngine.ts`, `learningRules.ts`). Só aplica quando o campo ainda está vazio.

### 2.2 Valor digitado
- Máscara financeira: os dígitos digitados entram como centavos (`6027` → `60,27`). Letras são ignoradas. O cursor fica sempre no final (`CurrencyInput`, `currencyInput.ts`).
- Texto colado ou valor programático usa a leitura tolerante `parseBRLInput` (aceita `R$ 1.234,56`, `1234.56` etc.).

### 2.3 Tipos
| Tipo | Efeito |
|---|---|
| **Despesa em conta** (PIX, débito, boleto, dinheiro) | Sai da conta na data; se `pending`, aparece em "a pagar" |
| **Despesa no cartão** | Não sai da conta; entra na **fatura** do mês correspondente e ocupa o limite |
| **Receita** | Entra na conta |
| **Transferência** | Move dinheiro entre contas (mesma moeda ou com conversão); não é gasto nem receita. Origem e destino não podem ser a mesma conta |

### 2.3b Categoria no formulário
As categorias de despesa aparecem agrupadas por tipo (Essenciais, Estilo de vida e lazer, Objetivos e poupança), em ordem alfabética dentro de cada grupo; as de receita ficam em uma lista só, também em ordem alfabética.

### 2.4 Parcelado e fixo
- **Parcelado**: de 2 a 48 parcelas (o seletor do formulário mostra todos os números, sem pular nenhum). O valor total é dividido em centavos; a diferença de centavos fica na **primeira** parcela (`createTransactionBatch`). Cada parcela vai para a fatura do seu mês. Em compra de **viagem** em moeda estrangeira, o valor original (`originalAmount`), a cota pessoal e as cotas por participante são **divididos entre as parcelas** (a soma das parcelas fecha exatamente o total); nunca se repete o valor inteiro em cada parcela.
- **Fixo (assinatura/recorrente)**: gera lançamentos para os próximos meses. O sistema sugere "gastos que se repetem" detectando o padrão no histórico (`recurrenceDetection.ts`): mesmo estabelecimento em meses seguidos; o usuário pode dispensar a sugestão.

### 2.4b Editar mudando parcelas ou repetição
Ao editar, o formulário mostra os mesmos campos do lançamento original, inclusive **forma de pagamento (conta/débito ou cartão), frequência (à vista, fixo, parcelado) e número de parcelas**. Trocar entre cartão e conta também refaz a série. Mudar isso **refaz a série inteira** com o que está no formulário (mesmo total dividido de novo, na mesma posição da lista; `rebuildTransactionSeries`). É **recusado, sem alterar nada**, se a série tiver parcela já paga, antecipada, dividida por pagamento parcial, vinda de extrato ou acerto compartilhado recebido: primeiro estornar o pagamento da fatura ou desfazer a antecipação (`getSeriesRebuildBlocker`). Mudar só o número de meses de um lançamento **fixo** não refaz a série: aumentar acrescenta meses "previstos" no fim e diminuir tira meses do fim, só se ainda estiverem pendentes (`adjustFixedSeriesLength`).

### 2.5 Edição e exclusão em cascata
Ao editar ou apagar um lançamento de série, o modo de cascata decide o alcance: `single` (só este), `this_and_future` (este e os próximos), `all_series` (a série toda) (`applyCascadeTransactionEdit`, `applyCascadeTransactionDelete`).

### 2.6 Bloqueios que protegem a contabilidade (`getLinkedOperationRestriction`, `getTransactionEditRestriction`)
- Aporte/resgate de investimento: não pode ser editado, apagado nem duplicado no extrato; a correção é a operação inversa em Investimentos.
- Compra de câmbio de viagem (`tx-fxlot-*`): corrigir pelo lote na aba Viagens.
- Compra de cartão já quitada por pagamento de fatura: primeiro estornar o pagamento da fatura.
- Pagamento de fatura: estornar antes de corrigir.
- Acerto de compartilhado já recebido: reabrir o acerto em Compartilhado primeiro.
- Aporte/resgate de investimento e compra de câmbio também **não** mudam de situação (pago/pendente) pelo botão de status nem em lote: a posição do ativo ou o lote já foram alterados por outra operação.
- Compra de cartão **não** pode ser marcada como paga diretamente: só pagando a fatura (senão a dívida sumiria sem sair dinheiro de conta) (`canSettleTransactionDirectly`).

### 2.7 Avisos antes de salvar (nunca bloqueiam)
- Saldo insuficiente na conta e compra acima do limite livre do cartão (`spendingGuards.ts`).
- Data a mais de ~1 ano de hoje (erro de digitação do ano) e "pago" com data futura.
- Valor muito acima do usual no mesmo estabelecimento (≥ 2x a mediana e ≥ R$ 20 de diferença, com ao menos 3 ocorrências) (`assessAmount`).
- Lançamento provavelmente duplicado: mesma descrição, mesmo valor, até 2 dias de diferença; transferência exige mesma origem e destino (`findProbableDuplicate`).

---

## 3. Cartão de crédito e faturas (`financeRules.ts`)

### 3.1 Em qual fatura entra uma compra — `resolveCreditCardInvoiceMonth`
O mês da fatura (competência) é o mês do **vencimento**. A regra:
1. Compra **até** o dia de fechamento (inclusive) fica no ciclo atual; compra **depois** do fechamento vai para o ciclo seguinte.
2. **Exceção por cartão**: se o cartão tem a opção "compra no próprio dia do fechamento vai para a próxima fatura" marcada, a compra feita **exatamente** no dia do fechamento já vai para o ciclo seguinte (alguns bancos funcionam assim).
3. Se o dia de vencimento é **menor ou igual** ao dia de fechamento (ex.: fecha dia 30, vence dia 5), o vencimento cai no mês seguinte ao do fechamento: soma mais um mês.
4. Fórmula: `mês da compra + (compra depois do fechamento ? 1 : 0) + (vencimento ≤ fechamento ? 1 : 0)`.

Exemplo (fecha 30, vence 5): compra em 29/10 → fatura que vence em 05/**11**. Compra em 31/10 → 05/**12**. Compra em 30/10: 05/11 (padrão) ou 05/12 (com a opção marcada).

Ao **mudar o dia de fechamento ou a opção** de um cartão, as compras **pendentes** feitas exatamente no dia do fechamento são reclassificadas para a fatura certa (`reclassifyClosingDayPurchases`). Não são alteradas: compras já pagas, parceladas, pagamentos de fatura, itens de "a receber" e ajustes manuais de competência.

### 3.2 Fatura e limite — `calculateCreditCardSummary`
- **Total da fatura** = soma das compras do cartão com aquela competência.
- **Pendente** = total menos o que já foi pago. A fatura está paga quando há compras e o pendente é zero.
- **Limite usado** = tudo que está em aberto (faturas atuais e futuras). **Limite livre** = limite − usado.
- Os valores a receber de cartão adicional (seção 7) **entram na fatura e no limite**, porque o banco cobra o total.

**Regra geral (decisão do dono): toda lista de cartão, conta e lançamentos é sempre em ordem cronológica** (do dia 1 para o fim do mês). Vale para as compras da fatura, o extrato da conta (sem opção de inverter) e a lista de Lançamentos.

**Acerto compartilhado (A08, decisão do dono):** o comportamento atual foi aprovado e fica como está: o gasto compartilhado acertado em outro mês acompanha o mês do acerto.

### 3.3 Pagar fatura — `payCreditCardInvoice`
- Gera um lançamento de saída na conta escolhida (marcado como pagamento de fatura) e marca as compras do mês como pagas, em cascata.
- **Pagamento parcial**: paga as compras na ordem até onde o valor alcança; a compra que ficar no meio é dividida (`partialSplitOriginalId`) e o resíduo continua pendente.
- **Estorno** (`reverseCreditCardInvoicePayment`): remove o débito da conta e reabre as compras como `pending`. Ao estornar um pagamento **parcial**, a fração paga por ele volta a ser dívida, mas **só é juntada à linha original se essa linha ainda estiver em aberto**; se outro pagamento já quitou a linha original, a fração é reaberta como linha própria (a dívida volta exatamente ao valor daquele pagamento, não ao da compra inteira). Valores de viagem em moeda estrangeira acompanham a fração e são recompostos na junção.
- O pagamento de fatura **não é despesa** (a despesa já foi contada na compra); é movimento de caixa.

### 3.4 Antecipação de parcelas (`uxEnhancementRules.ts`)
Antecipar parcelas futuras para a fatura atual com desconto: guarda o mês e valor originais (`originalCompetenceMonth`, `originalAmountBeforeDiscount`) para **reverter com 1 clique**. O gasto continua contado no mês original da compra. O **desconto é repartido em centavos inteiros** (o total descontado é exatamente o informado; nenhuma parcela fica abaixo de R$ 0,01) e a data da parcela usa o último dia do mês quando o dia original não existe (31 → 28/02). **Antecipação já paga não pode ser desfeita** (primeiro estornar o pagamento da fatura): devolver valor e mês alteraria uma obrigação já liquidada.

### 3.5 Comprometimento do cartão (`cardCommitment.ts`)
- Para cada mês: `compra no cartão do mês ÷ renda lançada ou prevista no mês`. A renda é só o que está lançado/previsto (nunca média).
- Sem renda lançada: mostra só o valor em reais, sem porcentagem.
- O limite (% da renda) e o aviso (padrão 80% do limite) são definidos em Configurações (`cardCommitmentLimitPercent`, `cardCommitmentWarnPercent`).
- Alerta para o mês atual e os 2 próximos quando perto/acima do limite.


**Chave "Geral / Só a minha parte"** (decisão do dono, 2026-11-15): o *Geral* mostra tudo o que está na fatura (como antes, sem A Receber). *Só a minha parte* soma, por mês, suas compras e parcelas no cartão (nos compartilhados que você pagou, desconta a parte da outra pessoa: `valor − sharedAmount`). Compras pagas por outra pessoa, inclusive as recebidas pelo compartilhamento familiar, ficam em **Compartilhado → Eu devo** e não são despesa pessoal nem entram no comprometimento do seu cartão. O acerto entra no extrato quando você paga sua parte. O que é de terceiros (A Receber, cartão adicional) não entra em nenhuma das duas. A porcentagem da renda e o limite valem para a visão escolhida (`getMyCardPurchaseAmount`, `CardCommitmentMonth.mine`).

### 3.6 Melhor dia de compra — removido
O cartão "Cartões" com o melhor dia de compra saiu da Visão Geral a pedido do dono e o código sem uso (`cardIntelligence.ts`) foi apagado na limpeza de 2026-11-19. Se voltar, recuperar do histórico do Git (commit anterior a essa limpeza).

---

## 4. Contas e saldos

- **Saldo da conta** = saldo inicial + entradas pagas − saídas pagas ± transferências, até a data de referência (`calculateAccountBalances`).
- **Saldo total** soma só contas marcadas "incluir no total".
- **Contas internacionais**: o saldo é guardado na moeda da conta (`initialBalanceForeign`); transferências entre moedas guardam a perna estrangeira e a cotação (`transferRules.ts`).
- **Posição de hoje** (`calculateCurrentPosition`): saldos, investimentos e patrimônio partem de **hoje**, e não do mês que está sendo navegado. Navegar para outro mês não muda o patrimônio nem some atrasos.
- **Conciliação de saldo inicial**: ajustar o saldo base para o saldo atual bater com o aplicativo do banco.

---

## 5. Resultado do mês: despesas, receitas, categorias

### 5.1 Quando um gasto "conta" (competência de consumo) — `getConsumptionMonth`
- **Compra no cartão** conta no **mês da compra** (cada parcela no mês da própria parcela), **não** no mês do vencimento da fatura. Parcelas antecipadas mantêm o mês original.
- Lançamento de banco segue a competência salva.
- **Caixa** (`getCashMovementMonth`): o dinheiro sai da conta no mês do pagamento da fatura.

### 5.2 O que fica FORA do resultado pessoal — `isOutsidePersonalResult`
Não contam como despesa, receita, categoria, 50/30/20, DRE, comprometimento de cartão, recorrência nem aprendizado de hábito:
- gastos **só de acompanhantes de viagem** (pagos por outro participante);
- movimentos de **valores a receber** (linha da fatura do cartão adicional, saída de empréstimo e os recebimentos).
- Despesa paga pelo familiar (`sharedPaidBy === 'member'`) e espelho recebido por convite (`tx-mirror-*`) não entram nas despesas nem no resultado pessoal. A cota devida aparece em **Compartilhado → Eu devo**; após o acerto, a saída real da conta aparece no extrato. Uma despesa compartilhada que você pagou continua contando como despesa sua, descontada a parte a receber.
Esses movimentos **continuam** afetando saldo de conta, fatura e limite do cartão.

### 5.3 Orçamento e 50/30/20
- Cada categoria tem um teto mensal; o status é `ok`, `warning` (perto do teto, limiar configurável `budgetWarningPercent`) ou `over` (estourou).
- Regra **50/30/20**: Essenciais 50%, Estilo de vida 30%, Futuro e quitações 20% — calculada sobre a renda do mês (`calculate503020Rule`).
- **Ritmo do mês (burn rate)**: compara % do orçamento consumido com % de dias corridos do mês (`calculateMonthBurnRateMarker`).

### 5.4 DRE pessoal (`calculatePersonalDre`)
Receita operacional + dividendos − despesas de consumo = resultado; aportes em investimento são mostrados à parte (não são despesa). Mostra também o patrimônio consolidado (seção 6).

### 5.5 Previsão de caixa (`cashForecast.ts`)
Parte do saldo de hoje e soma o que está agendado: contas a pagar e a receber, lançamentos fixos, parcelas e **faturas de cartão no dia do vencimento**. Mostra o ponto mais baixo e o primeiro dia negativo, considerando só contas incluídas no total. O **fluxo diário** (`calculateDailyCashFlow`) abre com o saldo **projetado** do mês anterior, ou seja, já inclui o que ficou pendente (a pagar/receber) de meses anteriores; assim o último dia da curva fecha com o saldo projetado do mês.

---

## 6. Patrimônio e score de saúde

### 6.1 Patrimônio líquido — `calculateNetWorth`
`patrimônio = saldo das contas + investimentos + A RECEBER de pessoas − dívida dos cartões`
- **Investimentos** = quantidade × preço atual de cada ativo.
- **Dívida dos cartões** = limite usado (faturas atuais e futuras).
- **A receber** = saldo em aberto de todos os valores a receber (seção 7). Entra como ativo para compensar a fatura do cartão adicional, que já está na dívida do cartão.

### 6.2 Score de saúde financeira 360 (0 a 1000) — `calculateFinancialHealthScore360`
Soma de quatro blocos de até 250 pontos:
| Bloco | Regra resumida |
|---|---|
| Poupança | ≥ 20% de taxa de poupança projetada = 250; entre 0 e 20% proporcional (125–250); déficit reduz até 0; sem renda e sem gasto = 180 |
| Liquidez | Reserva ≥ 6 meses de gasto = 250; proporcional abaixo disso; só saldo positivo = 150 |
| Crédito | Uso do limite ≤ 30% = 250; 30–70% desce até 120; acima de 70% desce até 0 |
| Disciplina de orçamento | 250 − 55 por categoria estourada − 20 por categoria em alerta |
Faixas: ≥ 800 Excelente; ≥ 650 Saudável; ≥ 450 Atenção; abaixo disso Crítico.

---

## 7. A Receber (`src/domain/receivables/receivables.ts`)

Para dinheiro que **é de outra pessoa**, mesmo passando pelas suas contas. Dois tipos:

### 7.1 Fatura de cartão adicional (`card_invoice`)
Caso: sua esposa usa um cartão adicional e você cobra dela **o valor cheio da fatura**, não compra por compra.
- Cria **uma linha na fatura do seu cartão** (pendente, no mês de fatura escolhido, categoria "Outros"), que ocupa limite e aparece na fatura.
- **Não** é despesa sua (seção 5.2).
- O **mês da fatura** só pode ser do mês atual em diante, até o último mês com lançamento naquele cartão (`getInvoiceMonthOptions`).
- A pessoa já vem sugerida a partir do Compartilhamento: o cônjuge cadastrado, ou a única pessoa cadastrada.
- Descrição padrão: "Fatura de {pessoa} — {cartão} ({mês})".

### 7.2 Empréstimo ou dívida (`loan`)
Caso: sua irmã lhe deve um valor, sem prazo definido.
- Opcionalmente registra a **saída** de uma conta (se o dinheiro realmente saiu de uma conta do app) como movimento fora do resultado pessoal.
- Sem prazo: o saldo só baixa conforme você registra recebimentos.

### 7.3 Registrar recebimento (parcial ou total)
- Campo do valor **começa vazio**; o atalho "Receber tudo" preenche o saldo.
- Exige valor > 0, data válida, **conta** onde o dinheiro entrou (obrigatória se houver mais de uma) e valor **não maior que o saldo**.
- Cria uma **entrada** na conta (paga), que **não conta como receita**. O saldo do a receber baixa; quando chega a zero o item vira "Recebido".
- É possível **desfazer** um recebimento (remove a entrada; a dívida sobe de novo).

### 7.4 Apagar
Apaga o valor a receber e tudo que ele criou (linha da fatura, saída da conta, recebimentos). Se a linha da fatura já estiver **paga** na fatura do cartão, a exclusão é bloqueada: estorne o pagamento da fatura antes.

### 7.5 Onde aparece
Menu **A Receber** (lista, progresso, recebimentos), **patrimônio** (como ativo), **score** e **backup** (`receivablesJson`). Não aparece em despesas, receitas, relatórios por categoria, 50/30/20 ou DRE.

---

## 8. Compartilhado com família (`src/domain/family/`)

- Uma despesa pode ser dividida (`full`, `half`, `custom`) indicando **quem pagou**: `me` (você pagou, o familiar lhe deve) ou `member` (o familiar pagou, você deve).
- **Divisão automática por categoria** (Configurações): ao escolher uma categoria (ex.: Mercado, Carro), o lançamento já vem dividido com a pessoa definida e quem paga (`categorySharingRules`, `sharingFromCategoryRule`). O app também **aprende** a divisão pelo histórico do estabelecimento.
- **Acerto (encontro de contas)** (`settleSharedExpenses`): compensa créditos e débitos recíprocos e liquida o líquido em **um lançamento bancário**, com rastreabilidade (`sharedSettlementId`). Pode ser **reaberto** (`reopenSharedSettlement`).
- **Entre contas diferentes**: convites (`fam-inv-*`) e espelhos de despesas (`tx-mirror-*`) são sincronizados pelo servidor entre contas vinculadas; recibos bancários locais ficam em `sharedSettlementReceiptsJson` e não vazam para o outro usuário.
- **Compartilhados lançados antes do aceite do convite** (correção de 2026-11-15): o servidor informa quais compartilhados desta conta já tem (`outgoingSharedIds`); ao abrir o app e a cada leitura periódica, o app envia, em silêncio e em lotes de 40, os que faltam para cada pessoa com convite aceito (`findUnsentSharedTransactions`). Cada lançamento é tentado uma vez por sessão; falha de rede libera nova tentativa. Antes, o envio só acontecia ao salvar um lançamento, e o que existia antes do aceite nunca chegava à outra conta.
- **Situações do convite (verificadas com PostgreSQL real em `scripts/qa-postgres.ts`)**:

| Situação | O que acontece |
|---|---|
| Convidar um e-mail **sem conta** | O convite fica guardado no servidor (o app **não envia e-mail**). A tela avisa "Essa pessoa ainda não tem conta", mostra o **código do convite** e oferece **Copiar convite** e **Enviar pelo WhatsApp** com a mensagem pronta (já leva o código). Nada é enviado antes de o convite ser aceito (o servidor responde 403). |
| **Aceitar exige o código do convite** (decisão do dono, 2026-11-15) | Código de 8 letras/números (ex.: `AB3D-EF4H`), derivado do convite com o segredo do servidor, visível só para quem convidou. Quem aceita digita (maiúsculas, hífen e espaços não importam). Sem código ou com código errado: 403 e o convite não muda. 8 erros seguidos bloqueiam a pessoa por 1 hora (429), até com o código certo. Recusar não exige código. Convidar de novo ("Atualizar convite") mantém o mesmo código, então a mensagem já enviada continua valendo. Aceitar de novo um convite já aceito é inofensivo e não pede o código. Assim, criar uma conta com o e-mail convidado (ou errar a digitação do e-mail) não dá acesso aos compartilhados. |
| A pessoa **cria a conta depois** (com o mesmo e-mail, em qualquer combinação de maiúsculas) | Ao entrar, ela vê o convite pendente na aba Compartilhado e aceita digitando o código. Na tela de quem convidou, o aviso muda para "Ela já tem conta" (atualiza a cada minuto) e, ao aceitar, vira "Conta vinculada". |
| Depois do aceite | Quem convidou envia automaticamente, em silêncio, os compartilhados que já existiam (aberto o app, em até 1 minuto) e todos os novos ao salvar. |
| **Os dois sentidos** | Cada lado lança compartilhados e o outro recebe como espelho (`tx-mirror-*`) com "quem pagou" invertido e a cota dele. Editar o lançamento atualiza o espelho; apagar do lado de quem lançou remove o espelho; apagar do lado de quem recebeu só esconde a cópia dele (e ela não é reenviada). |
| **Recusa** | Bloqueia o envio. Quem convidou pode convidar de novo ("Atualizar convite"): o convite volta a pendente e pode ser aceito. |
| **Revogação** (por qualquer lado) | Apaga os espelhos nos dois sentidos. Convidar de novo recomeça do zero e quem convidou reenvia os compartilhados sozinho. |
| Convite para si mesmo, e-mail inválido, sem login | Recusado (400/401). Outra pessoa não vê nem aceita um convite que não é dela (404). |

- **Quando a parte do compartilhado é cobrada (e quando aparece como atrasada)** (decisão do dono, 2026-11-15): compra no **cartão** só é cobrada no **vencimento da fatura**, nunca no dia da compra (`getSharedChargeDate`). Quem tem o cartão calcula pelo dia de vencimento do cartão no mês da fatura. Quem **recebe** o espelho não tem o cartão; por isso o app de quem lançou envia o vencimento junto (`sharedDueDate`, validado pelo servidor como data real). Espelho antigo sem essa data só vence no **último dia do mês da fatura** (nunca atrasa antes da hora). Fora do cartão vale a data do lançamento. **Autocorreção**: o servidor informa quais compartilhados de cartão ele guarda sem o vencimento (`outgoingSharedStaleIds`, enviados por app antigo) e o app novo de quem lançou os reenvia, em silêncio, uma vez por sessão, quando consegue calcular a data. O lembrete diz **"Pagar a [pessoa]"** quando outra pessoa pagou e eu devo a minha parte, e **"Reembolso de [pessoa]"** quando eu paguei e ela me deve.
- **A Receber não é compartilhado**: um item de A Receber (ex.: fatura do cartão adicional de outra pessoa) fica só na conta de quem o lançou; ele não aparece na conta da pessoa, mesmo com convite aceito.
- Compras do tipo "familiar pagou" não entram como seu gasto no cartão (`sharedPaidBy === 'member'`).

---

## 9. Investimentos (`investmentRules.ts`)
- Classes: renda fixa pós-fixada, renda fixa IPCA+, FIIs, ações B3, exterior/ETFs, etc.
- **Aporte** e **resgate** são **transferência** entre conta e ativo (não despesa nem receita); só o rendimento/provento é receita (`isInvestmentIncome`).
- Aporte vinculado a meta atualiza a meta; ativo com saldo, histórico ou meta **não pode ser apagado** (`getInvestmentDeletionRestriction`).
- Cotações: Google Finance/B3 (`/api/investments/sync-quotes`); preço arredondado a 2 casas (abaixo de R$ 1, até 6 casas).
- **Rebalanceamento**: compara a alocação atual com o percentual-alvo por classe.

## 10. Viagens e câmbio (`travelRules.ts`)
- **Lotes de câmbio**: cada compra de moeda registra valor e custo; o **VET médio ponderado** (Valor Efetivo Total) mistura os lotes. IOF padrão: 1,1% conta global, 3,38% cartão internacional, 0% espécie.
- **Divisão de gastos** (estilo Splitwise): `equal`, `exact`, `percentage`, `shares` (pesos), `individual`; o resto do rateio respeita a menor unidade da moeda (JPY e CLP dividem em unidades inteiras, não em centavos); **simplificação de dívidas** entre participantes e quitação.
- **Moeda da dívida (decisão do dono, 2026-11-15)**: a dívida entre participantes é sempre na **moeda da viagem**. Se o saldo na moeda da viagem fecha em zero, não há cobrança, mesmo que o equivalente em reais difira (a diferença é variação de câmbio, não dívida). Ao vincular um lançamento a uma viagem, o formulário passa sozinho para a moeda e o símbolo da viagem (ex.: US$).
- **Economia cambial**: compara o VET médio dos lotes com a cotação comercial do dia.
- Gastos pagos só por acompanhantes não debitam suas contas e ficam fora do resultado pessoal.

## 11. Metas e simulador (`GoalsAndSimulatorTab`, `simulateFixedIncomeBR`)
Simula juros compostos para 100% CDI, 110% CDI, Tesouro Selic, LCI/LCA (92% CDI, isento) e poupança, descontando a tabela regressiva de IR: 22,5% até 180 dias, 20% até 360, 17,5% até 720 e 15% acima disso (`getBrazilianIrRateForDays`).

---

- **Relatório por período**: Anual = janeiro a dezembro do ano do mês selecionado (rótulo mostra o ano); Trimestral e Semestral terminam no mês selecionado.
- **Acerto de viagem** com movimento bancário: o acerto guarda o vínculo com o lançamento (`linkedTransactionId`); apagar o lançamento reabre o acerto. O reembolso recebido usa a categoria "Reembolsos" (não conta como rendimento de investimento).

## 12. Importação de extrato (OFX/CSV) (`ofxParser.ts`, `BankReconciliationModal`)
- Aceita `.ofx`, `.csv`, `.txt` de **conta corrente**.
- Detecta duplicidade por `FITID`, data e valor; o `FITID` só vale **dentro da mesma conta** do extrato (a mesma chave em outra conta não é repetição); pareia com lançamentos pendentes existentes (quita em vez de criar).
- Linhas de pagamento de fatura passam pela mesma cascata de quitação de cartão.
- Aprende a categoria usual do estabelecimento.
- **Não** lê fatura de cartão linha a linha (limitação conhecida).

## 13. Lembretes e avisos (`reminderRules.ts`, `appNotices.ts`)
- **Sino**: junta atrasos, vencimentos próximos, **faturas de cartão em aberto** (vencidas ou perto de vencer), previsão de saldo negativo, cartão perto do limite e dados para revisar; avisos informativos aparecem sem contar na bolinha.
- Fatura vencida aparece como "Atrasado há Nd" a partir do dia de vencimento do mês de competência da fatura.
- Lembretes por e-mail usam o SMTP do próprio usuário (não verificado em produção).

**Servidor recusa dado incoerente (`validateWorkspaceConsistency`)**: ao gravar, o servidor rejeita lançamento sem tipo, descrição, categoria, valor, data, mês ou situação, que aponte para conta/cartão que não existe, ou com cota compartilhada maior que o valor. Conferido por leitura nos dados reais: os 131 lançamentos existentes cumprem todas as regras (0 órfãos).

**Apagar viagem**: o dinheiro de compras de câmbio da viagem continua no extrato (o lançamento deixa de ser "do lote" e pode ser editado ou apagado normalmente).

## 14. Sincronização e dados (`src/services/workspace/`)
- O workspace é um documento. Gravação com **revisão otimista**: o servidor só aceita se a revisão esperada ainda for a atual; senão responde `409`.
- **Primeiro a gravar vence**; a outra tela recebe a versão nova **em silêncio** (sem aviso, sem piscar) se não houver edição em andamento.
- O app abre na hora com a cópia local (somente leitura) e substitui pela do Neon; nada é gravado antes de o Neon ser lido; a cópia local é apagada ao sair.
- Campo inválido no Neon deixa a sincronização em erro e preserva os dados remotos (não zera nem regrava).
- O backup JSON inclui valores a receber e omite convites familiares e senhas SMTP. A versão 6 identifica o titular no arquivo. Ao restaurar em outra conta, o aplicativo importa os dados portáveis, remove vínculos familiares de origem e mantém pagamentos feitos por terceiros fora do saldo e do resultado pessoal.

## 15. Segurança de acesso (resumo; detalhes em `../tecnico/seguranca.md`)
Senha com hash scrypt; sessão assinada de 30 dias com versão no banco (logout revoga tudo); limites de tentativa; Face ID (WebAuthn) por aparelho; cada consulta ao banco aplica isolamento por usuário (RLS).
