# Checklist — Minhas Economias

## Auditoria da lógica financeira — 2026-11-11
- [x] Corrigir data inicial de lançamento para hoje no calendário local, preservando data explícita.
- [x] Inferir competência de cartão pelo fechamento e vencimento; aplicar também quando data/cartão de compra existente é editado.
- [x] Separar mês da fatura e mês do débito bancário ao quitar fatura; fluxo de caixa usa data real e o histórico fica ligado à fatura quitada.
- [x] Permitir selecionar a fatura que será paga, sugerir o saldo pendente como valor e impedir edição genérica da liquidação automática.
- [x] Persistir o valor original da compra parcelada, exibi-lo junto às parcelas e permitir redistribuir valores futuros sem alterar parcelas pagas.
- [x] Ao editar uma série fixa em cascata, reposicionar datas futuras junto à nova data/competência inicial.
- [x] Unificar compra por conta e por cartão dentro da aba Despesa; manter campos de cartão condicionais e chamar as demais operações de Movimentações.
- [x] Interpretar dígitos monetários não separados como centavos; preservar formatos explícitos colados e rejeitar texto/precisão inválida.
- [x] Classificar descrições conhecidas por categoria/subcategoria e permitir criar subcategoria no próprio formulário sem persistir durante digitação/cancelamento.
- [x] Exigir correspondência de palavra/frase completa em regras de comerciante para evitar categoria errada por trecho incidental (ex.: “bar” em “BARCLAYS”).
- [x] Ocultar status normal de sincronização da navegação e manter falha visível com acesso à nuvem; conservar fila e repetição automática existentes.
- [x] Registrar auditoria, prioridade, riscos e situação em `docs/AUDITORIA_LOGICA_FINANCEIRA.md`.
- [x] Validar suíte completa após regra de comerciante (391/391, 56 arquivos), `bun run lint`, `bun run build` (87 entradas PWA) e `git diff --check`.
- [x] Reforçar a serialização local/Neon para compra parcelada e quitação de fatura; validar junto aos fluxos financeiros relacionados (50 testes direcionados aprovados).
- [x] Impedir exclusão de cartão com compras ou pagamentos de fatura no histórico; revalidar suíte completa (395/395, 57 arquivos), lint, build e diff-check.
- [x] Preservar saldo inicial e histórico ao consolidar uma conta; bloquear exclusão sem conta de destino compatível ou da última conta com lançamentos/saldo; revalidar a suíte completa, lint, build e diff-check.
- [x] Bloquear exclusão de categoria/subcategoria quando houver transações vinculadas, sem reclassificar ou apagar a classificação histórica; validar a suíte completa, lint, build e diff-check.
- [x] Implementar CSV de revisão histórica e preenchimento confirmado apenas de totais parcelados de alta confiança, com backup JSON antes e undo; manter competência e séries ambíguas para revisão.
- [x] Revalidar a etapa financeira completa após incluir relatório/aplicação histórica: `bun test` (406 testes, 58 arquivos), lint, build PWA (87 entradas) e `git diff --check` aprovados.
- [x] Corrigir o resumo diário do calendário para não somar compras e fatura como consumo duplicado; preservar a fatura separada e o pagamento na data real; validar a suíte completa (407 testes, 58 arquivos), lint, build e diff-check.
- [x] Ajustar vencimentos configurados em dias 29–31 para o último dia do mês em calendário e lembretes; revalidar a suíte completa (409 testes, 58 arquivos), lint, build PWA (87 entradas) e diff-check.
- [x] Reconhecer pagamentos de fatura na conciliação OFX/CSV, permitir conferir cartão/competência e aplicar baixa em cascata preservando FITID/data; validar suíte completa (412 testes, 58 arquivos), lint, build PWA (87 entradas) e diff-check.
- [x] Evitar importar duas vezes uma linha repetida com o mesmo FITID dentro do próprio arquivo; marcar ocorrências seguintes como duplicadas e preservar linhas distintas sem FITID; validar suíte completa (413 testes, 58 arquivos), lint, build PWA (87 entradas) e diff-check.
- [x] Incluir pendências vencidas na projeção até sua quitação, mantendo os totais mensais limitados à competência escolhida; validar suíte completa (414 testes, 58 arquivos), lint, build PWA (87 entradas) e diff-check.
- [x] Corrigir a lista de contas a pagar/receber: trazer atrasados para o mês atual, excluir transferências e compras de cartão, e sinalizar vencidas; validar suíte completa (415 testes, 58 arquivos), lint, build PWA (87 entradas) e diff-check.
- [x] Descontar na projeção as faturas de cartão pendentes vencidas/até o mês escolhido e manter parcelas de meses futuros fora do caixa previsto; validar suíte completa (416 testes, 58 arquivos), lint, build PWA (87 entradas) e diff-check.
- [x] Rejeitar casas decimais acima da precisão da moeda em despesas internacionais, saldo de conta global e orçamento da viagem; preservar precisão de até oito casas em taxas de câmbio e validar IOF; validar suíte completa (421 testes, 58 arquivos), lint, build PWA (87 entradas) e diff-check.
- [x] Validar overflow em conversões de moeda estrangeira e impedir que despesas/lotes gravem conversões fora da faixa segura; validar suíte completa (422 testes, 58 arquivos), lint, build PWA (87 entradas) e diff-check.
- [ ] Validar visualmente o fluxo em navegador autenticado com dados sintéticos e confirmar readback no workspace Neon QA.
- [x] Documentar critérios para prévia/revisão e migração reversível dos históricos, sem executar nem aplicar alterações em lote.

## Redesign visual global — 2026-11-11
- [x] Conferir sincronização Git antes do trabalho: branch de feature sincronizada com o upstream; `origin/main` contém a branch local no histórico, dois commits adiante.
- [x] Iniciar tokens compartilhados de cor, superfície e raio; aplicar canvas, campos, foco e transições globais em `src/index.css`.
- [x] Padronizar campos e estados de foco, botões primários, superfícies dos cartões de todos os módulos e cantos dos diálogos com CSS compartilhado.
- [x] Aplicar identidade azul ao cabeçalho, navegação desktop/mobile, CTA, tela de login e estados ativos principais; manter dados e handlers.
- [x] Criar marca visual original compartilhada; exibir Visa/Mastercard/Elo nos cartões cadastrados com contraste no tema escuro e nome acessível.
- [x] Validar TypeScript (`bun run lint`), build PWA (`bun run build`) e whitespace (`git diff --check`). Nenhum teste foi executado.
- [x] Compor a Visão Geral em telas largas: saldo previsto em destaque, contas pendentes na lateral e contas/cartões/orçamento na linha seguinte; sem duplicar dados ou alterar ações (CSS a partir de 1366px).
- [x] Alinhar o ícone SVG do PWA à nova marca azul e atualizar a cor de tema do navegador.
- [x] Regenerar os ícones PNG PWA/Apple touch e conferir dimensões (180×180, 192×192 e 512×512); inspecionar visualmente o ícone 512×512.
- [x] Revisar visualmente login em desktop e 390×844 na versão anterior do painel escuro; registro histórico mantido.
- [x] Renderizar login e cadastro após a alteração para painel claro/azul em 1440×900 e 390×844; selecionar cada modo e conferir os campos/CTAs sem enviar formulário.
- [x] Restringir estilos globais aos inputs editáveis e não sobrescrever inputs de arquivo/faixa/submit nem classes de botões secundários translúcidos; build, lint e diff-check passam.
- [x] Preservar indicação visível de foco por teclado, cursor de controles desabilitados e movimento reduzido nas transições/animações globais.
- [x] Alinhar manifesto PWA ao tema: azul de navegador, canvas claro da tela inicial e metadado `pt-BR`.
- [x] Padronizar no azul as ações e estados ativos de colagem/importação OFX/CSV; deixar o input nativo oculto e intocado, sem alterar parsing nem handlers.
- [x] Unificar botões sólidos de ação de destaque verde/índigo/violeta/azul-celeste no azul principal, mantendo as cores de status em tags e painéis não interativos.
- [x] Expor estado atual da navegação móvel e do drawer “Mais”, e modo selecionado de login/cadastro para tecnologias assistivas, sem alterar handlers; lint, build e diff-check passaram.
- [x] Aplicar a cor de ação compartilhada a checkbox/radio, além dos campos textuais e range, sem alterar valores ou handlers.
- [x] Remover o foco verde residual de campos no tema escuro e alinhar superfície/borda/texto aos tokens compartilhados.
- [x] Exibir preview de cartão na listagem usando cor/nome salvos e marca Visa/Mastercard/Elo, sem alteração de fluxo ou dados.
- [x] Permitir personalizar a cor do cartão ao criar/editar, persistindo pelo campo `CreditCard.color` já existente.
- [x] Exibir logotipos de instituições nas seleções de conta dos formulários de cartões, aporte em metas, operações de investimento, importação CSV, conciliação, rateio, viagem e transação; manter o mesmo `<select>` e seus handlers.
- [x] Validar TypeScript (`bun run lint`), build PWA (`bun run build`, 86 itens em precache) e whitespace (`git diff --check`) após a cobertura adicional de formulários; nenhum teste executado.
- [x] Aplicar o padrão de página também à subpágina de extrato/detalhe da conta, que antes não tinha a classe `module-page`.
- [x] Harmonizar links de ação ainda verdes/índigo/violeta com o azul do app sem alterar links neutros nem cores de dados financeiros semânticos; manter seleção por cor de membros intacta.
- [x] Revalidar TypeScript, build PWA (86 itens em precache) e diff-check após os estilos globais; nenhum teste executado.
- [x] Mostrar marca da instituição ou bandeira do cartão nas origens de lançamentos exibidas na busca global e no filtro do extrato.
- [x] Mostrar a instituição nas contas destino de transferência e origem internacional em viagem, sem alterar valores, regras ou handlers existentes.
- [x] Validar TypeScript, build PWA (87 itens em precache) e diff-check; nenhum teste executado.
- [x] Inventariar cobertura estática: os módulos raiz estão sob `module-page`/`overview-dashboard`; modais usam o escopo compartilhado de diálogo.
- [x] Cobrir com `modal-shell` todos os papéis de diálogo/alertdialog em componentes de produção e alinhar a superfície escura ao tema compartilhado.
- [x] Uniformizar os estados selecionados dos controles ARIA e acento de checkbox/radio/range em azul, preservando os estados semânticos financeiros.
- [x] Incluir mini preview da bandeira e cor do cartão também na Visão Geral, mantendo status de fatura semânticos.
- [x] Alinhar estados selecionados de troca de cartão/grupo de parcelas/viagem ao azul e expor `aria-pressed` nos controles.
- [x] Aumentar contraste dos previews de cartão para cores claras, preservando fallback para cores antigas inválidas.
- [x] Alinhar também ações em botões de texto/contorno verdes, índigo, violetas e celestes ao azul global, mantendo semântica fora dos botões.
- [x] Aplicar as cores de ação azuis aos cartões/linhas clicáveis com `role="button"` e às legendas de hover associadas.
- [x] Uniformizar em azul os ícones dos módulos no drawer móvel, preservando indicadores semânticos de sincronização.
- [x] Exibir monogramas da instituição nas listas de contas e na Visão Geral, aproveitando instituição/nome/cor já cadastrados.
- [x] Reutilizar a marca da instituição também nas linhas de investimentos desktop/mobile, com variante pequena e fallback para instituições não mapeadas.
- [x] Mostrar preview da logo/monograma ao digitar a instituição no formulário de conta, sem alterar o dado persistido nem o fluxo de edição.
- [x] Mostrar preview da logo/monograma ao digitar a corretora no formulário de investimento, preservando instituições digitadas livremente.
- [x] Exibir a face visual do cartão escolhido nos formulários de compra no crédito, quitação de fatura e lançamento de gasto internacional, mantendo os mesmos `<select>` e handlers.
- [x] Exibir a instituição da conta selecionada nos formulários de conciliação OFX/CSV, acerto compartilhado e débito de câmbio, sem substituir os `<select>`.
- [x] Exibir a instituição selecionada no campo principal de origem da transação e na conta internacional vinculada a uma viagem.
- [x] Exibir também a instituição escolhida no acerto de PIX de uma viagem quando habilita o registro no saldo bancário.
- [x] Reutilizar uma mesma face visual de cartão na listagem, dashboard e página detalhada do cartão.
- [x] Substituir monogramas por logos locais de instituições financeiras conhecidas nas contas e na Visão Geral, mantendo fallback para instituições sem logo; registrar atribuição e escopo de marcas em `THIRD_PARTY_NOTICES.md`.
- [x] Mostrar marca da instituição, nome e tipo no cabeçalho da subpágina de conta.
- [x] Padronizar ao azul os SVGs de ícones de ação dentro de `<button>` e `[role="button"]`.
- [x] Unificar botões sólidos de ação cinza-escuros (`slate-700/800`) com o azul principal e hover.
- [x] Aplicar tema escuro à navegação lateral desktop/drawer móvel e azul ao módulo selecionado em ambos.
- [ ] Conferir o encaixe móvel dos monogramas e previews de cartão.
- [ ] Revisar preview dos cartões em desktop/mobile e conferir contraste com cores de cartão variadas.
- [ ] Revisar a composição da Visão Geral renderizada e ajustar fidelidade/overflow nas larguras desktop e mobile (página autenticada; ainda não observada; grid wide-screen recém-ajustado).
- [ ] Revisar visualmente cada página/subpágina, formulário e modal em desktop/mobile; corrigir diferenças encontradas. A revisão ainda não cobriu sessões autenticadas.

