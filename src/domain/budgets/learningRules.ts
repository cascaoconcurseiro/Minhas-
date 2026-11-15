import type { FamilyMember, Transaction } from '../../types/finance';

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
  /** Quando vem de uma regra de Configurações (por categoria), e não do histórico. */
  fromCategoryRule?: { categoryName: string };
}

const MIN_OCCURRENCES = 2;
const HISTORY_WINDOW = 6;
const MIN_SHARED_RATIO = 0.8;

const normalizedDescriptionCache = new Map<string, string>();

export function normalizeDescription(value: string): string {
  // Pura e chamada milhares de vezes (uma por lançamento do histórico, por item importado): guarda o resultado
  const cached = normalizedDescriptionCache.get(value);
  if (cached !== undefined) return cached;
  const result = value
    .replace(/\s*\(\d+\/\d+\)\s*$/g, '')
    .replace(/\s*\(Cópia\)\s*$/gi, '')
    .replace(/\s*\(Antecipada\)\s*$/gi, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (normalizedDescriptionCache.size > 50_000) normalizedDescriptionCache.clear();
  normalizedDescriptionCache.set(value, result);
  return result;
}

/** Chave estável do estabelecimento, usada para saber se o aviso já foi dado para ele. */
export function getDescriptionLearningKey(description: string): string {
  return normalizeDescription(description);
}

export function sameEstablishment(query: string, candidate: string): boolean {
  if (!query || !candidate) return false;
  if (query === candidate) return true;
  const shorter = query.length <= candidate.length ? query : candidate;
  const longer = shorter === query ? candidate : query;
  // Prefixo de pelo menos 4 letras ("apolo" casa com "apolo supermercado"), sem casar palavras soltas.
  return shorter.length >= 4 && longer.startsWith(`${shorter} `);
}

/** Histórico agrupado pelo nome normalizado do estabelecimento (só lançamentos que servem para aprender). */
export type EstablishmentIndex = Map<string, Transaction[]>;

export function buildEstablishmentIndex(transactions: Transaction[]): EstablishmentIndex {
  const index: EstablishmentIndex = new Map();
  for (const tx of transactions) {
    if (tx.isInvoicePayment || tx.isCompanionOnlyExpense || tx.receivableId || tx.tripId || tx.id.startsWith('tx-mirror-')) continue;
    const key = normalizeDescription(tx.description);
    const list = index.get(key);
    if (list) list.push(tx);
    else index.set(key, [tx]);
  }
  return index;
}

/** Lançamentos do mesmo estabelecimento, buscando só entre os nomes distintos (não em todos os lançamentos). */
export function similarFromIndex(key: string, index: EstablishmentIndex): Transaction[] {
  const result: Transaction[] = [];
  for (const [candidateKey, list] of index) {
    if (sameEstablishment(key, candidateKey)) result.push(...list);
  }
  return result;
}

/**
 * Descobre se esse tipo de gasto costuma ser dividido com um familiar.
 * Exige pelo menos 2 ocorrências recentes, 80% delas divididas com a mesma pessoa, pelo mesmo
 * pagador e com a mesma proporção; qualquer inconsistência devolve null (nada é aplicado).
 */
export function learnSharingFromHistory(
  description: string,
  transactions: Transaction[],
  familyMembers: FamilyMember[],
  index?: EstablishmentIndex
): LearnedSharing | null {
  const key = normalizeDescription(description);
  if (key.length < 2) return null;

  const pool = index
    ? similarFromIndex(key, index)
    : transactions.filter(
        (tx) =>
          !tx.isInvoicePayment &&
          !tx.isCompanionOnlyExpense &&
          !tx.receivableId &&
          !tx.tripId &&
          !tx.id.startsWith('tx-mirror-') &&
          sameEstablishment(key, normalizeDescription(tx.description))
      );
  const recent = pool
    .filter((tx) => tx.type === 'expense')
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
  if (learned.fromCategoryRule) {
    const ruleSplit = learned.splitMode === 'half' ? 'metade' : `${learned.percentage}%`;
    const ruleWho = learned.paidBy === 'member' ? `${learned.memberName} pagou` : 'você pagou';
    return `Dividido com ${learned.memberName} (${ruleSplit}, ${ruleWho}) porque a categoria ${learned.fromCategoryRule.categoryName} está configurada assim.`;
  }
  const split = learned.splitMode === 'half' ? 'metade' : `${learned.percentage}%`;
  const payer = learned.paidBy === 'member' ? `${learned.memberName} pagou` : 'você pagou';
  return `Dividido com ${learned.memberName} (${split}, ${payer}) porque você costuma fazer assim (${learned.sharedCount} de ${learned.totalCount} vezes).`;
}

/** Divisão definida em Configurações para a categoria (ignora regra cuja pessoa foi removida). */
export function sharingFromCategoryRule(
  rule: { memberId: string; paidBy: 'me' | 'member'; splitMode: 'half' | 'percentage'; percentage?: number } | undefined,
  categoryName: string,
  familyMembers: FamilyMember[]
): LearnedSharing | null {
  if (!rule) return null;
  const member = familyMembers.find((item) => item.id === rule.memberId);
  if (!member) return null;
  const percentage = rule.splitMode === 'percentage'
    ? Math.min(99, Math.max(1, Math.round(rule.percentage ?? 50)))
    : 50;
  return {
    memberId: member.id,
    memberName: member.name,
    paidBy: rule.paidBy === 'member' ? 'member' : 'me',
    splitMode: percentage === 50 ? 'half' : 'percentage',
    percentage,
    sharedCount: 0,
    totalCount: 0,
    fromCategoryRule: { categoryName },
  };
}
