import type {
  CreditCard,
  CreditCardSummary,
  Transaction,
  TransactionStatus,
} from '../../types/finance';
import {
  formatBRL,
  getLocalDateISO,
  addMonthsToYearMonth,
} from './formatting.ts';
import {
  mapTripAmounts,
  mergeTripAmounts,
} from './transactionBatch.ts';
import {
  isCreditCardInvoicePurchase,
} from './transactionClassification.ts';

export function calculateCreditCardSummary(
  card: CreditCard | undefined | null,
  transactions: Transaction[],
  selectedMonth: string,
  referenceDate: string = getLocalDateISO()
): CreditCardSummary {
  if (!card) {
    return {
      cardId: '',
      invoiceMonth: selectedMonth,
      invoiceTotal: 0,
      invoicePaidAmount: 0,
      invoicePendingAmount: 0,
      isInvoicePaid: false,
      usedLimit: 0,
      availableLimit: 0,
      usagePercent: 0,
      transactions: [],
    };
  }

  const cardAllTx = transactions.filter(
    (tx) =>
      tx.creditCardId === card.id &&
      isCreditCardInvoicePurchase(tx)
  );
  const monthTx = cardAllTx
    .filter((tx) => tx.competenceMonth === selectedMonth)
    // Ordem cronológica: da compra mais antiga para a mais recente (empate: pela ordem original dos lançamentos).
    .sort((a, b) => a.date.localeCompare(b.date));

  let invoiceTotal = 0;
  let invoicePaidAmount = 0;
  let invoicePendingAmount = 0;

  for (const tx of monthTx) {
    invoiceTotal += tx.amount;
    if (tx.status === 'paid') {
      invoicePaidAmount += tx.amount;
    } else {
      invoicePendingAmount += tx.amount;
    }
  }

  const usedLimit = cardAllTx
    .filter((tx) => tx.status === 'pending' && (tx.recurrence !== 'fixed' || tx.date <= referenceDate))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const availableLimit = Math.max(0, card.limit - usedLimit);
  const usagePercent =
    card.limit > 0 ? Math.min(100, Math.round((usedLimit / card.limit) * 1000) / 10) : 0;

  return {
    cardId: card.id,
    invoiceMonth: selectedMonth,
    invoiceTotal: Math.round(invoiceTotal * 100) / 100,
    invoicePaidAmount: Math.round(invoicePaidAmount * 100) / 100,
    invoicePendingAmount: Math.round(invoicePendingAmount * 100) / 100,
    isInvoicePaid: monthTx.length > 0 && invoicePendingAmount === 0,
    usedLimit: Math.round(usedLimit * 100) / 100,
    availableLimit: Math.round(availableLimit * 100) / 100,
    usagePercent,
    transactions: monthTx,
  };
}

