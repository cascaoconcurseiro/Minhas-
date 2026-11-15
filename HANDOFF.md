# Handoff — Minhas Economias

> **Documento obrigatório.** Toda entrega (commit que muda `src/`, `backend/`, `api/`, `db/`, `shared/` ou `package.json`) **precisa** de uma nova entrada na seção 7 e da atualização das seções 1–6 quando mudarem. O CI barra a entrega se isso não for feito (`bun run check:handoff`). Regras completas: [docs/processo/handoff-e-checklist.md](./docs/processo/handoff-e-checklist.md). Histórico antigo: [docs/arquivo/handoff/](./docs/arquivo/handoff/).

## 1. Estado atual
- **Atualizado em:** 2026-11-15
- **Produção:** branch `main` publicada na Vercel (projeto `minhaseconomias`), banco Neon `minhas-economias-br`.
- **Resumo:** sistema financeiro completo em uso (lançamentos, cartões, contas, orçamentos, viagens, compartilhado, investimentos, relatórios, **A Receber**). Código reorganizado por áreas (`components/` por pasta, `domain/` regras, `services/` dados) e documentação refeita em `docs/`.
- **Verificação mais recente (2026-11-15):** `tsc` limpo · 713 testes passando · build PWA ok.
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
