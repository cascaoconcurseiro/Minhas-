import type {
  CurrencyCode,
  CurrencyPaymentRegime,
  PaymentMethod,
  RecurrenceType,
  Transaction,
  TransactionStatus,
  TransactionType,
  TripExpenseShare,
  TripSplitMethod,
} from '../../types/finance';
import {
  addMonthsToYearMonth,
  addMonthsToDateString,
} from './formatting.ts';
import {
  normalizeTransactionTags,
} from './transactionTags.ts';

export interface CreateTransactionBatchInput {
  description: string;
  amount: number;
  amountMode?: 'per_installment' | 'total_divided';
  installmentPurchaseTotal?: number;
  date: string; // YYYY-MM-DD
  competenceMonth?: string; // YYYY-MM
  type: TransactionType;
  status: TransactionStatus;
  categoryId: string;
  accountId?: string;
  destinationAccountId?: string;
  creditCardId?: string;
  paymentMethod: PaymentMethod;
  recurrence: RecurrenceType;
  installmentTotal?: number;
  fixedMonthsCount?: number;
  notes?: string;
  tags?: string[];
  isShared?: boolean;
  sharedMemberId?: string;
  sharedAmount?: number;
  sharedPaidBy?: 'me' | 'member';
  sharedSplitMode?: 'full' | 'half' | 'custom';
  sharedStatus?: 'pending' | 'received';
  targetInvestmentAssetId?: string;
  isInvoicePayment?: boolean;
  settledCardId?: string;
  transferFromAmount?: number;
  transferToAmount?: number;
  transferExchangeRate?: number;
  // Travel & Multi-Currency fields
  tripId?: string;
  originalCurrency?: CurrencyCode;
  originalAmount?: number;
  exchangeRate?: number;
  iofPercent?: number;
  effectiveExchangeRate?: number;
  currencyRegime?: CurrencyPaymentRegime;
  paidByParticipantId?: string;
  tripSplitMethod?: TripSplitMethod;
  tripShares?: TripExpenseShare[];
  myPersonalShareBrl?: number;
  myPersonalShareForeign?: number;
  isCompanionOnlyExpense?: boolean;
}

/**
 * Aplica `fn` (centavos -> centavos) a todos os valores de viagem de um lançamento: moeda estrangeira original,
 * cota pessoal e cotas por participante. Usado para dividir uma compra (parcelas, pagamento parcial) sem repetir
 * o valor inteiro em cada linha.
 */
export function mapTripAmounts(tx: Transaction, fn: (valueCents: number) => number): Partial<Transaction> {
  const out: Partial<Transaction> = {};
  const apply = (value: number) => fn(Math.round(value * 100)) / 100;
  if (tx.originalAmount !== undefined) out.originalAmount = apply(tx.originalAmount);
  if (tx.myPersonalShareBrl !== undefined) out.myPersonalShareBrl = apply(tx.myPersonalShareBrl);
  if (tx.myPersonalShareForeign !== undefined) out.myPersonalShareForeign = apply(tx.myPersonalShareForeign);
  if (Array.isArray(tx.tripShares) && tx.tripShares.length > 0) {
    out.tripShares = tx.tripShares.map((share) => ({
      ...share,
      foreignShare: apply(share.foreignShare),
      brlShare: apply(share.brlShare),
    }));
  }
  return out;
}

/** Soma os valores de viagem de duas frações da mesma compra (usado ao estornar um pagamento parcial). */
export function mergeTripAmounts(base: Transaction, extra: Transaction): Partial<Transaction> {
  const out: Partial<Transaction> = {};
  const add = (a?: number, b?: number) =>
    a === undefined && b === undefined ? undefined : Math.round(((a || 0) + (b || 0)) * 100) / 100;
  if (base.originalAmount !== undefined || extra.originalAmount !== undefined) out.originalAmount = add(base.originalAmount, extra.originalAmount);
  if (base.myPersonalShareBrl !== undefined || extra.myPersonalShareBrl !== undefined) out.myPersonalShareBrl = add(base.myPersonalShareBrl, extra.myPersonalShareBrl);
  if (base.myPersonalShareForeign !== undefined || extra.myPersonalShareForeign !== undefined) out.myPersonalShareForeign = add(base.myPersonalShareForeign, extra.myPersonalShareForeign);
  if (Array.isArray(base.tripShares) && base.tripShares.length > 0) {
    out.tripShares = base.tripShares.map((share) => {
      const other = extra.tripShares?.find((candidate) => candidate.participantId === share.participantId);
      return {
        ...share,
        foreignShare: add(share.foreignShare, other?.foreignShare) ?? share.foreignShare,
        brlShare: add(share.brlShare, other?.brlShare) ?? share.brlShare,
      };
    });
  }
  return out;
}