export function payCreditCardInvoice(
  card: CreditCard,
  transactions: Transaction[],
  invoiceMonth: string,
  paymentAccountId: string,
  paymentDate: string,
  customPaymentAmount?: number
): Transaction[] {
  const pendingInMonth = transactions.filter(
    (tx) =>
      tx.creditCardId === card.id &&
      tx.competenceMonth === invoiceMonth &&
      tx.status === 'pending' &&
      isCreditCardInvoicePurchase(tx)
  );

  const totalPending = Math.round(
    pendingInMonth.reduce((sum, tx) => sum + tx.amount, 0) * 100
  ) / 100;

  if (totalPending <= 0) {
    return transactions;
  }

  const normalizedPaymentAmount = customPaymentAmount === undefined
    ? undefined
    : Math.round(customPaymentAmount * 100) / 100;

  if (
    customPaymentAmount !== undefined &&
    (!Number.isFinite(customPaymentAmount) ||
      normalizedPaymentAmount! <= 0 ||
      normalizedPaymentAmount! > totalPending)
  ) {
    return transactions;
  }

  const isPartial =
    normalizedPaymentAmount !== undefined &&
    normalizedPaymentAmount < totalPending;

  const targetPayAmount = isPartial ? normalizedPaymentAmount! : totalPending;
  let paymentTimestamp = Date.now();
  let invoicePaymentId = `tx-inv-${card.id}-${invoiceMonth}-${paymentTimestamp}`;
  while (transactions.some((tx) => tx.id === invoicePaymentId)) {
    invoicePaymentId = `tx-inv-${card.id}-${invoiceMonth}-${++paymentTimestamp}`;
  }

  let remainingToSettle = targetPayAmount;
  const paidById = new Map<string, Transaction[]>();

  for (const tx of pendingInMonth.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    if (isPartial && remainingToSettle <= 0.001) break;
    const updatedTransactions: Transaction[] = [];
    if (!isPartial) {
      updatedTransactions.push({ ...tx, status: 'paid' as TransactionStatus, invoicePaymentId } as Transaction);
    } else if (tx.amount <= remainingToSettle + 0.001) {
      remainingToSettle = Math.round((remainingToSettle - tx.amount) * 100) / 100;
      updatedTransactions.push({ ...tx, status: 'paid' as TransactionStatus, invoicePaymentId } as Transaction);
    } else {
      const paidPart = Math.round(remainingToSettle * 100) / 100;
      const unpaidRemainder = Math.round((tx.amount - paidPart) * 100) / 100;
      const sharedPaidPart =
        tx.sharedAmount === undefined
          ? undefined
          : Math.round((tx.sharedAmount * (paidPart / tx.amount)) * 100) / 100;
      const sharedUnpaidRemainder =
        tx.sharedAmount === undefined
          ? undefined
          : Math.round((tx.sharedAmount - (sharedPaidPart || 0)) * 100) / 100;
      remainingToSettle = 0;
      // Valores de viagem em moeda estrangeira acompanham a fração paga; o resto fica na fração em aberto.
      const wholeCents = Math.round(tx.amount * 100);
      const paidCents = Math.round(paidPart * 100);
      const paidTripPart = mapTripAmounts(tx, (value) => Math.round((value * paidCents) / wholeCents));
      const unpaidTripPart = mapTripAmounts(tx, (value) => value - Math.round((value * paidCents) / wholeCents));
      updatedTransactions.push({
        ...tx,
        ...paidTripPart,
        id: `${tx.id}-paid-${paymentTimestamp}`,
        description: `${tx.description} (Abatimento Parcial)`,
        amount: paidPart,
        sharedAmount: sharedPaidPart,
        status: 'paid' as TransactionStatus,
        invoicePaymentId,
        partialSplitOriginalId: tx.id,
      } as Transaction);
      updatedTransactions.push({
        ...tx,
        ...unpaidTripPart,
        amount: unpaidRemainder,
        sharedAmount: sharedUnpaidRemainder,
        status: 'pending' as TransactionStatus,
      });
    }
    paidById.set(tx.id, updatedTransactions);
  }

  const paymentCashMonth = /^\d{4}-\d{2}-\d{2}$/.test(paymentDate)
    ? paymentDate.slice(0, 7)
    : invoiceMonth;
  const invoicePaymentTx: Transaction = {
    id: invoicePaymentId,
    description: isPartial
      ? `Pagamento Parcial Fatura ${card.name} (${invoiceMonth})`
      : `Pagamento Fatura ${card.name} (${invoiceMonth})`,
    amount: targetPayAmount,
    date: paymentDate,
    competenceMonth: paymentCashMonth,
    type: 'expense',
    status: 'paid',
    categoryId: 'cat-fatura',
    accountId: paymentAccountId,
    paymentMethod: 'boleto',
    recurrence: 'single',
    isInvoicePayment: true,
    settledCardId: card.id,
    settledInvoiceMonth: invoiceMonth,
    notes: isPartial
      ? `Abatimento parcial de fatura (${formatBRL(targetPayAmount)} de ${formatBRL(totalPending)})`
      : 'Baixa integral automática de fatura de cartão de crédito',
  };

  return [invoicePaymentTx, ...transactions.flatMap((tx) => paidById.get(tx.id) ?? [tx])];
}

/**
 * Determina o mês de vencimento da fatura em que a compra será cobrada (`YYYY-MM`).
 * Primeiro localiza o fechamento aplicável e então considera se o vencimento cai
 * antes ou depois do fechamento no calendário. Ex.: fecha dia 20 e vence dia 5:
 * compras até dia 20 vencem no mês seguinte; compras após dia 20 vencem em dois meses.
 */
export function resolveCreditCardInvoiceMonth(
  purchaseDate: string,
  card?: Pick<CreditCard, 'closingDay'> & Partial<Pick<CreditCard, 'dueDay' | 'closingDayStartsNextInvoice'>> | null
): string {
  const yearMonth =
    typeof purchaseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)
      ? purchaseDate.slice(0, 7)
      : getLocalDateISO().slice(0, 7);
  if (!card || !card.closingDay) {
    return yearMonth;
  }
  const dayPart = Number(typeof purchaseDate === 'string' ? purchaseDate.slice(8, 10) : NaN);
  const purchaseAfterClosing =
    Number.isFinite(dayPart) &&
    (dayPart > card.closingDay || (Boolean(card.closingDayStartsNextInvoice) && dayPart === card.closingDay));
  const dueDay = card.dueDay ?? card.closingDay + 1;
  const invoiceDueAfterClosingMonth = dueDay <= card.closingDay;
  const monthOffset = Number(purchaseAfterClosing) + Number(invoiceDueAfterClosingMonth);
  return addMonthsToYearMonth(yearMonth, monthOffset);
}

