/** Parcelas em aberto do cartão, antecipação com desconto e reversão. */
import type {
  Transaction,
} from '../../types/finance';
import {
  getClampedMonthDate,
} from '../finance/financeRules';
import {
  stripInstallmentSuffix,
} from './transactionSuggestions.ts';

export interface ActiveInstallmentGroupSummary {
  installmentGroupId: string;
  title: string;
  creditCardId?: string;
  categoryId: string;
  installmentTotal: number;
  currentInstallmentNumber: number;
  futureInstallmentsCount: number;
  futureTotalAmount: number;
  singleInstallmentAmount: number;
  futureTransactions: Transaction[];
  anticipatedCountInMonth: number;
}

export function getFutureUnpaidInstallments(
  transactions: Transaction[],
  installmentGroupId: string | undefined,
  currentCompetenceMonth: string
): Transaction[] {
  if (!installmentGroupId) return [];
  return transactions
    .filter(
      (tx) =>
        tx.installmentGroupId === installmentGroupId &&
        tx.competenceMonth > currentCompetenceMonth &&
        tx.status === 'pending'
    )
    .sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
}

export function getActiveInstallmentGroupsForCard(
  transactions: Transaction[],
  cardId: string | 'all',
  currentCompetenceMonth: string
): ActiveInstallmentGroupSummary[] {
  const groupMap = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if (!tx.installmentGroupId) continue;
    if (cardId !== 'all' && tx.creditCardId !== cardId) continue;
    const list = groupMap.get(tx.installmentGroupId) || [];
    list.push(tx);
    groupMap.set(tx.installmentGroupId, list);
  }

  const summaries: ActiveInstallmentGroupSummary[] = [];

  for (const [groupId, groupTxs] of groupMap.entries()) {
    const sorted = [...groupTxs].sort(
      (a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0)
    );
    const futureTxs = sorted.filter(
      (tx) => tx.competenceMonth > currentCompetenceMonth && tx.status === 'pending'
    );
    const anticipatedInMonth = sorted.filter(
      (tx) =>
        tx.competenceMonth === currentCompetenceMonth &&
        (tx.isAnticipated || tx.description.includes('(Antecipada)'))
    );

    if (futureTxs.length === 0 && anticipatedInMonth.length === 0) continue;

    const currentMonthTx =
      sorted.find(
        (tx) =>
          tx.competenceMonth === currentCompetenceMonth &&
          !tx.isAnticipated &&
          !tx.description.includes('(Antecipada)')
      ) || sorted[0];

    const rawTitle = stripInstallmentSuffix(currentMonthTx.description);
    const futureSum =
      Math.round(futureTxs.reduce((acc, t) => acc + t.amount, 0) * 100) / 100;

    summaries.push({
      installmentGroupId: groupId,
      title: rawTitle || currentMonthTx.description,
      creditCardId: currentMonthTx.creditCardId,
      categoryId: currentMonthTx.categoryId,
      installmentTotal:
        currentMonthTx.installmentTotal || sorted.length || futureTxs.length + 1,
      currentInstallmentNumber: currentMonthTx.installmentNumber || 1,
      futureInstallmentsCount: futureTxs.length,
      futureTotalAmount: futureSum,
      singleInstallmentAmount: futureTxs[0]?.amount || currentMonthTx.amount,
      futureTransactions: futureTxs,
      anticipatedCountInMonth: anticipatedInMonth.length,
    });
  }

  return summaries.sort(
    (a, b) => b.futureTotalAmount - a.futureTotalAmount
  );
}

