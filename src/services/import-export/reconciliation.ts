/** Candidatos de conciliação, conversão em lançamentos e compactação para guardar. */
import type {
  Category,
  CreditCard,
  CurrencyCode,
  FamilyMember,
  Transaction,
} from '../../types/finance';
import {
  matchCategoryByDescription,
} from '../../domain/finance/categoryMatching';
import {
  calculateSharedAmount,
} from '../../domain/finance/financeRules';
import {
  learnCategoryHabit,
} from '../../domain/budgets/decisionEngine';
import {
  buildEstablishmentIndex,
  learnSharingFromHistory,
  normalizeDescription,
} from '../../domain/budgets/learningRules';
import {
  buildDuplicateLookup,
  checkItemDuplicate,
  cleanDescriptionForComparison,
  daysApart,
  inferCategoryByDescription,
} from './duplicateDetection.ts';
import type {
  ParsedBankStatementItem,
  ReconciliationCandidate,
} from './statementTypes.ts';

const PENDING_MATCH_WINDOW_DAYS = 7;


function sharesMeaningfulWord(a: string, b: string): boolean {
  const wordsA = new Set(a.split(' ').filter((word) => word.length >= 4));
  return b.split(' ').some((word) => word.length >= 4 && wordsA.has(word));
}

/**
 * Acha a conta pendente que esta linha do extrato quita: mesmo tipo e valor, data até 7 dias de
 * diferença e nome parecido; sem nome parecido, só vale se for a única pendência com aquele valor.
 * Mais de uma possibilidade = não casa (a pessoa decide).
 */
function findPendingMatch(
  item: { date: string; description: string; rawType: 'income' | 'expense' },
  amountBrl: number,
  pending: Transaction[],
  claimed: Set<string>
): Transaction | undefined {
  const sameValue = pending.filter(
    (tx) =>
      !claimed.has(tx.id) &&
      tx.type === item.rawType &&
      Math.abs(tx.amount - amountBrl) < 0.01 &&
      daysApart(tx.date, item.date) <= PENDING_MATCH_WINDOW_DAYS
  );
  if (sameValue.length === 0) return undefined;
  const itemName = normalizeDescription(item.description);
  const named = sameValue.filter((tx) => sharesMeaningfulWord(itemName, normalizeDescription(tx.description)));
  if (named.length === 1) return named[0];
  if (named.length === 0 && sameValue.length === 1) return sameValue[0];
  return undefined;
}