/**
 * Quando o dono muda a regra do dia de fechamento do cartão, move para a fatura certa as compras
 * pendentes feitas exatamente no dia do fechamento. Só mexe no que seguia a regra antiga
 * (mês de competência igual ao que a regra antiga calculava), então ajustes manuais ficam intactos.
 * Parcelamentos, pagamentos de fatura e valores a receber não são alterados.
 */
export function reclassifyClosingDayPurchases(
  transactions: Transaction[],
  oldCard: CreditCard,
  newCard: CreditCard
): Transaction[] {
  const closing = String(newCard.closingDay).padStart(2, '0');
  return transactions.map((tx) => {
    if (
      tx.creditCardId !== newCard.id ||
      tx.type !== 'expense' ||
      tx.status !== 'pending' ||
      tx.isInvoicePayment ||
      tx.receivableId ||
      tx.id.startsWith('tx-cardinv-') ||
      tx.installmentGroupId ||
      tx.date.slice(8, 10) !== closing
    ) {
      return tx;
    }
    if (tx.competenceMonth !== resolveCreditCardInvoiceMonth(tx.date, oldCard)) return tx;
    const next = resolveCreditCardInvoiceMonth(tx.date, newCard);
    return next === tx.competenceMonth ? tx : { ...tx, competenceMonth: next };
  });
}

/** Returns purchases and invoice payments tied to a card, including legacy payment IDs. */
export function getTransactionsLinkedToCreditCard(
  card: CreditCard,
  transactions: Transaction[]
): Transaction[] {
  const normalizedCardName = card.name.trim().toLocaleLowerCase();
  return transactions.filter((tx) => {
    if (tx.creditCardId === card.id || tx.settledCardId === card.id) return true;
    if (!tx.isInvoicePayment) return false;
    return (
      tx.id.startsWith(`tx-inv-${card.id}-`) ||
      (normalizedCardName.length > 0 &&
        tx.description.toLocaleLowerCase().includes(normalizedCardName))
    );
  });
}

/**
 * Estorna um pagamento de fatura de cartão de crédito (`isInvoicePayment: true`) refazendo todo o Efeito Cascata:
 * 1. Remove o débito bancário do pagamento da fatura (devolvendo o saldo imediatamente à conta corrente).
 * 2. Recompõe eventuais parcelas divididas por pagamento parcial (`partialSplitOriginalId`).
 * 3. Reabre as compras do cartão naquela competência de volta para `pending`, recompondo o limite utilizado e a fatura em aberto.
 */
