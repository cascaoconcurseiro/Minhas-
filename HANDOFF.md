# Handoff — Minhas Economias

> **Documento obrigatório.** Toda entrega (commit que muda `src/`, `backend/`, `api/`, `db/`, `shared/` ou `package.json`) **precisa** de uma nova entrada na seção 7 e da atualização das seções 1–6 quando mudarem. O CI barra a entrega se isso não for feito (`bun run check:handoff`). Regras completas: [docs/processo/handoff-e-checklist.md](./docs/processo/handoff-e-checklist.md). Histórico antigo: [docs/arquivo/handoff/](./docs/arquivo/handoff/).

## 1. Estado atual
- **Atualizado em:** 2026-11-15
- **Produção:** branch `main` publicada na Vercel (projeto `minhaseconomias`), banco Neon `minhas-economias-br`.
- **Resumo:** sistema financeiro completo em uso (lançamentos, cartões, contas, orçamentos, viagens, compartilhado, investimentos, relatórios, **A Receber**). Código reorganizado por áreas (`components/` por pasta, `domain/` regras, `services/` dados) e documentação refeita em `docs/`.
- **Verificação mais recente (2026-11-15):** `tsc` limpo · 755 testes passando · build PWA ok.
- **Estrutura do código:** ver [docs/tecnico/estrutura-do-codigo.md](./docs/tecnico/estrutura-do-codigo.md).

## 2. Em andamento
| Item | Situação |
|---|---|
| Reorganização e documentação (meta do dono em 2026-11-15) | Pastas, docs e HANDOFF concluídos; ver entrada de 2026-11-15 |

## 3. Próximos passos (ordem de prioridade)
1. Decidir como ler fatura de cartão em **PDF/foto** (IA externa mais precisa × leitura só no aparelho). Sem decisão ainda.
2. Importação de **fatura de cartão** (OFX/CSV) — exige um arquivo real de fatura do banco do dono para acertar o formato.
3. Dividir arquivos grandes sem mudar comportamento (`TransactionModal`, `App.tsx`, `financeRules.ts`, `backend/app.ts`) — ver `CHECKLIST.md`.
4. Conferir em iPhone/Safari reais as telas novas (A Receber, cartões, campo de data).

## 4. Pendências do dono (dependem do Wesley)
- Pedir à Fran para atualizar o app e conferir os 110 compartilhados (já gravados no Neon em 2026-11-15).
- Atualizar o app instalado: Conta, Login & Nuvem → **Buscar atualização agora**.
- Guardar a chave privada de backup (`age`) fora do computador e testar a leitura em outro aparelho.
- Confirmar na Vercel que `AUTH_SESSION_SECRET` e `CRON_SECRET` estão definidos em produção.
- Decidir: leitura de fatura por IA externa ou só no aparelho (item 1).

## 5. Nunca verificado / riscos conhecidos
- iPhone/Safari reais (campo de data, instalação do PWA), Face ID real, envio real de e-mail (SMTP).
- Execução **automática** (agendada) do backup cifrado no GitHub e do cron `/api/readiness` na Vercel; só execuções manuais comprovadas (o `SELECT 1` diário do GitHub foi comprovado em 2026-11-07).
- Restauração completa pela interface contra um Neon de teste; isolamento entre dois usuários com RLS real em produção.
- Backup do Neon: plano Free tem janela de 6 h; exportação JSON do app não cobre convites familiares.
- Recursos de câmbio ao vivo (Gemini) estão desligados na Vercel se `GEMINI_API_KEY` não estiver configurada.

## 6. Decisões vigentes (resumo; lista completa em `MASTER_BLUEPRINT.md`)
- Dinheiro de terceiros (a receber, acompanhante de viagem) **fora** do resultado pessoal; patrimônio **inclui** o a receber.
- Gasto de cartão conta no mês da compra; caixa no mês do pagamento da fatura.
- Compra no cartão: nada pré-selecionado (forma, categoria, conta); com uma só opção ela já vem marcada.
- Dia de fechamento: padrão "compra no dia do fechamento fica na fatura atual"; opção por cartão para ir à próxima.
- Sincronização silenciosa; primeiro a gravar vence; Neon é a única fonte de verdade.

## 7. Registro de entregas (mais recente primeiro)

