import type { NeonWorkspaceSnapshot } from '../../lib/neonWorkspace';

/** Conflito de gravação: o que está nesta tela contra o que já está no Neon. */
export interface WorkspaceConflictState {
  localPayload: Record<string, unknown>;
  remoteSnapshot: NeonWorkspaceSnapshot;
}

export function isRetryableWorkspaceSaveError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return false;
  }

  const status = Number((error as { status?: unknown }).status);
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

export function updateWorkspaceConflictLocalPayload(
  conflict: WorkspaceConflictState,
  payload: Record<string, unknown>
): WorkspaceConflictState {
  return { ...conflict, localPayload: payload };
}

const CONTENT_KEYS = [
  'accountsJson', 'cardsJson', 'categoriesJson', 'transactionsJson', 'sharedSettlementReceiptsJson', 'goalsJson', 'receivablesJson',
  'familyMembersJson', 'investmentsJson', 'investmentTargetsJson', 'tripsJson', 'settingsJson',
] as const;

/** Identifica o conteúdo do workspace, ignorando datas de atualização. */
export function workspaceContentSignature(payload: Record<string, unknown>): string {
  return CONTENT_KEYS.map((key) => {
    const value = payload[key];
    return typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value);
  }).join('\u0001');
}