export function anticipateCardInstallments(
  transactions: Transaction[],
  installmentGroupId: string,
  targetCompetenceMonth: string,
  discountAmount = 0,
  maxCountToAdvance?: number
): {
  updatedTransactions: Transaction[];
  anticipatedCount: number;
  originalSum: number;
  finalSum: number;
} {
  const allFutureTargets = getFutureUnpaidInstallments(
    transactions,
    installmentGroupId,
    targetCompetenceMonth
  );

  const futureTargets =
    typeof maxCountToAdvance === 'number' && maxCountToAdvance > 0
      ? allFutureTargets.slice(0, maxCountToAdvance)
      : allFutureTargets;

  if (futureTargets.length === 0) {
    return {
      updatedTransactions: transactions,
      anticipatedCount: 0,
      originalSum: 0,
      finalSum: 0,
    };
  }

  const targetIds = new Set(futureTargets.map((t) => t.id));
  const originalSum =
    Math.round(futureTargets.reduce((acc, t) => acc + t.amount, 0) * 100) / 100;
  const safeDiscount = Math.max(
    0,
    Math.min(originalSum - 0.01 * futureTargets.length, Number.isFinite(discountAmount) ? discountAmount : 0)
  );
  // Desconto repartido em centavos inteiros: o total descontado é exatamente o informado (sem perder nem criar
  // centavo por arredondamento) e nenhuma parcela fica abaixo de R$ 0,01.
  const totalDiscountCents = Math.round(safeDiscount * 100);
  const discountCentsById = new Map<string, number>(
    futureTargets.map((target) => [target.id, 0])
  );
  let discountLeft = totalDiscountCents;
  const evenShare = Math.floor(totalDiscountCents / futureTargets.length);
  for (const target of futureTargets) {
    const share = Math.min(evenShare, Math.round(target.amount * 100) - 1);
    discountCentsById.set(target.id, Math.max(0, share));
    discountLeft -= Math.max(0, share);
  }
  // Reparte 1 centavo por vez, em ordem, só para parcelas que ainda comportam (mínimo de R$ 0,01 por parcela).
  while (discountLeft > 0) {
    let gave = false;
    for (const target of futureTargets) {
      if (discountLeft <= 0) break;
      const given = discountCentsById.get(target.id) || 0;
      if (Math.round(target.amount * 100) - given > 1) {
        discountCentsById.set(target.id, given + 1);
        discountLeft -= 1;
        gave = true;
      }
    }
    if (!gave) break;
  }

  let finalSum = 0;

  const updatedTransactions = transactions.map((tx) => {
    if (!targetIds.has(tx.id)) return tx;

    const discountedAmount = Math.max(
      0.01,
      (Math.round(tx.amount * 100) - (discountCentsById.get(tx.id) || 0)) / 100
    );
    finalSum = Math.round((finalSum + discountedAmount) * 100) / 100;

    const dayOfPurchase = Number(tx.date.slice(8, 10)) || 15;
    const nextDesc = tx.description.includes('(Antecipada)')
      ? tx.description
      : `${tx.description} (Antecipada)`;

    return {
      ...tx,
      isAnticipated: true,
      originalCompetenceMonth: tx.originalCompetenceMonth || tx.competenceMonth,
      originalDateBeforeAnticipation: tx.originalDateBeforeAnticipation || tx.date,
      originalAmountBeforeDiscount: tx.originalAmountBeforeDiscount || tx.amount,
      amount: discountedAmount,
      // A cota compartilhada nunca pode passar do novo valor da parcela.
      sharedAmount:
        tx.sharedAmount === undefined ? undefined : Math.min(tx.sharedAmount, discountedAmount),
      competenceMonth: targetCompetenceMonth,
      // Dia 31 em mês de 28 dias vira o último dia do mês (nunca uma data inexistente como 2027-02-31).
      date: getClampedMonthDate(targetCompetenceMonth, dayOfPurchase),
      description: nextDesc,
      notes:
        safeDiscount > 0
          ? `Parcela antecipada para ${targetCompetenceMonth} com desconto`
          : `Parcela antecipada para ${targetCompetenceMonth}`,
    };
  });

  return {
    updatedTransactions,
    anticipatedCount: futureTargets.length,
    originalSum,
    finalSum,
  };
}

export function reverseInstallmentAnticipation(
  transactions: Transaction[],
  targetIdOrGroupId: string
): {
  updatedTransactions: Transaction[];
  restoredCount: number;
  /** Parcelas antecipadas que já foram pagas: não são devolvidas (o pagamento precisa ser estornado antes). */
  blockedPaidCount: number;
} {
  let restoredCount = 0;
  let blockedPaidCount = 0;

  const updatedTransactions = transactions.map((tx) => {
    const isMatch =
      tx.id === targetIdOrGroupId || tx.installmentGroupId === targetIdOrGroupId;
    const wasAnticipated =
      tx.isAnticipated || tx.description.includes('(Antecipada)');

    if (!isMatch || !wasAnticipated) return tx;

    // Parcela antecipada já paga: devolver valor e mês mudaria a obrigação já liquidada (pagou com desconto,
    // voltaria a valer o cheio sem dinheiro nenhum para cobrir a diferença).
    if (tx.status === 'paid' || tx.invoicePaymentId) {
      blockedPaidCount += 1;
      return tx;
    }

    restoredCount += 1;
    const restoredMonth = tx.originalCompetenceMonth || tx.competenceMonth;
    const restoredDate =
      tx.originalDateBeforeAnticipation ||
      `${restoredMonth}-${tx.date.slice(8, 10) || '15'}`;
    const restoredAmount = tx.originalAmountBeforeDiscount ?? tx.amount;

    return {
      ...tx,
      isAnticipated: false,
      competenceMonth: restoredMonth,
      date: restoredDate,
      amount: restoredAmount,
      description: tx.description.replace(/\s*\(Antecipada\)/gi, '').trim(),
      originalCompetenceMonth: undefined,
      originalDateBeforeAnticipation: undefined,
      originalAmountBeforeDiscount: undefined,
      notes: undefined,
    };
  });

  return {
    updatedTransactions,
    restoredCount,
    blockedPaidCount,
  };
}

/**
 * Suggestion #5: Weekly Cash Pulse (Pulso Semanal do Mês) for MonthlyCalendarView
 */