### 2026-11-15 — Dado lançado no Neon: 110 compartilhados enviados para a conta da Fran
- **O que mudou:** gravados direto em `finance_shared_transactions` os **110 espelhos** dos compartilhados do dono com a FRAN (remetente = conta do dono, destinatária = conta da Fran, convite aceito). Cada espelho foi montado no mesmo formato que `PUT /api/family/shared` grava (`tx-mirror-*`, quem pagou invertido, `sharedMemberId` = `fam-inv-wesley_diaslima_gmail_com`, cota arredondada em centavos).
- **Por quê:** depois de publicada a correção (#46), a Fran ainda não via nada: o envio depende de o app do dono abrir na versão nova, e o app instalado não tinha atualizado. O dono escolheu gravar direto no banco.
- **Arquivos/áreas:** apenas dados no Neon (`finance_shared_transactions`); nenhum código.
- **Como foi verificado:** antes: 0 linhas; os 110 lançamentos de origem conferidos (valores e cotas numéricos, nenhuma cota maior que o valor, ids únicos); prévia do formato com amostras. Depois: 110 linhas, remetente e destinatária iguais aos do convite, 0 ocultas, parte da Fran somando R$ 8.509,22 (competências 2026-12 a 2027-11). A gravação tinha trava de convite aceito e `ON CONFLICT DO NOTHING`.
- **Não verificado:** a tela da Fran com os lançamentos (não tenho acesso ao navegador dela); como o app dela trata os 109 itens "pago por outra pessoa" no cartão do dono.
- **Impacto em dados/Neon:** escrita direta. **Para reverter:** apagar de `finance_shared_transactions` as linhas com remetente = conta do dono e destinatária = conta da Fran. Quando o app do dono abrir na versão nova, ele verá os 110 como já enviados e não reenvia; edições futuras atualizam essas mesmas linhas.
- **Documentação atualizada:** não necessário: nenhuma regra mudou.
- **Próximo passo:** a Fran atualizar o app e conferir; o dono decidir se quer que o servidor envie sozinho no momento do aceite (sem depender do app de quem convidou).

### 2026-11-15 — Compartilhados lançados antes do aceite chegam à outra conta; dia do cartão por seletor
- **O que mudou:** (1) **Família:** o app passa a enviar sozinho, para a pessoa com convite aceito, os lançamentos compartilhados que ainda não estão no servidor. O servidor agora devolve em `GET /api/family/shared` a lista do que esta conta já enviou (`outgoingSharedIds`); ao abrir o app e na leitura de cada minuto, o app compara com os compartilhados locais (`findUnsentSharedTransactions`) e envia os que faltam em lotes de 40, uma vez por sessão (falha de rede tenta de novo na leitura seguinte). (2) **Cartões:** "Dia Fecha" e "Dia Vence" (cadastro nas duas telas e edição) viraram um seletor de 1 a 31 (`DayOfMonthSelect`), no lugar do campo numérico.
- **Por quê:** o dono convidou a Fran (francy.von@gmail.com); ela criou a conta, aceitou o convite e não viu nada. Leitura **somente** no Neon de produção: convite `accepted` às 21:24 de 2026-11-15; a conta do dono tem **110 compartilhados com a FRAN** (109 no cartão pagos por ele, 1 pago por ela); a tabela `finance_shared_transactions` tinha **0 linhas**. Causa: o envio só acontecia ao **salvar** um compartilhado; quando o convite é aceito, o app de quem convidou apenas marcava "aceito" e não enviava os que já existiam. No cartão: o campo numérico vazio virava 0 e, ao digitar, ficava "05".
- **Arquivos/áreas:** `backend/app.ts` (GET `/api/family/shared`), `src/lib/neonWorkspace.ts`, `src/domain/family/sharedFinanceRules.ts`, `src/App.tsx`, `src/components/cards/DayOfMonthSelect.tsx` (novo), `src/components/cards/CreditCardsTab.tsx`; testes `src/domain/family/sharedPendingSync.test.ts` (novo), `src/test-utils/appOrchestrationHarness.tsx` + `src/App.test.tsx`, `backend/familyApi.test.ts`, `src/components/cards/CreditCardsTab.test.ts`.
- **Como foi verificado:** teste do app inteiro com convite aceito e compartilhados antigos: **falha sem a correção** (0 envios) e passa com ela (envia só os que faltam, uma vez); servidor antigo sem a lista não dispara reenvio; testes do seletor (31 opções, criar com dia 5/12, editar para 3/31) falhavam antes e passam; `bun run check` (755 testes, build ok).
- **Não verificado:** o envio real em produção para a conta da Fran (depende de publicar e de o dono abrir o app); tempo do servidor para gravar 110 espelhos (o servidor grava um por um; por isso o envio vai em lotes de 40); seletor no iPhone/Safari real.
- **Impacto em dados/Neon:** nenhum esquema. Nenhuma escrita feita por mim (só leitura). Depois de publicado, o app do dono grava os espelhos em `finance_shared_transactions` pelo caminho normal da API. Não envia itens de **A Receber** (o R$ 905,68 da fatura do cartão adicional da FRAN continua só na conta do dono, como já era a regra).
- **Documentação atualizada:** `docs/produto/regras-de-negocio.md` (glossário do cartão e seção 8), `docs/tecnico/api.md` (2.2.2), `docs/produto/fluxos.md` (8), `CHECKLIST.md`.
- **Próximo passo:** publicar; o dono abre o app (conta dele) e a Fran atualiza o dela; conferir no Neon que `finance_shared_transactions` passou a ter 110 linhas para a Fran.

### 2026-11-15 — Editar lançamento permite mudar parcelas e repetição
- **O que mudou:** a edição de lançamento esconde a escolha de frequência e o número de parcelas, e o salvamento ignorava essa mudança. Agora a edição mostra os mesmos campos do lançamento original e, se mudar o tipo (à vista/fixo/parcelado) ou o número de parcelas, a série é refeita (`rebuildTransactionSeries`) com o total dividido de novo, na mesma posição. Recusa sem alterar nada se houver parcela paga, antecipada, dividida por pagamento parcial, vinda de extrato ou acerto compartilhado recebido.
- **Por quê:** pedido do dono: ao editar tem que poder alterar tudo como no lançamento original.
- **Arquivos/áreas:** `src/domain/finance/financeRules.ts`, `src/App.tsx`, `src/components/transactions/TransactionModal.tsx`, testes em `auditoria2026-11-15.test.ts` e `TransactionModal.test.tsx`.
- **Como foi verificado:** testes novos (3x→5x conserva o total, parcelado↔à vista, recusa com parcela paga, formulário de edição mostra parcelas e envia 5x); `bun run check`.
- **Também:** a troca de forma de pagamento (conta/débito ↔ cartão) agora aparece na edição de compra parcelada/série e refaz a série (antes só aparecia em lançamento único).
- **Não verificado:** tela no navegador/celular; efeito da série refeita com compartilhamento entre duas contas reais; mudar só o número de meses de lançamento **fixo** não refaz a série (ainda).
- **Impacto em dados/Neon:** nenhum esquema; a série refeita recebe IDs novos (as parcelas antigas somem e as novas entram).
- **Documentação atualizada:** `docs/produto/regras-de-negocio.md` (2.4b).
- **Próximo passo:** o dono testar editar uma compra parcelada no app; avaliar liberar também a mudança de meses em fixos.

### 2026-11-15 — Ordem cronológica em tudo e decisão do A08
- **O que mudou:** extrato da conta sempre cronológico (o seletor "Mais recentes primeiro" foi removido); lista de Lançamentos passou a ser cronológica (antes: mais nova primeiro); fatura do cartão já era. Decisão do dono: **A08 fica como está** (acerto compartilhado em outro mês acompanha o mês do acerto).
- **Por quê:** pedido do dono ("sempre ordem cronológica"; "deixe da maneira que está" no A08).
- **Arquivos/áreas:** `src/components/accounts/AccountsTab.tsx`, `src/components/transactions/TransactionsTab.tsx`.
- **Como foi verificado:** `tsc`, 736 testes e build. Nenhum teste dependia da ordem antiga.
- **Não verificado:** telas no navegador; a lista de Lançamentos agora abre no dia 1 (o mais novo fica no fim) — se incomodar, é uma linha para reverter.
- **Impacto em dados/Neon:** nenhum.
- **Documentação atualizada:** `docs/produto/regras-de-negocio.md` (3 e decisões), `CHECKLIST.md` (A08 fechado).
- **Próximo passo:** nenhum pendente desta rodada; restam os itens da seção D do CHECKLIST (A11, A14, A18–A19, A21–A24).

### 2026-11-15 — Comprometimento do cartão: chave "Geral / Só a minha parte"
- **O que mudou:** na tela Cartões → "Comprometimento do cartão mês a mês" entrou a chave **Geral (tudo do cartão)** × **Só a minha parte**. A visão "minha parte" soma suas compras e parcelas (nos compartilhados que você pagou, só a sua metade) mais o que você deve em despesas compartilhadas pagas por outra pessoa; A Receber (cartão da Fran) fica fora das duas. A porcentagem da renda e o limite valem para a visão escolhida; ao abrir o mês, a lista mostra cada item com o valor da sua parte.
- **Por quê:** pedido do dono: ver o geral e, separado, o valor que é dele por mês.
- **Arquivos/áreas:** `src/domain/cards/cardCommitment.ts` (`mine`, `getMyCardPurchaseAmount`, lista por visão), `src/components/cards/CardCommitmentSection.tsx`, testes em `cardCommitment.test.ts`, `CardCommitmentSection.test.tsx`, `appNotices.test.ts`.
- **Como foi verificado:** testes novos (compartilhado pela metade, A Receber fora, compartilhado que devo, chave na tela); `bun run check`.
- **Não verificado:** tela no navegador/celular; com dados reais (o A Receber da Fran e as parcelas de hoje entram corretamente por leitura, mas não abri a tela); compartilhado "pago por outra pessoa" só entra se estiver pendente e fora do cartão.
- **Impacto em dados/Neon:** nenhum.
- **Documentação atualizada:** `docs/produto/regras-de-negocio.md` (3.5).
- **Próximo passo:** o dono conferir os valores mês a mês em "Só a minha parte"; avaliar se os alertas de comprometimento (sino) também devem usar a visão da minha parte.

### 2026-11-15 — Dado lançado no Neon: DeepSeek no Nubank e diferença da FRAN em A Receber
- **O que mudou:** no workspace de produção (revisão 250 → 254): (1) lançado o **R$ 60,27 do DeepSeek** no Nubank (`tx-nubank-ofx-13`, competência 2026-12; compra internacional diferente do "Zafari" do azul) e os 3 lançamentos DeepSeek do Nubank passaram para a categoria **Assinaturas** (mesma de GPT e Claude); (2) **A Receber da FRAN**: valor de **R$ 905,68** (`rcv-azul-fran-2026-12`, fatura de cartão adicional do Itaú azul, dezembro de 2026) com a linha correspondente na fatura do azul (`tx-recv-rcv-azul-fran-2026-12`), que conta na fatura e no limite mas fica fora do resultado pessoal; (3) `Mp*hupicorrida` (azul) reclassificado para Compras (Mp = Mercado Pago = compra no Mercado Livre).
- **Por quê:** o dono respondeu que o R$ 60,27 é DeepSeek e mandou lançar a diferença da fatura do azul para a FRAN (cartão adicional dela).
- **Arquivos/áreas:** apenas dados no Neon (`transactionsJson`, `receivablesJson`); nenhum código.
- **Como foi verificado:** releitura: fatura do azul em dezembro = **R$ 5.213,16** (igual ao banco), dos quais R$ 4.307,48 são do dono e R$ 905,68 da FRAN; Nubank em dezembro R$ 617,26 (556,99 + 60,27); categoria do hupicorrida = Compras; 2 itens em A Receber (Muri e FRAN).
- **Não verificado:** a tela renderizada; o valor de R$ 905,68 é a **diferença** entre o total do banco e o que estava lançado (não uma lista de compras da FRAN), então pode incluir qualquer compra não lançada; vale conferir quando a fatura fechar.
- **Impacto em dados/Neon:** escrita direta. **Para reverter:** apagar `tx-nubank-ofx-13`; em Compras/Assinaturas basta editar a categoria; para a FRAN, apagar o item em A Receber (a linha do azul é apagada junto pelo app).
- **Documentação atualizada:** não necessário: nenhuma regra mudou.
- **Próximo passo:** o dono conferir as faturas no app; ainda em "Outros": CARDPAY e AIBR (Nubank).

### 2026-11-15 — Dado lançado no Neon: parcelas restantes do Itaú azul e do Nubank, mês a mês
- **O que mudou:** no workspace de produção (revisão 249 → 250, 144 → 281 lançamentos): (1) **Itaú azul**: as 24 compras parceladas do print da fatura de dezembro (R$ 5.213,16) foram lançadas com as **parcelas restantes mês a mês** (19 séries parceladas + 5 de parcela única restante), ids `tx-azul-ofx-*`, 124 linhas, total futuro **R$ 6.054,88**, dezembro R$ 1.328,46; (2) **Nubank**: as 4 compras parceladas do OFX que eu tinha lançado só na parcela atual (Dm *Tripcom, Fila, Pix no Crédito CARDPAY 11/12, Amazon BR V) foram **substituídas** por séries com as parcelas restantes (17 linhas); as de parcela final (6/6 e 8/8) continuam únicas. Nada do que o dono lançou foi alterado. Categorias classificadas pelo nome (Viagens, Compras, Vestuário, Educação, Seguros, Tarifas, Casa e decoração, Lazer); ficaram em "Outros" só as ambíguas: Mp*hupicorrida (azul), CARDPAY, AIBR e Deepseerwea (Nubank).
- **Por quê:** o dono mandou lançar as parcelas restantes mês a mês onde o banco mostra "parcela x de y" (as 24 são dele; a diferença para o total da fatura do azul pode ser o cartão adicional da esposa).
- **Arquivos/áreas:** apenas dados no Neon (`finance_workspaces.payload.transactionsJson`); nenhum código.
- **Como foi verificado:** releitura após gravar: azul em dezembro R$ 4.307,48 (era 2.979,02 + 1.328,46), total futuro R$ 6.054,88, Nubank em dezembro R$ 556,99 (inalterado), 0 categorias inválidas. A gravação foi uma instrução atômica sobre a linha atual (a primeira tentativa foi recusada pelo dono; a segunda não gravou nada por proteção de revisão; a terceira gravou).
- **Não verificado:** a tela renderizada; as 4 datas ilegíveis no print (Amazonmktplc*frige, Riachuelo 04/04, Mercadolivre 05/12, Dl *hoteis.com) usam o dia 1; a numeração das parcelas é renumerada de 1 a N restantes (a parcela real do banco está nas notas); o R$ 60,27 do Nubank (Deepseerwea) e a diferença do cartão adicional da esposa (≈ R$ 905,68 no azul) seguem sem lançamento.
- **Impacto em dados/Neon:** escrita direta no banco. **Para reverter:** apagar os lançamentos com id iniciando em `tx-azul-ofx-`; no Nubank, os ids `tx-nubank-ofx-08/10/11/12-*` substituem os antigos de mesmo número.
- **Documentação atualizada:** não necessário: nenhuma regra mudou.
- **Próximo passo:** o dono conferir fatura de dezembro/janeiro do azul e do Nubank no app e reclassificar as categorias em "Outros"; decidir o R$ 60,27 e o cartão adicional da esposa (A Receber).

### 2026-11-15 — Dado lançado no Neon: fatura do Nubank (OFX de 05/12/2026)
- **O que mudou:** no workspace de produção (revisão 247 → 248, 131+ → 144 lançamentos) foram **incluídos 12 lançamentos** no cartão **Nubank**, competência `2026-12`, status pendente, ids `tx-nubank-ofx-01` a `-12`, soma **R$ 503,09**. Nenhum lançamento existente foi alterado. Regra do dono: valor repetido = já lançado. **Não importados por repetição de valor:** Youtube R$ 53,90 (já no próprio Nubank), R$ 13,90 e R$ 60,27 (já existem no Itaú azul como "Jogo Yasmin" e "Zafari"). **Não importados por não serem compra:** "Pagamento recebido" R$ 728,30 (pagamento da fatura anterior) e os pares IOF cobrado + "IOF de volta" (R$ 2,10 e R$ 2,06), que se anulam.
- **Por quê:** o dono enviou o arquivo OFX da fatura do Nubank e pediu para considerar já lançado o que tivesse valor repetido.
- **Arquivos/áreas:** apenas dados no Neon (`finance_workspaces.payload.transactionsJson`); nenhum código.
- **Como foi verificado:** releitura após a gravação: 12 lançamentos no cartão certo, soma R$ 503,09, fatura do Nubank em dezembro R$ 556,99. O extrato do banco fecha em R$ 631,16 (saldo −631,17 no arquivo, 1 centavo de diferença do arquivo): a diferença para a fatura do app é R$ 74,17 = R$ 13,90 + R$ 60,27, exatamente os dois valores ignorados por repetição com o Itaú azul. A gravação foi uma única instrução atômica condicionada à revisão 247 e sem duplicar.
- **Não verificado:** a tela renderizada (o app precisa atualizar); se R$ 13,90 ("Google Avatar World") e R$ 60,27 ("Deepseerwea") são mesmo as mesmas compras do Itaú azul ou só valores iguais; as categorias (só IOF/tarifa, Amazon, seguro e 99Food foram classificadas; o resto ficou em "Outros"); parcelas futuras não foram criadas (as parcelas entraram como lançamento único com "(parcela x/y)" na descrição).
- **Impacto em dados/Neon:** escrita pontual direta no banco. **Para reverter:** apagar os lançamentos com id começando em `tx-nubank-ofx-` (ou editar pelo app, um a um).
- **Documentação atualizada:** `CHECKLIST.md` (formato real do OFX de fatura).
- **Próximo passo:** o dono conferir a fatura do Nubank de dezembro e reclassificar as categorias em "Outros"; confirmar os dois valores repetidos (R$ 13,90 e R$ 60,27); se forem compras diferentes, lançar no Nubank.

### 2026-11-15 — Confiabilidade: servidor mais rígido, coerência dos espelhos, câmbio e fixos
- **O que mudou:** (1) o servidor agora recusa gravar lançamento incompleto, apontando para conta/cartão inexistente ou com cota compartilhada maior que o valor (`validateWorkspaceConsistency`); (2) Lançamentos e Calendário passam a usar a mesma regra do resumo para espelhos compartilhados (o total da lista bate com o resumo); (3) apagar uma viagem não apaga mais o débito bancário das compras de câmbio (`releaseExchangeLotMovements`); (4) lançamento fixo: dá para mudar a quantidade de meses (acrescenta ou tira do fim, só pendentes) (`adjustFixedSeriesLength`); (5) rótulo das parcelas passou de "Nx sem juros no cartão" para "Nx no cartão" (o app não sabe se há juros).
- **Por quê:** pedido do dono: corrigir os riscos apontados e ter um sistema financeiro pessoal confiável.
- **Arquivos/áreas:** `src/services/workspace/workspacePayload.ts`, `backend/app.ts`, `src/domain/finance/financeRules.ts`, `src/App.tsx`, `src/components/transactions/TransactionsTab.tsx`, `src/components/transactions/TransactionModal.tsx`, `src/components/overview/MonthlyCalendarView.tsx`, testes (`auditoria2026-11-15.test.ts`, `workspacePayload.test.ts`, `familyApi.test.ts` com lançamento completo).
- **Como foi verificado:** `bun run check`; antes de endurecer o servidor, consulta **somente de leitura** ao Neon de produção (só contagens, nenhum valor): 131 lançamentos, todos completos, 0 contas/cartões/categorias órfãos, 0 cotas maiores que o valor.
- **Não verificado:** telas no navegador/celular; envio real de lançamento recusado pelo servidor em produção (coberto por teste de função e do app, não por requisição real); mudança de meses em fixo com compartilhamento entre duas contas reais. **IOF (A14) não foi alterado**: a fonte oficial (Decretos 12.466/12.499 de 2025) cita 3,5% no cartão, mas há trechos suspensos por decreto legislativo e notícia de restabelecimento pelo STF; falta confirmar a norma vigente.
- **Impacto em dados/Neon:** nenhum dado alterado (só leitura). Regra nova do servidor passa a valer na próxima gravação.
- **Documentação atualizada:** `docs/produto/regras-de-negocio.md` (2.4b, 10, 14), `CHECKLIST.md` (seção D).
- **Próximo passo:** o dono conferir as telas no celular; decidir A14 (IOF) após confirmar a cobrança real do banco; depois comando único de câmbio com duas pernas (resto do A19).

### 2026-11-15 — Seletor de parcelas mostra todos os números (2 a 48)
- **O que mudou:** o seletor de parcelas do cartão no formulário tinha lista fixa (2–10, 12, 15, 18, 24) e pulava o 11; agora oferece todos de 2 a 48, o limite que o app já aceitava ao gerar as parcelas.
- **Por quê:** pedido do dono (faltava o 11 e outros números).
- **Arquivos/áreas:** `src/components/transactions/TransactionModal.tsx`, teste em `TransactionModal.test.tsx`.
- **Como foi verificado:** teste novo confere as 47 opções (2..48, inclui 11); `bun run check`.
- **Não verificado:** tela no navegador/celular (lista maior no seletor nativo).
- **Impacto em dados/Neon:** nenhum.
- **Documentação atualizada:** `docs/produto/regras-de-negocio.md` (2.4).
- **Próximo passo:** nenhum.

### 2026-11-15 — Categorias agrupadas por tipo e fatura do cartão em ordem cronológica
- **O que mudou:** no formulário de lançamento, as categorias de despesa agora aparecem agrupadas por tipo (Essenciais, Estilo de vida e lazer, Objetivos e poupança), em ordem alfabética; a lista de compras da fatura do cartão passou a ser cronológica (mais antiga primeiro; antes era a mais nova primeiro).
- **Por quê:** pedido do dono.
- **Arquivos/áreas:** `src/components/transactions/TransactionModal.tsx`, `src/domain/finance/financeRules.ts` (`calculateCreditCardSummary`), testes em `TransactionModal.test.tsx` e `auditoria2026-11-15.test.ts`.
- **Como foi verificado:** `tsc`, testes (735) e build; teste novo confere grupos/ordem das categorias e a ordem das compras da fatura.
- **Não verificado:** telas no navegador; "lançamentos no cartão conta" foi entendido como a lista da fatura do cartão (o extrato da conta já tem seletor de ordem próprio).
- **Impacto em dados/Neon:** nenhum.
- **Documentação atualizada:** `docs/produto/regras-de-negocio.md` (2.3b e 3).
- **Próximo passo:** o dono conferir se a ordem desejada também vale para o extrato da conta e para outras listas.

### 2026-11-15 — Correções da auditoria financeira (achados confirmados)
- **O que mudou:** de 24 achados de uma auditoria externa, reproduzi cada um neste código antes de mexer. **Corrigidos (reais):** A02 estorno de pagamento parcial reabria também o valor pago por outro pagamento (dívida 100 em vez de 40); A04 desconto de antecipação perdia centavos e podia gerar data inexistente (2027-02-31); A05 antecipação já paga podia ser desfeita; A06 parcelar/pagar parcial compra de viagem repetia moeda estrangeira e cotas em cada linha (agora rateia e recompõe); A07 fluxo diário esquecia pendências bancárias de meses anteriores (e o `cashForecast` foi ajustado para não contar em dobro); A09 espelho de despesa compartilhada recebida ficava fora do consumo e da projeção (agora conta a minha cota); A10 `FITID` valia entre contas diferentes; A12 botão de status/lote ainda mexia em aporte de investimento e lote de câmbio; A15 rateio de viagem ignorava moedas sem centavos (JPY/CLP); A17 relatório "Anual" ia de junho a dezembro e o botão dizia sempre "2026"; A20 acerto de viagem agora guarda o vínculo com o movimento (apagar o movimento reabre o acerto) e reembolso usa "Reembolsos" em vez de "Rendimentos". **Já estavam corretos neste código (auditoria desatualizada ou imprecisa):** A01 (baixa direta de compra de cartão já bloqueada), A03 (edição/exclusão de compra quitada já bloqueada), A13 (aporte já exige quantidade exata), A12 em edição/exclusão/duplicação, A10 `csv-row-N`, A20 data em UTC (já usa data local). **Decidido pelo dono depois:** A16 — a dívida da viagem é na moeda da viagem (saldo estrangeiro zero não gera cobrança; diferença em reais é variação cambial), e o formulário já troca sozinho para a moeda/símbolo da viagem (teste novo). **Não corrigidos:** A19, A11, A14, A18, A21–A24 (decisão sua ou mudança de modelo; ver `CHECKLIST.md`, seção D).
- **Por quê:** o dono pediu que eu verificasse o relatório do ChatGPT e corrigisse o que estivesse certo. O relatório foi escrito sobre outro commit (`45c8b56`, inexistente neste clone) e caminhos antigos (`src/utils`); por isso cada achado foi reproduzido aqui em vez de aceito.
- **Arquivos/áreas:** `src/domain/finance/financeRules.ts`, `src/domain/budgets/uxEnhancementRules.ts`, `src/domain/budgets/cashForecast.ts`, `src/domain/trips/travelRules.ts`, `src/services/import-export/ofxParser.ts`, `src/components/reports/ReportsAndDataTab.tsx`, `src/components/transactions/TransactionModal.tsx`, `src/App.tsx`; testes novos em `src/domain/finance/auditoria2026-11-15.test.ts` e teste antigo do relatório anual corrigido (fixava "7 meses, junho a dezembro").
- **Como foi verificado:** cada correção nasceu de um teste que falhava antes; `tsc` limpo, 731 testes passando, build PWA ok. Não rodei contra o Neon real nem abri as telas no navegador.
- **Não verificado:** telas renderizadas com dados reais; o efeito sobre os dados de produção (nenhuma gravação foi feita). Os números da auditoria (18 verificações, Neon QA) não foram conferidos por mim, pois o script e o banco QA citados não estão neste clone.
- **Impacto em dados/Neon:** nenhum esquema novo; nenhum dado alterado. Comportamento muda para novos lançamentos e para os cálculos exibidos (fluxo diário, relatório anual, resultado com espelhos compartilhados).
- **Documentação atualizada:** `docs/produto/regras-de-negocio.md` (seções 2.4, 2.6, 3.3, 3.4, 5.2, 5.5, 8–12), `CHECKLIST.md` (seção D).
- **Próximo passo:**  depois comando único de câmbio (A19) e validação estrita no servidor após leitura dos dados reais (A11).

### 2026-11-15 — Auditoria do backend e paridade frontend × backend
- **O que mudou:** (1) `trust proxy` na Vercel: os limites de tentativa passam a usar o IP real do cliente (antes todos compartilhavam o IP do proxy: 10 cadastros/h e 20 tentativas de Face ID para todo mundo junto); (2) o pool do Neon agora trata erro de conexão ociosa (sem isso o autosuspend podia derrubar a função com erro 500) e descarta conexão quebrada após falha no `ROLLBACK`; (3) respostas de erro sempre em JSON (JSON malformado 400, corpo grande 413, erro inesperado 500 genérico); (4) câmbio ao vivo sem `GEMINI_API_KEY` responde 503 com mensagem amigável (antes 500 com texto "Verifique o painel Settings > Secrets"); (5) `/api/readiness` compara o segredo em tempo constante; (6) detalhes técnicos do Face ID não saem mais em falhas de banco; (7) `receivablesJson` passou a ser validado no servidor (tipo, centavos, datas, pagamentos ≤ valor).
- **Por quê:** meta do dono: conferir se tudo que o frontend usa existe no backend e revisar o backend inteiro.
- **Arquivos/áreas:** `backend/app.ts`, `backend/passkeys.ts`, `src/services/workspace/workspacePayload.ts`, testes em `backend/healthApi.test.ts`, `backend/familyApi.test.ts`, `src/domain/receivables/receivables.test.ts`, docs `docs/tecnico/api.md` e `seguranca.md`.
- **Como foi verificado:** paridade conferida por leitura: as 22 chamadas do frontend têm rota no backend (mesmo método e formato de resposta), `api/` cobre todos os caminhos, e todas as colunas e privilégios usados pelo backend existem no Neon real (tabelas, colunas e grants consultados por leitura). 719 testes, `tsc` e build passando; o valor a receber real do dono ("Muri") passa na validação nova. **CI do GitHub no commit `66b581c` (rodada 350): os dois jobs passaram.** O job de PostgreSQL 17 real executou as 10 migrações em banco vazio e os 7 cenários com a role de runtime real: cadastro de 3 identidades, isolamento por RLS, acerto de compartilhado com `ON CONFLICT`, recibo persistido, gravações concorrentes recusando revisão antiga e revogação de vínculo; o job de tipos/testes/build também passou e a verificação do HANDOFF rodou no CI.
- **Não verificado:** o deploy em produção (o ambiente desta sessão não alcança o site nem o painel da Vercel): limites por IP real e pool do Neon só serão provados com o app em uso; o modelo `gemini-3.8-flash` e a rota de câmbio nunca foram exercitados contra o Gemini real (a chave não está na Vercel).
- **Impacto em dados/Neon:** nenhum (só leitura de esquema e privilégios).
- **Documentação atualizada:** `docs/tecnico/api.md`, `docs/tecnico/seguranca.md`.
- **Próximo passo:** conferir `/api/readiness` e o app após o deploy; decidir se limites de tentativa precisam ser globais (Redis/tabela) e se vale configurar `GEMINI_API_KEY`.

### 2026-11-15 — Dado corrigido no Neon: compras de 30/10 do Itaú azul foram para a fatura de dezembro
- **O que mudou:** no workspace de produção (revisão 241 → 242) o cartão **Itaú azul** recebeu `closingDayStartsNextInvoice: true` e duas compras pendentes de 30/10 mudaram de competência `2026-11` para `2026-12`: **Nona R$ 57,00** (`tx-1794740662190-1-4onn`) e **Amazon R$ 41,29** (`tx-1794740623488-1-qwnn`), total R$ 98,29. Nenhuma outra linha foi tocada (119 lançamentos no total, antes e depois).
- **Por quê:** o dono viu os R$ 98,29 ainda em novembro (Cartões e notificações de fatura atrasada) e pediu a correção; no banco dele a compra no dia do fechamento vai para a fatura seguinte (05/12).
- **Arquivos/áreas:** apenas dados no Neon (`finance_workspaces.payload`: `cardsJson` e `transactionsJson`); nenhuma mudança de código.
- **Como foi verificado:** consulta de leitura depois da alteração: flag `true`, as duas compras com competência `2026-12`, 0 compras pendentes do Itaú azul em `2026-11`. Telas e notificações calculam pela competência, então acompanham o dado; não reabri as telas após a alteração.
- **Não verificado:** a tela renderizada com o dado novo (o app instalado precisa atualizar/recarregar para buscar a revisão 242). Snapshot do Neon não foi criado: o plano atingiu o limite de snapshots; o Neon mantém só 6 h de histórico.
- **Impacto em dados/Neon:** escrita pontual feita direto no banco, só se a revisão ainda fosse 241. **Para reverter:** tirar a opção do Itaú azul em Cartões → Editar Cartão (as compras de 30/10 pendentes voltam para novembro pela reclassificação do app) ou restaurar `competenceMonth` `2026-11` nas duas compras.
- **Documentação atualizada:** não necessário: nenhuma regra mudou; seções 3 e 4 do HANDOFF ajustadas.
- **Próximo passo:** o dono abrir o app (ou "Buscar atualização agora") e conferir Cartões (novembro sem os R$ 98,29, dezembro com eles) e o sino sem "Atrasado há Nd" desse cartão.

### 2026-11-15 — Handoff obrigatório para qualquer IA (instruções e ganchos)
- **O que mudou:** criados `AGENTS.md` (instruções universais) e `CLAUDE.md` (importa o AGENTS); gancho de parada do Claude Code em `.claude/settings.json`; gancho Git `.githooks/pre-push` ativado por `bun install` (script `prepare`); `check-handoff` ganhou `--uncommitted`.
- **Por quê:** o CI só barrava depois do push e nenhum arquivo dizia a uma IA nova para ler os docs e atualizar o HANDOFF. Agora a obrigação aparece em quatro pontos: instruções lidas ao abrir o projeto, gancho ao encerrar, gancho ao enviar e CI.
- **Arquivos/áreas:** `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, `.githooks/pre-push`, `scripts/check-handoff.ts`, `package.json`, `docs/processo/handoff-e-checklist.md`, `docs/README.md`, `README.md`.
- **Como foi verificado:** o verificador barrou uma alteração de código sem HANDOFF (código de saída 1) e o gancho `pre-push` barrou meu próprio push nessa situação; passa com a entrada; testes e build rodados.
- **Não verificado:** o gancho de parada em uma sessão nova do Claude Code e o `pre-push` em outro computador (dependem do `bun install` ali); IAs que ignoram `AGENTS.md` só são barradas pelo CI, depois do push.
- **Impacto em dados/Neon:** nenhum.
- **Documentação atualizada:** `docs/processo/handoff-e-checklist.md`, `docs/README.md`, `README.md`.
- **Próximo passo:** acompanhar se as próximas entregas chegam com HANDOFF; considerar proteger a branch `main` exigindo o CI.

### 2026-11-15 — Correção urgente: API com erro 500 depois da reorganização
- **O que mudou:** dois imports sem extensão no caminho do backend voltaram a ter `.ts` (`financeRules.ts` → `formatting.ts`; `travelRules.ts` → `financeRules.ts`). Novo teste `backend/runtimeImports.test.ts` falha se qualquer import relativo executado pela API ficar sem extensão.
- **Por quê:** em produção `/api/auth/me`, `/api/workspace`, `/api/family/*` respondiam 500 e o app dizia que não conectava ao banco. O Neon estava saudável (1 usuário, 1 workspace, dados intactos); a causa foi a função da Vercel não carregar módulos importados sem extensão, introduzidos por mim ao reorganizar as pastas e extrair `formatting.ts`. (O mesmo tipo de falha já tinha ocorrido em 2026-11-11.)
- **Arquivos/áreas:** `src/domain/finance/financeRules.ts`, `src/domain/trips/travelRules.ts`, `backend/runtimeImports.test.ts`.
- **Como foi verificado:** `tsc`, suíte de testes e build; o novo teste falha quando o import sem extensão é reposto e passa com a correção. Causa inferida pelo código e pelo histórico: os logs da Vercel não estavam acessíveis a esta sessão.
- **Não verificado:** a correção em produção (depende do deploy da Vercel; conferir `/api/status` e o login no app).
- **Impacto em dados/Neon:** nenhum; dados conferidos por consulta de leitura.
- **Documentação atualizada:** `docs/processo/guia-de-contribuicao.md` (regra de imports do backend).
- **Próximo passo:** conferir o app após o deploy e, se o erro persistir, ler os logs da função na Vercel.

### 2026-11-15 — Reorganização do código e documentação completa
- **O que mudou:** `src/components/` em pastas por área; `src/utils/` dividido em `src/domain/` (regras) e `src/services/` (dados); correção de dependências invertidas (`categoryMatching` saiu de `ofxParser`; `WorkspaceConflictState` foi para `services`); formatação de dinheiro e datas extraída de `financeRules.ts` para `domain/finance/formatting.ts` (reexportada, imports antigos continuam valendo); limpeza (hooks sem uso, `metadata.json`, `sync-github.sh`, dependências `motion`/`autoprefixer`/`esbuild`, pacote renomeado para `minhas-economias`); `docs/` refeita (produto, técnico, operação, processo, arquivo); HANDOFF e CHECKLIST reestruturados com verificação obrigatória em CI (`scripts/check-handoff.ts`).
- **Por quê:** pedido do dono para organizar como um programador sênior, limpar e ter documentação completa e handoff obrigatório.
- **Arquivos/áreas:** todo `src/` (movimentos, sem mudança de comportamento), `docs/`, `README.md`, `MASTER_BLUEPRINT.md`, `scripts/`, `.github/workflows/ci.yml`, `package.json`.
- **Como foi verificado:** `tsc`, 713 testes (6 novos da verificação do HANDOFF) e build PWA antes e depois dos movimentos.
- **Não verificado:** nada de comportamento mudou; telas não foram reabertas no navegador após os movimentos de pasta além do build.
- **Impacto em dados/Neon:** nenhum.
- **Documentação atualizada:** sim — `docs/` inteira, `README.md`, `MASTER_BLUEPRINT.md`.
- **Próximo passo:** ver seção 3.

### 2026-11-15 — Cartão: fechamento por cartão e correção da fatura de 30/10
- **O que mudou:** opção por cartão "compra no próprio dia do fechamento vai para a próxima fatura" (`closingDayStartsNextInvoice`); ao mudar fechamento ou opção, compras **pendentes** feitas no dia do fechamento são reclassificadas (`reclassifyClosingDayPurchases`), sem tocar em pagas, parceladas, pagamentos de fatura, itens a receber e ajustes manuais. Bloco "A receber" removido da Visão Geral a pedido do dono.
- **Por quê:** Itaú azul (fecha 30, vence 5) tinha duas compras de 30/10 (R$ 98,29) na fatura vencida em 05/11, aparecendo como "Atrasado há 10d"; no banco do dono elas vão para dezembro.
- **Arquivos/áreas:** `src/domain/finance/financeRules.ts`, `src/domain/cards/cardIntelligence.ts`, `src/components/cards/CreditCardsTab.tsx`, `src/App.tsx`.
- **Como foi verificado:** testes automáticos novos e navegador de teste (editar cartão, marcar opção, salvar, compra reclassificada).
- **Não verificado:** os dados reais do Neon **não foram alterados** (apenas lidos para achar a causa); o dono precisa marcar a opção no cartão.
- **Impacto em dados/Neon:** campo opcional novo em `cardsJson`; sem migração SQL.
- **Documentação atualizada:** `docs/produto/regras-de-negocio.md` (seção 3).
- **Próximo passo:** dono marcar a opção no Itaú azul.

### 2026-11-14 — A Receber (fatura de cartão adicional e dívidas) e patrimônio
- **O que mudou:** nova tela **A Receber**: fatura de cartão adicional cobrada por inteiro e empréstimos, com **recebimentos parciais**, desfazer e apagar; pessoa sugerida do Compartilhamento; mês da fatura limitado ao mês atual até o último lançamento do cartão; valor do recebimento começa vazio (atalho "Receber tudo"). Esses movimentos ficam **fora** de despesas, receitas, categorias, 50/30/20 e DRE, mas contam em saldo, fatura e limite. O patrimônio e o score somam o a receber em aberto.
- **Por quê:** esposa usa cartão adicional (cobrança do valor cheio) e a irmã deve um valor sem prazo, sem poluir o resultado pessoal.
- **Arquivos/áreas:** `src/domain/receivables/`, `src/components/receivables/ReceivablesTab.tsx`, `src/domain/finance/financeRules.ts` (`isOutsidePersonalResult`, `calculateNetWorth`), `src/App.tsx`, `backend/app.ts` (valida `receivablesJson`).
- **Como foi verificado:** testes automáticos e navegador de teste a 390 px (criar, receber parcial, desfazer, apagar, recarregar, sem estouro lateral).
- **Não verificado:** iPhone/Safari reais.
- **Impacto em dados/Neon:** campo opcional `receivablesJson` no workspace; sem migração SQL.
- **Documentação atualizada:** `docs/produto/regras-de-negocio.md` (seção 7).
- **Próximo passo:** conferir em uso real.

### 2026-11-14 — Rodada de correções de usabilidade e auditoria
- **O que mudou:** forma de pagamento, categoria e conta obrigatórias (nada pré-selecionado); divisão automática por categoria; campo de valor com máscara de centavos; abertura do formulário e do app mais rápida; atualização silenciosa; ajustes de celular (ícones lado a lado, data sem vazar); auditoria independente (sessão caída volta ao login, limite de gravação 4 MB, limpeza ao sair); simulador de renda fixa com IR por dias reais.
- **Por quê:** feedback do dono de uso diário (erros de débito/crédito, comportamento ao digitar, lentidão, aparência no celular).
- **Como foi verificado:** testes automáticos, navegador de teste e roteiros E2E.
- **Não verificado:** iPhone/Safari reais.
- **Impacto em dados/Neon:** nenhum esquema novo.
- **Documentação atualizada:** parcialmente na época; consolidada em 2026-11-15.

### 2026-11-13 — Sincronização em tempo real e correções financeiras
- **O que mudou:** sincronização silenciosa (primeiro a gravar vence, consulta leve da revisão a cada 4 s, atualização no lugar); sem categoria padrão em lançamento novo; Face ID só em celular/tablet; auditorias de importação CSV, compartilhados, mês da fatura em edição de compra.
- **Como foi verificado:** testes automáticos.
- **Impacto em dados/Neon:** nenhum.

> Entregas anteriores a 2026-11-13: [docs/arquivo/handoff/historico-ate-2026-11-15.md](./docs/arquivo/handoff/historico-ate-2026-11-15.md).

---

### Modelo de nova entrada (copie e preencha; todos os campos são obrigatórios)

```markdown
### AAAA-MM-DD — Título curto da entrega
- **O que mudou:**
- **Por quê:**
- **Arquivos/áreas:**
- **Como foi verificado:** (tsc / testes / build / navegador de teste)
- **Não verificado:**
- **Impacto em dados/Neon:** (nenhum, ou o que muda e se exige migração)
- **Documentação atualizada:** (arquivos de docs/ alterados, ou "não necessário: motivo")
- **Próximo passo:**
```
