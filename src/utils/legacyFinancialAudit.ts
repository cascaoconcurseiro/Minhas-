import type { CreditCard, Transaction } from '../types/finance';
import { resolveCreditCardInvoiceMonth } from './financeRules';

export type FinancialHistoryAuditRow = {
  issue: 'installment_total' | 'invoice_competence';
  confidence: 'high' | 'review';
  cardName: string;
  cardId: string;
  groupId: string;
  transactionIds: string[];
  savedCompetence: string;
  suggestedCompetence: string;
  suggestedPurchaseTotal: number | null;
  reason: string;
};

function cents(value: number): number {
  return Math.round(value * 100);
}

function hasAmbiguousPartialSplit(rows: Transaction[]): boolean {
  const grouped = new Map<number, Transaction[]>();
  for (const tx of rows) {
    if (tx.installmentNumber === undefined) continue;
    grouped.set(tx.installmentNumber, [...(grouped.get(tx.installmentNumber) || []), tx]);
  }
  return [...grouped.values()].some((sameInstallment) => {
    if (sameInstallment.length < 2) return false;
    const rowsById = new Map(sameInstallment.map((tx) => [tx.id, tx]));
    return sameInstallment.some((tx) => {
      if (tx.partialSplitOriginalId) return !rowsById.has(tx.partialSplitOriginalId);
      if (tx.id.includes('-paid-')) {
        return !rowsById.has(tx.id.split('-paid-')[0]);
      }
      return !sameInstallment.some(
        (child) =>
          child.partialSplitOriginalId === tx.id ||
          (child.id.includes('-paid-') && child.id.split('-paid-')[0] === tx.id)
      );
    });
  });
}

function hasAnticipatedPartialSplit(rows: Transaction[]): boolean {
  return rows.some(
    (tx) =>
      tx.isAnticipated &&
      (Boolean(tx.partialSplitOriginalId) || tx.id.includes('-paid-'))
  );
}

function estimateInstallmentTotalCents(rows: Transaction[]): number | null {
  if (hasAnticipatedPartialSplit(rows)) return null;
  if (
    rows.some(
      (tx) =>
        tx.isAnticipated &&
        (!Number.isFinite(tx.originalAmountBeforeDiscount) ||
          (tx.originalAmountBeforeDiscount || 0) < 0)
    )
  ) {
    return null;
  }
  return rows.reduce(
    (sum, tx) =>
      sum +
      cents(
        tx.isAnticipated
          ? tx.originalAmountBeforeDiscount as number
          : tx.amount
      ),
    0
  );
}

function installmentReason(
  rows: Transaction[],
  card: CreditCard | undefined,
  proposedTotalCents: number | null,
  highConfidence: boolean
): string {
  if (!card) return 'Cartão não encontrado; revisar manualmente antes de estimar o total.';
  if (new Set(rows.map((tx) => tx.creditCardId)).size !== 1) {
    return 'A série contém mais de um cartão ou linha sem cartão.';
  }
  const expectedCounts = new Set(rows.map((tx) => tx.installmentTotal).filter(Number.isInteger));
  if (expectedCounts.size !== 1) return 'Quantidade total de parcelas ausente ou inconsistente.';
  const expectedCount = [...expectedCounts][0] || 0;
  const installmentNumbers = new Set(rows.map((tx) => tx.installmentNumber).filter(Number.isInteger));
  if (
    expectedCount < 2 ||
    installmentNumbers.size !== expectedCount ||
    Array.from({ length: expectedCount }, (_, index) => index + 1).some((n) => !installmentNumbers.has(n))
  ) {
    return 'A sequência de parcelas está incompleta ou fora da quantidade declarada.';
  }
  if (hasAmbiguousPartialSplit(rows)) {
    return 'Há parcelas duplicadas sem vínculo de abatimento parcial verificável.';
  }
  const knownTotals = new Set(
    rows
      .map((tx) => tx.installmentPurchaseTotal)
      .filter((value): value is number => Number.isFinite(value))
      .map(cents)
  );
  if (knownTotals.size > 1) return 'O total original salvo diverge entre parcelas da mesma série.';
  const knownTotal = knownTotals.size === 1 ? [...knownTotals][0] : null;
  if (hasAnticipatedPartialSplit(rows) && knownTotal === null) {
    return 'Há parcela antecipada e dividida por pagamento parcial; a soma não permite estimar o preço original sem uma fonte de dados adicional.';
  }
  if (knownTotal !== null && proposedTotalCents !== null && knownTotal !== proposedTotalCents) {
    return 'A soma das parcelas diverge do total original já salvo em parte da série.';
  }
  if (
    !rows.every(
      (tx) =>
        Number.isFinite(tx.amount) &&
        tx.amount >= 0 &&
        (!tx.isAnticipated ||
          (Number.isFinite(tx.originalAmountBeforeDiscount) &&
            (tx.originalAmountBeforeDiscount || 0) >= 0))
    )
  ) {
    return 'Há valor de parcela inválido; não é possível estimar o total.';
  }
  return highConfidence
    ? 'Sequência completa, cartão único e valores coerentes; total proposto pela soma das parcelas em centavos. Revisar antes de qualquer gravação.'
    : 'Revisar a série e seus lançamentos antes de usar a estimativa.';
}

