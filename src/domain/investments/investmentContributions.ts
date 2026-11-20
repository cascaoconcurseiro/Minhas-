/** Metas de alocação, aporte e resgate ligados à conta e arredondamento de preço. */
import type {
  InvestmentAsset,
  SavingsGoal,
  Transaction,
} from '../../types/finance';
import {
  isValidISODate,
} from '../finance/formatting.ts';
import {
  applyAssetOperation,
} from './portfolioMetrics.ts';

export function getInvestmentDeletionRestriction(asset: InvestmentAsset, transactions: Transaction[], goals: SavingsGoal[]): string | null {
  if (asset.quantity !== 0) return 'Este ativo ainda possui saldo. Registre o resgate antes de excluí-lo.';
  if (transactions.some(tx => tx.targetInvestmentAssetId === asset.id)) return 'Este ativo possui movimentações no histórico e deve ser mantido na carteira, mesmo com saldo zero.';
  if (goals.some(goal => goal.linkedAssetId === asset.id)) return 'Este ativo está vinculado a uma meta. Revise o vínculo da meta antes de excluí-lo.';
  return null;
}

/**
 * Aporte direto em um ativo: valida ANTES de mexer no dinheiro. Exige ativo existente, cotação válida e que o valor
 * em reais caiba exatamente na quantidade (4 casas), para a carteira subir o mesmo valor que saiu da conta.
 */
export function planAssetContribution(
  asset: InvestmentAsset | undefined,
  amount: number
): { error: string } | { error?: undefined; quantity: number } {
  if (!asset) return { error: 'O ativo escolhido para o aporte não foi encontrado. Escolha outro destino.' };
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(cents) || cents <= 0) {
    return { error: 'Informe um valor de aporte válido.' };
  }
  if (!Number.isFinite(asset.currentPrice) || asset.currentPrice <= 0) {
    return { error: `${asset.ticker} está sem cotação. Atualize a cotação do ativo na aba Investimentos antes de aportar.` };
  }
  const quantity = Math.round((amount / asset.currentPrice) * 10000) / 10000;
  const representedCents = Math.round(quantity * asset.currentPrice * 100);
  if (!(quantity > 0) || representedCents !== cents) {
    return {
      error: `R$ ${amount.toFixed(2).replace('.', ',')} não corresponde a uma quantidade exata de ${asset.ticker} (cota R$ ${asset.currentPrice.toFixed(2).replace('.', ',')}, 4 casas). Registre o aporte pela quantidade na aba Investimentos.`,
    };
  }
  return { quantity };
}

/** Preço de ativo: 2 casas a partir de R$ 1; abaixo disso até 6 casas, para ativos de centavos não zerarem. */

export function createGoalInvestmentContribution(goal: SavingsGoal, asset: InvestmentAsset, amount: number, date: string, accountId?: string, id = 'goal-contribution'): { asset: InvestmentAsset; goal: SavingsGoal; transaction?: Transaction } {
  const cents = Math.round(amount * 100);
  if (goal.linkedAssetId !== asset.id || !Number.isFinite(amount) || !Number.isSafeInteger(cents) || cents <= 0 || !Number.isFinite(asset.currentPrice) || asset.currentPrice <= 0) {
    throw new RangeError('Confira o valor e o investimento vinculado à meta.');
  }
  const quantity = Math.round((cents / 100 / asset.currentPrice) * 10000) / 10000;
  const movement = createInvestmentCashMovement(asset, 'buy', quantity, asset.currentPrice, accountId || 'unlinked', date, id);
  const updatedAsset = { ...applyAssetOperation(asset, 'buy', quantity, asset.currentPrice), currentPrice: asset.currentPrice };
  const previousValue = Math.round(asset.quantity * asset.currentPrice * 100);
  const nextValue = Math.round(updatedAsset.quantity * updatedAsset.currentPrice * 100);
  if (!Number.isSafeInteger(nextValue) || movement.amount !== cents / 100 || nextValue - previousValue !== cents) {
    throw new RangeError('O valor não corresponde à quantidade do ativo com quatro casas decimais. Registre o aporte pela quantidade na carteira de investimentos.');
  }
  return { asset: updatedAsset, goal: { ...goal, currentAmount: nextValue / 100 }, transaction: accountId ? movement : undefined };
}

export function createInvestmentCashMovement(asset: InvestmentAsset, mode: 'buy' | 'sell', quantity: number, price: number, accountId: string, date: string, id: string): Transaction {
  const cents = Math.round(quantity * price * 100);
  if (!accountId || !isValidISODate(date) ||
    !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(cents) || cents <= 0 || (mode === 'sell' && quantity > asset.quantity)) {
    throw new RangeError('Confira data, conta, quantidade e valor da operação de investimento.');
  }
  // Venda: o lucro/prejuízo realizado usa o preço médio da posição (regra da Receita Federal), em centavos.
  const realizedGainCents = mode === 'sell' && asset.averagePrice > 0
    ? Math.round(quantity * price * 100) - Math.round(quantity * asset.averagePrice * 100)
    : undefined;
  return { id, description:`${mode === 'buy' ? 'Aporte' : 'Resgate'} Investimento — ${asset.ticker} (${quantity} un.)`,
    ...(realizedGainCents !== undefined ? { realizedGain: realizedGainCents / 100 } : {}),
    amount:cents/100, date, competenceMonth:date.slice(0,7), type:'transfer', status:'paid', categoryId:'cat-aportes',
    ...(mode === 'buy' ? {accountId} : {destinationAccountId:accountId}), targetInvestmentAssetId:asset.id,
    paymentMethod:'transfer',recurrence:'single',notes:`${mode === 'buy' ? 'Compra' : 'Venda'} de ${asset.name} na corretora ${asset.institution}` };
}
