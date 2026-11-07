export function getVaultIdForUid(uid: string): string {
  const normalizedUid = uid.trim();
  if (!normalizedUid) throw new Error('UID Firebase obrigatório.');
  return `vault_uid_${normalizedUid}`;
}