/** Build a read-only report. It never changes the supplied transactions. */
export function auditLegacyFinancialRecords(
  transactions: Transaction[],
  cards: CreditCard[]
): FinancialHistoryAuditRow[] {
  const cardMap = new Map(cards.map((card) => [card.id, card]));
  const rows: FinancialHistoryAuditRow[] = [];
  const installmentGroups = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if (tx.recurrence !== 'installment' || !tx.installmentGroupId || !tx.creditCardId) continue;
    installmentGroups.set(tx.installmentGroupId, [
      ...(installmentGroups.get(tx.installmentGroupId) || []),
      tx,
    ]);
  }

  for (const [groupId, groupRows] of installmentGroups) {
    const knownTotals = new Set(
      groupRows
        .map((tx) => tx.installmentPurchaseTotal)
        .filter((value): value is number => Number.isFinite(value))
        .map(cents)
    );
    const missingTotal = groupRows.some((tx) => !Number.isFinite(tx.installmentPurchaseTotal));
    const estimatedTotalCents = estimateInstallmentTotalCents(groupRows);
    const storedTotalCents = knownTotals.size === 1 ? [...knownTotals][0] : null;
    const storedTotalMismatch =
      storedTotalCents !== null &&
      estimatedTotalCents !== null &&
      storedTotalCents !== estimatedTotalCents;
    const needsReview = missingTotal || knownTotals.size > 1 || storedTotalMismatch;
    if (!needsReview) continue;

    const proposedTotalCents = storedTotalMismatch
      ? estimatedTotalCents
      : storedTotalCents ?? estimatedTotalCents;
    const cardIds = new Set(groupRows.map((tx) => tx.creditCardId));
    const cardId = cardIds.size === 1 ? groupRows[0].creditCardId || '' : '';
    const card = cardMap.get(cardId);
    const expectedCounts = new Set(groupRows.map((tx) => tx.installmentTotal).filter(Number.isInteger));
    const expectedCount = expectedCounts.size === 1 ? [...expectedCounts][0] || 0 : 0;
    const installmentNumbers = new Set(groupRows.map((tx) => tx.installmentNumber).filter(Number.isInteger));
    const sequenceComplete =
      expectedCount >= 2 &&
      expectedCounts.size === 1 &&
      installmentNumbers.size === expectedCount &&
      Array.from({ length: expectedCount }, (_, index) => index + 1).every((number) => installmentNumbers.has(number));
    const amountValid = groupRows.every(
      (tx) =>
        Number.isFinite(tx.amount) &&
        tx.amount >= 0 &&
        (!tx.isAnticipated ||
          (Number.isFinite(tx.originalAmountBeforeDiscount) &&
            (tx.originalAmountBeforeDiscount || 0) >= 0))
    );
    const lineageValid = !hasAmbiguousPartialSplit(groupRows);
    const highConfidence =
      Boolean(card) &&
      cardIds.size === 1 &&
      sequenceComplete &&
      amountValid &&
      lineageValid &&
      knownTotals.size <= 1 &&
      !storedTotalMismatch &&
      proposedTotalCents !== null;
    const reason = installmentReason(groupRows, card, proposedTotalCents, highConfidence);

    rows.push({
      issue: 'installment_total',
      confidence: highConfidence ? 'high' : 'review',
      cardName: card?.name || 'Cartão não identificado',
      cardId,
      groupId,
      transactionIds: groupRows.map((tx) => tx.id).sort(),
      savedCompetence: [...new Set(groupRows.map((tx) => tx.competenceMonth))].sort().join(','),
      suggestedCompetence: '',
      suggestedPurchaseTotal:
        amountValid && proposedTotalCents !== null ? proposedTotalCents / 100 : null,
      reason,
    });
  }

  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.isInvoicePayment || !tx.creditCardId) continue;
    const card = cardMap.get(tx.creditCardId);
    const suggestedMonth = card ? resolveCreditCardInvoiceMonth(tx.date, card) : '';
    if (suggestedMonth && tx.competenceMonth === suggestedMonth) continue;
    rows.push({
      issue: 'invoice_competence',
      confidence: 'review',
      cardName: card?.name || 'Cartão não identificado',
      cardId: tx.creditCardId,
      groupId: tx.installmentGroupId || '',
      transactionIds: [tx.id],
      savedCompetence: tx.competenceMonth,
      suggestedCompetence: suggestedMonth,
      suggestedPurchaseTotal: null,
      reason: card
        ? 'Diverge da regra usando os dados atuais do cartão; fechamento, vencimento ou ajuste manual antigo podem ter mudado. Não corrigir automaticamente.'
        : 'Cartão não encontrado; competência precisa de revisão manual.',
    });
  }

  return rows;
}

