# Auditoria funcional e financeira — Minhas Economias

**15/11/2026 · Base auditada:** `main`, commit `4edf4b95b58227ca29111f548ea41454b6afb979`.

**Status em 16/11/2026:** os 13 achados abaixo foram corrigidos no checkout local, com cobertura automatizada e QA PostgreSQL descartável registrados no HANDOFF. Ainda não publicados nem verificados na conta da Fran. A evidência e a recomendação abaixo descrevem a condição original antes das correções.

## Parecer

A integridade financeira exige correção antes de aprovar o sistema. Dois fluxos normais do módulo A Receber gravam estados inconsistentes no banco. A suíte ampla e o CI do mesmo commit passaram em Linux, mas esses cenários ficaram fora da cobertura automatizada existente. Os testes novos usaram contas e dados fictícios no PostgreSQL 17 local. A consulta à produção limitou-se a endpoints públicos e respostas de autenticação.

## Achados

**Crítico** indica gravação de estado financeiro inconsistente por uma ação normal. **Alto** indica distorção material, perda de atualização ou recuperação comprometida. **Médio** indica regra divergente ou falha circunscrita. Evidência por navegador inclui interação com Chrome e releitura independente pela API quando indicada.

| ID | Gravidade / categoria | Área e código | Problema e evidência | Correção proposta |
|---|---|---|---|---|
| M01 | Crítico · integridade financeira | [Restrições do extrato](../src/domain/finance/financeRules.ts#L2347), [duplicação](../src/domain/finance/financeRules.ts#L2378), [validação do workspace](../backend/app.ts#L126) | **Navegador + banco.** Numa dívida de R$ 100, receber R$ 25 e duplicar o recebimento no extrato grava dois créditos de R$ 25 com uma única baixa. Desfazer a baixa reabre os R$ 100 e deixa o crédito duplicado. O teste de domínio mostrou que apagar o crédito diretamente deixa a baixa sem contrapartida. A API gravou um workspace com baixa de R$ 25 e zero lançamentos. | Bloquear edição, duplicação, exclusão e alteração de status de movimentos vinculados pelo extrato. Validar vínculo, valor, conta e unicidade na API. Tratar explicitamente as frações geradas por pagamento parcial. |
| M02 | Crítico · integridade financeira | [Exclusão de A Receber](../src/App.tsx#L1651), [divisão da compra na fatura](../src/domain/finance/financeRules.ts#L812) | **Navegador + banco.** Cobrança de cartão adicional de R$ 100, paga parcialmente em R$ 40. O bloqueio consulta o ID original, que permanece pendente com R$ 60. Apagar A Receber remove as frações de R$ 40 e R$ 60 e mantém o débito bancário de R$ 40. | Bloquear exclusão se qualquer fragmento dessa cobrança estiver pago ou vinculado a pagamento. Estornar pelos comandos da fatura antes de excluir. |
| M03 | Alto · saldo e patrimônio | [Saldo das contas](../src/domain/finance/financeRules.ts#L465), [posição atual](../src/domain/finance/financeRules.ts#L3103), [rótulo na Visão Geral](../src/components/overview/OverviewTab.tsx#L217) | **Domínio executado.** Conta com R$ 1.000 e crédito de R$ 300 marcado pago em 30/11. A posição em 15/11 exibe R$ 1.300 no saldo de hoje e no patrimônio. O cálculo recebe o mês e perde o corte no dia. | Aplicar corte por data ao saldo realizado de hoje e manter a projeção no cálculo mensal. Usar o mesmo resultado em todos os indicadores que dizem “hoje”. |
| M04 | Alto · concorrência familiar | [Envio e repetição no app](../src/App.tsx#L1836), [gravação e exclusão no servidor](../backend/app.ts#L1066) | **API + PostgreSQL.** Entregar o envio de R$ 200 e depois o anterior de R$ 100 deixa o familiar com R$ 100. Depois de apagar o espelho, reenviar o lote antigo recria a despesa. O app dispara envios assíncronos. O bloqueio da linha do convite serializa a gravação com a revogação, mas o servidor aceita o conteúdo pela ordem de chegada. | Versionar cada mutação no servidor e manter marca de exclusão que rejeite envios antigos. Vincular as versões à revisão do workspace, incluindo as restauradas. |
| M05 | Alto · validação de restauração | [Leitura e campos opcionais de backup](../src/services/workspace/fullBackup.ts#L123), [aplicação do backup](../src/App.tsx#L3195), [uso dos recebimentos](../src/domain/receivables/receivables.ts#L6) | **Navegador + banco.** Um backup exportado teve apenas os pagamentos de uma dívida trocados por `null` e o saldo inicial alterado. A interface aceitou a confirmação, entrou na tela “Não foi possível abrir esta tela” e a releitura independente preservou o saldo e a revisão anteriores no PostgreSQL. | Validar todas as coleções do backup e suas referências antes de alterar qualquer estado. Exibir o campo afetado e manter a sessão anterior disponível se a validação falhar. |
| M06 | Alto · restauração e compartilhamento | [Restauração no app](../src/App.tsx#L3195), [exclusões explícitas na API](../backend/app.ts#L1080) | **API + leitura do fluxo.** A restauração do próprio titular reenvia itens presentes e não envia IDs removidos pela restauração. A API manteve um espelho após receber lista vazia sem os IDs apagados. Assim, desfazer uma despesa pessoal via backup pode deixar o familiar com a cobrança antiga. | Comparar o estado atual com o restaurado e aplicar inclusões, atualizações e exclusões com controle de revisão. Testar com duas identidades e backup anterior ao compartilhamento. |
| M07 | Alto · recuperação operacional | [Workflow](../.github/workflows/neon-backup.yml), [manual de recuperação](operacao/backup-e-restauracao.md) | **PostgreSQL real descartável.** O dump com as opções do workflow inclui o schema `public` e omite permissões e proprietários. Uma restauração estrita em banco novo falhou porque `public` já existia. A restauração dos objetos numa segunda tentativa concluiu, mas o papel do aplicativo recebeu `permission denied for schema public`. | Documentar e ensaiar a preparação do destino, a restauração e a reaplicação de privilégios mínimos. Após restaurar, executar login, leitura, escrita concorrente e isolamento com o papel restrito. |
| M08 | Médio · regra de fatura | [Ordem de abatimento](../src/domain/finance/financeRules.ts#L788), [ordem da lista](../src/domain/finance/financeRules.ts#L700) | **Domínio executado.** A tela ordena por data. Pagamento parcial de R$ 40 atingiu a compra de 12/11 antes da de 02/11 quando o armazenamento estava em ordem inversa. Pode atingir outro item compartilhado ou outra compra de viagem, dependendo da ordem interna. | Definir o critério de abatimento e usá-lo no cálculo e na apresentação. Cobrir datas iguais e múltiplos abatimentos. |
| M09 | Médio · validação de entrada | [Cadastro](../src/domain/receivables/receivables.ts#L72), [recebimento](../src/domain/receivables/receivables.ts#L142), [validação persistida](../src/services/workspace/workspacePayload.ts#L103) | **Domínio executado.** O comando aceitou 31/02/2026. O validador da gravação rejeitou o resultado. O mesmo caminho de criação arredonda após aceitar valores positivos e aceita valor inferior a meio centavo como zero. | Reutilizar o mesmo validador de calendário e centavos nas operações, interface e API. Validar o valor final antes de aplicar. |
| M10 | Médio · vínculo de contas | [Exclusão de conta](../src/App.tsx#L2945), [migração do extrato](../src/domain/finance/financeRules.ts#L2811) | **Leitura de código.** Se houver conta substituta compatível, apagar uma conta migra seu extrato. O comando atualiza contas, cartões e lançamentos, mas mantém o `accountId` antigo nos recebimentos já registrados em A Receber. | Migrar as referências dos recebimentos junto com o extrato ou bloquear a exclusão enquanto houver vínculo. Testar a releitura das duas coleções. |
| M11 | Médio · portabilidade da checagem | [Teste de imports](../backend/runtimeImports.test.ts#L38) | **Windows e CI.** A comparação usa caminhos relativos com separadores diferentes e acusa import de tipos. Resultado local de 795/796. O mesmo commit passou 796/796 no GitHub Linux. | Normalizar todos os caminhos comparados, incluindo o alvo somente de tipos e a asserção de que a regra financeira foi alcançada. |
| M12 | Médio · regra/documentação de backup | [Contrato documentado](produto/regras-de-negocio.md#14-sincronização-e-dados-srcservicesworkspace), [uso do titular na importação](../src/App.tsx#L3195) | **Navegador + banco.** A descrição das regras exige o mesmo titular para backup v6. O navegador aceitou um arquivo com `ownerUserId` diferente e gravou o saldo alterado. O código usa a comparação para limitar o compartilhamento, como descreve o manual de backup. | Alinhar o contrato de portabilidade e testar a importação em outra conta com dados compartilhados para garantir que vínculos remotos sejam removidos. |
| M13 | Alto · alteração perdida na reconexão | [Aplicação da cópia local](../src/App.tsx#L1046), [condição para gravar](../src/App.tsx#L1502), [interação liberada com a cópia](../src/App.tsx#L3819) | **Navegador + banco.** Recarregar offline abriu a última cópia. O extrato deixou duplicar uma compra e exibiu a cópia. Ao reconectar, a cópia desapareceu da interface e o PostgreSQL confirmou que ela jamais chegou ao servidor. | Aplicar o modo somente leitura a todas as mutações enquanto a primeira leitura remota estiver pendente. Indicar isso nos controles. Se houver edição offline futuramente, exigir fila persistida e política de conflito. |

### Bloqueio imediato proposto para M01 e M02

O retorno entra antes das regras genéricas em `getLinkedOperationRestriction`. A duplicação e a alteração de status precisam chamar a mesma proteção, inclusive em lote. A exclusão em A Receber usa a coleção completa de movimentos vinculados.

```ts
if (tx.receivableId) {
  return 'Corrija este movimento na aba A Receber.';
}
```

```ts
const hasSettledCardFragment = transactions.some(
  (tx) =>
    tx.receivableId === receivableId &&
    Boolean(tx.creditCardId) &&
    (tx.status === 'paid' || Boolean(tx.invoicePaymentId)),
);

if (target?.kind === 'card_invoice' && hasSettledCardFragment) {
  return 'Estorne o pagamento da fatura em Cartões antes de apagar.';
}
```

Essas verificações impedem novas alterações pelos fluxos atingidos. A validação da API precisa identificar vínculos de movimentações históricas, e a eventual reconciliação deve primeiro levantar divergências e preservar registros bancários.

## Cobertura por funcionalidade

| Área | Verificações feitas | Limite material |
|---|---|---|
| Visão Geral, calendário, busca e avisos | Telas e sino abriram, busca global encontrou o lançamento de teste, suíte de calendário, filtros, alertas e saúde financeira rodou. Corte diário reproduzido no domínio. | Navegação com dados fictícios e amostra limitada de históricos. |
| Lançamentos e recorrências | Suíte de criar/editar/duplicar/excluir, parcelado, fixo, mudança de forma, cascata, datas e bloqueios. Duplicação de recebimento confirmada no extrato real. | Edição de todas as combinações de séries no navegador ficou pendente. |
| Contas, saldos e transferências | Tela e saldo da conta fictícia conferidos. Suíte de transferências, contas em moedas diferentes, saldos e exclusão com substituta. | Sem conciliação entre saldos pessoais do app e extratos bancários reais. |
| Cartões, faturas, limites e antecipação | Abatimento parcial na interface lido no banco. Suíte cobre fechamento, limite, pagamento e estorno, centavos, antecipação e séries. | Sem contrato específico de cada emissor nem importação de fatura linha a linha. |
| A Receber | Cadastro fictício via API, baixa na interface, releitura, duplicação, desfazimento, pagamento parcial e exclusão. | Sem medir quantos registros reais foram afetados. |
| Compartilhado e família | PostgreSQL conferiu convite antes do cadastro, código, recusa, reenvio, revogação, terceiros, espelhos nos dois sentidos, recibos, acertos e reabertura. Prova extra de envio atrasado e recriação. | Aceite e acerto nas duas interfaces ao mesmo tempo ficaram pendentes. |
| Orçamento, categorias, metas e simulador | Telas e suíte de orçamento, alertas, 50/30/20, projeções, aportes e simulação. | Metas que usam o mesmo ativo, lotes de IR e vigência histórica continuam pendências do projeto. |
| Viagens, câmbio e rateio | Tela e testes de centavos, JPY, cotas, passagem de moeda em parcelas, quitação por moeda e exclusão com conservação de débito. | Câmbio ao vivo indisponível na verificação pública. Sem validação tributária ou operação real de câmbio. |
| Investimentos e cotações | Tela e testes de aporte, resgate, provento, exclusão, posição, alocação e conversão de cotações. | Provedores de cotações e ativos reais sem ensaio autenticado. |
| Relatórios, DRE, patrimônio e importação | Relatório gerou PDF com assinatura válida no navegador. Suíte de DRE, relatórios, lançamentos fora do consumo, OFX/CSV, FITID por conta e conciliação. | Conteúdo visual do PDF e extratos reais de múltiplos bancos sem conferência integral. |
| Login, segurança e isolamento | Login no navegador, cadastro de contas fictícias, revogação de token confirmada e isolamento de compartilhados em PostgreSQL com papel restrito. Testes de WebAuthn e destino SMTP. | Face ID físico, segurança no Neon produtivo e envio SMTP real ficaram pendentes. |
| Sincronização, configurações e backup | Restauração JSON v6 em Chrome com substituição de saldo, leitura pela API e recarga. Escritas concorrentes 200/409, dump/restore local e evidência de backup cifrado agendado. | Dump cifrado de produção mais recente sem restauração nesta sessão e agendamento Vercel sem execução comprovada. |
| Layout e PWA | Onze módulos navegados em Chrome a 1366, 390 e 360 px. Nenhuma largura excedeu a janela nas amostras. Build com 100 entradas no cache inicial, service worker ativo e recarga offline com a cópia salva e aviso na tela. | Chrome redimensionado. Instalação e atualização em dispositivos físicos ficaram pendentes. |

Entre as pendências já registradas no projeto estão câmbio sem conta internacional, histórico com posições datadas, vigência de orçamentos/saldo inicial, ativo alocado a várias metas e créditos/estornos de compras no cartão. A mudança de fechamento para um dia diferente recalcula apenas as compras especificadas na regra documentada. O caso de compra de 12/11, com alteração de fechamento do dia 20 para o dia 10, permaneceu na competência anterior na prova dirigida. A política para reclassificar períodos maiores exige definição de produto. [Regras vigentes](produto/regras-de-negocio.md) · [Checklist](../CHECKLIST.md)

## Evidências operacionais

- GitHub Actions do commit auditado em Linux. 796 testes passaram, com tipagem, build e PostgreSQL. No Windows, tipagem e build passaram separadamente e o resultado foi 795 testes aprovados e um teste de imports reprovado. PostgreSQL 17 local aplicou 10 migrações e concluiu o roteiro com três identidades, recebimento, revogação, isolamento e conflito de revisão. [CI 43768477109](https://github.com/cascaoconcurseiro/Minhas-/actions/runs/43768477109)
- Vercel registrou sucesso para o commit. Em produção, `/api/status` respondeu 200 e informou `neon: not_checked`, `geminiConfigured: false` e `liveFxSearch: false`. O workspace e a rota de readiness responderam 401 sem credencial. [Deploy](https://vercel.com/wesleys-projects-de111a83/minhaseconomias/HA1MgTaS4mWmourRyMUkqqMvpNhc)
- O GitHub registrou cinco execuções recentes com evento `schedule` e conclusão `success` no backup cifrado. A execução 43752047582 publicou o artefato ativo de 34.741 bytes. O ensaio de recuperação desta auditoria usou o dump do banco descartável. [Backup agendado](https://github.com/cascaoconcurseiro/Minhas-/actions/runs/43752047582)
- A verificação de dependências com `bun audit --production` consultou 285 pacotes e retornou zero alertas conhecidos. A verificação completa apontou três avisos na cadeia de build do PWA, em deepmerge, glob e minimatch. A auditoria não demonstrou caminho de exploração em produção. [deepmerge](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) · [glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) · [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249)

## Ordem de correção

1. Bloquear M01 e M02 nos comandos usados pelo extrato e A Receber. Adicionar regressões com R$ 25 de recebimento e R$ 40 de pagamento parcial, confirmando antes e depois no banco de teste.
2. Impedir mutações na abertura por cópia offline. Validar toda a restauração antes de aplicar a sessão. Completar revisão de referências do workspace, posição diária e concorrência familiar. Ensaiar recuperação com o papel real do aplicativo em banco isolado.
3. Depois das correções, executar a matriz com duas contas de QA, navegadores móveis reais e casos de operação ainda sem prova, incluindo recuperação do artefato mais recente. Uma auditoria dos dados de produção exige uma etapa de conciliação somente leitura à parte.

A auditoria gerou documentação e evidência de teste. O código do aplicativo e os dados de produção não foram alterados.
