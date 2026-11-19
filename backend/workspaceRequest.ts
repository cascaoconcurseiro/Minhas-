/** Validação do workspace recebido do app. */
import { parseSharedSettlementReceipts } from '../src/domain/family/sharedSettlementReceipts.ts';
import { getReceivableLinkIssues, parseWorkspaceArray, validateWorkspaceConsistency } from '../src/services/workspace/workspacePayload.ts';

export function getRequestWorkspacePayload(
  value: unknown,
  vaultId: string
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  try { parseSharedSettlementReceipts(payload.sharedSettlementReceiptsJson); } catch { return null; }
  const requiredJsonFields = [
    'accountsJson',
    'cardsJson',
    'categoriesJson',
    'transactionsJson',
    'goalsJson',
    'investmentsJson',
  ];
  if (
    typeof payload.updatedAt !== 'string' ||
    requiredJsonFields.some((field) => typeof payload[field] !== 'string')
  ) {
    return null;
  }
  for (const field of requiredJsonFields) {
    try {
      parseWorkspaceArray(payload[field], [], field);
    } catch {
      return null;
    }
  }
  try {
    const consistencyError = validateWorkspaceConsistency({
      accounts: parseWorkspaceArray(payload.accountsJson, [], 'accountsJson'),
      cards: parseWorkspaceArray(payload.cardsJson, [], 'cardsJson'),
      transactions: parseWorkspaceArray(payload.transactionsJson, [], 'transactionsJson'),
    });
    if (consistencyError) return null;
  } catch {
    return null;
  }
  for (const field of [
    'familyMembersJson',
    'investmentTargetsJson',
    'tripsJson',
    'settingsJson',
    'receivablesJson',
  ]) {
    if (payload[field] === undefined) continue;
    try {
      const parsed = JSON.parse(String(payload[field]));
      if (field === 'receivablesJson') {
        parseWorkspaceArray(payload[field], [], field);
      } else if (field === 'familyMembersJson' || field === 'tripsJson') {
        parseWorkspaceArray(parsed, [], field);
      } else if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }
    } catch {
      return null;
    }
  }
  // Identity always comes from the verified session token, never from a
  // client-provided or legacy backup UID.
  return { ...payload, uid: vaultId };
}

export function getWorkspaceReceivableIssues(payload: Record<string, unknown>) {
  return getReceivableLinkIssues(
    parseWorkspaceArray(payload.receivablesJson, [], 'receivablesJson'),
    parseWorkspaceArray(payload.transactionsJson, [], 'transactionsJson'),
    parseWorkspaceArray(payload.accountsJson, [], 'accountsJson')
  );
}
