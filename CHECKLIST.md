# Checklist — Minhas Economias

> **Só itens abertos ficam aqui.** Item concluído é riscado na hora e, na próxima entrega, sai da lista (a conclusão fica registrada no `HANDOFF.md`). Histórico completo do checklist antigo (incluindo fases superadas): [docs/arquivo/checklist/](./docs/arquivo/checklist/). Regras: [docs/processo/handoff-e-checklist.md](./docs/processo/handoff-e-checklist.md).
>
> Consolidado em **2026-11-15** a partir de 147 itens abertos do checklist antigo: itens repetidos foram unificados e os obsoletos (Firebase, janelas de cron de novembro, ferramentas que não existem mais) foram descartados. Nada foi apagado do arquivo.

Legenda: **[Dono]** depende do Wesley · **[Dev]** trabalho de desenvolvimento · **[Decidir]** precisa de decisão do dono.

## A. Próximas entregas
- [ ] **[Dono]** Conferir com a Fran se os 110 compartilhados apareceram para ela (gravados no Neon em 2026-11-15; o A Receber do cartão adicional não vai para a conta dela).
- [ ] **[Decidir]** O servidor deve enviar os compartilhados sozinho no momento em que o convite é aceito (hoje depende do app de quem convidou abrir)?
- [ ] **[Dono]** Conferir no app que as compras de 30/10 do Itaú azul (R$ 98,29) aparecem em dezembro e que o aviso de atraso sumiu (dado já corrigido no Neon).
- [ ] **[Decidir]** Leitura de fatura de cartão em PDF/foto: IA externa (mais precisa, com custo e envio do arquivo) ou só no aparelho (privada, menos precisa).
- [ ] **[Dev]** Importar **fatura de cartão** (OFX) pelo app. Já temos um arquivo real (Nubank, 05/12/2026), que mostra: o `FITID` se repete entre uma compra e o IOF dela; parcelas vêm no texto ("Parcela 5/12", "- 8/8"); há créditos ("Pagamento recebido", "IOF de volta") que não são compra; o saldo do arquivo é a fatura menos os estornos de IOF. Regra do dono: valor repetido = já lançado.
- [ ] **[Dev]** Ler **valor e data** de foto de comprovante e abrir o lançamento preenchido (categoria/pagamento/conta continuam obrigatórios).
- [ ] **[Dev]** Atalho do iPhone (automação "Transação" do Apple Pay) abrindo o app com valor e estabelecimento preenchidos.

## B. Pendências do dono
- [ ] **[Dono]** Guardar a chave privada de backup (`age`) fora do computador e testar a leitura em outro aparelho.
- [ ] **[Dono]** Conferir na Vercel que `AUTH_SESSION_SECRET` e `CRON_SECRET` existem em produção; decidir se configura `GEMINI_API_KEY` (câmbio ao vivo e cotações internacionais ficam indisponíveis sem ela).
- [ ] **[Dono]** Revogar no painel do Neon a chave de API temporária usada em testes (consta no checklist antigo).
- [ ] **[Dono]** Testar em iPhone/Safari: A Receber, Cartões, campo de data, instalar o PWA, Face ID.

## C. Verificação que nunca foi feita em ambiente real
- [ ] **[Dev]** Provar a execução **agendada** (não manual) do backup cifrado `neon-backup.yml` e do cron `/api/readiness` da Vercel.
- [ ] **[Dev]** Restaurar um backup JSON pela interface em um Neon de teste isolado e conferir a releitura.
- [ ] **[Dev]** Provar com duas contas e PostgreSQL real que uma conta não enxerga os dados da outra (RLS), além do teste do CI.
- [ ] **[Dev]** Enviar um e-mail de lembrete real por SMTP de teste.
- [ ] **[Dev]** Varredura visual de todas as telas em 360/390 px e desktop com dados reais.
- [ ] **[Dev]** Backup integral do PostgreSQL independente (o plano Free só tem janela de recuperação de 6 h) e documentar convites/compartilhados no backup.

