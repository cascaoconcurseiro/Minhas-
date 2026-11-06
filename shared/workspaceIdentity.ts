export function getVaultIdForUid(uid: string): string {
  const normalizedUid = uid.trim();
  if (!normalizedUid) throw new Error('ID Neon Auth obrigatório.');
  return `vault_uid_${normalizedUid}`;
}
