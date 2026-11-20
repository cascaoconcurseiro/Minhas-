/** Divisão de gastos entre viajantes e simplificação de dívidas. */
import type {
  CurrencyCode,
  TripDebtTransfer,
  TripExpenseShare,
  TripParticipant,
  TripParticipantBalance,
  TripSplitMethod,
} from '../../types/finance';
import {
  parseBRLInput,
} from '../finance/financeRules.ts';
import {
  CURRENCY_CATALOG,
} from './currencyCatalog.ts';

export interface CustomParticipantSplitInput {
  participantId: string;
  exactForeign?: number;
  percentage?: number;
  sharesWeight?: number;
}

export function validateTripExpenseSplitInputs(
  totalForeignAmount: number,
  participants: TripParticipant[],
  selectedParticipantIds: string[],
  method: TripSplitMethod,
  customInputs: CustomParticipantSplitInput[] = []
): string | null {
  if (method !== 'exact' && method !== 'percentage') return null;
  if (!Number.isFinite(totalForeignAmount) || totalForeignAmount <= 0) {
    return 'Informe um total válido para o rateio da viagem.';
  }

  const selected = participants.filter((p) => selectedParticipantIds.includes(p.id));
  const activeList = selected.length > 0 ? selected : participants.slice(0, 1);
  if (activeList.length === 0) return 'Selecione ao menos uma pessoa para o rateio.';

  const customMap = new Map(customInputs.map((input) => [input.participantId, input]));
  const values = activeList.map((participant) =>
    method === 'exact'
      ? customMap.get(participant.id)?.exactForeign
      : customMap.get(participant.id)?.percentage
  );

  if (values.some((value) => value === undefined || !Number.isFinite(value) || value < 0)) {
    return 'Preencha valores válidos e não negativos para todas as pessoas selecionadas.';
  }

  const cents = values.map((value) => Math.round(parseBRLInput(String(value)) * 100));
  const totalCents = Math.round(parseBRLInput(String(totalForeignAmount)) * 100);
  const sumCents = cents.reduce((sum, value) => sum + value, 0);

  if (method === 'exact' && sumCents !== totalCents) {
    return 'A soma dos valores exatos precisa fechar o total da despesa na moeda original.';
  }
  if (method === 'percentage' && sumCents !== 10000) {
    return 'A soma das porcentagens precisa ser exatamente 100%.';
  }

  return null;
}

/**
 * Calcula o rateio exato de uma despesa de viagem entre os participantes selecionados,
 * tanto na moeda original da viagem quanto em Reais (BRL), garantindo que a soma dos
 * centavos feche 100% com o total da nota sem sobras de arredondamento.
 */
export function calculateTripExpenseSplit(
  totalForeignAmount: number,
  totalBrlAmount: number,
  participants: TripParticipant[],
  selectedParticipantIds: string[],
  method: TripSplitMethod,
  customInputs: CustomParticipantSplitInput[] = [],
  /** Moeda do valor estrangeiro: define a menor unidade (JPY e CLP não têm centavos). Padrão: 2 casas. */
  foreignCurrency?: CurrencyCode
): TripExpenseShare[] {
  const foreignScale = 10 ** (foreignCurrency ? (CURRENCY_CATALOG[foreignCurrency]?.decimals ?? 2) : 2);
  const validParticipants = participants.filter((p) =>
    selectedParticipantIds.includes(p.id)
  );
  const activeList =
    validParticipants.length > 0 ? validParticipants : participants.slice(0, 1);

  if (activeList.length === 0) return [];
  const isSingleParticipant = activeList.length === 1;
  if (
    !(isSingleParticipant && (method === 'exact' || method === 'percentage')) &&
    validateTripExpenseSplitInputs(
      totalForeignAmount,
      participants,
      selectedParticipantIds,
      method,
      customInputs
    )
  ) {
    return [];
  }

  const count = activeList.length;
  const customMap = new Map(customInputs.map((c) => [c.participantId, c]));

  // Cálculo dos pesos proporcionais de cada participante
  let weights: number[] = [];

  if (
    method === 'equal' ||
    method === 'individual' ||
    (isSingleParticipant && (method === 'exact' || method === 'percentage'))
  ) {
    weights = activeList.map(() => 1);
  } else if (method === 'exact') {
    const exactValues = activeList.map(
      (p) => Math.max(0, customMap.get(p.id)?.exactForeign || 0)
    );
    const sumExact = exactValues.reduce((a, b) => a + b, 0);
    weights = sumExact > 0 ? exactValues : activeList.map(() => 1);
  } else if (method === 'percentage') {
    const pctValues = activeList.map(
      (p) => Math.max(0, customMap.get(p.id)?.percentage || 0)
    );
    const sumPct = pctValues.reduce((a, b) => a + b, 0);
    weights = sumPct > 0 ? pctValues : activeList.map(() => 1);
  } else if (method === 'shares') {
    const shareValues = activeList.map(
      (p) => Math.max(0, customMap.get(p.id)?.sharesWeight ?? 1)
    );
    const sumShares = shareValues.reduce((a, b) => a + b, 0);
    weights = sumShares > 0 ? shareValues : activeList.map(() => 1);
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0) || count;

  const shares: TripExpenseShare[] = [];
  let allocatedForeign = 0;
  let allocatedBrl = 0;

  for (let i = 0; i < count; i++) {
    const p = activeList[i];
    const ratio = weights[i] / totalWeight;
    const isLast = i === count - 1;

    const rawForeign =
      method === 'exact' && !isSingleParticipant
        ? Math.round(
            parseBRLInput(String(customMap.get(p.id)?.exactForeign ?? 0)) * foreignScale
          ) / foreignScale
        : isLast
        ? Math.round((totalForeignAmount - allocatedForeign) * foreignScale) / foreignScale
        : Math.floor(totalForeignAmount * ratio * foreignScale) / foreignScale;

    const rawBrl = isLast
      ? Math.round((totalBrlAmount - allocatedBrl) * 100) / 100
      : Math.floor(totalBrlAmount * ratio * 100) / 100;

    allocatedForeign = Math.round((allocatedForeign + rawForeign) * foreignScale) / foreignScale;
    allocatedBrl = Math.round((allocatedBrl + rawBrl) * 100) / 100;

    shares.push({
      participantId: p.id,
      foreignShare: Math.max(0, rawForeign),
      brlShare: Math.max(0, rawBrl),
      percentage: Math.round(ratio * 1000) / 10,
      sharesWeight: customMap.get(p.id)?.sharesWeight ?? 1,
    });
  }

  return shares;
}