export function createTransactionBatch(
  input: CreateTransactionBatchInput,
  idPrefix = 'tx'
): Transaction[] {
  const baseMonth = input.competenceMonth || input.date.slice(0, 7);
  const groupId = `${idPrefix}-grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const normalizedTags = normalizeTransactionTags(input.tags);
  const cleanTags = normalizedTags.length > 0 ? normalizedTags : undefined;

  const tripExtras = {
    tripId: input.tripId,
    originalCurrency: input.originalCurrency,
    originalAmount: input.originalAmount,
    exchangeRate: input.exchangeRate,
    iofPercent: input.iofPercent,
    effectiveExchangeRate: input.effectiveExchangeRate,
    currencyRegime: input.currencyRegime,
    paidByParticipantId: input.paidByParticipantId,
    tripSplitMethod: input.tripSplitMethod,
    tripShares: input.tripShares,
    myPersonalShareBrl: input.myPersonalShareBrl,
    myPersonalShareForeign: input.myPersonalShareForeign,
    isCompanionOnlyExpense: input.isCompanionOnlyExpense,
  };

  if (input.recurrence === 'installment' && (input.installmentTotal || 1) > 1) {
    const totalCount = Math.max(2, Math.min(48, Math.floor(input.installmentTotal || 2)));
    const mode = input.amountMode || 'total_divided';
    const amountCents = Math.round(input.amount * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      throw new RangeError('O valor da compra parcelada precisa caber em centavos seguros.');
    }
    const basePartCents = mode === 'total_divided'
      ? Math.floor(amountCents / totalCount)
      : amountCents;
    const remainderCents = mode === 'total_divided'
      ? amountCents % totalCount
      : 0;
    const purchaseTotalCents = Math.round((input.installmentPurchaseTotal ?? (
      mode === 'total_divided' ? amountCents / 100 : (amountCents * totalCount) / 100
    )) * 100);
    if (!Number.isSafeInteger(purchaseTotalCents) || purchaseTotalCents < 0) {
      throw new RangeError('O total da compra parcelada precisa caber em centavos seguros.');
    }
    const purchaseTotal = purchaseTotalCents / 100;

    const totalShared = input.sharedAmount || 0;
    const totalSharedCents = Math.round(totalShared * 100);
    if (!Number.isSafeInteger(totalSharedCents) || totalSharedCents < 0) {
      throw new RangeError('O valor compartilhado precisa caber em centavos seguros.');
    }
    const baseSharedPartCents = mode === 'total_divided'
      ? Math.floor(totalSharedCents / totalCount)
      : totalSharedCents;
    const remainderSharedCents = mode === 'total_divided'
      ? totalSharedCents % totalCount
      : 0;

    const results: Transaction[] = [];
    for (let i = 0; i < totalCount; i++) {
      const instNumber = i + 1;
      const instAmount = (basePartCents + (i < remainderCents ? 1 : 0)) / 100;
      const instSharedAmount =
        (baseSharedPartCents + (i < remainderSharedCents ? 1 : 0)) / 100;
      const instDate = addMonthsToDateString(input.date, i);
      const instMonth = addMonthsToYearMonth(baseMonth, i);
      const instStatus: TransactionStatus = i === 0 ? input.status : 'pending';
      // Moeda estrangeira e cotas da viagem são da compra inteira: cada parcela leva só a sua fatia (a soma das
      // fatias fecha exatamente o total). No modo "valor por parcela" não há total confiável para ratear.
      const tripSlice = mode === 'total_divided' && amountCents > 0
        ? (() => {
            const cumulativeNow = Math.floor(amountCents / totalCount) * (i + 1) + Math.min(i + 1, remainderCents);
            const cumulativePrev = Math.floor(amountCents / totalCount) * i + Math.min(i, remainderCents);
            return mapTripAmounts(tripExtras as Transaction, (value) =>
              Math.round((value * cumulativeNow) / amountCents) - Math.round((value * cumulativePrev) / amountCents));
          })()
        : {};

      results.push({
        id: `${idPrefix}-${Date.now()}-${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
        description: input.description.trim(),
        amount: instAmount,
        date: instDate,
        competenceMonth: instMonth,
        type: input.type,
        status: instStatus,
        categoryId: input.categoryId,
        accountId: input.accountId,
        destinationAccountId: input.destinationAccountId,
        creditCardId: input.creditCardId,
        paymentMethod: input.paymentMethod,
        recurrence: 'installment',
        installmentGroupId: groupId,
        installmentNumber: instNumber,
        installmentTotal: totalCount,
        installmentPurchaseTotal: purchaseTotal,
        notes: input.notes,
        tags: cleanTags,
        isShared: input.isShared,
        sharedMemberId: input.sharedMemberId,
        sharedAmount: input.isShared ? instSharedAmount : undefined,
        sharedPaidBy: input.isShared ? input.sharedPaidBy || 'me' : undefined,
        sharedSplitMode: input.sharedSplitMode,
        sharedStatus: input.isShared ? 'pending' : undefined,
        targetInvestmentAssetId: input.targetInvestmentAssetId,
        ...tripExtras,
        ...tripSlice,
      });
    }
    return results;
  }

  if (input.recurrence === 'fixed') {
    const monthsToGenerate = Math.max(1, Math.min(36, input.fixedMonthsCount || 12));
    const results: Transaction[] = [];
    for (let i = 0; i < monthsToGenerate; i++) {
      const instDate = addMonthsToDateString(input.date, i);
      const instMonth = addMonthsToYearMonth(baseMonth, i);
      const instStatus: TransactionStatus = i === 0 ? input.status : 'pending';
      results.push({
        id: `${idPrefix}-${Date.now()}-fix-${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
        description: input.description.trim(),
        amount: Math.round(input.amount * 100) / 100,
        date: instDate,
        competenceMonth: instMonth,
        type: input.type,
        status: instStatus,
        categoryId: input.categoryId,
        accountId: input.accountId,
        destinationAccountId: input.destinationAccountId,
        creditCardId: input.creditCardId,
        paymentMethod: input.paymentMethod,
        recurrence: 'fixed',
        installmentGroupId: groupId,
        notes: input.notes,
        tags: cleanTags,
        isShared: input.isShared,
        sharedMemberId: input.sharedMemberId,
        sharedAmount: input.isShared ? input.sharedAmount : undefined,
        sharedPaidBy: input.isShared ? input.sharedPaidBy || 'me' : undefined,
        sharedSplitMode: input.sharedSplitMode,
        sharedStatus: input.isShared ? 'pending' : undefined,
        targetInvestmentAssetId: input.targetInvestmentAssetId,
        ...tripExtras,
      });
    }
    return results;
  }

  return [
    {
      id: `${idPrefix}-${Date.now()}-1-${Math.random().toString(36).slice(2, 6)}`,
      description: input.description.trim(),
      amount: Math.round(input.amount * 100) / 100,
      date: input.date,
      competenceMonth: baseMonth,
      type: input.type,
      status: input.status,
      categoryId: input.categoryId,
      accountId: input.accountId,
      destinationAccountId: input.destinationAccountId,
      creditCardId: input.creditCardId,
      paymentMethod: input.paymentMethod,
      recurrence: 'single',
      notes: input.notes,
      tags: cleanTags,
      isShared: input.isShared,
      sharedMemberId: input.sharedMemberId,
      sharedAmount: input.isShared ? input.sharedAmount : undefined,
      sharedPaidBy: input.isShared ? input.sharedPaidBy || 'me' : undefined,
      sharedSplitMode: input.sharedSplitMode,
      sharedStatus: input.isShared ? input.sharedStatus || 'pending' : undefined,
      targetInvestmentAssetId: input.targetInvestmentAssetId,
      isInvoicePayment: input.isInvoicePayment,
      settledCardId: input.settledCardId,
      transferFromAmount: input.transferFromAmount,
      transferToAmount: input.transferToAmount,
      transferExchangeRate: input.transferExchangeRate,
      ...tripExtras,
    },
  ];
}


export function calculateSharedAmount(amount: number, mode: 'half' | 'percentage' | 'custom', percentage = 50, customAmount = 0): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (mode === 'half') return Math.round(amount * 50) / 100;
  if (mode === 'percentage') return Math.round(amount * Math.max(1, Math.min(100, percentage || 50))) / 100;
  return Math.min(amount, Math.max(.01, customAmount));
}
