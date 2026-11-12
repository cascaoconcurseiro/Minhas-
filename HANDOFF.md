# Handoff — Minhas Economias

## Orçamento inteligente — 12/11/2026

Etapa 4 do plano de "sistema inteligente". `src/utils/budgetIntelligence.ts`: `suggestBudgets` sugere o teto mensal de cada categoria de consumo pela média gasta nos 3 meses anteriores ao mês aberto (só meses com gasto, mínimo 2; gasto efetivo do usuário via `calculateCategoryBreakdown`; margem de 10% arredondada para cima em dezenas; ignora categorias financeiras/aportes e só sugere quando não há teto ou ele difere 20% ou mais). `assessBudgetPace` avisa, só no mês corrente, quando o gasto passou do teto ("over") ou está adiantado em relação ao mês ("ahead": a partir do dia 5, com 60% ou mais do teto gasto e 20 pontos acima da fração do mês decorrida). `BudgetInsightsCard` aparece na aba Orçamentos (antes do painel de alertas) com os avisos de ritmo e até 4 sugestões, cada uma com "Definir teto de R$ X" que chama `onUpdateCategoryBudget`.

Validação local: `tsc --noEmit`, testes e build passaram (corrigido um erro de ponto flutuante: 900 × 1,1 arredondava para 1.000). Não verificado no navegador. Com os dados atuais do usuário (poucos lançamentos, nenhum mês completo anterior com gasto) as sugestões ainda não aparecem. Próximas etapas: resumo do mês, cartão inteligente, saúde dos dados.

## Importação de extrato inteligente — 12/11/2026

Etapa 3 do plano de "sistema inteligente". `prepareReconciliationCandidates` (`ofxParser.ts`) agora, para cada linha do extrato: (1) sugere a categoria pelo **histórico da pessoa** (`learnCategoryHabit`, em `decisionEngine.ts`) antes das regras de estabelecimento; (2) **casa com a conta pendente** que ela quita — mesmo tipo e valor, data até 7 dias de diferença, nome parecido (ou única pendência com aquele valor); duas possibilidades = não casa; cada pendente é usada por uma linha só; compra de cartão e conta em moeda estrangeira não casam; (3) aplica a **divisão com familiar** aprendida (`learnSharingFromHistory`) em despesas. `convertCandidatesToTransactions` passa `settlesPendingTransactionId` (campo transitório no tipo `Transaction`) e os campos de divisão; `applyReconciledBankTransactions` baixa a pendente (status pago, data real do extrato, FITID, conciliada) em vez de criar duplicata, e nunca persiste o campo transitório. `BankReconciliationModal` mostra em cada linha "Quita a conta pendente …", "Dividido com X (metade) como nas últimas vezes" e "Categoria pelo seu histórico"; recebe `familyMembers` do App. Duplicata real continua sendo apontada e desmarcada.

Validação local: `tsc --noEmit`, testes e build passaram. Não verificado no navegador nem com extrato real. Limites: o casamento é conservador (na dúvida, não casa e a linha entra como lançamento novo para a pessoa decidir); a data do lançamento pendente passa a ser a data real do extrato; não aplica divisão em receitas nem em fatura de cartão. Próximas etapas: orçamento sugerido, resumo do mês, cartão inteligente, saúde dos dados.

## Previsão do saldo dos próximos dias — 12/11/2026

Etapa 2 do plano de "sistema inteligente". `src/utils/cashForecast.ts` (`forecastCashBalance`) projeta o saldo dia a dia por 45 dias a partir de hoje, reaproveitando `calculateDailyCashFlow` mês a mês (contas a pagar e a receber, fixos, parcelas e faturas de cartão no vencimento) e encadeando a virada de mês pelas variações diárias; considera só contas incluídas no total e trata pendências atrasadas de meses anteriores como resolvidas hoje. Devolve saldo de hoje, ponto mais baixo, saldo final e o primeiro dia negativo. `CashForecastCard` (Visão Geral, antes das sugestões de gastos fixos) mostra um gráfico simples, os três números e, se o saldo previsto ficar negativo, um alerta com dia e valor. Sem conta incluída no total o cartão não aparece (o usuário hoje não tem conta cadastrada, só um cartão, então ele ainda não aparece para ele).

Validação local: `tsc --noEmit`, testes e build passaram. Não verificado no navegador nem com dados reais. Limites conhecidos: assume que tudo o que está agendado será pago na data (não prevê atraso), não prevê gastos futuros que ainda não foram lançados (só o que já está agendado), e saldos das contas reserva ficam de fora. Próximas etapas: importação de extrato inteligente, orçamento sugerido, resumo do mês, cartão inteligente, saúde dos dados.

## Assinaturas e gastos fixos detectados automaticamente — 12/11/2026

Etapa 1 do plano de "sistema inteligente" (o usuário recusou o lançamento por frase). `src/utils/recurrenceDetection.ts` (`detectRecurringExpenses`) olha o histórico de despesas avulsas (não parceladas, não fixas, sem viagem/pagamento de fatura) e encontra o que se repete: 3+ meses seguidos (último mês é o atual ou o anterior), valor estável (±10%, "assinatura") ou variável (±40%, "conta de consumo"), dia do mês estável (±4 dias). Devolve o preço atual, o dia, a próxima data esperada, se ainda não apareceu neste mês (3 dias de tolerância) e variação de preço (≥5% contra o valor anterior estável). Não sugere o que já é fixo/parcelado nem o que a pessoa ignorou (`settings.dismissedRecurringKeys`). Na Visão Geral, `RecurringSuggestionsCard` mostra até 3 sugestões com "Prever próximos meses (a partir de dd/mm)", que usa o lançamento fixo já existente (12 meses pendentes, conta/cartão/forma de pagamento do histórico e a divisão com familiar quando é hábito, com a mesma confirmação/desfazer de qualquer lançamento) e um "x" para não sugerir de novo.

Validação local: `tsc --noEmit`, testes e build passaram. Não verificado no navegador nem com dados reais. O usuário ainda não tem lançamentos suficientes (só uma compra parcelada no cartão e duas avulsas) para a detecção aparecer; ela só aparece com 3+ meses seguidos. Próximas etapas: previsão do saldo, importação de extrato inteligente, orçamento sugerido, resumo do mês, cartão inteligente, saúde dos dados.

## Categorias: sem subcategorias e catálogo brasileiro completo — 12/11/2026

Pedido do usuário: só categoria principal e com tudo que o brasileiro usa. Removidas as subcategorias de ponta a ponta: tipos (`Category.subcategories`, `Transaction.subcategoryId`, breakdowns), regras (`financeRules`, sugestão, busca, CSV sem coluna "Subcategoria"), formulário de lançamento, Orçamentos, Configurações e relatórios. Novo catálogo em `seedData.ts` com 47 categorias (12 receitas; despesas essenciais, estilo de vida e financeiras; ícones novos em `CategoryIconBadge`). Os ids existentes foram mantidos (`cat-mercado`, `cat-moradia`, `cat-outros`, `cat-fatura`, `cat-aportes`…); `cat-lazer` agora é só lazer e viagens ganhou `cat-viagens` (lotes de câmbio de viagem usam essa).

Quem já tem dados: `categoryCatalog.ts` (`mergeCategoryCatalog`) acrescenta as categorias novas **uma única vez** por workspace (versão em `settings.categoryCatalogVersion`, hoje 2), sem renomear nem recriar as que a pessoa já tem ou apagou depois, e sem duplicar nome igual já criado; resquícios de subcategoria em categorias e lançamentos são removidos ao carregar (a categoria principal dos lançamentos não muda). Backups antigos com subcategorias continuam sendo aceitos e ignorados. A tabela de palavras-chave de classificação (`ofxParser.ts`) foi refeita para os ids novos com termos brasileiros (sem palavras ambíguas); "mercado livre" vai para compras antes de supermercado.

Validação local: `tsc --noEmit`, 507 testes e build passaram. Não verificado no navegador nem com o workspace real: ao abrir, o usuário deve ver as categorias novas e nenhuma subcategoria. A exportação CSV perdeu uma coluna (formato mudou). Nenhum SQL foi executado; a migração é feita pelo app ao carregar.

## Camada de decisão local (inspirada no Jev/TypeSafe AI) — 12/11/2026

O usuário pediu "algo como o Jev em todo o sistema". Pela descrição que ele colou (não consegui abrir typesafe.ai: host bloqueado pela rede da sessão), o Jev entrega decisões tipadas com confiança (Choice, Score, verdadeiro/falso). Foi construído o mesmo conceito, **localmente e sem enviar dados para fora**: `src/utils/decisionEngine.ts` com `Decision<T>` (valor, confiança, apoio, motivo), `decideChoice` (alternativa dominante no histórico, com peso maior para o recente e confiança menor com pouca evidência), `learnPaymentHabit` (conta, cartão e forma de pagamento usuais por estabelecimento), `assessAmount` (valor muito acima da mediana do lugar, com mínimo de 3 observações e R$ 20 de diferença) e `findProbableDuplicate` (mesma descrição e valor em até 2 dias; ignora parcelas e fixos). Junto com `learningRules.ts` (divisão com familiar) e a categoria por histórico já existente, o formulário de lançamento agora: aplica sozinho categoria, divisão, conta/cartão e forma de pagamento quando o histórico é consistente e só avisa; nunca sobrescreve o que a pessoa já mudou; mostra aviso não bloqueante para valor fora do comum e possível duplicidade.

Decisão pendente do usuário: usar um modelo externo (Jev ou outro) exigiria enviar descrições de lançamentos a um serviço de fora, com custo e chave de API; não foi feito. Próximos candidatos: aplicar as mesmas decisões na importação de extrato (OFX/CSV), detectar assinaturas/recorrências, priorizar notificações por confiança, e a limpeza de categorias (sem subcategorias, lista completa brasileira), ainda não iniciada.

Validação local: `tsc --noEmit`, testes e build passaram. Não verifiquei no navegador.

## Aprende a divisão com o familiar — 12/11/2026

A classificação por histórico já existia (`predictCategoryFromDescription`: depois de uma vez, "apolo" → mercado com ~93% e aplica sozinho). Faltava aprender a divisão. Novo `src/utils/learningRules.ts`: `learnSharingFromHistory` olha as últimas 6 ocorrências do mesmo estabelecimento (nome normalizado; prefixo de 4+ letras casa "apolo supermercado"); só aprende com 2+ divisões, 80% das ocorrências divididas, mesma pessoa, mesmo pagador e proporção estável (±2 pontos); qualquer inconsistência não aplica nada. Ignora viagens, espelhos de outro usuário, pagamento de fatura e familiar removido. No `TransactionModal`, ao digitar a descrição de um lançamento novo, a divisão (familiar, quem pagou, metade ou percentual) é aplicada sozinha e aparece um aviso "Dividido com FRAN (metade, você pagou) porque você costuma fazer assim (3 de 3 vezes)" com "Desfazer"; desfazer ou mexer na divisão manualmente impede que volte; mudar para um estabelecimento sem hábito remove a divisão automática. Só vale para lançamento novo de despesa/cartão.

Validação local: `tsc --noEmit`, testes e build passaram. Não verifiquei no navegador. Não aplicado ainda na importação de extrato (OFX/CSV) nem para receitas.

## Abertura instantânea e silenciosa — 12/11/2026

O app travava numa tela cheia "Carregando seus dados / Conectando ao Neon" até o Neon responder. Agora: (1) ao abrir, mostra na hora a última versão salva no aparelho (`localStorage`, chave `minhas_economias_br_state_v6_<vault>`, validada por `parseCachedWorkspace`), em modo somente leitura (conteúdo `inert`, sem overlay); (2) o Neon é lido em segundo plano e substitui a cópia em silêncio; (3) workspace, convites e compartilhados passam a ser buscados em paralelo (antes os dois últimos esperavam o primeiro); (4) primeira abertura num aparelho sem cópia mostra só um indicador discreto, sem texto; (5) se o Neon falhar e já houver cópia na tela, aparece um aviso não bloqueante com "Tentar novamente"; sem cópia, continua o diálogo de erro que não abre workspace vazio. Segurança mantida: nada é gravado no Neon nem na cópia antes de o Neon ser lido com sucesso (`hasLoadedRemoteOnceRef`), a senha SMTP nunca vai para a cópia, e ela é apagada ao sair da conta ou trocar de usuário. Isso reverte a remoção do cache feita no PR #11: o cache voltou, agora com leitura.

Validação local: `tsc --noEmit`, 488 testes (harness do App com 10 cenários, incluindo abertura com cópia e Neon fora do ar) e build passaram. Não medi o tempo real em produção nem vi no navegador. Próximo passo: abrir o app autenticado, recarregar e confirmar que não aparece mais a tela de carregamento; se a primeira abertura num aparelho novo ainda parecer lenta, o gargalo é a função da Vercel/Neon (partida a frio), não a interface.

## Reembolso no mês da cobrança e calendário só com o total — 12/11/2026

Pedido do usuário após ver o app: (1) o aviso "Reembolso de FRAN" aparecia no dia seguinte à compra no cartão; agora a data de cobrança do rateio é o vencimento da fatura (`competenceMonth` + `dueDay` do cartão) ou a data do lançamento sem cartão, e o aviso só entra a partir de 3 dias antes (`calculateDailyReminders`). (2) Cada dia do calendário mensal mostra só o total (gasto em vermelho, recebido em verde); a lista de lançamentos fica no detalhamento abaixo. O total vem de `calculateCalendarCellTotals`: compra parcelada conta pelo total da compra, pagamento de fatura e transferência ficam de fora, e o filtro ativo do calendário é respeitado. Os pontos de conta pendente e fatura em aberto continuam; fatura de R$ 0,00 deixou de aparecer como cartão.

Também removido o banner flutuante "Instalar App no Celular" (`PWAInstallButton variant="banner"` no `App.tsx`); o botão "Instalar App" continua dentro do menu do celular.

Validação local: `tsc --noEmit`, 485 testes e build passaram. Não verifiquei visualmente no navegador. Decisão tomada sem confirmação: o total do dia inclui compras no cartão (na data da compra); se preferir só o que sai do caixa, trocar por `calculateCalendarDaySummary`.

## Saldo de hoje, notificações enxutas e Neon como fonte única — 12/11/2026

Corrigidas as inconsistências levantadas na análise de 12/11. (1) Patrimônio, saldo total e investimentos agora partem de `calculateCurrentPosition` (data de hoje) e não mudam ao navegar entre meses; o mês navegado continua mostrando o saldo ao fim daquele mês. App, Visão Geral (Raio-X 360) e DRE recebem `currentPosition`. (2) `calculateDailyReminders` não depende mais de `selectedMonth`: avisa atrasados de qualquer mês, vencimentos de hoje e dos próximos dias (faturas pela antecedência configurada, contas em 3 dias); itens distantes saem da lista e ficam em "Contas a pagar". Respeita `notifyRecurringEntries` e ignora gasto pago por familiar. (3) Regra única `isPendingBankObligation` usada pela Visão Geral e pelas notificações. (4) Central de notificações reduzida a avisos (sem filtros, rodapé e "Ver detalhes"); convites de família recebidos passaram do banner fixo para dentro dela e contam no sino. (5) Removida a cópia financeira em `localStorage` (nunca era lida); cópias antigas são apagadas ao abrir o app.

Banco Neon conferido em 12/11 (somente leitura): RLS ativo, papéis restritos, dados do titular consistentes (cartão Itaú azul, 12 parcelas somando R$ 1.435,00). Apagados 4 workspaces órfãos do Firebase (sem lançamentos), após snapshot `antes-da-limpeza-2026-11-12`. Retenção de 6 h e branch sem proteção são limites do plano gratuito; só subir de plano resolve.

Validação local: `tsc --noEmit`, 483 testes e build PWA passaram. Não verifiquei visualmente no navegador nem em produção. Próximo passo: abrir o app autenticado e conferir sino, convite e patrimônio; o usuário ainda não tem conta bancária cadastrada (só um cartão), então saldo e patrimônio aparecem zerados até cadastrar uma; limite do cartão está R$ 83.000,00 (confirmar se não era R$ 830,00).

## Exibição de compras parceladas no cartão — 12/11/2026

Corrigida a origem da duplicação na lista de lançamentos e no calendário: as parcelas mensais de uma compra no cartão eram renderizadas como lançamentos em cada competência. `getLedgerTransactionsForMonth` reaproveita a compra agrupada para mostrar total e parcela uma vez na data original; a etiqueta da compra mostra o total (R$ 1.435,00) e o valor correto de cada parcela (R$ 119,59). O total diário não soma novamente o cartão, parcelamentos sem cartão continuam agendados nos meses devidos, e dados da fatura/cartão seguem intactos.

PR #7 e PR #8 foram integrados à `main`; CI, testes PostgreSQL e previews passaram. Produção Vercel Ready no deploy `dpl_BiNCoibZ2AKR4m6VCNQ7Z5V4HfkC`, servido em `https://minhaseconomias-blue.vercel.app`; `/api/status` responde 200. Conferi a sessão autenticada no navegador: novembro mostra uma compra com total e parcela corretos sem o valor repetido no topo diário; dezembro não lista a parcela no calendário nem no extrato, mas mantém a fatura do cartão. Nenhum dado financeiro foi migrado.

Alterados `src/utils/financeRules.ts`, `src/components/TransactionsTab.tsx` e `src/components/MonthlyCalendarView.tsx`. Próximo passo: continuar QA autenticado de leitura nos demais módulos, sem editar lançamentos reais; a cobertura de todos os fluxos financeiros ainda não foi concluída.

## Produção publicada e workspace validado — 11/11/2026

A captura do usuário mostrava o workspace bloqueado. A causa foi uma falha de import ESM em `src/utils/sharedFinanceRules.js` no runtime Node 26. Extraída a validação pura para `src/utils/sharedSettlementReceipts.ts`; `backend/app.ts` importa esse módulo sem dependências de interface e `src/utils/sharedFinanceRules.ts` mantém a reexportação para o cliente. As alterações existentes, inclusive `.claude/launch.json`, foram incluídas conforme pedido.

O commit foi integrado à `main` pelo PR #4, merge `920da4d35cda0e5ae64da37f63120e75d2d96a47`, com CI e preview aprovados. Vercel Production está Ready em `https://minhaseconomias-blue.vercel.app`. Em sessão autenticada real, a mensagem persistiu na aba já aberta; após recarregar e aguardar a hidratação, o workspace e a Visão Geral carregaram. Logs confirmaram `GET /api/workspace` 200, `PUT /api/workspace` 200 e chamadas de família 200. `/api/status` retornou 200. Nenhum dado financeiro foi lido ou alterado manualmente.

Próximo passo concreto: continuar QA autenticado de leitura em `src/App.tsx` e nos módulos principais, sem editar lançamentos reais; investigar qualquer erro observado antes de declarar cobertura de todos os fluxos. A verificação concluída confirma deploy e abertura do workspace, mas não certifica todos os fluxos financeiros.

## Metas e exclusão de ativos — continuação

Confirmado deploy a484399 success; CI43124282163 passou467 testes, lint/build e PostgreSQL. Agora `handleContributeGoal` usa `createGoalInvestmentContribution` para validar aporte vinculado antes de mudar estado, gerar transferência em vez de despesa, preservar cotação e derivar saldo da posição. Rejeita valor que não corresponde à quantidade em4 casas em vez de debitar montante diferente. Data escolhida/local no movimento e competência. Meta sem ativo é reserva do dinheiro existente, sem transação ou seletor de débito. Pergunta opcional enviada sobre conta de destino; sem resposta, adotada reserva simples. `getInvestmentDeletionRestriction` impede excluir saldo/histórico/meta e remove conversão destrutiva de transações.

Suíte completa472/472 em59 arquivos, lint/build85 entradas. Última mudança só esconde data para reserva simples;15 testes da tela e lint passaram depois. Relatório atualizado para64 achados (17P0/47P1). Sem SQL ou edição histórica. Espaço Ego1 ownership agentDelegatedToUser; não retomado. Próximo passo: conferir CI/deploy do commit desta etapa e revisar `GoalsAndSimulatorTab.getEffectiveGoalAmount`/total de metas (duas metas podem contar o mesmo ativo inteiro), a edição de operações de investimento e sua reconciliação com a carteira. QA visual e zero-net persistido/concorrência de revogação continuam abertos. Convite Fran segue pendência de aceite pela própria destinatária.

