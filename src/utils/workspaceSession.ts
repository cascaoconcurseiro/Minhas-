/** Whether a Firebase identity change needs to discard the previous in-memory workspace. */
export function shouldResetWorkspaceForAuthChange(previousUid: string | null, nextUid: string | null): boolean {
  return previousUid !== nextUid;
}

/** A workspace is usable only for the Firebase identity that completed its Neon load. */
export function isWorkspaceLoadedForUser(loadedUid: string | null, activeUid: string | null): boolean {
  return Boolean(activeUid && loadedUid === activeUid);
}

export function clearWorkspaceCacheForVault(
  storage: Pick<Storage, 'removeItem'>,
  cachePrefix: string,
  vaultId: string
): void {
  try {
    storage.removeItem(`${cachePrefix}_${vaultId}`);
  } catch {
    // Storage may be unavailable in private browsing or restricted contexts.
  }
}
