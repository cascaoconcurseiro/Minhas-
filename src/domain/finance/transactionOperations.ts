import type {
  BankAccount,
  CreditCard,
  Transaction,
  TransactionStatus,
} from '../../types/finance';
import {
  addMonthsToYearMonth,
  addMonthsToDateString,
} from './formatting.ts';
import {
  reverseCreditCardInvoicePayment,
} from './creditCardInvoices.ts';
import {
  CreateTransactionBatchInput,
  createTransactionBatch,
} from './transactionBatch.ts';

export type CascadeScope = 'single' | 'this_and_future' | 'all_series';

/**
 * Alterna o status (Pago <-> Pendente) de um lançamento ou série.
 * Se for um pagamento de fatura de cartão (`isInvoicePayment: true`), reverter faz o estorno em cascata:
 * remove o débito da conta bancária e reabre as compras do cartão naquele mês de volta para `pending`.
 */
/**
 * Pode ser efetivado/revertido direto? Compra de cartão não: ela só quita pagando a fatura (que debita a conta).
 * Marcar a compra como paga sem pagar a fatura apagaria a dívida sem sair dinheiro de nenhuma conta.
 */
export function canSettleTransactionDirectly(tx: Transaction): boolean {
  if (tx.receivableId) return false;
  if (tx.isInvoicePayment) return true; // o estorno em cascata tem tratamento próprio
  if (tx.creditCardId) return false;
  // Aporte/resgate de ativo e compra de câmbio mexem em outra posição (carteira, lote): só a operação própria muda isso.
  if (tx.type === 'transfer' && tx.targetInvestmentAssetId) return false;
  if (tx.id.startsWith('tx-fxlot-')) return false;
  return true;
}

export function toggleTransactionStatusWithCascade(
  transactions: Transaction[],
  targetId: string,
  cards: CreditCard[] = [],
  scope: CascadeScope = 'single'
): {
  updatedTransactions: Transaction[];
  actionDescription: string;
  blocked?: boolean;
} {
  const target = transactions.find((t) => t.id === targetId);
  if (!target) {
    return { updatedTransactions: transactions, actionDescription: '' };
  }

  // Caso especial: Estorno em Cascata de Pagamento de Fatura de Cartão
  if (target.isInvoicePayment) {
    const rev = reverseCreditCardInvoicePayment(transactions, target.id, cards);
    return {
      updatedTransactions: rev.updatedTransactions,
      actionDescription: rev.actionDescription,
    };
  }

  if (!canSettleTransactionDirectly(target)) {
    if (target.receivableId) {
      return {
        updatedTransactions: transactions,
        blocked: true,
        actionDescription: 'Corrija este recebimento na aba A Receber.',
      };
    }
    if (target.type === 'transfer' && target.targetInvestmentAssetId) {
      return {
        updatedTransactions: transactions,
        blocked: true,
        actionDescription:
          'Aporte ou resgate de investimento não muda de situação aqui: a carteira de ativos já foi atualizada. Para corrigir, registre a operação inversa na aba Investimentos.',
      };
    }
    if (target.id.startsWith('tx-fxlot-')) {
      return {
        updatedTransactions: transactions,
        blocked: true,
        actionDescription: 'Este lançamento vem de uma compra de câmbio da viagem. Corrija pelo lote na aba Viagens.',
      };
    }
  }

  // Compra de cartão: só a fatura quita. Compra já paga por uma fatura volta a pendente estornando o pagamento da fatura.
  // Compra "paga" sem fatura (histórico antigo errado) pode ser reaberta direto.
  if (target.creditCardId && (target.status === 'pending' || target.invoicePaymentId)) {
    return {
      updatedTransactions: transactions,
      blocked: true,
      actionDescription:
        target.status === 'pending'
          ? 'Compra de cartão só é quitada pagando a fatura (aba Cartões). Marcar como paga aqui não tiraria dinheiro de nenhuma conta.'
          : 'Esta compra foi quitada por um pagamento de fatura. Estorne o pagamento da fatura para reabri-la.',
    };
  }

  const nextStatus: TransactionStatus =
    target.status === 'paid' ? 'pending' : 'paid';

  const groupId = target.installmentGroupId;
  const shouldCascade = scope !== 'single' && Boolean(groupId);

  let affectedCount = 0;
  const updatedTransactions = transactions.map((tx) => {
    if (tx.id === target.id) {
      affectedCount++;
      return { ...tx, status: nextStatus };
    }
    if (shouldCascade && groupId && tx.installmentGroupId === groupId) {
      if (tx.receivableId) return tx;
      if (
        scope === 'all_series' ||
        (scope === 'this_and_future' && tx.competenceMonth >= target.competenceMonth)
      ) {
        affectedCount++;
        return { ...tx, status: nextStatus };
      }
    }
    return tx;
  });

  const actionDescription =
    nextStatus === 'paid'
      ? affectedCount > 1
        ? `${affectedCount} lançamentos da série marcados como Efetivados (Pagos)!`
        : `"${target.description}" marcado como Efetivado (Pago)!`
      : affectedCount > 1
      ? `${affectedCount} lançamentos revertidos para Pendente (Previsto)!`
      : `"${target.description}" revertido para Pendente! O saldo da conta foi recalculado.`;

  return { updatedTransactions, actionDescription };
}

