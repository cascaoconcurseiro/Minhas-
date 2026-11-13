import type { BankAccount, CurrencyCode, Transaction } from '../types/finance';
import { formatForeignCurrency } from './travelRules';

/**
 * Regras de transferência entre contas. Só funções puras: o formulário, o saldo e a
 * verificação de dados usam as mesmas definições.
 *
 * Modelo: `amount` da transferência é sempre o valor em REAIS (o que sai da origem e o
 * que entra no destino, já na mesma régua). Quando uma ponta é conta internacional, o
 * valor na moeda estrangeira fica em `transferFromAmount` (origem) e/ou `transferToAmount`
 * (destino), e `transferExchangeRate` guarda a cotação efetiva (R$ por 1 unidade).
 */

/** Prefixo do id das transferências geradas por compra de câmbio de viagem (o valor em moeda vem do lote). */
export const FX_LOT_TRANSFER_PREFIX = 'tx-fxlot-';

export function getAccountCurrency(account: BankAccount | null | undefined): CurrencyCode {
  if (account && account.type === 'international' && account.currency && account.currency !== 'BRL') {
    return account.currency;
  }
  return 'BRL';
}

export type TransferCurrencyKind =
  | 'brl'
  | 'foreign_conversion'
  | 'foreign_same'
  | 'unsupported';

export interface TransferCurrencyPlan {
  kind: TransferCurrencyKind;
  sourceCurrency: CurrencyCode;
  destinationCurrency: CurrencyCode;
  /** Moeda estrangeira envolvida (quando houver). */
  foreignCurrency?: CurrencyCode;
  /** A origem é conta em moeda estrangeira. */
  sourceIsForeign: boolean;
  /** O destino é conta em moeda estrangeira. */
  destinationIsForeign: boolean;
  message?: string;
}

export function planTransferCurrency(
  source: BankAccount | null | undefined,
  destination: BankAccount | null | undefined
): TransferCurrencyPlan {
  const sourceCurrency = getAccountCurrency(source);
  const destinationCurrency = getAccountCurrency(destination);
  const sourceIsForeign = sourceCurrency !== 'BRL';
  const destinationIsForeign = destinationCurrency !== 'BRL';

  if (!sourceIsForeign && !destinationIsForeign) {
    return { kind: 'brl', sourceCurrency, destinationCurrency, sourceIsForeign, destinationIsForeign };
  }
  if (sourceIsForeign && destinationIsForeign && sourceCurrency !== destinationCurrency) {
    return {
      kind: 'unsupported',
      sourceCurrency,
      destinationCurrency,
      sourceIsForeign,
      destinationIsForeign,
      message: `Transferência direta entre ${sourceCurrency} e ${destinationCurrency} não é suportada. Converta pelo real: registre a saída de uma conta e a entrada na outra em dois lançamentos.`,
    };
  }
  return {
    kind: sourceIsForeign && destinationIsForeign ? 'foreign_same' : 'foreign_conversion',
    sourceCurrency,
    destinationCurrency,
    foreignCurrency: sourceIsForeign ? sourceCurrency : destinationCurrency,
    sourceIsForeign,
    destinationIsForeign,
  };
}

/** Destinos possíveis de uma transferência: qualquer conta, menos a própria origem. */
export function getTransferDestinationAccounts(
  accounts: BankAccount[],
  sourceAccountId: string
): BankAccount[] {
  return accounts.filter((account) => account.id !== sourceAccountId);
}

/** Origem usada ao trocar o destino sugerido: primeira conta diferente da origem. */
export function pickDefaultTransferDestination(
  accounts: BankAccount[],
  sourceAccountId: string
): string {
  return getTransferDestinationAccounts(accounts, sourceAccountId)[0]?.id ?? '';
}

export interface TransferLegs {
  transferFromAmount?: number;
  transferToAmount?: number;
  transferExchangeRate?: number;
}

/**
 * Valida a transferência entre contas e devolve os campos cambiais a gravar.
 * `amountBrl` é o valor em reais; `foreignAmount` é o valor na moeda estrangeira da conta.
 */
