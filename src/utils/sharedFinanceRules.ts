import type { BankAccount, Transaction } from '../types/finance';
import { formatBRL, formatMonthYearPT, getSharedSettlementLinks } from './financeRules';

export function getDomesticSharedTransactions(transactions: Transaction[]) {
  return transactions.filter((tx) => tx.type === 'expense' && tx.isShared && tx.sharedMemberId && !tx.tripId &&
    (!tx.isCompanionOnlyExpense || tx.id.startsWith('tx-mirror-')));
}

export function replaceIncomingSharedTransactions(previous: Transaction[], incoming: Transaction[]): Transaction[] {
  const mirrors = new Map<string, Transaction>();
  for (const tx of incoming) {
    if (!tx.id?.startsWith('tx-mirror-')) continue;
    mirrors.set(tx.sharedSyncId || tx.id.slice('tx-mirror-'.length), tx);
  }
  return [...previous.filter((tx) => !tx.id.startsWith('tx-mirror-')), ...mirrors.values()];
}

const sumShares = (rows: Transaction[]) => rows.reduce((sum, tx) => sum + Math.round((tx.sharedAmount || 0) * 100), 0) / 100;

export function calculateSharedMemberSummary(transactions: Transaction[], memberId: string, month: string) {
  const all = getDomesticSharedTransactions(transactions).filter((tx) => tx.sharedMemberId === memberId);
  const monthTxs = all.filter((tx) => tx.competenceMonth === month);
  const pending = monthTxs.filter((tx) => tx.sharedStatus !== 'received' && (tx.sharedAmount || 0) > 0);
  const owedToMeMonthAmount = sumShares(pending.filter((tx) => tx.sharedPaidBy !== 'member'));
  const iOweMemberMonthAmount = sumShares(pending.filter((tx) => tx.sharedPaidBy === 'member'));
  const netCompensatedMonthAmount = Math.round((owedToMeMonthAmount - iOweMemberMonthAmount) * 100) / 100;
  const allPending = all.filter((tx) => tx.sharedStatus !== 'received');
  return { monthTxs, owedToMeMonthAmount, iOweMemberMonthAmount, netCompensatedMonthAmount,
    pendingMonthAmount: Math.abs(netCompensatedMonthAmount),
    receivedMonthAmount: sumShares(all.filter((tx) => tx.sharedStatus === 'received' &&
      (tx.sharedSettledDate ? tx.sharedSettledDate.slice(0, 7) : tx.competenceMonth) === month)),
    allTimePendingAmount: Math.round((sumShares(allPending.filter((tx) => tx.sharedPaidBy !== 'member')) - sumShares(allPending.filter((tx) => tx.sharedPaidBy === 'member'))) * 100) / 100,
    totalMonthItems: monthTxs.length, hasOpenItems: pending.length > 0 };
}

export function settleSharedExpenses(transactions: Transaction[], accounts: BankAccount[], input: {
  txId?: string; memberId?: string; month?: string; memberName: string; accountId: string; date: string; settlementId: string;
}) {
  const parsed = new Date(`${input.date}T00:00:00.000Z`);
  if (!accounts.some((account) => account.id === input.accountId) || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== input.date) {
    return { transactions, affectedCount: 0, netAmount: 0, error: 'Selecione uma conta e uma data válidas para o acerto.' };
  }
  const target = getDomesticSharedTransactions(transactions).filter((tx) => tx.sharedStatus !== 'received' && (tx.sharedAmount || 0) > 0 &&
    (input.txId ? tx.id === input.txId : tx.sharedMemberId === input.memberId && tx.competenceMonth === input.month));
  if (!target.length) return { transactions, affectedCount: 0, netAmount: 0 };
  const netCents = target.reduce((sum, tx) => sum + Math.round((tx.sharedAmount || 0) * 100) * (tx.sharedPaidBy === 'member' ? -1 : 1), 0);
  const netAmount = netCents / 100;
  const ids = new Set(target.map((tx) => tx.id));
  const settled = transactions.map((tx) => ids.has(tx.id) ? { ...tx, sharedStatus: 'received' as const,
    sharedSettledDate: input.date, sharedSettledAccountId: input.accountId, sharedSettlementId: input.settlementId } : tx);
  if (netCents === 0) return { transactions: settled, affectedCount: ids.size, netAmount };
  const receive = netCents > 0;
  const reimbursement: Transaction = {
    id: `${input.txId ? 'tx-reimb-' : 'tx-reimb-all-'}${input.settlementId}`,
    description: input.txId
      ? `${receive ? 'Reembolso Compartilhado' : 'Pagamento de Rateio Compartilhado'} — ${input.memberName} (${target[0].description})`
      : `Acerto Compensado ${receive ? 'Recebido' : 'Pago'} (${formatMonthYearPT(input.month || input.date.slice(0, 7))}) — ${input.memberName}`,
    amount: Math.abs(netAmount), date: input.date, competenceMonth: input.date.slice(0, 7),
    type: receive ? 'income' : 'expense', status: 'paid', categoryId: receive ? 'cat-rendimentos' : input.txId ? target[0].categoryId : 'cat-outros',
    accountId: input.accountId, paymentMethod: 'pix', recurrence: 'single', sharedSettlementId: input.settlementId,
    notes: `Acerto de ${formatBRL(Math.abs(netAmount))} ${target.map((tx) => `[ref:${tx.id}]`).join(' ')}`,
  };
  return { transactions: [reimbursement, ...settled], affectedCount: ids.size, netAmount };
}

export function reopenSharedSettlement(transactions: Transaction[], txId: string) {
  const target = transactions.find((tx) => tx.id === txId);
  if (!target || target.sharedStatus !== 'received') return { transactions, affectedCount: 0 };
  const linked = getSharedSettlementLinks(transactions, target);
  const ids = new Set(transactions.filter((tx) => linked.has(tx.id) && tx.isShared).map((tx) => tx.id));
  const movementIds = new Set(transactions.filter((tx) => linked.has(tx.id) && tx.id.startsWith('tx-reimb-')).map((tx) => tx.id));
  return { transactions: transactions.filter((tx) => !movementIds.has(tx.id)).map((tx) => ids.has(tx.id)
    ? { ...tx, sharedStatus: 'pending' as const, sharedSettledDate: undefined, sharedSettledAccountId: undefined, sharedSettlementId: undefined } : tx), affectedCount: ids.size };
}