## D. Regras de negócio a revisar ou decidir
- [ ] **[Decidir]** Saldo insuficiente e limite do cartão estourado devem **bloquear** ou só **avisar** (hoje só avisam).
- [ ] **[Decidir]** `Trip.linkedAccountId` precisa de tela própria?
- [ ] **[Dev]** Compartilhado, Viagens e contagens de pendência do menu ainda usam a competência da fatura em vez do mês da compra.
- [ ] **[Dev]** Revisar transferências antigas sinalizadas em Saúde dos dados (`transfer_unconverted`).
- [ ] **[Dev]** Investimentos: quantidade fracionária, preço zero/sem cotação, rendimento inválido; possível dupla contagem do mesmo ativo em metas.
- [ ] **[Dev]** Aplicar metadados históricos de parcelamento de alta confiança (com backup JSON antes).
- [ ] **[Dev]** Compartilhado entre duas contas: retorno do estado de acerto do destinatário para a transação do remetente; convite aceito que ainda bloqueia envio (403).

- [ ] **[Decidir]** Limites de tentativa (login, cadastro, Face ID, câmbio, cotações) ficam na memória de cada instância da função (melhor esforço). Para valerem globalmente seria preciso guardá-los no banco; avaliar se compensa.
- [ ] **[Dev]** O desafio do Face ID não é de uso único no servidor (token assinado de 5 min); avaliar registrar o uso.
- [ ] **[Dev]** Exercitar `/api/fx/live-rate` e `/api/investments/sync-quotes` contra o Gemini real (modelo `gemini-3.8-flash` nunca testado de verdade) quando houver chave.

### Auditoria financeira de 2026-11-15 — o que ficou aberto (ver `HANDOFF.md`)
- [ ] **[Dev]** A19 (resto): compra de câmbio sem conta internacional vinculada ainda vira despesa; falta um comando único de câmbio com duas pernas. (Apagar a viagem já não apaga mais o débito bancário.)
- [ ] **[Decidir]** A14 (IOF): a fonte oficial (Decretos 12.466 e 12.499/2025) fala em 3,5% no cartão, mas há trechos suspensos por decreto legislativo e notícia de restabelecimento pelo STF; confirmar a norma vigente e a cobrança real do banco antes de trocar os percentuais (o campo de IOF do formulário já é editável).
- [ ] **[Dev]** A18, A21, A22, A23, A24: simulador por lote de aporte, patrimônio histórico com posições datadas, orçamento/saldo inicial com vigência, reserva exclusiva de ativo por meta, crédito/estorno de compra no cartão.

## E. Dívida técnica (sem mudar comportamento)
- [ ] **[Dev]** Dividir `src/components/transactions/TransactionModal.tsx` (~4.600 linhas) por tipo de lançamento.
- [ ] **[Dev]** Extrair de `src/App.tsx` (~4.600 linhas) hooks por área (valores a receber, cartões, sincronização).
- [ ] **[Dev]** Dividir `src/domain/finance/financeRules.ts` (~3.300 linhas; a formatação de R$ e datas já foi extraída para `formatting.ts`) por assunto mantendo um índice que reexporta.
- [ ] **[Dev]** Dividir `backend/app.ts` (~1.500 linhas) em uma rota por arquivo.
- [ ] **[Dev]** Renomear rótulos e testes antigos que ainda citam Firebase (`firebaseAuthConfigured`, títulos em `src/test-utils/appOrchestrationHarness.tsx`).
- [ ] **[Dev]** Remover campo sem uso `AppSettings.financialMonthStartDay` e o mecanismo `ReceivablesIntent` (hoje sem uso).
- [ ] **[Dev]** Build local da CLI da Vercel não aceita a configuração Node 26.x (produção roda Node 26); alinhar.