## Gate de liberação para produção — estado atual
- [x] Publicar o código de integração readiness/status no commit `0e080c7`; CI `42425025978` passou e Vercel deployment `minhaseconomias-ggrb646vu` ficou Ready.
- [x] Verificar o smoke público: `/api/status` retornou 200 com Auth/Neon configurados e `neon: not_checked`; `/api/readiness` sem autorização retornou 401.
- [x] Cadastrar `CRON_SECRET` como variável sensível em Production; não foi lido nem exposto.
- [ ] Validar `/api/readiness` autenticado (200/Neon ok/role restrita) e observar execução agendada do cron; `vercel env run` não disponibilizou o valor sensível localmente. Auditoria externa em 2026-11-08 confirmou `/api/readiness` `15 12 * * *` UTC, mas a janela de hoje (09:15 BRT) ainda não ocorreu; GETs 401 observados foram smoke sem bearer, não evidência de Cron.
- [ ] Comprovar execução automática `schedule` do backup cifrado; último backup conhecido `workflow_dispatch` em 2026-11-07 20:54 UTC. Auditoria read-only em 2026-11-08 confirmou próximo schedule configurado para 13:17 UTC (10:17 BRT), ainda futuro na consulta.
- [x] Implementar máscara em campos monetários editáveis: contas/saldos, lançamentos e rateios exatos, cartões/pagamentos, orçamentos, metas/simulador, investimentos, viagens e conversor; a moeda selecionada controla casas decimais, inclusive JPY/CLP. `1000` agrupa ao digitar e finaliza como `1.000,00`; moeda fica no prefixo já existente.
- [x] Validar utilitário e componente de moeda: digitação, cursor, substituição de seleção, colagem BR/US/Europa, backspace, precisão por moeda, valores negativos e conservação de casas excedentes para validação; full suite `bun test` **380/380 em 56 arquivos**, `bun run lint`, `bun run build` e `git diff --check` passaram em 2026-11-08.
- [x] Publicar a máscara no PR [#2](https://github.com/cascaoconcurseiro/Minhas-/pull/2), merge commit `63c439f`; CI `42476104819` passou e deployment Vercel `dpl_GhpQLu1yRWgs2jad3ya7TcMvPQem` ficou Ready em Production.
- [x] Fazer smoke após deploy: página e `/api/status` HTTP 200; `/api/readiness` sem credencial HTTP 401; chunk publicado de lançamentos importa o componente `CurrencyInput`.
- [ ] Validar visualmente com sessão real de QA a digitação/blur nos formulários publicados; smoke de rota e inspeção de bundle não exercitam campos pela interface autenticada. Tentativa no Ego Lite em 2026-11-08 não iniciou porque a ferramenta não conseguiu conexão ao bootstrap do navegador neste ambiente; nenhum outro perfil foi usado.
- [ ] Validar cadastro/login/logout e reload com sessão de QA, mais CRUD → reload/readback Neon para cada entidade e isolamento entre titulares.
- [ ] Validar restore/import/export pela UI em branch Neon QA descartável, com readback independente e limpeza.
- [ ] Concluir revisão visual/accessibilidade em desktop e mobile; guardar a chave privada `age` fora deste computador e comprovar recuperação em outro dispositivo.
- [ ] Após publicar a máscara, validar pela interface a digitação e blur em campos BRL e internacionais, incluindo um valor com zero casas decimais; registrar o resultado.

## Correções e integração de segurança — 2026-11-07
- [x] Validar revogação/desativação Firebase no Identity Toolkit, falhar fechado sem `FIREBASE_API_KEY` e mapear erros conhecidos de conta/token para 401; erros de configuração, rede ou desconhecidos retornam 503.
- [x] Fazer `/api/status` refletir a configuração de Auth sem conectar ao Neon e proteger `/api/readiness` com `CRON_SECRET` antes de abrir conexão.
- [x] Atualizar `vercel.json` para o cron diário em `/api/readiness` e cadastrar `CRON_SECRET` como variável sensível na Vercel Production, sem revelar o valor.
- [x] Corrigir importação CSV sem contas para bloquear destino vazio e não anunciar sucesso falso.
- [x] Corrigir validação de investimento para rejeitar quantidade/preços não positivos; ampliar coberturas DOM de cartão, conta, orçamento, metas/simulador, configurações e restore.
- [x] Executar suíte completa: `bun test` **374/374 em 54 arquivos**; `bun run lint`, `bun run build` e `git diff --check` passaram.
- [x] Fazer triagem read-only de regressões após correções de CSV, investimentos e Firebase Auth, separando casos reproduzíveis em harness de verificações operacionais somente leitura; sem executar testes ou acessar produção.
- [ ] Cobrir lote CSV misto com linhas rejeitadas, sinal `R$ -...` e remoção/alteração da conta destino enquanto a tela permanece montada; verificar callback/estado apenas em harness sem persistência.
- [ ] Decidir e testar precisão de quantidade fracionária, preço zero/sem cotação e entrada inválida de rendimento em investimentos.
- [ ] Validar em QA, com leituras somente: Firebase API key presente mas inválida, latência/indisponibilidade do Identity Toolkit e grants efetivos da role runtime; presença de variáveis em `/api/status`/`/api/readiness` não prova que a API key autentica.
- [x] Publicar as alterações no commit `0e080c7`; CI passou, deployment ficou Ready e smoke confirmou `/api/status` 200 e `/api/readiness` sem autorização 401.
- [ ] Confirmar `/api/readiness` autenticado com o segredo sensível e observar o próximo cron; a CLI local não forneceu o valor de Production.
- [ ] Confirmar execução automática de `/api/readiness` e primeira execução `schedule` do backup cifrado; a execução de backup mais recente conhecida foi `workflow_dispatch`.
- [ ] Guardar a chave privada `age` fora deste computador e testar recuperação em outro dispositivo.
- [ ] Aplicar a formatação automática monetária BRL/internacional em todos os campos editáveis e validar cursor, colagem, separadores e precisão por moeda.
- [ ] Concluir E2E de cadastro/login/logout e restore UI→API→Neon QA; fechar readback Neon por entidade e revisão mobile/acessibilidade.

## Aceleração da cobertura e correções — 2026-11-07
- [x] Corrigir e testar a validação de saldos: rejeitar `abc0`, `0abc` e separadores soltos sem impedir zero válido ou formatos BRL válidos.
- [x] Corrigir e testar rateio de dívidas de viagem em centavos, preservando os valores BRL individuais de cada devedor/credor.
- [x] Rejeitar valores monetários acima de duas casas decimais em contas e orçamentos; manter zero válido e os formatos BRL aceitos.
- [x] Ajustar atualização PWA: buscas/filtros fora de uma edição não seguram update; formulário alterado ainda adia até ser fechado.
- [x] Cobrir comportamento de efetivar/reverter conta pendente na visão geral e falha de atualização dos certificados Firebase antes de consultar Neon.
- [x] Expandir testes DOM sintéticos para cartões, metas/simulador, relatórios/CSV, cliente Neon e seletor acessível de Orçamentos; suíte atual `bun test`: 355/355 em 53 arquivos. `bun run lint` e `bun run build` passaram; CI `42415359477` passou após `9a218f6`.
- [x] Fazer revisão read-only de parse/validação, persistência e UI de import/export/restore, incluindo schema antigo, campos ausentes, conflito 409 e 503; registrar lacunas de testes e manter E2E UI→API→Neon pendente. Nenhum teste foi executado nesta revisão.
- [x] Corrigir fluxo familiar para não prometer e-mail que não é enviado; cadastro/edição aguarda confirmação Neon, falhas ficam visíveis, estados sem vínculo não aparecem como aceitos e o quick-add do lançamento encaminha e-mails à aba Compartilhado. Testes DOM sintéticos cobrem sucesso pendente, false/rejeição e cadastro local; full suite 355/355, lint/build/diff-check passaram. Publicado em `599f56b`, CI `42417735565` passou, Vercel `dpl_Gy1hmhePSL5XSSBSgxKiu1LgBAQd` ficou Ready; health Neon/role restrita OK e bundles atualizados conferidos no domínio principal.
- [x] Exercitar pela UI publicada com dados sintéticos CRUD de conta, lançamento/data, cartão, categoria/orçamento, meta, viagem e investimento; sincronização observada, todos os registros temporários removidos e estado final conferido.
- [x] Resolver a divergência do campo de data com evento input nativo; 07/11/2026 persistiu após sincronização e recarga. `page.fill` era limitação da automação, não bug do app.
- [x] Concluir a matriz Ego em `C:\Users\Wesley\Documents\Codex\2026-11-07\minhas-economias-site-test\outputs\ego-ui-audit\01-live-results.md`; baseline, viewport e dados sintéticos estão registrados.
- [x] Corrigir e revalidar layout publicado em viewport 1066×1132: barra de ações em Lançamentos, botões de ação em Compartilhado e título/seletores de Relatórios cabem; tabela de Orçamentos mantém rolagem própria.
- [x] Corrigir seletor de visão de Orçamentos para empilhar em mobile, quebrar rótulos longos e expor estado selecionado; 344 testes, lint e build locais passaram.
- [x] Publicar a correção em `9a218f6` e revalidar no Ego/Vercel: em 390×844, `main` ficou 390/390 e abas empilhadas totalmente visíveis; em 768×1024, Visão Geral, Lançamentos e Orçamentos ficaram 753/753; a tabela de orçamento conserva rolagem horizontal interna prevista. Relatórios voltou a 1066×1132 e a UI mostrou “Nuvem sincronizada”.
- [ ] Completar varredura visual mobile dos demais módulos; a validação pós-hotfix cobriu 390 px em Orçamentos e 768 px em três módulos, não todos os módulos em celular.
- [x] Confirmar os hashes atuais de JS/CSS após remover apenas o registro antigo do service worker da origem Ego, preservando cookies, cache storage, IndexedDB, localStorage e sessão.
- [x] Exercitar compra sintética em cartão, baixa integral e estorno da fatura; apagar compra/cartão/conta auxiliares e confirmar UI sincronizada e sem resíduos.
- [x] Corrigir data do pagamento da fatura: corrigido para a data local da quitação; UI publicada confirmou 07/11/2026 após baixa, estorno e limpeza dos registros sintéticos.
- [ ] Exercitar import/export sintético e operações com efeitos externos isolados (convite e cotações) sem tocar dados pessoais.
- [ ] Validar CRUD UI→API→Neon e restore autenticado; os testes atuais locais usam DOM e mocks e não provam persistência no banco.
- [ ] Revisar a cópia redundante do workspace em `localStorage`: é gravada após carregar Neon, mas não é lida para hidratar a UI; decidir e validar sua remoção ou finalidade para evitar duplicação financeira sem necessidade.
- [x] Confirmar atividade diária real: workflow `Neon — verificação diária` executou por `schedule` (`42397967500`) e `SELECT 1` no Neon passou. Isso confirma consulta diária, não compute ativo o dia inteiro.
- [x] Executar backup cifrado manualmente em GitHub Actions (`42413305298`), artifact `neon-backup-42413305298`, 20.893 bytes, retenção até 2026-12-07; isso não valida o evento diário `schedule`.
- [ ] Confirmar evento `schedule` do backup cifrado e verificar cópia privada age fora deste computador.
- [ ] Testar no Ego Lite cadastro/login, convite criado/aceito/recusado e lançamento compartilhado entre duas contas, com recarga/readback independente e limpeza. O usuário confirmou que tem página e segunda conta controlada; o Ego ainda não entregou uma Page acessível e o ensaio não começou.

## Continuação — 2026-11-07 — restauração Firebase Auth + Neon
- [x] Confirmar a arquitetura da meta: Firebase Auth para identidade e Neon PostgreSQL para persistência exclusiva; manter os UIDs Firebase já associados aos workspaces.
- [x] Substituir Neon Auth/OTP por Firebase Auth (e-mail/senha, verificação por link) no app, preservar tokens Firebase para as APIs Neon e atualizar interface, mensagens e documentação.
- [x] Endurecer API: exigir projeto Firebase em `aud`/`iss`, UID coerente com a conta verificada e responder 503 para configuração/indisponibilidade do Firebase.
- [x] Cobrir projeto incorreto, token inválido, usuário desativado, indisponibilidade Firebase e health degradado sem configuração.
- [x] Configurar `FIREBASE_PROJECT_ID` e `FIREBASE_API_KEY` como variáveis sensíveis de Vercel Production; manter variáveis Neon Auth antigas até smoke pós-deploy.
- [x] Validar localmente `bun test` (173/173 em 33 arquivos), `bun run lint`, `bun run build` e `git diff --check`; aviso de chunk principal >500 kB permanece.
- [x] Revisar e publicar as alterações em `main` no commit `aede265`; CI `42378877771` passou e deployment Vercel `dpl_8mrRFxZutZBhKte6gN52m5kbBZfn` ficou Ready.
- [x] Validar production `/api/health` 200 com Neon `ok`, role restrita e Firebase configurado; workspace, compartilhamento, lembretes, FX e sync de ativos retornam 401 sem token. Bundle publicado contém Firebase Auth, sem OTP/Neon Auth e sem Guia Rápido.
- [x] Remover `NEON_AUTH_JWKS_URL` e `VITE_NEON_AUTH_URL` da Vercel Production; confirmar listagem final com apenas `DATABASE_URL` e os dois envs Firebase.
- [x] Fazer novo deployment após remover as envs antigas (`dpl_FyZfqqhhZNfE49tHG4GvKisNpFu1`) e repetir health, auth sem Bearer e inspeção do bundle no domínio principal.
- [x] Confirmar que “Contas anteriores não foram migradas; crie uma nova conta” vinha de conteúdo antigo em cache na aba Ego Lite; recarregar a mesma aba atualizou o service worker e a mensagem sumiu. Nenhum cookie ou armazenamento foi apagado; o login atual de produção não tem esse texto.
- [ ] Validar signup/login e workspace Neon com conta Firebase real, por ação local do titular; nenhum segredo ou dado real foi usado nos testes locais.
- [ ] Retomar os aceites gerais ainda abertos: execução programada do backup, restore UI autenticado, teste visual e cobertura dos módulos, chave de restauração externa.

## Retomada local — 2026-11-07
- [x] Testar o convite do titular na `SharedExpensesTab`: normalização de nome/e-mail e metadados locais sintéticos.
- [x] Pedir confirmação antes de remover membro familiar; DOM tests cobrem confirmar e cancelar sem segunda conta, Neon ou API real.
- [x] Rodar novamente `bun test` 177/177 em 34 arquivos, `bun run lint`, `bun run build` e `git diff --check`; aviso de chunk principal >500 kB permanece.
- [ ] Publicar a confirmação de remoção familiar e o novo teste DOM em `main`; aguardar CI/Vercel e verificar o bundle pós-deploy.
- [x] Proteger exclusão de conta com confirmação explícita; testes DOM cobrem confirmação e cancelamento.
- [x] Cobrir os efeitos da exclusão de conta com e sem conta substituta: cartão padrão, lançamentos, liquidações compartilhadas e transferências que se tornam inválidas; ignorar IDs de conta inexistentes.
- [x] Corrigir cascata ao excluir parcelas compartilhadas: remover reembolso relacionado e reabrir outras despesas que estavam incluídas no acerto; cobrir `all_series` e `this_and_future` com dados sintéticos.
- [x] Ampliar testes de API para health degradado quando Neon falha e para respostas de cotação internacional com Gemini simulado, sem egress externo.
- [x] Rodar validação final da suíte após a extração do cascade de conta: `bun test` 174/174 em 33 arquivos; `bun run lint`, `bun run build` e `git diff --check` passaram. O build mantém o aviso do bundle principal acima de 500 kB.
- [x] Publicar em `main` no commit `600c3ec`; CI `42376418227` passou e Vercel `dpl_DDCSTBKZ8cUPjap4qFWJ4pdFZ67X` ficou Ready.
- [x] Fazer smoke no domínio principal após deploy: `/api/health` 200 com Neon `ok`/role restrita; `/api/workspace`, lembretes, FX e sincronização de ativos sem token retornam 401; bundle mostra a confirmação de exclusão de conta e não contém Firebase nem Guia Rápido.
- [x] Confirmar atividade diária automática do Vercel Cron: `vercel crons list` mostra `/api/health` ativo (`15 12 * * *` UTC) e log de produção registra HTTP 200 às 09:23:28 BRT em 2026-11-07.
- [ ] Confirmar execução automática GitHub `schedule` dos workflows de atividade/backup; às 10:14 BRT ainda não havia evento `schedule`, apenas `workflow_dispatch` (backup manual válido, artifact cifrado com 30 dias).
- [x] Resolver a divergência da arquitetura de autenticação: a decisão vigente é Firebase Auth para identidade e Neon PostgreSQL para persistência. O código, as envs Vercel e o deploy mais recente foram conferidos; não usar a pendência antiga de Neon Auth como estado atual.
- [ ] Completar signup/login/OTP real, restore autenticado na interface, revisão visual desktop/mobile e testes das abas sem DOM coverage.
- [ ] Copiar chave de restauração `age` para um cofre/dispositivo separado e comprovar leitura fora deste computador.

## Continuação — 2026-11-07
- [x] Confirmar por busca em `src`, `backend`, `api` e `shared` que Neon Auth/Neon PostgreSQL são os únicos caminhos operacionais; referências Firebase restantes estão em migrations/documentação históricas.
- [x] Adicionar teste DOM do lançamento: rejeitar valor zero e salvar R$ 12,34 com payload validado.
- [x] Cobrir autenticação obrigatória nos endpoints de câmbio, sincronização de cotações e lembretes; sem Bearer retornam 401 e não fazem chamadas externas.
- [x] Corrigir cache JWT após confirmação OTP: forçar atualização da sessão, exigir UID correspondente e e-mail verificado antes de enviar JWT às APIs; impedir downgrade da UI por evento de sessão atrasado.
- [x] Verificar localmente nesta continuação: `bun test` 161/161 em 32 arquivos, `bun run lint`, `bun run build` e `git diff --check` aprovados; build mantém alerta de bundle principal acima de 500 kB.
- [x] Publicar alterações em `main` no commit `a887df7`; CI `42317905521` aprovado, Vercel `dpl_GoeZ9DQEmLyer1F5nWzhsD31VRQ2` Ready, health `ok`/Neon `ok`/role restrita, `/api/workspace` sem sessão 401 e bundle publicado contém o force-refresh OTP sem Firebase SDK.
- [x] Validar o dump integral de produção com execução manual GitHub Actions `42320784685`, artifact age cifrado com 30 dias, `pg_restore --list` e restauração transacional em QA; contagens agregadas iguais, branch QA e dump aberto removidos. O segredo de backup aponta à role de produção.
- [x] Reconfirmar agregados Neon sem dados financeiros de demonstração: 4 workspaces vazios; 0 contas, cartões, lançamentos, metas, investimentos e viagens.
- [x] Cobrir DOM sintético do modal de configurações para exportação e importação/restauração JSON v6, confirmação, arquivo inválido e cancelamento; callback local, sem Neon.
- [x] Cobrir fallback Gemini internacional e falha SMTP 502 com mocks, sem chamadas externas ou envio de e-mail.
- [x] Corrigir distribuição proporcional do `sharedAmount` em pagamento parcial de fatura e recompor esse valor ao estornar.
- [x] Pedir confirmação antes de excluir lançamento, série parcelada ou pagamento de fatura; cobrir edição, cancelamento e confirmação em teste DOM.
- [x] Remover `smtpPass`/`smtpConfig.pass` de Neon, cache local, exportação e importação; limpar caches v6 legados no boot, mantendo a senha apenas em memória até recarga. Testes confirmam que o envio ainda recebe a credencial em sessão.
- [x] Verificar em produção: `/api/workspace`, `/api/reminders/send-email`, `/api/fx/live-rate` e `/api/investments/sync-quotes` sem token retornam 401; os cinco cabeçalhos de segurança esperados estão presentes.
- [x] Remover o artifact público cifrado de QA `neon-backup-42320249250`; manter somente o artifact cifrado gerado da produção.
- [x] Publicar as correções de segurança, finanças, UI e testes no commit `be9fed4`; CI `42322323802` passou e Vercel `dpl_AV4EZmVhVtNsiCFVQv628FYUbUHU` ficou Ready no domínio principal.
- [x] Confirmar após o deploy health `ok`/Neon `ok`/role restrita, quatro APIs sem token retornando 401, bundle sem Firebase/Guia Rápido e chunks de configurações/lembretes contendo aviso de senha SMTP não persistida.
- [ ] Validar sessão real Neon Auth/OTP e CRUD autenticado em ambiente controlado; testes locais não cobrem esse aceite.
- [ ] Verificar eventos automáticos GitHub `schedule` após 2026-11-07 12:23 UTC (atividade) e 13:00 UTC (backup); execuções manuais não comprovam agendamento.
- [ ] Exercitar restore pela interface autenticada, revisar interface publicada em desktop/mobile e fechar testes dos módulos pendentes.
- [ ] Guardar chave privada `age` fora deste computador e verificar acesso em outro dispositivo; o arquivo local fica em `C:\Users\Wesley\Documents\Minhas Economias Backup\neon-backup.agekey`.
- [ ] Recursos live FX/Gemini estão desativados na Vercel (`GEMINI_API_KEY` não configurada); configurar uma chave aprovada ou aceitar esses recursos como indisponíveis.

## Corte Firebase → Neon Auth completo — 2026-11-06
- [x] Habilitar Neon Auth Managed Better Auth em `production`, com e-mail/senha e verificação por OTP; autorizar domínio Vercel e desligar origem localhost em produção.
- [x] Substituir cliente, sessão, cadastro/login/logout e tokens do app pelo SDK `@neon/auth`.
- [x] Substituir validação Identity Toolkit/Firebase na API pela verificação de JWT EdDSA com JWKS Neon Auth.
- [x] Renomear identificadores Firebase nas tabelas e políticas RLS com `db/migrations/006_neon_auth_identity.sql`; validar em QA e aplicar à production.
- [x] Remover SDK, arquivos de configuração e regras Firebase do repositório; substituir CSP e documentação pelo fluxo Neon.
- [x] Configurar `VITE_NEON_AUTH_URL` e `NEON_AUTH_JWKS_URL` na Vercel production.
- [x] Remover variáveis Firebase da Vercel e confirmar no deploy que o bundle publicado não contém SDK/chamadas Firebase.
- [x] Publicar o corte em `main` e confirmar deploy Vercel Ready; health de produção retorna 200 e Neon `ok`.
- [x] Remover a branch QA depois de validar a migration no banco de produção.
- [x] Adicionar envio e confirmação OTP no aviso da interface, além de atualizar a mensagem de acesso para Neon.
- [x] Rodar `bun test` (121/121), `bun run lint` e `git diff --check`; API usa testes com JWT EdDSA sintético.
- [x] Reexecutar `bun run build` após a correção da interface OTP; publicar em `6559f24`, CI passou e Vercel production Ready com smoke OTP/Neon.
- [ ] Validar signup, login, logout, recarga de sessão, confirmação OTP, CRUD e chamadas API com token Neon Auth real.
- [ ] Aceitar que usuários anteriores precisam criar conta Neon Auth; senhas Firebase não são transferíveis. Os dados financeiros existentes no Neon foram mantidos.

## Auditoria requisito a requisito — retomada 2026-11-06
- [x] Reconsultar estado Neon atual: apenas branch `production`; Neon Auth habilitado para domínio público, localhost desligado, email/senha e verificação OTP, sem OAuth.
- [x] Consultar catálogo PostgreSQL: as quatro tabelas financeiras têm RLS habilitado e forçado; policies usam ID/e-mail autenticados.
- [x] Conferir roles/grants: `minhas_app_runtime` não é admin, não tem BYPASSRLS nem associação `neon_superuser`, e possui somente grants operacionais; `minhas_daily_runtime` sem grants em tabelas financeiras.
- [x] Confirmar por contagens agregadas que contas, cartões, transações, metas, investimentos, viagens, convites e transações compartilhadas estão vazios; workspace/recibos de migração sem payload financeiro.
- [x] Confirmar no Neon que a branch QA foi removida e apenas `production` está ativa.
- [x] Verificar CORS atual dos endpoints Neon OTP: preflight `OPTIONS` retorna 204 para origem Vercel e permite credenciais; `GET /get-session` retorna 200/null nessa origem. Isso comprova rota/origem, não envio/aceite de código real.
- [x] Inspecionar o catálogo Neon e corrigir cinco constraints ainda nomeadas com `firebase_uid`, sem mudar dados ou lógica.
- [x] Criar migration `007_neon_auth_constraint_names.sql`; validar primeiro na branch QA, aplicar em production e verificar zero relações, colunas, constraints ou rotinas com nome Firebase no catálogo ativo.
- [x] Pós-migration, confirmar RLS habilitado/forçado nas quatro tabelas e contagens dos workspaces/recibos invariáveis; excluir a branch QA e confirmar apenas `production`.
- [x] Consultar `finance_workspaces` em production com a role `minhas_app_runtime` e sem `app.user_id`; RLS retornou 0 workspaces visíveis (fail-closed).
- [x] Adicionar ao health da API o indicador booleano `services.neonLeastPrivilegeRole`, sem revelar o nome da role ou a connection string; incluir teste de rota.
- [x] Revalidar suíte completa após o indicador: 122/122, `bun run lint`, `bun run build` e `git diff --check` passaram.
- [x] Rodar `bun test` (121/121), `bun run lint`, `bun run build` e `git diff --check`; publicar `d43394d`, CI `42312647937` aprovado, Vercel `dpl_Ce1zsXY2KY6rwAWUa9RNx76UPARg` Ready, health 200/Neon ok e workspace sem token 401.
- [x] Após o deploy do indicador, confirmar em produção `services.neonLeastPrivilegeRole=true`; health retornou `status=ok`, `neon=ok`, `leastPrivilegeRole=true` em 2026-11-06.
- [x] Acrescentar teste de renderização da tela de acesso: confirma e-mail/senha, cópia Neon Auth/PostgreSQL e ausência de texto Firebase/dados demo; suíte passou 124/124 em 24 arquivos e `bun run lint` passou.
- [x] Implementar backup JSON v6 vinculado ao UID Neon Auth; excluir espelhos recebidos e relações de convite vinculadas na exportação; ao importar em outra conta, remover marcadores de compartilhamento; no mesmo UID, preservar relações carregadas do Neon e validar vínculos ativos antes de sincronizar. Publicado em `deef507`, CI `42315044261` passou e Vercel `dpl_Gp84YP8myPFaJ5BkhLUfgTmN4fdz` ficou Ready; health `ok`/Neon `ok`/role restrita; bundle remoto sem Firebase e Guia Rápido.
- [x] Endurecer o import de outro titular para remover todos os campos familiares residuais mesmo quando `isShared=false`; suíte 129/129, lint e build locais passaram. Publicado no commit `b6cf3f2`; CI `42315381945` passou e Vercel `dpl_B636QbVhEWdgv8r5dx7GnC1DFmWM` está Ready.
- [x] Adicionar testes DOM para alternância login/cadastro, submissão dos callbacks e validação, associando labels a inputs; testar o parser de retorno verificado do OTP e rejeitar tokens de outro emissor JWT.
- [x] Criar teste de interação do formulário de cartão de crédito no estado vazio: abertura, campos, validações e payload BRL ao salvar; suíte local 136/136, lint e build passaram. O erro reportado não foi reproduzido; validação ainda é sintética/UI, sem gravação em Neon.
- [x] Endurecer `neonLeastPrivilegeRole` para verificar atributos administrativos e herança de `neon_superuser`; query passou em uma branch Neon QA, removida depois. Produção ainda requer verificação pelo health atualizado.
- [x] Rodar manualmente o workflow de atividade diária `42316121492`; log confirma `psql ... SELECT 1` no Neon com sucesso. Isso não substitui a comprovação de evento automático `schedule`.
- [x] Publicar as correções de OTP, emissor JWT, healthcheck e testes no commit `ecc81cd`; CI `42316354715` passou, Vercel `dpl_GQ8QEatczeiSQppFrNsU97daafpy` ficou Ready, e health de produção confirmou `neon=ok`/`neonLeastPrivilegeRole=true`. Bundle remoto sem Firebase nem Guia Rápido; workspace sem token retorna 401.
- [x] Publicar teste DOM do cartão no commit `6a4c78c`; CI `42316817588` passou e Vercel `dpl_Et8ufk4zDp2a69XU7qaD2TeFf3T3` ficou Ready. O teste é sintético e não reproduziu o erro original nem grava no Neon.
- [ ] Comprovar ao menos uma execução automática diária do Vercel Cron `/api/health` ou do GitHub schedule; Vercel cron está cadastrado em `15 12 * * *`, mas logs recentes não mostraram a invocação agendada e Actions lista apenas `workflow_dispatch`.
- [ ] Executar signup/login/sessão/OTP real por e-mail com caixa controlada; bundle contém o fluxo, mas isso não prova que CORS/cookies/endpoints funcionam em runtime.
- [x] Revisar no Brave, em desktop de produção, a tela de acesso e a alternância para cadastro; após recarga, o conteúdo exibiu Neon Auth e Neon PostgreSQL, sem o Guia Rápido.
- [ ] Revisar os layouts e fluxos visuais atuais em viewport mobile; nenhuma verificação mobile foi realizada nesta etapa.
- [ ] Fazer restore pela interface autenticada e validar readback no Neon, incluindo relacionamento familiar quando aplicável; o backup JSON não cobre convites/transações relacionais e os testes atuais são sintéticos.
- [ ] Demonstrar concorrência API real com duas gravações e recuperação UI→API→Neon após indisponibilidade; testes existentes usam respostas/mocks sintéticos.
- [ ] Preparar e executar backup PostgreSQL integral independente e restore isolado com validação das três tabelas financeiras; Neon Free/PITR de seis horas não substitui retenção externa.
- [ ] Cobrir fluxos renderizados de cada módulo e editar/excluir/cascata. Existem testes DOM com callbacks sintéticos para `AccountsTab`, `CreditCardsTab`, `TransactionsTab`, `SharedExpensesTab`, `SettingsModal`, `LoginPage` e `TransactionModal`, além de testes de regras/API; faltam 7 das 11 abas e validação em navegador real.

Nota: itens em seções históricas abaixo registram decisões e provedores de sessões anteriores. O estado atual usa Neon Auth; tarefas concluídas não devem ser inferidas a partir de um teste Firebase antigo.

## Migração da persistência Firestore → Neon — 2026-11-06
- [x] Remover do app as leituras/gravações Firestore e o importador automático no primeiro carregamento; Neon passa a ser a única persistência operacional.
- [x] Remover endpoint `/api/workspace/migrate` e respectivos testes/código legado.
- [x] Publicar regras Firestore deny-all no Console Firebase; Firestore deixa de ser acessível pelo cliente do app.
- [x] Confirmar por busca de código que não há import/chamada `firebase/firestore` em `src`, `backend` ou `shared`.
- [x] Confirmar no Neon production 3 workspaces e zero contas, cartões, lançamentos, metas e investimentos depois de criar/recarregar/apagar um cartão temporário de QA.
- [x] Com autorização do usuário, excluir as coleções Firestore legadas `cloud_vaults` e `workspaces` como demonstração; a tela raiz do Console confirmou que o banco não contém coleções e está pronto para receber dados.
- [x] Rodar `bun test` (119/119), `bun run lint`, `bun run build` e `git diff --check` após esta alteração documental; build mantém aviso de chunk principal 565 kB.
- [x] Publicar Neon como persistência exclusiva em `bdaf318` e remover o adaptador de rota Vercel `api/workspace/migrate.ts` em `88f0824`; CI `42305119471` e deploy `dpl_7Uzq7UXeRsfD29ZxhVernRFNkQWs` Ready. A função de migração não aparece no deployment; `/api/workspace/migrate` retorna 404, `/api/workspace` sem token retorna 401 e `/api/health` retorna 200/Neon ok.
- [x] Corrigir comentário legado no parser OFX e confirmar que `src`, `backend`, `shared` e `api` não importam SDK nem fazem consultas Firestore; referências restantes apenas explicam Firebase Auth e as regras deny-all.
- [x] Migrar identidade de Firebase Auth para Neon Auth no corte posterior de 2026-11-06; o teste de cadastro/login real permanece na seção de pendências atuais.
- [ ] Confirmar execução automática do Vercel Cron `15 12 * * *`; consulta dos logs em 2026-11-06 22:25 UTC encontrou apenas chamadas manuais a `/api/health`.
- [ ] Revisar visualmente os fluxos completos em desktop e mobile; a tela de login foi observada em desktop, mas a inspeção responsiva foi interrompida pelo controle do Brave.

## Continuação 2026-11-06 — configuração de Auth e atividade diária
- [x] Diagnosticar cadastro Firebase real em QA: `accounts:signUp` retorna `OPERATION_NOT_ALLOWED`; nenhum usuário/registro foi criado.
- [x] Confirmar Neon QA com role `minhas_app_runtime`; health local Neon `ok` e rota workspace sem token retorna 401.
- [x] Exibir mensagem útil para `operation-not-allowed` e `unauthorized-domain`, sem revelar existência de conta em erros de credenciais.
- [x] Adicionar quatro testes de mapeamento de erros Firebase; suíte total 120/120 em 22 arquivos, lint e build aprovados.
- [x] Habilitar workflow diário GitHub `SELECT 1` para 12:23 UTC; CI do commit `3a611de` passou e execução manual `42275346060` passou.
- [x] Habilitar Email/Password no Console Firebase.
- [x] Manter e-mail/senha como único fluxo de acesso oferecido pela UI, conforme decisão do usuário de que Google não é necessário; cadastro/login real ainda não foi validado.
- [ ] Recriar branch QA e validar cadastro/login real, CRUD e restore UI→API→Neon.
- [ ] Observar evento automático GitHub `schedule` na janela 7/nov às 12:23 UTC; logs da Vercel ainda não comprovam a agenda diária de 12:15 UTC.
- [x] Encerrar tentativa atual sem dados gravados: servidor local parado, `.env` temporário removido e branch QA apagada; Neon lista somente `production`.
- [ ] Cobrir os fluxos funcionais, segurança, backup/restore, concorrência, indisponibilidade e layouts desktop/mobile ainda pendentes.

## Continuação 2026-11-06 — recuperação de sync e mensagens de autenticação
- [x] Unificar os erros da aba Autenticação e nuvem com o mapeador testado de erros Firebase e remover mensagens que afirmavam sincronização antes da carga Neon.
- [x] Remover comentário obsoleto sobre Cloud Vault e confirmar que os seeds de contas, cartões, lançamentos, metas, investimentos, viagens e membros familiares são vazios; categorias iniciais são defaults do produto.
- [x] Pesquisar a interface por “Guia Rápido”, “Quick Guide” e “QuickGuide”; nenhum desses itens está presente no código da UI atual.
- [x] Implementar até oito novas tentativas com backoff para falhas transitórias ao salvar no Neon, usar sempre o último payload, tentar imediatamente no evento `online`, cancelar em troca de usuário e não repetir conflitos 409.
- [x] Adicionar testes de classificação: erros de rede/408/429/5xx repetem; erros de autenticação/validação/conflito não repetem. Suíte 121/121, `bun run lint`, `bun run build` e `git diff --check` passaram.
- [x] Publicar a correção em `main` no commit `6e2a89e`; CI `42306945924` passou e o deployment Vercel `dpl_35NmsXWDRDADTL2sDs6uJCATX3uH` ficou Ready. O bundle servido em `minhaseconomias-blue.vercel.app` é idêntico byte a byte ao build local; `/api/health` retorna Neon ok e `/api/workspace` sem token retorna 401.
- [ ] Validar o retry com pane real UI→API→Neon em ambiente isolado; implementação e política unitária não equivalem a ensaio runtime.
- [ ] A exportação JSON do workspace não inclui as tabelas relacionais `finance_family_invitations` e `finance_shared_transactions`; decidir/documentar backup e restore desses vínculos sem reimportar convites/compartilhamentos para outro UID.

## Incidente pós-deploy — 2026-11-06
- [x] Capturar o 500 de `/api/health` após `af357d3` e identificar `ERR_MODULE_NOT_FOUND` em import local ESM.
- [x] Atualizar `travelRules.ts` para importar `./financeRules.js`; testes focados 34/34, lint e build passam localmente.
- [x] Publicar `78fd56f`; CI `42277562293` passou, deployment ficou Ready, `/api/health` 200 com `Neon=ok` e `/api/workspace` sem token 401.

## Hospedagem
- [x] Criar projeto `minhaseconomias` no plano gratuito Hobby da Vercel.
- [x] Conectar projeto ao repositório `cascaoconcurseiro/Minhas-` e branch `main`.
- [x] Publicar o painel na URL de produção e confirmar que abre.
- [x] Configurar `DATABASE_URL`, `FIREBASE_PROJECT_ID` e `FIREBASE_API_KEY` como variáveis de produção na Vercel.
- [x] Criar o segredo GitHub Actions `NEON_DATABASE_URL` com um papel separado.
- [x] Alinhar o CI ao `bun.lock` e ao Bun 1.4.3 usado pelo projeto.

## Integração Neon
- [x] Criar o projeto Neon em São Paulo e aplicar o schema inicial.
- [x] Criar credencial PostgreSQL restrita para a aplicação e guardá-la como variável secreta na Vercel.
- [x] Publicar a API de workspace e validar as credenciais Firebase no runtime de produção.
- [x] Autorizar o domínio de produção na Firebase Authentication, mantendo Firebase Auth.
- [x] Migrar a conta autenticada do Firestore para Neon; conferir migração, leitura e gravação no site publicado.
- [x] Executar manualmente o workflow GitHub `neon-daily-activity.yml` e confirmar `SELECT 1` com sucesso; essa execução é `workflow_dispatch`, não agenda diária.
- [x] Confirmar o Cron diário ativo na Vercel: `/api/health`, `15 12 * * *` UTC (09:15 America/Sao_Paulo). O primeiro disparo automático segue pendente até a janela programada.
- [x] Auditar o workspace Neon em produção; nenhum registro correspondeu aos marcadores de mock existentes.
- [x] Publicar limpeza automática apenas para marcadores explícitos de mock (`isMock`/`isDemo` e IDs `mock-`/`demo-`/`seed-`); IDs genéricos de banco, cartão e viagem devem ser preservados.
- [x] Deixar explícita na interface a diferença entre Firebase Auth, banco Neon e espelho Firestore.
- [x] Com autorização explícita do usuário, excluir os 4 lançamentos identificados como demonstração; preservar a conta.
- [x] Definir Neon como única persistência operacional do workspace; manter Firestore somente para importação inicial de snapshots legados.
- [x] Impedir gravação no espelho quando o salvamento principal no Neon falha; preservar o estado local e sinalizar a falha.
- [x] Manter Neon como autoridade quando o Firestore já existe; ignorar snapshots Firestore mais recentes em vez de promovê-los automaticamente.
- [x] Mostrar falha de sincronização como erro visível, sem a mensagem enganosa de nuvem ativa.
- [x] Marcar como erro uma falha ao atualizar o espelho Firestore durante a carga inicial ou limpeza.
- [x] Publicar essa correção no commit `697e05f` e confirmar o status Vercel `success`.
- [x] Aguardar a gravação do espelho na carga inicial para evitar que uma falha seja sobrescrita pelo status de sucesso; publicar em `8c46ba6` e confirmar a Vercel `success`.
- [ ] Validar concorrência em várias abas com workspace sintético isolado.
- [x] Criar diálogo para conflitos `409`: comparar resumos, baixar cópia JSON das duas versões e escolher explicitamente a versão local ou a do Neon.
- [x] Publicar o diálogo em `07cedd5`; Vercel `success`, bundle servido, APIs autenticadas (401 sem token).
- [x] Publicar a proteção final que mantém a resolução bloqueada até a conclusão do espelho Firestore (`e3fc388`); conferir bundle 200 e APIs 401 sem token.
- [x] Documentar escopo do JSON do app, limites do espelho Firestore e roteiro de recuperação integral do Neon; o ensaio real de restore continua pendente antes de desativar o espelho.
- [x] Criar estruturas isoladas no Neon para convites e lançamentos familiares; migrar convites e espelhos sem apagar os dados antigos.
- [x] Trocar os fluxos do app/API para ler e gravar compartilhamentos no Neon com verificação de Firebase Auth e RLS.
- [x] Publicar roteamento específico das rotas familiares na Vercel e confirmar que convites/compartilhamentos exigem autenticação (401 sem token).
- [x] Remover referências de tipos Vite não resolvidas pelo compilador de funções Vercel; tipagem local limpa.
- [x] Confirmar no deploy Vercel que os diagnósticos `TS2688` foram resolvidos.
- [x] Carregar telas pesadas sob demanda, reduzindo o chunk inicial para 1,25 MB (350 kB gzip), e remover o aviso de configuração do Vite.
- [x] Publicar a divisão em chunks na Vercel e confirmar o arquivo principal de 1.248.948 bytes.
- [x] Adiar modais e busca; chunk inicial local caiu para 568 kB (168 kB gzip), com Firestore em chunk separado de 454 kB (137 kB gzip). O aviso do limite 500 kB permanece visível e foi justificado pelo tamanho comprimido; não foi aumentado o limite.
- [x] Registrar que o usuário dispensou a validação ponta a ponta do compartilhamento com uma segunda conta.
- [x] Restringir leitura de `cloud_vaults` ao titular autenticado apenas para importação inicial e bloquear lista/criação/atualização/exclusão; regras publicadas no banco nomeado.
- [x] Remover listener, espelho e gravações Firestore do app; workspaces novos são criados diretamente no Neon.
- [x] Remover acesso cruzado entre workspaces Firestore do código cliente; os dados familiares novos ficam em tabelas Neon separadas.

## Interface
- [x] Corrigir largura do modal de novo lançamento no desktop para respeitar o limite visual do componente.
- [x] Remover a seção “Guia Rápido de Ativação” da visão geral.

## Sessão 2026-11-02 — continuidade
- [x] Remover listener e escrita de rotina no Firestore; manter leitura legada do próprio cofre somente quando o Neon retornar 404.
- [x] Adicionar criação Neon idempotente para contas sem snapshot legado e manter conflito sem sobrescrita.
- [x] Publicar regras Firestore com leitura de cofre restrita ao titular e todas as gravações/listagens negadas.
- [x] Publicar commit `969172f` na `main`; GitHub Actions e Vercel concluíram com sucesso.
- [x] Confirmar produção na URL Vercel: página/bundles 200 e APIs workspace, migração e familiares 401 sem token.
- [x] Iniciar leitura Neon diretamente após autenticação; Firestore deixa de ser pré-requisito para carregar o workspace.
- [x] Lazy-load do Firebase Firestore e dos modais/busca; remover e-mail/nome pessoal pré-preenchidos no login.
- [x] Remover script inline e `unsafe-inline` de `script-src`; validar scripts externos no HTML de build.
- [x] Validar formato do backup JSON antes de aplicar estado e esclarecer que sucesso de importação local não confirma gravação no Neon.
- [x] Atualizar passo de testes do CI para não exibir contagem fixa obsoleta.
- [x] Publicar `d1a545d` em `main`; check Vercel `success` e smoke de produção: HTML/CSP/guard/bundle 200 e API protegida 401 sem token.
- [x] Confirmar CI run `41525311897` concluído com sucesso e check Vercel `success` para `1b05c89`.
- [x] Reconsultar histórico do workflow Neon em 2/nov: execução manual bem-sucedida existe; execução automática `schedule` ainda não existe, pois a primeira janela agendada depois da publicação é 3/nov às 09:15 BRT.
- [x] Confirmar que o GitHub Actions não tem mais cron diário; atividade foi migrada para Vercel Cron, cuja primeira execução automática ainda aguarda a janela de 4/nov.
- [x] Validar recuperação da API após indisponibilidade real do Neon em branch QA: endpoint desativado retornou 503 para health/leitura/gravação; após reativar, health e leitura voltaram a 200 com revisão 1 e fixture preservada. Recuperação visual/retry pela UI permanece pendente.
- [x] Ensaiar restore de snapshot da raiz em branch Neon isolada, sem promoção; dump/restore portátil de fixture sintética também foi validado em sessão posterior. Backup completo de produção permanece pendente.
- [x] Revalidar em 2/nov: `bun test` (78 testes), `bun run lint` e `bun run build` passaram; isso não substitui os ensaios reais pendentes no Neon.

## Sessão 2026-11-03 — auditoria e correções locais
- [x] Corrigir `/api/health` para executar consulta real no Neon, responder `503` sem banco e não afirmar prontidão sem conexão.
- [x] Remover login rápido com senha fixa e retirar nome/e-mail pessoal pré-preenchidos; alinhar validação de senha a 6 caracteres.
- [x] Restringir remoção de dados de demonstração a marcadores/IDs explícitos para preservar registros legítimos com nomes ou descrições coincidentes.
- [x] Manter registros com IDs curtos válidos e testar a remoção somente de IDs de demonstração explícitos.
- [x] Exigir confirmação de duas etapas antes de zerar a base pela tela de relatórios.
- [x] Corrigir saudação pessoal fixa, datas padrão de relatório e virada do mês local.
- [x] Atualizar documentos de segurança/API e indicadores para separar Firebase Auth, estado real do Neon e auditoria local.
- [x] Validar falha isolada do Neon: endpoint local respondeu HTTP 503 e `services.neon=error` com conexão deliberadamente inválida em localhost.
- [x] Consultar produção: `/api/health` respondeu 200, mas o bundle/API publicada ainda usa resposta antiga sem campo `services.neon`; portanto esse 200 não prova conectividade atual com o Neon.
- [x] Publicar `90aeccb` na `main`; CI `41688048038` e implantação Vercel concluíram com sucesso.
- [x] Reconsultar produção após o deploy: `/api/health` retorna `services.neon: ok` e `status: ok` após consulta ao banco; assets publicados incluem a nova auditoria e não incluem o login rápido nem o Guia Rápido.
- [x] Confirmar `/api/workspace`, `/api/workspace/migrate`, `/api/family/invitations` e `/api/family/shared` retornam 401 sem token.
- [x] Executar a checagem Neon manualmente hoje: GitHub Actions run `41688417355` concluiu com sucesso no commit `90aeccb`.
- [x] Revalidar `bun test` (83 testes), `bun run lint`, `bun run build` e `git diff --check`; o build ainda alerta para o chunk principal acima de 500 kB.
- [x] Confirmar em 3/nov que o workflow GitHub não tinha evento `schedule`; foi substituído pelo Vercel Cron. Execução automática Vercel ainda pendente.
- [ ] Validar concorrência real entre abas/workspaces com dados sintéticos isolados.
- [x] Ensaiar snapshot Neon da branch raiz restaurado em nova branch isolada; schema e quatro tabelas operacionais conferidos, produção preservada. O snapshot temporário expira em 4/nov.
- [x] Ensaiar dump/restore PostgreSQL independente de fixture sintética e API recovery após pane simulada em QA; backup completo de produção e recuperação pela UI permanecem pendentes.
- [ ] Validar fluxos visuais e responsivos completos no navegador; ferramenta BrowserOS Neo não está disponível nesta sessão.
- [x] Publicar a correção de health-check e UI em `main`; confirmar o novo payload `services.neon` na URL de produção.
- [x] Corrigir a exclusão do workspace pessoal para explicar que convites e lançamentos compartilhados em tabelas Neon separadas são preservados; renomear callback sem referência a dados demo.
- [x] Exigir Firebase ID token nas rotas de lembrete SMTP, câmbio ao vivo e sincronização de cotações; encaminhar token pelos fluxos da interface.
- [x] Retornar `502` se Nodemailer falhar, em vez de anunciar um e-mail enviado; atualizar a data de envio agendado somente após sucesso e limitar retentativas automáticas a 15 minutos.
- [x] Testar localmente as três rotas externas sem token: todas responderam 401; testes utilitários confirmam cabeçalhos Bearer em lembretes e cotações.
- [x] Revalidar 83 testes, lint, build e `git diff --check` depois das mudanças acima.
- [x] Publicar as proteções de API/SMTP e cópia da limpeza pessoal em `5b97901`; smoke posterior confirmou que a Vercel inicialmente devolvia 404 nas três rotas novas. Smoke autenticado ainda pendente.
- [x] Publicar `5b97901`; CI `41689898684` e Vercel `success`, mas o smoke descobriu HTTP 404 de plataforma para rotas aninhadas novas de FX, investimentos e lembretes.
- [x] Identificar que a Vercel precisa de adaptadores `api/<grupo>/[...path].ts` dedicados; criar os três adaptadores localmente.
- [x] Publicar adaptadores em `a36f95f`; CI `41690481583` passou. Produção: health 200 com Neon `ok`; POST sem token a `/api/fx/live-rate`, `/api/investments/sync-quotes` e `/api/reminders/send-email` retornou 401 (corrigido o 404).
- [ ] Validar os três fluxos autenticados com sessão Firebase controlada; testar envio apenas com SMTP de teste.


- [x] Corrigir parsing do snapshot Neon: JSON inválido, coleção/objeto no formato errado ou item sem id não é convertido em estado vazio; a tela mantém erro de sync e informa que os dados remotos foram preservados.
- [x] Testar parser do snapshot: bun test (87), bun run lint, bun run build e git diff --check passaram.
- [x] Publicar em `main` no commit `f66e89a`; CI `41691329025` e Vercel `success`. Smoke: homepage 200; bundle `index-DqXs8zaw.js` contém a mensagem de preservação; health 200/Neon `ok`; três rotas de serviço 401 sem token.
- [x] Validar integridade de cota compartilhada: rejeitar valor negativo, não finito, acima do total ou fora do limite seguro em centavos antes de gravar; adicionar testes de borda para 0, centavos, NaN e overflow.
- [x] Serializar sincronização de despesas e revogação familiar bloqueando a linha do convite aceito durante a escrita; ensaio concorrente real continua pendente em branch Neon isolada.
- [x] Publicar a serialização entre sincronizar e revogar em `6789504`; CI `41692724273` e Vercel `success`. Health 200/Neon `ok` e endpoints familiares 401 sem token.
- [x] Ensaiar no Neon isolado as duas ordens SQL sintéticas de sincronização/revogação; final sem espelho. A corrida pela API real com duas sessões autenticadas continua pendente.
- [x] Remover o agendamento do GitHub Actions (histórico só mostrava execuções manuais) e transferir a checagem diária para Vercel Cron; a primeira execução automática Vercel permanece pendente.
- [x] Mover a agenda diária para Cron da Vercel: `GET /api/health` às 12:15 UTC consulta `finance_workspaces`; remover o cron duplicado do GitHub e manter `workflow_dispatch` manual.
- [x] Publicar em `5a701df`; CI `41693460673` e Vercel `success`. `vercel inspect` mostra Cron `/api/health` com schedule `15 12 * * *`; health de produção 200 com Neon `ok`.
- [x] Conectar o Neon MCP e criar a branch isolada `qa-synthetic-2026-11-03` (`br-round-surf-b6rbhdmk`) a partir da produção; comparar schema sem diferenças.
- [x] Criar compute temporário de QA de 0,25 CU, testar duas atualizações SQL concorrentes em tabela sintética e confirmar valor final `2`; suspender o compute após o teste. Nenhuma tabela financeira foi consultada ou alterada.
- [x] Corrigir proteção SMTP contra SSRF: permitir somente hostname DNS público e portas `25/465/587/2525`, rejeitar DNS misto/privado, fixar IP validado, exigir TLS e aplicar timeout de DNS; documentar que credenciais fornecidas pelo usuário podem integrar o snapshot Neon.
- [x] Revalidar `bun test` (93 testes), `bun run lint` e `bun run build`; todos passaram. O build ainda alerta sobre o bundle principal acima de 500 kB.
- [x] Publicar a proteção SMTP em `5f8f6d2`; CI `41694953882` passou e Vercel ficou `READY`. Smoke pós-deploy: health 200 com Neon `ok`; `/api/reminders/send-email` sem token retornou 401.
- [x] Validar localmente por HTTP as rotas de sincronização `/api/family/shared` e revogação com identidade Firebase simulada e pool Neon simulado. A concorrência da API contra Neon real continua pendente.
- [ ] Validar SMTP autenticado com servidor de teste, sem entrega real de e-mail.
- [ ] Observar a primeira execução automática Vercel após a implantação; Hobby executa uma vez por dia com precisão horária.

## Sessão 2026-11-03 — restore e revisão de retenção
- [x] Consultar o projeto Neon atual: plano `free_v3`, branch production primária, `history_retention_seconds=21600` (6h), sem agenda de snapshots e sem snapshots existentes antes do ensaio.
- [x] Criar snapshot manual somente da branch raiz e restaurá-lo como `qa-restore-branch-2026-11-03` (`br-bold-fog-b6cn368o`), sem promoção; confirmar restore concluído, schema sem diferenças e presença das tabelas operacionais; compute suspenso após leitura.
- [x] Configurar expiração do snapshot temporário para `2026-11-04T22:00:00Z`.
- [x] Testar duas ordens concorrentes na tabela sintética `codex_qa_20261103.family_race_fixture`: sync primeiro seguido de revogação termina sem espelho; revogação primeiro impede criação do espelho.
- [x] Corrigir `DATABASE_DOCUMENTATION.md`, `NEON_MIGRATION.md` e `README.md`: atividade diária ocorre no Vercel Cron; GitHub Actions é manual; janela de seis horas não é backup independente de longo prazo.
- [x] Publicar documentação de restore/PITR em `9715661`; CI `41728982501` passou, Vercel `dpl_FA9yTHsdvyQZgv9j3vvzvjFN3L8k` ficou `READY` e `/api/health` respondeu 200 com Neon `ok`.
- [x] Validar localmente `/api/family/shared` por HTTP com identidade Firebase controlada e pool Neon simulado; cobre middleware/API e upsert/revogação, mas não substitui concorrência real pela API nem navegador autenticado.
- [x] Com autorização explícita do usuário, excluir as duas branches QA; confirmar que só `production` permanece e que health de produção segue 200/Neon `ok`.
- [x] Adicionar teste HTTP local para `/api/family/shared` e revogação: 401 sem token; identidade Firebase controlada alcança a rota, grava espelho e a revogação remove o espelho via pool Neon simulado. O teste comprova integração HTTP/middleware/SQL esperado, não concorrência do banco real.
- [x] Incluir o teste HTTP familiar no CI e executar localmente os testes da aplicação/backend, `bun run lint` e `bun run build`; tudo passou. Build ainda alerta para chunk principal acima de 500 kB.

## Sessão 2026-11-03 — verificação de e-mail no compartilhamento
- [x] Exigir e-mail Firebase verificado antes de qualquer endpoint `/api/family`; teste HTTP local comprova 403 e zero consultas para token não verificado, e acesso normal com identidade verificada.
- [x] Adicionar faixa na interface para contas não verificadas, com reenvio do link e atualização do estado; informar no cadastro que a verificação libera o compartilhamento.
- [x] Revalidar suíte completa (94 testes), lint, build e `git diff --check`; todos passaram. Build ainda mostra aviso de chunk principal acima de 500 kB.
- [x] Publicar em `af97e14`; CI GitHub `success`, Vercel `READY` (`dpl_EsqemzuHuCMko1vvCRmXMtYxC5ZH`); alias de produção entrega a faixa nova e health 200 com Neon `ok`.

## Sessão 2026-11-03 — isolamento de API e agenda Vercel
- [x] Confirmar roles da produção por API Neon e catálogo SQL: `minhas_app` e `minhas_daily` continuam com `BYPASSRLS`, `CREATEROLE`, `CREATEDB`, `REPLICATION` e membership em `neon_superuser`; conexão atual não tem grant/admin para corrigir.
- [x] Auditar persistência: Firestore só é lido no fluxo pontual de importação quando Neon responde workspace ausente; gravações operacionais permanecem no Neon. Queries de workspace e compartilhamento usam UID/email autenticados explicitamente.
- [x] Adicionar teste HTTP para isolamento de workspace entre dois UIDs simulados; dono recebe seu estado e outro UID recebe 404, com UID do chamador ligado aos parâmetros SQL.
- [x] Revalidar suíte completa (95 testes), lint, build e `git diff --check`; passou. Build segue com alerta de chunk principal >500 kB.
- [x] Confirmar no Vercel `crons list` o job de produção `/api/health` em `15 12 * * *` UTC e dispará-lo manualmente em `2026-11-03T22:53:50Z`; a invocação foi aceita. A execução programada de 4/nov 12:15 UTC ainda está no futuro.
- [x] Smoke de produção sem token: workspace, migração, rotas familiares, câmbio, investimentos e lembretes retornam 401; bundle publicado não contém Guia Rápido nem `tx-demo`; health responde 200/Neon `ok`.
- [x] Publicar teste/documentação em `025b18b`; GitHub CI `success`, Vercel `dpl_FzMQzZLf3RkVes1PjScumzt2JpAx` `READY`, homepage/health e bundle de produção verificados depois da publicação.
- [x] Corrigir privilégios das roles Neon com acesso que possa administrar membership/attributes; os papéis runtime foram criados e as credenciais antigas elevadas removidas em sessão posterior, sem upgrade de plano.
- [x] Fazer backup/dump portátil e restore independente de fixture sintética em branch QA; isso não substitui backup completo de produção nem restauração integral da aplicação.
- [ ] Confirmar a primeira execução automática do cron depois de 4/nov 12:15 UTC.
- [ ] Concluir revisão visual desktop/mobile e ações autenticadas que gravam dados; a sessão BrowserOS carregou autenticada, mas screenshot e teste mobile não foram possíveis.

## Sessão 2026-11-03 — inspeção no BrowserOS
- [x] Confirmar que o deploy documental `adf3897` terminou em Vercel `READY` e o status GitHub Vercel ficou `success`; `vercel crons list` continua mostrando `/api/health` em `15 12 * * *`.
- [x] Abrir o site no BrowserOS com sessão autenticada; confirmar a Visão Geral, workspace sem contas/cartões/lançamentos e ausência de indicador de sincronização pendente após carregar.
- [x] Abrir e fechar o formulário de novo lançamento; alternar Despesa, Cartão, Receita e Transferência; conferir labels, datas, seleção de categoria/cartão e mudança dos campos sem submeter/gravar.
- [x] Navegar pelos módulos Lançamentos, Contas, Cartões, Orçamentos, Viagens, Compartilhado, Investimentos, Metas e Relatórios; os controles e estados DOM correspondentes foram carregados sem erro de navegação.
- [ ] Capturar revisão visual desktop/mobile: BrowserOS screenshot foi negado por permissão `activeTab`/`<all_urls>` e não há leitura pixel-level disponível; a fonte mostra modal responsivo `max-w-2xl` com regras `sm:`/`lg:`, mas isso não prova layout mobile renderizado.
- [ ] Confirmar a execução cron automática prevista para `2026-11-04T12:15:00Z`; a chamada manual foi aceita em 3/nov.

## Sessão 2026-11-03 — correção do cadastro do primeiro cartão
- [x] Reproduzir o cadastro no navegador autenticado: ao salvar o primeiro cartão, a tela quebrava e o workspace Neon permanecia sem cartão.
- [x] Localizar violação da ordem de hooks React: um `useMemo` era executado só depois do retorno de estado vazio. Mover o hook para antes do retorno.
- [x] Adicionar regressão verificando que nenhum hook React é declarado abaixo do retorno antecipado de workspace sem cartão.
- [x] Validar o teste de regressão, `bun run lint` e `bun run build`; sem erros. O aviso do bundle acima de 500 kB segue existente.
- [x] Executar suíte completa (`bun test`: 96 testes), `bun run lint` e `bun run build`; todos passaram localmente.
- [x] Publicar correção no commit `37581c0`; GitHub CI `41737033530` concluiu `success` e Vercel `dpl_HpibZX4zWSTkGBtrN2k665nqe7EC` ficou `READY`, com alias de produção.
- [x] Repetir cadastro com sessão autenticada após recarregar o app atualizado: cartão teste apareceu na interface, sincronizou para Neon (revisão `125`) e foi removido pelo próprio fluxo de exclusão.
- [x] Confirmar na produção UI vazia, status `Nuvem sincronizada` e zero cartões de teste no Neon após a exclusão; console do navegador sem erros.
- [x] Fazer smoke autenticado dos módulos Lançamentos, Contas, Orçamentos, Viagens, Compartilhado, Investimentos, Metas e Relatórios; todos carregaram. Alternar Despesa, Cartão, Receita e Transferência no formulário sem criar lançamento.
- [x] Criar e excluir conta sintética com saldo zero e despesa pendente de R$ 1; o extrato mostrou pendência, a exclusão zerou o previsto e o Neon confirmou ambos ausentes.
- [x] Editar o teto de orçamento temporariamente para R$ 100 e restaurá-lo para R$ 0; criar/excluir meta sintética, viagem sem despesas e ativo de renda fixa sem cotação externa.
- [x] Abrir a central de lembretes, auditoria local (`7/7`), configurações e seção de backup sem alterar preferências nem enviar notificações; auditoria informou API/Neon respondendo e Google Finance disponível, Gemini não configurado.
- [x] Consulta agregada após limpeza confirmou zero resíduos de teste em contas, cartões, lançamentos, metas, investimentos e viagens; console sem erros e nuvem sincronizada.
- [ ] Concluir os fluxos ainda não aceitos no navegador: convite/aceite familiar com segunda conta (dispensado anteriormente), e-mail SMTP de teste, cotações externas, restauração de arquivo e operações completas de FX/rateio. SMTP/Gemini não estão configurados; compartilhar o estado real sem segunda conta permanece indisponível para este teste.
- [ ] Fazer inspeção visual mobile e confirmar cron automático na janela de 4/nov 12:15 UTC; screenshot segue bloqueado no BrowserOS e a primeira janela cron ainda é futura.

## Sessão 2026-11-03 — integridade do workspace
- [x] Consultar somente contagens agregadas da branch Neon production: 3 workspaces, 0 contas e 0 lançamentos no total. A leitura não trouxe valores, nomes ou emails.
- [x] Confirmar com o usuário que todas as contas eram demonstrações; portanto, zero contas/lançamentos é o estado esperado e não se deve restaurar conta Nubank nem saldo.
- [x] Identificar risco no sanitizador: IDs genéricos `acc-nubank`, `acc-itau`, `card-*`, `trip-eurotrip` e FITIDs Nubank eram classificados automaticamente como mock, embora possam ser registros reais; remover esses falsos positivos e adicionar regressões.
- [x] Revalidar testes utilitários/backend, `bun run lint` e `bun run build` após a correção do sanitizador; todos passaram, com aviso de chunk principal >500 kB.
- [x] Publicar a correção do sanitizador em `21df8f7`; CI Vercel `success`, deploy `dpl_HRHcWTH9BucsNwezxR2ZH4RNE8jz` `READY`, health 200/Neon `ok`; bundle servido não contém os filtros `acc-nubank`/`NUBANK-SAL-`.
- [x] Restringir privilégios dos papéis antigos `minhas_app`/`minhas_daily` (elevados): foram substituídos por `minhas_app_runtime`/`minhas_daily_runtime` limitados e removidos após rotação de credenciais. Reconsulta em 4/nov confirma `rolsuper`, `rolcreaterole`, `rolcreatedb`, `rolreplication`, `rolbypassrls` e membership em `neon_superuser` falsos nos papéis atuais.
- [x] Verificar nas quatro tabelas operacionais que RLS está habilitado/forçado e há policy baseada em `app.firebase_uid`; registrar que as roles com `BYPASSRLS` ainda podem contornar essa proteção.

## Sessão 2026-11-03 — regressão geral e backup/câmbio
- [x] Reexecutar `bun test`: 96 testes passaram em 18 arquivos; inclui parser de backup, regras de viagem/câmbio, conversão, VET, rateio e integridade financeira.
- [x] Reexecutar `bun run lint` e `bun run build`; ambos passaram. O build ainda avisa que o chunk principal excede 500 kB.
- [x] Confirmar deploy de produção `dpl_2pj8gvrFdpf2VHnxCnKepTqSCieu` como `Ready`, alias `minhaseconomias-blue.vercel.app`, e endpoint `/api/health` 200 com Neon `ok`.
- [ ] Validar a restauração completa com arquivo sintético pela interface e confirmar persistência/releitura no Neon; os testes existentes validam o parser/regras, não o fluxo UI→estado→API→Neon.
- [ ] Validar visualmente desktop e mobile; captura BrowserOS permanece sem permissão e não houve leitura de pixels/viewport móvel nesta rodada.
- [ ] Confirmar execução cron automática (não manual) após `2026-11-04T12:15:00Z`.
- [x] Conferir o arquivo `.github/workflows/neon-daily-activity.yml` e o histórico GitHub: workflow manual (`workflow_dispatch`) com `SELECT 1`; separar sua execução `41688417355` do Cron diário Vercel, que permanece agendado mas ainda não disparou automaticamente.
- [x] Acrescentar testes HTTP locais de workspace: revisão 2 salva uma vez e avança para 3; segunda gravação concorrente com revisão 2 recebe `409` e não altera a revisão; erro simulado no banco retorna `503` sem avançar revisão.
- [x] Reexecutar suíte completa (`bun test`: 98 testes), lint e build após ampliar os testes; passou. Os mocks não representam uma corrida concorrente ou pane reais no Neon.

## Sessão 2026-11-03 — pane no carregamento inicial e branch QA Neon
- [x] Identificar que uma falha inicial do Neon deixava a UI financeira disponível após 240 ms, sem carregar cache local, e a gravação inicial podia substituir esse cache por estado vazio.
- [x] Bloquear a área do app até o workspace Neon carregar, mostrar erro com botão de nova tentativa e repetir a carga automaticamente quando o navegador voltar a ficar online.
- [x] Proteger o cache local para que somente seja sobrescrito depois da primeira carga bem-sucedida do Neon.
- [x] Acrescentar regressões locais para tela bloqueante, ação de retry, evento `online` e proteção do cache; suíte completa `bun test` passou com 100 testes, lint e build passaram.
- [x] Com autorização do usuário, criar branch QA Neon `br-rough-smoke-b6fhm3lh` a partir de `production`; manter os testes apenas nessa branch.
- [x] Na branch QA, inserir workspace sintético com papel `minhas_app`, gravar transação sintética como restore de payload, avançar revisão de 1 para 2, confirmar gravação obsoleta com revisão 1 sem update e ler payload de volta.
- [x] Disparar duas atualizações Neon reais em paralelo com expectedRevision 2; exatamente uma avançou para revisão 3 e a outra retornou zero linhas, sem sobrescrever o payload restaurado.
- [ ] Simular perda da API no navegador após publicar a correção; confirmar erro bloqueante, tentativa de retry e reabertura do workspace depois de restabelecer a rede.
- [x] Publicar `583d91a` no `main`; Vercel deployment `dpl_DHiUDhgAvLADaGY652nudZdTFcSu` ficou `Ready` e recebeu o alias de produção.
- [x] Recarregar o site na sessão autenticada e confirmar workspace vazio carregado e status “Nuvem sincronizada - Neon PostgreSQL”, sem tela de carregamento bloqueada.
- [x] Excluir a branch QA após os ensaios e listar branches; só `production` permanece.
- [ ] Validar restore UI→API→Neon ponta a ponta; o ensaio atual cobre frontend por regressão local e contrato/revisão do DB por Neon SQL, mas não a integração autenticada browser/API contra a branch.
- [x] Inspecionar DOM/layout renderizado em viewport desktop 1920×921 e móvel 390×844; dashboard e formulário não apresentaram overflow horizontal; no modal, scroller interno de 504 px percorreu 1.293 px até o rodapé, e overlay `z-50` permanece acima da navegação móvel `z-40`.
- [ ] Capturar e revisar imagem pixel-level do desktop/mobile; captura via CDP/BrowserOS expirou, portanto medições DOM não encerram a revisão visual.

## Sessão 2026-11-03 — semântica de restauração de backup
- [x] Identificar que restore de backup antigo sem `familyMembers`, `settings` ou `investmentTargets` mantinha valores do workspace de destino, apesar da confirmação dizer que a restauração substitui o workspace.
- [x] Fazer restore substituir esses campos com defaults seguros; preencher metas de investimento ausentes com o mapa padrão, preservando somente os valores presentes no próprio arquivo.
- [x] Adicionar testes para backups antigos sem campos opcionais e versões atuais com valores presentes/metas parciais.
- [x] Validar `bun test` completo: 102 testes passaram em 19 arquivos; `bun run lint` e `bun run build` passaram. O build mantém aviso de chunk inicial >500 kB.
- [x] Publicar a correção no commit `7b555dc`; GitHub Actions run `41743298046` concluiu `success` e Vercel deploy `dpl_994fFbt4qy1TqQPuXPzYSXBUdDj9` ficou `Ready` com alias de produção.
- [x] Verificar `GET /api/health` em produção: HTTP 200, `status: ok`, `services.neon: ok`; recarregar a sessão autenticada e confirmar workspace sincronizado com Neon.
- [ ] Validar importação/releitura completa UI→API→Neon somente em ambiente isolado.

## Sessão 2026-11-04 — auditoria de privilégios Neon
- [x] Repetir smoke de proteção na produção: sete rotas de workspace, migração, familiar, câmbio, investimentos e e-mail retornaram `401` sem token (`GET`/`POST`, sem payload ou credenciais).
- [x] Procurar URLs `postgres://`/`postgresql://` e nomes de variáveis `DATABASE_URL`/`NEON_DATABASE_URL` no bundle `dist`; zero ocorrências.
- [x] Reconsultar os atributos de `minhas_app` e `minhas_daily` em produção: `rolsuper=false`, porém ambas têm `CREATEROLE`, `CREATEDB`, `REPLICATION` e `BYPASSRLS`, além de membership efetivo/inherited em `neon_superuser`.
- [x] Criar branch temporária QA autorizada e confirmar o modelo de roles: `neon_create_postgres_role` também cria role com privilégios elevados; a membership `neon_superuser` está sem `ADMIN OPTION`.
- [x] Testar remoção na QA: `REVOKE neon_superuser FROM minhas_app` negado; `ALTER ROLE ... NOBYPASSRLS` pelo `neondb_owner` e pela própria role negado. Role restrita criada por SQL não tem senha administrável pelo reset de password do conector e não aceita login pelo conector sem credencial.
- [x] Excluir a branch QA e confirmar que só a branch `production` permanece; nenhuma mudança de role foi feita em produção.
- [x] Resolver a elevação de privilégios das roles e revalidar RLS; em 4/nov, as quatro tabelas `finance_*` estavam com RLS habilitado e forçado, e `minhas_daily_runtime` não tinha grants financeiros.
- [ ] Confirmar a primeira execução automática do Vercel Cron em `2026-11-04T12:15:00Z` ou depois; às `00:03Z` a janela ainda não havia ocorrido.



## Sessão 2026-11-04 — remoção de cartão demonstrativo
- [x] Confirmar com o usuário que o cartão Azul Mastercard era demonstração e estava autorizado apagar.
- [x] Remover o cartão pela interface autenticada de produção, confirmar o diálogo e receber confirmação de remoção de cartão e lançamentos associados.
- [x] Confirmar status “Nuvem sincronizada - Neon PostgreSQL” e consultar contagens agregadas Neon: 0 cartões, 0 contas e 0 lançamentos nas 3 workspaces.
- [ ] Simular indisponibilidade temporária no navegador e comprovar bloqueio, retry e recuperação após a rede voltar; a sessão Brave autenticada foi acessada, mas essa pane/retry não foi ensaiada no navegador.

## Sessão 2026-11-04 — contrato HTTP de restauração
- [x] Estender o backend de teste para persistir o payload aceito pelo `PUT /api/workspace` e relê-lo pelo `GET`, cobrindo todas as coleções e campos opcionais de um backup completo.
- [x] Reexecutar `bun test`: 103 testes passaram em 19 arquivos; inclui novo ciclo HTTP PUT→GET com identidade Firebase simulada e banco mock. Isso valida o contrato/middleware da API, não interface real nem Neon.
- [x] `bun run lint` passou; `bun run build` passou (chunk inicial 566 kB, aviso conhecido).
- [x] Revalidar produção: `/api/health` retornou 200/Neon `ok`; Vercel lista `/api/health` em `15 12 * * *`. Às 00:14 UTC a invocação automática de hoje ainda era futura.
- [ ] Fazer restore UI→API→Neon em ambiente isolado com Firebase Auth real; Brave autenticado está disponível, mas não foi ligado a uma branch Neon isolada para evitar escrita/restauração em produção.
- [x] Publicar teste e documentação em `8145fe2`; CI Vercel `success`, deploy `dpl_4Z8zzFdJG3h7PHgmaNyK2qCfCAvw` `Ready` com alias de produção; health posterior 200/Neon `ok`.

## Sessão 2026-11-04 — smoke da publicação atual
- [x] Conferir homepage de produção HTTP 200 e bundle servido sem “Guia Rápido de Ativação”, marcador `tx-demo` ou URL/nomes de conexão PostgreSQL/Neon.
- [x] Repetir smoke sem credenciais: workspace, migração, convites, compartilhamento, FX, cotações e lembretes responderam `401`.
- [x] Confirmar que o deploy corrente `dpl_HsfSYcqrz4qU3hbUyJDZWetVWFPt` está `Ready`; `/api/health` continuou 200/Neon `ok`.
- [ ] Validar fluxo autenticado navegador→API→Neon com arquivo sintético em branch isolada; Brave de produção foi usado somente para leitura e validação de formulário, sem alterar workspace.

## Sessão 2026-11-04 — onboarding Neon e importação legada
- [x] Cobrir `POST /api/workspace`: cria o workspace ausente com revisão 1 e rejeita uma segunda criação com 409 sem substituir o payload existente.
- [x] Cobrir `POST /api/workspace/migrate`: importa snapshot legado uma vez, registra data de origem, SHA-256 de 64 caracteres e contagens de entidades; tentativa duplicada recebe 409 e preserva o workspace e o único registro de migração.
- [x] Reexecutar `bun test`: 105 testes passaram em 19 arquivos; `bun run lint` passou. As novas rotas usam identidade Firebase simulada e pool Neon mock, sem alterar Firestore ou Neon remoto.

## Sessão 2026-11-04 — corrida HTTP simultânea de workspace
- [x] Substituir o teste sequencial por duas requisições autenticadas `PUT /api/workspace` disparadas em `Promise.all`, ambas com `expectedRevision=2` e payloads distintos; exatamente uma retorna 200 e outra 409, revisão final 3.
- [x] Reexecutar `bun test`: 105 testes passaram em 19 arquivos; `bun run lint` passou. O pool Neon permanece mock; concorrência HTTP real contra Neon continua pendente.

## Sessão 2026-11-04 — validação negativa da migração
- [x] Cobrir migração sem token (401), payload inválido (400) e `sourceUpdatedAt` inválido (400); o mock confirma zero consultas SQL em todas as entradas rejeitadas.
- [x] Reexecutar suíte integral: 106 testes passaram em 19 arquivos; `bun run lint` passou. As validações são da API local com Identity Toolkit/Neon simulados.

## Sessão 2026-11-04 — limpeza de convites e testes HTTP
- [x] Com autorização explícita, remover do Neon os 3 convites familiares de demonstração; confirmar contagem agregada final zero.
- [x] Confirmar zero lançamentos compartilhados, somente branch `production` e health de produção 200/Neon `ok`.
- [x] Registrar cobertura HTTP local para roundtrip do backup, criação/importação idempotentes, rejeição de migração inválida sem SQL e conflito de duas gravações concorrentes; `bun test`: 106 passaram em 19 arquivos, `bun run lint` passou.
- [ ] Confirmar execução automática do Cron depois de `2026-11-04T12:15:00Z`; a hora ainda é futura e checks manuais não contam.
- [ ] Aceitar restore/importação UI→API→Neon autenticados com Firebase real, recuperação pela UI, backup/restore completo e inspeção pixel-level. A identidade derivada de email foi corrigida no commit `9429eaa` e migration 005 aplicada em produção. Compartilhamento com duas contas foi dispensado; SMTP/Gemini permanecem sem configuração.

## Continuação — 2026-11-04 00:37 UTC
- [x] Reexecutar a suíte completa: `bun test` — 106 passaram em 19 arquivos; `bun run lint` e `bun run build` passaram. O build informa chunk inicial 566 kB, 167 kB gzip.
- [x] Confirmar que o deploy docs `dpl_FE6ys2bk2cFe8LhPMEL5mwJdyCPb` está Ready com alias de produção; health depois do deploy retornou 200/Neon ok.

## Continuação — auditoria da persistência e autosuspend
- [x] Busca estática em `src`/`backend` confirmou que o Firestore é referenciado somente no módulo de leitura legada para migração; sem `onSnapshot`, `setDoc`, `updateDoc`, `addDoc` ou `deleteDoc` no fluxo atual.
- [x] Conferir semântica do endpoint Neon: `suspend_timeout_seconds: 0` usa padrão de 300 segundos; no plano Free o autosuspend não pode ser desativado. A rotina diária dá atividade diária, não mantém compute ligado 24h.
- [ ] Verificar o primeiro disparo automático do Cron em `2026-11-04T12:15:00Z` ou depois.

## Continuação — smoke de produção
- [x] Após o deploy Ready, confirmar homepage 200, health 200/Neon ok e seis endpoints protegidos respondendo 401 sem token.
- [x] Conferir bundle principal de produção: Guia Rápido ausente, sem marcador `tx-demo` e sem URL PostgreSQL.

## Sessão 2026-11-04 — roles limitadas Neon
- [x] Consultar documentação oficial Neon: roles criadas por Console/API herdam `neon_superuser`; roles com privilégios mínimos devem ser criadas via SQL.
- [x] Adicionar `db/migrations/004_restricted_runtime_roles.sql`: role de app com DML necessário por tabela e role da rotina diária com CONNECT apenas; ambas NOLOGIN e sem permissões administrativas.
- [x] Aplicar bloco DO e GRANTs equivalentes em branch QA; verificar atributos e permissões efetivas.
- [x] Conectar via cliente `pg` como role SQL restrita em QA; confirmar RLS (1 linha própria visível, update próprio 1, estrangeiro 0) e inserção do recibo de migração; rollback da transação.
- [x] Remover branch QA; Neon lista somente `production`.
- [x] Com delegação explícita de decisão do usuário, ativar `minhas_app_runtime` e `minhas_daily_runtime` em produção, atualizar Vercel `DATABASE_URL` e GitHub `NEON_DATABASE_URL`, validar as conexões e remover via gerenciamento Neon as roles elevadas antigas `minhas_app` e `minhas_daily`. O SQL `ALTER ROLE ... NOLOGIN` foi negado; consulta prévia confirmou que os papéis não possuíam objetos de banco.
- [x] Publicar a migração e documentação no commit `08337df`; Vercel Ready (`dpl_AWTr5384tMr9W2cJDgt4XPPQnA2s`), CI success, health 200/Neon ok.
- [x] Validar `minhas_app_runtime` por conexão PostgreSQL direta e pelo health de produção; validar a role diária por conexão direta e execução Actions `41752365265` (`success`). As credenciais antigas `minhas_app`/`minhas_daily` falharam após rotação e os papéis foram removidos.
- [x] Confirmar após a troca homepage em produção e health HTTP 200/Neon `ok`; sete rotas protegidas retornaram 401 sem token. CI do commit `5674d66` passou em `41751616349`; deploy `dpl_FDc4SDYbLjH1rULCwFWNBoMF1aNM` Ready.

## Continuação — fluxo de convites familiares
- [x] Expandir o teste HTTP local para criação/listagem de convite, normalização de e-mail, recusa de auto convite, bloqueio sem autenticação/e-mail verificado, rejeição por identidade errada, ação inválida, aceitação e revogação com limpeza das transações compartilhadas.
- [x] Validar `bun test backend/familyApi.test.ts`: 8 testes passaram; suíte completa: 106 testes em 19 arquivos; `bun run lint` e `bun run build` passaram. A API usa Firebase simulado e Neon mockado; isso não comprova aceitação real entre duas contas.
- [x] Registrar que o usuário dispensou a validação do fluxo autenticado com duas contas reais; não fazer convite de teste com uma segunda conta.

## Continuação — validação das roles em produção
- [x] Confirmar por conexão real que `minhas_app_runtime` tem apenas os grants operacionais previstos (sem DELETE em workspaces, CREATE de schema/database ou bypass RLS) e que `minhas_daily_runtime` pode conectar sem ler workspaces.
- [x] Revalidar homepage 200, health de produção 200/Neon `ok` e as sete rotas protegidas retornando 401; deploy após troca de credenciais `dpl_4JfcUPPqqRoruvYq8RswM4a2ujwJ` ficou Ready.
- [x] Confirmar CI do commit docs `2636a3a` passou em `41753080216` e conferir que o worktree está sincronizado com `origin/main`.
- [x] Após remover os papéis antigos, confirmar que a lista Neon contém somente `neondb_owner` e as duas roles limitadas; health de produção segue ok e Actions `41753214075` passou usando a role diária.
- [ ] Aguardar a primeira execução automática Vercel. No plano Hobby, a invocação pode ocorrer em qualquer minuto dentro da hora agendada; conferir depois de `2026-11-04T13:15:00Z` (janela `12:15–13:14:59Z`), não apenas logo após `12:15Z`.

## Sessão 2026-11-04 — E2E HTTP com Neon isolado
- [x] Criar branch Neon QA `qa-api-neon-live-20261104` (`br-summer-feather-b60nenis`) e endpoint temporário, sem alterar produção.
- [x] Executar a API real com identidade Firebase sintética e conexão `minhas_app_runtime` à branch Neon: criar workspace (201), rejeitar duplicata (409), ler payload restaurado com cartão e lançamento sintéticos.
- [x] Disparar dois PUT simultâneos com a mesma revisão: exatamente um 200 e um 409; revisão final avançou uma vez.
- [x] Confirmar isolamento de UID: outra identidade recebe 404 para workspace alheio.
- [x] Exercitar migração legada: primeira importação 201, repetição 409, recibo único com contagem correta.
- [x] Exercitar convite familiar em QA: criação 201, identidade incorreta 404, aceite 200, compartilhamento idempotente e revogação remove o espelho.
- [x] Remover a branch QA e confirmar que só `production` permanece; health de produção HTTP 200 com Neon `ok` após a limpeza.
- [x] Disparar manualmente o Cron `/api/health` às `2026-11-04T15:54:53Z`; Vercel registrou HTTP 200. Esta chamada valida o endpoint, não a execução automática.
- [ ] Confirmar execução automática: após a janela `12:15–13:14:59Z`, logs acessíveis não mostraram uma requisição Cron conclusiva; o `updated_at` da branch produção em `13:14:50Z` é indício, não prova. Logs de query Neon não estão disponíveis na região `aws-sa-east-1`.
- [ ] Validar restore UI→API→Neon com Firebase real, recuperação pela UI e revisão visual pixel-level; E2E desta sessão usou token sintético e API direta. Dump/restore de fixture sintética e API recovery de pane estão validados em QA. Agentes concluíram auditorias de API/segurança, responsividade e backup/recovery; detalhes e limites estão no HANDOFF.
- [x] Publicar esta atualização documental no commit 2419d58; deploy dpl_2eAPNAa3egP5o9XD6XbJonpFXv9c ficou Ready e health de produção em 15:59:38Z retornou 200/Neon ok. CI 41862988415 ainda estava queued na última consulta.

## Continuação — cobertura CI e suíte completa (2026-11-04)
- [x] Identificar que o CI anterior executava apenas `src/utils/*.test.ts` via tsx e `backend/familyApi.test.ts`, deixando fora outros testes backend e componente.
- [x] Rodar `bun test`: 106 passaram em 19 arquivos; `bun run lint` passou; `bun run build` passou e gerou PWA com 77 arquivos precache. Permanece aviso de chunk inicial 566 kB (167 kB gzip).
- [x] Adicionar script padronizado `bun run test` e atualizar `.github/workflows/ci.yml` para executar a suíte completa de 106 testes.
- [x] Limitar o token do workflow CI a `contents: read`; checkout e execução dos testes/build não precisam de grants de escrita.
- [x] Reauditar infraestrutura em produção: CSP sem `unsafe-inline` em script-src, HSTS 2 anos com includeSubDomains/preload, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, API `no-store`, assets imutáveis; env Vercel contém apenas os nomes esperados sem expor valores.
- [x] Validar o novo CI com workflow completo após publicação; após a run `41864165636` ficar sem runner, os runs completos `41870527840`, `41871401082` e `41872738808` concluíram com sucesso.
- [x] Revalidar produção no commit `feda1f6`: deploy `dpl_E2NUvo2h4xLkBphCHgDoyX3yTayu` Ready, health em `16:08:58Z` HTTP 200/Neon `ok`, Cron continua cadastrado diariamente.
- [ ] Confirmar execução automática do Cron na próxima janela, 5/nov entre `12:15–13:14:59Z` UTC; execução manual e timestamp de atualização não são evidência conclusiva.
- [x] Publicar atualização de status no commit `da116d1`; Vercel deployment `dpl_4Xs5g3EmYT8y8BEpNemCCGrHDpug` ficou Ready e o health após deploy respondeu 200/Neon `ok`. CI `41864691411` segue na fila por incidente Actions/Páginas do GitHub.

## Continuação — dump/restore PostgreSQL isolado (2026-11-04)
- [x] Usar pacote oficial EDB PostgreSQL 18.6 com SHA-256 conferido; manter cliente e arquivo no TEMP para remoção ao final.
- [x] Criar branch Neon QA `qa-portable-restore-20261104` e schema isolado `qa_portable_restore` com fixture financeiro sintético; nenhum dado da tabela pública foi exportado.
- [x] Gerar arquivo PostgreSQL custom (4036 bytes), verificar TOC restrito ao schema sintético e executar `pg_restore --clean --if-exists` na branch QA.
- [x] Confirmar após restore duas linhas, soma de valor `42.75` e array JSON reconstituído; nenhum dado de produção foi alterado.
- [x] Remover a branch e artefatos binários/dump temporários; Neon lista apenas `production`; health de produção HTTP 200/Neon `ok` após o ensaio.
- [ ] Executar restore de backup completo da aplicação pela UI, autenticado com Firebase real; o dump/restore independente validado cobre somente fixture sintética isolada.
- [ ] Acompanhar conclusão dos checks remotos e repetir smoke do Cron automático na janela de 5/nov `12:15–13:14:59Z` UTC.

## Continuação — recuperação da API após pane Neon (2026-11-04)
- [x] Em branch Neon QA isolada e com workspace sintético, desativar temporariamente o endpoint de teste; `/api/health`, leitura e gravação da API retornaram 503 e Neon `error`.
- [x] Reativar o endpoint QA; sem reiniciar a API local, health e leitura retornaram 200/Neon `ok`, revisão permaneceu 1 e o payload-fixture persistiu. Isso comprova recuperação da API→Neon no servidor, não o retry da interface no navegador.
- [x] Encerrar o processo e excluir a branch QA; Neon lista somente `production`; health de produção às `16:24:45Z` retornou HTTP 200/Neon `ok`.
- [x] Incorporar auditorias dos três agentes: cobertura de layout responsivo por código e medidas DOM, sem aprovação visual pixel-level; backup sintético restaurado com 2 registros e soma `42.75`, sem validação de restore completo; identificado risco da chave por e-mail, sem evidência de leitura cruzada entre UIDs.
- [x] Confirmar CI do commit `debb613`: job completo executou suíte Bun, typecheck e build com sucesso nos runs `41864938058` e `41866144940`; o status global dos runs ainda aguardava checks da integração no momento desta atualização.
- [x] Corrigir a identidade localmente e validar em QA troca de e-mail, colisão, concorrência e importação; ainda falta publicar código e aplicar a migration aprovada no Neon de produção.
- [ ] Completar restore UI→API→Neon autenticado, retry/reabertura pela UI, backup completo, revisão visual pixel-level e prova de Cron automático.

## Sessão 2026-11-04 — identidade estável do workspace
- [x] Usar o UID Firebase para a chave do workspace Neon e do cache; conservar a chave derivada do e-mail exclusivamente para procurar snapshots Firestore legados.
- [x] Normalizar `payload.uid` no backend a partir do token Firebase verificado, sem confiar no ID enviado pelo cliente; resolver leitura/gravação/migração por UID autenticado.
- [x] Adicionar testes para troca de e-mail mantendo a mesma identidade, colisão entre slugs de e-mail, payloads/backs legados e limites de UID; suíte completa `bun run test`: 110 testes passaram em 20 arquivos; lint e build passaram.
- [x] Preparar a migration 005 em branch Neon temporária e validar a transformação: 3 workspaces/3 titulares, zero chaves não migradas, zero recibos duplicados ou stale; branch também passou no E2E API com role `minhas_app_runtime` (troca de e-mail, isolamento de UIDs, colisão, corrida de criação, importação legada write-once).
- [x] Aplicar migration 005 em produção após autorização explícita do usuário; Neon confirmou aplicação bem-sucedida e remoção da branch QA `br-ancient-smoke-b6ayrslh`.
- [x] Publicar código em `main`: `9429eaa` e correção runtime `c6fd0ba`; CI `41870527840` concluiu `success`.
- [x] Confirmar Vercel deployment `dpl_5yz4pXwgBzHAsGL9ua4yKQ2S4E6D` como Ready, alias de produção ativo e `/api/health` HTTP 200/Neon `ok` depois da correção do import ESM.
- [ ] Executar restore UI→API→Neon com Firebase real, retry visual, inspeção pixel-level e observar o Cron automático.

## Continuação — verificação do deploy de identidade (2026-11-04)
- [x] Corrigir a regressão do primeiro deploy: o import sem extensão do módulo compartilhado falhava no runtime ESM Vercel e causava HTTP 500; publicar `c6fd0ba` com import `.ts`.
- [x] Confirmar novo deploy `dpl_5yz4pXwgBzHAsGL9ua4yKQ2S4E6D` Ready, alias `minhaseconomias-blue.vercel.app`, health HTTP 200 e CI success.
- [x] Confirmar antes da aplicação que a branch Neon `br-ancient-smoke-b6ayrslh` era isolada e filha de `production`, e que os testes sintéticos ficaram restritos a QA.
- [x] Aplicar a migration 005 aprovada e remover a branch QA no mesmo fluxo; Neon lista somente a branch `production`.
- [x] Verificar pós-migration por agregados: 3 workspaces, 3 UIDs canônicos, 0 IDs legados; 3 recibos canônicos, 0 órfãos e índice único de titular presente.
- [x] Confirmar `/api/health` de produção HTTP 200/Neon ok após a migration e Cron diário `/api/health` cadastrado para `15 12 * * *` UTC.
- [ ] Confirmar a execução Cron automática na janela de 5/nov, `12:15–13:14:59Z`; o agendamento ativo não comprova que a execução ocorreu.

## Sessão 2026-11-04 — smoke autenticado pós-migration
- [x] Abrir o site de produção na sessão Brave já autenticada e confirmar que o workspace carrega após a migration, com indicador “Nuvem sincronizada — Neon PostgreSQL”.
- [x] Navegar pelos módulos Cartões e Lançamentos; abrir os formulários de cartão e lançamento e validar que submissões vazias são bloqueadas com erro de campo obrigatório.
- [x] Alternar os modos Despesa, Cartão, Receita e Transferência/Fatura no formulário; campos e opções específicos de cada modo apareceram. Nenhum dado foi submetido ou alterado em produção.
- [ ] Validar restore completo UI→API→Neon com fixture em ambiente isolado; não importar arquivo que substitua workspace de produção.
- [ ] Revisar screenshot pixel-level e responsividade em viewport desktop/mobile depois de obter controle de viewport apropriado.

## Continuação — aviso TLS do driver Postgres (2026-11-04)
- [x] Inspecionar logs recentes de produção e localizar aviso do `pg-connection-string`: `prefer`, `require` e `verify-ca` hoje equivalem a `verify-full`, mas a semântica mudará na próxima versão principal.
- [x] Tornar `sslmode=verify-full` explícito no pool sem ler ou alterar o segredo `DATABASE_URL`; preservar o comportamento de `uselibpqcompat=true` e modos fora da lista afetada.
- [x] Adicionar 2 regressões de conexão SSL; `bun run test` passou com 112 testes em 21 arquivos, `bun run lint` e `bun run build` passaram.
- [x] Publicar a correção SSL no commit `9ccf0ff`; CI `41872738808` passou e Vercel `dpl_StTtu5jQonDym6sQqzDZif8w6pbv` ficou Ready. Após deploy, `/api/health` respondeu 200/Neon ok e o log da rota não registrou o aviso TLS.

## Revalidação de privilégios em produção (2026-11-04)
- [x] Conferir em `pg_roles` que `minhas_app_runtime` e `minhas_daily_runtime` não são superuser, não podem criar roles/databases, não têm REPLICATION/BYPASSRLS e não pertencem a `neon_superuser`.
- [x] Confirmar que as 4 tabelas `finance_*` estão com RLS habilitado e forçado.
- [x] Conferir grants das tabelas: role diária não pode ler/escrever dados financeiros; role app tem apenas os grants operacionais, sem DELETE em workspaces/invitations/migration receipts.
- [x] Publicar a reconciliação do checklist/handoff no commit `0a5f46c`; CI `41873185968` success, Vercel `dpl_6KgS2nu2n5d16VWqt97G6uUfFZgh` Ready, health de produção HTTP 200/Neon ok.
- [x] Atualizar o handoff/checklist com a revalidação final em `4c47266`; CI `41873897405` success, Vercel `dpl_Efr8rjnResNzusKer8a3NP7ZNGLb` Ready, homepage 200, health 200/Neon ok e rota workspace sem token 401.

## Conferência de dados após limpeza (2026-11-04)
- [x] Consultas agregadas na branch `production` confirmaram que os 3 workspaces têm zero contas, cartões, lançamentos, metas, investimentos e viagens; convites familiares e transações compartilhadas também estão zerados.
- [x] A consulta não leu valores financeiros, emails, nomes ou payloads pessoais; o Neon contém somente a branch `production`.

## Continuação da auditoria abrangente (2026-11-04)
- [x] Reexecutar a suíte atual: `bun run test` passou (112 testes em 21 arquivos), `bun run lint` passou e `bun run build` passou; permanece aviso de chunk inicial 566 kB (~168 kB gzip).
- [x] Confirmar CI `41874968462` do `e08b379` e `41875339400` do `30fb1b0` em sucesso; deployments sequenciais ficaram `Ready`; smoke do alias principal retornou health 200/Neon ok e workspace sem token 401.
- [x] Observar a sessão autenticada em desktop: status Neon sincronizado, workspace vazio e navegação acessível; sem escrever dados em produção. O screenshot foi conferido em viewport desktop, sem teste mobile.
- [x] Auditar a cobertura dos testes: API com Express e token Firebase simulado/Pool simulado cobre concorrência, 503, isolamento e restore HTTP, mas não comprova UI→Vercel→Postgres real. A suíte cobre validação de backup, não a restauração completa pelo navegador.
- [ ] Completar restore UI→API→Postgres com fixture numa branch isolada, sem modificar dados de produção.
- [ ] Fazer inspeção de viewport mobile/screenshot e testes visuais de fluxos desktop/mobile.
- [ ] Aguardar e comprovar a execução automática do Cron em `2026-11-05 12:15 UTC` (janela até `13:14:59 UTC`).

## Correção identificada na auditoria de backup (2026-11-04)
- [x] Em código, o botão de Relatórios foi ligado ao exportador completo versionado (versão 5), em vez do JSON parcial que o restaurador não aceitava.
- [x] Reexecutar após a alteração: 112/112 testes, lint e build passaram; build ainda reporta chunk inicial ~566 kB (~168 kB gzip).
- [x] Publicar `734c6ed` em `main`; CI `41875825794` success e Vercel `dpl_C3tkx84DT3ifGKMHD8kfMGEpwNRB` Ready.
- [x] Baixar o backup no navegador autenticado e confirmar versão 5, 12 campos esperados e zero campos ausentes; não importar nem substituir dados de produção.
- [x] Avaliar Relatórios em viewport 390×844: largura documental 390px, sem overflow horizontal; screenshot revisto. Outros módulos e fluxos mobile ainda precisam de cobertura.
- [x] Detectar, sem ler nomes/emails, que o payload contém 2 `familyMembers` aceitos cujos convites correspondentes foram excluídos como demonstração.
- [x] Publicar o tratamento de 404 ao remover convite órfão no commit `71c0fdc`, com deployment Production `Ready`.
- [x] Remover pela interface os 2 vínculos órfãos da conta aberta e aguardar “Nuvem sincronizada”; consulta agregada identifica 3 vínculos em outros 2 workspaces: 2 com `invitationId` órfão e 1 sem invitationId.
- [ ] Completar restore UI→API→Neon com fixture numa branch isolada, sem substituir dados de produção.

## Restore API→Neon em branch isolada (2026-11-04)
- [x] Criar a branch descartável `qa-restore-e2e-2026-11-04` a partir de `production`; backend local usou `minhas_app_runtime` e credencial apontada somente à branch QA.
- [x] Executar contra o backend real: workspace ausente (404), criação inicial (201), gravação de fixture de restauração (200) e releitura (200), revisão 2; UID foi canonicalizado para `vault_uid_<Firebase UID>`.
- [x] Consultar agregados na branch QA: 1 workspace de teste, 1 categoria, revisão 2 e marcador de restauração; nenhum valor financeiro foi lido.
- [x] Confirmar que o UID sintético tem zero linhas em `production`, e que os 3 workspaces de produção continuam sem contas, cartões e lançamentos.
- [x] Excluir a branch QA e confirmar que Neon voltou a listar somente `production`; apagar também os arquivos e variáveis locais temporários.
- [ ] A interface de restauração ainda não foi exercitada ponta a ponta: após autorização temporária de `localhost`, o app abriu o seletor Google, mas a interação do navegador não selecionou uma conta. Nenhuma escrita ocorreu em produção; Firebase foi restaurado à lista original de domínios e a branch QA foi removida.
- [x] Confirmar CI do commit documental mais recente `e185fa6`: run `41884363305` concluído com sucesso em 2026-11-04 18:09 UTC.

## CRUD real pela interface autenticada (2026-11-04)
- [x] Criar pela interface o cartão temporário `QA Cartão Temporário 20261104`; estado sincronizado, recarga confirmou persistência, e exclusão seguida de recarga voltou ao estado sem cartões.
- [x] Criar conta temporária e despesa sintética pela interface; status Neon sincronizado, recarga confirmou a despesa; excluir a despesa e a conta pela interface.
- [x] Criar meta temporária, recarregar para confirmar persistência, excluir e aguardar sincronização.
- [x] Atualizar o teto de “Moradia & Condomínio”, recarregar e confirmar persistência; restaurar o teto para R$ 0,00 e aguardar sincronização.
- [x] Criar viagem temporária, recarregar para confirmar persistência, excluir e aguardar sincronização.
- [x] Criar ativo de investimento sintético com valores mínimos, recarregar para confirmar persistência, excluir e aguardar sincronização; não executar sincronização externa de cotações.
- [x] Consulta agregada final no Neon confirmou, nos 3 workspaces de produção, zero contas, cartões, lançamentos, metas, investimentos e viagens; zero linha do identificador de cartão QA.
- [x] A mesma UI de produção exibiu estado vazio após recarga, sem o cartão/conta de QA, e status “Nuvem sincronizada”.
- [ ] Compartilhado e Relatórios não tiveram CRUD completo nesta continuação; o inventário encontrou quase nenhum teste React/Browser, sem Playwright/Cypress configurado. O erro de cartão relatado não se reproduziu no create→reload→delete desta sessão.
- [ ] Os outros 3 links demo não pertencem à identidade autenticada; API/UI restringe mutações ao UID do titular. Não há segundo login fornecido, e nenhuma alteração administrativa privilegiada foi feita.
- [ ] Corrigir registro antigo do CI: `41877421967` terminou em sucesso após a consulta de 17:40 UTC; o CI do commit documental `fab6de6` é `41879557461`, com lint/testes/build completos e sucesso, aguardando conclusão final do workflow na última consulta.

## Tentativa de restore autenticado em localhost (2026-11-04)
- [x] Com aprovação específica, autorizar temporariamente `localhost` em Firebase Authentication para ensaio local; a aplicação abriu o seletor Google.
- [x] Confirmar que não foi possível selecionar uma conta pela automação do navegador; não usar credenciais alternativas nem criar dados de produção.
- [x] Remover `localhost` após a tentativa e verificar que `minhaseconomias-blue.vercel.app` permaneceu autorizado.
- [x] Criar e excluir a branch temporária `qa-restore-auth-2026-11-04`; Neon voltou a listar somente `production`.
- [x] Encerrar o servidor local e remover `.env` de QA; não houve gravação de fixture.
- [ ] Retomar o restore completo com uma sessão autenticada controlável em preview/localhost autorizado; comprovar payload sintético no Neon e limpar depois.

## Revalidação local e infraestrutura (2026-11-04)
- [x] `bun test`: 112 testes aprovados, 0 falhas, em 21 arquivos.
- [x] `bun run lint` (`tsc --noEmit`) concluiu sem erros.
- [x] `bun run build` concluiu; registrar aviso existente de chunk JS inicial de 566,35 kB (~167,56 kB gzip).
- [x] Deployment de produção correspondente ao commit `e185fa6` aparece Ready na Vercel; endpoint `/api/health` retornou HTTP 200 e Neon `ok` em 18:10 UTC.
- [x] `vercel crons list` confirmou `/api/health` habilitado diariamente às 12:15 UTC, sem jobs undeployed. Uma chamada direta ao endpoint em 18:10 UTC respondeu Neon `ok`; isso não é evidência de execução pelo agendador.
- [x] Distinguir o workflow GitHub `.github/workflows/neon-daily-activity.yml`: ele só tem `workflow_dispatch` e não é o agendamento diário.
- [ ] Confirmar a execução automática do Vercel Cron após deploy; a chamada direta ao health endpoint não substitui essa evidência.
- [ ] Revisar operações de edição, exclusão em cascata e layouts dos dez módulos em desktop/mobile; os smokes de CRUD anteriores foram pontuais, não cobertura exaustiva.

## Continuação 2026-11-04 — limpeza e tentativa Neo Lite
- [x] Com autorização anterior do usuário, limpar 3 referências familiares de demonstração órfãs em dois workspaces de produção; consulta agregada pós-limpeza confirmou zero dados operacionais e familiares nos 3 workspaces.
- [x] Abrir a aplicação local pelo Neo Lite e confirmar que a tela de login carregou usando branch Neon QA isolada; branch removida ao terminar.
- [ ] Login local ficou preso em “Autenticando...” e o fluxo de restore UI→API→Neon não foi executado.
- [ ] Remover a autorização temporária `localhost` no Firebase; ela ainda estava presente ao encerrar a automação do Neo Lite.
- [x] Remover `.env` temporário de QA após a tentativa; branch Neon correspondente já removida.

## Retomada — 2026-11-04
- [x] Remover a autorização temporária `localhost` no Firebase; UI confirmou remoção e o domínio Vercel permaneceu autorizado.
- [x] Remover a branch QA descartável `qa-restore-ui-2026-11-04`; Neon QA não ficou ativa.
- [x] Interromper OAuth que abriu uma conta que exigia senha; nenhuma senha, código ou credencial foi inserida.
- [ ] Restore UI→API→Neon aguarda autenticação do titular do workspace, feita pelo usuário no popup.
# Sessão 2026-11-06 — autenticação e integridade financeira
- [x] Remover fluxo de login Google da UI e do cliente, mantendo Firebase Auth por e-mail/senha.
- [x] Corrigir totalização/liquidação de fatura, validação de pagamentos parciais, rateios e arredondamento monetário.
- [x] Validar UI de login local: formulário de e-mail/senha, sem botão Google.
- [x] Executar `bun test`: 116 testes em 21 arquivos, todos aprovados; `bun run lint` e `bun run build` aprovados (aviso de bundle >500 kB).
- [x] Excluir branch Neon QA `qa-restore-ui-retry-2026-11-06`, mantendo a branch de produção.
- [x] Remover `.env` local de QA sem revelar seu conteúdo.
- [ ] Validar cadastro/login real com Firebase e restore UI→API→Neon em branch QA.
- [ ] Confirmar execução automática do Vercel Cron; logs de 24 h não mostram a chamada agendada.
- [ ] Confirmar execução do workflow GitHub diário `schedule` às 12:23 UTC e concluir cobertura funcional/visual dos módulos restantes.
- [x] Publicar commit `166f9a0` em `main`; CI `42274441778` passou, deploy Vercel ficou Ready, health Neon `ok` e UI de produção mostra login por e-mail/senha.
# Backup PostgreSQL cifrado em GitHub Actions (2026-11-07)
- [x] Manter o repositório público e configurar somente artifacts age cifrados com retenção de 30 dias; nunca enviar dump aberto.
- [x] Configurar a role `minhas_backup_reader` em production com leitura de tabelas/sequências e `BYPASSRLS`, sem `SUPERUSER`, escrita, `CREATEROLE`, `CREATEDB` ou `REPLICATION`.
- [x] Substituir `NEON_BACKUP_DATABASE_URL` no GitHub por URL direta da role de produção (sem pooler).
- [x] Rodar backup manual de production: Actions `42320784685` concluiu com sucesso e publicou artifact cifrado até 2026-12-07.
- [x] Descriptografar cópia local, verificar catálogo com `pg_restore --list`, restaurar em QA com transação única e confirmar contagens agregadas iguais: 4 workspaces, 0 convites, 0 transações compartilhadas, 5 objetos públicos.
- [x] Excluir branch QA e apagar o dump local descriptografado; produção permaneceu inalterada.
- [ ] O usuário deve copiar `C:\Users\Wesley\Documents\Minhas Economias Backup\neon-backup.agekey` para cofre/offline e verificar acesso noutro dispositivo; sem essa chave, artifacts cifrados não podem ser recuperados.
- [ ] Confirmar a primeira execução automática (`schedule`) após 13:00 UTC de 2026-11-07; a execução `42320784685` foi manual.
- [ ] Restore via interface autenticada, CRUD familiar/relatórios, revisão visual mobile e cobertura dos módulos ainda pendentes da meta geral.

## Continuação — 2026-11-07
- [x] Publicar confirmação antes de remover membro familiar em `0917cdb`; CI `42376911235` passou.
- [x] Adicionar teste DOM sintético de edição de orçamento; suíte completa passou com 178 testes em 35 arquivos, `bun run lint` e `git diff --check` passaram.
- [x] Confirmar `/api/health` em produção: HTTP 200, Neon `ok`, role de runtime restrita.
- [x] Confirmar deployment de `0917cdb` Ready e verificar no domínio principal o bundle lazy da remoção familiar com a confirmação publicada.
- [x] Confirmar health em produção HTTP 200/Neon `ok`/role restrita; rotas de workspace, lembretes, FX e investimentos sem token respondem 401.
- [x] Publicar teste DOM sintético de edição de orçamento no commit `17b49db`; CI `42377109572` passou e o deployment Vercel `dpl_y2nKx4hGY7CZ6MomNeVSChDmq3bZ` ficou Ready.
- [x] Inspecionar login de produção com Ego Lite em desktop e viewport 390×844: tela renderizada, campos legíveis e sem overflow horizontal aparente; Guia Rápido ausente.
- [ ] Completar inspeção visual do dashboard autenticado em desktop/mobile; Firebase Auth está ativo, houve validação parcial de UI, mas ainda não foi feito um sweep completo.
- [ ] Observar execução automática do backup GitHub; última cópia verificada ainda é execução manual.
- [x] Decisão de arquitetura: manter Firebase Auth para identidade e Neon PostgreSQL para dados; o health de produção confirma Firebase Auth e Neon ativos.
- [ ] Concluir validação visual desktop/mobile e fluxos reais autenticados; testes DOM e APIs com mocks não substituem esses aceites.

## Validação real de convites e lançamento compartilhado — 2026-11-07
- [x] Publicar entrypoints Vercel profundos para `respond` e `revoke`; CI `42419556410` passou, deployment `dpl_4pRYn2TGYwD41geXZsgW4Dr7tqv5` Ready.
- [x] Confirmar sem autenticação 401 JSON nos dois caminhos profundos, em vez do 404 plain text da borda.
- [x] Criar e verificar uma identidade Firebase temporária de QA; aceitar um convite real e confirmar `accepted`/UID correspondente no readback autenticado.
- [x] Criar outro convite e confirmar recusa autenticada (`declined`), estado correspondente na UI do proprietário e revogação posterior.
- [x] Criar lançamento familiar pela UI (R$ 1,25; divisão 50%) e confirmar na identidade secundária o espelho lido do endpoint Neon (R$ 0,63 compartilhados; pendente).
- [x] Remover pela UI o lançamento de QA, revogar vínculos, apagar a linha exata de convite de QA no Neon e excluir a identidade Firebase temporária.
- [x] Consulta agregada final em produção: zero convites ativos, zero registros do lançamento QA em tabela de compartilhamento e workspaces.
- [ ] Validar cadastro, verificação, login, logout e persistência de sessão pelo formulário visual do app com duas identidades; o teste de identidade real foi feito por Auth REST e Gmail, enquanto o isolamento de sessão UI no Ego Lite não foi possível.
- [ ] Validar restore/import/export pela UI autenticada em branch Neon QA; comprovar o disparo automático agendado do backup cifrado e a guarda externa da chave age.
- [ ] Completar sweep mobile e readback independente Neon para CRUD de todos os módulos; a suíte sintética mais recente foi informada como 374/374 em 54 arquivos, e não substitui essa validação remota.

## Orquestração do workspace e agendamentos rechecados — 2026-11-07
- [x] Manter Firebase Auth como identidade e Neon PostgreSQL como armazenamento financeiro operacional, conforme decisão do usuário; o health de produção reporta ambos e a role restrita.
- [x] Adicionar teste sintético de App para hidratação autenticada do Neon, bloqueio enquanto carrega, erro 503 sem overwrite/local-save e retry pelo botão.
- [x] Confirmar `bun test`: 356 testes em 54 arquivos; `bun run lint`, `bun run build` e `git diff --check` passaram.
- [x] Publicar commit `c8fa7c0`; CI `42421567985` passou e Vercel `dpl_DQXaUCBDVp5ZKdNyreKzHWADcqbB` ficou Ready no alias principal; health pós-deploy HTTP 200/Neon ok/Firebase Auth/role restrita.
- [x] Confirmar a atividade diária do Neon por execução GitHub `schedule` `42397967500` em 2026-11-07; health de produção HTTP 200/Neon ok.
- [x] Confirmar que Vercel mantém `/api/health` agendado diariamente às 12:15 UTC.
- [ ] Confirmar execução do workflow `neon-backup.yml` por `schedule`; a mais recente verificada (`42413305298`) foi manual, apesar do cron diário estar configurado.
- [ ] Fazer restore/export/import pela interface em branch Neon QA isolada e confirmar por readback após recarga; suíte sintética e API mock não fecham esse requisito.
- [ ] Fazer sweep completo da UI mobile e CRUD→Neon real dos módulos; manter os testes de componentes separados de evidência real.

## Auditoria de cobertura dos testes — 2026-11-07
- [x] Revisar o roteiro e a cobertura existente para restore UI→API→Neon, isolamento por UID e CRUD/readback das entidades; nenhuma escrita ou chamada externa foi feita nesta revisão.
- [x] Registrar a suíte mais recente como **374/374 em 54 arquivos**, com build, lint e diff-check aprovados conforme informado pelo usuário; essa contagem não foi reexecutada aqui. As menções históricas a 356/356 continuam descrevendo a execução anterior.
- [x] Distinguir os níveis de evidência: parser e componentes usam fixtures/callbacks sintéticos; API restore e UID usam Pool em memória em `backend/familyApi.test.ts`; há ensaio real API→Neon em branch QA de um UID sintético e fluxo familiar real com duas identidades previamente limpo.
- [ ] Completar restore importado pela UI → save autenticado → Neon QA isolado → recarga/GET/readback independente.
- [ ] Validar isolamento entre dois UIDs autenticados no mesmo banco Neon QA, incluindo RLS real e readback que prove ausência de acesso cruzado.
- [ ] Fechar CRUD/readback independente por entidade e operação crítica; ciclos anteriores de UI cobrem subconjunto e não substituem a verificação completa no Neon.

## Login próprio no Neon — 2026-11-08
- [x] Remover Firebase (código, dependência, config) e criar login próprio (`authSession.ts`, `/api/auth/*`, `authClient.ts`).
- [x] Corrigir CSV: sinal em `R$ -34,90`, `34,90-`, `(34,90)` e manter linhas rejeitadas na caixa.
- [x] 377 testes, tsc e build passando; login e recarga validados no navegador (banco simulado).
- [x] Rodar migration 008 no Neon de produção.
- [ ] Cadastrar `AUTH_SESSION_SECRET` na Vercel e remover `FIREBASE_*`.
- [ ] Publicar e testar cadastro/login em produção.
- [x] Verificação de e-mail descartada por decisão do dono: família só por convite no sistema.
- [x] Logout real (token_version) implementado e testado localmente.
- [x] Migration 009 aplicada no Neon de produção.
- [ ] Commitar e publicar na main.

## Acesso autenticado à Preview com banco QA — 2026-11-11
- [x] Criar projeto Neon QA isolado (`minhas-preview-qa`) e aplicar migrations 001–009 sem dados de produção.
- [x] Criar role runtime de menor privilégio e configurar `DATABASE_URL` sensível somente para Preview do Vercel.
- [x] Reconstruir a implantação de Preview usada pelo usuário e confirmar estado Ready.
- [ ] Revogar a chave API temporária no painel Neon; o perfil foi removido localmente, mas a chave recusou auto-revogação por escopo.
- [ ] Usuário criar sua conta pelo formulário do Preview e confirmar login visual com o link compartilhável.

## Continuação da auditoria financeira — 2026-11-11
- [x] Validar e proteger médias ponderadas e análises por lote/mês de câmbio contra dados não finitos e valores fora da faixa segura de centavos; suíte completa, lint, build e diff-check aprovados.
- [x] Corrigir saldo de conta internacional para separar despesas pagas de pendentes, ignorar lotes cambiais futuros/inválidos e respeitar a competência selecionada; suíte completa (424), lint, build e diff-check aprovados.
- [x] Recalcular duplicatas quando muda a conta de conciliação e bloquear extrato OFX não-BRL/sem moeda até haver conversão segura; suíte completa (427), lint, build e diff-check aprovados.
- [x] Implementar conversão OFX estrangeira com taxa explícita por arquivo e persistir valor/moeda/taxa originais por lançamento; prévia mostra a conversão.
- [x] Incluir receitas pagas e pendentes no saldo internacional e no custo médio cambial quando houver origem/taxa válida.
- [x] Impedir que respostas de gravação atrasadas da sessão antiga alterem revisão e estado da conta nova.
- [x] Ratear compras parceladas em centavos inteiros e distribuir os centavos restantes sem viés de ponto flutuante.
- [x] Reexecutar suíte completa (430/430), lint, build PWA (88 entradas) e diff-check após as correções.
- [x] Validar valores financeiros no payload persistido antes de usar no cálculo ou aceitar gravação no backend; cobrir API e hidratação local.
- [x] Exigir data real, competência mensal e status válido em transações tipadas persistidas, com cobertura local e no endpoint.
- [x] Reexecutar suíte completa (431/431), lint, build PWA (88 entradas) e diff-check após a validação do payload.
- [x] Fazer o fluxo de caixa diário refletir faturas abertas no vencimento e faturas antigas como atraso, sem mexer no saldo efetivado.
- [x] Reexecutar suíte completa (432/432), lint, build PWA (88 entradas) e diff-check após reconciliar a projeção diária.
- [x] Confirmar a suíte completa (432/432), lint, build PWA (88 entradas) e diff-check também após validar data, competência e status das transações persistidas.
- [x] Estender a validação compartilhada de payload para valores de metas, investimentos, lotes cambiais e liquidações de viagens.
- [x] Cobrir validação de metas/ativos/viagens, precisão decimal por moeda e faixas de rendimento/IOF no parser e no endpoint; suíte completa (433/433), lint, build PWA (88 entradas) e diff-check aprovados.
- [x] Proteger leitura, refresh de conflito e resolução “manter local” contra troca de UID durante chamadas assíncronas; regressões integradas passaram para UID novo com mesmo e-mail e conflitos atrasados.
- [x] Conferir pagamento de fatura entre saldo da conta, caixa diário, despesa por competência/categoria, relatório e calendário; garantir redução de caixa única sem duplicar consumo. Suíte final: 434/434, lint, build PWA e diff-check aprovados.
- [x] Corrigir a sugestão automática de subcategoria ao mudar o estabelecimento, limpar subcategoria incompatível, ignorar IDs históricos removidos e respeitar seleção manual; regressões do formulário incluídas.
- [x] Reabrir e salvar o valor total original ao editar uma compra parcelada; regressão do modal incluída.
- [x] Reexecutar validação local após estas correções: 437/437 testes em 58 arquivos, lint/TypeScript, build PWA (88 entradas) e diff-check aprovados.
- [x] Corrigir inferência de total em série legada incompleta com parcela parcialmente paga; não estimar o total original, restringir a edição à parcela selecionada e cobrir com regressão sintética. Suíte completa: 438/438, lint, build PWA (88 entradas) e diff-check aprovados.
- [x] Separar o download do backup da alteração dos metadados históricos; só aplicar após segunda confirmação de que o arquivo foi salvo. Regressão confirma que o primeiro clique não altera os lançamentos.
- [x] Rejeitar IDs repetidos nas coleções persistidas antes da hidratação local ou gravação pela API; cobrir parser e endpoint para evitar edição/liquidação ambígua.
- [x] Consolidar achados/correções/evidências de 36 falhas confirmadas (11 P0 e 25 P1) em `docs/AUDITORIA_LOGICA_FINANCEIRA.md`.
- [x] Publicar a revisão financeira pelo GitHub `main` → Vercel e confirmar verificação Vercel concluída e bundle atualizado no domínio de produção.
- [ ] Aplicar metadados históricos de parcelamento de alta confiança com backup JSON salvo e confirmar readback no Neon; nenhum dado de produção foi alterado na publicação.
- [ ] Completar QA visual autenticado com dados sintéticos e readback no Neon Preview.
- [ ] Resolver retorno do usuário: compra realizada em 11/11 aparece em 15/11 no histórico; conferir registro autenticado, corrigir data específica e validar apresentação do total original no calendário. Correção do padrão de novos lançamentos não resolve esse dado histórico.
- [x] Com backup integral salvo, corrigir data da primeira parcela Amazon para 11/11 e preencher total original R$ 1.435,00 nas 12 parcelas; PUT revisão 26 e GET independente revisão 27 confirmaram preservação dos demais campos.
- [x] Tornar total da compra e quantidade de parcelas visíveis na primeira parcela do calendário, remover instruções de sincronização manual da tela de login e atualizar documentação do login próprio. Lint/build/diff-check passaram.
- [x] Retirar miniatura/bandeira e aviso de fatura estimada do formulário de compra; manter cálculo automático e ajuste manual recolhido. Trocar “Sem Gastos” por “Sem fatura no mês” na página do cartão. Regressões do modal, lint e build passaram.
- [x] Usar filtro compartilhado por data nos indicadores/semanas/seleção inicial do calendário; cobrir compra de novembro faturada em dezembro com regressão.
- [x] Confirmar em produção autenticada: compra em 11/11, total original em destaque, 1 recorrente e 1 movimento na semana 2; formulário sem miniatura/aviso de mês. Corrigir seleção do extrato com regressão (deploy específico ainda pendente na última consulta).
- [ ] Consolidar seleção, somas e invariantes financeiros de todos os módulos no domínio compartilhado, comprovando resultados coerentes após uma mesma edição e readback remoto.
- [x] Extrair DRE do componente para regra de domínio e alinhar despesas/receitas de familiar ao resumo mensal, com regressão de consistência.
- [x] Consolidar prévia de orçamento e rodapé do formulário com geração/edição de parcelas do domínio, removendo cálculo duplicado e resumo de mês incorreto; cobrir competência de fatura, centavos, preservação de parcela paga, limite e categoria sem orçamento.
- [x] Centralizar patrimônio do DRE e saúde financeira, descontando dívida dos cartões; impedir modo inicial com dívida existente e cobrir compra parcelada sem conta/fatura no mês.
- [x] Separar recorrências futuras da dívida atual do cartão sem excluir previsões de faturas nem parcelas contratadas; testar limite antes/depois da cobrança recorrente.
- [x] Compartilhar classificação e soma de dividendos entre investimentos e DRE, excluindo reembolsos e receitas de familiar; explicitar recebidos/previstos na tela.
- [x] Corrigir rateio das cotas compartilhadas ao editar total original de compra parcelada, preservando parcelas pagas/acertos recebidos e bloqueando alterações incompatíveis.
- [x] Usar cálculo compartilhado da cota total no submit e prévia mensal da parcela; reabrir campo personalizado com a cota total da série completa, com regressões.
- [x] Centralizar resumo, seleção, baixa e reabertura de compartilhamentos; tornar baixa idempotente e vincular grupos de compensação zero.
- [x] Usar vínculos explícitos comuns na exclusão e reabertura, sem atingir acertos não relacionados por coincidência de data/descrição; conferir indicador quitado pela data real.
- [x] Confirmar conclusão do deploy Vercel `ffc50f2` das cotas compartilhadas.
- [x] Confirmar conclusão do deploy Vercel `f723328` do patrimônio compartilhado.
- [x] Confirmar conclusão do deploy Vercel `fdcad78` da prévia de orçamento.
- [x] Confirmar deploy Vercel do extrato `0a33f83` concluído com sucesso.
