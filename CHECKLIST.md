# Checklist — Minhas Economias

> **Só itens abertos ficam aqui.** Item concluído é riscado na hora e, na próxima entrega, sai da lista (a conclusão fica registrada no `HANDOFF.md`). Histórico completo do checklist antigo (incluindo fases superadas): [docs/arquivo/checklist/](./docs/arquivo/checklist/). Regras: [docs/processo/handoff-e-checklist.md](./docs/processo/handoff-e-checklist.md).
>
> Consolidado em **2026-11-15** a partir de 147 itens abertos do checklist antigo: itens repetidos foram unificados e os obsoletos (Firebase, janelas de cron de novembro, ferramentas que não existem mais) foram descartados. Nada foi apagado do arquivo.

Legenda: **[Dono]** depende do Wesley · **[Dev]** trabalho de desenvolvimento · **[Decidir]** precisa de decisão do dono.

## A. Próximas entregas
- [ ] **[Dono]** Marcar no cartão **Itaú azul** a opção "compra no próprio dia do fechamento vai para a próxima fatura" e conferir que as compras de 30/10 (R$ 98,29) foram para dezembro.
- [ ] **[Decidir]** Leitura de fatura de cartão em PDF/foto: IA externa (mais precisa, com custo e envio do arquivo) ou só no aparelho (privada, menos precisa).
- [ ] **[Dev]** Importar **fatura de cartão** (OFX/CSV) criando as compras no cartão certo com mês da fatura — precisa de um arquivo real de fatura (pode ter nomes apagados).
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

## E. Dívida técnica (sem mudar comportamento)
- [ ] **[Dev]** Dividir `src/components/transactions/TransactionModal.tsx` (~4.600 linhas) por tipo de lançamento.
- [ ] **[Dev]** Extrair de `src/App.tsx` (~4.600 linhas) hooks por área (valores a receber, cartões, sincronização).
- [ ] **[Dev]** Dividir `src/domain/finance/financeRules.ts` (~3.500 linhas) por assunto mantendo um índice que reexporta.
- [ ] **[Dev]** Dividir `backend/app.ts` (~1.500 linhas) em uma rota por arquivo.
- [ ] **[Dev]** Renomear rótulos e testes antigos que ainda citam Firebase (`firebaseAuthConfigured`, títulos em `src/test-utils/appOrchestrationHarness.tsx`).
- [ ] **[Dev]** Remover campo sem uso `AppSettings.financialMonthStartDay` e o mecanismo `ReceivablesIntent` (hoje sem uso).
- [ ] **[Dev]** Build local da CLI da Vercel não aceita a configuração Node 26.x (produção roda Node 26); alinhar.