## Investimentos: principal e data — 11/11

Corrigido novo aporte/resgate: `createInvestmentCashMovement` produz transferência entre conta e ativo, evitando receita de principal e despesa de consumo. DRE só conta transferência de saída como contribuição. `InvestmentsTab` recebe data escolhida (padrão dia local), repassada a operações/proventos no App; competência segue a data, removendo dias15/25 arbitrários. Validações de conta, quantidade, preço, centavos seguros, oversell e data antes da mutação vinculada. Não reclassificados históricos; sem migration SQL.

Suíte completa passou466 testes/59 arquivos e build PWA85 entradas. Depois da última validação de data de dividendo e teste de data escolhida, testes direcionados passaram e lint precisa ser confirmado no commit final. Deploy anterior6b7e6f2 confirmado success via status Vercel. Relatório60 achados. Próximo passo concreto: revisar `handleContributeGoal` em App.tsx (data do aporte e arredondamento de quantidade versus dinheiro debitado), depois exclusão de ativos com histórico, e QA visual do formulário de investimentos. Pendências bilaterais/Fran permanecem, não declarar auditoria completa.

## PostgreSQL real verificado — 11/11

Job real concluído com sucesso: GitHub run 43123175391 no commit 3d40aef (job PostgreSQL ID 130868518475 e suíte/build ID 130868518319). Log contém PASS para 9 migrations reais, 3 cadastros com papel restrito, compartilhamento/RLS de terceiro, acerto bilateral preservado em upsert, recibo persistido + leitura independente + reload + baixa repetida + reabertura, concorrência 200/409 e revogação removendo cópias/avisos. Fonte: https://github.com/cascaoconcurseiro/Minhas-/actions/runs/43123175391 . Banco PostgreSQL17 descartável no CI, sem dados reais.

Falha real encontrada/corrigida: migration007 renomeava NOT NULL inexistente no PG17 (run43122819874, erro42704). Agora condicional via pg_constraint. Run seguinte aplicou migrations, mas roteiro esperava200 no POST de convite; corrigido para201 sem mudança de produto. Run final passou. Relatório atualizado para58 achados. Deploy c47c029 de recibos confirmado success; deploy3d40aef ainda pending na última consulta. Nenhuma SQL executada na produção.

Próximo passo concreto: ampliar prova para compensação zero persistida, rollback/concorrência de revogação, e ciclo visual com duas identidades QA; seguir inventário de contas/metas/investimentos/viagens/importação. Não confundir integração API real no CI com QA de todas as telas/Neon produtivo. Convite real Fran permanece fora de fixtures e não foi aceito em nome dela.

## QA PostgreSQL real no CI — 11/11

Preparado job `postgres` em `.github/workflows/ci.yml`: serviço PostgreSQL 17 descartável, banco neondb vazio, sem credenciais de produção. `scripts/qa-postgres.ts` exige CI=true, host localhost/127.0.0.1 e banco vazio antes de aplicar todas as migrations reais. Cria três usuários sintéticos pela API sob papel restrito, testa convite/espelho/RLS, retorno e reenvio do acerto, recibo persistido/reload/reabertura, conflito de revisão e revogação. Lint e diff-check passaram; execução real ainda pendente até terminar o job no GitHub. Não considerar cenário concluído antes de examinar log/conclusão desse job. A próxima etapa concreta é acompanhar esse run e corrigir qualquer SQL/comportamento que falhar. Nenhum dado de usuário real é usado.

## Recibos locais dos acertos recebidos — 11/11

Reproduzida perda de sharedSettlementId/conta em espelhos após reload: espelhos não entram em transactionsJson. Adicionado campo opcional `sharedSettlementReceiptsJson` ao JSON do workspace, computado das cópias atuais. Apenas identidade do espelho, status local, grupo, conta e data; sem duplicar dados da compra. App restaura recibos ao hidratar e os inclui no backup; restauração só aplica recibos do mesmo titular. `parseSharedSettlementReceipts` valida API/cliente/backup. Snapshot remoto agora preserva status/grupo/conta/data locais e transforma status do outro usuário em aviso. Legado com movimento `[ref:...]` reconstrói vínculo; compensações antigas de zero sem recibo continuam sem reconstrução confiável.

Inicialização não transforma mais falha de leitura compartilhada em lista vazia; falha leva ao tratamento de erro/retry do carregamento. Regressões de reload zero/baixa/reabertura, ausência de auto-confirmação de caixa e validação do recibo. Suíte completa 463/463 em 59 arquivos + lint/build PWA 85 entradas; adicionado depois teste de backup, 17 testes de backup passaram. Não acessado banco real; Docker local foi sondado e está sem daemon disponível, então não há PostgreSQL real validado. QA remoto e confirmação do deploy 68dc3e8 ainda pendentes na última consulta.

Próximo passo: confirmar deploy e testar ciclo em banco QA com duas identidades (não usar convite real da Fran como fixture). Conferir recibo após fechar/reabrir, baixa repetida e reabertura do grupo, RLS do remetente/destinatário e falha de rede no carregamento. Sem migration SQL: recibos são campo JSON opcional. Atualizar prova de execução SQL independente antes de fechar sincronização bilateral.

## Retorno bilateral de acerto implementado — 11/11

Deploy 23a4c02 confirmado success via GitHub. Backend agora mantém `recipientSharedStatus`/`recipientSettledDate` no JSON de compartilhamento, separados do estado do remetente. PUT do espelho só muda esses campos; upsert do remetente os preserva. GET de recebidos resolve estado do destinatário no payload e retorna `outgoingSettlements` só para `sender_user_id` autenticado. `loadNeonSharedSnapshot` e App consomem os avisos no carregamento e polling. `applyRemoteSettlementReports` grava apenas aviso remoto, nunca cria/estorna caixa ou sobrescreve sharedStatus/conta/acerto local. SharedExpensesTab mostra aviso de acerto ou reabertura pela outra pessoa com orientação para conferir. Snapshot de espelho mantém IDs de conta/acerto locais se ambos os estados permanecem received. Backup de outro titular e duplicação removem metadados remotos.

Sem migration SQL; somente campos JSON opcionais. Testes de API usam PostgreSQL simulado, não provam execução SQL real. Regressões incluem retorno ao remetente, reenvio preservando estado, reabertura, saldo inalterado por aviso remoto e identidade bancária local preservada. Harness de orquestração atualizado para o novo contrato. Nenhum dado real alterado. QA remoto com duas identidades continua obrigatório antes de fechar a pendência; convite Fran segue invited e não foi aceito em nome dela.

Próximo passo concreto: verificar schema/RLS de `finance_shared_transactions` para acesso do remetente ao próprio estado, testar SQL/upsert e ciclo com duas identidades QA em banco isolado, incluindo reabertura do grupo e atualização concorrente; conferir ausência de perda de identidade de acerto local ao recarregar (espelhos não são persistidos no workspace pessoal, pode exigir estratégia própria). Relatório 56 achados tabelados.

## Meta ampla retomada e edição/duplicação — 11/11

Nova meta explícita ativa cobre sistema inteiro, fonte persistida única e regras compartilhadas, interface simples, correções/verificação/publicação e pendências bilaterais. Confirmado deploy afce37b success via GitHub. Diff de edição/duplicação do turno anterior revalidado: `duplicateFinancialTransaction` remove vínculos de parcela/acerto/importação e rejeita copiar liquidações/reembolsos/espelhos; cópia compartilhada recebe ID novo, cota pending e dispara sincronização. `getTransactionEditRestriction` bloqueia editar genericamente acertos recebidos e movimentos vinculados; aplicado na abertura e em `applyCascadeTransactionEdit`. Localizar no extrato usa mês da data, não competência.

Validação anterior do mesmo patch base: 459 testes em 59 arquivos, lint/build aprovados. Após ligar sincronização da cópia, 62 testes direcionados de domínio/extrato, lint e build (84 entradas PWA) passaram. Não acessados dados reais nesta etapa. Relatório atualizado para 55 achados tabelados (16 P0,39 P1). Próximo passo prioritário continua retorno bilateral de estado de acerto: backend GET só entrega recebidos, e remetente não consome atualizações de status da sua própria transação; desenhar sem copiar accountId entre usuários, criar regressões de API/cliente e comprovar com identidades QA. Convite Fran em invited exige aceite por ela; não enviar mensagem nem aceitar em nome dela. Teste de navegação visual do extrato e validação de todos os módulos ainda pendentes.

## Auditoria técnica retirada da navegação — 11/11

Pedido do usuário: não exibir auditoria contábil/serviços ao lado do sino; executar verificações automaticamente. Removidos botão header-system-verifier, atalho de Overview, lazy mount do ExpertSystemReviewModal e handler manual de reparo. O componente antigo permanece no repositório sem ponto de entrada em App. `runFinancialIntegrityAudit` agora roda por useMemo após hidratação válida do usuário e mudanças do estado financeiro; não modifica dados. Estado saudável é silencioso; divergência mostra aviso simples e ação Conferir lançamentos. Validação de persistência/API continua automática como antes.

Não automatizado o saneador heurístico que presume datas/moedas/contas: ele segue apenas no fluxo de importação já existente e não foi acionado em dados reais. A aba técnica antiga AuthAndCloud continua no código, mas não recebe mais callback de reparo. Não afirmar que a simples auditoria de estado repara toda inconsistência financeira. Próximo passo: conferir UI publicada e revisar/remove a aba técnica antiga caso ainda haja rota pública; manter pendências da sincronização bilateral abertas.

Verificação: suíte completa 456/456 em 59 arquivos, lint passou; teste adicional de ausência de auditoria na visão geral passou com 5 testes do componente. Deploy b95e376 do formato do cartão confirmado success via GitHub. Nenhum dado de produção alterado.

## Proporção visual do cartão — 11/11

Usuário mostrou CreditCardFace achatado. Componente usava largura total com altura fixa h-28; compact também misturava w-full com largura específica. Agora ambas as variantes usam aspect 1.586/1; standard limita largura a 320px e detalhe em CreditCardsTab usa wrapper com mesmo limite. Sombra reduzida e cantos/proporção ajustados.

Verificação visual local com o componente real renderizado via React + CSS do build: desktop 320x201,75 e mobile 390px com cartão 300x189,14, sem overflow. PNGs em `C:/Users/Wesley/AppData/Local/Temp/minhas-card-visual/`; fixture e servidor temporários fora do Git, servidor encerrado. Lint e build PWA (86 entradas) passaram. Não representa QA visual de toda a tela em produção. Espaço Ego 1 devolvido ao usuário, aba temporária p2 fechada. Próximo passo: confirmar deploy e renderização na listagem real; persistem pendências da lógica financeira documentadas abaixo.

## Central de notificações simplificada — 11/11

Pedido do usuário: sino deve ter só notificações; configurações ficam no local próprio. `ReminderCenterModal` agora contém lista/filtros/ações dos avisos e atalho acessível para a aba reminders em `SettingsModal`. Retirados painel de canais/horários, SMTP, permissões/testes de envio, cartões de resumo financeiro e estado dos canais no rodapé. Configurações já existiam em SettingsModal; nenhuma preferência ou dado persistido foi removido. Removidas props e lógica duplicadas de configuração/envio no modal e no App.

Verificações: 18 testes direcionados entre notificações/configurações; suíte completa 456/456 em 59 arquivos, lint e build PWA (86 entradas) passaram. Depois de limpar fixtures de testes obsoletos, lint e 3 testes do modal passaram. A redução de testes corresponde à retirada de testes da configuração duplicada; SettingsModal mantém testes dos campos e canais. QA visual desta revisão ainda não foi executado no navegador. Deploy anterior faab761 do total semanal confirmado success via GitHub. Próximo passo: conferir deploy desta simplificação e renderização do sino, mantendo pendências financeiras anteriores abertas.

## Compras semanais pelo total original — 11/11

Usuário esclareceu pela captura que o quadro semanal deve representar o total da compra, e não a parcela. `getPurchaseTransactionsForMonth` em `financeRules.ts` agrupa séries, conta uma compra na data da primeira parcela e usa `installmentPurchaseTotal`. Sem esse metadado, só infere por soma se todos os números de parcela estiverem presentes; série incompleta não vira preço presumido. Linhas de parcela divididas por pagamento parcial não duplicam o total salvo. Próximas parcelas não geram nova compra nas semanas futuras. `calculateWeeklyCashPulse` consome essa seleção; título/texto explicam “Compras por Semana”. Orçamento e faturas continuam por parcela, por decisão expressa do usuário. Nenhum registro do banco alterado nesta etapa.

Regressões: compra novembro/fatura dezembro retorna total 1435 na semana 2; primeira parcela dividida + segunda parcela contam total 300 uma única vez em novembro e zero compras em dezembro; fallback de série completa e rejeição de série incompleta. Próximo passo: conferir deploy e quadro semanal no navegador após o usuário devolver controle; continuar pendências de sincronização bilateral e convite Fran registradas abaixo.

## Correção real da cota da Fran — 11/11

Captura do usuário mostrou parcela 119,59 cobrando cota total 717,50 em dezembro. GET autenticado confirmou revisão 43 com primeira cota 717,50 e demais 59,79, todas pending. Backup completo em `C:/Users/Wesley/Documents/CodexBackups/Minhas-20261111/fran-before.json`. Corrigidas somente cotas da série Amazon para somar 717,50 em 12 meses (primeiras duas 59,80, demais 59,79), preservando demais campos. PUT revisão esperada 43 e GET independente confirmaram revisão 44, salvo em `fran-after.json`. Navegador autenticado confirmou dezembro recebendo 59,80 sem cobrança 717,50.

Tentativa autorizada de atualizar cópia remota retornou 403: API de convites retorna `invited`, não accepted. Não marcar cópia da Fran como corrigida; depende de vínculo aceito. A tela tinha texto fixo “Convite Aceito”/“Sincronizado” mesmo nesse estado; ajustado para consultar status e não afirmar sincronização. Também corrigido rótulo que chamava valor da parcela de total da compra.

Resumo agora separa cotas futuras das do mês; mensagem copiada inclui número da parcela; botão explicita liquidar este mês. Teste confirma liquidação de dezembro baixa só 59,80, deixa 11 parcelas pendentes e mostra 657,70 futuros. Suíte completa passou 458/458 antes dos dois últimos ajustes de texto, depois 30 testes direcionados + lint/build passaram. Deploy anterior `e1c2929` confirmado success. Espaço Ego 1 entregue ao usuário em dezembro/Compartilhado; nenhuma mensagem enviada à Fran.

## Cópias recebidas e remoção remota — continuação de 11/11

Deploy `d79e019` confirmado pelo status Vercel no GitHub (`gh api`, success). Corrigida regressão do filtro doméstico: cópias `tx-mirror-` com `isCompanionOnlyExpense` precisam entrar no compartilhamento, embora não debitem banco como compra original. Teste cobre resumo, baixa e saldo único de pagamento. Atualização periódica agora usa `replaceIncomingSharedTransactions` em vez de unir com cópias antigas; remove ausentes/revogadas somente após resposta bem-sucedida, preservando transações próprias. Backend preserva `installmentPurchaseTotal` na cópia, com regressão no endpoint.

Problema ainda aberto identificado nesta revisão: `/api/family/shared` GET retorna apenas linhas recebidas. Quando o destinatário muda `sharedStatus`, o PUT atualiza o payload compartilhado, mas o remetente lê sua transação própria do workspace, sem consumir esse estado de volta. Não afirmar sincronização bilateral concluída. Próximo passo concreto: desenhar e implementar retorno de estado de acerto para o remetente sem misturar os IDs locais de conta/acerto dos dois usuários nem criar movimentos bancários fictícios; conferir `backend/app.ts:GET/PUT /api/family/shared` e hidratação/poll em `App.tsx`. QA real entre identidades continua pendente. Nenhum dado produtivo alterado nesta continuação.

## Liquidação compartilhada centralizada — continuação de 11/11

Deploy `ffc50f2` das cotas confirmado com sucesso na verificação Vercel. Criado domínio `sharedFinanceRules.ts`: seleção doméstica, resumo por membro, baixa idempotente com validação de conta/data e reabertura. App e `SharedExpensesTab` substituíram somas e mutações locais por essas funções. Todo novo acerto (inclusive saldo zero) recebe `sharedSettlementId` no JSON; backup do titular preserva, restauração de outro titular remove o vínculo. Não exige migration SQL.

`getSharedSettlementLinks` em `financeRules.ts` é usado pela reabertura e pela exclusão individual/em série, resolvendo vínculos explícitos atuais ou refs legadas, sem excluir/reabrir por mera coincidência de descrição/data. Resumo de quitado no mês usa data do acerto. Testes cobrem saldo positivo, compensação zero, repetição da baixa, reversão de caixa, exclusão, dois acertos no mesmo dia, conta/data inválidas, viagem excluída e portabilidade do backup. Blueprint atualizado pela nova divisão do domínio.

Limite histórico: compensações antigas de saldo zero sem identificador e sem movimento com refs não têm informação suficiente para reconstruir o grupo; não inferir automaticamente. QA remoto entre identidades ainda pendente e nenhum registro produtivo foi alterado nesta continuação. Próximo passo: revisar espelhamento de cotas e remoção de compartilhamento nos endpoints `backend/app.ts` e cliente; conferir consistência do vínculo de acerto ao receber atualizações de outra identidade.

## Cotas compartilhadas de parcelas — continuação de 11/11

Corrigido `applyCascadeTransactionEdit` para não atribuir a cota da compra inteira à parcela editada: distribui o total de cotas entre linhas ajustáveis proporcionalmente aos valores, em centavos com BigInt para o produto, preservando linhas pagas e cotas `received`. Bloqueia soma compartilhada abaixo do histórico preservado, acima da capacidade das parcelas e redução de parcela abaixo de cota já acertada. Ao remover compartilhamento, só limpa campos de linhas ajustáveis; mantém histórico preservado.

`calculateSharedAmount` resolve cota total tanto no submit quanto na prévia. `previewCategoryBudget` retorna a cota da parcela efetivamente resultante; o modal usa esse valor. Campo personalizado reabre com a soma das cotas da série completa e explicita cota total da compra. Regressões cobrem proporção, centavos, paid/received, limites e hidratação do campo. Relatório agora tem 45 achados tabelados. Nenhum dado produtivo foi alterado.

Próximo passo: terminar inventário de compartilhamentos e centralizar `SharedExpensesTab:memberSummaries` com as regras de liquidação usadas pelo App; conferir desvinculação/remoção de compartilhamento e espelhamento. A suíte/preview local não substitui QA remoto do acerto entre identidades. Espaço Ego continua entregue ao usuário.

## Recorrências e dividendos — continuação de 11/11

Deploy `f723328` do patrimônio confirmado com sucesso na verificação Vercel. `calculateCreditCardSummary` agora aceita data de referência opcional (padrão data local atual) e não consome limite com recorrências `fixed` ainda futuras. Mantém todas as parcelas pendentes de compras contratadas no limite e preserva cobranças recorrentes na previsão da fatura futura. Regressão diferencia essas operações e a passagem da data de referência.

`isInvestmentIncome` compartilha a classificação de proventos entre DRE e investimentos; `calculateInvestmentIncomeSummary` fornece lista e totais em centavos. Tela de investimentos não inclui mais reembolsos/familiares como proventos e explicita registros recebidos e previstos. Relatório atualizado para 43 achados tabelados. Nenhum dado produtivo foi alterado nesta continuação. Próximo ponto concreto: revisar compartilhamentos em `SharedExpensesTab` e a coerência dos previews de divisão no `TransactionModal`; consolidar o inventário de regras antes de considerar a meta concluída.

## Patrimônio compartilhado — continuação de 11/11

Deploy `fdcad78` da prévia de orçamento confirmado com sucesso na verificação Vercel. Extraído `calculateNetWorth` em `financeRules.ts` para DRE/saúde financeira: contas + investimentos - dívida dos cartões. `ReportsAndDataTab` agora passa os mesmos resumos de cartão do domínio e exibe dívida na composição do patrimônio líquido. Overview reutiliza a liquidez calculada pelo domínio. Corrigido o estado inicial da saúde financeira para não zerar dívida quando ainda não há conta bancária/investimento nem despesa no mês da fatura selecionado.