export function reverseCreditCardInvoicePayment(
  transactions: Transaction[],
  invoicePaymentTxId: string,
  cards: CreditCard[] = []
): {
  updatedTransactions: Transaction[];
  restoredCardCount: number;
  restoredCardName: string;
  actionDescription: string;
} {
  const target = transactions.find((t) => t.id === invoicePaymentTxId);
  if (!target || !target.isInvoicePayment) {
    return {
      updatedTransactions: transactions,
      restoredCardCount: 0,
      restoredCardName: '',
      actionDescription: '',
    };
  }

  const matchedCard =
    cards.find((c) => c.id === target.settledCardId) ||
    cards.find((c) => target.description.toLowerCase().includes(c.name.toLowerCase())) ||
    cards.find((c) => target.id.includes(c.id));

  const targetCardId = target.settledCardId || matchedCard?.id;
  const targetInvoiceMonth = target.settledInvoiceMonth || target.competenceMonth;
  const cardName = matchedCard?.name || 'Cartão de Crédito';

  // Restrict new-format reversals to purchases settled by this specific payment.
  const getInvoicePaymentId = (tx: Transaction) =>
    (tx as Transaction & { invoicePaymentId?: string }).invoicePaymentId;
  const hasLinkedPurchases = transactions.some((tx) => getInvoicePaymentId(tx) === target.id);
  const hasLegacyAmbiguousPayments = !hasLinkedPurchases && transactions.filter((tx) =>
    {
      if (
        !tx.isInvoicePayment ||
        tx.id === target.id ||
        (tx.settledInvoiceMonth || tx.competenceMonth) !== targetInvoiceMonth
      ) {
        return false;
      }
      if (!targetCardId) return true;
      const paymentCard = cards.find((card) => card.id === tx.settledCardId) ||
        cards.find((card) => tx.description.toLowerCase().includes(card.name.toLowerCase())) ||
        cards.find((card) => tx.id.includes(card.id));
      return (tx.settledCardId || paymentCard?.id) === targetCardId;
    }
  ).length > 0;
  if (hasLegacyAmbiguousPayments) {
    return {
      updatedTransactions: transactions,
      restoredCardCount: 0,
      restoredCardName: cardName,
      actionDescription: `Não foi possível estornar o pagamento de ${formatBRL(target.amount)} da fatura ${cardName}: existem várias baixas legadas nesta competência sem vínculo individual. Nenhum lançamento foi alterado.`,
    };
  }
  const isTargetPurchase = (tx: Transaction) => hasLinkedPurchases
    ? getInvoicePaymentId(tx) === target.id
    : tx.competenceMonth === targetInvoiceMonth &&
      (!targetCardId || tx.creditCardId === targetCardId);

  // Detect partial split rows settled by this payment (legacy rows have no payment link).
  const partialSplitSums = new Map<string, number>();
  const partialSplitSharedSums = new Map<string, number>();
  const partialSplitRows = new Map<string, Transaction[]>();
  const partialSplitIdsToRemove = new Set<string>();

  for (const tx of transactions) {
    if (
      isTargetPurchase(tx) &&
      (tx.partialSplitOriginalId || tx.id.includes('-paid-'))
    ) {
      const origId =
        tx.partialSplitOriginalId || tx.id.split('-paid-')[0];
      // Só junta a fração de volta à linha original quando essa linha ainda está em aberto (ou é quitada por este
      // mesmo pagamento). Se outro pagamento já quitou a linha original, juntar reabriria o valor desse outro
      // pagamento: então a fração é apenas reaberta, como linha própria.
      const origin = transactions.find((candidate) => candidate.id === origId);
      const canMerge = Boolean(
        origin && (origin.status === 'pending' || isTargetPurchase(origin))
      );
      if (!canMerge) continue;
      partialSplitSums.set(origId, (partialSplitSums.get(origId) || 0) + tx.amount);
      partialSplitRows.set(origId, [...(partialSplitRows.get(origId) || []), tx]);
      if (tx.sharedAmount !== undefined) {
        partialSplitSharedSums.set(
          origId,
          (partialSplitSharedSums.get(origId) || 0) + tx.sharedAmount
        );
      }
      partialSplitIdsToRemove.add(tx.id);
    }
  }

  let restoredCardCount = 0;

  const updatedTransactions = transactions
    .filter((t) => t.id !== target.id && !partialSplitIdsToRemove.has(t.id))
    .map((t) => {
      if (
        !t.isInvoicePayment &&
        (isTargetPurchase(t) || partialSplitSums.has(t.id))
      ) {
        const extraFromPartial = partialSplitSums.get(t.id) || 0;
        const extraSharedFromPartial = partialSplitSharedSums.get(t.id);
        if (t.status === 'paid' || extraFromPartial > 0) {
          restoredCardCount += 1;
          let tripMerged: Partial<Transaction> = {};
          let tripBase: Transaction = t;
          for (const extraRow of partialSplitRows.get(t.id) || []) {
            tripMerged = mergeTripAmounts(tripBase, extraRow);
            tripBase = { ...tripBase, ...tripMerged };
          }
          return {
            ...t,
            ...tripMerged,
            amount: Math.round((t.amount + extraFromPartial) * 100) / 100,
            sharedAmount:
              t.sharedAmount === undefined && extraSharedFromPartial === undefined
                ? undefined
                : Math.round(((t.sharedAmount || 0) + (extraSharedFromPartial || 0)) * 100) / 100,
            status: 'pending' as TransactionStatus,
            // A compra reaberta deixa de apontar para o pagamento estornado.
            invoicePaymentId: undefined,
          };
        }
      }
      return t;
    });

  return {
    updatedTransactions,
    restoredCardCount,
    restoredCardName: cardName,
    actionDescription: `Efeito Cascata refeito: Pagamento de ${formatBRL(
      target.amount
    )} da fatura ${cardName} estornado! O saldo voltou para a conta e ${restoredCardCount} compra(s) do cartão reabriram como Pendentes.`,
  };
}