export function resolveBankTransfer(input: {
  source: BankAccount | null | undefined;
  destination: BankAccount | null | undefined;
  /** O destino é um ativo de investimento (aporte), não uma conta. */
  destinationIsInvestment?: boolean;
  amountBrl: number;
  foreignAmount?: number;
}): { error: string } | { error?: undefined; legs: TransferLegs } {
  const { source, destination, amountBrl, foreignAmount, destinationIsInvestment } = input;
  if (!source) return { error: 'Escolha a conta de origem da transferência.' };
  if (!destinationIsInvestment) {
    if (!destination) return { error: 'Escolha a conta de destino da transferência.' };
    if (source.id === destination.id) {
      return { error: 'Origem e destino precisam ser contas diferentes: não existe transferir de uma conta para ela mesma.' };
    }
  }
  if (!Number.isFinite(amountBrl) || amountBrl <= 0) {
    return { error: 'Informe um valor válido maior que zero.' };
  }
  const plan = planTransferCurrency(source, destinationIsInvestment ? null : destination);
  if (plan.kind === 'unsupported') return { error: plan.message || 'Transferência entre moedas não suportada.' };
  if (plan.kind === 'brl') return { legs: {} };

  const foreign = Number(foreignAmount);
  if (!Number.isFinite(foreign) || foreign <= 0) {
    return {
      error: `Esta transferência envolve ${plan.foreignCurrency}. Informe o valor em ${plan.foreignCurrency} e o valor em reais correspondente (a cotação é calculada).`,
    };
  }
  const rate = Math.round((amountBrl / foreign) * 1_000_000) / 1_000_000;
  if (!Number.isFinite(rate) || rate <= 0) {
    return { error: 'Não foi possível calcular a cotação desta transferência. Confira os valores.' };
  }
  return {
    legs: {
      transferFromAmount: plan.sourceIsForeign ? foreign : undefined,
      transferToAmount: plan.destinationIsForeign ? foreign : undefined,
      transferExchangeRate: rate,
    },
  };
}

/** Perna em moeda estrangeira de uma transferência para uma conta internacional (ou null). */
export function getTransferForeignLeg(
  tx: Transaction,
  account: BankAccount
): { direction: 'out' | 'in'; amount: number; rate?: number } | null {
  if (tx.type !== 'transfer') return null;
  // Compra de câmbio de viagem: a moeda já entra no saldo pelo lote da viagem; não contar duas vezes.
  if (tx.id.startsWith(FX_LOT_TRANSFER_PREFIX)) return null;
  if (tx.accountId === account.id && Number.isFinite(tx.transferFromAmount) && (tx.transferFromAmount || 0) > 0) {
    return { direction: 'out', amount: tx.transferFromAmount as number, rate: tx.transferExchangeRate };
  }
  if (
    tx.destinationAccountId === account.id &&
    Number.isFinite(tx.transferToAmount) &&
    (tx.transferToAmount || 0) > 0
  ) {
    return { direction: 'in', amount: tx.transferToAmount as number, rate: tx.transferExchangeRate };
  }
  return null;
}

/** Transferências entre contas de moedas diferentes que ficaram sem o valor na moeda estrangeira (histórico antigo). */
export function findUnconvertedForeignTransfers(
  transactions: Transaction[],
  accounts: BankAccount[]
): Transaction[] {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  return transactions.filter((tx) => {
    if (tx.type !== 'transfer' || !tx.accountId || !tx.destinationAccountId) return false;
    if (tx.id.startsWith(FX_LOT_TRANSFER_PREFIX)) return false;
    const source = byId.get(tx.accountId);
    const destination = byId.get(tx.destinationAccountId);
    if (!source || !destination) return false;
    const plan = planTransferCurrency(source, destination);
    if (plan.kind === 'brl') return false;
    if (plan.kind === 'unsupported') return true;
    const needsFrom = plan.sourceIsForeign && !(tx.transferFromAmount && tx.transferFromAmount > 0);
    const needsTo = plan.destinationIsForeign && !(tx.transferToAmount && tx.transferToAmount > 0);
    return needsFrom || needsTo;
  });
}

/** Transferências em que origem e destino são a mesma conta (histórico inválido). */
export function findSelfTransfers(transactions: Transaction[]): Transaction[] {
  return transactions.filter(
    (tx) => tx.type === 'transfer' && Boolean(tx.accountId) && tx.accountId === tx.destinationAccountId
  );
}

/** Texto curto da perna estrangeira de uma transferência, ex.: " · US$ 100,00 a R$ 5,40" (vazio se não houver). */
export function describeTransferForeignLeg(tx: Transaction, accounts: BankAccount[]): string {
  if (tx.type !== 'transfer') return '';
  const foreignAmount = tx.transferFromAmount || tx.transferToAmount;
  if (!foreignAmount || foreignAmount <= 0) return '';
  const source = accounts.find((account) => account.id === tx.accountId);
  const destination = accounts.find((account) => account.id === tx.destinationAccountId);
  const currency = tx.transferFromAmount ? getAccountCurrency(source) : getAccountCurrency(destination);
  if (currency === 'BRL') return '';
  const rate = tx.transferExchangeRate ? ` a ${formatForeignCurrency(tx.transferExchangeRate, 'BRL')}` : '';
  return ` · ${formatForeignCurrency(foreignAmount, currency)}${rate}`;
}