Regressão reproduz compra parcelada de R$ 1.435,00 em novembro com primeira competência dezembro e nenhuma conta: os dois relatórios retornam patrimônio líquido -R$ 1.435,00, dívida R$ 1.435,00, fatura novembro zero e saúde fora do modo inicial. Próximos pontos concretos: avaliar `calculateCreditCardSummary:usedLimit` para separar recorrências futuras planejadas de parcelas de compra já contratada; conferir seleção de dividendos em `InvestmentsTab.tsx:monthDividendTransactions`, ainda filtrada localmente. Não há alteração de registros produtivos nesta continuação.

## Prévia de orçamento consolidada — continuação de 11/11

`TransactionModal` não recebe mais `categoryBreakdown` do mês aberto. Usa `previewCategoryBudget` em `financeRules.ts`, com a competência que será salva. A prévia reutiliza a geração de parcelas, edição em cascata (com parcelas pagas preservadas) e soma por categoria. O rodapé usa o valor da parcela resultante, inclusive ao editar o total original; categorias sem orçamento continuam fornecendo impacto mensal. A função duplicada `calculateBudgetImpactPreview` foi removida de `uxEnhancementRules`, e suas verificações de alerta foram portadas para a regra atual.

Regressões cobrem compra em novembro faturada em dezembro, rateio de R$ 0,08/5, total editado preservando parcela paga, aviso de limite e orçamento inexistente. Teste do modal compara os R$ 90,00 corretos de dezembro aos R$ 340,00 indevidos do mês aberto. Próximo passo após publicar: continuar inventário das regras restantes, incluindo preview de compartilhamentos/viagens e cálculos de patrimônio; não afirmar consolidação global concluída. Espaço Ego permanece entregue ao usuário, sem novo acesso à sessão nesta continuação.

## Consolidação do DRE — continuação de 11/11

Deploy `0a33f83` do extrato confirmado com sucesso na verificação Vercel. Na revisão global, `ReportsAndDataTab` ainda possuía DRE próprio com cota de familiar presumida em 50% quando ausente e receita do familiar incluída. Extraído `calculatePersonalDre` para `financeRules.ts`, usando `getEffectiveExpenseAmountForUser` e a mesma exclusão de receita do familiar do resumo mensal. Regressão compara resultados com `calculateMonthlySummary`; 58 testes direcionados passaram. Relatório atualizado para 38 achados tabelados, incluindo divergência calendário/extrato e DRE.

Inventário confirmado: `App.tsx` já calcula saldo de contas, resumo de cartão, resumo mensal e categorias via `financeRules.ts`; `BudgetsTab` soma os resultados de categorias recebidos; relatórios de período e fluxo diário também já chamam o domínio. Próximo ponto concreto: `TransactionModal.tsx:1240`, `liveBudgetImpact`, usa `categoryBreakdown` do mês selecionado mesmo quando a fatura inferida é de outro mês. Conferir também o rateio do rascunho e a edição do total original, pois a prévia deve usar a mesma parcela/competência que será salva. Não alterar dados produtivos para esse teste; usar fixture sintética.

## Fonte única de dados e regras — continuação de 11/11

Verificação real após deploy `68b3c08`: navegador autenticado mostrou 1 item parcelado, despesas nas datas do mês R$ 119,62 e semana 2 com 1 movimento/R$ 119,62, mantendo contas bancárias e fatura de novembro zeradas. O PWA estava instalando nova versão após reload e depois atualizou automaticamente; não houve limpeza de cache. Formulário confirmado sem miniatura/bandeira nem aviso de mês, com data padrão 11/11. Total principal no calendário confirmado R$ 1.435,00 em 12x / parcela 1/12 R$ 119,62. Suíte completa anterior: 440/440; após ajuste do extrato, 8 testes do componente passaram (incluindo regressão de data x competência), lint/build passaram. Commit `0a33f83` enviado a main, verificação Vercel ainda pendente na última consulta; confirmar publicação desse ajuste específico do extrato. Espaço Ego 1 entregue ao usuário com calendário aberto; retomar somente quando usuário devolver controle. Próximo trabalho independente: inventário e consolidação global de regras descritos no relatório.

Outro consumidor corrigido: o extrato de `TransactionsTab` agora usa o mesmo seletor por data do calendário, evitando “Extrato (0)” no mês em que a compra foi feita e mostrada na grade. Orçamento permanece por competência/parcela por decisão explícita do usuário. O nome atual do seletor ainda é `getCalendarTransactionsForMonth`, compartilhado também pelo extrato; avaliar nome por domínio na consolidação global.

Usuário ampliou explicitamente a exigência para todo o sistema: mesma fonte persistida e mesmas regras em todas as telas. Evidência atual: calendário mapeava por data, mas indicadores/semanas filtravam por competência, omitindo Amazon em novembro. Centralizado o filtro `getCalendarTransactionsForMonth` em `financeRules.ts`, usado por indicadores, seleção inicial e semanas. Regressão em `uxEnhancementRules.test.ts` cobre compra de novembro/fatura dezembro. Fatura novembro continua corretamente zero; contas bancárias a vencer também, pois não há débito bancário nesse mês. Quantidade de recorrentes e movimentações passam a refletir a grade. Não confundir essa correção com conclusão da consolidação global: próximo passo concreto é mapear cálculos locais de cada módulo listado no relatório e movê-los para regras de domínio compartilhadas.

## Decisão de apresentação e orçamento — 2026-11-11

O usuário confirmou explicitamente orçamento distribuído por parcela. Calendário, detalhes e extrato devem destacar o total original primeiro, seguido de número de parcelas e valor da parcela corrente. Os totais agregados seguem por parcela; não somar o total original a cada mês. Na série Amazon preservada, a primeira parcela é R$ 119,62 e as outras R$ 119,58, somando R$ 1.435,00; apresentar valor da parcela corrente sem sugerir que todas têm valor idêntico.

## Ajustes solicitados nas capturas — 2026-11-11

Removidos do formulário de compra: miniatura do cartão, bandeira redundante e aviso com mês estimado. O cálculo automático da fatura continua funcionando; o ajuste manual permanece recolhido. Na listagem e detalhe do cartão, fatura zerada passa a dizer “Sem fatura no mês” em vez de “Sem Gastos”, pois pode haver compras comprometendo limite em outras competências. Regressões do modal, lint e build PWA passaram. Conferir deploy e navegador autenticado após publicação.

## Retorno do usuário sobre compra no dia 15 — 2026-11-11

Atualização após login autorizado: backup JSON integral salvo fora do Git em `C:/Users/Wesley/Documents/CodexBackups/Minhas-20261111/`. A leitura autenticada identificou uma única série Amazon de 12 parcelas somando R$ 1.435,00, sem total original e iniciando em 15/11. Corrigi somente a data da primeira parcela para 11/11 e preenchi `installmentPurchaseTotal=1435` nas 12 linhas. PUT com revisão esperada 26 e GET independente confirmaram revisão 27 e igualdade com o patch esperado, preservando todos os demais campos das transações. Backups antes/depois da API estão no mesmo diretório privado. As afirmações históricas abaixo sobre ausência de acesso a produção foram superadas por esta operação autorizada.

O calendário recebeu destaque visível para total da compra e quantidade de parcelas na primeira parcela, inclusive em telas pequenas. Login não pede mais para conferir sincronização. Documentação de autenticação atualizada. Lint, build PWA (88 entradas) e diff-check passaram. Próximo passo: publicar e conferir renderização no navegador autenticado.

O usuário confirmou que sua compra de 11/11 continua no dia 15, com destaque apenas para a parcela. A publicação corrigiu a data padrão de novos lançamentos, mas não corrigiu a data já persistida desse histórico; a entrega desse caso permanece incompleta. O calendário agrupa por `tx.date` em `MonthlyCalendarView.tsx:139`, e o total original no cartão do calendário aparece no tooltip/detalhe, enquanto o valor principal continua sendo a parcela. É necessário identificar e conferir o registro autenticado antes de corrigir a data; não inferir pela competência da fatura.

O espaço Ego `minhas-financeiro-qa` (ID 1) abriu a produção sem sessão autenticada. Controle entregue ao usuário para login; foi solicitado também descrição/valor total da compra. Retomar o mesmo espaço após confirmação. Alterações locais ainda não publicadas: textos da tela de login retirando instrução de conferir sincronização e referências técnicas ao Neon; correção da documentação de autenticação em `docs/NEON_MIGRATION.md`. Lint e build passaram após essas alterações. Nenhum dado financeiro remoto foi lido ou alterado.

## Publicação da auditoria financeira — 2026-11-11

As correções da auditoria financeira foram enviadas ao GitHub `main` no commit `1f9c139`; a verificação Vercel no GitHub concluiu com sucesso e `https://minhaseconomias-blue.vercel.app/` respondeu HTTP 200 com bundle atualizado. O app está publicado pelo fluxo GitHub → Vercel. Não há migration SQL: `installmentPurchaseTotal` é metadado opcional no JSON do workspace. Embora a tela de revisão/migração histórica esteja publicada, nenhum dado financeiro de produção foi modificado, pois não houve sessão autenticada para executar a operação e confirmar readback no Neon.

O relatório completo, com 36 falhas confirmadas (11 P0 e 25 P1), correções e evidências está em `docs/AUDITORIA_LOGICA_FINANCEIRA.md`. Validação local final: 439 testes em 58 arquivos aprovados, lint/TypeScript, build PWA (88 entradas) e `git diff --check` aprovados.

Próximo passo concreto: abrir Relatórios e Dados no workspace autenticado, revisar o CSV de séries parceladas, baixar e salvar o backup JSON e então aplicar somente os metadados de alta confiança; confirmar o readback no Neon. Fazer também QA visual autenticado com dados sintéticos. Não migrar competências antigas.

## Auditoria e correções da lógica financeira — 2026-11-11

O pedido de revisar a lógica financeira foi convertido em plano e iniciado. Corrigi os pontos reproduzíveis em datas de lançamento, competência automática da fatura (fechamento + vencimento), edição de parcelamentos com preservação de parcelas pagas, edição de recorrências com reposicionamento de datas, unificação da despesa conta/cartão, entrada monetária como centavos, classificação de estabelecimentos e sincronização silenciosa. No pagamento de fatura, agora é possível escolher explicitamente cartão e fatura, ver o saldo em aberto e sugerir o valor total; o mês do débito usa a data real de pagamento, separado do mês da fatura. Liquidações vinculadas só são corrigidas por estorno e novo pagamento, evitando edição genérica sem cascata.

Nesta continuação, implementei em Relatórios e Dados uma prévia CSV de históricos e uma ação confirmada para preencher apenas `installmentPurchaseTotal` ausente em séries completas de alta confiança. A confirmação baixa o backup JSON integral antes da alteração; o undo fica disponível no aviso da sessão. Competências divergentes e séries ambíguas permanecem para revisão manual. Nenhum histórico foi modificado durante a auditoria. Mantive também as proteções de exclusão de cartões, contas e categorias. Na revisão seguinte, corrigi o resumo diário do calendário para manter os lançamentos na data própria, exibir faturas vencendo separadamente e não contar a liquidação como novo consumo. Faturas configuradas para dias 29–31 agora vencem no último dia válido do mês, tanto no calendário quanto nos lembretes. Também passei os pagamentos de fatura importados por OFX/CSV pelo mesmo fluxo de liquidação em cascata, com sugestão revisável de cartão/mês e preservação do FITID e data do banco. `bun test` passou com 412 testes em 58 arquivos; lint, build PWA (87 entradas) e diff-check também passaram.

Plano, evidências e limites estão em `docs/AUDITORIA_LOGICA_FINANCEIRA.md`. A verificação final local passou com `bun test` (412 testes em 58 arquivos), `bun run lint`, `bun run build` (87 entradas PWA) e `git diff --check`. As verificações são locais e sintéticas; não houve acesso a dados produtivos nem validação autenticada no Neon.

Nesta sessão, fechei mais um risco em `src/utils/ofxParser.ts`: quando um mesmo FITID aparece repetido dentro do mesmo arquivo, somente a primeira linha fica selecionada e as seguintes são marcadas como duplicadas; linhas sem FITID não são bloqueadas por coincidência de valor/data, pois podem ser compras legítimas iguais. Teste direcionado passou; suíte completa ficou em 413/413, lint, build PWA (87 entradas) e diff-check passaram.

Também corrigi a projeção de caixa em `src/utils/financeRules.ts`: receitas, despesas e transferências pendentes de competências passadas agora continuam afetando o saldo projetado até serem baixadas; os totais de receitas/despesas do mês seguem restritos à competência selecionada. A verificação completa passou: 414 testes em 58 arquivos, lint, build PWA (87 entradas) e diff-check.

Na continuação da revisão do painel, corrigi a lista de pendências: ela não confunde transferências com contas a pagar e, quando o mês atual está selecionado, também mostra despesas/recebimentos vencidos de competências anteriores com indicação de atraso. Compras de cartão continuam no painel de faturas. A validação completa passou: 415 testes em 58 arquivos, lint, build PWA (87 entradas) e diff-check.

Na projeção do caixa, também ajustei a dívida de cartão: faturas pendentes vencidas ou com vencimento até o mês escolhido agora reduzem o saldo previsto; parcelas de meses posteriores continuam comprometendo o limite, mas não são subtraídas antes de vencer. Teste direcionado (41 testes) e lint passaram; falta repetir suíte completa/build/diff-check após essa alteração.

A validação final após essas correções passou com 416 testes em 58 arquivos, `bun run lint`, `bun run build` (87 entradas PWA) e `git diff --check`.

Na revisão de moeda estrangeira, corrigi o parser para não arredondar entradas com casas além da precisão aceita nem apagar frações de JPY/CLP. Despesas internacionais agora bloqueiam valores inválidos antes de salvar; contas globais e orçamento de viagem validam o mesmo limite, sem converter erro em saldo zero/orçamento padrão. Testes direcionados de moeda, lançamento, conta e viagem passaram (42); lint passou. Suíte completa/build/diff-check ainda faltam após essa etapa.

Validação final da correção monetária: 420 testes em 58 arquivos, lint, build PWA (87 entradas) e diff-check passaram.

Ainda na moeda, separei taxa de câmbio de valor monetário: taxa preserva até oito casas decimais (incluindo cotações abaixo de R$ 0,01), IOF valida precisão e faixa, e a viagem mantém quatro casas na cotação de referência e no registro de lote. Testes direcionados passaram (43); a validação completa desta etapa ainda falta.

Validação final das correções de moeda: `bun test` passou com 421 testes em 58 arquivos, `bun run lint`, `bun run build` (87 entradas PWA) e `git diff --check` passaram.

Fechei também o limite aritmético cambial em `calculateConvertedBrlAmount`: rejeita entrada/taxa/IOF inválidos, arredonda em centavos e marca conversões que excedem a faixa segura, sem retornar infinito. Formulário de despesa e registro de compra de câmbio não salvam uma conversão inválida. Testes direcionados de regras cambiais, lançamento e viagens passaram (33); falta repetir a suíte completa/build/diff-check.

Validação após o guard de overflow: 422 testes em 58 arquivos, lint, build PWA (87 entradas) e diff-check passaram.

Próximo passo concreto: validar suíte/build/diff-check após o guard de overflow cambial, depois revisar os saldos agregados da viagem em `src/utils/travelRules.ts`. Para conferir fluxo autenticado e persistência, ainda será necessário publicar o código atual em Preview e usar fixture sintética em `src/components/ReportsAndDataTab.tsx` (backup/CSV/aplicar/undo) com readback no Neon QA. Em 2026-11-11 a CLI da Vercel confirmou que o alias `minhaseconomias-git-claude-daz-3b5466-wesleys-projects-de111a83.vercel.app` ainda aponta para o deployment anterior `dpl_5xHZjmsVFj986BrMQwgbYaL29GFP` (Ready, Preview); a API de listagem retornou 403 e o fallback oficial da CLI confirmou o deployment existente. Esse Preview não comprova o código desta auditoria. Competências antigas e séries de revisão manual não são alteradas automaticamente.

Bloqueios/limites: nenhuma sessão autenticada de QA foi usada nesta etapa; totais de compras antigas só podem ser estimados a partir das parcelas relacionadas e históricos incompletos podem precisar de decisão manual. Checkout já continha alterações visuais/autenticação não relacionadas antes desta auditoria; mantive-as intactas e não fiz commit.

## Preview autenticada com Neon QA — 2026-11-11

Criei o projeto Neon isolado `minhas-preview-qa` (projeto `autumn-breeze-31697858`) e apliquei as migrations 001–009. Ativei `LOGIN` somente para `minhas_app_runtime`, role com permissões limitadas já definidas pela migration 004; gerei senha aleatória e passei a URL pooled resultante diretamente ao `vercel env add`, sem imprimi-la. `DATABASE_URL` foi criada como variável sensível apenas no target Preview do projeto `minhaseconomias`; a listagem confirmou target `preview`. Nenhuma variável de produção ou banco produtivo foi alterado.

Reconstruí a implantação existente da branch `claude/dazzling-hamilton-9mffod`; deployment `dpl_5xHZjmsVFj986BrMQwgbYaL29GFP` ficou Ready e mantém o alias original `minhaseconomias-git-claude-daz-3b5466-wesleys-projects-de111a83.vercel.app` (com o link compartilhável `_vercel_share` previamente criado nesta conversa). O `AUTH_SESSION_SECRET` não é necessário neste projeto: `backend/authSession.ts` deriva uma chave de sessão de domínio separado da `DATABASE_URL` quando a variável dedicada não existe.

A chave API temporária Neon usada para as migrations tinha escopo apenas ao projeto QA. O profile local foi apagado do keyring/CLI, mas o CLI não conseguiu revogar a própria chave: a API respondeu que não permite ação fora do projeto e orientou revogar a chave ID `3525161` via Neon Console na organização `org-shiny-snow-46316931`. Próxima ação concreta: no painel Neon, revogar essa API key; depois abrir o link compartilhável da Preview e criar uma conta com credenciais escolhidas pelo usuário. O login de ponta a ponta ainda não foi submetido em navegador após a implantação.

## Redesign visual global — 2026-11-11

Avancei a identidade inspirada na referência Duo Finn pelos módulos principais. `src/index.css` contém tokens de superfície/cores/raios, campos com foco azul, transições e foco visível de botões, cartões padronizados dentro dos módulos, cantos consistentes para diálogos e azul para ações primárias. Em telas largas, `OverviewTab` agora dá destaque ao saldo previsto, posiciona as contas pendentes na coluna lateral e alinha os cartões de contas/cartões/orçamento abaixo; é um reposicionamento CSS dos dados e ações existentes, ainda sem inspeção renderizada autenticada. A marca original `BrandMark` aparece na navegação desktop/mobile e no login; cartões cadastrados exibem a marca de rede correspondente (Visa/Mastercard/Elo). Cabeçalho, menu desktop/mobile, CTA, login, contas/cartões, opções de aparência e estados ativos receberam ajustes. Os componentes de página foram marcados para aplicar o padrão aos cartões em todas as subpáginas. O símbolo também foi alinhado ao ícone SVG e aos quatro PNGs instaláveis do PWA; `index.html` e o manifesto Vite usam o azul novo. Nenhuma regra financeira, contrato, rota ou handler foi alterado.

Na inspeção visual da prévia local, a versão anterior do login foi conferida em desktop e em 390×844. Neste turno, refiz o painel desktop claro/azul e o seletor de modo; por isso a prova desktop anterior não vale para o estado atual, que precisa ser renderizado novamente. A versão mobile mantém a mesma geometria, com o seletor ativo agora azul. Os PNGs do PWA foram validados pelas dimensões 180×180, 192×192 e 512×512. As marcas Visa/Mastercard/Elo têm contraste no tema escuro e nome acessível para leitor de tela. Ainda falta revisar a composição da Visão Geral e cada página/subpágina, formulário e modal em renderização real, além do sweep desktop/mobile. A sessão autenticada não foi aberta: credenciais pessoais não foram usadas nem fornecidas, então essas telas não foram declaradas como visualmente validadas.

Estado Git antes das mudanças: `feat/logout-real-sem-verificacao-email` estava igual a `origin/feat/logout-real-sem-verificacao-email`; `git fetch origin` confirmou `origin/main` dois commits à frente, com `HEAD` contido no histórico remoto. Mantive sem alterações os arquivos preexistentes `HANDOFF.md`, `CHECKLIST.md` (além deste acréscimo) e `.claude/`.

