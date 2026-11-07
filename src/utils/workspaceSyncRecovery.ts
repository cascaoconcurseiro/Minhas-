import type { WorkspaceConflictState } from '../components/WorkspaceConflictModal';

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