export function prepareReconciliationCandidates(
  items: ParsedBankStatementItem[],
  existingTransactions: Transaction[],
  categories: Category[],
  targetAccountId?: string,
  cards: CreditCard[] = [],
  fx: { currency?: string; exchangeRate?: number } = {},
  familyMembers: FamilyMember[] = []
): ReconciliationCandidate[] {
  const statementCurrency = fx.currency || 'BRL';
  const exchangeRate = statementCurrency === 'BRL' ? 1 : fx.exchangeRate;
  const hasValidExchangeRate = Number.isFinite(exchangeRate) && (exchangeRate || 0) > 0;
  const cardIds = new Set(cards.map((card) => card.id));
  const pendingInvoicesByCard = new Map<string, Map<string, number>>();
  for (const tx of existingTransactions) {
    if (
      !tx.creditCardId || !cardIds.has(tx.creditCardId) || tx.status !== 'pending' ||
      tx.isInvoicePayment || tx.isCompanionOnlyExpense || tx.sharedPaidBy === 'member'
    ) continue;
    const months = pendingInvoicesByCard.get(tx.creditCardId) || new Map<string, number>();
    months.set(tx.competenceMonth, Math.round(((months.get(tx.competenceMonth) || 0) + tx.amount) * 100) / 100);
    pendingInvoicesByCard.set(tx.creditCardId, months);
  }
  const pendingInvoices = cards.flatMap((card) =>
    [...(pendingInvoicesByCard.get(card.id) || new Map<string, number>())]
      .filter(([, amount]) => amount > 0)
      .map(([invoiceMonth, amount]) => ({
        cardId: card.id,
        cardName: cleanDescriptionForComparison(card.name),
        invoiceMonth,
        amount,
      }))
  );

  const pendingBills = existingTransactions.filter(
    (tx) =>
      tx.status === 'pending' &&
      !tx.creditCardId &&
      !tx.isInvoicePayment &&
      !tx.isCompanionOnlyExpense &&
      tx.sharedPaidBy !== 'member' &&
      (tx.type === 'income' || tx.type === 'expense') &&
      (!targetAccountId || !tx.accountId || tx.accountId === targetAccountId)
  );
  const claimedPending = new Set<string>();
  const establishmentIndex = buildEstablishmentIndex(existingTransactions);
  const duplicateLookup = buildDuplicateLookup(existingTransactions);

  const seenFitIds = new Set<string>();
  return items.map((item, idx) => {
    const pendingMatch =
      statementCurrency === 'BRL'
        ? findPendingMatch(item, item.amount, pendingBills, claimedPending)
        : undefined;
    if (pendingMatch) claimedPending.add(pendingMatch.id);
    // A conta pendente que casou não conta como "duplicata" desta linha
    const dupCheck = checkItemDuplicate(
      item,
      existingTransactions,
      targetAccountId,
      statementCurrency,
      exchangeRate,
      pendingMatch?.id,
      duplicateLookup
    );
    const normalizedFitId = item.fitid?.trim();
    const repeatedInStatement = Boolean(normalizedFitId && seenFitIds.has(normalizedFitId));
    if (normalizedFitId) seenFitIds.add(normalizedFitId);
    const ruleMatch = matchCategoryByDescription(item.description, categories, item.rawType);
    const habit = learnCategoryHabit(item.description, existingTransactions, item.rawType, establishmentIndex);
    const habitCategory = habit && categories.some((category) => category.id === habit.value && category.type === item.rawType)
      ? habit.value
      : undefined;
    const suggestedCategoryId = habitCategory
      ?? ruleMatch?.categoryId
      ?? inferCategoryByDescription(item.description, categories, item.rawType);
    const suggestedCategorySource: 'history' | 'rule' | undefined = habitCategory ? 'history' : ruleMatch ? 'rule' : undefined;
    const normalizedDescription = cleanDescriptionForComparison(item.description);
    const convertedCents = Math.round(item.amount * (exchangeRate || 1) * 100);
    const hasSafeConversion = statementCurrency === 'BRL' ||
      (hasValidExchangeRate && Number.isSafeInteger(convertedCents) && convertedCents > 0);
    const amountBrl = statementCurrency === 'BRL' || !hasSafeConversion
      ? item.amount
      : convertedCents / 100;
    const isPotentialInvoicePayment = item.rawType === 'expense' &&
      (/(^|\s)fatura(\s|$)/.test(normalizedDescription) ||
        /\b(pagamento|pagto|pgto) cartao( de credito)?\b/.test(normalizedDescription));
    const invoiceMatches: Array<{ cardId: string; invoiceMonth: string }> = [];

    if (isPotentialInvoicePayment) {
      for (const invoice of pendingInvoices) {
        const descriptionNamesCard = invoice.cardName.length > 0 &&
          ` ${normalizedDescription} `.includes(` ${invoice.cardName} `);
        const amountMatchesInvoice = Math.abs(invoice.amount - amountBrl) < 0.01;
        const amountFitsInvoice = amountBrl > 0 && amountBrl <= invoice.amount;
        if (amountFitsInvoice && (amountMatchesInvoice || descriptionNamesCard)) {
          invoiceMatches.push({ cardId: invoice.cardId, invoiceMonth: invoice.invoiceMonth });
        }
      }
    }

    const invoiceMatch = invoiceMatches.length === 1 ? invoiceMatches[0] : undefined;

    return {
      id: `reconcile-${idx}-${normalizedFitId || item.date}`,
      fitid: item.fitid,
      date: item.date,
      amount: amountBrl,
      sourceAmount: statementCurrency === 'BRL' ? undefined : item.amount,
      originalCurrency: statementCurrency === 'BRL' ? undefined : statementCurrency,
      exchangeRate: statementCurrency !== 'BRL' && hasSafeConversion ? exchangeRate : undefined,
      type: item.rawType,
      description: item.description,
      memo: item.memo,
      suggestedCategoryId: invoiceMatch
        ? categories.find((category) => category.id === 'cat-fatura')?.id || suggestedCategoryId
        : suggestedCategoryId,
      isPotentialInvoicePayment,
      isInvoicePayment: Boolean(invoiceMatch),
      settledCardId: invoiceMatch?.cardId,
      settledInvoiceMonth: invoiceMatch?.invoiceMonth,
      suggestedCategorySource: invoiceMatch ? undefined : suggestedCategorySource,
      matchedPendingId: pendingMatch?.id,
      matchedPendingDescription: pendingMatch?.description,
      learnedSharing:
        item.rawType === 'expense' && !invoiceMatch && !pendingMatch && statementCurrency === 'BRL'
          ? learnSharingFromHistory(item.description, existingTransactions, familyMembers, establishmentIndex) ?? undefined
          : undefined,
      isDuplicate: dupCheck.isDuplicate || repeatedInStatement,
      duplicateReason: repeatedInStatement
        ? `FITID repetido neste arquivo (${normalizedFitId})`
        : dupCheck.reason,
      selected: !dupCheck.isDuplicate && !repeatedInStatement &&
        (!isPotentialInvoicePayment || Boolean(invoiceMatch)),
    };
  });
}