**Logos de instituições nesta continuação:** integrei SVGs locais selecionados do `react-bancos` 0.11.0 para Itaú, Nubank, Banco do Brasil, Bradesco, Caixa, Santander, Inter, C6, BTG, Cora, Mercado Pago, PicPay, PagBank, Wise, Nomad, Avenue e XP. `InstitutionMark` faz correspondência pelo nome salvo e mantém monograma para bancos não reconhecidos; os mesmos logos aparecem nas listas, detalhe de conta e Visão Geral. Incluí `THIRD_PARTY_NOTICES.md` porque o pacote separa a licença MIT do código dos direitos sobre marcas. O build emite 7 SVGs distintos (~15 KB gzip total) e um chunk lazy de ~6.70 KB gzip para o componente de marca. Nenhum fluxo ou dado financeiro foi alterado.

**Verificação após incluir logos locais:** `bun run lint`, `bun run build` e `git diff --check` passaram; o build gerou 86 arquivos de precache e incluiu os SVGs de marca no bundle. Diff-check apontou somente avisos de normalização LF/CRLF. A revisão renderizada em desktop/mobile continua pendente.

**Login/cadastro conferidos em navegador local:** abri o app em `localhost:3000` pelo Zero Browser e revisei os estados de entrar e criar conta em 1440×900 e 390×844. Os formulários cabem nos dois viewports, os campos e CTAs não cortam, o seletor muda o painel e o branding está visível; após renderizar, uniformizei os três ícones de destaque do painel desktop em azul. Não enviei nenhum formulário, fiz login/cadastro nem acessei o Neon. A validação ainda é só da tela pública; nenhuma página autenticada foi observada.

**Verificação depois do ajuste dos ícones do login:** `bun run lint`, `bun run build` (86 itens no precache PWA) e `git diff --check` passaram; este último só reportou avisos LF/CRLF. O servidor local iniciado para o preview foi encerrado. A aba do browser foi preservada.

**Próximo passo desta trilha:** obter acesso a uma conta e workspace de QA com dados sintéticos, ou fixture autenticada equivalente, e percorrer a Visão Geral e páginas/subpáginas, formulários e modais em desktop/mobile. Não reutilizar sessão nem dados financeiros de produção.

**Mais cobertura de logos:** reutilizei o `InstitutionMark` na lista de ativos de `InvestmentsTab`, tanto na tabela desktop quanto nos cartões mobile, para identificar corretoras conhecidas junto ao nome do ativo. A variante xs preserva a legibilidade da linha e instituições desconhecidas continuam com monograma; não alterei callbacks nem a edição dos ativos. Revisão visual autenticada continua pendente.

**Formulário de contas:** o campo de instituição agora mostra ao lado um preview dinâmico da marca conhecida (ou iniciais de fallback) enquanto o usuário digita/edita. O componente usa valores já presentes no formulário (`institution`, `name`, `color`); o save continua usando a mesma estrutura e os mesmos callbacks. A renderização autenticada desse formulário ainda precisa do sweep de QA.

**Formulário de investimentos:** apliquei o mesmo preview dinâmico ao campo texto livre `Instituição / Corretora` e mantive os dados e callback de salvamento existentes. Corretoras mapeadas exibem logo; demais instituições continuam digitáveis e mostram iniciais.

**Formulário de lançamento:** adicionei o preview compacto do cartão escolhido nos modos de compra no crédito e pagamento de fatura. O `<select>` continua sendo o controle de seleção, com as datas de fechamento/vencimento e callbacks atuais; o preview só reapresenta nome, cor e bandeira já cadastrados. Build/lint são a verificação atual; ainda não há renderização autenticada desses estados.

**Formulário de viagem:** o seletor opcional de cartão para despesa internacional também apresenta a face do cartão escolhido abaixo do `<select>`. Mantém o mesmo estado `creditCardId`; essa opção só aparece no regime de cartão internacional, sem tocar em cálculo cambial ou gravação da despesa.

**Seletores de contas em modais/viagens:** mostro logo ou monograma da conta vinculada depois de selecionar no modal de conciliação OFX/CSV, no acerto familiar por PIX e no débito bancário de compra de câmbio. Esses previews só refletem a seleção já existente e não substituem os `<select>` ou alteram a lógica.

**Origem da transação:** o seletor principal de conta e o seletor de conta internacional usado em despesas de viagem também mostram qual instituição foi selecionada. Para opção de espécie/bolso da viagem, continua sem preview bancário porque não há conta associada. Os estados e callbacks permanecem os mesmos.

**Acerto de PIX em viagem:** quando a opção de registrar o acerto no banco está ativa, o seletor da conta bancária agora mostra a respectiva logo/monograma e o nome. Continua condicionado à mesma opção e usa a mesma conta selecionada no callback.

**Validação da continuação:** `bun run lint`, `bun run build` (86 arquivos no precache PWA) e `git diff --check` passaram após adicionar os previews de conta nos formulários de viagem. Não rodei testes; a conferência autenticada/renderizada continua pendente.

**Verificação após previews dos seletores:** `bun run lint`, `bun run build` (86 arquivos precacheados) e `git diff --check` passaram. Os únicos avisos do diff-check foram sobre conversão de finais LF/CRLF.

**Validação após previews em formulários:** `bun run lint`, `bun run build` (Vite/PWA, 86 arquivos no precache) e `git diff --check` passaram. O diff-check só reportou avisos de normalização LF/CRLF. Não executei testes. A visualização autenticada dos formulários e das demais páginas ainda não foi feita.

**Próximo passo concreto (registro anterior):** reconferir o login desktop e, para as páginas autenticadas, abrir o app em QA já autenticado. O login já foi renderizado em desktop/mobile nesta continuação; ainda falta a conta/workspace de QA isolados para revisar telas autenticadas.

**Verificação desta continuação:** após o redesign claro do login, `bun run lint`, `bun run build` (Vite/PWA) e `git diff --check` passaram. Login e módulos autenticados não foram renderizados novamente neste estado; a conferência visual anterior do login é apenas referência histórica. Não rodei testes. Não usei sessão de produção nem dados financeiros.

**Ajuste de proteção visual:** na revisão estática da cobertura de formulários, identifiquei que o seletor global também alcançava inputs especiais (`file`, `range`, `hidden`, `submit` etc.) e que a conversão de botão para azul podia atingir fundos translúcidos. Restrinjo agora os estilos de campos e de ações às classes/tipos apropriados; lint, build e diff-check passaram após esse ajuste. A validação renderizada desses controles nas telas autenticadas permanece pendente.

**Composição desktop:** converti os dois wrappers existentes de pares de cartões em itens de grid só a partir de 1366px, sem mexer na ordem mobile/tablet. O layout destaca o card previsto e coloca pendências à direita, seguido por três cartões na linha abaixo. A revisão renderizada dessa composição em viewport autenticado continua pendente.

**Ajuste de breakpoint:** a composição do dashboard passa a iniciar em 1366px para corresponder a desktop/notebook com sidebar aberta; abaixo disso preserva a disposição atual. `bun run lint`, `bun run build` e `git diff --check` passaram. Como os dados dessa tela são autenticados, o encaixe real da nova largura continua sem captura renderizada.

**Manifesto conferido:** build Vite PWA gerou 77 arquivos de precache; `index.html` e o manifesto foram alinhados no `#2864e8`, splash claro no `#f4f5f7` e idioma `pt-BR`. PNGs instaláveis têm dimensões 180×180, 192×192 e 512×512. As alterações continuam sem commit, na branch `feat/logout-real-sem-verificacao-email`, sem diferença em relação ao upstream no início desta retomada.

**Acesso visual autenticado pendente (registro anterior):** a sessão de QA ainda não estava disponível na sessão em que essa nota foi escrita. Nenhum login ou conta foi usado. A inspeção estática cobriu a marca compartilhada, wordmarks de cartões, foco de teclado, estados desabilitados e `prefers-reduced-motion`. Não executei testes nem declarei auditoria completa de acessibilidade.

**Importação OFX/CSV:** confirmei que os campos file são ocultos; a zona de arrastar e soltar e o modo colagem são os controles visíveis. Alinhei esses estados/ações ao azul do restante da interface e mantive indicadores de conciliação e fluxo financeiro com as cores semânticas. Não alterei parsing, seleção nem importação. Precisa ser renderizado no sweep do modal de conciliação.

**Ações em outros módulos:** os botões sólidos com classes de destaque verde, índigo, violeta e azul celeste agora compartilham o azul de ação e seu estado hover em todo o app; tags e painéis não interativos mantêm cores de contexto. Isso alinha seletores/ações de cartões, viagens, conversor, lembretes e rateios sem reescrever handlers.

**Navegação e formulários:** a navegação inferior móvel agora anuncia a página atual com `aria-current`, e o botão “Mais” expõe seu estado e controla um drawer nomeado; os botões de login/cadastro anunciam qual modo está selecionado. A lógica de navegação e autenticação ficou intacta. `bun run lint`, `bun run build` e `git diff --check` passaram após essas mudanças.

**Campos especiais:** checkboxes e opções de rádio passam a usar o azul de ação compartilhado, igual aos campos textuais e à faixa deslizante. Isso completa o tratamento dos principais controles de formulário no tema global sem mudar valores ou comportamento. A revisão renderizada continua pendente.

**Personalização visual de cartões:** os formulários de criação e edição agora permitem escolher a cor do cartão e o preview usa essa cor já persistida. O campo reaproveita `CreditCard.color`; atualização continua passando pelo `onAddCard`/`onUpdateCard` existente. `bun run lint`, `bun run build` e `git diff --check` passaram. Falta validar visualmente as opções e o contraste em desktop/mobile.

**Cobertura estática de páginas:** confirmei os 11 módulos de primeiro nível do app: os dez com páginas independentes usam `module-page` (incluindo listas, estados vazios e subpáginas próprias de cartão/viagem) e a Visão Geral usa `overview-dashboard`. Modais mantêm o escopo visual compartilhado por `modal-shell`/papéis de diálogo. Isso comprova aplicação do CSS no código, mas não substitui o sweep renderizado de cada fluxo.

**Cobertura dos diálogos:** um scan dos arquivos TSX de produção encontrou todos os `role="dialog"`/`alertdialog` sob `modal-shell`; os que faltavam foram alinhados. O painel principal de diálogos agora herda superfície e borda dos tokens escuros. Scan estático não verifica clipping, rolagem ou contraste renderizado; essas conferências continuam no checklist visual.

**Estados de controles:** a varredura encontrou switches verdes em lembretes, privacidade e lançamento, além de acentos verdes explícitos em checkboxes. CSS compartilhado agora exibe switches ligados, caixas de seleção, rádios, sliders e seletores de período em azul. A atualização depende dos estados ARIA existentes; nenhum handler ou estado financeiro foi alterado.

**Cartões na Visão Geral:** cada item de fatura agora mostra um mini preview com a cor persistida, nome e abreviação da bandeira, além do wordmark acessível no texto. O hover/ação também usa o azul da identidade; os status de fatura paga/aberta mantêm suas cores semânticas. Isso aproxima a composição do dashboard da referência, mas ainda precisa de conferência renderizada.

**Seletores de subpáginas:** a troca rápida de cartão e a seleção de grupo de parcelas agora expõem `aria-pressed` e recebem o estado azul compartilhado. A viagem ativa também anuncia sua seleção e usa o acento azul, preservando o estado arquivado separado.

**Contraste dos previews:** como a cor do cartão é configurável, os previews agora misturam a cor selecionada com uma base escura e usam fallback escuro para dados legados inválidos, mantendo os rótulos brancos legíveis. A conferência visual com a paleta completa ainda está pendente.

**Botões de contorno e texto:** o último scan mostrou que o mapeamento de botões preenchidos deixava ações de link/contorno com texto e bordas verdes, violetas e celestes. CSS agora mapeia esses tons quando estão na classe do próprio botão para o azul ou para um azul claro de hover/fundo. Etiquetas e números semânticos fora de botões não entram nessa regra.

**Cards clicáveis:** estendi a mesma regra para elementos com `role="button"`, usados em linhas e cartões clicáveis, incluindo bordas/fundos leves, texto de hover e classes `group-hover` de ação. Assim o estado interativo não volta ao verde/roxo nas páginas que usam uma `<div>` clicável em vez de `<button>`.

**Ícones da navegação móvel:** os blocos de ícone no drawer “Mais” agora usam o mesmo azul em todas as categorias; mantive cores de sincronização no menu lateral porque elas comunicam o estado da conexão.

**Marcas de instituição:** criei `InstitutionMark`, que gera um monograma local das iniciais do banco a partir dos campos existentes `institution`/`name` e usa a cor cadastrada com escurecimento para contraste. A marca aparece nas listas de contas e na Visão Geral; a instituição completa continua visível como texto. Não são logos oficiais, mas identificadores tipográficos específicos do cadastro. Lint, build e diff-check passaram; falta revisar o encaixe em largura móvel.

**Marca visual de cartão:** consolidei o cartão decorativo reutilizável em `CreditCardFace` e agora ele aparece na lista, na Visão Geral e na página de detalhes do cartão. O tamanho compacto usa abreviação visual da bandeira; tamanhos maiores usam `CardNetworkMark`. Ambos herdam a cor salva com escurecimento para contraste. Build/lint/diff-check passaram; a renderização ainda precisa ser conferida.

**Cabeçalho da conta:** a subpágina da conta também mostra a marca da instituição, nome e tipo ao lado do botão de retorno, reaproveitando `InstitutionMark`. O seletor rápido permanece no cabeçalho.

**Continuação dos formulários:** adicionei prévias da instituição selecionada nos formulários de aporte de meta, operação de investimento, importação rápida CSV, pagamento/edição de cartão e origem de transferência, e conferi os seletores já cobertos em transações, viagem, conciliação e despesas compartilhadas. As alterações são somente de apresentação e preservam `<select>`, `value` e `onChange`. `bun run lint`, `bun run build` e `git diff --check` passaram; o build gera PWA com 86 itens no precache. Não rodei testes.

**Próximo passo concreto:** executar a revisão visual renderizada em desktop e mobile começando pela Visão Geral e depois navegando módulo por módulo, incluindo subpáginas, formulários e modais; conferir espaçamento, recorte, logos reconhecidos/fallback e contraste. A sessão autenticada continua sem acesso, então dashboard e módulos protegidos não foram validados visualmente. O código atual compila e a branch permanece sem commit.

**Continuação desta etapa:** a subpágina de detalhe/extrato de conta agora também usa a classe `module-page`; com isso, as subpáginas próprias de conta, cartão e viagem recebem o mesmo tratamento global. Links de ação que ainda usavam acentos verdes/índigo/violeta agora acompanham o azul da marca. Não apliquei uma regra genérica para todo `aria-pressed`: o seletor de cor de membros usa esse atributo com amostras coloridas e precisa preservar sua cor funcional. Lint, build e diff-check passaram novamente (PWA com 86 itens no precache).

**Próximo passo concreto atualizado:** revisão visual renderizada do estado atual em viewport desktop e mobile, começando pela Visão Geral e cobrindo as dez abas, subpáginas dedicadas, formulários e todos os modais. Se ainda não houver sessão de demonstração/autenticada disponível, seguir com o que é verificável sem dados privados e registrar explicitamente o conjunto de telas protegidas que não pôde ser observado; não declarar paridade visual completa por evidência estática.

**Identidade nas consultas e transferências:** busca global e filtro do extrato agora mostram a marca da instituição ou bandeira do cartão da origem. Em transferências, a conta destino também exibe a instituição; o seletor de conta internacional de viagem recebe a mesma confirmação visual. A prévia internacional foi agrupada corretamente na expressão condicional do campo. `bun run lint`, `bun run build` e `git diff --check` passaram; PWA agora precacheia 87 itens. Nenhum teste ou envio de formulário foi feito.

**Próximo passo atualizado:** varrer visualmente as telas disponíveis sem autenticação e, para páginas protegidas, obter uma sessão visual de demonstração/QA antes de afirmar que estão conferidas. Cobertura funcional preservada por inspeção de que `value`, `onChange` e os handlers dos campos ficaram intactos; o build comprova compilação, não os resultados renderizados.

**Ícones de ações:** alguns ícones dentro dos próprios botões ainda traziam suas classes verde/violeta/celeste mesmo depois de o texto do botão ficar azul. O CSS agora alinha esses SVGs de ação ao acento; ícones financeiros fora de controles permanecem com cores semânticas.

**Ações cinza-escuras:** a última varredura encontrou botões de ação sólidos em slate (`bg-slate-700/800`) na edição móvel de lançamento, limpeza de busca, compartilhamento e documentação. Seus fundos e hovers agora usam o azul principal; elementos de painel/contorno cinza continuam neutros.

**Menus em tema escuro:** a barra lateral desktop e o drawer móvel tinham superfícies e textos apenas para tema claro. Adicionei superfícies, bordas, texto, hover e badges com variantes escuras; o módulo ativo agora tem fundo azul suave em ambos os menus e o mobile anuncia `aria-current`. Estados de sincronização continuam com as cores próprias. A revisão renderizada de ambos os temas permanece pendente.

**Tema escuro dos formulários:** corrigi as superfícies, bordas e texto para usar os tokens do tema e substituí o foco verde residual por azul. Agora campos e seletores mantêm o mesmo padrão nos temas claro/escuro; a evidência é estática mais lint/build, ainda falta inspeção de renderização real.

**Cartões:** a listagem ganhou um preview visual inspirado em cartões físicos, com a cor persistida do cartão, nome cadastrado, chip decorativo e bandeira Visa/Mastercard/Elo. Usa os dados já existentes e não altera cadastro, fatura ou pagamento. `bun run lint`, `bun run build` e `git diff --check` passaram; falta conferir contraste e encaixe visual em tela estreita e desktop.

## Máscara monetária e checklist de produção — 2026-11-08

Implementei a máscara editável de moeda nas telas de contas, lançamentos/rateios, cartões, orçamentos, metas/simulador, investimentos, viagens e conversor. Valores agrupam milhar enquanto digitados (`1000` → `1.000`) e recebem casas decimais da moeda ao sair do campo (`1.000,00` para BRL/EUR/USD; zero casas para JPY/CLP). Mantive prefixos existentes, moeda estrangeira é interpretada conforme a seleção e valores com precisão excessiva continuam visíveis para validação, sem arredondamento silencioso. Corrigi cursor, seleção e colagem no componente reutilizável.

Verificação local reproduzida em 2026-11-08: `bun test` **380/380 em 56 arquivos**, `bun run lint`, `bun run build` e `git diff --check` passaram. A máscara foi commitada em `7d48f5d`, integrada ao `main` pelo PR #2, aprovada no CI e publicada na Vercel Production; smoke e inspeção do bundle também passaram. Falta validação visual autenticada dos campos. O diretório não rastreado `.claude/` foi preservado.

O [CHECKLIST.md](./CHECKLIST.md) já registra a publicação e as lacunas de liberação. Continuam pendentes: readiness autenticado e prova de execução agendada do cron Vercel e do backup cifrado; chave privada age guardada fora deste computador e recuperação testada; restore/import/export UI em QA, CRUD/readback por entidade e isolamento de dois titulares; sweep geral mobile/acessibilidade; e validação visual autenticada de cadastro/login/logout e dos campos monetários. Os schedules de hoje ainda eram futuros na última consulta documentada.

**Próximo passo concreto:** retomar o teste visual autenticado no Ego Lite quando o runtime do navegador estiver conectado; o comando `ego-browser nodejs` respondeu `NodeRuntime disconnected` nesta retomada. Depois das janelas 09:15 e 10:17 BRT, conferir os eventos automáticos do readiness e do backup, sem confundir chamadas manuais com schedules.