/**
 * Aplica a edição de um lançamento com suporte a Efeito Cascata:
 * - 'single': altera apenas o lançamento selecionado
 * - 'this_and_future': altera este e todos os meses seguintes da mesma série (parcelas ou fixos)
 * - 'all_series': altera todos os lançamentos da série (passados e futuros)
 */
/**
 * Lançamentos ligados a outra operação (aporte/resgate de ativo, compra de câmbio de viagem, compra já quitada por fatura):
 * apagar ou editar só o lançamento deixaria a carteira, o lote ou a fatura em desacordo com a conta.
 */
export function getLinkedOperationRestriction(tx: Transaction, action: 'editar' | 'apagar' | 'duplicar'): string | null {
  if (tx.receivableId) return 'Corrija este movimento na aba A Receber.';
  if (tx.type === 'transfer' && tx.targetInvestmentAssetId) {
    return `Aporte ou resgate de investimento não pode ${action === 'duplicar' ? 'ser duplicado' : `ser ${action === 'editar' ? 'editado' : 'apagado'} aqui`}: a carteira de ativos já foi atualizada. Para corrigir, registre a operação inversa na aba Investimentos.`;
  }
  if (tx.id.startsWith('tx-fxlot-')) {
    return `Este lançamento vem de uma compra de câmbio da viagem. Para ${action === 'duplicar' ? 'repetir' : 'corrigir'}, use o lote na aba Viagens (remover e registrar de novo).`;
  }
  if (tx.invoicePaymentId && tx.creditCardId && tx.status === 'paid') {
    return `Esta compra foi quitada por um pagamento de fatura. Estorne o pagamento da fatura antes de ${action === 'duplicar' ? 'duplicar' : action === 'editar' ? 'editar' : 'apagar'} a compra.`;
  }
  return null;
}

export function getTransactionEditRestriction(tx: Transaction): string | null {
  if (tx.isInvoicePayment) return 'Estorne o pagamento da fatura antes de corrigir seus dados.';
  const linked = getLinkedOperationRestriction(tx, 'editar');
  if (linked) return linked;
  if (tx.id.startsWith('tx-reimb-') || (tx.isShared && tx.sharedStatus === 'received')) {
    return 'Reabra o acerto em Compartilhado antes de editar, para estornar o movimento vinculado.';
  }
  return null;
}

/** Em lançamentos compartilhados, só quem criou pode editar tudo. */
export function isSharedTransactionCreatedByOther(tx: Transaction, currentUserEmail?: string | null): boolean {
  if (tx.id.startsWith('tx-mirror-')) return true;
  const origin = tx.sharedOriginEmail?.trim().toLowerCase();
  if (!tx.isShared || !origin) return false;
  return origin !== (currentUserEmail || '').trim().toLowerCase();
}