/**
 * Converts selected reconciliation candidates into production Transaction objects.
 */
export function convertCandidatesToTransactions(
  candidates: ReconciliationCandidate[],
  accountId: string,
  batchId?: string
): Transaction[] {
  const currentBatchId = batchId || `batch-ofx-${Date.now().toString(36)}`;

  return candidates
    .filter((c) => c.selected && c.amount > 0 && (!c.isInvoicePayment || Boolean(c.settledCardId && c.settledInvoiceMonth)))
    .map((c) => {
      const competenceMonth = c.date.slice(0, 7);
      return {
        id: `tx-ofx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        description: c.description,
        amount: c.amount,
        date: c.date,
        competenceMonth,
        type: c.type,
        status: 'paid',
        categoryId: c.suggestedCategoryId,
        accountId,
        paymentMethod: 'pix',
        recurrence: 'single',
        notes: c.memo ? `Conciliação Bancária OFX: ${c.memo}` : 'Importado via Extrato Bancário / OFX',
        fitid: c.fitid,
        importBatchId: currentBatchId,
        reconciled: true,
        settlesPendingTransactionId: c.matchedPendingId,
        ...(c.learnedSharing && !c.matchedPendingId
          ? {
              isShared: true,
              sharedMemberId: c.learnedSharing.memberId,
              sharedPaidBy: c.learnedSharing.paidBy,
              sharedSplitMode: c.learnedSharing.splitMode === 'half' ? ('half' as const) : ('custom' as const),
              sharedAmount: calculateSharedAmount(c.amount, c.learnedSharing.splitMode, c.learnedSharing.percentage),
              sharedStatus: 'pending' as const,
            }
          : {}),
        isInvoicePayment: c.isInvoicePayment || undefined,
        settledCardId: c.isInvoicePayment ? c.settledCardId : undefined,
        settledInvoiceMonth: c.isInvoicePayment ? c.settledInvoiceMonth : undefined,
        originalAmount: c.originalCurrency ? c.sourceAmount : undefined,
        originalCurrency: c.originalCurrency as CurrencyCode | undefined,
        exchangeRate: c.originalCurrency ? c.exchangeRate : undefined,
        effectiveExchangeRate: c.originalCurrency ? c.exchangeRate : undefined,
        currencyRegime: c.originalCurrency ? 'global_account' : undefined,
      };
    });
}

/**
 * Strips obsolete, null, undefined, and empty string properties from transactions
 * before persisting the parsed records in Neon.
 * Reduces document payload size by 35-50%, extending storage headroom to thousands of transactions.
 */
export function compactTransactionForStorage(tx: Transaction): Partial<Transaction> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(tx)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (key === 'isShared' && value === false) continue;
    if (key === 'isInvoicePayment' && value === false) continue;
    if (key === 'isAnticipated' && value === false) continue;
    if (key === 'isCompanionOnlyExpense' && value === false) continue;
    if (key === 'reconciled' && value === false) continue;
    clean[key] = value;
  }
  return clean as Partial<Transaction>;
}

export function compactTransactionListForStorage(transactions: Transaction[]): Partial<Transaction>[] {
  return transactions.map(compactTransactionForStorage);
}
