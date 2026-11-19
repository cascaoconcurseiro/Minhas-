/** Ações de lançamentos: abrir, editar, duplicar, salvar, pago/pendente, antecipar, apagar. Parte do App (ver src/App.tsx). */
import { Transaction } from '../types/finance';
import { adjustFixedSeriesLength, applyCascadeTransactionDelete, applyCascadeTransactionEdit, canSettleTransactionDirectly, CascadeScope, createTransactionBatch, CreateTransactionBatchInput, duplicateFinancialTransaction, formatBRL, formatMonthYearPT, getTransactionEditRestriction, isSharedTransactionCreatedByOther, payCreditCardInvoice, rebuildTransactionSeries, toggleTransactionStatusWithCascade } from '../domain/finance/financeRules';
import { resolveBankTransfer } from '../domain/finance/transferRules';
import { applyAssetOperation, planAssetContribution } from '../domain/investments/investmentRules';
import { describeCommitmentAfterPurchase } from '../domain/cards/cardCommitment';
import { anticipateCardInstallments, reverseInstallmentAnticipation } from '../domain/budgets/uxEnhancementRules';
import type { AppStateApi } from './useAppState';
import type { SharedSyncApi } from './useSharedSync';

export function useTransactionActions(app: AppStateApi & SharedSyncApi) {
  const {
    accounts,
    cards,
    effectiveUserEmail,
    familyMembers,
    investments,
    requireWorkspaceWrite,
    selectedMonth,
    setAccounts,
    setEditingTransaction,
    setInvestments,
    setIsModalOpen,
    setModalDefaultMode,
    setModalInitialDate,
    setModalInitialTripId,
    setTransactions,
    setTrips,
    settings,
    showNotice,
    transactions,
    triggerCrossAccountSharedTxSync,
  } = app;
  // Handlers
  const handleOpenNewTransaction = (
    mode: 'expense' | 'income' | 'credit_card' | 'transfer' = 'expense',
    tripIdOrDate?: string,
    explicitDate?: string
  ) => {
    if (!requireWorkspaceWrite()) return;
    setEditingTransaction(null);
    setModalDefaultMode(mode);
    if (tripIdOrDate && /^\d{4}-\d{2}-\d{2}$/.test(tripIdOrDate)) {
      setModalInitialDate(tripIdOrDate);
      setModalInitialTripId(undefined);
    } else {
      setModalInitialTripId(tripIdOrDate);
      setModalInitialDate(explicitDate);
    }
    setIsModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    if (!requireWorkspaceWrite()) return;
    const restriction = isSharedTransactionCreatedByOther(tx, effectiveUserEmail)
      ? 'Este lançamento compartilhado foi criado por outra pessoa. Só quem criou pode editá-lo por completo.'
      : getTransactionEditRestriction(tx);
    if (restriction) {
      showNotice(
        restriction,
        undefined,
        true
      );
      return;
    }
    setEditingTransaction(tx);
    setModalDefaultMode(
      tx.creditCardId ? 'credit_card' :
        tx.type === 'income' ? 'income' :
          tx.type === 'transfer' ? 'transfer' : 'expense'
    );
    setIsModalOpen(true);
  };

  const handleDuplicateTransaction = (tx: Transaction) => {
    if (!requireWorkspaceWrite()) return;
    const cloned = duplicateFinancialTransaction(tx, `tx-dup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    if (!cloned) { showNotice('Este lançamento é vinculado a outra operação. Crie um novo lançamento para registrar outra movimentação.', undefined, true); return; }
    const next = [cloned, ...transactions];
    setTransactions(next);
    if (cloned.isShared) triggerCrossAccountSharedTxSync(next);
    showNotice(`Lançamento "${tx.description}" duplicado na competência.`, transactions);
  };

  const handleSaveTransactionBatch = (
    input: CreateTransactionBatchInput,
    editingId?: string,
    cascadeScope: CascadeScope = 'single'
  ) => {
    if (!requireWorkspaceWrite()) return;
    const prevSnapshot = [...transactions];

    if (input.type === 'transfer' && input.destinationAccountId) {
      const resolvedTransfer = resolveBankTransfer({
        source: accounts.find((account) => account.id === input.accountId),
        destination: accounts.find((account) => account.id === input.destinationAccountId),
        amountBrl: input.amount,
        foreignAmount: input.transferFromAmount ?? input.transferToAmount,
      });
      if (resolvedTransfer.error) {
        showNotice(resolvedTransfer.error, undefined, true);
        return;
      }
    }

    if (editingId) {
      const targetTx = transactions.find((t) => t.id === editingId);
      if (targetTx) {
        const updatedSingleTx: Transaction = {
          ...targetTx,
          description: input.description,
          amount: input.amount,
          installmentPurchaseTotal:
            input.installmentPurchaseTotal ?? targetTx.installmentPurchaseTotal,
          date: input.date,
          competenceMonth: input.competenceMonth || input.date.slice(0, 7),
          type: input.type,
          status: input.status,
          categoryId: input.categoryId,
          accountId: input.accountId,
          destinationAccountId: input.destinationAccountId,
          targetInvestmentAssetId: input.targetInvestmentAssetId,
          transferFromAmount: input.transferFromAmount,
          transferToAmount: input.transferToAmount,
          transferExchangeRate: input.transferExchangeRate,
          creditCardId: input.creditCardId,
          paymentMethod: input.paymentMethod,
          notes: input.notes,
          tags: input.tags && input.tags.length > 0 ? input.tags : undefined,
          isShared: input.isShared,
          sharedMemberId: input.sharedMemberId,
          sharedAmount: input.sharedAmount,
          sharedSplitMode: input.sharedSplitMode,
          sharedPaidBy: input.sharedPaidBy,
          sharedStatus: input.sharedStatus || targetTx.sharedStatus || 'pending',
          originalCurrency: input.originalCurrency,
          originalAmount: input.originalAmount,
          exchangeRate: input.exchangeRate,
          effectiveExchangeRate: input.effectiveExchangeRate,
          iofPercent: input.iofPercent,
          currencyRegime: input.currencyRegime,
          tripId: input.tripId,
          paidByParticipantId: input.paidByParticipantId,
          tripSplitMethod: input.tripSplitMethod,
          tripShares: input.tripShares,
          myPersonalShareBrl: input.myPersonalShareBrl,
          myPersonalShareForeign: input.myPersonalShareForeign,
          isCompanionOnlyExpense: input.isCompanionOnlyExpense,
        };

        // Mudou o tipo de repetição ou o número de parcelas: a série inteira é refeita com o que está no formulário.
        const recurrenceChanged =
          input.type !== 'transfer' &&
          !input.isInvoicePayment &&
          (Boolean(input.creditCardId) !== Boolean(targetTx.creditCardId) ||
            input.recurrence !== (targetTx.recurrence ?? 'single') ||
            (input.recurrence === 'installment' && input.installmentTotal !== targetTx.installmentTotal));
        // Mesmo lançamento fixo, só mudou a quantidade de meses: acrescenta ou tira meses do fim, sem refazer a série.
        const fixedGroupCount = targetTx.installmentGroupId
          ? transactions.filter((tx) => tx.installmentGroupId === targetTx.installmentGroupId).length
          : 0;
        if (
          !recurrenceChanged &&
          targetTx.recurrence === 'fixed' &&
          input.recurrence === 'fixed' &&
          input.fixedMonthsCount !== undefined &&
          input.fixedMonthsCount !== fixedGroupCount
        ) {
          const adjusted = adjustFixedSeriesLength(transactions, editingId, input.fixedMonthsCount);
          if (adjusted.error) {
            showNotice(adjusted.error, undefined, true);
            return;
          }
          // Os demais campos editados continuam valendo, no alcance escolhido (só este mês, este e próximos ou toda a série).
          const edited = applyCascadeTransactionEdit(adjusted.updatedTransactions, updatedSingleTx, cascadeScope);
          if (edited.error) {
            showNotice(edited.error, undefined, true);
            return;
          }
          setTransactions(edited.updatedTransactions);
          if (adjusted.removedSharedSyncIds.length > 0 || updatedSingleTx.isShared || targetTx.isShared) {
            triggerCrossAccountSharedTxSync(
              edited.updatedTransactions,
              familyMembers,
              adjusted.removedSharedSyncIds.length > 0 ? adjusted.removedSharedSyncIds : undefined
            );
          }
          showNotice(
            `Série fixa ajustada para ${input.fixedMonthsCount} mês(es) (${adjusted.addedCount} acrescentado(s), ${adjusted.removedCount} removido(s)).`,
            prevSnapshot
          );
          return;
        }
        if (recurrenceChanged) {
          const rebuilt = rebuildTransactionSeries(transactions, editingId, input);
          if (rebuilt.error) {
            showNotice(rebuilt.error, undefined, true);
            return;
          }
          setTransactions(rebuilt.updatedTransactions);
          if (input.isShared || rebuilt.removedSharedSyncIds.length > 0) {
            triggerCrossAccountSharedTxSync(
              rebuilt.updatedTransactions,
              familyMembers,
              rebuilt.removedSharedSyncIds.length > 0 ? rebuilt.removedSharedSyncIds : undefined
            );
          }
          showNotice(
            `Lançamento refeito: ${rebuilt.removedCount} antigo(s) substituído(s) por ${rebuilt.createdCount} novo(s).`,
            prevSnapshot
          );
          return;
        }

        if (
          targetTx.installmentGroupId &&
          (cascadeScope !== 'single' || updatedSingleTx.installmentPurchaseTotal !== undefined)
        ) {
          const res = applyCascadeTransactionEdit(
            transactions,
            updatedSingleTx,
            cascadeScope
          );
          if (res.error) {
            showNotice(res.error, undefined, true);
            return;
          }
          setTransactions(res.updatedTransactions);
          if (updatedSingleTx.isShared || targetTx.isShared) {
            triggerCrossAccountSharedTxSync(res.updatedTransactions);
          }
          showNotice(
            `Efeito Cascata aplicado: ${res.affectedCount} lançamento(s) da série atualizados!`,
            prevSnapshot
          );
          return;
        }

        const nextList = transactions.map((tx) =>
          tx.id === editingId ? updatedSingleTx : tx
        );
        setTransactions(nextList);
        if (updatedSingleTx.isShared || targetTx.isShared) {
          const memberChanged =
            Boolean(targetTx.isShared && updatedSingleTx.isShared) &&
            Boolean(targetTx.sharedMemberId) &&
            targetTx.sharedMemberId !== updatedSingleTx.sharedMemberId;
          const deletedIds =
            (targetTx.isShared && !updatedSingleTx.isShared) || memberChanged
              ? [targetTx.sharedSyncId || targetTx.id]
              : undefined;
          triggerCrossAccountSharedTxSync(
            nextList,
            familyMembers,
            deletedIds,
            memberChanged ? targetTx.sharedMemberId : undefined
          );
        }
        showNotice('Lançamento atualizado com sucesso.', prevSnapshot);
        return;
      }
    }

    // If user submitted a credit card bill payment from the unified TransactionModal, execute the full invoice cascade
    if (input.isInvoicePayment && input.settledCardId && input.accountId) {
      const targetCard = cards.find((c) => c.id === input.settledCardId);
      if (targetCard) {
        const targetMonth = input.competenceMonth || input.date.slice(0, 7);
        const updated = payCreditCardInvoice(
          targetCard,
          transactions,
          targetMonth,
          input.accountId,
          input.date,
          input.amount
        );
        if (updated === transactions) {
          showNotice('Valor de pagamento inválido para o saldo pendente desta fatura.', undefined, true);
          return;
        }
        setTransactions(updated);
        showNotice(
          `Pagamento da fatura de ${targetCard.name} (${formatBRL(
            input.amount
          )}) registrado com baixa em cascata!`,
          prevSnapshot
        );
        return;
      }
    }

    // Aporte direto em ativo: confirma ativo, cotação e valor ANTES de tirar o dinheiro da conta.
    if (input.type === 'transfer' && input.targetInvestmentAssetId && input.amount > 0) {
      const contributionPlan = planAssetContribution(
        investments.find((asset) => asset.id === input.targetInvestmentAssetId),
        input.amount
      );
      if (contributionPlan.error) {
        showNotice(contributionPlan.error, undefined, true);
        return;
      }
    }

    const createdBatch = createTransactionBatch(input);
    const nextAllTransactions = [...createdBatch, ...transactions];
    setTransactions(nextAllTransactions);
    if (input.isShared) {
      triggerCrossAccountSharedTxSync(nextAllTransactions);
    }

    if (input.type === 'transfer' && input.targetInvestmentAssetId && input.amount > 0) {
      const targetAsset = investments.find((a) => a.id === input.targetInvestmentAssetId);
      if (targetAsset && targetAsset.currentPrice > 0) {
        const qtyDelta =
          Math.round((input.amount / targetAsset.currentPrice) * 10000) / 10000;
        const updatedAsset = applyAssetOperation(
          targetAsset,
          'buy',
          qtyDelta,
          targetAsset.currentPrice
        );
        setInvestments((prev) =>
          prev.map((a) => (a.id === targetAsset.id ? updatedAsset : a))
        );
        showNotice(
          `Aporte de ${formatBRL(input.amount)} debitado da conta e somado ao ativo ${targetAsset.ticker}!`,
          prevSnapshot
        );
        return;
      }
    }

    const commitmentNote = describeCommitmentAfterPurchase({
      transactions: nextAllTransactions,
      created: createdBatch,
      limitPercent: settings.cardCommitmentLimitPercent,
      warnPercent: settings.cardCommitmentWarnPercent,
    });
    if (createdBatch.length > 1) {
      showNotice(
        `${createdBatch.length} lançamentos gerados na série (${formatBRL(
          createdBatch[0].amount
        )} por mês).${commitmentNote ? ` ${commitmentNote}` : ''}`,
        prevSnapshot
      );
    } else {
      showNotice(`Lançamento registrado no controle.${commitmentNote ? ` ${commitmentNote}` : ''}`, prevSnapshot);
    }
  };

  // Toggle status (Pago ⇄ Pendente) with automatic cascade invoice reversal and 1-click Undo
  const handleToggleTransactionStatus = (
    txId: string,
    cascadeScope: CascadeScope = 'single'
  ) => {
    if (!requireWorkspaceWrite()) return;
    const target = transactions.find((t) => t.id === txId);
    if (!target) return;
    const prevSnapshot = [...transactions];
    const res = toggleTransactionStatusWithCascade(
      transactions,
      txId,
      cards,
      cascadeScope
    );
    if (res.blocked) {
      showNotice(res.actionDescription, undefined, true);
      return;
    }
    setTransactions(res.updatedTransactions);
    showNotice(res.actionDescription, prevSnapshot);
  };

  const handleBatchSettleTransactions = (txIds: string[]) => {
    if (!requireWorkspaceWrite()) return;
    if (txIds.length === 0) return;
    const prevSnapshot = [...transactions];
    // Só movimentos bancários pendentes: compra de cartão se quita pela fatura e o que já está pago não muda.
    const eligible = new Set(
      transactions
        .filter((tx) => txIds.includes(tx.id) && tx.status === 'pending' && canSettleTransactionDirectly(tx))
        .map((tx) => tx.id)
    );
    const skipped = txIds.length - eligible.size;
    if (eligible.size === 0) {
      showNotice('Nada a efetivar: compras de cartão se quitam pagando a fatura, e o restante já está pago.', undefined, true);
      return;
    }
    setTransactions((prev) =>
      prev.map((tx) => (eligible.has(tx.id) ? { ...tx, status: 'paid' } : tx))
    );
    showNotice(
      `${eligible.size} lançamento(s) efetivado(s) em lote${skipped > 0 ? ` (${skipped} ignorado(s): compra de cartão ou já pago)` : ''}.`,
      prevSnapshot
    );
  };

  const handleAnticipateInstallments = (
    installmentGroupId: string,
    discountAmount: number,
    maxCountToAdvance?: number
  ) => {
    if (!requireWorkspaceWrite()) return;
    const prevSnapshot = [...transactions];
    const res = anticipateCardInstallments(
      transactions,
      installmentGroupId,
      selectedMonth,
      discountAmount,
      maxCountToAdvance
    );
    if (res.anticipatedCount === 0) return;
    const discountApplied = Math.round((res.originalSum - res.finalSum) * 100) / 100;
    setTransactions(res.updatedTransactions);
    showNotice(
      `${res.anticipatedCount} parcela(s) futura(s) antecipada(s) para ${formatMonthYearPT(
        selectedMonth
      )} (${formatBRL(res.finalSum)}${
        discountApplied > 0
          ? ` com desconto de ${formatBRL(discountApplied)}`
          : ''
      }).`,
      prevSnapshot
    );
  };

  const handleReverseAnticipation = (targetIdOrGroupId: string) => {
    if (!requireWorkspaceWrite()) return;
    const prevSnapshot = [...transactions];
    const res = reverseInstallmentAnticipation(transactions, targetIdOrGroupId);
    if (res.restoredCount === 0) {
      if (res.blockedPaidCount > 0) {
        showNotice('Esta parcela antecipada já foi paga. Estorne o pagamento da fatura antes de desfazer a antecipação.', undefined, true);
      }
      return;
    }
    setTransactions(res.updatedTransactions);
    showNotice(
      `Antecipação desfeita: ${res.restoredCount} parcela(s) devolvida(s) aos meses de vencimento originais!`,
      prevSnapshot
    );
  };

  const handleDeleteTransaction = (txId: string, deleteGroup = false) => {
    if (!requireWorkspaceWrite()) return;
    const prevSnapshot = [...transactions];
    const scope: CascadeScope = deleteGroup ? 'all_series' : 'single';
    const res = applyCascadeTransactionDelete(transactions, txId, scope, cards);
    if (res.deletedCount === 0 && res.actionDescription) {
      showNotice(res.actionDescription, undefined, true);
      return;
    }
    const updatedIds = new Set(res.updatedTransactions.map((t) => t.id));
    const deletedSharedIds = prevSnapshot
      .filter((t) => !updatedIds.has(t.id) && t.isShared)
      .map((t) => t.sharedSyncId || t.id);

    setTransactions(res.updatedTransactions);
    // Apagar o movimento bancário de um acerto de viagem reabre o acerto (senão o grupo ficaria "quitado" sem dinheiro).
    const removedTxIds = prevSnapshot.filter((t) => !updatedIds.has(t.id)).map((t) => t.id);
    if (removedTxIds.some((id) => id.startsWith('tx-tripsettle'))) {
      setTrips((prev) =>
        prev.map((trip) =>
          trip.settlements.some((st) => st.linkedTransactionId && removedTxIds.includes(st.linkedTransactionId))
            ? { ...trip, settlements: trip.settlements.filter((st) => !(st.linkedTransactionId && removedTxIds.includes(st.linkedTransactionId))) }
            : trip
        )
      );
    }
    if (deletedSharedIds.length > 0) {
      triggerCrossAccountSharedTxSync(
        res.updatedTransactions,
        familyMembers,
        deletedSharedIds
      );
    }
    showNotice(
      res.actionDescription ||
        (res.deletedCount > 1
          ? `${res.deletedCount} lançamentos da série removidos.`
          : 'Lançamento removido.'),
      prevSnapshot
    );
  };

  const handleToggleAccountInTotal = (accountId: string) => {
    if (!requireWorkspaceWrite()) return;
    const targetAcc = accounts.find((a) => a.id === accountId);
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === accountId ? { ...acc, includeInTotal: !acc.includeInTotal } : acc
      )
    );
    if (targetAcc) {
      showNotice(
        `Conta "${targetAcc.name}" ${
          targetAcc.includeInTotal ? 'removida do giro mensal' : 'incluída no giro mensal'
        }.`
      );
    }
  };

  return {
    handleAnticipateInstallments,
    handleBatchSettleTransactions,
    handleDeleteTransaction,
    handleDuplicateTransaction,
    handleEditTransaction,
    handleOpenNewTransaction,
    handleReverseAnticipation,
    handleSaveTransactionBatch,
    handleToggleAccountInTotal,
    handleToggleTransactionStatus,
  };
}

export type TransactionActionsApi = ReturnType<typeof useTransactionActions>;