export function duplicateFinancialTransaction(tx: Transaction, id: string): Transaction | null {
  if (tx.receivableId) return null;
  if (tx.isInvoicePayment || tx.id.startsWith('tx-reimb-') || tx.id.startsWith('tx-mirror-')) return null;
  if (tx.type === 'transfer' && tx.targetInvestmentAssetId) return null;
  if (tx.id.startsWith('tx-fxlot-')) return null;
  const copy: Transaction = { ...tx, id, description: `${tx.description} (Cópia)`,
    status: tx.creditCardId ? 'pending' : 'paid', recurrence: 'single' };
  for (const field of ['installmentGroupId', 'installmentNumber', 'installmentTotal', 'installmentPurchaseTotal',
    'invoicePaymentId', 'partialSplitOriginalId', 'settledCardId', 'settledInvoiceMonth', 'isInvoicePayment',
    'isAnticipated', 'originalCompetenceMonth', 'originalDateBeforeAnticipation', 'originalAmountBeforeDiscount',
    'sharedSyncId', 'sharedOriginEmail', 'sharedTargetEmail', 'sharedSettlementId', 'sharedSettledDate', 'sharedSettledAccountId', 'sharedRemoteStatus', 'sharedRemoteSettledDate',
    'fitid', 'importBatchId', 'reconciled'] as const) delete copy[field];
  if (copy.isShared) copy.sharedStatus = 'pending';
  return copy;
}

/**
 * Mudar o tipo de repetição (único, fixo, parcelado) ou o número de parcelas de um lançamento já criado é refazer a
 * série inteira. Só é seguro quando nada da série já foi liquidado ou ligado a outra operação; senão o dinheiro
 * (pagamento de fatura, antecipação, extrato importado) ficaria em desacordo com as novas parcelas.
 */
export function getSeriesRebuildBlocker(transactions: Transaction[], targetId: string): string | null {
  const target = transactions.find((tx) => tx.id === targetId);
  if (!target) return 'Lançamento não encontrado.';
  const rows = target.installmentGroupId
    ? transactions.filter((tx) => tx.installmentGroupId === target.installmentGroupId)
    : [target];
  const blockedByLink = rows.some((tx) =>
    getTransactionEditRestriction(tx) !== null || tx.invoicePaymentId || tx.partialSplitOriginalId || tx.id.includes('-paid-') ||
    tx.isAnticipated || tx.fitid || (tx.isShared && tx.sharedStatus === 'received'));
  const hasPaid = rows.some((tx) => tx.status === 'paid' && (tx.creditCardId || rows.length > 1));
  if (blockedByLink || hasPaid) {
    return 'Para mudar o número de parcelas ou o tipo de repetição, a série não pode ter parcelas já pagas, antecipadas, divididas por pagamento parcial ou vindas de extrato. Estorne o pagamento da fatura (ou desfaça a antecipação) antes.';
  }
  return null;
}

/**
 * Muda só a quantidade de meses de um lançamento FIXO sem mexer no que já existe: aumentar acrescenta meses
 * "previstos" depois do último; diminuir tira meses do fim, e só se ainda estiverem pendentes.
 */
export function adjustFixedSeriesLength(
  transactions: Transaction[],
  targetId: string,
  newCount: number
): { updatedTransactions: Transaction[]; addedCount: number; removedCount: number; removedSharedSyncIds: string[]; error?: string } {
  const fail = (error: string) => ({ updatedTransactions: transactions, addedCount: 0, removedCount: 0, removedSharedSyncIds: [], error });
  const target = transactions.find((tx) => tx.id === targetId);
  if (!target || !target.installmentGroupId || target.recurrence !== 'fixed') return fail('Este lançamento não é uma série fixa.');
  if (!Number.isInteger(newCount) || newCount < 1 || newCount > 36) return fail('Escolha de 1 a 36 meses.');
  const rows = transactions
    .filter((tx) => tx.installmentGroupId === target.installmentGroupId)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (newCount === rows.length) return { updatedTransactions: transactions, addedCount: 0, removedCount: 0, removedSharedSyncIds: [] };
  if (newCount > rows.length) {
    const last = rows[rows.length - 1];
    const added: Transaction[] = [];
    for (let i = 1; i <= newCount - rows.length; i += 1) {
      const clone: Transaction = {
        ...last,
        id: `tx-${Date.now()}-fix-ext-${i}-${Math.random().toString(36).slice(2, 6)}`,
        date: addMonthsToDateString(last.date, i),
        competenceMonth: addMonthsToYearMonth(last.competenceMonth, i),
        status: 'pending',
        sharedSyncId: undefined,
        sharedSettlementId: undefined,
        sharedSettledDate: undefined,
        sharedSettledAccountId: undefined,
        invoicePaymentId: undefined,
        fitid: undefined,
        reconciled: undefined,
        importBatchId: undefined,
        sharedStatus: last.isShared ? 'pending' : undefined,
      };
      added.push(clone);
    }
    return { updatedTransactions: [...transactions, ...added], addedCount: added.length, removedCount: 0, removedSharedSyncIds: [] };
  }
  const toRemove = rows.slice(newCount);
  if (toRemove.some((tx) => tx.status === 'paid' || tx.invoicePaymentId || (tx.isShared && tx.sharedStatus === 'received'))) {
    return fail('Os últimos meses da série já foram pagos ou acertados; só dá para reduzir meses que ainda estão pendentes.');
  }
  const removeIds = new Set(toRemove.map((tx) => tx.id));
  return {
    updatedTransactions: transactions.filter((tx) => !removeIds.has(tx.id)),
    addedCount: 0,
    removedCount: toRemove.length,
    removedSharedSyncIds: toRemove.filter((tx) => tx.isShared).map((tx) => tx.sharedSyncId || tx.id),
  };
}

