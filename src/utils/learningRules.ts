import type { FamilyMember, Transaction } from '../types/finance';

/**
 * Padrão de divisão aprendido com o histórico: quando a pessoa sempre divide um mesmo tipo de gasto
 * com o mesmo familiar, o formulário já aplica a divisão e só avisa (com opção de desfazer).
 */
export interface LearnedSharing {
  memberId: string;
  memberName: string;
  paidBy: 'me' | 'member';
  splitMode: 'half' | 'percentage';
  /** Percentual quando `splitMode` é 'percentage'. */
  percentage: number;
  /** Quantas das ocorrências recentes foram divididas desse jeito. */
  sharedCount: number;
  /** Quantas ocorrências recentes foram consideradas. */
  totalCount: number;
}

const MIN_OCCURRENCES = 2;
const HISTORY_WINDOW = 6;
const MIN_SHARED_RATIO = 0.8;

function normalizeDescription(value: string): string {
  return value
    .replace(/\s*\(\d+\/\d+\)\s*$/g, '')
    .replace(/\s*\(Cópia\)\s*$/gi, '')
    .replace(/\s*\(Antecipada\)\s*$/gi, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Chave estável do estabelecimento, usada para saber se o aviso já foi dado para ele. */
export function getDescriptionLearningKey(description: string): string {
  return normalizeDescription(description);
}

function sameEstablishment(query: string, candidate: string): boolean {
  if (!query || !candidate) return false;
  if (query === candidate) return true;
  const shorter = query.length <= candidate.length ? query : candidate;
  const longer = shorter === query ? candidate : query;
  // Prefixo de pelo menos 4 letras ("apolo" casa com "apolo supermercado"), sem casar palavras soltas.
  return shorter.length >= 4 && longer.startsWith(`${shorter} `);
}

/**
 * Descobre se esse tipo de gasto costuma ser dividido com um familiar.
 * Exige pelo menos 2 ocorrências recentes, 80% delas divididas com a mesma pessoa, pelo mesmo
 * pagador e com a mesma proporção; qualquer inconsistência devolve null (nada é aplicado).
 */
export function learnSharingFromHistory(
  description: string,
  transactions: Transaction[],
  familyMembers: FamilyMember[]
): LearnedSharing | null {
  const key = normalizeDescription(description);
  if (key.length < 2) return null;

  const recent = transactions
    .filter(
      (tx) =>
        tx.type === 'expense' &&
        !tx.isInvoicePayment &&
        !tx.isCompanionOnlyExpense &&
        !tx.tripId &&
        !tx.id.startsWith('tx-mirror-') &&
        sameEstablishment(key, normalizeDescription(tx.description))
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, HISTORY_WINDOW);

  if (recent.length < MIN_OCCURRENCES) return null;

  const shared = recent.filter(
    (tx) => tx.isShared && tx.sharedMemberId && (tx.sharedAmount ?? 0) > 0 && tx.amount > 0
  );
  if (shared.length < MIN_OCCURRENCES || shared.length / recent.length < MIN_SHARED_RATIO) return null;

  // Mesma pessoa, mesmo pagador e proporção estável em todas as divisões
  const memberId = shared[0].sharedMemberId as string;
  const paidBy = shared[0].sharedPaidBy === 'member' ? 'member' : 'me';
  if (
    shared.some(
      (tx) =>
        tx.sharedMemberId !== memberId ||
        (tx.sharedPaidBy === 'member' ? 'member' : 'me') !== paidBy
    )
  ) {
    return null;
  }

  const ratios = shared.map((tx) => (tx.sharedAmount as number) / tx.amount);
  const average = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
  if (ratios.some((ratio) => Math.abs(ratio - average) > 0.02)) return null;

  const member = familyMembers.find((item) => item.id === memberId);
  if (!member) return null;

  const percentage = Math.round(average * 100);
  const isHalf = percentage === 50;
  return {
    memberId,
    memberName: member.name,
    paidBy,
    splitMode: isHalf ? 'half' : 'percentage',
    percentage,
    sharedCount: shared.length,
    totalCount: recent.length,
  };
}

/** Texto curto do aviso mostrado quando a divisão é aplicada automaticamente. */
export function describeLearnedSharing(learned: LearnedSharing): string {
  const split = learned.splitMode === 'half' ? 'metade' : `${learned.percentage}%`;
  const payer = learned.paidBy === 'member' ? `${learned.memberName} pagou` : 'você pagou';
  return `Dividido com ${learned.memberName} (${split}, ${payer}) porque você costuma fazer assim (${learned.sharedCount} de ${learned.totalCount} vezes).`;
}