export function applyHighConfidenceInstallmentTotals(
  transactions: Transaction[],
  cards: CreditCard[]
): {
  updatedTransactions: Transaction[];
  updatedGroups: number;
  updatedRows: number;
} {
  const suggestions = auditLegacyFinancialRecords(transactions, cards).filter(
    (row) =>
      row.issue === 'installment_total' &&
      row.confidence === 'high' &&
      row.suggestedPurchaseTotal !== null
  );
  const totalByTransactionId = new Map(
    suggestions.flatMap((row) =>
      row.transactionIds.map((transactionId) => [
        transactionId,
        row.suggestedPurchaseTotal as number,
      ] as const)
    )
  );
  let updatedRows = 0;
  const updatedTransactions = transactions.map((tx) => {
    const suggestedTotal = totalByTransactionId.get(tx.id);
    if (
      suggestedTotal === undefined ||
      Number.isFinite(tx.installmentPurchaseTotal)
    ) {
      return tx;
    }
    updatedRows += 1;
    return { ...tx, installmentPurchaseTotal: suggestedTotal };
  });
  const currentRowsById = new Map(transactions.map((tx) => [tx.id, tx]));
  const updatedGroups = suggestions.filter((suggestion) =>
    suggestion.transactionIds.some(
      (transactionId) =>
        !Number.isFinite(currentRowsById.get(transactionId)?.installmentPurchaseTotal)
    )
  ).length;

  return { updatedTransactions, updatedGroups, updatedRows };
}

function csvCell(value: string): string {
  const safeValue = /^[\s\u0000-\u001f\u007f-\u009f]*[=+@-]/.test(value)
    ? `'${value}`
    : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

/** Export audit findings with Excel-safe quoting and pt-BR semicolon delimiters. */
export function exportFinancialHistoryAuditCsv(rows: FinancialHistoryAuditRow[]): string {
  const headers = [
    'Tipo',
    'Confianca',
    'Cartao',
    'ID_Cartao',
    'Grupo_Parcelas',
    'IDs_Transacoes',
    'Competencia_Salva',
    'Competencia_Sugerida_Para_Revisao',
    'Total_Original_Sugerido_BRL',
    'Motivo',
  ];
  const lines = rows.map((row) =>
    [
      row.issue === 'installment_total' ? 'Total original de parcelamento' : 'Competência da fatura',
      row.confidence === 'high' ? 'Alta (revisar)' : 'Revisão manual',
      row.cardName,
      row.cardId,
      row.groupId,
      row.transactionIds.join(','),
      row.savedCompetence,
      row.suggestedCompetence,
      row.suggestedPurchaseTotal === null
        ? ''
        : row.suggestedPurchaseTotal.toFixed(2).replace('.', ','),
      row.reason,
    ]
      .map((value) => csvCell(String(value)))
      .join(';')
  );
  return [headers.map(csvCell).join(';'), ...lines].join('\n');
}