/**
 * Ao apagar uma viagem, o dinheiro que já saiu da conta para comprar moeda continua no extrato: o lançamento só
 * deixa de ser "do lote" (passa de `tx-fxlot-` para `tx-fxkept-`), podendo ser editado ou apagado normalmente.
 */
export function releaseExchangeLotMovements(transactions: Transaction[], lotIds: string[]): Transaction[] {
  const wanted = new Set(lotIds.map((id) => `tx-fxlot-${id}`));
  return transactions.map((tx) =>
    wanted.has(tx.id)
      ? { ...tx, id: tx.id.replace('tx-fxlot-', 'tx-fxkept-'), notes: `${tx.notes || ''} (viagem removida; o dinheiro da compra de câmbio foi mantido)`.trim() }
      : tx
  );
}

/** Substitui o lançamento (ou a série dele) por uma série nova gerada a partir do formulário, na mesma posição da lista. */
export function rebuildTransactionSeries(
  transactions: Transaction[],
  targetId: string,
  input: CreateTransactionBatchInput
): {
  updatedTransactions: Transaction[];
  removedCount: number;
  createdCount: number;
  removedSharedSyncIds: string[];
  error?: string;
} {
  const blocker = getSeriesRebuildBlocker(transactions, targetId);
  if (blocker) {
    return { updatedTransactions: transactions, removedCount: 0, createdCount: 0, removedSharedSyncIds: [], error: blocker };
  }
  const target = transactions.find((tx) => tx.id === targetId)!;
  const removedIds = new Set(
    (target.installmentGroupId
      ? transactions.filter((tx) => tx.installmentGroupId === target.installmentGroupId)
      : [target]).map((tx) => tx.id)
  );
  const created = createTransactionBatch(input);
  const updatedTransactions: Transaction[] = [];
  let inserted = false;
  for (const tx of transactions) {
    if (removedIds.has(tx.id)) {
      if (!inserted) {
        updatedTransactions.push(...created);
        inserted = true;
      }
      continue;
    }
    updatedTransactions.push(tx);
  }
  const removedSharedSyncIds = transactions
    .filter((tx) => removedIds.has(tx.id) && tx.isShared)
    .map((tx) => tx.sharedSyncId || tx.id);
  return { updatedTransactions, removedCount: removedIds.size, createdCount: created.length, removedSharedSyncIds };
}