**Continuação concluída:** revisão independente do diff sem blockers; commit `7d48f5d` enviado na branch `feat/logout-real-sem-verificacao-email`; PR [#2](https://github.com/cascaoconcurseiro/Minhas-/pull/2) integrado em `main` no merge `63c439f`. CI `42476104819` passou. A Vercel Production `dpl_GhpQLu1yRWgs2jad3ya7TcMvPQem` ficou Ready. Smoke no domínio `minhaseconomias-blue.vercel.app`: página 200, `/api/status` 200 com Auth e Neon configurados (`neon: not_checked` por desenho) e `/api/readiness` sem credencial 401; conferi que o chunk publicado de lançamentos importa `CurrencyInput`. O visual autenticado dos campos ainda não foi exercitado.

**Próximo passo concreto:** executar login de QA no site e verificar valor `1000` → `1.000` enquanto digita e `1.000,00` no blur em BRL e moeda estrangeira, além de JPY/CLP; depois continuar as pendências do `CHECKLIST.md`. Esta publicação fecha apenas a máscara, não o gate total de produção.

Auditoria operacional adicional em 2026-11-08: GitHub `neon-backup.yml` está ativo, mas a execução recente observada (`42413305298`) foi manual; a próxima agenda prevista é 13:17 UTC / 10:17 BRT. Vercel lista `/api/readiness` às 12:15 UTC / 09:15 BRT. No momento da consulta, 08:37 BRT, ambas ainda não tinham ocorrido hoje; os GETs `/api/readiness` 401 eram smoke sem bearer, não prova de disparo automático. A janela diária deve ser conferida depois. A auditoria mobile também entregou roteiro P0 para Viagens, Compartilhado/convites, Metas/Simulador, Investimentos, Configurações, Lembretes e Conciliação; ainda não há cobertura visual mobile completa. O Ego Lite não conectou ao bootstrap, então a verificação de campo autenticada não começou.

## Logout real + sem verificação de e-mail — 2026-11-07

Feito (local, NÃO commitado/publicado): `token_version` em `app_users` (migration `db/migrations/009_app_users_token_version.sql`), `verifyAuthUser` consulta o Neon a cada requisição, `POST /api/auth/logout` invalida tokens antigos, `signOutUser` chama o servidor. Verificação de e-mail removida por decisão do dono: família só por convite dentro do sistema (sem exigir e-mail confirmado). 379 testes, tsc e build ok.

**Pendente, nesta ordem:**
1. FEITO: migration 009 aplicada no Neon de produção em 2026-11-07 (coluna token_version). O deploy já pode sair.
2. Commitar e publicar na `main`.
3. Apagar `FIREBASE_*` na Vercel (o assistente não pode).
4. Cliente com versão antiga em cache (PWA, `registerType: 'prompt'`) ainda chama o Firebase: limpar dados do site ou aceitar a atualização.

Limite conhecido: limitador de tentativas é por instância serverless.

## Triagem de regressões — 2026-11-07

Revisei em paralelo API/Auth, finanças e UI após as correções locais de importação CSV sem conta, validação de investimento e verificação de conta Firebase. A árvore estava limpa antes desta atualização documental. Não executei os 374 testes, não chamei produção e não alterei código ou dados; a contagem permanece como relatada no projeto, não verificada nesta triagem. Não há evidência de deployment atual nesta revisão, então nenhum estado de publicação foi inferido.

Riscos de maior prioridade observáveis sem escrita:
- CSV misto: `src/App.tsx:2648-2694` ignora linhas inválidas e retorna somente contagem; `src/components/ReportsAndDataTab.tsx:337-349` limpa todo o texto quando ao menos uma linha é aceita. Um lote com uma linha válida e outra inválida pode sinalizar sucesso e apagar também a linha rejeitada. Verificar em harness sintético com callback espião, sem estado financeiro/API.
- Sinal CSV: `src/App.tsx:2670-2671` classifica pela presença de `-` no primeiro caractere, enquanto `parseBRLInput` remove `R$` e espaços antes de ler o sinal (`src/utils/financeRules.ts:43-47`). `R$ -34,90` pode ser tratado como receita. Cobrir formatos com sinal antes/depois do símbolo em fixture local e observar o tipo entregue ao callback.
- Conta destino obsoleta: `ReportsAndDataTab.tsx:154` inicializa o ID apenas no mount; quando as props mudam, o ID antigo pode continuar selecionado. `App.tsx` recebe esse ID sem validar contra as contas atuais. Simular troca de `[A,B]` para `[B]` em harness e capturar o ID, sem gravar.
- Auth/readiness: `backend/app.ts:796-857` considera Firebase configurado pela presença de `FIREBASE_API_KEY`; chamadas autenticadas depois dependem de `accounts:lookup` em `backend/firebaseToken.ts`. Uma chave presente, mas inválida/restrita, pode coexistir com status/readiness configurados e falha 503 na rota protegida. Validar primeiro com fetch mockado; somente em QA, comparar esses GETs sem POST/PUT/DELETE de dados. A documentação Firebase alerta que restrições de API key podem gerar 403 se `identitytoolkit.googleapis.com` não estiver permitido. [Documentação Firebase API keys](https://firebase.google.com/docs/projects/api-keys).
- Auth disponibilidade: `accounts:lookup` ocorre em cada verificação com timeout de 5 s (`firebaseToken.ts:128-169,248`). Testes atuais não demonstram comportamento de latência/concorrência/rate limit. Usar delay mockado ou GET autenticado em QA com identidade de teste; não fazer load test em produção.

Casos financeiros adicionais para esclarecer antes de marcar como defeito: `InvestmentsTab.tsx:383-405` passa quantidade por `parseBRLInput`, que trata valores como dinheiro com duas casas; confirmar se frações abaixo de 0,01 são permitidas. A regra recente também recusa preço médio ou atual zero; confirmar a regra para ativos sem cotação/preço de custo desconhecido. `monthlyYieldPercent` converte entrada inválida/negativa em zero (`InvestmentsTab.tsx:394`), sem erro visível. Verificar os três por callbacks espiões em harness. Logout rejeitado também não tem tratamento visual em `AuthAndCloudTab.tsx:233,326`; testar callback rejeitado sem sessão real.

**Próximo passo concreto:** adicionar/rodar somente os ensaios de harness (CSV misto, variação de formato do sinal, troca de conta destino, entradas de investimento e callback de logout rejeitado). Depois, em QA e apenas por GET, observar o comportamento com chave Firebase inválida ou upstream lento e conferir privilégios efetivos por consulta de catálogo read-only. Não inferir readiness real a partir da mera presença de variáveis e não afirmar deploy até observar evidência específica.

**Limites:** a documentação Firebase confirma que chave com restrições incorretas pode produzir erro de serviço e que a Identity Toolkit API deve estar na allowlist; isso fundamenta o risco de configuração, mas não verifica a chave deste projeto. Nenhum teste, chamada QA/produção ou gravação foi feito nesta triagem. A arquitetura não mudou; o blueprint permanece inalterado.

## Estado atual — 2026-11-07 — autenticação, cron e cobertura

Arquitetura vigente: **Firebase Auth identifica o usuário; Neon PostgreSQL é o único banco operacional**. O runtime importa `firebase/auth`, sem uso de Firestore. Firebase permanece no login/UID/token e na checagem de sessão; contas, lançamentos e demais dados financeiros persistem no Neon.

Nesta continuação, `/api/status` informa configuração sem conectar ao Neon; `/api/readiness` requer `Authorization: Bearer CRON_SECRET` antes de abrir conexão e verifica Neon/role restrita. `vercel.json` aponta o cron para readiness e `CRON_SECRET` foi cadastrado como variável sensível em Production. O valor não está no repositório nem neste handoff. O código ainda precisa ser publicado para a rota entrar em uso.

O verificador Firebase consulta estado da conta para rejeitar usuário desativado/sessão revogada; sem `FIREBASE_API_KEY` falha com 503, códigos conhecidos de token/conta retornam 401 e erro de configuração/rede/desconhecido retorna 503. Também foram corrigidos: importação CSV sem conta, validação de quantidade/preços de investimento e asserção documental do endpoint readiness. Foram ampliados testes DOM de cartões, contas, orçamento, metas/simulador e configurações. A revisão independente não encontrou blocker adicional após as correções.

Validação local reproduzida nesta sessão: `bun test` **374/374 em 54 arquivos**, `bun run lint`, `bun run build` e `git diff --check` passaram. A maioria dos novos testes verifica DOM/callbacks e serviços mockados; isso não prova persistência financeira remota.

## Próximo passo concreto

Revisar o diff e publicar em `main`; acompanhar CI/Vercel, então verificar `/api/status`, `/api/readiness` sem autorização (401) e com `CRON_SECRET` (200 se Neon disponível). Depois observar uma execução automática do readiness e uma execução `schedule` do backup, distinguindo ambas de `workflow_dispatch`.

## Bloqueios para concluir a meta

- Restore pela interface até Neon QA e readback após reload ainda não foram comprovados.
- Falta CRUD/readback independente por entidade e isolamento de dois titulares em Neon QA. Convite, aceite/recusa e lançamento compartilhado foram validados anteriormente com duas identidades e limpeza, mas isso não fecha todos os casos de isolamento.
- O backup mais recente conhecido foi iniciado manualmente; a execução `schedule` ainda não está comprovada. A chave `age` precisa de cópia externa e teste de recuperação em outro dispositivo.
- O sweep completo mobile/acessibilidade permanece aberto; FX/Gemini ao vivo não está configurado.
- O deployment destas alterações ainda não aconteceu.

## Atualização desta sessão — auditoria de cobertura (2026-11-07)

O usuário informou que a suíte mais recente passou **374/374 em 54 arquivos**, junto com build, lint e `git diff --check`. Não reexecutei esses comandos nesta auditoria; o status é evidência relatada pelo usuário. O último handoff anterior registrava 356/356, então aquele total deve ser lido como resultado histórico daquela execução. Preservei as alterações locais já presentes no checkout (base `5523008`); não editei código nem fiz chamadas de escrita à API/Neon.

Revisei o roteiro e testes para três requisitos: restore UI→API→Neon, isolamento por UID e CRUD/readback de todas as entidades. Os casos atuais do frontend cobrem validações e callbacks com props/dados sintéticos; `src/utils/fullBackup.test.ts` cobre parsing/sanitização; `backend/familyApi.test.ts` exercita restore PUT→GET e leitura por UID em servidor de teste com `Pool` em memória. Isso não é a mesma evidência de uma restauração importada pela UI, gravada em branch Neon QA e relida após reload. O CHECKLIST já registra ensaio real API→Neon com UID sintético em branch QA e limpeza, mas não UI→API→Neon ponta a ponta.

Há evidência real anterior de fluxos familiares com segunda identidade e limpeza (`CHECKLIST.md` em “Validação real de convites e lançamento compartilhado — 2026-11-07”). Ela não prova RLS cross-owner de workspace com dois titulares sobre Neon real. Testes de contrato conferem UID autenticado/`owner_user_id` e 404 para outro UID contra banco fake; a execução real em QA citada acima comprovou gravação/readback para um UID sintético e ausência agregada em production, mas ainda falta um ensaio integrado de isolamento de duas identidades num banco QA isolado.

Os testes DOM das abas cobrem create/edit/delete e callbacks sintéticos em contas, lançamentos, cartões, categorias/orçamentos, metas, investimentos e viagens; SharedExpenses também tem cenários sintéticos. O CHECKLIST registra ciclos anteriores de create→reload→delete pela UI para subconjunto dessas entidades e fluxo familiar real, mas continua aberto o readback independente no Neon, especialmente cobertura integral módulo a módulo (incluindo categorias, relatórios/backup e operações críticas restantes). A suíte 374/374 não deve ser apresentada como CRUD remoto completo.

Revisão read-only de import/export/restore no checkout atual (`main`, árvore já modificada em vários arquivos; nenhuma alteração de código nesta revisão): `src/utils/fullBackup.ts:116-221` aceita versões inteiras 1–6, exige as sete coleções como arrays de objetos e valida categorias mais estritamente que as demais entidades. `src/utils/fullBackup.test.ts` tem casos para v3/v5/v6, JSON inválido, v7, uma coleção ausente, categorias e datas inválidas; não encontrei testes específicos para v1/v2/v4 nem entidades vazias/incompletas em cada coleção. Uma transação sem `date` passa pelo parser (`fullBackup.ts:159-164`) e o reparo lhe atribui a data atual (`travelRules.ts:1638-1644`); confirmar se algum formato legado suportado realmente omite esse campo e fixar o resultado esperado, pois a data pode mudar silenciosamente.

Na persistência, o callback de importação aplica estado local e retorna sucesso antes do autosave debounced (`src/App.tsx:2750-2803`, `1162-1197`); as mensagens da UI dizem corretamente que o backup foi carregado na sessão e que o Neon ainda precisa ser confirmado. O backend tem cobertura sintética de compare-and-swap 409, 503 e PUT→GET em `backend/familyApi.test.ts`; o harness App cobre 503 no carregamento inicial, mas não encontrei teste integrando restore pela UI ao save 409/503, resolução de conflito, retry e readback pós-reload. A seleção/validação/confirm/callback da UI é coberta por `SettingsModal.test.tsx` com `FileReader` e callback sintéticos; exportação verifica o callback, não o download/conteúdo final do Blob.

**Erro concreto encontrado:** documentação desatualizada que ainda cita 356 testes como o total atual. Não encontrei defeito funcional concreto no código na revisão estática delimitada; não executei testes nem chamadas externas. A arquitetura Firebase Auth + Neon permanece a mesma, portanto o `MASTER_BLUEPRINT.md` não mudou.

**Próximo passo concreto:** primeiro decidir/testar a semântica de campo `date` ausente e adicionar casos por versão e por entidade incompleta; depois, em Neon QA descartável, exercitar `handleImportFullBackupJson` até `saveNeonWorkspace`, cobrir save 409 e 503/retry, recarregar e confirmar GET/readback. Nenhuma escrita em production.

**Bloqueios/limites:** ambiente/branch QA e duas identidades controladas precisam estar disponíveis; a contagem 374/374 foi informada pelo usuário e não reproduzida nesta revisão. A árvore de trabalho tinha modificações preexistentes; mantê-las intactas é necessário.

## Sessão — 2026-11-07 — orquestração do app e execução diária

Adicionei uma suíte sintética do componente `App` em `src/App.test.tsx` com o harness isolado `src/test-utils/appOrchestrationHarness.tsx`. Ela comprova que a tela permanece bloqueada enquanto o workspace Neon carrega, só mostra dados do snapshot após sucesso e sinaliza sincronização; também prova que um 503 não cria nem salva um workspace vazio e que “Tentar novamente” recupera o carregamento. Os mocks rodam em processo separado para não interferir na suíte global. Verificação local: `bun test` **356/356 em 54 arquivos**, `bun run lint`, `bun run build` e `git diff --check` passaram. Esses casos usam Firebase/Neon sintéticos, não são E2E remoto.

Estado externo rechecado: `/api/health` de produção HTTP 200, Neon `ok`, Firebase Auth configurado e role Neon restrita; Vercel lista `/api/health` às 12:15 UTC. GitHub workflow `neon-daily-activity.yml` teve `schedule` sucesso `42397967500` em 2026-11-07 17:46 UTC. Já `neon-backup.yml` continua sem execução `schedule` visível; `42413305298` em 20:54 UTC foi `workflow_dispatch`. O backup é diário no código, mas ainda falta prova do agendador. A chave privada age também não foi comprovada fora deste computador.

Próximo passo concreto: preparar e executar o cenário UI→API→Neon de export/import/restore em branch QA descartável com identidade temporária, readback pós-recarga e limpeza. Depois confirmar a primeira execução agendada do backup e retomar o sweep visual mobile e a persistência remota dos módulos. Não marcar “todas as funcionalidades” como concluídas.

Publicação desta rodada: commit `c8fa7c0` em `main`; CI `42421567985` passou em testes, typecheck e build. Vercel `dpl_DQXaUCBDVp5ZKdNyreKzHWADcqbB` ficou Ready e recebeu o alias principal; health pós-deploy respondeu HTTP 200, Neon `ok`, Firebase Auth configurado e role Neon restrita.

## Sessão — 2026-11-07 — validação real do fluxo familiar em produção

Corrigi e publiquei os entrypoints Vercel para `POST /api/family/invitations/:invitationId/respond` e `.../revoke`; antes, esses caminhos profundos davam 404 na borda. Deploy `dpl_4pRYn2TGYwD41geXZsgW4Dr7tqv5` está Ready. CI `42419556410` passou; `bun test` 355/355 em 53 arquivos, lint, build e `git diff --check` passaram. Sem token, os dois endpoints retornaram 401 JSON; com a segunda identidade verificada, aceitar e recusar retornaram 200.

O teste real usou uma conta Firebase temporária verificada por e-mail. O proprietário criou convites pela UI; a conta secundária aceitou um e recusou outro; a UI do proprietário refletiu os estados. O proprietário criou pela UI um lançamento familiar de QA por R$ 1,25 com divisão de 50%; a segunda identidade leu no endpoint Neon o registro espelhado e o rateio de R$ 0,63. Revoguei os vínculos, removi o lançamento pela UI, apaguei a linha exata do convite temporário no Neon e excluí a conta Firebase de QA. Consulta final agregada em `production`: 0 convites `invited`/`accepted`, 0 registros do lançamento QA e 0 ocorrências nos workspaces.

Limite: o cadastro/verificação/login da conta de teste foi realizado por Firebase Auth REST e Gmail direcionado ao alias de QA, não pelo formulário visual do app. A limitação de isolamento de sessão no Ego Lite impediu provar login/logout e sessão recarregada pela UI com duas identidades; aceite/recusa e leitura compartilhada foram comprovados com chamadas autenticadas reais, não mocks. Restore/import/export pela UI, prova do backup automático cifrado por `schedule`, guarda externa da chave age, sweep mobile completo e CRUD/readback independente de todos os módulos seguem pendentes. A branch principal do Neon permaneceu sem dados de teste após a limpeza.

Próximo passo concreto: continuar a matriz de lacunas no `CHECKLIST.md`, começando pelo restore/import/export autenticado em branch QA e confirmação do evento automático de backup `schedule`. Não marcar a meta total como concluída.

## Sessão — 2026-11-07 — correções financeiras e fluxo familiar

Conferi o estado atual do checkout e preservei as alterações preexistentes. Corrigi dois defeitos reproduzíveis: `AccountsTab` agora rejeita texto de saldo inválido que era convertido silenciosamente em zero (`abc0`, `0abc` e separadores isolados); `simplifyTripDebts()` limita o BRL de cada transferência pelos saldos individuais e calcula a taxa efetiva do valor realmente transferido, evitando deslocar centavos entre participantes. Acrescentei testes DOM para os botões “Efetivar/Reverter” no painel e para indisponibilidade dos certificados Firebase durante rotação de chave antes de consultar Neon.

Nesta retomada, corrigi os textos do convite para informar que o app grava o convite no Neon, não envia e-mail, e que o familiar precisa entrar com o mesmo e-mail. O cadastro e as edições de vínculos outgoing agora esperam a resposta do Neon antes de confirmar; false/rejeições ficam no formulário e não mostram sucesso. O quick-add do lançamento não aceita e-mail como se fosse uma conta já vinculada: mantém o fluxo sem e-mail local e direciona o convite para Compartilhado. Após revogar um convite e falhar a criação do novo, o familiar fica com o endereço novo como “Sem convite”; falha de revogação preserva o vínculo anterior.

Validação local atual: `bun test` **355/355 em 53 arquivos**, `bun run lint`, `bun run build` e `git diff --check` passaram. Testes novos são DOM/callbacks sintéticos; não provam criação/aceite real, readback no Neon nem o caso App de revogação seguida de falha na criação. O build ainda avisa que o bundle principal tem 577,30 kB. As correções do fluxo familiar foram publicadas em `599f56b`; CI `42417735565` passou. Vercel `dpl_Gy1hmhePSL5XSSBSgxKiu1LgBAQd` está Ready no alias principal. Smoke: `/api/health` HTTP 200, Neon `ok`, `neonLeastPrivilegeRole=true`, Firebase Auth configurado; página HTTP 200 serviu `index-zuCRr8d2.js`, e os chunks publicados contêm as mensagens de ausência de e-mail, estado “Sem convite” e encaminhamento do quick-add à aba Compartilhado. Nenhum dado foi escrito.

Os itens financeiros/responsivos anteriores permanecem: a correção da data de pagamento de fatura foi publicada em `45aa3d4` com CI `42389148427`; a suíte ampliada está em `953429a` com CI `42413460050`; a correção mobile de Orçamentos foi publicada em `9a218f6` com CI `42415359477` e deployment Vercel `dpl_4sMxMtkAsuwh67b73bRD4ANHyC8C` Ready.

Correção responsiva publicada e conferida no Ego Lite após o deployment `dpl_4sMxMtkAsuwh67b73bRD4ANHyC8C`: em 390×844, as duas abas aparecem empilhadas, cada botão mede 320×44 px, e `main`/raiz medem 390/390 px. A tabela fica num wrapper de 360 px com conteúdo de 920 px e `overflow-x:auto`, comportamento previsto. Em 768×1024, Visão Geral, Lançamentos e Orçamentos mediram `main` 753/753 px sem overflow. A viewport foi restaurada a 1066×1132 em Relatórios; status final “Nuvem sincronizada”. Nenhum dado foi gravado ou baixado.

O conjunto está publicado em `main`, incluindo `45aa3d4 fix: date invoice settlement on payment day`. CI `42389148427` passou. Vercel deployment `dpl_FKSsGT869rZyNSnpLpEfjvCpgyg9` ficou Ready no domínio principal; `/api/health` retornou `ok`, Neon `ok`, Firebase Auth configurado e role restrita; `/api/workspace` sem token retornou 401. A interface autenticada carregou `assets/index-qcHIgQGH.js`, sincronizou com Neon e mostrou a data do pagamento como 07/11/2026. Foram estornados e removidos todos os dados sintéticos de cartão; Contas mostra zero, Cartões mostra nenhum cartão e Lançamentos mostra `Extrato (0)`. A inspeção visual publicada em 1066×1132 havia confirmado os controles das telas Lançamentos, Compartilhado e Relatórios; a rechecagem anterior em sessão com service worker antigo é registrada separadamente no relatório de UI. Nenhum cookie, credencial ou armazenamento do navegador foi apagado.

Rechecagem de coordenação em 2026-11-07 21:04 UTC: CI `42413460050` continua concluído com sucesso para `953429a`; produção `GET /api/health` respondeu HTTP 200, Neon `ok`, Firebase Auth configurado e role de privilégio mínimo; a página pública respondeu HTTP 200 e contém `assets/index-qcHIgQGH.js` e `assets/index-BF93JS-z.css`. Esta chamada direta não demonstra a execução automática do Cron Vercel.

Próximo passo concreto: quando o Ego Lite disponibilizar uma Page acessível, testar criação/login, convite criado/aceito/recusado e lançamento compartilhado entre duas contas, seguido de recarga/readback independente e limpeza. O usuário confirmou que tem uma segunda conta controlada, mas o TaskSpace 9 ainda mostra `pages: []` e aba desconhecida/protegida; nenhum caso novo foi executado. Em seguida, fazer o sweep mobile dos módulos restantes e fechar CRUD UI→API→Neon, restore e import/export. O workflow GitHub `Neon — verificação diária` executou por `schedule` em 2026-11-07 (`42397967500`) e o `SELECT 1` passou. O backup manual `42413305298` gerou artifact cifrado de 20.893 bytes; falta comprovar o evento `schedule` do backup e verificar cópia externa da chave age. A solicitação nova de testar aceite/compartilhamento supersede a dispensa anterior de segunda conta.

Auditoria Ego Lite em `C:\Users\Wesley\Documents\Codex\2026-11-07\minhas-economias-site-test\outputs\ego-ui-audit\01-live-results.md`: pela UI publicada foram criados/editados/removidos conta, lançamento, cartão, categoria de orçamento, meta, viagem e investimento com dados sintéticos; cada limpeza sincronizou e as telas retornaram ao baseline. A conta e o lançamento auxiliares também foram removidos. Com evento input nativo, o lançamento em 07/11 persistiu após sincronização e recarga; page.fill era limitação da automação, não bug do app. A revalidação do hotfix usou a build atual, pagou R$1,23 pela conta/cartão QA e confirmou a data **07/11/2026**, estornou e removeu compra/cartão/conta; a UI final mostrou sincronização e zero resíduos. A verificação visual ficou em viewport 1066×1132; os cortes em Lançamentos, Compartilhado e Relatórios foram corrigidos no bundle publicado `5ab6266` segundo a captura anterior. Não houve efeito externo, FX/live quote, convite, importação ou exportação.

Pendências materiais: CRUD por módulo foi exercitado na UI com sincronização indicada, mas falta readback independente no Neon; restore/import/export autenticados pela interface seguem sem E2E. Convites e lançamentos compartilhados ainda não foram aceitos entre duas contas reais; o usuário confirmou uma segunda conta, e o teste está aguardando uma Page acessível no Ego Lite. O backup agendado GitHub ainda não tem evento `schedule` confirmado e falta cópia externa verificável da chave age. A revogação Firebase pode deixar token emitido válido até expirar (janela próxima de uma hora). `GEMINI_API_KEY` não está configurada, então FX live assistido por Gemini permanece indisponível. Build mantém o aviso do chunk principal acima de 500 kB.

Auditoria de segurança somente leitura: as rotas examinadas derivam o UID do token Firebase validado e não confiam em UID enviado pelo cliente; a role runtime é restrita. Ainda assim, a revisão das políticas RLS reais em Neon não foi repetida nesta sessão. As policies usam `app.user_id` definido pela API dentro da transação; alguém que comprometa a credencial backend poderia definir outro UID. O teste real com segunda identidade segue pendente.

Auditorias somente leitura adicionais: não foram encontrados imports/chamadas de Firestore no runtime; Firebase Auth fornece identidade e a API acessa Neon. O app grava, porém, snapshot financeiro sanitizado em `localStorage` depois de carregar Neon, sem ler essa cópia para hidratar a interface; a finalidade/remoção deve ser revisada. A revisão responsiva estática não achou defeito específico no código, mas confirmou que não há testes de viewport mobile/overflow; a evidência visual disponível é apenas desktop 1066×1132.

Estado atual da retomada Ego Lite: a conversa “Testes funcionais: Minhas Economias” foi reativada e fez handoff; TaskSpace 9 continua sem Page gerenciada (`pages: []`) e a única aba aparece como origem desconhecida/protegida. O usuário confirmou que pode disponibilizar a página e tem uma segunda conta controlada, mas ainda precisa abrir a página de forma acessível ao Ego. Nenhum cadastro, convite ou lançamento foi executado nesta tentativa; nenhuma API/mocks foram usados e não houve escrita/limpeza em produção. O relatório está em `C:\Users\Wesley\Documents\Codex\2026-11-07\minhas-economias-site-test\outputs\ego-ui-audit\01-live-results.md`.

## Sessão — 2026-11-07 — inventário de testes funcionais sintéticos

Contexto retomado: a sessão autenticada real e a persistência UI→Neon seguem pendentes; o usuário não autorizou uso de produção/dados pessoais nesta tarefa. Preservei o checkout preexistente com alterações não commitadas. Rodei `bun test` (242/242 em 44 arquivos), `bun run lint` e `bun run build`; todos passaram. O build continua avisando sobre o chunk principal de 575,80 kB. Testes são DOM sintéticos, mocks e regras locais: não são Playwright/browser real, não verificam Neon e não confirmam aceite de convite. O teste de convite cobre criação pelo proprietário; o aceite requer segunda conta e não foi simulado.

Cobertura identificada: contas (criar/editar/exclusão confirmada/cancelada); lançamentos (criar/editar/excluir unitário e série); cartões (criação e formulário de edição/labels); orçamento (editar teto/cancelar e categorias); metas (cálculos); viagens/câmbio (criar/editar/excluir e regras de rateio/conversão); investimentos (criar/editar/excluir, validações e cotação simulada); compartilhamento (convite sintético, confirmação/cancelamento de remoção, liquidação); relatórios/import/export (período, CSV, backup e parsers); configurações (exportação/restauração JSON sintética e cancelamento). A profundidade difere por módulo e vários CRUDs permanecem apenas callback local.

Próximo passo concreto: aprofundar os testes DOM de `CreditCardsTab`, `GoalsAndSimulatorTab`, `ReportsAndDataTab` e os fluxos persistidos de `App`/`neonWorkspace`, sempre com armazenamento e API simulados; depois fazer revisão visual desktop/mobile em ambiente controlado. Sem sessão autenticada controlável, aceite de convite com segunda conta e persistência remota continuam pendentes.

## Retomada — 2026-11-07 13:58 UTC — Firebase Auth + Neon

A arquitetura publicada mantém Firebase Auth para identidade e Neon PostgreSQL como único banco operacional. O commit `aede265` foi enviado a `main`; CI `42378877771` passou e o primeiro deployment de runtime `dpl_8mrRFxZutZBhKte6gN52m5kbBZfn` ficou Ready. Removi as variáveis antigas e os commits documentais `59f0020` e `923e0ca` passaram nos CI `42379078287` e `42379235890`; o deployment atual `dpl_4CN8ERkHECZLgSew51oyvtcbEN6S` ficou Ready com as envs limpas. A API exige `aud`/`iss` do projeto Firebase, UID consistente com a conta verificada via Identity Toolkit, e distingue token inválido (401) de indisponibilidade/configuração do provedor (503). Os UIDs antigos dos workspaces foram preservados e nenhum dado Neon foi escrito.

Variáveis sensíveis `FIREBASE_PROJECT_ID`/`FIREBASE_API_KEY` foram adicionadas à Vercel production. Após o primeiro deploy, removi `NEON_AUTH_JWKS_URL`/`VITE_NEON_AUTH_URL`; lista final contém apenas as duas envs Firebase e `DATABASE_URL`. Smoke no alias principal após os deploys: health 200, Neon `ok`, role restrita e Firebase configurado; workspace, compartilhamento, lembretes, FX e sync de ativos 401 sem token. Bundle remoto contém Firebase Auth, sem Neon Auth/OTP e sem Guia Rápido. No Ego Lite, a aba ainda servia o app antigo pelo service worker; recarreguei a mesma página, que atualizou e passou a exibir o conteúdo atual sem o aviso de contas não migradas. O texto não existe no código nem no bundle Firebase; não apaguei cookies ou armazenamento.

Validação local: `bun test` 173/173 em 33 arquivos; `bun run lint`, `bun run build` e `git diff --check` passaram. Agentes revisaram backend, frontend e docs/deploy; a auditoria de UIDs também confirmou que a migration 006 manteve valores Firebase existentes. O build ainda avisa sobre chunk acima de 500 kB.

Próximo passo concreto: validar signup/login Firebase real e leitura do workspace no Neon com uma sessão do titular. Esse aceite não foi realizado porque nenhum login/segredo de conta foi fornecido; testes locais foram sintéticos. A meta continua aberta para restore autenticado, flows completos dos módulos e os outros itens listados no checklist.

## Continuação atual — 2026-11-07 13:30 UTC

As correções desta rodada foram publicadas em `main` no commit `600c3ec`. CI `42376418227` passou; deployment Vercel `dpl_DDCSTBKZ8cUPjap4qFWJ4pdFZ67X` está Ready. Smoke no domínio principal: `/api/health` responde 200 com Neon `ok`/role restrita; workspace, lembretes, FX e sync de ativos sem token retornam 401; o bundle novo contém confirmação de exclusão da conta e não contém Firebase nem Guia Rápido. `bun test` 174/174 em 33 arquivos, `bun run lint`, build e diff-check passaram; permanece aviso de chunk >500 kB. Os testes desta rodada usam dados/mocks sintéticos e não escrevem no Neon.

Estado externo conferido às 13:17 UTC: Neon tem somente a branch `production`. O Vercel Cron `/api/health` está habilitado em `15 12 * * *` UTC; logs do Vercel registram HTTP 200 às 09:23:28 BRT (12:23 UTC) no host de deployment de produção, comprovando a atividade diária de 7/nov. GitHub Actions ainda lista somente `workflow_dispatch` para atividade e backup, sem evento `schedule` após as janelas de hoje. O backup manual `42320784685` gerou o artifact cifrado válido até 7/dez às 21:52 BRT. Verificar novamente a fila de `schedule` (pode haver atraso); não usar dispatch manual como prova.

O commit `0917cdb` (`fix: confirm family member removal`) está em `origin/main`; CI `42376911235` passou e o deployment `dpl_2bsJXcbJ6qrUpePRbuKsTZDVqpwG` ficou Ready. Em seguida publiquei o teste DOM sintético de edição de orçamento no commit `17b49db`; CI `42377109572` passou e o deployment final `dpl_y2nKx4hGY7CZ6MomNeVSChDmq3bZ` também ficou Ready, associado a `minhaseconomias-blue.vercel.app`.

Adicionei teste DOM sintético para edição de teto de orçamento em `BudgetsTab`; suíte completa: 178/178 em 35 arquivos; teste focal, lint e diff-check passaram. A validação cobre somente o callback local e parse BRL; não atinge persistência/API/Neon.

Smoke no domínio final às 13:29 UTC: `/api/health` 200, Neon `ok`, `neonLeastPrivilegeRole=true`; workspace, lembretes, FX e sync de ativos retornam 401 sem token. Bundle remoto lazy `SharedExpensesTab-DADemiNe.js` confirmou o diálogo de remoção; bundle de entrada não contém `firebase` nem `Guia Rápido`. Isso prova publicação do código, não um ensaio de remoção em conta real. O teste de orçamento é apenas local/teste sintético; a publicação desse arquivo de teste não altera o runtime do aplicativo.

Com Ego Lite, inspecionei a tela de login de produção em desktop e viewport mobile 390×844. Em ambos, os campos e botões estavam legíveis, sem overflow horizontal aparente e sem Guia Rápido. Não abri o dashboard autenticado: a tela avisa que contas antigas não foram migradas e exige nova conta. Mantive a aba isolada do Ego Lite aberta em produção.

Pendências que mantêm a meta aberta: observar backup automático GitHub; resolver a divergência Firebase Auth versus Neon Auth (pergunta ao usuário pendente); login/OTP e CRUD real; restore pela interface autenticada; revisão visual do dashboard desktop/mobile; cobertura funcional/renderizada das abas ainda sem DOM tests; chave `age` guardada fora desta máquina. A conta familiar secundária continua dispensada pelo usuário.

## Retomada do backup cifrado — 2026-11-07

Em `b2bd9e7` foi removido o `age-inspect` inexistente no runner. O workflow de backup PostgreSQL passou em produção na execução manual GitHub Actions `42320784685`: role `minhas_backup_reader` no Neon production, connection string direta sem pooler, artifact age cifrado, retenção de 30 dias. A role tem apenas leitura, `BYPASSRLS` para as tabelas com RLS forçado e `SELECT` em sequências; não tem superuser nem privilégios de escrita/criação. O secret `NEON_BACKUP_DATABASE_URL` foi atualizado para a URL dessa role de produção.

O artifact foi baixado e descriptografado fora do repositório. `pg_restore --list` reconheceu o custom dump PostgreSQL 18.6; a restauração com `--single-transaction` passou na branch QA `qa-neon-backup-20261107`. Os agregados production/QA coincidiram: 4 workspaces, 0 convites, 0 transações compartilhadas e 5 objetos públicos. A branch QA foi removida e o dump local em texto aberto foi apagado. Nenhuma escrita foi feita em production.

Ainda pendentes: primeira execução automática `schedule` às 13:00 UTC; o titular precisa guardar uma cópia segura de `C:\Users\Wesley\Documents\Minhas Economias Backup\neon-backup.agekey` fora do computador e conferir que consegue acessá-la noutro dispositivo; continuam pendentes os itens de interface autenticada, mobile e cobertura de todos os módulos listados no checklist.

Próximo passo concreto: depois de 13:00 UTC em 2026-11-07, verificar se o workflow `Neon — backup PostgreSQL cifrado` executou com `event=schedule` e artifact cifrado. Se falhar, corrigir apenas a automação/credencial, sem relaxar o escopo da role.

## Auditoria de segurança e fluxos — 2026-11-07

Nesta continuação corrigi um risco de privacidade: `smtpPass` e `smtpConfig.pass` não são mais persistidos no Neon nem no cache local, nem incluídos em backup/exportação/importação. Cache local legado é sanitizado no boot; a senha permanece na memória da sessão corrente e o formulário informa que será necessário redigitá-la após recarga/importação. Uma consulta agregada ao Neon encontrou zero dos quatro workspaces com senha SMTP persistida. Também removi um endereço de e-mail pessoal de fixtures públicos de teste.

A auditoria financeira encontrou que o pagamento parcial de fatura duplicava o `sharedAmount` e o estorno não recompunha essa cota. Corrigi o rateio proporcional em centavos e acrescentei regressão. A aba de lançamentos agora confirma exclusão de item, série parcelada e pagamento de fatura; testes DOM cobrem edição, cancelamento e confirmação. Os testes de configurações cobrem upload/restore JSON sintético e cancelamento. Testes de API usam somente mocks para Gemini/Google Finance e SMTP, sem egress nem envio real.

Validação local atual: `bun test` 161/161 em 32 arquivos; `bun run lint`, `bun run build` e `git diff --check` passaram. O build continua com aviso para chunk principal acima de 500 kB. Health de produção respondeu `ok`, `services.neon=ok`, `services.neonLeastPrivilegeRole=true`; as quatro rotas autenticadas retornaram 401 sem Bearer. Cabeçalhos CSP, HSTS, X-Content-Type-Options, Referrer-Policy e Permissions-Policy estão presentes. `GEMINI_API_KEY` não está configurada na Vercel, então `liveFxSearch` fica desativado; as cotações B3 usam Google Finance. A verificação visual em Brave continua pendente: a conexão da extensão substituiu a conexão ativa ao tentar abrir uma aba, e a tela desktop/mobile não foi observada nesta continuação.

Removi o artifact cifrado QA `neon-backup-42320249250`; permanece o artifact cifrado de produção `neon-backup-42320784685` com expiração em 7/dez. Publiquei o conjunto no commit `be9fed4`; CI `42322323802` passou e Vercel `dpl_AV4EZmVhVtNsiCFVQv628FYUbUHU` está Ready no domínio principal. Health pós-deploy está `ok`/Neon `ok`/role restrita; `/api/workspace`, `/api/reminders/send-email`, `/api/fx/live-rate` e `/api/investments/sync-quotes` retornam 401 sem token. Bundle publicado não contém Firebase nem Guia Rápido e os chunks de configurações/lembretes mostram o aviso de que senha SMTP não é persistida.

Próximo passo concreto: após 12:23 UTC, verificar `neon-daily-activity.yml` com `event=schedule`; após 13:00 UTC verificar `neon-backup.yml` com `event=schedule`. Depois publicar as alterações locais e validar o deployment. Aceites ainda abertos: sessão real Neon Auth/OTP e CRUD, restore do arquivo pelo fluxo autenticado de interface, viewport desktop/mobile em Brave, segunda conta familiar (dispensada pelo usuário), chave `age` fora do computador e testes visuais dos módulos restantes.

## Retomada atual — 2026-11-07, Neon Auth + Neon PostgreSQL

O commit `a887df7` foi publicado em `main`. CI `42317905521` passou e o Vercel deployment `dpl_GoeZ9DQEmLyer1F5nWzhsD31VRQ2` está Ready, com alias de produção. Health público retorna `status=ok`, `neon=ok` e `neonLeastPrivilegeRole=true`; `/api/workspace` sem sessão retorna 401. O bundle ativo contém `X-Force-Fetch` e o erro seguro de sessão desatualizada, sem marcadores do SDK Firebase. A varredura atual em `src`, `backend`, `api` e `shared` não encontrou SDK, chamadas ou persistência Firebase; referências em migrations antigas preservam a história da conversão do schema.

Nesta sessão foram adicionados testes DOM sintéticos para criação de lançamento e exigência de autenticação nas rotas de câmbio/cotações/lembretes; os endpoints retornam 401 sem Bearer e não chamam serviços externos. A auditoria de OTP encontrou cache de sessão no SDK Neon Auth: após validar o código, `getJWTToken()` podia devolver token ainda não verificado. O patch local força a renovação da sessão, exige mesmo UID e `emailVerified=true` antes de liberar JWT à API e impede downgrade da UI por atualização atrasada do hook. `bun test` passou 143/143 em 29 arquivos; lint, build e diff-check passaram. O build ainda alerta o chunk principal de 621,82 kB. Os testes de OTP são de helper/contrato local; não houve sessão remota real.

As coleções antigas de demonstração `cloud_vaults` e `workspaces` estão registradas como apagadas e verificadas em sessão anterior, após autorização do usuário. Esta sessão não possui conector Firebase para repetir a verificação diretamente.

O projeto ainda não está pronto para aceite ponta a ponta: falta observar as execuções agendadas (Neon atividade às 12:23 UTC e backup PostgreSQL às 13:00 UTC de 2026-11-07), validar login/OTP e CRUD com conta controlada, completar restore pela interface autenticada, revisar desktop/mobile e fechar a cobertura visual/funcional dos módulos. O backup PostgreSQL independente já passou em execução manual e restauração em QA; isso não prova ainda o agendamento diário nem substitui os aceites de produto.

Próximo passo concreto: após 12:23 UTC, verificar `neon-daily-activity.yml` com `event=schedule`; após 13:00 UTC, verificar `neon-backup.yml` com `event=schedule` e artifact cifrado. Depois retomar restore pela interface autenticada e cobertura dos módulos.

O login em produção foi observado no Brave e o workspace apresentou valores financeiros zerados, indicador Neon PostgreSQL e banner de verificação familiar. A tela também mostrava o aviso antigo “Código aceito, mas a sessão ainda não refletiu a confirmação”, que motivou a correção local. Nenhuma conta, senha ou novo código foi submetido. A automação CUA parou quando a ferramenta não conseguiu identificar a URL atual da janela com confiança suficiente; viewport mobile e demais interações visuais seguem pendentes.

Executei manualmente o workflow GitHub `42316121492` (`workflow_dispatch`); o log mostra `psql` executando `SELECT 1` contra Neon com sucesso. A agenda diária está configurada para 12:23 UTC, mas Actions ainda não registra `event=schedule`; não chamar a execução manual de prova automática. A Vercel tem fallback `VITE_NEON_AUTH_URL` em produção, portanto validar `iss` não depende de cadastrar uma nova variável antes do deploy.

O worktree está limpo após a publicação. Próximo passo concreto: após a janela de 12:23 UTC de 7/nov, consultar o workflow `Neon — verificação diária` e exigir `event=schedule`; conferir o Vercel Cron separado. Depois seguir com signup/login/OTP real com caixa controlada, restore autenticado, backup PostgreSQL integral independente, interface mobile e cobertura visual dos demais módulos. A execução manual `42316121492` e o smoke HTTP são provas de execução manual, não do agendamento diário.

Adicionei e publiquei um teste DOM sintético para a criação de cartão de crédito no estado vazio: valida campos, nome obrigatório, limite maior que zero, conversão BRL e fechamento do formulário no salvamento. `bun test` passou 136/136, lint, build e diff-check passaram; o erro reportado não foi reproduzido neste caminho. Commit `6a4c78c`, CI `42316817588` aprovado, deployment `dpl_Et8ufk4zDp2a69XU7qaD2TeFf3T3` Ready. A cobertura não chega à API/Neon; para fechar a falha do usuário, retomar por teste autenticado em ambiente descartável ou registrar a limitação se faltar controle do navegador.

O commit `deef507` implementou e publicou o backup JSON v6 vinculado ao UID Neon Auth: exportação omite espelhos recebidos e contatos vinculados a convite; ao importar em outra conta, remove vínculos e metadados de compartilhamento; na mesma conta, mantém relações atuais vindas do Neon e sincroniza compartilhamentos somente por vínculos aceitos. CI `42315044261` passou e Vercel `dpl_Gp84YP8myPFaJ5BkhLUfgTmN4fdz` ficou Ready. Produção respondeu health `ok`/Neon `ok`/role restrita; bundle dinâmico do backup mostra o rótulo correto e não contém Firebase nem Guia Rápido. `bun test` passou 129/129 em 24 arquivos, lint e build passaram; o build avisa que o chunk principal tem cerca de 621 kB. Ainda não foi validado o restore pela UI com sessão autenticada.

Um follow-up local endurece a importação para remover também metadados familiares residuais em transações com `isShared=false`; suíte completa, lint e build passaram novamente. Publicado no commit `b6cf3f2`; CI `42315381945` passou e deploy `dpl_B636QbVhEWdgv8r5dx7GnC1DFmWM` está Ready. Health da URL pública continua `ok`/Neon `ok`/role restrita.

Última verificação em 2026-11-06: o deployment `dpl_En4cJ5L4RfyByFVPz4MARLUD5gYe` está Ready e `https://minhaseconomias-blue.vercel.app/api/health` retornou `status=ok`, `neon=ok` e `leastPrivilegeRole=true`. A aplicação conecta ao Neon com `minhas_app_runtime`, sem expor o nome da role ou a connection string no endpoint. O usuário confirmou que os documentos remanescentes em `cloud_vaults` e `workspaces` eram demonstração; a limpeza dessas coleções já consta como executada e verificada no Console Firebase nesta sessão histórica. O Firebase não é fonte de autenticação nem de dados em runtime.

Nesta continuação confirmei o deployment Ready e o indicador de role restrita em produção. Busca no runtime (`src`, `backend`, `api`, `shared`, configuração de build/deploy) não encontrou dependência ou chamada Firebase; as referências restantes estão somente nas migrations históricas necessárias para documentar a transição de schema. O Neon Auth e Neon PostgreSQL seguem como identidade e persistência. As coleções antigas `cloud_vaults` e `workspaces` já estavam registradas como apagadas e verificadas após a autorização anterior; não há leitura do app que as use.

Revisei no Brave a interface de produção em desktop: a tela de acesso e a alternância para cadastro renderizaram corretamente, sem o Guia Rápido, e o texto exibido após recarga identifica Neon Auth e Neon PostgreSQL. Na primeira renderização apareceu uma cópia antiga com “Firebase Auth”; após recarregar, a página atual mostrou o conteúdo Neon. Isso fica registrado como observação de cache/update da PWA, não como evidência de uso Firebase. A viewport mobile segue sem inspeção.

Adicionei `src/components/LoginPage.test.tsx` para cobrir a renderização do login por e-mail/senha, identificação do Neon Auth/PostgreSQL e ausência de texto Firebase ou demo na tela de acesso. `bun test` passou 124/124 em 24 arquivos e `bun run lint` passou; o build de produção local também passou, ainda com alerta para o chunk principal acima de 500 kB. Os testes e inspeções de UI não exercitam um cadastro real nem chamadas financeiras com token autêntico.

Próximo passo concreto: após a janela de 2026-11-07 12:23 UTC, consultar GitHub Actions para `neon-daily-activity.yml` e confirmar uma execução com `event=schedule`; conferir também os logs do Vercel Cron `15 12 * * *`. Bloqueios que mantêm a meta aberta: cadastro/login/OTP real com caixa controlada; backup/restauração integral e autenticada; revisão visual desktop/mobile; cobertura renderizada dos módulos; e ensaios de concorrência e recuperação após indisponibilidade. Não marcar a meta como pronta até esses aceites serem demonstrados.

O corte de identidade e persistência para Neon foi publicado em `main` nos commits `79c19eb` e `41f65eb`; o deploy de produção está ativo. A checagem ao vivo de 2026-11-06 respondeu `/api/health` HTTP 200 com `neon=ok`. O bundle publicado contém Neon Auth e não contém SDK/chamadas Firebase (`firebase-sdk=False`). As variáveis de produção verificadas após a publicação são `DATABASE_URL`, `NEON_AUTH_JWKS_URL` e `VITE_NEON_AUTH_URL`; as variáveis Firebase foram removidas. Firebase não participa mais da autenticação nem do armazenamento operacional.

A migration `006_neon_auth_identity.sql` foi ensaiada em QA e aplicada em production. A API valida tokens Neon Auth EdDSA/JWKS; Neon PostgreSQL é a única persistência financeira. As coleções antigas de demonstração no Firestore foram apagadas por autorização do usuário. A branch QA foi removida.

Nesta continuação corrigi a lacuna na confirmação OTP: o aviso de e-mail agora permite reenviar código e submetê-lo aos endpoints `email-otp/send-verification-otp` e `email-otp/verify-email`; a mensagem de login não cita mais Firebase. Publicado em `main` no commit `6559f24`; CI `42310826607` passou. Deploy Vercel `dpl_3FZPfVFNJPV8Eje5Fyf5DU1gecUV` ficou Ready e associado ao domínio principal. Bundle remoto `index-D4bhdGNs.js` contém a UI e endpoints OTP e não contém SDK/chamadas Firebase; `/api/health` deu HTTP 200/Neon `ok`; `/api/workspace` sem token deu 401. Localmente `bun test` passou 121/121, `bun run lint`, `bun run build` e `git diff --check` passaram. O build segue emitindo aviso para o bundle principal acima de 500 kB. A sessão real de cadastro/verificação por e-mail ainda não foi exercitada com uma conta de teste.

Próximo passo: validar cadastro, OTP e CRUD com conta autorizada; isso requer caixa de e-mail controlada. Meta de revisão ponta a ponta permanece ativa, incluindo teste de restauração autenticada e comprovação do job diário automático.

## Auditoria atual — 2026-11-06

Neon MCP confirmou somente a branch `production` (`br-steep-feather-b615vl9d`). A configuração Neon Auth está habilitada para o domínio de produção, localhost desligado, cadastro e senha ativados, verificação OTP e sem provedores OAuth. Não há branches QA abertas. No banco, as quatro tabelas `finance_*` estão com RLS habilitado e forçado; há uma policy de titular/participante por tabela. A role `minhas_app_runtime` não tem atributos administrativos, não pertence a `neon_superuser` e só possui os grants operacionais descritos na migration 004; `minhas_daily_runtime` não tem grants em tabelas financeiras. As contagens agregadas atuais são zero para contas, cartões, transações, metas, investimentos, viagens, convites e transações compartilhadas. Restam três linhas de workspace e três recibos de migração, sem itens financeiros nos snapshots.

Limite de segurança: `vercel env ls production` confirma apenas `DATABASE_URL`, `NEON_AUTH_JWKS_URL` e `VITE_NEON_AUTH_URL`, mas não revela a role dentro da connection string. A tentativa de inspecionar por `env pull` foi bloqueada. Adicionei `services.neonLeastPrivilegeRole` ao health: é apenas booleano, não revela nome da role nem credencial; teste local cobre o caminho. O valor em produção só será conhecido depois do deploy deste commit. Se vier `false`, atualizar Vercel para usar `minhas_app_runtime` antes de concluir.

Atividade diária: Vercel lista `/api/health` às `15 12 * * *` UTC e a rota consulta a tabela Neon. O workflow GitHub segue às `23 12 * * *` UTC, mas as execuções visíveis são `workflow_dispatch`; logs Vercel consultados também não demonstraram disparo automático. A próxima execução programada é a janela de 7/nov, não comprovada nesta sessão.

Backup: o JSON do app não inclui `finance_family_invitations` nem `finance_shared_transactions`; Neon Free mantém PITR de seis horas e não há cópia independente automática. Teste de restore API e ensaios de snapshot/dump foram sintéticos/isolados; restauração autenticada UI→API→Neon e retorno após corrupção continuam pendentes. A segunda conta para teste de compartilhamento foi dispensada pelo usuário, então a aceitação fica limitada ao fluxo do proprietário e regras de isolamento.

Interface: a auditoria de código confirmou seeds financeiros vazios e ausência do Guia Rápido; testes existentes são majoritariamente de regra/API e não cobrem toda a interface renderizada. O Brave estava aberto em outra página, mas a ferramenta de uso do computador não conseguiu identificar sua URL com confiança; nenhuma revisão visual desktop/mobile foi feita nesta retomada. Exige novas capturas e fluxos completos quando o controle visual estiver disponível.

Neon Auth: chamadas `OPTIONS` aos endpoints de envio e validação OTP responderam 204 com origem Vercel e `Access-Control-Allow-Credentials: true`; `GET /get-session` respondeu 200/null para essa origem. Isso valida a base de URL e CORS sem emitir e-mail; envio, confirmação com código, cookie de sessão e aceite real ainda não foram exercitados.

Vestígio adicional de migração: a inspeção do catálogo revelou cinco constraints NOT NULL ainda nomeadas com `firebase_uid`, apesar das colunas já terem sido renomeadas em 006. Criei `db/migrations/007_neon_auth_constraint_names.sql`, apliquei primeiro na branch `qa-audit-rls-2026-11-06`, confirmei zero objetos/colunas/rotinas com nome Firebase e policies RLS intactas, depois apliquei em production. A validação pós-migração confirmou zero nomes Firebase no catálogo ativo, RLS enabled/forced nas quatro tabelas, contagens de workspaces/recibos inalteradas (3/3), convites/transações compartilhadas vazios (0/0). Consulta à tabela de workspace com a role `minhas_app_runtime` sem contexto `app.user_id` retornou zero linhas, confirmando RLS fail-closed para essa role. A branch QA foi removida; Neon lista apenas production. `bun test` (121/121), lint, build e diff-check passaram. Commit `d43394d`, CI `42312647937` passou; deploy `dpl_Ce1zsXY2KY6rwAWUa9RNx76UPARg` Ready. Smoke após a publicação: health 200/Neon ok, workspace sem token 401.

As seções abaixo são registros cronológicos anteriores. Quando mencionarem Firebase Auth, login Google, `localhost` Firebase, branches expiradas ou passos já executados, esses dados descrevem o estado daquela sessão e estão superados pela migração Neon Auth e por esta auditoria atual.

## Histórico — migração Firestore → Neon (antes da troca de autenticação)

### Estado registrado — 2026-11-06, migração Firestore → Neon

Meta de conclusão ponta a ponta ainda ativa. Neon é o único banco operacional do app. Firebase Auth continua como provedor de identidade e emissão do token que o backend valida; conforme pedido anterior, esta tarefa migra a persistência, não o login.

Nesta sessão, removi o importador, a rota do backend e a leitura Firestore de inicialização; usuário autenticado sem workspace passa a criar um vazio diretamente no Neon. A revisão do artefato Vercel revelou que `api/workspace/migrate.ts` ainda publicava uma função dedicada mesmo exportando o app Express, então removi esse adaptador no commit `88f0824`. CI `42305119471` passou; deployment `dpl_7Uzq7UXeRsfD29ZxhVernRFNkQWs` ficou Ready e não lista mais a função de migração. Pós-deploy `/api/workspace/migrate` retornou 404, `/api/workspace` sem token 401 e `/api/health` confirmou `Neon=ok`. Uma busca final em `src`, `backend`, `shared` e `api` não encontrou import ou chamada Firestore; corrigi também um comentário obsoleto no parser OFX. As regras foram publicadas no Console Firebase em modo deny-all. Após confirmação explícita de que eram demonstração, excluí no Console Firebase as coleções legadas `cloud_vaults` e `workspaces`; a raiz agora informa que o banco está pronto para receber dados.

No Neon production, uma consulta agregada após limpar o cartão temporário de QA confirmou 3 workspaces, 0 contas, 0 cartões, 0 lançamentos e 0 metas/investimentos. O cartão QA foi criado pela UI, persistiu após recarga e foi removido; nenhum dado de demonstração ficou no Neon.

Publicado em `main` no commit `bdaf318` (`fix: make Neon the only financial data store`). CI GitHub `42304154567` passou. Deployment Vercel `dpl_DYGLyJ3kvBn4YeGYVeiG79ZVxw97` ficou Ready com alias `minhaseconomias-blue.vercel.app`. Pós-deploy: `/api/health` respondeu `status=ok` e `Neon=ok`; `/api/workspace` sem token respondeu 401; o bundle principal publicado (`index-DOQJihoW.js`) não contém `getFirestore`, `cloud_vaults`, a rota de migração nem endpoint do Firestore. Localmente `bun test` passou 119/119, `bun run lint`, `bun run build` e `git diff --check` passaram. Build mantém aviso de chunk principal acima de 500 kB.

Autenticação: a UI oferece e-mail/senha via Firebase Auth e não oferece OAuth Google, conforme a decisão do usuário de que Google não é necessário. O estado dos provedores no Console Firebase não foi verificado nesta sessão. O cadastro/login real ainda não foi validado ponta a ponta.

Atividade diária: workflow GitHub `neon-daily-activity.yml` teve execução manual bem-sucedida com `SELECT 1`; falta confirmar o primeiro evento automático previsto para 2026-11-07 12:23 UTC. O Vercel Cron diário `/api/health` continua listado em `15 12 * * *`; a consulta dos logs de produção às 2026-11-06 22:25 UTC retornou apenas chamadas manuais recentes e nenhuma execução programada identificável. A próxima ação é confirmar o evento automático do GitHub na janela de 7/nov e reavaliar o cron Vercel.

Nesta continuação, corrigi a aba “Autenticação e nuvem” para usar o mapeador de erros Firebase e retirar a afirmação prematura de sincronização. Também removi comentário obsoleto de Cloud Vault e confirmei por busca que “Guia Rápido”/“Quick Guide” não aparece na UI atual. A auditoria confirmou que as listas iniciais de dados financeiros são vazias, com categorias-base como defaults do produto. O fluxo de persistência agora agenda até oito novas tentativas com backoff para falhas de rede/408/429/5xx, lê sempre o payload mais recente, tenta no evento `online`, limpa a fila ao trocar de UID e deixa conflitos 409 para a resolução existente. Adicionei testes da classificação de erros; suíte local 121/121, `bun run lint`, `bun run build` e `git diff --check` passaram. O build ainda alerta que o bundle principal tem cerca de 566 kB. A recuperação foi verificada por testes da política e compilação, mas ainda não por uma pane runtime UI→API→Neon.

A correção foi publicada em `main` no commit `6e2a89e`; CI `42306945924` passou e o deployment Vercel `dpl_35NmsXWDRDADTL2sDs6uJCATX3uH` está Ready, com alias `minhaseconomias-blue.vercel.app`. A página atualizada aponta para `/assets/index-DtbxLZFn.js`; o conteúdo remoto foi comparado ao build local e é idêntico (566.109 bytes). Pós-deploy, `/api/health` retornou `status=ok`/`Neon=ok` e `/api/workspace` sem token retornou 401. Isso ainda não prova fluxo autenticado no browser nem recuperação de pane.

Próximo passo concreto: validar cadastro/login real e restore autenticado UI→API→Neon numa branch QA; exercitar pane e retry pelo navegador com fixture descartável; depois confirmar a execução automática diária na janela prevista de 2026-11-07 12:23 UTC. O backup JSON cobre workspace pessoal, mas não as tabelas relacionais de convites e transações compartilhadas; definir o comportamento sem transplantar dados para outro UID.

Revisão visual: a página de login de produção foi observada no Brave em desktop (viewport 1920×917); a inspeção mobile não foi concluída porque o controle encerrou ao não conseguir determinar a URL atual da janela. Isso não comprova os demais fluxos visuais.

Bloqueios pendentes: aceite real de cadastro/login; restore autenticado UI→API→Neon; ensaio runtime de pane/retry; definição e ensaio de backup das relações familiares; verificação da agenda diária automática; cobertura visual desktop/mobile e testes dos demais módulos.

## Incidente de produção — 2026-11-06, resolvido

Após o deploy `af357d3`, `/api/health` retornou 500. O log Vercel identificou `ERR_MODULE_NOT_FOUND` para `src/utils/financeRules`, importado por `src/utils/travelRules.js`; a causa foi o import local sem extensão, que passava no Vite/TypeScript mas não era resolvido pelo runtime ESM da função Node. O import foi alterado para `./financeRules.js` e publicado em `78fd56f`. CI `42277562293` passou; deployment `dpl_BnBgD8HHS6Z15sSfgvMSABoCNAS6` ficou Ready. Depois do deploy, `/api/health` respondeu 200 com `Neon=ok` e `/api/workspace` sem token respondeu 401. O serviço foi revalidado após a correção.

## Retomada — 2026-11-06

Meta segue ativa. Nesta sessão foram corrigidos fluxos financeiros (pagamento parcial de fatura, inclusão correta de compras na fatura, validação de rateio e precisão de centavos) e removido o login Google da interface/código; Firebase Auth permanece com e-mail e senha, e Neon continua como banco. `bun test` passou com 116 testes em 21 arquivos, `bun run lint` passou e `bun run build` passou com aviso de bundle acima de 500 kB. A UI local e a produção mostraram somente o formulário de e-mail/senha. Isso não valida cadastro/login autenticado nem restore de backup via UI.

Firebase informa autenticação na faixa sem custo conforme limites/planos e modalidade; SMS de telefone é cobrado. A troca de provedor remove Google da experiência, mas não garante custo zero do sistema completo. O projeto Firebase não foi acessado nesta retomada; não confirmei se Google continua habilitado no Console.

BrowserOS Neo não tinha sessão autenticada no Firebase Console ou Vercel. A página local e a produção mostram o login por e-mail/senha, mas isso não prova autenticação real. A branch QA `qa-restore-ui-retry-2026-11-06` e o `.env` temporário foram removidos; o servidor local foi interrompido.

Publicação concluída: commit `166f9a0` na `main`; CI `42274441778` passou e deployment Vercel de produção ficou Ready, com alias `minhaseconomias-blue.vercel.app`. O endpoint de saúde respondeu `status=ok` e `Neon=ok`; a UI de produção mostrou o login por e-mail/senha.

Próximo passo concreto: testar cadastro e login real em Firebase, CRUD e restore de backup pela UI apontada a Neon QA, cobrindo os módulos restantes em desktop/mobile. Vercel Cron está listado, mas ainda não há evidência de execução automática nos logs consultados.

## Continuação — atividade diária (2026-11-06)

A busca de logs Vercel de produção nas últimas 24 horas encontrou um GET manual a `/api/health` às 18:51 UTC, mas não encontrou a invocação da janela diária das 12:15 UTC. `vercel crons list` continua listando essa agenda, o que comprova cadastro, não execução. Removi o `.env` local ignorado sem ler seus valores. A branch QA foi removida e só `production` permanece.

Para manter checagem diária direta ao banco, alterei `.github/workflows/neon-daily-activity.yml` para agendar `SELECT 1` diariamente às 12:23 UTC, além do `workflow_dispatch`. O teste manual do workflow ainda deve ser executado após publicação; a primeira execução agendada precisa ser observada na próxima janela. GitHub informa que schedules usam UTC e podem sofrer atraso ou suspensão após 60 dias sem atividade no repositório público.

Próximo passo concreto: publicar a alteração do workflow, dispará-lo manualmente e confirmar sucesso com o segredo `NEON_DATABASE_URL`; na próxima janela de 12:23 UTC confirmar `event=schedule` e `SELECT 1`. Em seguida, continuar cadastro/login Firebase real e restore UI→Neon QA.

## Estado — 2026-11-04 18:10 UTC

Meta ainda ativa: fechar a auditoria de ponta a ponta sem reduzir o escopo. Neon `production` é o banco operacional e Firebase Auth fornece identidade. O commit mais recente `e185fa6` está em `main`; CI `41884363305` concluiu com sucesso e o deployment de produção correspondente está Ready. O alias principal retornou HTTP 200 e `Neon: ok` em `2026-11-04 18:10 UTC`; workspace sem token respondeu 401.

## Feito nesta continuação

- API real→Neon foi validada em uma branch descartável usando `minhas_app_runtime`: GET vazio 404, criação 201, atualização 200 e readback 200/revisão 2. O token Firebase foi simulado localmente; isso não prova restore pela interface autenticada.
- Consulta agregada confirmou que o UID sintético de QA não existe em produção. Apaguei a branch e confirmei que Neon lista somente `production`.
- Pelo site de produção autenticado: criei cartão, conta, despesa, meta, viagem e ativo de investimento sintéticos; recarreguei e confirmei persistência; excluí os registros e esperei a sincronização. Também alterei o teto de uma categoria, recarreguei, confirmei persistência e retornei o valor a R$ 0,00.
- A consulta agregada final confirmou 3 workspaces de produção com zero contas, cartões, lançamentos, metas, investimentos e viagens; nenhuma fixture QA permaneceu. O site recarregado mostrou o estado vazio com “Nuvem sincronizada”.
- Não sincronizei cotações externas. O erro relatado no cadastro de cartão não se reproduziu no fluxo válido create→reload→delete.
- Removi os dois vínculos órfãos da conta autenticada aberta e confirmei estado sincronizado. Os 3 vínculos restantes estão em outros 2 workspaces: 2 têm `invitationId` sem convite correspondente e 1 não tem `invitationId`. UI/API restringe alterações ao UID autenticado; não executei SQL administrativo para apagar registros de outros titulares.
- A auditoria dos agentes mapeou dez módulos e encontrou quase nenhum teste React/browser; não há Playwright, Cypress ou Testing Library configurados. Lógica, API simulada e regras têm testes, mas isso não substitui aceite visual e funcional de cada módulo.
- Login Google no `localhost` exibiu “Não foi possível conectar com o Google”. Ainda não foi possível distinguir domínio autorizado ausente de outra falha OAuth; nenhuma credencial foi copiada. A sessão de produção continua utilizável.
- Com autorização específica do usuário, adicionei `localhost` aos domínios autorizados do Firebase e confirmei que o app redirecionou para o seletor Google. A interação com a janela de seleção falhou repetidamente no controle do navegador antes de selecionar uma conta. Removi `localhost`; conferi que ele não aparece mais e que `minhaseconomias-blue.vercel.app` continua autorizado.
- Criei e removi `qa-restore-auth-2026-11-04`; Neon lista novamente apenas `production`. Parei o servidor local e removi `.env` temporário. Nenhum restore ou dado foi gravado nessa branch ou em produção.
- Reexecutei localmente `bun test` (112/112), `bun run lint` e `bun run build` com sucesso; o build ainda sinaliza chunk JS inicial de 566 kB (~168 kB gzip). Vercel lista deployment correspondente ao commit `e185fa6` como Ready.
- `vercel crons list` mostra `/api/health` às 12:15 UTC diariamente, enabled, sem configuração undeployed. A verificação ao vivo em 18:10 confirmou Neon saudável. A próxima execução automática (2026-11-05) ainda precisa ser observada; o workflow GitHub chamado `neon-daily-activity.yml` é apenas manual (`workflow_dispatch`).

## Evidências anteriores ainda válidas

- Último CI executou lint, suíte completa e build em sucesso; a suíte tinha 112 testes em 21 arquivos. O build alerta para chunk inicial de ~566 kB (~168 kB gzip).
- Backup completo versão 5 foi baixado na sessão autenticada e tinha 12 campos esperados, sem ausências; o botão de Relatórios foi corrigido para usar o exportador completo.
- Relatórios foi verificado uma vez em 390×844 sem overflow horizontal e Overview foi observado em desktop; não cobre os demais módulos responsivos.
- RLS está forçado nas tabelas financeiras; roles runtime foram revisadas sem privilégios elevados. Migration 005 foi aplicada em produção e a branch QA anterior removida.
- `vercel.json` agenda `/api/health` diariamente às 12:15 UTC. A execução automática seguinte ainda precisa ser comprovada em 2026-11-05, janela `12:15–13:14:59 UTC`.

## Pendências e limites

- Fazer o restore UI→API→Neon com uma sessão autenticada utilizável em ambiente QA. A tentativa local avançou até o seletor de contas Google, mas o controle da janela não permitiu selecionar conta; a branch de QA foi removida e Firebase voltou à configuração original.
- Cobrir mais profundamente Compartilhado e Relatórios, revisar os dez módulos em desktop/mobile e executar testes de acessibilidade e visual.
- Os domínios Firebase foram inspecionados; `localhost` foi removido. Falta uma sessão controlável no BrowserOS neo para autenticar em uma origem QA e concluir o restore UI→Neon. Nesta sessão só há Chrome comum; o plugin BrowserOS neo não está conectado.
- Remover os 3 vínculos demo nos dois workspaces restantes sem violar o isolamento por UID; faltam as sessões dos respectivos titulares ou caminho administrativo explicitamente autorizado.
- Comprovar a execução do Cron automático em 5/nov.
- Gemini não está configurado; SMTP e demais integrações externas não foram validadas ponta a ponta.

## Próximo passo concreto

Após o BrowserOS neo estar conectado, abrir uma origem QA aceita pelo Firebase, recriar branch Neon descartável, apontar a aplicação para ela e importar um backup sintético; confirmar persistência pelo GET/consulta agregada no Neon, excluir fixture e branch. Confirmar a execução automática do Cron na janela de 2026-11-05 12:15–13:14:59 UTC.

## Bloqueios

- UI de produção está autenticada, mas essa sessão é específica do domínio de produção. O seletor de conta Google em localhost foi visível, porém interação pelo navegador não funcionou; localhost já foi removido dos domínios autorizados.
- BrowserOS neo não está ativo/conectado na sessão atual; a skill dedicada requer esperar por essa conexão em vez de operar o site no Chrome comum.
- O Cron depende da próxima execução automática.

## Continuação — 2026-11-04

- Com autorização explícita do usuário, removi as 3 referências familiares demo órfãs dos dois workspaces afetados. Consulta agregada posterior confirmou zero contas, cartões, lançamentos, metas, investimentos, viagens, membros familiares, convites e lançamentos compartilhados nos 3 workspaces.
- Neo Lite abriu o app local conectado à branch Neon QA `qa-restore-ui-2026-11-04` (`br-noisy-forest-b66bukxg`). A tela de login carregou, mas o estado permaneceu em “Autenticando...” por mais de 17 segundos; o restore UI→API→Neon não foi atingido. Branch QA removida ao encerrar.
- `localhost` foi adicionado temporariamente aos domínios Firebase conforme autorização. A tentativa de login não terminou e não consegui remover a autorização temporária antes de encerrar; `localhost` precisa ser removido manualmente no Console Firebase.
- Verificar e remover `.env` local temporário, caso ainda exista. Não reutilizar a connection string da branch QA já apagada.
- O job diário `/api/health` segue ativo em `15 12 * * *` UTC; comprovar o disparo automático de 5/nov na janela 12:15–13:14:59 UTC.

## Próximo passo concreto

Remover `localhost` nos domínios autorizados do Firebase; diagnosticar por que o login no Neo Lite fica em “Autenticando...” e então repetir o restore com fixture em branch Neon QA isolada. Acompanhar o disparo automático do Cron de 5/nov.

## Bloqueios atualizados

- Restauração completa via UI permanece sem validação por carregamento indefinido da autenticação local.
- Domínio Firebase temporário `localhost` ainda requer remoção.
- A primeira execução diária automática do Cron ainda precisa de comprovação.

## Atualização posterior — autenticação e domínio

- Corrigido o registro acima: a autorização `localhost` foi removida no Firebase Console e a interface confirmou “localhost removido”; `minhaseconomias-blue.vercel.app` continua autorizado. O item de remoção não é mais pendente.
- O popup OAuth estava em janela separada, não travado no app. A seleção automatizada abriu uma conta Google que pediu senha; não inseri senha, código ou credencial e interrompi o fluxo. Restore UI→API→Neon continua pendente até autenticar na conta correta do workspace.
- `qa-restore-ui-2026-11-04` já foi excluída e `.env` temporário já foi apagado. O servidor local não está mais em execução; a branch `production` não foi usada para este ensaio.
- Próximo passo concreto: retomar quando o usuário selecionar no popup a conta usada no Minhas Economias e o app local abrir autenticado; recriar então uma branch Neon QA com role runtime e confirmar um backup sintético no Neon. Depois limpar fixture e branch.

## Continuação — 2026-11-11

- Na auditoria financeira ampla, endureci os agregados cambiais de viagem: médias ponderadas e análises por lote/mês descartam valores não finitos e montantes acima da faixa segura de centavos. Custos registrados inválidos não contaminam as estatísticas; lotes sem custo registrado ainda usam taxa válida para derivá-lo.
- Corrigi também as contas internacionais: despesas pendentes deixam de reduzir o saldo atual e passam a aparecer separadas no saldo previsto da competência selecionada. Competências e lotes cambiais futuros ficam fora do saldo histórico; lotes não finitos/inseguros não entram no cálculo.
- Na conciliação, trocar a conta agora recalcula os possíveis duplicados antes de confirmar. O OFX preserva `CURDEF`; moeda desconhecida, incompatível ou não-BRL sem conversão deixa a importação bloqueada para evitar valores estrangeiros registrados como reais.
- Acrescentei regressões para `NaN`, infinito, overflow, saldo internacional pago/pendente, troca de conta/duplicatas e bloqueio de moeda. Validação local final: 427 testes em 58 arquivos, lint/TypeScript, build PWA (87 entradas) e `git diff --check` aprovados.
- Nenhuma sessão autenticada, consulta ou gravação no Neon foi realizada; não houve publicação.

## Continuação da auditoria financeira — 2026-11-11

- Implementei a conversão de extratos OFX em moeda estrangeira na conciliação: a pessoa informa uma taxa por arquivo, vê os valores convertidos na prévia, e cada lançamento guarda valor original, moeda e taxa aplicada. Moeda desconhecida, incompatível ou precisão inválida continua bloqueada.
- Ajustei saldo internacional para incluir entradas pagas e pendentes e a taxa média de custo para considerar saldo inicial, lotes e receitas com taxa válida.
- Propaguei os metadados cambiais quando um item conciliado liquida uma fatura de cartão. Round-trip JSON local/Neon coberto por teste sintético.
- Protegi a fila de sincronização contra respostas atrasadas após troca de usuário: retornos da sessão anterior não atualizam a revisão, o estado de sincronização nem disparam retry para a conta nova.
- Corrigi o rateio de parcelas para dividir em centavos inteiros e distribuir o resto centavo a centavo. O caso R$ 0,58 em duas vezes agora é R$ 0,29 + R$ 0,29; parcelas compartilhadas usam o mesmo cálculo.
- Endureci a validação do workspace: transações tipadas exigem valor numérico, não negativo e dentro da faixa segura de centavos. Valores monetários de contas/cartões/orçamentos também são validados quando presentes. Backend rejeita antes de acessar o banco; a hidratação do app usa a mesma validação.
- Estendi a validação de transações persistidas para exigir data calendário válida, competência `AAAA-MM` e status `paid`/`pending`, além do valor. Isso evita colocar saldo no mês incorreto ou deixar o comparador trabalhar com competência indefinida.
- Corrigi a projeção do fluxo de caixa diário para refletir faturas abertas no vencimento, faturas antigas em atraso no primeiro dia e a parte que a pessoa deve em despesas pagas por familiar na data do lançamento. O saldo realizado não muda; pagamentos quitados continuam na data real.
- Validação local final: 432 testes em 58 arquivos; lint/TypeScript, build PWA (88 entradas) e `git diff --check` passaram. Git reportou apenas avisos LF/CRLF.
- Ainda falta a execução autenticada e readback no Neon Preview; não houve acesso ao Neon nem publicação nesta continuação.

## Próximo passo concreto

Seguir os itens ainda abertos em `docs/AUDITORIA_LOGICA_FINANCEIRA.md`, começando pela validação autenticada de gravação/leitura com fixture sintética no Preview QA e depois continuar a auditoria dos módulos e limites de integração restantes. A credencial temporária Neon ainda precisa ser revogada no painel. A sessão de QA continua sem validação.

## Bloqueios

- QA autenticado/readback segue pendente até haver sessão válida no Preview QA; a credencial temporária do Neon também ainda precisa ser revogada no painel.
- OFX usa uma taxa por arquivo; extratos com taxas diferentes entre linhas precisam ser separados antes da importação.

## Continuação — 2026-11-11

- Corrigi a sugestão de categoria/subcategoria no formulário: agora detecta alteração de subcategoria mesmo quando a categoria permanece igual, limpa subcategoria incompatível ao trocar de categoria, ignora ID antigo que já não existe e preserva escolha manual.
- Cobri a edição de compra parcelada para confirmar que o formulário apresenta e salva o total original da compra, além dos testes de regressão da classificação automática.
- Validação local atual: `bun test` 437/437 em 58 arquivos; lint/TypeScript, build PWA (88 entradas) e `git diff --check` aprovados. Apenas avisos de normalização LF/CRLF.
- Nenhum dado real foi acessado e nada foi publicado. QA autenticado/readback no Neon Preview permanece pendente.

## Próximo passo concreto

Continuar a auditoria dos fluxos financeiros restantes em `docs/AUDITORIA_LOGICA_FINANCEIRA.md` e, quando houver sessão controlável, executar CRUD sintético com readback autenticado no Neon Preview. A credencial temporária Neon ainda precisa ser revogada no painel.

## Bloqueios

- Readback autenticado no Neon Preview aguarda sessão válida; não foi possível confirmar persistência remota nesta sessão.
- OFX aplica uma taxa por arquivo; extratos com taxas diferentes entre linhas precisam ser separados.

## Continuação da auditoria financeira — 2026-11-11

- Estendi `src/utils/workspacePayload.ts` para validar dados financeiros de metas, investimentos, períodos de viagem, lotes cambiais e liquidações, inclusive IOF de 0–100%, rendimento mensal não negativo e casas decimais segundo a moeda da viagem. Preços de ativos/taxas mantêm precisão fracionária; valores BRL são limitados a centavos.
- Cobri parsing local e rejeição pela API em `src/utils/workspacePayload.test.ts` e `backend/familyApi.test.ts`. Testes direcionados: 27/27; suíte completa: 433/433 em 58 arquivos; lint/TypeScript e build PWA (88 entradas) passaram. `git diff --check` passou com avisos de normalização LF/CRLF.
- Corrigi corridas de sessão no fluxo de sincronização: a carga inicial agora reage a troca de UID mesmo com o mesmo e-mail; o estado de conflito por 409 e a resolução “manter local” não podem sobrescrever a sessão seguinte. O harness integrado passou com oito cenários, incluindo resolução atrasada. A verificação final após essas alterações foi 433/433 testes, lint, build PWA (88 entradas) e `git diff --check`.
- Rastreiei a liquidação da fatura até saldo bancário, despesa por competência, categoria, relatório de período e calendário. A conta perde o valor uma vez na data real do pagamento; o consumo continua atribuído à compra e o pagamento não duplica despesas. Nova regressão em `src/utils/financeRules.test.ts`; suíte final 434/434 em 58 arquivos, lint, build PWA (88 entradas) e diff-check passaram.
- Atualizei `docs/AUDITORIA_LOGICA_FINANCEIRA.md` e `CHECKLIST.md`. Não houve acesso a dados reais nem publicação; readback autenticado no Neon Preview permanece pendente.
- Nenhum dado real foi acessado e nada foi publicado.

## Atualização mais recente — 2026-11-11

- Corrigi a sugestão de categoria/subcategoria ao alterar o estabelecimento: atualiza subcategoria mesmo na mesma categoria, limpa subcategoria incompatível, ignora ID histórico removido e preserva escolha manual. Também confirmei no modal que editar uma parcela apresenta e salva o valor total original da compra.
- Validação local final: `bun test` 437/437 em 58 arquivos; lint/TypeScript, build PWA (88 entradas) e `git diff --check` aprovados. Não houve acesso a dados reais nem publicação.
- Próximo passo concreto: continuar a auditoria dos fluxos financeiros restantes listados em `docs/AUDITORIA_LOGICA_FINANCEIRA.md`; quando houver sessão controlável, executar CRUD sintético e readback autenticado no Neon Preview.
- Pendente: QA autenticado/readback no Preview e revogação da credencial temporária Neon no painel. OFX ainda aplica uma taxa única por arquivo.

## Atualização da auditoria — 2026-11-11

- Corrigi outro problema no formulário de edição: séries legadas incompletas com pagamento parcial podiam apresentar uma soma parcial como preço original. O sistema agora só infere total quando todos os números de parcela estão presentes; se faltar histórico, mostra o valor da parcela atual, explica a incerteza e limita a edição àquela parcela.
- Cobertura de regressão incluiu uma parcela parcialmente paga dividida em linhas e uma terceira parcela ausente. Validação local final: `bun test` 438/438 em 58 arquivos; lint/TypeScript, build PWA (88 entradas) e `git diff --check` aprovados.
- Próximo passo concreto: seguir os demais fluxos em `docs/AUDITORIA_LOGICA_FINANCEIRA.md` e concluir CRUD sintético/readback autenticado no Neon Preview quando houver sessão controlável. QA remoto permanece pendente; nenhum dado real foi acessado nem houve publicação.

## Atualização da auditoria — 2026-11-11

- Separei o backup histórico da aplicação de metadados: a primeira ação só baixa o JSON; a alteração depende de novo clique após a pessoa confirmar que salvou o arquivo. A URL de download agora não é revogada imediatamente.
- O teste do relatório confirma que o primeiro passo não altera o workspace e que a aplicação só ocorre na segunda confirmação. Validação local: `bun test` 438/438 em 58 arquivos, lint/TypeScript, build PWA (88 entradas) e `git diff --check` aprovados.
- Próximo passo: continuar a auditoria dos fluxos financeiros restantes e concluir QA sintético autenticado/readback no Neon Preview. Sem acesso a dados reais ou publicação nesta sessão.