/**
 * Algoritmo estilo Splitwise / Tricount de simplificação de dívidas em múltiplas moedas:
 * Recebe os saldos líquidos dos participantes (Positivo = Credor que pagou a mais; Negativo = Devedor)
 * e retorna o número mínimo de transferências necessárias para zerar a viagem.
 */
export function simplifyTripDebts(
  balances: TripParticipantBalance[],
  defaultEffectiveRate: number
): TripDebtTransfer[] {
  const debtors = balances
    .filter((b) => b.netBalanceForeign < -0.009)
    .map((b) => ({
      id: b.participantId,
      name: b.participantName,
      debtForeign: Math.abs(b.netBalanceForeign),
      debtBrl: Math.abs(b.netBalanceBrl),
    }))
    .sort((a, b) => b.debtForeign - a.debtForeign);

  const creditors = balances
    .filter((b) => b.netBalanceForeign > 0.009)
    .map((b) => ({
      id: b.participantId,
      name: b.participantName,
      creditForeign: b.netBalanceForeign,
      creditBrl: b.netBalanceBrl,
    }))
    .sort((a, b) => b.creditForeign - a.creditForeign);

  const transfers: TripDebtTransfer[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settledForeign =
      Math.round(Math.min(debtor.debtForeign, creditor.creditForeign) * 100) / 100;

    if (settledForeign > 0.009) {
      // Calcula a taxa efetiva proporcional das despesas que geraram o saldo
      const creditorImpliedRate =
        creditor.creditForeign > 0
          ? creditor.creditBrl / creditor.creditForeign
          : defaultEffectiveRate;

      // Preserve both participants' independently rounded BRL balances. A
      // shared creditor rate can otherwise make the first debtor consume a
      // cent that belongs to a later debtor (or leave a cent unassigned).
      const rateBasedBrl =
        Math.round(settledForeign * creditorImpliedRate * 100) / 100;
      const settledBrl = Math.min(
        rateBasedBrl,
        debtor.debtBrl,
        creditor.creditBrl
      );
      const actualEffectiveRate = settledForeign > 0
        ? settledBrl / settledForeign
        : creditorImpliedRate;

      transfers.push({
        fromParticipantId: debtor.id,
        fromName: debtor.name,
        toParticipantId: creditor.id,
        toName: creditor.name,
        amountForeign: settledForeign,
        amountBrlEffective: settledBrl,
        impliedEffectiveRate: Math.round(actualEffectiveRate * 10000) / 10000,
      });

      debtor.debtForeign = Math.round((debtor.debtForeign - settledForeign) * 100) / 100;
      debtor.debtBrl = Math.max(0, Math.round((debtor.debtBrl - settledBrl) * 100) / 100);
      creditor.creditForeign =
        Math.round((creditor.creditForeign - settledForeign) * 100) / 100;
      creditor.creditBrl = Math.max(
        0,
        Math.round((creditor.creditBrl - settledBrl) * 100) / 100
      );
    }

    if (debtor.debtForeign <= 0.009) dIdx++;
    if (creditor.creditForeign <= 0.009) cIdx++;
  }

  return transfers;
}