export function applyCascadeTransactionEdit(
  transactions: Transaction[],
  editedTx: Transaction,
  scope: CascadeScope = 'single'
): {
  updatedTransactions: Transaction[];
  affectedCount: number;
  error?: string;
} {
  const original = transactions.find((t) => t.id === editedTx.id);
  const restriction = original ? getTransactionEditRestriction(original) : null;
  if (restriction) return { updatedTransactions: transactions, affectedCount: 0, error: restriction };
  const isPurchaseTotalEdit = Boolean(
    original && original.recurrence === 'installment' && Number.isFinite(editedTx.installmentPurchaseTotal)
  );
  if (!original || (scope === 'single' && !isPurchaseTotalEdit) || !original.installmentGroupId) {
    return {
      updatedTransactions: transactions.map((t) =>
        t.id === editedTx.id ? editedTx : t
      ),
      affectedCount: 1,
    };
  }

  const groupId = original.installmentGroupId;
  const groupTransactions = transactions
    .filter((tx) => tx.installmentGroupId === groupId)
    .sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
  if (groupTransactions.some((tx) => tx.receivableId)) {
    return { updatedTransactions: transactions, affectedCount: 0, error: 'Corrija este movimento na aba A Receber.' };
  }
  if (isPurchaseTotalEdit) {
    const inScope = (tx: Transaction) =>
      scope === 'all_series' ||
      (scope === 'this_and_future' && tx.competenceMonth >= original.competenceMonth) ||
      (scope === 'single' && tx.id === original.id);
    const logicalInstallments = new Map<string, Transaction[]>();
    for (const tx of groupTransactions) {
      const key = tx.installmentNumber === undefined ? tx.id : String(tx.installmentNumber);
      logicalInstallments.set(key, [...(logicalInstallments.get(key) || []), tx]);
    }
    const recalculatedInstallments = [...logicalInstallments.values()].filter(
      (rows) => rows.length === 1 && rows[0].status !== 'paid' && inScope(rows[0])
    );
    const recalculatedIds = new Set(recalculatedInstallments.map((rows) => rows[0].id));
    const fixedCents = groupTransactions
      .filter((tx) => !recalculatedIds.has(tx.id))
      .reduce((sum, tx) => sum + Math.round(tx.amount * 100), 0);
    const requestedCents = Math.round((editedTx.installmentPurchaseTotal || 0) * 100);
    const amountToAllocate = requestedCents - fixedCents;

    if (amountToAllocate < 0) {
      return {
        updatedTransactions: transactions,
        affectedCount: 0,
        error: 'O total da compra não pode ficar abaixo das parcelas já preservadas.',
      };
    }
    if (recalculatedInstallments.length === 0 && amountToAllocate > 0) {
      return {
        updatedTransactions: transactions,
        affectedCount: 0,
        error: 'Não há parcelas pendentes para ajustar o total desta compra.',
      };
    }

    const baseCents = recalculatedInstallments.length > 0
      ? Math.floor(amountToAllocate / recalculatedInstallments.length)
      : 0;
    const remainderCents = amountToAllocate - baseCents * recalculatedInstallments.length;
    const amountById = new Map(
      recalculatedInstallments.map((rows, index) => [
        rows[0].id,
        (baseCents + (index < remainderCents ? 1 : 0)) / 100,
      ])
    );
    const sharedById = new Map<string, number>();
    const adjustableShares = groupTransactions.filter((tx) => amountById.has(tx.id) && tx.sharedStatus !== 'received');
    if (groupTransactions.some((tx) => tx.sharedStatus === 'received' && amountById.has(tx.id) && (tx.sharedAmount || 0) > (amountById.get(tx.id) || 0))) {
      return { updatedTransactions: transactions, affectedCount: 0, error: 'O valor da parcela não pode ficar abaixo de uma cota compartilhada já acertada.' };
    }
    if (editedTx.isShared) {
      const requestedShare = Math.round((editedTx.sharedAmount || 0) * 100);
      const adjustableIds = new Set(adjustableShares.map((tx) => tx.id));
      const preservedShare = groupTransactions.filter((tx) => !adjustableIds.has(tx.id))
        .reduce((sum, tx) => sum + Math.round((tx.sharedAmount || 0) * 100), 0);
      const remainingShare = requestedShare - preservedShare;
      const capacities = adjustableShares.map((tx) => ({ id: tx.id, cents: Math.round((amountById.get(tx.id) || 0) * 100) }));
      const capacity = capacities.reduce((sum, row) => sum + row.cents, 0);
      if (!Number.isSafeInteger(requestedShare) || remainingShare < 0 || remainingShare > capacity) {
        return { updatedTransactions: transactions, affectedCount: 0, error: 'A cota compartilhada precisa preservar os acertos existentes e caber nas parcelas pendentes.' };
      }
      if (capacity > 0) {
        const allocated = capacities.map((row) => {
          const product = BigInt(remainingShare) * BigInt(row.cents);
          return { ...row, amount: Number(product / BigInt(capacity)), remainder: product % BigInt(capacity) };
        });
        let rest = remainingShare - allocated.reduce((sum, row) => sum + row.amount, 0);
        allocated.sort((a, b) => a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : 0);
        for (const row of allocated) {
          if (rest > 0 && row.amount < row.cents) { row.amount++; rest--; }
          sharedById.set(row.id, row.amount / 100);
        }
      }
    }
    const sharedFields = (tx: Transaction) => {
      if (!adjustableShares.some((row) => row.id === tx.id)) {
        return { isShared: tx.isShared, sharedMemberId: tx.sharedMemberId, sharedAmount: tx.sharedAmount,
          sharedPaidBy: tx.sharedPaidBy, sharedSplitMode: tx.sharedSplitMode, sharedStatus: tx.sharedStatus };
      }
      return { isShared: editedTx.isShared, sharedMemberId: editedTx.isShared ? editedTx.sharedMemberId : undefined,
        sharedAmount: editedTx.isShared ? sharedById.get(tx.id) || 0 : undefined,
        sharedPaidBy: editedTx.isShared ? editedTx.sharedPaidBy : undefined,
        sharedSplitMode: editedTx.isShared ? editedTx.sharedSplitMode : undefined,
        sharedStatus: editedTx.isShared ? 'pending' as const : undefined };
    };
    const getScheduledDates = (tx: Transaction) => {
      if (!inScope(tx) || tx.installmentNumber === undefined) return {};
      const monthOffset = tx.installmentNumber - (editedTx.installmentNumber || tx.installmentNumber);
      return {
        date: addMonthsToDateString(editedTx.date, monthOffset),
        competenceMonth: addMonthsToYearMonth(editedTx.competenceMonth, monthOffset),
      };
    };
    const updatedIds = new Set<string>();
    const updatedTransactions = transactions.map((tx) => {
      if (tx.installmentGroupId !== groupId) return tx;
      const isEdited = tx.id === editedTx.id;
      const isInScope = inScope(tx);
      if (isEdited || isInScope) updatedIds.add(tx.id);
      const amount = amountById.get(tx.id);
      if (isEdited) {
        return {
          ...editedTx,
          amount: amount ?? tx.amount,
          installmentPurchaseTotal: requestedCents / 100,
          ...sharedFields(tx),
          ...getScheduledDates(tx),
        };
      }
      return {
        ...tx,
        ...(isInScope
          ? {
              description: editedTx.description,
              categoryId: editedTx.categoryId,
              accountId: editedTx.accountId,
              destinationAccountId: editedTx.destinationAccountId,
              creditCardId: editedTx.creditCardId,
              paymentMethod: editedTx.paymentMethod,
              notes: editedTx.notes,
              tags: editedTx.tags,
            }
          : {}),
        ...(amount !== undefined ? { amount } : {}),
        ...sharedFields(tx),
        installmentPurchaseTotal: requestedCents / 100,
        ...getScheduledDates(tx),
      };
    });
    return { updatedTransactions, affectedCount: updatedIds.size };
  }

  let affectedCount = 0;
  const monthIndex = (month: string) => {
    const [year, monthNumber] = month.split('-').map(Number);
    return year * 12 + monthNumber - 1;
  };

  const updatedTransactions = transactions.map((tx) => {
    if (tx.id === editedTx.id) {
      affectedCount++;
      return editedTx;
    }

    if (tx.installmentGroupId === groupId) {
      const inScope =
        scope === 'all_series' ||
        (scope === 'this_and_future' &&
          tx.competenceMonth >= original.competenceMonth);

      if (inScope) {
        affectedCount++;
        const monthOffset = monthIndex(tx.competenceMonth) - monthIndex(original.competenceMonth);
        return {
          ...tx,
          description: editedTx.description,
          amount: editedTx.amount,
          categoryId: editedTx.categoryId,
          accountId: editedTx.accountId,
          destinationAccountId: editedTx.destinationAccountId,
          creditCardId: editedTx.creditCardId,
          paymentMethod: editedTx.paymentMethod,
          notes: editedTx.notes,
          tags: editedTx.tags,
          date: addMonthsToDateString(editedTx.date, monthOffset),
          competenceMonth: addMonthsToYearMonth(editedTx.competenceMonth, monthOffset),
        };
      }
    }
    return tx;
  });

  return { updatedTransactions, affectedCount };
}

