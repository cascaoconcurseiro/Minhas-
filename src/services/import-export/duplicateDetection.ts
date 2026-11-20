/** Categoria provável e detecção de lançamento repetido. */
import type {
  Category,
  Transaction,
} from '../../types/finance';
import {
  matchCategoryByDescription,
} from '../../domain/finance/categoryMatching';
import type {
  ParsedBankStatementItem,
} from './statementTypes.ts';

export function inferCategoryByDescription(
  description: string,
  categories: Category[],
  type: 'income' | 'expense' = 'expense'
): string {
  const match = matchCategoryByDescription(description, categories, type);
  if (match) return match.categoryId;

  // Fallback: match by transaction type
  const fallbackCat = categories.find((c) => c.type === type);
  return fallbackCat ? fallbackCat.id : categories[0]?.id || 'cat-outros';
}

/**
 * Normalizes description text for duplicate matching comparison.
 */
export function cleanDescriptionForComparison(desc: string): string {
  return desc
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface DuplicateLookup {
  byFitid: Map<string, Transaction[]>;
  byDate: Map<string, Transaction[]>;
}

/** Índices por identificador e por dia, para conferir centenas de linhas sem varrer o histórico inteiro a cada uma. */
export function buildDuplicateLookup(transactions: Transaction[]): DuplicateLookup {
  const byFitid = new Map<string, Transaction[]>();
  const byDate = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.fitid) {
      const sameId = byFitid.get(tx.fitid);
      if (sameId) sameId.push(tx);
      else byFitid.set(tx.fitid, [tx]);
    }
    const list = byDate.get(tx.date);
    if (list) list.push(tx);
    else byDate.set(tx.date, [tx]);
  }
  return { byFitid, byDate };
}

function shiftIsoDate(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/**
 * Detects whether an imported bank item is already present in the existing transactions list.
 */
export function checkItemDuplicate(
  item: ParsedBankStatementItem,
  existingTransactions: Transaction[],
  targetAccountId?: string,
  statementCurrency = 'BRL',
  exchangeRate?: number,
  ignoreTransactionId?: string,
  lookup?: DuplicateLookup
): { isDuplicate: boolean; reason?: string } {
  // Com o índice, só olha os lançamentos do mesmo dia (e dias vizinhos), não a lista inteira
  const sameDayTransactions = lookup ? lookup.byDate.get(item.date) ?? [] : existingTransactions;
  const nearbyTransactions = lookup
    ? [shiftIsoDate(item.date, -1), item.date, shiftIsoDate(item.date, 1)].flatMap((date) => lookup.byDate.get(date) ?? [])
    : existingTransactions;
  // 1. Exact FITID match
  // Ids antigos 'csv-row-N' vinham da posição da linha e não identificam o lançamento: ignora-os
  if (item.fitid && !/^csv-row-\d+$/.test(item.fitid)) {
    // O FITID só identifica o lançamento dentro da conta do extrato: a mesma chave em outra conta não é repetição.
    const sameAccount = (tx: Transaction) =>
      !targetAccountId || !tx.accountId || tx.accountId === targetAccountId || tx.destinationAccountId === targetAccountId;
    const candidates = lookup
      ? lookup.byFitid.get(item.fitid) ?? []
      : existingTransactions.filter((tx) => tx.fitid && tx.fitid === item.fitid);
    const fitidMatch = candidates.find((tx) => tx.id !== ignoreTransactionId && sameAccount(tx));
    if (fitidMatch) {
      return {
        isDuplicate: true,
        reason: `FITID idêntico já cadastrado (${fitidMatch.description} em ${fitidMatch.date})`,
      };
    }
  }

  // 1b. Transferência entre contas já lançada à mão: a saída (ou entrada) do extrato é a mesma movimentação.
  // Sem isto o dinheiro sairia duas vezes da conta (a transferência e uma despesa nova).
  const transferMatch = nearbyTransactions.find((tx) => {
    if (tx.id === ignoreTransactionId) return false;
    if (tx.type !== 'transfer' || !tx.accountId || !tx.destinationAccountId) return false;
    if (tx.status !== 'paid') return false;
    const isOutgoing = item.rawType === 'expense';
    const sideAccountId = isOutgoing ? tx.accountId : tx.destinationAccountId;
    if (targetAccountId && sideAccountId !== targetAccountId) return false;
    if (daysApart(tx.date, item.date) > 1) return false;
    const foreignLeg = isOutgoing ? tx.transferFromAmount : tx.transferToAmount;
    const legAmount = statementCurrency !== 'BRL' && foreignLeg ? foreignLeg : tx.amount;
    const itemAmount =
      statementCurrency !== 'BRL' && !foreignLeg && Number.isFinite(exchangeRate)
        ? Math.round(item.amount * (exchangeRate || 1) * 100) / 100
        : item.amount;
    return Math.abs(legAmount - itemAmount) < 0.01;
  });
  if (transferMatch) {
    return {
      isDuplicate: true,
      reason: `Já registrada como transferência entre contas (${transferMatch.description} em ${transferMatch.date})`,
    };
  }

  // 2. Exact Date + Amount match on same account (or matching description)
  const normImportDesc = cleanDescriptionForComparison(item.description);
  const amountInBrlCents = Math.round(item.amount * (exchangeRate || 1) * 100);
  const comparableAmount = statementCurrency === 'BRL' || !Number.isFinite(exchangeRate) ||
    !Number.isSafeInteger(amountInBrlCents)
    ? item.amount
    : amountInBrlCents / 100;
  const potentialMatches = sameDayTransactions.filter((tx) => {
    if (tx.id === ignoreTransactionId) return false;
    if (targetAccountId && tx.accountId && tx.accountId !== targetAccountId) {
      return false;
    }
    const isSameDate = tx.date === item.date;
    const txComparableAmount = statementCurrency !== 'BRL' && tx.originalCurrency === statementCurrency &&
      Number.isFinite(tx.originalAmount)
      ? tx.originalAmount as number
      : tx.amount;
    const itemComparableAmount = statementCurrency !== 'BRL' && tx.originalCurrency === statementCurrency
      ? item.amount
      : comparableAmount;
    const isSameAmount = Math.abs(txComparableAmount - itemComparableAmount) < 0.01;
    const isSameType = tx.type === item.rawType;
    return isSameDate && isSameAmount && isSameType;
  });

  if (potentialMatches.length > 0) {
    // Check if any has high description overlap
    for (const match of potentialMatches) {
      const normTxDesc = cleanDescriptionForComparison(match.description);
      const isDescMatch =
        normImportDesc.includes(normTxDesc) ||
        normTxDesc.includes(normImportDesc) ||
        normImportDesc.slice(0, 8) === normTxDesc.slice(0, 8);

      if (isDescMatch) {
        return {
          isDuplicate: true,
          reason: `Mesma data (${item.date}), valor (${item.amount}) e descrição semelhante`,
        };
      }
    }

    // Even if description differs slightly, warn about same date and amount on same account
    return {
      isDuplicate: true,
      reason: `Mesma data (${item.date}) e valor exato (${item.amount.toFixed(2)}) nesta conta`,
    };
  }

  return { isDuplicate: false };
}

/**
 * Prepares statement items into reconciliation candidates with duplicate flags and category suggestions.
 */

export function daysApart(a: string, b: string): number {
  return Math.abs(Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000));
}
