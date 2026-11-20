/** Resumo da viagem: gasto, ritmo diário, categorias e saldos. */
import type {
  Category,
  Transaction,
  Trip,
  TripCategorySpendPoint,
  TripDailySpendPoint,
  TripDashboardSummary,
  TripParticipantBalance,
} from '../../types/finance';
import {
  CURRENCY_CATALOG,
} from './currencyCatalog.ts';
import {
  calculateTripWeightedAverageRate,
} from './exchangeRates.ts';
import {
  simplifyTripDebts,
} from './tripSplit.ts';

function getDatesBetween(startDate: string, endDate: string): string[] {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  if (!sy || !ey) return [startDate];

  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  if (end < start) return [startDate];

  const dates: string[] = [];
  const current = new Date(start);
  let guard = 0;
  while (current <= end && guard < 90) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
    guard++;
  }
  return dates.length > 0 ? dates : [startDate];
}

/**
 * Motor completo de inteligência de viagem estilo TravelSpend + Splitwise Multi-Moeda:
 * Calcula gastos pessoais vs. gastos do grupo, ritmo diário, orçamento restante por dia,
 * saldo da carteira de câmbio (Wise/Espécie), divisão por categoria e acerto de contas.
 */
export function calculateTripDashboardSummary(
  trip: Trip,
  allTransactions: Transaction[],
  categories: Category[] = [],
  referenceTodayStr?: string
): TripDashboardSummary {
  const {
    weightedAverageRate,
    totalForeignPurchased,
    totalBrlPaid: totalBrlPurchasedForLots,
  } = calculateTripWeightedAverageRate(
    trip.exchangeLots || [],
    trip.defaultExchangeRate || CURRENCY_CATALOG[trip.currency]?.defaultCommercialRateBrl || 1
  );

  const tripTxs = allTransactions.filter(
    (tx) => tx.tripId === trip.id && tx.type === 'expense' && !tx.isInvoicePayment
  );

  const meParticipant =
    trip.participants.find((p) => p.isMe) ||
    trip.participants[0] || {
      id: 'me',
      name: 'Você',
      isMe: true,
      color: '#059669',
    };

  const balanceMap = new Map<string, TripParticipantBalance>();
  for (const p of trip.participants) {
    balanceMap.set(p.id, {
      participantId: p.id,
      participantName: p.name,
      isMe: Boolean(p.isMe),
      color: p.color,
      pixKey: p.pixKey,
      paidForeign: 0,
      paidBrl: 0,
      consumedForeign: 0,
      consumedBrl: 0,
      settledSentForeign: 0,
      settledReceivedForeign: 0,
      settledSentBrl: 0,
      settledReceivedBrl: 0,
      netBalanceForeign: 0,
      netBalanceBrl: 0,
    });
  }

  let groupTotalSpendForeign = 0;
  let groupTotalSpendBrl = 0;
  let myPersonalSpendForeign = 0;
  let myPersonalSpendBrl = 0;
  let myOutOfPocketPaidForeign = 0;
  let myOutOfPocketPaidBrl = 0;
  let foreignSpentFromGlobalOrCash = 0;

  const dailyMap = new Map<
    string,
    {
      mySpendForeign: number;
      mySpendBrl: number;
      groupSpendForeign: number;
      groupSpendBrl: number;
    }
  >();

  const catMap = new Map<
    string,
    {
      mySpendForeign: number;
      mySpendBrl: number;
      groupSpendForeign: number;
      groupSpendBrl: number;
    }
  >();

  for (const tx of tripTxs) {
    const txBrl = tx.amount;
    // Determina o valor na moeda base da viagem
    let txForeign = tx.originalAmount || 0;
    if (!txForeign || tx.originalCurrency === 'BRL') {
      txForeign =
        weightedAverageRate > 0
          ? Math.round((txBrl / weightedAverageRate) * 100) / 100
          : txBrl;
    } else if (tx.originalCurrency && tx.originalCurrency !== trip.currency) {
      txForeign =
        weightedAverageRate > 0
          ? Math.round((txBrl / weightedAverageRate) * 100) / 100
          : tx.originalAmount || 0;
    }

    const payerId = tx.paidByParticipantId || meParticipant.id;
    const payerEntry = balanceMap.get(payerId) || balanceMap.get(meParticipant.id);
    if (payerEntry) {
      payerEntry.paidForeign = Math.round((payerEntry.paidForeign + txForeign) * 100) / 100;
      payerEntry.paidBrl = Math.round((payerEntry.paidBrl + txBrl) * 100) / 100;
    }

    if (payerId === meParticipant.id) {
      myOutOfPocketPaidForeign =
        Math.round((myOutOfPocketPaidForeign + txForeign) * 100) / 100;
      myOutOfPocketPaidBrl = Math.round((myOutOfPocketPaidBrl + txBrl) * 100) / 100;

      if (
        tx.currencyRegime === 'global_account' ||
        tx.currencyRegime === 'cash_fx' ||
        (!tx.creditCardId && tx.originalCurrency && tx.originalCurrency !== 'BRL')
      ) {
        foreignSpentFromGlobalOrCash =
          Math.round((foreignSpentFromGlobalOrCash + txForeign) * 100) / 100;
      }
    }

    // Distribui o consumo entre os participantes (tripShares) ou 100% para quem pagou
    let myTxForeign = txForeign;
    let myTxBrl = txBrl;

    if (Array.isArray(tx.tripShares) && tx.tripShares.length > 0) {
      myTxForeign = 0;
      myTxBrl = 0;
      for (const share of tx.tripShares) {
        const memberEntry = balanceMap.get(share.participantId);
        if (memberEntry) {
          memberEntry.consumedForeign =
            Math.round((memberEntry.consumedForeign + share.foreignShare) * 100) / 100;
          memberEntry.consumedBrl =
            Math.round((memberEntry.consumedBrl + share.brlShare) * 100) / 100;
        }
        if (share.participantId === meParticipant.id) {
          myTxForeign = Math.round((myTxForeign + share.foreignShare) * 100) / 100;
          myTxBrl = Math.round((myTxBrl + share.brlShare) * 100) / 100;
        }
      }
    } else {
      if (payerEntry) {
        payerEntry.consumedForeign =
          Math.round((payerEntry.consumedForeign + txForeign) * 100) / 100;
        payerEntry.consumedBrl =
          Math.round((payerEntry.consumedBrl + txBrl) * 100) / 100;
      }
      if (payerId !== meParticipant.id) {
        myTxForeign = 0;
        myTxBrl = 0;
      }
    }

    groupTotalSpendForeign = Math.round((groupTotalSpendForeign + txForeign) * 100) / 100;
    groupTotalSpendBrl = Math.round((groupTotalSpendBrl + txBrl) * 100) / 100;
    myPersonalSpendForeign = Math.round((myPersonalSpendForeign + myTxForeign) * 100) / 100;
    myPersonalSpendBrl = Math.round((myPersonalSpendBrl + myTxBrl) * 100) / 100;

    // Série Diária
    const dayPoint = dailyMap.get(tx.date) || {
      mySpendForeign: 0,
      mySpendBrl: 0,
      groupSpendForeign: 0,
      groupSpendBrl: 0,
    };
    dayPoint.mySpendForeign = Math.round((dayPoint.mySpendForeign + myTxForeign) * 100) / 100;
    dayPoint.mySpendBrl = Math.round((dayPoint.mySpendBrl + myTxBrl) * 100) / 100;
    dayPoint.groupSpendForeign =
      Math.round((dayPoint.groupSpendForeign + txForeign) * 100) / 100;
    dayPoint.groupSpendBrl = Math.round((dayPoint.groupSpendBrl + txBrl) * 100) / 100;
    dailyMap.set(tx.date, dayPoint);

    // Série por Categoria
    const catPoint = catMap.get(tx.categoryId) || {
      mySpendForeign: 0,
      mySpendBrl: 0,
      groupSpendForeign: 0,
      groupSpendBrl: 0,
    };
    catPoint.mySpendForeign = Math.round((catPoint.mySpendForeign + myTxForeign) * 100) / 100;
    catPoint.mySpendBrl = Math.round((catPoint.mySpendBrl + myTxBrl) * 100) / 100;
    catPoint.groupSpendForeign =
      Math.round((catPoint.groupSpendForeign + txForeign) * 100) / 100;
    catPoint.groupSpendBrl = Math.round((catPoint.groupSpendBrl + txBrl) * 100) / 100;
    catMap.set(tx.categoryId, catPoint);
  }

  // Aplica os reembolsos / acertos já realizados (settlements)
  for (const st of trip.settlements || []) {
    const sender = balanceMap.get(st.fromParticipantId);
    const receiver = balanceMap.get(st.toParticipantId);
    if (sender) {
      sender.settledSentForeign =
        Math.round((sender.settledSentForeign + st.foreignAmountEquivalent) * 100) / 100;
      sender.settledSentBrl =
        Math.round((sender.settledSentBrl + st.brlAmountSettled) * 100) / 100;
    }
    if (receiver) {
      receiver.settledReceivedForeign =
        Math.round((receiver.settledReceivedForeign + st.foreignAmountEquivalent) * 100) / 100;
      receiver.settledReceivedBrl =
        Math.round((receiver.settledReceivedBrl + st.brlAmountSettled) * 100) / 100;
    }
  }

  const participantBalances: TripParticipantBalance[] = [];
  for (const b of balanceMap.values()) {
    // Saldo líquido = (Quanto Pagou - Quanto Consumiu) + (Quanto Pagou em Acertos - Quanto Recebeu em Acertos)
    b.netBalanceForeign =
      Math.round(
        (b.paidForeign -
          b.consumedForeign +
          b.settledSentForeign -
          b.settledReceivedForeign) *
          100
      ) / 100;
    b.netBalanceBrl =
      Math.round(
        (b.paidBrl - b.consumedBrl + b.settledSentBrl - b.settledReceivedBrl) * 100
      ) / 100;
    participantBalances.push(b);
  }

  const simplifiedDebts = simplifyTripDebts(participantBalances, weightedAverageRate);
  const myBalanceObj = participantBalances.find((p) => p.isMe) || participantBalances[0];
  const myNetSettlementForeign = myBalanceObj ? myBalanceObj.netBalanceForeign : 0;
  const myNetSettlementBrl = myBalanceObj ? myBalanceObj.netBalanceBrl : 0;

  // Cálculo de dias de viagem e ritmo diário (TravelSpend)
  const tripDates = getDatesBetween(trip.startDate, trip.endDate);
  const totalDays = Math.max(1, tripDates.length);

  // Determina quantos dias já decorreram (com base nas datas de gastos ou data de referência)
  const txDates = Array.from(dailyMap.keys()).sort();
  const latestTxDate = txDates.length > 0 ? txDates[txDates.length - 1] : '';
  const effectiveToday = referenceTodayStr || latestTxDate || trip.startDate;

  let elapsedDays = 1;
  if (effectiveToday <= trip.startDate) {
    elapsedDays = txDates.length > 0 ? Math.max(1, txDates.length) : 1;
  } else if (effectiveToday >= trip.endDate) {
    elapsedDays = totalDays;
  } else {
    const idx = tripDates.indexOf(effectiveToday);
    elapsedDays = idx >= 0 ? idx + 1 : Math.max(1, txDates.length);
  }

  const remainingDays = Math.max(0, totalDays - elapsedDays);

  const budgetForeign = Math.max(0, trip.budgetForeign || 0);
  const budgetBrlEquivalent =
    Math.round(budgetForeign * weightedAverageRate * 100) / 100;
  const budgetRemainingForeign =
    Math.round((budgetForeign - myPersonalSpendForeign) * 100) / 100;
  const budgetUsedPercent =
    budgetForeign > 0
      ? Math.round((myPersonalSpendForeign / budgetForeign) * 1000) / 10
      : 0;

  const myDailyAverageForeign =
    Math.round((myPersonalSpendForeign / Math.max(1, elapsedDays)) * 100) / 100;
  const myDailyAverageBrl =
    Math.round(myDailyAverageForeign * weightedAverageRate * 100) / 100;

  const daysDivisorForSafeRemaining = remainingDays > 0 ? remainingDays : 1;
  const safeRemainingDailyForeign =
    budgetRemainingForeign > 0
      ? Math.round((budgetRemainingForeign / daysDivisorForSafeRemaining) * 100) / 100
      : 0;
  const safeRemainingDailyBrl =
    Math.round(safeRemainingDailyForeign * weightedAverageRate * 100) / 100;

  // Monta a série diária incluindo todos os dias da viagem + eventuais despesas pré-viagem
  const allDatesSet = new Set<string>([...tripDates, ...txDates]);
  const sortedAllDates = Array.from(allDatesSet).sort();

  const dailySeries: TripDailySpendPoint[] = sortedAllDates.map((dStr) => {
    const pt = dailyMap.get(dStr) || {
      mySpendForeign: 0,
      mySpendBrl: 0,
      groupSpendForeign: 0,
      groupSpendBrl: 0,
    };
    const parts = dStr.split('-');
    const dayLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dStr;
    return {
      date: dStr,
      dayLabel,
      ...pt,
    };
  });

  const catLookup = new Map(categories.map((c) => [c.id, c]));
  const categoryBreakdown: TripCategorySpendPoint[] = Array.from(catMap.entries())
    .map(([catId, val]) => {
      const cat = catLookup.get(catId);
      return {
        categoryId: catId,
        categoryName: cat?.name || 'Viagem & Geral',
        categoryColor: cat?.color || '#0284c7',
        mySpendForeign: val.mySpendForeign,
        mySpendBrl: val.mySpendBrl,
        groupSpendForeign: val.groupSpendForeign,
        groupSpendBrl: val.groupSpendBrl,
        percentOfMySpend:
          myPersonalSpendForeign > 0
            ? Math.round((val.mySpendForeign / myPersonalSpendForeign) * 1000) / 10
            : 0,
      };
    })
    .sort((a, b) => b.mySpendForeign - a.mySpendForeign);

  const remainingForeignWalletBalance =
    Math.round((totalForeignPurchased - foreignSpentFromGlobalOrCash) * 100) / 100;

  return {
    tripId: trip.id,
    currency: trip.currency,
    weightedAverageRate,
    totalForeignPurchased,
    totalBrlPurchasedForLots,
    remainingForeignWalletBalance,
    totalDays,
    elapsedDays,
    remainingDays,
    groupTotalSpendForeign,
    groupTotalSpendBrl,
    myPersonalSpendForeign,
    myPersonalSpendBrl,
    myOutOfPocketPaidForeign,
    myOutOfPocketPaidBrl,
    budgetForeign,
    budgetBrlEquivalent,
    budgetRemainingForeign,
    budgetUsedPercent,
    myDailyAverageForeign,
    myDailyAverageBrl,
    safeRemainingDailyForeign,
    safeRemainingDailyBrl,
    dailySeries,
    categoryBreakdown,
    participantBalances,
    simplifiedDebts,
    myNetSettlementForeign,
    myNetSettlementBrl,
  };
}