/**
 * Exclui um lançamento isoladamente ou em Efeito Cascata:
 * - Se for um pagamento de fatura (`isInvoicePayment: true`), refaz automaticamente o Efeito Cascata:
 *   devolve o saldo para a conta bancária e reabre todas as compras da fatura do cartão naquele mês como Pendentes.
 * - Se for um reembolso de despesa compartilhada (`tx-reimb-`), reabre as despesas compartilhadas vinculadas como Pendentes.
 * - Se for uma série parcelada/recorrente com escopo de série, remove os lançamentos vinculados.
 */
export function getSharedSettlementLinks(transactions: Transaction[], target: Transaction): Set<string> {
  const ids = new Set([target.id]);
  for (const tx of transactions) {
    if (target.sharedSettlementId && tx.sharedSettlementId === target.sharedSettlementId) ids.add(tx.id);
    if (tx.id.startsWith('tx-reimb-') && (tx.id === target.id || tx.notes?.includes(`[ref:${target.id}]`))) {
      ids.add(tx.id);
      for (const match of tx.notes?.matchAll(/\[ref:([^\]]+)\]/g) || []) ids.add(match[1]);
    }
  }
  return ids;
}

export function applyCascadeTransactionDelete(
  transactions: Transaction[],
  targetId: string,
  scope: CascadeScope = 'single',
  cards: CreditCard[] = []
): {
  updatedTransactions: Transaction[];
  deletedCount: number;
  cascadeReopenedCount?: number;
  actionDescription?: string;
} {
  const target = transactions.find((t) => t.id === targetId);
  if (!target) {
    return { updatedTransactions: transactions, deletedCount: 0 };
  }

  // 1. Efeito Cascata Automático ao apagar um Pagamento de Fatura de Cartão
  if (target.isInvoicePayment) {
    const rev = reverseCreditCardInvoicePayment(transactions, target.id, cards);
    return {
      updatedTransactions: rev.updatedTransactions,
      deletedCount: rev.actionDescription.startsWith('Não foi possível estornar') ? 0 : 1,
      cascadeReopenedCount: rev.restoredCardCount,
      actionDescription: rev.actionDescription,
    };
  }

  const deleting = new Set(transactions.filter((tx) => tx.id === target.id ||
    (scope !== 'single' && target.installmentGroupId && tx.installmentGroupId === target.installmentGroupId &&
      (scope === 'all_series' || tx.competenceMonth >= target.competenceMonth))).map((tx) => tx.id));
  const linked = new Set<string>();
  for (const tx of transactions) {
    if (deleting.has(tx.id) && (tx.isShared || tx.id.startsWith('tx-reimb-'))) {
      for (const id of getSharedSettlementLinks(transactions, tx)) linked.add(id);
    }
  }
  for (const tx of transactions) {
    if (linked.has(tx.id) && tx.id.startsWith('tx-reimb-')) deleting.add(tx.id);
  }
  for (const tx of transactions) {
    if (!deleting.has(tx.id)) continue;
    const blocked = getLinkedOperationRestriction(tx, 'apagar');
    if (blocked) {
      return { updatedTransactions: transactions, deletedCount: 0, actionDescription: blocked };
    }
  }
  let reopened = 0;
  const updatedTransactions = transactions.filter((tx) => !deleting.has(tx.id)).map((tx) => {
    if (!linked.has(tx.id) || !tx.isShared || tx.sharedStatus !== 'received') return tx;
    reopened++;
    return { ...tx, sharedStatus: 'pending' as const, sharedSettledDate: undefined,
      sharedSettledAccountId: undefined, sharedSettlementId: undefined };
  });
  return { updatedTransactions, deletedCount: transactions.length - updatedTransactions.length,
    cascadeReopenedCount: reopened,
    actionDescription: `Lançamento(s) removido(s): ${transactions.length - updatedTransactions.length}. ${reopened} despesa(s) compartilhada(s) reaberta(s).` };
}

export interface CascadeAccountDeleteResult {
  updatedAccounts: BankAccount[];
  updatedCards: CreditCard[];
  updatedTransactions: Transaction[];
  deletedAccount?: BankAccount;
  deletedTransactionCount: number;
  error?: string;
}

export function applyCascadeAccountDelete(
  accounts: BankAccount[],
  cards: CreditCard[],
  transactions: Transaction[],
  accountId: string
): CascadeAccountDeleteResult {
  const deletedAccount = accounts.find((account) => account.id === accountId);
  if (!deletedAccount) {
    return {
      updatedAccounts: accounts,
      updatedCards: cards,
      updatedTransactions: transactions,
      deletedTransactionCount: 0,
    };
  }

  const otherAccounts = accounts.filter((account) => account.id !== accountId);
  const fallback = otherAccounts.find(
    (account) =>
      (account.currency || 'BRL') === (deletedAccount.currency || 'BRL') &&
      account.includeInTotal === deletedAccount.includeInTotal
  );
  if (otherAccounts.length > 0 && !fallback) {
    return {
      updatedAccounts: accounts,
      updatedCards: cards,
      updatedTransactions: transactions,
      deletedTransactionCount: 0,
      error: 'Não há outra conta com a mesma moeda e a mesma regra de inclusão nos totais para receber o histórico e o saldo inicial.',
    };
  }
  if (!fallback) {
    const hasLinkedTransactions = transactions.some(
      (tx) =>
        tx.accountId === accountId ||
        tx.destinationAccountId === accountId ||
        tx.sharedSettledAccountId === accountId
    );
    if (
      hasLinkedTransactions ||
      deletedAccount.initialBalance !== 0 ||
      (deletedAccount.initialBalanceForeign || 0) !== 0
    ) {
      return {
        updatedAccounts: accounts,
        updatedCards: cards,
        updatedTransactions: transactions,
        deletedTransactionCount: 0,
        error: 'Esta é a última conta e ainda tem saldo ou lançamentos vinculados. Mantenha-a para preservar o histórico financeiro.',
      };
    }
  }
  let deletedTransactionCount = 0;
  const updatedTransactions = transactions
    .filter((tx) => {
      if (tx.type !== 'transfer') return true;
      if (!fallback) {
        const remove = tx.accountId === accountId || tx.destinationAccountId === accountId;
        if (remove) deletedTransactionCount++;
        return !remove;
      }

      const nextOrigin = tx.accountId === accountId ? fallback.id : tx.accountId;
      const nextDestination =
        tx.destinationAccountId === accountId ? fallback.id : tx.destinationAccountId;
      const remove = Boolean(nextOrigin && nextDestination && nextOrigin === nextDestination);
      if (remove) deletedTransactionCount++;
      return !remove;
    })
    .map((tx) => {
      if (tx.type === 'transfer') {
        return {
          ...tx,
          accountId: tx.accountId === accountId ? fallback?.id : tx.accountId,
          destinationAccountId:
            tx.destinationAccountId === accountId ? fallback?.id : tx.destinationAccountId,
        };
      }

      return {
        ...tx,
        accountId: tx.accountId === accountId ? fallback?.id : tx.accountId,
        sharedSettledAccountId:
          tx.sharedSettledAccountId === accountId
            ? fallback?.id
            : tx.sharedSettledAccountId,
      };
    });

  return {
    updatedAccounts: fallback
      ? accounts
          .filter((account) => account.id !== accountId)
          .map((account) =>
            account.id === fallback.id
              ? {
                  ...account,
                  initialBalance:
                    Math.round((account.initialBalance + deletedAccount.initialBalance) * 100) / 100,
                  initialBalanceForeign:
                    account.initialBalanceForeign === undefined &&
                    deletedAccount.initialBalanceForeign === undefined
                      ? undefined
                      : Math.round(
                          ((account.initialBalanceForeign || 0) +
                            (deletedAccount.initialBalanceForeign || 0)) *
                            100
                        ) / 100,
                }
              : account
          )
      : accounts.filter((account) => account.id !== accountId),
    updatedCards: cards.map((card) =>
      card.defaultAccountId === accountId
        ? { ...card, defaultAccountId: fallback?.id ?? '' }
        : card
    ),
    updatedTransactions,
    deletedAccount,
    deletedTransactionCount,
  };
}
